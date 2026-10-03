"""Free movement in the browser: the server still keeps tiles, but learns which way you face as you move and act, takes
diagonal steps, and remembers where you came to rest inside a tile (so other farmers see you standing just there).
Junk in any of it is refused, and the snapshot always stays valid JSON.

    python3 tests/test_movement.py          (no server needed: it drives a World directly)
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import world as W                      # noqa: E402

fails = []


def check(ok, label):
    print(("OK   " if ok else "FAIL ") + label)
    if not ok:
        fails.append(label)


now = time.time()
w = W.World()
w.created = now - 60          # the farm began a minute ago, so the season and day never depend on the real time
w.join("T", now)
p = w.players["T"]
p.update(loc="farm", x=20, y=11, facing=[0, 1])


def act(**m):
    w.out = []
    w.apply("T", m, now)
    return w.out


act(t="move", dx=1, dy=1, f="right")
check((p["x"], p["y"]) == (21, 12) and p["facing"] == [1, 0], "a diagonal step lands diagonally and faces the way the farmer looks")
act(t="move", dx=0, dy=-1)
check(p["facing"] == [0, -1], "a step without a facing faces the way it went")
act(t="move", dx=1, dy=-1)
check(p["facing"] == [1, 0], "a diagonal step without a facing faces sideways, never diagonally")
act(t="move", dx=-1, dy=0, f="sideways")
check(p["facing"] == [-1, 0], "an unknown facing is ignored")

act(t="rest", ox="0.25", oy="-0.5")
check(p.get("off") == [0.25, -0.5] and w.public_player(p, now)["o"] == [0.25, -0.5], "coming to rest inside a tile is remembered and shared")
act(t="rest", ox="3", oy="-9")
check(p["off"] == [0.6, -0.6], "a resting spot can't leave the tile")
for junk in ("nan", "inf", "-inf", "1e999", "abc", "", "x" * 500):
    act(t="rest", ox=junk, oy="0.1")
    check(p["off"] == [0.6, -0.6], "junk %r is refused" % junk[:8])
json.loads(json.dumps(w.snapshot(now)))
check(True, "the snapshot is still valid JSON")
act(t="move", dx=1, dy=0)
check("off" not in p and w.public_player(p, now)["o"] is None, "stepping to a new tile forgets the old resting spot")

p.update(x=20, y=11, facing=[0, 1])
w.tile((20, 10))["soil"] = False
act(t="interact", f="up")
check(p["facing"] == [0, -1], "E says which way you face (you can turn without stepping)")
act(t="interact", f=12)
check(p["facing"] == [0, -1], "a facing that isn't a word is dropped")
act(t="face", dx=-1, dy=0)
check(p["facing"] == [-1, 0], "turning on the spot")

print("\n%d failure(s)" % len(fails) if fails else "\nall good")
sys.exit(1 if fails else 0)
