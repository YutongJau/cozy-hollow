#!/usr/bin/env python3
"""Cozy Hollow - the farm server.

Owns the world, ticks it forward once a second, saves it to disk and talks to
clients.  Two doors into the same farm:

  * a TCP socket speaking newline-delimited JSON (the terminal client), and
  * an HTTP server that serves the browser game from ./web and upgrades
    /ws to a WebSocket speaking the very same JSON messages.

Normally you never start this yourself: farm.py launches it in the background
the first time somebody plays and it keeps running so the crops keep growing.
"""
import argparse
import asyncio
import base64
import hashlib
import json
import mimetypes
import os
import signal
import sys
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import world as W  # noqa: E402
import pingall  # noqa: E402

DEFAULT_DIR = os.path.join(os.path.expanduser("~"), ".cozyfarm")
DEFAULT_SAVE = os.path.join(DEFAULT_DIR, "world.json")
DEFAULT_PORT = 7734
DEFAULT_WEB_PORT = 7735
WEB_DIR = os.path.join(HERE, "web")
# changes whenever the game files change, so open browser tabs know to reload after an update
BUILD = str(int(max([os.path.getmtime(os.path.join(WEB_DIR, f)) for f in os.listdir(WEB_DIR)] +
                    [os.path.getmtime(os.path.join(HERE, f)) for f in ("world.py", "areas.py")])))
SAVE_EVERY = 20.0
TTY_PING_EVERY = (30.0, 5.0)   # min seconds between terminal pings: per player, and from anyone
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def log(*a):
    print(time.strftime("%Y-%m-%d %H:%M:%S"), *a, flush=True)


def ws_frame(payload, opcode=0x1):
    """Build an unmasked WebSocket frame (server -> client)."""
    n = len(payload)
    if n < 126:
        head = bytes([0x80 | opcode, n])
    elif n < 65536:
        head = bytes([0x80 | opcode, 126]) + n.to_bytes(2, "big")
    else:
        head = bytes([0x80 | opcode, 127]) + n.to_bytes(8, "big")
    return head + payload


class Conn:
    """A connected client: either a raw TCP line client or a WebSocket."""

    def __init__(self, writer, kind, peer):
        self.writer = writer
        self.kind = kind
        self.peer = peer

    def send(self, msg):
        if self.writer.is_closing():
            return
        data = json.dumps(msg, separators=(",", ":")).encode("utf-8")
        try:
            self.writer.write(ws_frame(data) if self.kind == "ws" else data + b"\n")
        except Exception:
            pass

    def close(self):
        try:
            self.writer.close()
        except Exception:
            pass

    def is_closing(self):
        return self.writer.is_closing()


async def tcp_messages(reader):
    while True:
        line = await reader.readline()
        if not line:
            return
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line.decode("utf-8"))
        except ValueError:
            continue


async def ws_messages(reader, writer):
    buf = b""
    while True:
        try:
            hdr = await reader.readexactly(2)
            fin, op = hdr[0] & 0x80, hdr[0] & 0x0F
            masked, ln = hdr[1] & 0x80, hdr[1] & 0x7F
            if ln == 126:
                ln = int.from_bytes(await reader.readexactly(2), "big")
            elif ln == 127:
                ln = int.from_bytes(await reader.readexactly(8), "big")
            if ln > 1 << 20:
                return
            mask = await reader.readexactly(4) if masked else None
            data = await reader.readexactly(ln)
        except (asyncio.IncompleteReadError, ConnectionError):
            return
        if mask:
            data = bytes(b ^ mask[i & 3] for i, b in enumerate(data))
        if op == 0x8:            # close
            return
        if op == 0x9:            # ping -> pong
            writer.write(ws_frame(data, 0xA))
            continue
        if op == 0xA:
            continue
        buf += data
        if not fin:
            continue
        payload, buf = buf, b""
        try:
            yield json.loads(payload.decode("utf-8"))
        except ValueError:
            continue


class FarmServer:
    def __init__(self, world, save_path, web_url):
        self.world = world
        self.save_path = save_path
        self.web_url = web_url
        self.clients = {}          # name -> Conn
        self.last_save = time.time()
        self.stopping = False
        self.tty_pinged = {}       # name -> last terminal ping ("" = anyone)

    # -------------------------------------------------------------- fan-out
    def dispatch(self, out):
        for target, msg in out:
            if target == "all":
                for c in list(self.clients.values()):
                    c.send(msg)
            else:
                c = self.clients.get(target)
                if c is not None:
                    c.send(msg)

    def broadcast_state(self):
        if not self.clients:
            return
        snap = self.world.snapshot(time.time())
        for name, c in list(self.clients.items()):
            p = self.world.players.get(name)
            if p is None:
                continue
            snap["me"] = self.world.private_player(p)
            c.send(snap)

    # -------------------------------------------------------------- sessions
    @staticmethod
    def clean_name(raw):
        raw = "".join(ch for ch in str(raw) if ch.isalnum() or ch in "_-")
        return raw[:12]

    async def session(self, conn, messages):
        name = None
        try:
            try:
                hello = await asyncio.wait_for(messages.__anext__(), timeout=20)
            except (StopAsyncIteration, asyncio.TimeoutError):
                return
            if hello.get("t") != "hello":
                return
            name = self.clean_name(hello.get("name", ""))
            if not name:
                conn.send(dict(t="error", text="Invalid name"))
                return
            old = self.clients.get(name)
            if old is not None and old is not conn:
                old.send(dict(t="error", text="You connected from another window."))
                old.close()
            self.clients[name] = conn
            log("join", name, conn.kind, conn.peer)
            out = self.world.join(name, time.time(), hello.get("sprite"), hello.get("color"), hello.get("hat"))
            conn.send(dict(t="welcome", name=name, farm=self.world.name, log=self.world.log[-40:], build=BUILD,
                           dyn=[dict(name=k, map=v, title=self.world.place_name(k)) for k, v in self.world.dyn_maps.items()],
                           map=self.world.map, catalog=W.catalog(), web_url=self.web_url))
            self.dispatch(out)
            self.broadcast_state()
            async for msg in messages:
                if self.stopping:
                    break
                try:
                    out = self.world.apply(name, msg, time.time())
                except Exception:
                    log("error applying", msg)
                    traceback.print_exc()
                    conn.send(dict(t="msg", text="Hmm, that didn't work (server error).", style="warn"))
                    continue
                if msg.get("t") == "ping" and conn.kind == "ws":
                    self.tty_ping(name)
                self.dispatch(out)
                self.broadcast_state()
        except (ConnectionError, asyncio.TimeoutError, ValueError) as e:
            log("client dropped", name or conn.peer, type(e).__name__)
        except Exception:
            traceback.print_exc()
        finally:
            if name and self.clients.get(name) is conn:
                del self.clients[name]
                log("leave", name)
                out = self.world.leave(name, time.time())
                self.dispatch(out)
                self.broadcast_state()
                self.save_now()
            conn.close()

    def tty_ping(self, name):
        """Browser players can't write to terminals themselves; do it for them (rate limited:
        anyone who reaches the web port can ping, and every ping lands on the host's terminals)."""
        now = time.time()
        if now - self.tty_pinged.get(name, 0) < TTY_PING_EVERY[0] or now - self.tty_pinged.get("", 0) < TTY_PING_EVERY[1]:
            return
        self.tty_pinged[name] = self.tty_pinged[""] = now
        bubble = (self.world.players.get(name) or {}).get("bubble")
        text = bubble[0] if bubble else "hi"   # the cleaned, 120-char text act_ping showed in game
        hint = "join the farm:  cd %s && python3 farm.py   or open %s" % (
            HERE.replace(os.path.expanduser("~"), "~", 1), self.web_url)
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, pingall.ping_all, name, text, True, hint)

    async def handle_tcp(self, reader, writer):
        peer = writer.get_extra_info("peername")
        # farm.py probes the port by connecting and closing; don't treat that as a player
        conn = Conn(writer, "tcp", peer)
        await self.session(conn, tcp_messages(reader))

    async def handle_http(self, reader, writer):
        peer = writer.get_extra_info("peername")
        try:
            head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=10)
        except Exception:
            writer.close()
            return
        lines = head.decode("latin-1").split("\r\n")
        try:
            method, path, _ = lines[0].split(" ", 2)
        except ValueError:
            writer.close()
            return
        headers = {}
        for line in lines[1:]:
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()
        path = path.split("?", 1)[0]
        if headers.get("upgrade", "").lower() == "websocket" and path == "/ws":
            key = headers.get("sec-websocket-key", "")
            accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
            writer.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n"
                          "Connection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n" % accept).encode())
            await writer.drain()
            await self.session(Conn(writer, "ws", peer), ws_messages(reader, writer))
            return
        self.serve_static(writer, method, path)
        try:
            await writer.drain()
        except Exception:
            pass
        writer.close()

    def serve_static(self, writer, method, path):
        if path == "/":
            path = "/index.html"
        rel = os.path.normpath(path.lstrip("/"))
        full = os.path.join(WEB_DIR, rel)
        if rel.startswith("..") or not full.startswith(WEB_DIR) or not os.path.isfile(full):
            body = b"Not found"
            writer.write(b"HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: %d\r\nConnection: close\r\n\r\n" % len(body) + body)
            return
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            body = f.read()
        writer.write(("HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %d\r\n"
                      "Cache-Control: no-cache\r\nConnection: close\r\n\r\n" % (ctype, len(body))).encode())
        if method != "HEAD":
            writer.write(body)

    # -------------------------------------------------------------- loop
    async def fast_ticker(self):
        """Monsters, critters, villagers on the move and balloons get four updates a second."""
        while not self.stopping:
            await asyncio.sleep(0.25)
            try:
                out = self.world.fast(time.time())
                self.dispatch(out)
                if self.world.moved or out:
                    self.broadcast_state()
            except Exception:
                traceback.print_exc()

    async def ticker(self):
        while not self.stopping:
            await asyncio.sleep(1.0)
            now = time.time()
            try:
                out = self.world.tick(now)
                self.dispatch(out)
                self.broadcast_state()
            except Exception:
                traceback.print_exc()
            if self.world.dirty and now - self.last_save > SAVE_EVERY:
                self.save_now()

    def save_now(self):
        try:
            self.world.last_tick = time.time()
            self.world.save(self.save_path)
            self.last_save = time.time()
        except Exception:
            traceback.print_exc()


def lan_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def load_world(path):
    if os.path.exists(path):
        try:
            w = W.World.load(path)
            gap = time.time() - w.last_tick
            log("loaded world '%s' from %s (offline for %s)" % (w.name, path, W.fmt_duration(gap)))
            w.advance(w.last_tick, time.time())
            w.last_tick = time.time()
            return w
        except Exception:
            traceback.print_exc()
            backup = path + ".corrupt-%d" % int(time.time())
            os.replace(path, backup)
            log("could not read save; moved it to", backup)
    w = W.World()
    log("created a brand new farm")
    return w


async def amain(args):
    world = load_world(args.save)
    shown_host = "localhost" if args.host in ("127.0.0.1", "0.0.0.0", "::1") else args.host
    web_url = "http://%s:%d" % (shown_host, args.web_port)
    server = FarmServer(world, args.save, web_url)
    srv = await asyncio.start_server(server.handle_tcp, args.host, args.port)
    web = None
    try:
        web = await asyncio.start_server(server.handle_http, args.host, args.web_port)
        log("browser game at %s" % web_url)
    except OSError as e:
        log("could not open the web port %d: %s" % (args.web_port, e))
    pidfile = os.path.join(os.path.dirname(args.save), "server.pid")
    try:
        with open(pidfile, "w") as f:
            f.write(str(os.getpid()))
        with open(os.path.join(os.path.dirname(args.save), "server.json"), "w") as f:
            json.dump(dict(pid=os.getpid(), host=args.host, port=args.port, web_port=args.web_port,
                           started=time.time()), f)
    except OSError:
        pass
    log("listening on %s:%d" % (args.host, args.port))
    if args.host == "0.0.0.0":
        log("reachable from other computers on your network at http://%s:%d" % (lan_ip(), args.web_port))
    world.save(args.save)
    loop = asyncio.get_running_loop()
    stop = asyncio.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except (NotImplementedError, RuntimeError):
            pass
    ticker = asyncio.ensure_future(server.ticker())
    fast = asyncio.ensure_future(server.fast_ticker())
    await stop.wait()
    server.stopping = True
    ticker.cancel()
    fast.cancel()
    for c in list(server.clients.values()):
        c.send(dict(t="error", text="The farm server is shutting down."))
        c.close()
    srv.close()
    await srv.wait_closed()
    if web is not None:
        web.close()
        await web.wait_closed()
    server.save_now()
    try:
        os.remove(pidfile)
    except OSError:
        pass
    log("saved and stopped")


def main():
    ap = argparse.ArgumentParser(description="Cozy Hollow farm server")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--web-port", type=int, default=DEFAULT_WEB_PORT)
    ap.add_argument("--save", default=DEFAULT_SAVE)
    args = ap.parse_args()
    os.makedirs(os.path.dirname(os.path.abspath(args.save)), exist_ok=True)
    try:
        asyncio.run(amain(args))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
