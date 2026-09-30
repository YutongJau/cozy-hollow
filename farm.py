#!/usr/bin/env python3
"""Cozy Hollow - a shared farm you tend together, in the terminal.

    python3 farm.py                 play in the terminal (starts the farm server if needed)
    python3 farm.py web             open the browser version of the same farm
    python3 farm.py share           let people on your Wi-Fi join (prints the address)
    python3 farm.py share --public  ...and people anywhere, through a free tunnel link
    python3 farm.py --name Yutong   play as a given farmer
    python3 farm.py --pick          choose your farmer sprite and shirt again
    python3 farm.py ping [message]  say "hi" on every terminal of this account
    python3 farm.py status          is the farm running? who is online?
    python3 farm.py stop            stop the background server (the farm is saved)
    python3 farm.py reset           start a brand-new farm (asks for confirmation)
    python3 farm.py server          run the server in the foreground (for debugging)

Two people logged in to the same account on the same machine each run
`python3 farm.py` with different farmer names and share one farm.
"""
import argparse
import getpass
import json
import locale
import os
import random
import signal
import socket
import subprocess
import sys
import time
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.environ.setdefault("ESCDELAY", "25")
if not os.environ.get("TERM"):
    os.environ["TERM"] = "xterm-256color"

DEFAULT_DIR = os.path.join(os.path.expanduser("~"), ".cozyfarm")
DEFAULT_SAVE = os.path.join(DEFAULT_DIR, "world.json")
DEFAULT_PORT = 7734
DEFAULT_WEB_PORT = 7735
SHIRTS = ["red", "blue", "yellow", "pink", "green", "cyan", "orange", "white", "magenta"]
SHIRT_256 = {"red": 196, "blue": 33, "yellow": 220, "pink": 213, "green": 82, "cyan": 45,
             "orange": 208, "white": 255, "magenta": 201}
RESET = "\033[0m"


def ansi(fg=None, bg=None, bold=False):
    parts = ["1"] if bold else []
    if fg is not None:
        parts.append("38;5;%d" % fg)
    if bg is not None:
        parts.append("48;5;%d" % bg)
    return "\033[%sm" % ";".join(parts) if parts else ""


def sprite_preview(kind, shirt):
    """Two text rows showing a farmer facing you, right, left and away, on grass."""
    import client
    spr = client.SPRITES[kind]
    grass, hair, skin = 22, 236, 223
    rows = ["", ""]
    for facing in ("down", "right", "left", "up"):
        for r, cells in enumerate((spr["head"][facing], spr["body"][facing])):
            out = ""
            for cell in cells:
                if cell is None:
                    out += ansi(None, grass) + " " + RESET
                    continue
                glyph, fg_role, bg_role = cell
                glyph = client.EYES_OPEN if glyph == client.FACE else glyph
                fg = {"hair": hair, "skin": skin, "shirt": shirt}.get(fg_role, shirt)
                bg = {"hair": hair, "skin": skin, "shirt": shirt, "tile": grass}[bg_role]
                out += ansi(fg, bg, bold=(fg_role == "shirt")) + glyph + RESET
            rows[r] += out + ansi(None, grass) + "  " + RESET
    return rows[0], rows[1]


def choose_look(name, save_path, args):
    """Pick (or remember) this farmer's sprite and shirt colour."""
    prefs_path = os.path.join(os.path.dirname(save_path), "prefs.json")
    try:
        with open(prefs_path) as f:
            prefs = json.load(f)
    except (OSError, ValueError):
        prefs = {}
    mine = prefs.get(name, {})
    sprite = args.sprite or (None if args.pick else mine.get("sprite"))
    color = args.color or (None if args.pick else mine.get("color"))
    hat = None if args.pick else mine.get("hat")
    if (sprite not in ("boy", "girl") or color not in SHIRTS) and sys.stdin.isatty():
        print()
        print("Who's farming today, %s?" % name)
        bt, bb = sprite_preview("boy", SHIRT_256["cyan"])
        gt, gb = sprite_preview("girl", SHIRT_256["pink"])
        print()
        print("   1) Farm boy       %s      2) Farm girl     %s" % (bt, gt))
        print("      short hair     %s         long hair     %s" % (bb, gb))
        print("      and a t-shirt                            and a dress")
        print("                     (facing you, right, left, away)")
        print()
        while sprite not in ("boy", "girl"):
            raw = input("Pick 1 or 2 [1]: ").strip().lower()
            sprite = {"": "boy", "1": "boy", "boy": "boy", "b": "boy",
                      "2": "girl", "girl": "girl", "g": "girl"}.get(raw)
        print("Shirt colour:  " + "  ".join("%d %s%s%s" % (i + 1, ansi(SHIRT_256[c], bold=True), c, RESET)
                                              for i, c in enumerate(SHIRTS)))
        while color not in SHIRTS:
            raw = input("Pick 1-%d or a colour [surprise me]: " % len(SHIRTS)).strip().lower()
            if raw == "":
                color = random.choice(SHIRTS)
            elif raw.isdigit() and 1 <= int(raw) <= len(SHIRTS):
                color = SHIRTS[int(raw) - 1]
            elif raw in SHIRTS:
                color = raw
        raw = input("Cowboy hat? [Y/n]: ").strip().lower()
        hat = "none" if raw.startswith("n") else "cowboy"
    if sprite not in ("boy", "girl"):
        sprite = "boy"
    if color not in SHIRTS:
        color = None
    if hat not in ("cowboy", "none"):
        hat = "cowboy"
    prefs[name] = dict(sprite=sprite, color=color, hat=hat)
    try:
        os.makedirs(os.path.dirname(prefs_path), exist_ok=True)
        with open(prefs_path, "w") as f:
            json.dump(prefs, f)
    except OSError:
        pass
    return sprite, color, hat


def connect(host, port, timeout=1.0):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    s.connect((host, port))
    s.settimeout(None)
    s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    return s


def server_running(host, port):
    try:
        connect(host, port, 0.5).close()
        return True
    except OSError:
        return False


def start_server(host, port, save, web_port=DEFAULT_WEB_PORT):
    os.makedirs(os.path.dirname(save), exist_ok=True)
    logpath = os.path.join(os.path.dirname(save), "server.log")
    logf = open(logpath, "a")
    cmd = [sys.executable, os.path.join(HERE, "server.py"), "--host", host,
           "--port", str(port), "--web-port", str(web_port), "--save", save]
    subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=logf, stderr=logf,
                     start_new_session=True, close_fds=True, cwd=HERE)
    for _ in range(60):
        time.sleep(0.1)
        if server_running(host, port):
            return True
    return False


def read_pid(save):
    try:
        with open(os.path.join(os.path.dirname(save), "server.pid")) as f:
            return int(f.read().strip())
    except (OSError, ValueError):
        return None


def server_info(save):
    try:
        with open(os.path.join(os.path.dirname(save), "server.json")) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def config_path(save):
    return os.path.join(os.path.dirname(save), "config.json")


def load_config(save):
    try:
        with open(config_path(save)) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_config(save, cfg):
    try:
        os.makedirs(os.path.dirname(config_path(save)), exist_ok=True)
        with open(config_path(save), "w") as f:
            json.dump(cfg, f)
    except OSError:
        pass


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def cmd_stop(args):
    pid = read_pid(args.save)
    if pid is None:
        print("No farm server pid file found." + (" (but something answers on the port?)" if server_running(args.host, args.port) else ""))
        return 1
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        print("The server (pid %d) was not running." % pid)
        return 1
    for _ in range(50):
        time.sleep(0.1)
        if not server_running(args.host, args.port):
            break
    print("Farm server stopped. The farm is saved in %s" % args.save)
    return 0


def cmd_reset(args):
    if not os.path.exists(args.save):
        print("There is no farm to reset yet.")
        return 0
    print("This deletes the whole farm (%s): every crop, coin and farmer." % args.save)
    answer = input("Type RESET to confirm: ")
    if answer.strip() != "RESET":
        print("Nothing was changed.")
        return 1
    if server_running(args.host, args.port):
        cmd_stop(args)
    backup = args.save + ".bak-%s" % time.strftime("%Y%m%d-%H%M%S")
    os.replace(args.save, backup)
    print("Old farm moved to %s. A fresh farm starts next time you play." % backup)
    return 0


def web_url(args):
    return "http://localhost:%d" % args.web_port


def ensure_server(args):
    if server_running("127.0.0.1" if args.host in ("0.0.0.0", "localhost") else args.host, args.port):
        return True
    if args.host not in ("127.0.0.1", "localhost", "::1", "0.0.0.0"):
        print("No farm server at %s:%d. Start one there with: python3 farm.py server --host 0.0.0.0" % (args.host, args.port))
        return False
    print("Waking up the farm...")
    bind = load_config(args.save).get("host", "127.0.0.1")   # `farm.py share` switches this to 0.0.0.0
    if args.host == "0.0.0.0":
        bind = "0.0.0.0"
    if not start_server(bind, args.port, args.save, args.web_port):
        print("Could not start the farm server. See %s" % os.path.join(os.path.dirname(args.save), "server.log"))
        return False
    return True


def cmd_share(args):
    """Open the farm to other computers: LAN address, and optionally a public tunnel."""
    cfg = load_config(args.save)
    cfg["host"] = "0.0.0.0"
    save_config(args.save, cfg)
    info = server_info(args.save)
    running = server_running("127.0.0.1", args.port)
    if running and info.get("host") != "0.0.0.0":
        print("Restarting the farm server so other computers can reach it (players reconnect in a second)...")
        cmd_stop(args)
        running = False
    if not running:
        if not start_server("0.0.0.0", args.port, args.save, args.web_port):
            print("Could not start the farm server.")
            return 1
    ip = lan_ip()
    print()
    print("Your farm is open to your network:")
    if ip:
        print("   browser:   http://%s:%d" % (ip, args.web_port))
        print("   terminal:  python3 farm.py --host %s      (needs a copy of this folder)" % ip)
    else:
        print("   (could not work out this machine's network address; try `ifconfig`)")
    print("Friends on the same Wi-Fi can open that address now. To undo: python3 farm.py unshare")
    if not args.public:
        print()
        print("For a friend on the internet, run:  python3 farm.py share --public")
        return 0
    return open_tunnel(args)


def tunnel_files(save):
    d = os.path.dirname(save)
    return os.path.join(d, "tunnel.pid"), os.path.join(d, "tunnel.url"), os.path.join(d, "tunnel.log")


def running_tunnel(save):
    """The public link of a tunnel that is still up, else None."""
    pidf, urlf, _ = tunnel_files(save)
    try:
        with open(pidf) as f:
            os.kill(int(f.read().strip()), 0)
        with open(urlf) as f:
            return f.read().strip() or None
    except (OSError, ValueError):
        return None


def tunnel_alive(save):
    try:
        with open(tunnel_files(save)[0]) as f:
            os.kill(int(f.read().strip()), 0)
        return True
    except (OSError, ValueError):
        return False


def stop_tunnel(save):
    pidf, urlf, _ = tunnel_files(save)
    stopped = False
    try:
        with open(pidf) as f:
            os.killpg(int(f.read().strip()), signal.SIGTERM)
        stopped = True
    except (OSError, ValueError):
        pass
    for path in (pidf, urlf):
        try:
            os.remove(path)
        except OSError:
            pass
    return stopped


def print_public(url):
    print()
    print("   ===>  %s  <===" % url)
    print()
    print("Send that link to your friend. It works in any browser, from anywhere, and keeps")
    print("working across server restarts. Anyone with the link can join, so share it privately.")
    print("While it's open your Mac won't idle-sleep. If the Mac sleeps or goes offline for a")
    print("while the relay forgets the link; a new one is made automatically and shown in a")
    print("notification and in `python3 farm.py status`. To close it: python3 farm.py unshare")


def tunnel_command(save, port):
    import shutil
    import re
    local_cf = os.path.join(os.path.dirname(save), "bin", "cloudflared")
    cf = shutil.which("cloudflared") or (local_cf if os.access(local_cf, os.X_OK) else None)
    if cf:
        return ([cf, "tunnel", "--no-autoupdate", "--url", "http://localhost:%d" % port],
                re.compile(r"https://(?!api\.)[a-z0-9-]+\.trycloudflare\.com"), "Cloudflare")
    if shutil.which("ssh"):
        return (["ssh", "-T", "-o", "StrictHostKeyChecking=no", "-o", "ServerAliveInterval=30", "-o", "ExitOnForwardFailure=yes",
                 "-R", "80:localhost:%d" % port, "nokey@localhost.run"],
                re.compile(r"https://(?!admin\.)[a-z0-9-]+\.(?:lhr\.life|localhost\.run)\b"), "localhost.run")
    return None, None, None


def link_works(url):
    """False when the relay no longer knows the link (it stops resolving, or Cloudflare answers 530)."""
    import urllib.request
    import urllib.error
    try:
        urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=15).close()
        return True
    except urllib.error.HTTPError as e:
        return e.code != 530
    except (urllib.error.URLError, OSError):
        return False


def notify(text):
    try:
        subprocess.run(["osascript", "-e", 'display notification "%s" with title "Cozy Hollow"' % text],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
    except (OSError, subprocess.SubprocessError):
        pass


def cmd_tunnel(args):
    """Keep a public link open (run in the background by `share --public`). Free quick links die when the
    Mac is offline for a while, so when the relay forgets ours, make a new one and say so."""
    cmd, pattern, _ = tunnel_command(args.save, args.web_port)
    if not cmd:
        return 1
    _, urlf, logf = tunnel_files(args.save)
    last, wait = None, 5
    while True:
        with open(logf, "w") as log:
            proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            lost = 0
            try:
                for line in proc.stdout:
                    log.write(line)
                    log.flush()
                    m = pattern.search(line)
                    if m:
                        with open(urlf + ".tmp", "w") as f:
                            f.write(m.group(0))
                        os.replace(urlf + ".tmp", urlf)
                        if last and m.group(0) != last:
                            notify("The old link expired. New link for friends: %s" % m.group(0))
                        last, wait = m.group(0), 5
                    elif "Tunnel not found" in line:
                        lost += 1
                        if lost >= 3:           # the relay has dropped this link for good
                            break
            finally:
                proc.terminate()
                try:
                    proc.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    proc.kill()
        try:
            os.remove(urlf)
        except OSError:
            pass
        time.sleep(wait)
        wait = min(wait * 2, 120)


def open_tunnel(args):
    """Expose the browser game on the internet through a free tunnel service, in the background."""
    url = running_tunnel(args.save)
    if url and link_works(url):
        print()
        print("The public tunnel is already open:")
        print_public(url)
        return 0
    stop_tunnel(args.save)
    cmd, _, label = tunnel_command(args.save, args.web_port)
    if not cmd:
        print("Need `ssh` or `cloudflared` on this machine to open a public tunnel.")
        return 1
    keeper = [sys.executable, os.path.abspath(__file__), "tunnel", "--save", args.save, "--web-port", str(args.web_port)]
    if os.path.exists("/usr/bin/caffeinate"):
        keeper = ["/usr/bin/caffeinate", "-i"] + keeper     # a sleeping Mac would drop everyone
    pidf, urlf, logf = tunnel_files(args.save)
    print()
    print("Opening a public tunnel via %s (a free third-party relay)..." % label)
    with open(os.path.join(os.path.dirname(args.save), "tunnel-keeper.log"), "w") as out:
        proc = subprocess.Popen(keeper, stdin=subprocess.DEVNULL, stdout=out, stderr=subprocess.STDOUT, start_new_session=True)
    with open(pidf, "w") as f:
        f.write(str(proc.pid))
    deadline = time.time() + 60
    while time.time() < deadline and proc.poll() is None:
        time.sleep(0.5)
        url = running_tunnel(args.save)
        if url:
            print_public(url)
            return 0
    stop_tunnel(args.save)
    print("The tunnel didn't give a link. Its output is in %s" % logf)
    return 1


def cmd_unshare(args):
    cfg = load_config(args.save)
    cfg["host"] = "127.0.0.1"
    save_config(args.save, cfg)
    if stop_tunnel(args.save):
        print("Closed the public tunnel link.")
    if server_running("127.0.0.1", args.port):
        cmd_stop(args)
        start_server("127.0.0.1", args.port, args.save, args.web_port)
    print("The farm is now only reachable from this machine.")
    return 0


def cmd_web(args):
    if not ensure_server(args):
        return 1
    url = web_url(args)
    print("Cozy Hollow is open in your browser at %s" % url)
    print("Anyone on this machine can join at that address; over SSH, forward the port with:")
    print("    ssh -L %d:localhost:%d <user>@<this machine>" % (args.web_port, args.web_port))
    try:
        webbrowser.open(url)
    except Exception:
        pass
    return 0


def cmd_status(args):
    running = server_running("127.0.0.1", args.port)
    info = server_info(args.save)
    print("Farm server: %s (%s:%d)" % ("running" if running else "not running", info.get("host", args.host) if running else args.host, args.port))
    if running:
        print("Browser game: %s" % web_url(args))
        if info.get("host") == "0.0.0.0" and lan_ip():
            print("Shared on your network at: http://%s:%d   (python3 farm.py unshare to close)" % (lan_ip(), args.web_port))
        else:
            print("Only reachable from this machine. `python3 farm.py share` opens it to your network.")
        public = running_tunnel(args.save)
        if public:
            print("Public link for friends anywhere: %s" % public)
        elif tunnel_alive(args.save):
            print("The public link expired and a new one is being made; check again in a minute.")
    if os.path.exists(args.save):
        try:
            with open(args.save) as f:
                d = json.load(f)
            players = d.get("players", {})
            print("Farm '%s', founded %s, %d coins, %d farmers: %s" % (
                d.get("name"), time.strftime("%Y-%m-%d", time.localtime(d.get("created", 0))),
                d.get("coins", 0), len(players), ", ".join(sorted(players)) or "-"))
            crops = sum(1 for t in d.get("tiles", {}).values() if t.get("crop"))
            trees = sum(1 for t in d.get("tiles", {}).values() if t.get("tree"))
            print("%d crops and %d trees in the ground." % (crops, trees))
        except (OSError, ValueError) as e:
            print("Could not read the save file:", e)
    else:
        print("No farm has been created yet.")
    return 0


def cmd_ping(args):
    import pingall
    sender = args.name or getpass.getuser()
    argv = ["--from", sender] + list(args.rest)
    return pingall.main(argv)


def cmd_server(args):
    import server
    sys.argv = ["server.py", "--host", args.host, "--port", str(args.port),
                "--web-port", str(args.web_port), "--save", args.save]
    server.main()
    return 0


def pick_name(args):
    if args.name:
        return args.name
    if not sys.stdin.isatty():
        print("Please pass --name <farmer name>.")
        sys.exit(2)
    default = getpass.getuser()
    print("Welcome to Cozy Hollow!")
    try:
        raw = input("What's your farmer name? [%s] " % default).strip()
    except EOFError:
        raw = ""
    return raw or default


def clean_name(raw):
    return "".join(ch for ch in raw if ch.isalnum() or ch in "_-")[:12]


def cmd_play(args):
    name = clean_name(pick_name(args))
    if not name:
        print("That name has no usable letters. Try something like --name Sam")
        return 2
    sprite, color, hat = choose_look(name, args.save, args)
    if not ensure_server(args):
        return 1
    try:
        sock = connect(args.host if args.host != "0.0.0.0" else "127.0.0.1", args.port, 3.0)
    except OSError as e:
        print("Could not connect to the farm server:", e)
        return 1

    lang = (os.environ.get("LC_ALL") or os.environ.get("LC_CTYPE") or os.environ.get("LANG") or "").lower()
    ascii_mode = args.ascii or (not args.unicode and any(k in lang for k in ("zh", "ja", "ko")))
    launch_hint = "join the farm:  cd %s && python3 farm.py   or open %s" % (
        HERE.replace(os.path.expanduser("~"), "~", 1), web_url(args))

    locale.setlocale(locale.LC_ALL, "")
    import curses
    import client

    result = {}

    def run(scr):
        c = client.Client(scr, sock, name, ascii_mode, launch_hint, sprite, color, hat)
        result["exit"] = c.run()

    try:
        curses.wrapper(run)
    except KeyboardInterrupt:
        pass
    finally:
        try:
            sock.close()
        except OSError:
            pass
    if result.get("exit"):
        print(result["exit"])
    print("See you soon, %s. The farm keeps growing while you're away." % name)
    return 0


def main():
    ap = argparse.ArgumentParser(description="Cozy Hollow - a shared terminal farm",
                                 formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument("command", nargs="?", default="play",
                    choices=["play", "web", "share", "unshare", "ping", "status", "stop", "reset", "server", "tunnel"])
    ap.add_argument("rest", nargs=argparse.REMAINDER, help="message for ping")
    ap.add_argument("--name", help="your farmer name")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--web-port", type=int, default=DEFAULT_WEB_PORT, help="port for the browser game")
    ap.add_argument("--save", default=DEFAULT_SAVE, help="where the farm is stored")
    ap.add_argument("--sprite", choices=["boy", "girl"], help="your farmer (asked on first play)")
    ap.add_argument("--color", choices=SHIRTS, help="your shirt colour")
    ap.add_argument("--pick", action="store_true", help="choose your farmer and shirt again")
    ap.add_argument("--public", action="store_true", help="with share: also open an internet tunnel")
    ap.add_argument("--ascii", action="store_true", help="plain ASCII graphics")
    ap.add_argument("--unicode", action="store_true", help="force unicode graphics")
    args = ap.parse_args()
    argv = sys.argv[1:]
    if args.command != "ping" and args.rest and args.command in argv:
        # the ping-message catch-all swallows flags written after the command; parse them as flags
        i = argv.index(args.command)
        args = ap.parse_args(argv[:i] + argv[i + 1:] + [args.command])
    fn = {"play": cmd_play, "web": cmd_web, "share": cmd_share, "unshare": cmd_unshare, "ping": cmd_ping,
          "status": cmd_status, "stop": cmd_stop, "reset": cmd_reset, "server": cmd_server,
          "tunnel": cmd_tunnel}[args.command]
    sys.exit(fn(args) or 0)


if __name__ == "__main__":
    main()
