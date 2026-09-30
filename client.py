#!/usr/bin/env python3
"""Cozy Hollow - the terminal client (curses)."""
import curses
import json
import math
import os
import queue
import random
import socket
import threading
import time

import world as W
import pingall

STAGE_GLYPHS = [(".", "."), (",", ","), ("v", "v"), ("Y", "Y")]
TREE_GLYPH = ("♣", "T")
TERRAIN_GLYPHS = {
    ".": (".", "."), "#": ("#", "#"), "T": TREE_GLYPH, "~": ("≈", "~"),
    ":": ("░", ":"), ",": ("·", "."), "W": ("▒", "#"), "+": ("+", "+"),
    "S": ("▓", "S"), "$": ("$", "$"), "!": ("!", "!"), "o": ("o", "o"), "f": ("*", "*"),
    "B": ("§", "B"), "c": ("■", "x"), "h": ("≡", "h"), "m": ("¶", "m"),
    "l": ("¡", "i"), "b": ("═", "b"), "w": ("◎", "O"),
    "N": ("▓", "N"), "s": ("●", "s"), "p": ("≡", "p"), "g": ("†", "g"),
    "d": ("·", "."), "u": ("♣", "u"), "G": ("╫", "="), "Y": ("Y", "Y"),
}
PROP_STYLE = {  # (256-colour fg, 8-colour fg, bold)
    "B": (137, "yellow", False), "c": (180, "yellow", False), "h": (220, "yellow", True),
    "m": (255, "white", True), "l": (226, "yellow", True), "b": (137, "yellow", False), "w": (250, "white", True),
    "s": (137, "yellow", False), "p": (173, "yellow", False), "g": (223, "white", True),
}
SOIL_GLYPH = ("▒", "=")
LABELS = [(4, 4, "FARMHOUSE", "white"), (49, 3, "SEED SHOP", "magenta"), (76, 6, " BARN ", "white")]
FG = {
    "green": curses.COLOR_GREEN, "yellow": curses.COLOR_YELLOW, "blue": curses.COLOR_BLUE,
    "cyan": curses.COLOR_CYAN, "magenta": curses.COLOR_MAGENTA, "red": curses.COLOR_RED,
    "white": curses.COLOR_WHITE, "black": curses.COLOR_BLACK,
    "orange": curses.COLOR_YELLOW, "pink": curses.COLOR_MAGENTA,
}
# 256-colour palette (used whenever the terminal supports it)
C256 = {"green": 40, "yellow": 220, "blue": 33, "cyan": 45, "magenta": 201, "red": 196,
        "white": 255, "black": 236, "orange": 208, "pink": 213}
ITEM_C256 = {  # nicer ripe / fruit / forage colours
    "turnip": 189, "potato": 180, "radish": 199, "strawberry": 197, "cauliflower": 255,
    "sunflower": 226, "tomato": 196, "corn": 220, "blueberry": 63, "melon": 118,
    "starfruit": 213, "pumpkin": 208, "cranberry": 160, "snowdrop": 255, "winter_root": 116,
    "cherry": 197, "apple": 118, "peach": 215, "plum": 135,
    "wild_berry": 197, "mushroom": 180, "daffodil": 226, "dandelion": 255, "leek": 120,
    "hazelnut": 137, "snow_yam": 255, "holly": 34, "sprinkler": 51,
}
THEME = {  # per-season grass background, grass texture, tree and flower colours, fence
    "spring": dict(grass=22, grass_fg=(34, 40, 28), tree=(40, 46), flower=(213, 226, 211), fence=137),
    "summer": dict(grass=28, grass_fg=(40, 82, 34), tree=(22, 28), flower=(226, 213, 208), fence=137),
    "fall": dict(grass=58, grass_fg=(136, 178, 100), tree=(166, 202, 214), flower=(178, 208, 203), fence=137),
    "winter": dict(grass=253, grass_fg=(255, 250, 231), tree=(22, 28), flower=(203, 197, 253), fence=94),
}
T256 = dict(water=25, water_fg=(45, 39, 51), sand=180, sand_fg=229, path=137, path_fg=180,
            house=130, house_fg=179, door_fg=220, shop=97, shop_fg=183, bin_fg=226, board_fg=229,
            rock_fg=250, label_fg=229, soil=94, soil_fg=137, wet=58, wet_fg=66, fert_fg=70,
            skin=223, hair=236, sprout=(40, 46, 82, 118))
TERRAIN_BG = {"~": T256["water"], ",": T256["sand"], ":": T256["path"], "W": T256["house"],
              "+": T256["house"], "S": T256["shop"], "N": 124, "d": 136}
NIGHT_BG = {22: 233, 28: 22, 58: 234, 253: 240, 25: 17, 180: 101, 137: 95, 130: 94, 94: 58, 97: 54}

# Farmer sprites: 3 cells wide, 2 rows tall, anchored on the farmer's tile
# (middle column, bottom row). Each cell is (glyph, fg role, bg role) or None
# for a see-through cell. Roles: hair, skin, shirt, tile (= the ground below).
#
#   girl facing you    girl facing away    boy facing you     boy from the side
#      |o|                 |#|                 'o'                 '#
#      /A\                 /A\                 -H-                 -H-
H, S, K, T = "hair", "skin", "shirt", "tile"
FACE = "FACE"   # replaced by the eyes glyph (blinks now and then)
_GIRL_DRESS = [("\u259f", K, T), ("\u2588", K, T), ("\u2599", K, T)]
_BOY_SHIRT = [("\u259c", K, T), ("\u2588", K, T), ("\u259b", K, T)]
SPRITES = {
    "girl": dict(
        label="Farm girl", desc="long black hair and a dress", long_hair=True,
        head={
            "down": [("\u2590", H, T), (FACE, H, S), ("\u258c", H, T)],
            "up": [("\u2590", H, T), ("\u2588", H, T), ("\u258c", H, T)],
            "right": [("\u2590", H, T), ("\u258c", H, S), None],
            "left": [None, ("\u2590", H, S), ("\u258c", H, T)],
        },
        body={
            "down": _GIRL_DRESS, "left": _GIRL_DRESS, "right": _GIRL_DRESS,
            "up": [("\u259f", K, T), ("\u2580", H, K), ("\u2599", K, T)],
        },
        ascii=dict(head={"down": "|o|", "up": "|#|", "right": "|o ", "left": " o|"}, body="/A\\"),
    ),
    "boy": dict(
        label="Farm boy", desc="short black hair and a t-shirt", long_hair=False,
        head={
            "down": [("\u259d", H, T), (FACE, H, S), ("\u2598", H, T)],
            "up": [("\u259d", H, T), ("\u2588", H, T), ("\u2598", H, T)],
            "right": [("\u259d", H, T), ("\u258c", H, S), None],
            "left": [None, ("\u2590", H, S), ("\u2598", H, T)],
        },
        body={"down": _BOY_SHIRT, "up": _BOY_SHIRT, "left": _BOY_SHIRT, "right": _BOY_SHIRT},
        ascii=dict(head={"down": "'o'", "up": "'#'", "right": "'o ", "left": " o'"}, body="-H-"),
    ),
}
EYES_OPEN, EYES_CLOSED = "\u00f6", "\u014d"


def blinking(name, now):
    """True for a short moment every few seconds, different per farmer."""
    phase = (now + (hash(name) % 100) / 10.0) % 3.7
    return phase < 0.18


def facing_name(f):
    dx, dy = f[0], f[1]
    if dy > 0:
        return "down"
    if dy < 0:
        return "up"
    return "left" if dx < 0 else "right"


SEASON_ICON = {"spring": "✿", "summer": "☀", "fall": "☘", "winter": "❄"}
WEATHER_TEXT = {"sun": "Sunny", "rain": "Raining", "snow": "Snowing"}
HINT = "arrows/WASD move  E act  F fish  X clear  1-9 hand  Tab next  T chat  I bag  J journal  ? help  Q quit"


def wrap(text, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > width:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w) if cur else w
    if cur:
        lines.append(cur)
    return lines or [""]


class Palette:
    def __init__(self):
        self.pairs = {}
        self.next_id = 1
        self.ok = curses.has_colors()
        if self.ok:
            curses.start_color()
            try:
                curses.use_default_colors()
            except curses.error:
                pass
        self.c256 = self.ok and curses.COLORS >= 256
        self.dry_bg = 94 if self.c256 else -1
        self.wet_bg = 24 if self.c256 else curses.COLOR_BLUE
        self.water_bg = 17 if self.c256 else -1

    def fg(self, name):
        if isinstance(name, int):
            return name
        if self.c256:
            return C256.get(name, 255)
        return FG.get(name, curses.COLOR_WHITE)

    def pair(self, fg, bg=-1):
        if not self.ok:
            return 0
        fg = self.fg(fg)
        if isinstance(bg, str):
            bg = self.fg(bg)
        key = (fg, bg)
        if key not in self.pairs:
            if self.next_id >= min(256, curses.COLOR_PAIRS):
                return 0
            try:
                curses.init_pair(self.next_id, fg, bg)
            except curses.error:
                return 0
            self.pairs[key] = self.next_id
            self.next_id += 1
        return curses.color_pair(self.pairs[key])


class Client:
    def __init__(self, scr, sock, name, ascii_mode, launch_hint, sprite="boy", color=None, hat="cowboy"):
        self.scr = scr
        self.sock = sock
        self.name = name
        self.sprite = sprite
        self.color = color
        self.hat = hat
        self.ascii = ascii_mode
        self.launch_hint = launch_hint
        self.q = queue.Queue()
        self.running = True
        self.exit_message = None
        self.state = None
        self.me = None
        self.tiles = {}
        self.map = W.build_map()
        self.farm = "Cozy Hollow"
        self.log = []                 # (text, style)
        self.toast = None             # (text, until, style)
        self.mode = "play"
        self.menu = {}
        self.chat_buf = ""
        self.fish = None
        self.drops = []
        self.fireflies = []
        self.frame = 0
        self.anim_acc = 0.0
        self.dirty = True
        self.redraw_times = []
        self.static_cache = {}
        self.send_lock = threading.Lock()
        self.pal = Palette()
        threading.Thread(target=self.reader, daemon=True).start()

    # ------------------------------------------------------------------ network
    def send(self, msg):
        data = (json.dumps(msg) + "\n").encode("utf-8")
        with self.send_lock:
            try:
                self.sock.sendall(data)
            except OSError:
                self.q.put(dict(t="error", text="Lost the connection to the farm server."))

    def reader(self):
        try:
            f = self.sock.makefile("r", encoding="utf-8")
            for line in f:
                try:
                    self.q.put(json.loads(line))
                except ValueError:
                    continue
        except OSError:
            pass
        self.q.put(dict(t="error", text="The farm server went away."))

    def pump(self):
        while True:
            try:
                msg = self.q.get_nowait()
            except queue.Empty:
                return
            self.dirty = True
            t = msg.get("t")
            if t == "state":
                self.state = msg
                self.me = msg.get("me")
                self.farm = msg.get("farm", self.farm)
                tiles = {}
                for k, d in msg.get("tiles", {}).items():
                    x, y = k.split(",")
                    tiles[(int(x), int(y))] = d
                self.tiles = tiles
                if self.mode == "barn" and "storage" in msg:   # live: other farmers' changes show up too
                    self.menu["storage"] = sorted(msg["storage"].items())
            elif t == "welcome":
                self.farm = msg.get("farm", self.farm)
                for e in msg.get("log", []):
                    self.log.append((time.strftime("%H:%M", time.localtime(e["ts"])) + " " + e["text"], "log"))
                self.add_log("Welcome to %s, %s! Press ? for help." % (self.farm, self.name), "good", toast=True)
            elif t == "msg":
                style = msg.get("style", "info")
                self.add_log(msg.get("text", ""), style, toast=True)
                if style == "ping":
                    try:
                        curses.beep()
                        curses.flash()
                    except curses.error:
                        pass
                    now = time.time()
                    self.redraw_times += [now + 0.3, now + 1.2, now + 3.0]
            elif t == "chat":
                self.add_log("%s: %s" % (msg.get("sender"), msg.get("text")), "chat",
                             toast=(msg.get("sender") != self.name))
            elif t == "open":
                self.open_menu(msg)
            elif t == "fish_bite":
                self.start_fishing(msg)
            elif t == "error":
                self.exit_message = msg.get("text")
                self.running = False

    def add_log(self, text, style="info", toast=False):
        stamp = time.strftime("%H:%M")
        self.log.append((stamp + " " + text, style))
        del self.log[:-200]
        if toast:
            self.toast = (text, time.time() + (6 if style in ("good", "ping", "warn") else 4), style)
        self.dirty = True

    # ------------------------------------------------------------------ main loop
    def run(self):
        curses.curs_set(0)
        self.scr.keypad(True)
        self.scr.timeout(33)
        self.send(dict(t="hello", name=self.name, sprite=self.sprite, color=self.color, hat=self.hat))
        last = time.time()
        while self.running:
            now = time.time()
            dt, last = now - last, now
            self.pump()
            for _ in range(24):
                key = self.read_key()
                if key is None:
                    break
                self.handle_key(key)
            self.animate(dt)
            if self.toast and self.toast[1] < now:
                self.toast = None
                self.dirty = True
            if self.redraw_times and self.redraw_times[0] <= now:
                self.redraw_times.pop(0)
                self.scr.clearok(True)
                self.dirty = True
            if self.dirty:
                self.draw()
                self.dirty = False
        return self.exit_message

    def read_key(self):
        try:
            k = self.scr.get_wch()
        except curses.error:
            return None
        if isinstance(k, str):
            if k in ("\n", "\r"):
                return "ENTER"
            if k == "\t":
                return "TAB"
            if k == "\x1b":
                return self.read_escape()
            if k in ("\x7f", "\b"):
                return "BACKSPACE"
            return k
        return {curses.KEY_ENTER: "ENTER", curses.KEY_BACKSPACE: "BACKSPACE",
                curses.KEY_UP: "UP", curses.KEY_DOWN: "DOWN", curses.KEY_LEFT: "LEFT",
                curses.KEY_RIGHT: "RIGHT", curses.KEY_BTAB: "BTAB",
                curses.KEY_RESIZE: "RESIZE", curses.KEY_DC: "BACKSPACE"}.get(k)

    def read_escape(self):
        """ESC was read. If an arrow-key sequence follows that terminfo did not
        recognise (ESC [ A or ESC O A), decode it ourselves; else plain ESC."""
        self.scr.nodelay(True)
        try:
            seq = ""
            for _ in range(3):
                try:
                    k = self.scr.get_wch()
                except curses.error:
                    break
                if not isinstance(k, str):
                    break
                seq += k
                if len(seq) >= 2 and seq[0] in "[O" and seq[-1].isalpha():
                    break
        finally:
            self.scr.nodelay(False)
            self.scr.timeout(33)
        if len(seq) >= 2 and seq[0] in "[O":
            arrow = {"A": "UP", "B": "DOWN", "C": "RIGHT", "D": "LEFT", "Z": "BTAB"}.get(seq[-1])
            if arrow:
                return arrow
            return None
        for ch in seq:          # not a sequence: give the keys back
            try:
                curses.unget_wch(ch)
            except curses.error:
                pass
        return "ESC"

    # ------------------------------------------------------------------ input
    def handle_key(self, key):
        self.dirty = True
        if key == "RESIZE":
            self.static_cache.clear()
            self.scr.clearok(True)
            return
        handler = getattr(self, "keys_" + self.mode, self.keys_play)
        handler(key)

    MOVES = {"UP": (0, -1), "DOWN": (0, 1), "LEFT": (-1, 0), "RIGHT": (1, 0),
             "w": (0, -1), "s": (0, 1), "a": (-1, 0), "d": (1, 0),
             "W": (0, -1), "S": (0, 1), "A": (-1, 0), "D": (1, 0)}

    def keys_play(self, key):
        if key in self.MOVES:
            dx, dy = self.MOVES[key]
            self.send(dict(t="move", dx=dx, dy=dy))
        elif key in ("e", "E", " ", "ENTER"):
            self.send(dict(t="interact"))
        elif key in ("f", "F"):
            self.send(dict(t="fish_start"))
        elif key in ("x", "X"):
            self.send(dict(t="clear"))
        elif key and len(key) == 1 and key in "123456789":
            self.send(dict(t="select", i=int(key) - 1))
        elif key == "TAB":
            if self.me and self.me["inventory"]:
                self.send(dict(t="select", i=(self.me["selected"] + 1) % len(self.me["inventory"])))
        elif key == "BTAB":
            if self.me and self.me["inventory"]:
                self.send(dict(t="select", i=(self.me["selected"] - 1) % len(self.me["inventory"])))
        elif key in ("t", "T"):
            self.mode, self.chat_buf = "chat", ""
        elif key == "/":
            self.mode, self.chat_buf = "chat", "/"
        elif key in ("i", "I"):
            self.mode, self.menu = "inventory", dict(cursor=self.me["selected"] if self.me else 0)
        elif key in ("j", "J"):
            self.send(dict(t="journal"))
        elif key == "?":
            self.mode = "help"
        elif key in ("Q",):
            self.running = False
        elif key in ("q",):
            self.add_log("Press shift-Q to leave the farm (your progress is saved).", "info", toast=True)

    def keys_chat(self, key):
        if key == "ESC":
            self.mode = "play"
        elif key == "ENTER":
            text = self.chat_buf.strip()
            self.mode = "play"
            if text:
                self.submit_chat(text)
        elif key == "BACKSPACE":
            self.chat_buf = self.chat_buf[:-1]
        elif key and len(key) == 1 and key.isprintable():
            if len(self.chat_buf) < 160:
                self.chat_buf += key

    def submit_chat(self, text):
        low = text.lower()
        if low.startswith("/ping"):
            parts = text.split(None, 1)
            msg = parts[1].strip() if len(parts) > 1 else "hi"
            self.send(dict(t="ping", text=msg))
            threading.Thread(target=self.ping_terminals, args=(msg,), daemon=True).start()
            return
        if low in ("/quit", "/exit"):
            self.running = False
            return
        self.send(dict(t="chat", text=text))

    def ping_terminals(self, msg):
        try:
            ttys = pingall.ping_all(self.name, msg, include_self=False, launch_hint=self.launch_hint)
            names = ", ".join(os.path.basename(t) for t in ttys)
            self.q.put(dict(t="msg", style="good", text=(
                "ping@all: said '%s' on %d other terminal%s (%s)." % (msg, len(ttys), "" if len(ttys) == 1 else "s", names)
                if ttys else "ping@all: no other terminals are logged in as this account right now.")))
        except Exception as e:
            self.q.put(dict(t="msg", style="warn", text="ping@all failed: %r" % (e,)))

    def keys_shop(self, key):
        m = self.menu
        stock = m["stock"]
        if key in ("ESC", "q", "b", "B"):
            self.mode = "play"
        elif key == "UP":
            m["cursor"] = (m["cursor"] - 1) % len(stock)
        elif key == "DOWN":
            m["cursor"] = (m["cursor"] + 1) % len(stock)
        elif key in ("LEFT", "-"):
            m["qty"] = max(1, m["qty"] - 1)
        elif key in ("RIGHT", "+", "="):
            m["qty"] = min(99, m["qty"] + 1)
        elif key == "ENTER":
            item, price = stock[m["cursor"]]
            self.send(dict(t="buy", item=item, n=m["qty"]))

    def sellables(self):
        if not self.me:
            return []
        return [(k, n) for k, n in self.me["inventory"] if W.ITEMS[k]["sell"] > 0]

    def keys_sell(self, key):
        m = self.menu
        items = self.sellables()
        if key in ("ESC", "q"):
            self.mode = "play"
        elif not items:
            if key == "ENTER":
                self.mode = "play"
        elif key == "UP":
            m["cursor"] = (m["cursor"] - 1) % len(items)
        elif key == "DOWN":
            m["cursor"] = (m["cursor"] + 1) % len(items)
        elif key in ("LEFT", "-"):
            m["qty"] = max(1, m["qty"] - 1)
        elif key in ("RIGHT", "+", "="):
            m["qty"] = min(99, m["qty"] + 1)
        elif key == "ENTER":
            k, n = items[min(m["cursor"], len(items) - 1)]
            self.send(dict(t="sell", item=k, n=m["qty"]))
        elif key == "a":
            k, n = items[min(m["cursor"], len(items) - 1)]
            self.send(dict(t="sell", item=k, n=n))
        elif key == "A":
            self.send(dict(t="sell_all"))

    def keys_board(self, key):
        if key in ("ESC", "q"):
            self.mode = "play"
        elif key == "ENTER":
            self.send(dict(t="deliver"))

    def keys_proposal(self, key):
        if key in ("y", "Y", "ENTER"):
            self.send(dict(t="propose_answer", yes=True))
            self.menu["answered"] = True
        elif key in ("n", "N", "ESC"):
            self.send(dict(t="propose_answer", yes=False))
            self.mode = "play"

    def draw_proposal(self, h, w):
        y, x, bh, bw = self.center_box(h, w, 8, 58, "Father TongTong")
        self.put(y + 2, x + 2, '"Well now. Shall I marry you and %s?"' % self.menu["partner"])
        if self.menu.get("answered"):
            self.put(y + 4, x + 2, "You said yes. Waiting for %s..." % self.menu["partner"], self.pal.pair("green") | curses.A_BOLD)
        else:
            self.put(y + 4, x + 2, "Y / Enter: yes!     N / Esc: not today", curses.A_BOLD)

    def keys_barn(self, key):
        m = self.menu
        items = m["storage"]
        if key in ("ESC", "q"):
            self.mode = "play"
        elif items and key == "UP":
            m["cursor"] = (m["cursor"] - 1) % len(items)
        elif items and key == "DOWN":
            m["cursor"] = (m["cursor"] + 1) % len(items)
        elif items and key == "ENTER":
            k, n = items[min(m["cursor"], len(items) - 1)]
            self.send(dict(t="withdraw", item=k, n=1))
        elif items and key == "a":
            k, n = items[min(m["cursor"], len(items) - 1)]
            self.send(dict(t="withdraw", item=k, n=n))
        elif key in ("p", "P"):
            held = self.me["inventory"][self.me["selected"]] if self.me and self.me["inventory"] else None
            if held:
                self.send(dict(t="store", item=held[0], n=held[1] if key == "P" else 1))

    def keys_journal(self, key):
        if key in ("ESC", "q", "ENTER", "j", "J", " "):
            self.mode = "play"

    def keys_help(self, key):
        if key in ("ESC", "q", "ENTER", "?", " "):
            self.mode = "play"

    def keys_inventory(self, key):
        m = self.menu
        inv = self.me["inventory"] if self.me else []
        if key in ("ESC", "q", "i", "I"):
            self.mode = "play"
        elif inv and key == "UP":
            m["cursor"] = (m["cursor"] - 1) % len(inv)
        elif inv and key == "DOWN":
            m["cursor"] = (m["cursor"] + 1) % len(inv)
        elif inv and key == "ENTER":
            self.send(dict(t="select", i=m["cursor"]))
            self.mode = "play"

    def keys_fishing(self, key):
        f = self.fish
        if key == "ESC":
            self.send(dict(t="fish_result", ok=False))
            self.mode, self.fish = "play", None
            return
        if f["phase"] == "play" and key in ("LEFT", "a", "A", "h"):
            f["zone"] = max(0, f["zone"] - 1)
        elif f["phase"] == "play" and key in ("RIGHT", "d", "D", "l"):
            f["zone"] = min(f["width"] - f["zone_w"], f["zone"] + 1)

    # ------------------------------------------------------------------ menus / fishing
    def open_menu(self, msg):
        menu = msg.get("menu")
        if menu == "shop":
            self.mode = "shop"
            self.menu = dict(stock=msg["stock"], season=msg.get("season", ""), cursor=0, qty=1)
        elif menu == "sell":
            self.mode = "sell"
            self.menu = dict(cursor=0, qty=1)
        elif menu == "board":
            self.mode = "board"
            self.menu = dict(quest=msg.get("quest"))
        elif menu == "journal":
            self.mode = "journal"
            self.menu = dict(data=msg)
        elif menu == "proposal":
            self.mode = "proposal"
            self.menu = dict(partner=msg.get("partner"), answered=False)
        elif menu == "close":
            if self.mode == "proposal":
                self.mode = "play"
        elif menu == "barn":
            cur = self.menu.get("cursor", 0) if self.mode == "barn" else 0
            self.mode = "barn"
            self.menu = dict(storage=sorted(msg.get("storage", {}).items()), cursor=cur)

    def start_fishing(self, msg):
        width = 30
        self.mode = "fishing"
        self.fish = dict(fish=msg["fish"], fname=msg["name"], diff=msg["difficulty"],
                         phase="wait", until=time.time() + msg["wait"], width=width,
                         zone_w=max(5, min(10, 6 + msg.get("level", 0) // 2)),
                         zone=width // 2 - 3, pos=random.uniform(3, width - 3),
                         vel=(4 + 3 * msg["difficulty"]) * random.choice((-1, 1)),
                         progress=0.4, start=None)

    def update_fishing(self, dt):
        f = self.fish
        now = time.time()
        if f["phase"] == "wait":
            if now >= f["until"]:
                f["phase"], f["start"] = "play", now
                try:
                    curses.beep()
                except curses.error:
                    pass
            return
        speed = 4 + 3.2 * f["diff"]
        if random.random() < (0.6 + 0.5 * f["diff"]) * dt:
            f["vel"] = speed * random.choice((-1, 1)) * random.uniform(0.6, 1.3)
        f["pos"] += f["vel"] * dt
        if f["pos"] < 0:
            f["pos"], f["vel"] = 0, abs(f["vel"])
        if f["pos"] > f["width"] - 1:
            f["pos"], f["vel"] = f["width"] - 1, -abs(f["vel"])
        inside = f["zone"] <= f["pos"] < f["zone"] + f["zone_w"]
        f["progress"] += (0.32 if inside else -(0.10 + 0.05 * f["diff"])) * dt
        if f["progress"] >= 1.0 or now - f["start"] > 30:
            self.send(dict(t="fish_result", ok=f["progress"] >= 1.0))
            self.mode, self.fish = "play", None
        elif f["progress"] <= 0:
            self.send(dict(t="fish_result", ok=False))
            self.mode, self.fish = "play", None

    # ------------------------------------------------------------------ animation
    def animate(self, dt):
        if self.mode == "fishing" and self.fish:
            self.update_fishing(dt)
            self.dirty = True
        self.anim_acc += dt
        if self.anim_acc < 0.12:
            return
        self.anim_acc = 0.0
        self.frame += 1
        self.dirty = True
        st = self.state
        weather = st["weather"] if st else "sun"
        if weather != "sun":
            for d in self.drops:
                d[1] += d[2]
            self.drops = [d for d in self.drops if d[1] < 60]
            for _ in range(3 if weather == "rain" else 1):
                self.drops.append([random.randint(0, W.MAP_W - 1), random.uniform(-2, 0),
                                   random.uniform(0.9, 1.6) if weather == "rain" else random.uniform(0.25, 0.5)])
        else:
            self.drops = []
        if self.is_night() and weather == "sun" and st and st["season"] != "winter":
            if not self.fireflies:
                for _ in range(14):
                    self.fireflies.append([random.randint(2, W.MAP_W - 3), random.randint(2, W.MAP_H - 3),
                                           random.uniform(0, 6.3)])
            if self.frame % 4 == 0:
                for ff in self.fireflies:
                    ff[0] = max(1, min(W.MAP_W - 2, ff[0] + random.randint(-1, 1)))
                    ff[1] = max(1, min(W.MAP_H - 2, ff[1] + random.randint(-1, 1)))
        else:
            self.fireflies = []

    def sky_hour(self):
        return (self.state or {}).get("sky", 12.0)

    def is_night(self):
        h = self.sky_hour()
        return h >= 20.5 or h < 5.5

    def sky_label(self):
        h = self.sky_hour()
        hh, mm = int(h), int((h - int(h)) * 60)
        phase = "night" if h < 5.5 else "sunrise" if h < 7.5 else "day" if h < 17 else "sunset" if h < 19.5 else "dusk" if h < 20.5 else "night"
        return "%d:%02d%s %s" % (((hh + 11) % 12) + 1, mm, "pm" if hh >= 12 else "am", phase)

    # ------------------------------------------------------------------ drawing helpers
    def put(self, y, x, s, attr=0, maxw=None):
        h, w = self.scr.getmaxyx()
        if y < 0 or y >= h or x >= w or not s:
            return
        if x < 0:
            s, x = s[-x:], 0
        limit = w - x
        if maxw is not None:
            limit = min(limit, maxw)
        if y == h - 1:
            limit = min(limit, w - x - 1)
        s = s[:max(0, limit)]
        if not s:
            return
        try:
            self.scr.addstr(y, x, s, attr)
        except curses.error:
            pass

    def g(self, pair_):
        return pair_[1] if self.ascii else pair_[0]

    def box(self, y, x, h, w, title="", attr=0):
        hor, ver = ("-", "|") if self.ascii else ("─", "│")
        tl, tr, bl, br = ("+", "+", "+", "+") if self.ascii else ("┌", "┐", "└", "┘")
        for yy in range(y, y + h):
            self.put(yy, x, " " * w, attr)
        self.put(y, x, tl + hor * (w - 2) + tr, attr)
        self.put(y + h - 1, x, bl + hor * (w - 2) + br, attr)
        for yy in range(y + 1, y + h - 1):
            self.put(yy, x, ver, attr)
            self.put(yy, x + w - 1, ver, attr)
        if title:
            self.put(y, x + 2, " %s " % title, attr | curses.A_BOLD)

    def item_glyph(self, key):
        it = W.ITEMS[key]
        return self.g((it["glyph"], it["ascii"]))

    def style_attr(self, style):
        return {
            "good": self.pal.pair("green") | curses.A_BOLD, "warn": self.pal.pair("yellow") | curses.A_BOLD,
            "event": self.pal.pair("cyan"), "weather": self.pal.pair("blue") | curses.A_BOLD,
            "chat": self.pal.pair("white") | curses.A_BOLD, "ping": self.pal.pair("magenta") | curses.A_BOLD,
            "log": curses.A_DIM,
        }.get(style, 0)

    # ------------------------------------------------------------------ map cells
    def static_rows(self, season, night, wframe):
        key = (season, night, wframe, self.ascii)
        rows = self.static_cache.get(key)
        if rows is not None:
            return rows
        P = self.pal.pair
        rich = self.pal.c256
        th = THEME[season]
        dim = curses.A_DIM if night else 0
        B = curses.A_BOLD

        def bg(idx):
            if not rich:
                return -1
            return NIGHT_BG.get(idx, idx) if night else idx

        gbg = bg(th["grass"])
        rows = []
        for y in range(W.MAP_H):
            runs, cur, cur_attr, start = [], "", None, 0
            for x in range(W.MAP_W):
                ch = self.map[y][x]
                gl = self.g(TERRAIN_GLYPHS[ch])
                hsh = (x * 73856093 ^ y * 19349663 ^ (x * y * 83492791)) & 0xFFFF
                if ch == ".":
                    if hsh % 7 == 0:
                        gl = ","
                    elif hsh % 11 == 0:
                        gl = "'"
                    if season == "winter":
                        gl = "." if hsh % 5 else "*"
                    if rich:
                        attr = P(th["grass_fg"][hsh % 3], gbg)
                    elif season == "winter":
                        attr = P("white") | curses.A_DIM
                    else:
                        attr = P("yellow" if season == "fall" else "green")
                elif ch == "~":
                    gl = self.g(("\u2248", "~")) if (x + y + wframe) % 3 else self.g(("~", "-"))
                    if rich:
                        attr = P(T256["water_fg"][(x * 3 + y + wframe) % 3], bg(T256["water"]))
                    else:
                        attr = P("blue", self.pal.water_bg) | (B if (x * 3 + y + wframe) % 5 == 0 else 0)
                elif ch == "T":
                    if rich:
                        attr = P(th["tree"][hsh % 2], gbg) | B
                    elif season == "winter":
                        attr = P("white") | B
                    elif season == "fall":
                        attr = P("red" if hsh % 2 else "yellow") | B
                    else:
                        attr = P("green") | B
                elif ch == "#":
                    attr = P(th["fence"], gbg) if rich else P("yellow") | curses.A_DIM
                elif ch == ":":
                    attr = (P(T256["path_fg"], bg(T256["path"])) if rich else P("yellow")) | (curses.A_DIM if hsh % 2 else 0)
                elif ch == ",":
                    attr = P(T256["sand_fg"], bg(T256["sand"])) if rich else P("yellow") | curses.A_DIM
                elif ch == "W":
                    attr = P(T256["house_fg"], bg(T256["house"])) if rich else P("white") | curses.A_DIM
                elif ch == "+":
                    attr = (P(T256["door_fg"], bg(T256["house"])) if rich else P("yellow")) | B
                elif ch == "S":
                    attr = P(T256["shop_fg"], bg(T256["shop"])) if rich else P("magenta") | curses.A_DIM
                elif ch == "N":
                    attr = P(217, bg(124)) if rich else P("red") | curses.A_DIM
                elif ch == "d":
                    attr = P(179, bg(136)) if rich else P("yellow")
                    gl = "." if hsh % 3 else self.g(("·", ","))
                elif ch == "u":
                    attr = (P(34, gbg) if rich else P("green")) | curses.A_DIM
                elif ch == "G":
                    attr = (P(137, gbg) if rich else P("yellow")) | B
                elif ch == "Y":
                    attr = (P(255, gbg) if rich else P("magenta")) | B
                elif ch == "$":
                    attr = (P(T256["bin_fg"], gbg) if rich else P("yellow")) | B
                elif ch == "!":
                    attr = (P(T256["board_fg"], gbg) if rich else P("cyan")) | B
                elif ch == "o":
                    attr = P(T256["rock_fg"], gbg) if rich else P("white") | curses.A_DIM
                elif ch == "f":
                    attr = (P(th["flower"][hsh % 3], gbg) if rich else P("magenta" if hsh % 2 else "red")) | B
                elif ch in PROP_STYLE:
                    c256, c8, bold = PROP_STYLE[ch]
                    attr = (P(c256, gbg) if rich else P(c8)) | (B if bold else 0)
                else:
                    attr = 0
                attr |= dim
                if attr != cur_attr and cur:
                    runs.append((start, cur, cur_attr))
                    cur, start = "", x
                if not cur:
                    start = x
                cur += gl
                cur_attr = attr
            if cur:
                runs.append((start, cur, cur_attr))
            rows.append(runs)
        self.static_cache[key] = rows
        if len(self.static_cache) > 8:
            self.static_cache.pop(next(iter(self.static_cache)))
        return rows

    def cell_bg(self, x, y, d=None, night=False):
        """Background colour of a map cell (soil, water, grass...)."""
        if d is None:
            d = self.tiles.get((x, y), {})
        if not self.pal.c256:
            return self.pal.wet_bg if (d.get("s") and d.get("w")) else -1
        if d.get("s"):
            idx = T256["wet"] if d.get("w") else T256["soil"]
        else:
            ch = self.map[y][x] if 0 <= y < W.MAP_H and 0 <= x < W.MAP_W else "#"
            season = self.state["season"] if self.state else "spring"
            idx = TERRAIN_BG.get(ch, THEME[season]["grass"])
        return NIGHT_BG.get(idx, idx) if night else idx

    def hair_skin(self):
        if self.pal.c256:
            return T256["hair"], T256["skin"]
        return curses.COLOR_BLACK, curses.COLOR_YELLOW

    def sprite_colour(self, role, p, cx, cy, night):
        if role == "tile":
            if getattr(self, "_indoor_bg", None) is not None:
                return self._indoor_bg
            return self.cell_bg(cx, cy, None, night)
        if role == "hair":
            return self.hair_skin()[0]
        if role == "skin":
            return self.hair_skin()[1]
        return W.PLAYER_COLORS[p["color"] % len(W.PLAYER_COLORS)]

    def draw_sprite(self, p, sy, sx, night, top, left, right):
        """Draw a farmer 3 cells wide: head on the row above their tile, body on it."""
        P = self.pal.pair
        facing = facing_name(p["facing"])
        spr = SPRITES.get(p.get("sprite") or "boy", SPRITES["boy"])
        x, y = p["x"], p["y"]
        shirt = W.PLAYER_COLORS[p["color"] % len(W.PLAYER_COLORS)]
        if self.ascii:
            head = spr["ascii"]["head"][facing]
            for i, ch in enumerate(head):
                if ch != " " and left <= sx - 1 + i < right and sy - 1 >= top:
                    self.put(sy - 1, sx - 1 + i, ch, P(shirt) | curses.A_BOLD)
            for i, ch in enumerate(spr["ascii"]["body"]):
                if left <= sx - 1 + i < right:
                    self.put(sy, sx - 1 + i, ch, P(shirt) | curses.A_BOLD)
            return
        eyes = EYES_CLOSED if blinking(p["name"], time.time()) else EYES_OPEN
        hair_bold = 0 if self.pal.c256 else curses.A_BOLD
        for row, cells in ((0, spr["head"][facing]), (1, spr["body"][facing])):
            scr_y = sy - 1 + row
            if scr_y < top:
                continue
            for i, cell in enumerate(cells):
                if cell is None:
                    continue
                scr_x = sx - 1 + i
                if not (left <= scr_x < right):
                    continue
                glyph, fg_role, bg_role = cell
                cx, cy = x - 1 + i, y - 1 + row
                if glyph == FACE:
                    glyph = eyes
                fg = self.sprite_colour(fg_role, p, cx, cy, night)
                bg = self.sprite_colour(bg_role, p, cx, cy, night)
                attr = P(fg, bg)
                if fg_role == "shirt":
                    attr |= curses.A_BOLD
                elif fg_role == "hair":
                    attr |= hair_bold
                self.put(scr_y, scr_x, glyph, attr)

    def dyn_cell(self, d, x, y, night):
        P = self.pal.pair
        rich = self.pal.c256
        dim = curses.A_DIM if night else 0
        B = curses.A_BOLD
        bg = self.cell_bg(x, y, d, night)

        def col(item_key, name):
            return ITEM_C256.get(item_key, C256.get(name, 255)) if rich else name

        soil, wet = d.get("s"), d.get("w")
        if "t" in d:
            kind, stage, fruit = d["t"][0], d["t"][1], d["t"][2]
            tr = W.TREES[kind]
            leaf = T256["sprout"][2] if rich else "green"
            if stage == 0:
                return "t", P(leaf, bg) | dim
            if stage == 1:
                return self.g(TREE_GLYPH), P(leaf, bg) | dim
            if fruit:
                return self.g(TREE_GLYPH), P(col(kind, tr["color"]), bg) | B
            return self.g(TREE_GLYPH), P(leaf, bg) | B | dim
        if "c" in d:
            kind, stage, ripe = d["c"][0], d["c"][1], d["c"][2]
            c = W.CROPS[kind]
            if ripe:
                return self.g((c["glyph"], c["ascii"])), P(col(kind, c["color"]), bg) | B
            gl = self.g(STAGE_GLYPHS[stage])
            fg = T256["sprout"][stage] if rich else "green"
            extra = curses.A_DIM if stage == 0 else (B if stage == 3 else 0)
            return gl, P(fg, bg) | extra | dim
        if "g" in d:
            f = W.FORAGE[d["g"]]
            return self.g((f["glyph"], f["ascii"])), P(col(d["g"], f["color"]), bg) | B
        if "k" in d:
            it = W.ITEMS["sprinkler"]
            return self.g((it["glyph"], it["ascii"])), P(col("sprinkler", "cyan"), bg) | B
        if soil:
            if rich:
                fg = T256["fert_fg"] if d.get("f") else (T256["wet_fg"] if wet else T256["soil_fg"])
                return self.g(SOIL_GLYPH), P(fg, bg) | dim
            fg = "green" if d.get("f") else ("cyan" if wet else "yellow")
            return self.g(SOIL_GLYPH), P(fg, bg) | (0 if wet else curses.A_DIM) | dim
        return None

    def my_player(self):
        if not self.state:
            return None
        for p in self.state["players"]:
            if p["name"] == self.name:
                return p
        return None

    def facing_interactive(self, p):
        fx, fy = p["x"] + p["facing"][0], p["y"] + p["facing"][1]
        if not (0 <= fx < W.MAP_W and 0 <= fy < W.MAP_H):
            return None
        terr = self.map[fy][fx]
        d = self.tiles.get((fx, fy), {})
        if terr in "S$!+~wmBchblNspgY" or "t" in d or "g" in d or self.cow_at(fx, fy) or self.chest_at(fx, fy):
            return (fx, fy)

    def cow_at(self, x, y):
        for c in (self.state or {}).get("cows", []):
            if c["x"] == x and c["y"] == y:
                return c
        return None

    def chest_at(self, x, y):
        return any(c["x"] == x and c["y"] == y for c in (self.state or {}).get("chests", []))

    def chest_ok(self, x, y):
        """Mirrors World.chest_ok: bare ground or path off the NO_CHEST tiles, nothing growing or placed there,
        no cow, chest or farmer on it (any farmer outdoors, online or not)."""
        d = self.tiles.get((x, y), {})
        return (0 <= x < W.MAP_W and 0 <= y < W.MAP_H and self.map[y][x] in ".:,d" and (x, y) not in W.NO_CHEST
                and not any(d.get(k) for k in "sctgk") and not self.cow_at(x, y) and not self.chest_at(x, y)
                and not any(q["x"] == x and q["y"] == y and q.get("loc", "farm") == "farm" for q in (self.state or {}).get("players", [])))

    # ------------------------------------------------------------------ drawing
    def draw(self):
        scr = self.scr
        scr.erase()
        h, w = scr.getmaxyx()
        if h < 18 or w < 64:
            self.put(0, 0, "Please make the terminal bigger (at least 64x18).")
            scr.refresh()
            return
        side_w = 32 if w >= 110 else 28
        map_w = w - side_w - 1
        map_h = h - 3
        self.draw_status(w)
        if self.state is None:
            self.put(2, 2, "Connecting to the farm...")
            scr.refresh()
            return
        self.draw_map(1, 0, map_h, map_w)
        for yy in range(1, h - 2):
            self.put(yy, map_w, self.g(("│", "|")), curses.A_DIM)
        self.draw_sidebar(1, map_w + 1, h - 3, side_w)
        self.draw_bottom(h, w)
        if self.mode == "shop":
            self.draw_shop(h, w)
        elif self.mode == "sell":
            self.draw_sell(h, w)
        elif self.mode == "board":
            self.draw_board(h, w)
        elif self.mode == "journal":
            self.draw_journal(h, w)
        elif self.mode == "barn":
            self.draw_barn(h, w)
        elif self.mode == "proposal":
            self.draw_proposal(h, w)
        elif self.mode == "help":
            self.draw_help(h, w)
        elif self.mode == "inventory":
            self.draw_inventory(h, w)
        elif self.mode == "fishing" and self.fish:
            self.draw_fishing(h, w)
        scr.refresh()

    def draw_status(self, w):
        st = self.state
        P = self.pal.pair
        bar = P("white", curses.COLOR_BLACK if not self.pal.c256 else 236) if self.pal.ok else curses.A_REVERSE
        self.put(0, 0, " " * w, bar)
        if not st:
            self.put(0, 1, self.farm, bar | curses.A_BOLD)
            return
        icon = "" if self.ascii else SEASON_ICON.get(st["season"], "") + " "
        wicon = {"sun": "", "rain": "", "snow": ""}[st["weather"]]
        clock = self.sky_label()
        night = ""
        online = sum(1 for p in st["players"] if p["online"])
        text = " %s%s  |  %s, day %d (year %d)  |  %s %s%s%s  |  %dg  |  %d online " % (
            icon, self.farm, st["season"].capitalize(), st["day"], st["year"], clock,
            wicon, WEATHER_TEXT[st["weather"]], night, st["coins"], online)
        self.put(0, 0, text, bar | curses.A_BOLD)

    INTERIOR_GLYPH = {"#": ("\u2588", "#", "yellow", 94), "W": ("\u2592", "W", "cyan", 110), ".": ("\u00b7", ".", "yellow", 137),
                      "r": ("\u2592", "r", "red", 160), "x": ("\u2564", "x", "yellow", 179), "b": ("\u2588", "b", "red", 203),
                      "t": ("\u2550", "t", "yellow", 179), "c": ("\u25a0", "c", "yellow", 214), "f": ("\u2593", "f", "red", 208),
                      "F": ("\u2593", "F", "yellow", 220), "k": ("\u2261", "k", "magenta", 135), "p": ("\u2663", "p", "green", 34),
                      "S": ("\u2550", "S", "yellow", 179), "q": ("@", "@", "green", 82), "h": ("\u2261", "h", "yellow", 220), "o": ("\u2550", "o", "yellow", 137)}

    def draw_interior(self, y0, x0, vh, vw, loc):
        rows = W.INTERIORS.get(loc, [])
        st = self.state
        h, w = len(rows), len(rows[0]) if rows else 0
        ox, oy = x0 + max(0, (vw - w) // 2), y0 + max(0, (vh - h) // 2)
        P = self.pal.pair
        floor_bg = 137 if self.pal.c256 else -1
        for y, row in enumerate(rows[:vh]):
            for x, ch in enumerate(row[:vw]):
                uni, asc, col8, col256 = self.INTERIOR_GLYPH.get(ch, ("?", "?", "white", 255))
                gl = asc if self.ascii else uni
                if ch in "#W":
                    attr = P(col256, 94) if self.pal.c256 else P(col8)
                elif ch in ".rx":
                    attr = P(col256, floor_bg if ch != "r" else 124) if self.pal.c256 else P(col8)
                    if ch == ".":
                        gl = " "
                else:
                    attr = (P(col256, floor_bg) if self.pal.c256 else P(col8)) | curses.A_BOLD
                self.put(oy + y, ox + x, gl, attr)
        for p in sorted(st["players"], key=lambda p: p["name"] == self.name):
            if not p["online"] or p.get("loc", "farm") != loc:
                continue
            sx, sy = ox + p["x"], oy + p["y"]
            self._indoor_bg = floor_bg
            self.draw_sprite(p, sy, sx, False, oy, ox, ox + w)
            self._indoor_bg = None
            label = p.get("bubble") or (p["name"] if p["name"] != self.name else None)
            if label:
                text = " %s " % label
                attr = P(W.PLAYER_COLORS[p["color"] % len(W.PLAYER_COLORS)]) | curses.A_BOLD
                self.put(sy - 2, max(ox, sx - len(text) // 2), text, (attr | curses.A_REVERSE) if p.get("bubble") else attr | curses.A_DIM)
        self.put(oy + h + 1, ox, ("Inside the %s - walk onto the doorway to go out." % loc)[:vw], curses.A_DIM)

    def draw_map(self, y0, x0, vh, vw):
        st = self.state
        me = self.my_player()
        if me and me.get("loc", "farm") != "farm":
            return self.draw_interior(y0, x0, vh, vw, me["loc"])
        px, py = (me["x"], me["y"]) if me else W.SPAWN
        if W.MAP_W <= vw:
            cam_x, ox = 0, x0 + (vw - W.MAP_W) // 2
            vw_eff = W.MAP_W
        else:
            cam_x, ox = max(0, min(W.MAP_W - vw, px - vw // 2)), x0
            vw_eff = vw
        if W.MAP_H <= vh:
            cam_y, oy = 0, y0 + (vh - W.MAP_H) // 2
            vh_eff = W.MAP_H
        else:
            cam_y, oy = max(0, min(W.MAP_H - vh, py - vh // 2)), y0
            vh_eff = vh
        night = self.is_night()
        rows = self.static_rows(st["season"], night, self.frame % 3)
        for sy in range(vh_eff):
            my = cam_y + sy
            for (rx, text, attr) in rows[my]:
                rend = rx + len(text)
                if rend <= cam_x or rx >= cam_x + vw_eff:
                    continue
                a, b = max(rx, cam_x), min(rend, cam_x + vw_eff)
                self.put(oy + sy, ox + a - cam_x, text[a - rx:b - rx], attr)
        rich = self.pal.c256
        for (lx, ly, text, color) in LABELS:
            if cam_y <= ly < cam_y + vh_eff:
                lattr = (self.pal.pair(T256["label_fg"], self.cell_bg(lx, ly, {}, night)) if rich
                         else self.pal.pair(color)) | curses.A_BOLD | (curses.A_DIM if night else 0)
                for i, ch in enumerate(text):
                    if cam_x <= lx + i < cam_x + vw_eff:
                        self.put(oy + ly - cam_y, ox + lx + i - cam_x, ch, lattr)
        target = self.facing_interactive(me) if me else None
        for (tx, ty), d in self.tiles.items():
            if not (cam_x <= tx < cam_x + vw_eff and cam_y <= ty < cam_y + vh_eff):
                continue
            cell = self.dyn_cell(d, tx, ty, night)
            if cell:
                self.put(oy + ty - cam_y, ox + tx - cam_x, cell[0], cell[1])
        hi = None   # the highlighted tile ahead, put again over our own sprite (3 wide, 2 tall: it covers it unless facing down)
        if target:
            tx, ty = target
            if cam_x <= tx < cam_x + vw_eff and cam_y <= ty < cam_y + vh_eff:
                d = self.tiles.get(target, {})
                cell = self.dyn_cell(d, tx, ty, night)
                if cell is None:
                    ch = self.map[ty][tx]
                    cell = (self.g(TERRAIN_GLYPHS[ch]), self.pal.pair("white", self.cell_bg(tx, ty, d, night)))
                hi = (oy + ty - cam_y, ox + tx - cam_x, cell[0], (cell[1] & ~curses.A_DIM) | curses.A_REVERSE)
                self.put(*hi)
        # weather & fireflies
        for d in self.drops:
            dx, dy = d[0], int(d[1])
            if cam_x <= dx < cam_x + vw_eff and cam_y <= dy < cam_y + vh_eff and self.map[dy][dx] not in "WS":
                dbg = self.cell_bg(dx, dy, None, night)
                if st["weather"] == "rain":
                    self.put(oy + dy - cam_y, ox + dx - cam_x, "|" if d[2] > 1.2 else "'",
                             self.pal.pair(T256["water_fg"][0] if rich else "blue", dbg) | curses.A_BOLD)
                else:
                    self.put(oy + dy - cam_y, ox + dx - cam_x, "*", self.pal.pair("white", dbg) | curses.A_BOLD)
        for ff in self.fireflies:
            if math.sin(time.time() * 2.5 + ff[2]) > 0.2 and self.map[ff[1]][ff[0]] == ".":
                if cam_x <= ff[0] < cam_x + vw_eff and cam_y <= ff[1] < cam_y + vh_eff:
                    self.put(oy + ff[1] - cam_y, ox + ff[0] - cam_x, self.g(("·", "*")),
                             self.pal.pair(226 if rich else "yellow", self.cell_bg(ff[0], ff[1], None, night)) | curses.A_BOLD)
        # the movable chest(s), cows, the priest's words, wedding guests
        for ch_ in st.get("chests", []):
            if cam_x <= ch_["x"] < cam_x + vw_eff and cam_y <= ch_["y"] < cam_y + vh_eff:
                rev = curses.A_REVERSE if target == (ch_["x"], ch_["y"]) else 0
                cattr = self.pal.pair(178, self.cell_bg(ch_["x"], ch_["y"], None, night)) if rich else self.pal.pair("yellow")
                cell = (oy + ch_["y"] - cam_y, ox + ch_["x"] - cam_x, self.g(("▣", "X")), cattr | curses.A_BOLD | rev)
                self.put(*cell)
                hi = cell if rev else hi
        for cw in st.get("cows", []):
            if cam_x <= cw["x"] < cam_x + vw_eff and cam_y <= cw["y"] < cam_y + vh_eff:
                rev = curses.A_REVERSE if target == (cw["x"], cw["y"]) else 0
                cell = (oy + cw["y"] - cam_y, ox + cw["x"] - cam_x, "C", (self.pal.pair("yellow") if cw["milk"] else self.pal.pair("white")) | curses.A_BOLD | rev)
                self.put(*cell)
                hi = cell if rev else hi
        pr = st.get("priest")
        if pr and pr.get("bubble") and cam_y <= pr["y"] - 1 < cam_y + vh_eff:
            text = " %s " % pr["bubble"]
            lx = max(ox, min(ox + vw_eff - len(text), ox + pr["x"] - cam_x - len(text) // 2))
            self.put(oy + pr["y"] - cam_y - 1, lx, text, self.pal.pair("magenta") | curses.A_REVERSE)
        wd = st.get("wedding")
        if wd:
            for gst in wd["guests"]:
                if cam_x <= gst["x"] < cam_x + vw_eff and cam_y <= gst["y"] < cam_y + vh_eff:
                    self.draw_sprite(dict(name=gst["name"], x=gst["x"], y=gst["y"], facing=[0, -1], sprite=gst["sprite"], color=gst["color"]),
                                     oy + gst["y"] - cam_y, ox + gst["x"] - cam_x, night, oy, ox, ox + vw_eff)
            if wd["phase"] == "married":
                banner = " ♥ MARRIED ♥ "
                self.put(oy + max(0, wd["altar"][0][1] - cam_y - 4), ox + wd["altar"][0][0] - cam_x - len(banner) // 2 + 1, banner, self.pal.pair("magenta") | curses.A_BOLD | curses.A_REVERSE)
        # players (others first so we draw on top)
        players = sorted(st["players"], key=lambda p: p["name"] == self.name)
        for p in players:
            if not p["online"] or p.get("loc", "farm") != "farm":
                continue
            if not (cam_x <= p["x"] < cam_x + vw_eff and cam_y <= p["y"] < cam_y + vh_eff):
                continue
            attr = self.pal.pair(W.PLAYER_COLORS[p["color"] % len(W.PLAYER_COLORS)]) | curses.A_BOLD
            sx, sy = ox + p["x"] - cam_x, oy + p["y"] - cam_y
            self.draw_sprite(p, sy, sx, night, oy, ox, ox + vw_eff)
            if hi and p["name"] == self.name:   # before the bobber, which floats on that same tile
                self.put(*hi)
            if p.get("fishing"):
                bx, by = p["x"] + p["facing"][0], p["y"] + p["facing"][1]
                if cam_x <= bx < cam_x + vw_eff and cam_y <= by < cam_y + vh_eff:
                    self.put(oy + by - cam_y, ox + bx - cam_x, "o" if self.frame % 6 < 3 else "O",
                             self.pal.pair("white", self.cell_bg(bx, by, None, night)) | curses.A_BOLD)
            label = p["name"] if p["name"] != self.name else None
            if p.get("bubble"):
                label = p["bubble"]
            if label:
                text = " %s " % label
                lx = sx - len(text) // 2
                lx = max(ox, min(ox + vw_eff - len(text), lx))
                ly = sy - 2
                if ly < oy:
                    ly = sy + 1
                    text = text  # below the feet when there is no room above
                self.put(ly, lx, text, (attr | curses.A_REVERSE) if p.get("bubble") else attr | curses.A_DIM)

    def draw_sidebar(self, y0, x0, h, w):
        st, me = self.state, self.me
        P = self.pal.pair
        inner = w - 2
        y = y0
        self.put(y, x0 + 1, "Farmers", curses.A_BOLD | curses.A_UNDERLINE)
        y += 1
        hair, skin = self.hair_skin()
        for p in sorted((p for p in st["players"] if p["online"]), key=lambda p: p["name"]):
            shirt = W.PLAYER_COLORS[p["color"] % len(W.PLAYER_COLORS)]
            spr = SPRITES.get(p.get("sprite") or "boy", SPRITES["boy"])
            fade = 0 if p["online"] else curses.A_DIM
            if self.ascii:
                self.put(y, x0 + 1, spr["ascii"]["head"]["down"], P(shirt) | curses.A_BOLD | fade)
            else:
                for i, cell in enumerate(spr["head"]["down"]):
                    glyph, fg_role, bg_role = cell
                    glyph = EYES_OPEN if glyph == FACE else glyph
                    fg = hair if fg_role == "hair" else shirt
                    bg = skin if bg_role == "skin" else -1
                    self.put(y, x0 + 1 + i, glyph, P(fg, bg) | (0 if self.pal.c256 else curses.A_BOLD) | fade)
            you = " (you)" if p["name"] == self.name else ""
            away = "" if p["online"] else "  away"
            self.put(y, x0 + 5, ("%s%s Lv%d %s%s" % (p["name"], you, p["level"], p["title"], away))[:inner - 4], fade)
            y += 1
        y += 1
        self.put(y, x0 + 1, "Hand", curses.A_BOLD | curses.A_UNDERLINE)
        self.put(y, x0 + 6, "(I for the whole bag)", curses.A_DIM)
        y += 1
        inv = me["inventory"] if me else []
        for i in range(9):
            if i < len(inv):
                k, n = inv[i]
                it = W.ITEMS[k]
                sel = (i == me["selected"])
                attr = curses.A_REVERSE if sel else 0
                line = "%s%d %s %-*s x%d" % (">" if sel else " ", i + 1, self.item_glyph(k), inner - 9, it["name"][:inner - 9], n)
                self.put(y, x0 + 1, line[:inner], attr)
            y += 1
        if len(inv) > 9:
            self.put(y, x0 + 1, "  ...and %d more (I / Tab)" % (len(inv) - 9), curses.A_DIM)
        y += 1
        if me:
            water = me["water"]
            filled = int(round(10 * water / W.CAN_CAPACITY))
            bar = self.g(("█", "#")) * filled + self.g(("░", ".")) * (10 - filled)
            self.put(y, x0 + 1, "Can ", curses.A_BOLD)
            self.put(y, x0 + 5, bar, P("cyan") | curses.A_BOLD)
            self.put(y, x0 + 16, "%d/%d" % (water, W.CAN_CAPACITY))
            y += 1
            nxt = me.get("next_xp")
            top = me["level"] >= len(W.TITLES) - 1 or nxt is None or me["xp"] >= nxt   # top title: nothing left to fill
            self.put(y, x0 + 1, "Lv%d %s  xp %s" % (me["level"], me["title"], "MAX" if top else "%d/%d" % (me["xp"], nxt)), curses.A_DIM)
            y += 2
        q = st.get("quest")
        if q and y < y0 + h - 4:
            self.put(y, x0 + 1, "Notice board", curses.A_BOLD | curses.A_UNDERLINE)
            y += 1
            have = self.count_item(q["item"])
            text = "%s needs %d %s for %s. Reward %dg. (have %d)" % (
                q["who"], q["n"], W.ITEMS[q["item"]]["name"], q["reason"], q["reward"], have)
            for line in wrap(text, inner)[:4]:
                self.put(y, x0 + 1, line, P("cyan"))
                y += 1
            y += 1
        if y < y0 + h - 2:
            self.put(y, x0 + 1, "Log", curses.A_BOLD | curses.A_UNDERLINE)
            y += 1
            space = y0 + h - y
            lines = []
            for text, style in self.log[-space:]:
                for i, l in enumerate(wrap(text, inner)):
                    lines.append((("  " + l) if i else l, style))
            for text, style in lines[-space:]:
                self.put(y, x0 + 1, text[:inner], self.style_attr(style))
                y += 1

    def count_item(self, key):
        if not self.me:
            return 0
        for k, n in self.me["inventory"]:
            if k == key:
                return n
        return 0

    def describe_here(self):
        p = self.my_player()
        if not p:
            return "", ""
        if p.get("loc", "farm") != "farm":
            rows = W.INTERIORS[p["loc"]]
            fx, fy = p["x"] + p["facing"][0], p["y"] + p["facing"][1]
            ch = rows[fy][fx] if 0 <= fy < len(rows) and 0 <= fx < len(rows[0]) else "#"
            hint = {"c": " - E opens the shared chest", "S": " - E to shop", "q": " - E to shop", "k": " - E for the journal", "x": " - walk onto it to go out"}.get(ch, "")
            return "Inside the %s" % p["loc"], W.INTERIOR_NAMES.get(ch, "wall").capitalize() + hint
        x, y = p["x"], p["y"]
        d = self.tiles.get((x, y), {})
        terr = self.map[y][x]
        sel = None
        if self.me and self.me["inventory"]:
            sel = self.me["inventory"][self.me["selected"]][0]
        kind = W.ITEMS[sel]["kind"] if sel else None
        if "c" in d:
            ck, stage, ripe, pct, eta = d["c"]
            c = W.CROPS[ck]
            if ripe:
                here = "%s - RIPE! Press E to harvest (scythe or hands)." % c["name"]
            else:
                here = "%s %d%%, ready in ~%s%s" % (c["name"], pct, W.fmt_duration(eta),
                                                    " (wet soil, growing fast)" if d.get("w") else ". Water it with the can.")
        elif "t" in d:
            tk, stage, fruit, pct, eta = d["t"]
            here = "%s tree %d%%" % (W.TREES[tk]["name"], pct)
        elif "g" in d:
            here = "%s - press E to pick." % W.ITEMS[d["g"]]["name"]
        elif "k" in d:
            here = "Sprinkler (waters the 8 tiles around it). X picks it up."
        elif d.get("s"):
            wet = " (wet)" if d.get("w") else ""
            if kind in ("seed", "sapling"):
                here = "Tilled soil%s - press E to plant %s." % (wet, W.ITEMS[sel]["name"])
            elif sel == "watering_can":
                here = "Tilled soil%s - press E to water." % wet if not wet else "Tilled soil (wet) - already watered."
            else:
                here = "Tilled soil%s - hold seeds to plant, or the can to water." % wet
        elif terr == "d":
            here = "Farmland - hold the hoe (1) and press E to till." if sel != "hoe" else "Farmland - press E to till."
        elif terr == ".":
            here = "Grass. Farming happens on the sandy farmland."
        else:
            here = W.TERRAIN_NAMES.get(terr, "").capitalize()
        fx, fy = x + p["facing"][0], y + p["facing"][1]
        ft = self.map[fy][fx] if 0 <= fx < W.MAP_W and 0 <= fy < W.MAP_H else "#"
        fd = self.tiles.get((fx, fy), {})
        ahead = ""
        if ft == "S":
            ahead = "Shop - E to browse seeds."
        elif ft == "$":
            ahead = "Shipping bin - E to sell."
        elif ft == "!":
            ahead = "Notice board - E to read the request."
        elif ft == "+":
            ahead = "Farmhouse - E for the farm journal."
        elif ft == "~":
            ahead = "Pond - E refills the can, F goes fishing."
        elif ft == "w":
            ahead = "Well - E refills the can."
        elif ft == "m":
            ahead = "Mailbox - E to read your letters."
        elif ft == "N":
            ahead = "Barn - E to open the shared storage."
        elif self.chest_at(fx, fy):
            ahead = "Storage chest - E to open, X to pick it up."
        elif ft == "Y":
            ahead = "Father TongTong - E to say hello."
        elif self.cow_at(fx, fy):
            cw = self.cow_at(fx, fy)
            ahead = "%s the cow - %s" % (cw["name"], "E to milk her!" if cw["milk"] else "milk %d%% ready." % cw["pct"])
        elif ft in "Bchblspg":
            ahead = W.TERRAIN_NAMES[ft].capitalize() + " - E to have a look."
        elif "t" in fd:
            tk, stage, fruit, pct, eta = fd["t"]
            tr = W.TREES[tk]
            if tr.get("rare"):
                ahead = ("Legendary %s seedling %d%%, grown in ~%s." % (tr["name"], pct, W.fmt_duration(eta))) if stage < 2 else "A legendary %s." % tr["name"]
            elif stage < 2:
                ahead = "%s sapling %d%%, mature in ~%s." % (tr["name"], pct, W.fmt_duration(eta))
            elif fruit:
                ahead = "%s tree with %d fruit - E to pick!" % (tr["name"], fruit)
            else:
                ahead = "%s tree - next fruit in ~%s." % (tr["name"], W.fmt_duration(eta))
        elif "g" in fd:
            ahead = "%s - E to pick." % W.ITEMS[fd["g"]]["name"]
        if p.get("carry") == "chest":
            return "Carrying the storage chest over your head.", (   # the same checks, in the same order, as act_place
                "Not there - folks need that spot clear to get by." if (fx, fy) in W.NO_CHEST
                else "E (or X) sets it down on the tile ahead." if self.chest_ok(fx, fy) else "No room to set it down - find clear ground.")
        return here, ahead

    def draw_bottom(self, h, w):
        here, ahead = self.describe_here()
        line = "Here: " + here
        if ahead:
            line += "   Ahead: " + ahead
        self.put(h - 2, 1, line[:w - 2], self.pal.pair("white"))
        if self.mode == "chat":
            prompt = "say> "
            self.put(h - 1, 0, prompt, curses.A_BOLD)
            self.put(h - 1, len(prompt), self.chat_buf[-(w - len(prompt) - 2):], 0)
            self.put(h - 1, min(w - 2, len(prompt) + len(self.chat_buf)), "_", curses.A_BLINK)
        elif self.toast:
            text, until, style = self.toast
            self.put(h - 1, 1, (" %s " % text)[:w - 2], self.style_attr(style) | curses.A_REVERSE)
        else:
            self.put(h - 1, 1, HINT[:w - 2], curses.A_DIM)

    # menus ---------------------------------------------------------------------
    def center_box(self, h, w, bh, bw, title):
        bw, bh = min(bw, w - 2), min(bh, h - 2)
        y, x = max(0, (h - bh) // 2), max(0, (w - bw) // 2)
        self.box(y, x, bh, bw, title)
        return y, x, bh, bw

    def item_blurb(self, key):
        it = W.ITEMS[key]
        if it["kind"] == "seed":
            c = W.CROPS[it["crop"]]
            s = "Grows in %s (%s watered), sells %dg" % (W.fmt_duration(c["grow"]), W.fmt_duration(c["grow"] / W.WATER_MULT), c["sell"])
            if c["regrow"]:
                s += ", regrows every %s" % W.fmt_duration(c["regrow"])
            return s + ". Seasons: %s." % ", ".join(c["seasons"])
        if it["kind"] == "sapling":
            tr = W.TREES[it["tree"]]
            if tr.get("rare"):
                return "A legendary seed - one crop in a million drops one. Grows into a %s in %s. Plant on tilled soil, leave a gap." % (
                    tr["name"], W.fmt_duration(tr["mature"]))
            return "Matures in %s, then a %s (%dg) every %s. Plant on tilled soil, leave a gap." % (
                W.fmt_duration(tr["mature"]), tr["name"], tr["fruit_sell"], W.fmt_duration(tr["fruit_every"]))
        if key == "fertilizer":
            return "Use on tilled soil: +50%% growth until the crop is harvested."
        if key == "sprinkler":
            return "Place on a tile: keeps the 8 tiles around it watered forever."
        return "Sells for %dg." % it["sell"]

    def draw_shop(self, h, w):
        m = self.menu
        stock = m["stock"]
        y, x, bh, bw = self.center_box(h, w, len(stock) + 8, 64, "Seed Shop  (%s stock)" % m["season"])
        self.put(y + 1, x + 2, "Shared coins: %dg" % self.state["coins"], self.pal.pair("yellow") | curses.A_BOLD)
        for i, (k, price) in enumerate(stock):
            it = W.ITEMS[k]
            sel = i == m["cursor"]
            line = "%s %s %-22s %5dg" % (">" if sel else " ", self.item_glyph(k), it["name"], price)
            if sel:
                line += "   x%-2d = %dg" % (m["qty"], price * m["qty"])
            attr = curses.A_REVERSE if sel else 0
            if price * (m["qty"] if sel else 1) > self.state["coins"]:
                attr |= curses.A_DIM
            self.put(y + 3 + i, x + 2, line[:bw - 4], attr)
        k = stock[m["cursor"]][0]
        for i, line in enumerate(wrap(self.item_blurb(k), bw - 4)[:2]):
            self.put(y + bh - 4 + i, x + 2, line, self.pal.pair("cyan"))
        self.put(y + bh - 2, x + 2, "up/down choose   left/right amount   Enter buy   Esc leave", curses.A_DIM)

    def draw_sell(self, h, w):
        m = self.menu
        items = self.sellables()
        y, x, bh, bw = self.center_box(h, w, max(len(items), 1) + 7, 64, "Shipping Bin")
        self.put(y + 1, x + 2, "Shared coins: %dg" % self.state["coins"], self.pal.pair("yellow") | curses.A_BOLD)
        if not items:
            self.put(y + 3, x + 2, "Nothing to sell yet. Grow, forage or fish something first!", curses.A_DIM)
        total = 0
        for i, (k, n) in enumerate(items):
            it = W.ITEMS[k]
            total += it["sell"] * n
            sel = i == min(m["cursor"], len(items) - 1)
            line = "%s %s %-18s x%-3d %4dg each" % (">" if sel else " ", self.item_glyph(k), it["name"], n, it["sell"])
            if sel:
                line += "   sell %d = %dg" % (min(m["qty"], n), it["sell"] * min(m["qty"], n))
            self.put(y + 3 + i, x + 2, line[:bw - 4], curses.A_REVERSE if sel else 0)
        self.put(y + bh - 3, x + 2, "Everything here would fetch %dg." % total, self.pal.pair("cyan"))
        self.put(y + bh - 2, x + 2, "Enter sell  a: whole stack  A: everything  Esc leave"[:bw - 4], curses.A_DIM)

    def draw_board(self, h, w):
        q = self.menu.get("quest") or self.state.get("quest")
        y, x, bh, bw = self.center_box(h, w, 10, 60, "Notice Board")
        if not q:
            self.put(y + 2, x + 2, "The board is empty. Check back later.")
            return
        it = W.ITEMS[q["item"]]
        lines = wrap("\"%s needs %d %s for %s. Can anyone help? Reward: %dg.\"" % (
            q["who"], q["n"], it["name"], q["reason"], q["reward"]), bw - 4)
        for i, l in enumerate(lines[:4]):
            self.put(y + 2 + i, x + 2, l)
        have = self.count_item(q["item"])
        ok = have >= q["n"]
        self.put(y + bh - 3, x + 2, "You carry %d/%d %s." % (have, q["n"], it["name"]),
                 self.pal.pair("green" if ok else "yellow") | curses.A_BOLD)
        self.put(y + bh - 2, x + 2, ("Enter deliver   " if ok else "") + "Esc leave", curses.A_DIM)

    def draw_barn(self, h, w):
        m = self.menu
        items = m["storage"]
        y, x, bh, bw = self.center_box(h, w, max(len(items), 1) + 7, 64, "Barn - shared storage")
        held = self.me["inventory"][self.me["selected"]] if self.me and self.me["inventory"] else None
        self.put(y + 1, x + 2, "Holding: %s" % (W.ITEMS[held[0]]["name"] + " x%d" % held[1] if held else "nothing"), self.pal.pair("yellow") | curses.A_BOLD)
        if not items:
            self.put(y + 3, x + 2, "The barn is empty. Press p to put in what you hold.", curses.A_DIM)
        for i, (k, n) in enumerate(items):
            sel = i == min(m["cursor"], len(items) - 1)
            self.put(y + 3 + i, x + 2, ("%s %s %-22s x%d" % (">" if sel else " ", self.item_glyph(k), W.ITEMS[k]["name"], n))[:bw - 4],
                     curses.A_REVERSE if sel else 0)
        self.put(y + bh - 2, x + 2, "Enter take 1   a take all   p put 1   P put stack   Esc"[:bw - 4], curses.A_DIM)

    def draw_journal(self, h, w):
        d = self.menu["data"]
        y, x, bh, bw = self.center_box(h, w, min(h - 2, 26), 72, "Farm Journal - %s" % d["farm"])
        age = W.fmt_duration(time.time() - d["created"])
        s = d["stats"]
        self.put(y + 1, x + 2, "Founded %s ago.  %d milestones of %d." % (age, len(d["milestones"]), len(d["all_milestones"])))
        row = y + 3
        self.put(row, x + 2, "Together we have:", curses.A_BOLD)
        stats = [("planted", "planted"), ("harvested", "harvested"), ("watered", "waterings"),
                 ("fish", "fish caught"), ("foraged", "foraged"), ("fruit", "fruit picked"),
                 ("trees", "trees planted"), ("quests", "requests filled"), ("earned", "coins earned")]
        for i, (k, label) in enumerate(stats):
            self.put(row + 1 + i // 3, x + 2 + (i % 3) * 22, "%6d %s" % (s.get(k, 0), label))
        row += 5
        self.put(row, x + 2, "Farmers:", curses.A_BOLD)
        for i, p in enumerate(d["players"][:5]):
            ps = p["stats"]
            seen = "online" if p["online"] else ("last seen %s ago" % W.fmt_duration(time.time() - p["last_seen"]) if p["last_seen"] else "")
            self.put(row + 1 + i, x + 2, "  %-12s Lv%d %-13s harvested %d, fished %d  %s" % (
                p["name"], p["level"], p["title"], ps.get("harvested", 0), ps.get("fish", 0), seen))
        row += 2 + min(5, len(d["players"]))
        self.put(row, x + 2, "Milestones:", curses.A_BOLD)
        col_w = (bw - 4) // 3
        for i, m in enumerate(d["all_milestones"]):
            got = m in d["milestones"]
            yy = row + 1 + i // 3
            if yy >= y + bh - 2:
                break
            self.put(yy, x + 2 + (i % 3) * col_w, ("%s %s" % ("*" if got else "-", m))[:col_w - 1],
                     self.pal.pair("yellow") | curses.A_BOLD if got else curses.A_DIM)
        self.put(y + bh - 2, x + 2, "Esc / Enter close", curses.A_DIM)

    def draw_inventory(self, h, w):
        m = self.menu
        inv = self.me["inventory"] if self.me else []
        y, x, bh, bw = self.center_box(h, w, max(len(inv), 1) + 6, 62, "Your Bag")
        if not inv:
            self.put(y + 2, x + 2, "Your bag is empty.", curses.A_DIM)
        for i, (k, n) in enumerate(inv):
            it = W.ITEMS[k]
            sel = i == min(m["cursor"], max(0, len(inv) - 1))
            hand = " (in hand)" if i == self.me["selected"] else ""
            self.put(y + 2 + i, x + 2, ("%s %s %-22s x%-3d %s%s" % (">" if sel else " ", self.item_glyph(k), it["name"], n,
                                                                    it["kind"], hand))[:bw - 4],
                     curses.A_REVERSE if sel else 0)
        if inv:
            k = inv[min(m["cursor"], len(inv) - 1)][0]
            self.put(y + bh - 3, x + 2, wrap(self.item_blurb(k), bw - 4)[0], self.pal.pair("cyan"))
        self.put(y + bh - 2, x + 2, "up/down choose   Enter hold in hand   Esc close", curses.A_DIM)

    HELP_TEXT = [
        ("Move", "arrow keys or WASD. You act on the tile you stand on; special things "
                 "(pond, shop, bin, board, trees) are used by facing them - they highlight."),
        ("E / Space", "do the natural thing: till grass, plant the seed in hand, water, harvest, "
                      "pick forage, refill the can at the pond, open the shop / bin / board."),
        ("F", "fish when facing the pond. Keep the fish inside your net with left/right."),
        ("X", "clear the tile you stand on (dig up a crop, remove soil, pick up a sprinkler). Facing the "
              "storage chest, X picks it up (E opens it); carrying it, E or X sets it down ahead."),
        ("1-9 / Tab", "choose what you hold. I opens the whole bag."),
        ("T", "chat. Speech bubbles show above your head. / starts a command."),
        ("J", "the farm journal: shared stats, milestones and farmers."),
        ("shift-Q", "leave. The farm keeps growing while you are away."),
        ("", ""),
        ("Growing", "crops grow in real time, even when nobody is here. Wet soil grows 3x faster "
                    "for 4 hours; rain waters everything. Fertilizer adds 50%. Sprinklers keep the 8 "
                    "tiles around them wet."),
        ("Money", "coins are shared. Sell at the bin ($) by the house, buy at the shop, or fill the "
                  "request on the notice board for a bonus."),
        ("Commands", "/ping@all [msg] says hi on every terminal of this account and in the game. "
                     "/farm <name> renames the farm. /give <player> <item> [n] hands items over. "
                     "/me <action> emotes."),
        ("Your look", "/look boy or /look girl swaps your farmer. /color <shirt> picks a shirt: red, "
                      "blue, yellow, pink, green, cyan, orange, white or magenta."),
    ]

    def draw_help(self, h, w):
        bw = min(84, w - 2)
        text_w = bw - 15
        rows = []
        for k, v in self.HELP_TEXT:
            if not v:
                rows.append(("", ""))
                continue
            for i, line in enumerate(wrap(v, text_w)):
                rows.append((k if i == 0 else "", line))
        bh = min(h - 2, len(rows) + 4)
        y, x, bh, bw = self.center_box(h, w, bh, bw, "How to farm")
        for i, (k, v) in enumerate(rows[:bh - 4]):
            self.put(y + 2 + i, x + 2, "%-10s" % k, curses.A_BOLD)
            self.put(y + 2 + i, x + 13, v[:bw - 15])
        self.put(y + bh - 2, x + 2, "Esc close", curses.A_DIM)

    def draw_fishing(self, h, w):
        f = self.fish
        y, x, bh, bw = self.center_box(h, w, 8, f["width"] + 12, "Fishing")
        if f["phase"] == "wait":
            dots = "." * (1 + int(time.time() * 2) % 3)
            self.put(y + 2, x + 3, "Waiting for a bite" + dots, curses.A_BOLD)
            self.put(y + 4, x + 3, self.g(("≈", "~")) * f["width"], self.pal.pair("blue"))
            self.put(y + 6, x + 3, "Esc reel in", curses.A_DIM)
            return
        self.put(y + 1, x + 3, "Something's on the line!  left/right: keep it in your net", curses.A_BOLD)
        water = [self.g(("≈", "~"))] * f["width"]
        for i in range(f["width"]):
            inside = f["zone"] <= i < f["zone"] + f["zone_w"]
            attr = self.pal.pair("blue") | (curses.A_REVERSE if inside else 0)
            self.put(y + 3, x + 3 + i, water[i], attr)
        fp = int(round(f["pos"]))
        inside = f["zone"] <= f["pos"] < f["zone"] + f["zone_w"]
        self.put(y + 3, x + 3 + fp, "f" if self.ascii else "¤",
                 self.pal.pair("yellow" if inside else "white") | curses.A_BOLD | (curses.A_REVERSE if inside else 0))
        filled = int(f["progress"] * f["width"])
        self.put(y + 5, x + 3, self.g(("█", "#")) * filled, self.pal.pair("green") | curses.A_BOLD)
        self.put(y + 5, x + 3 + filled, self.g(("░", ".")) * (f["width"] - filled), curses.A_DIM)
        self.put(y + 5, x + 4 + f["width"], "%3d%%" % int(f["progress"] * 100))
        self.put(y + 6, x + 3, "Esc give up", curses.A_DIM)
