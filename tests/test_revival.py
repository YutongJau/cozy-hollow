"""The Valley Revival: the shared five-stage meter, its six threads, credits, catch-up for older farms and saving.

    python3 tests/test_revival.py          (no server needed: it drives a World directly)
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import world as W                      # noqa: E402
from valley import revival as RV       # noqa: E402

fails = []


def check(ok, label):
    print(("OK   " if ok else "FAIL ") + label)
    if not ok:
        fails.append(label)


def texts(out):
    return [m[1].get("text", "") for m in out if m[1].get("t") == "msg"]


now = time.time()
w = W.World()
w.created = now - 60          # the farm began a minute ago, so the season and day never depend on the real time
w.coins = 100000
w.join("A", now)
w.join("B", now)
a, b = w.players["A"], w.players["B"]
a["xp"] = b["xp"] = 60 * 30 * 30


def tick(t=None):
    w._rev_check = 0
    w.out = []
    w._tick_revival(t or now)
    return texts(w.out)


# ---------------------------------------------------------------- a new farm starts Quiet
check(w.stage() == 0 and w.stage_name() == "Quiet", "a new farm starts Quiet")
s = w.revival_summary()
check(s["met"] == 0 and s["need"] == 5 and s["next"] == "Waking", "summary: 0 of 5 threads towards Waking")

# ---------------------------------------------------------------- the farm thread: crop kinds shipped
for k in ("turnip", "potato", "radish"):
    w.give(a, k, 2)
    w.out = []
    w.apply("A", dict(t="sell", item=k, n=1), now)
check(len(w.revival["shipped"]) == 3 and w.revival["shipped"]["radish"] == "A", "selling a crop ships its kind, credited to the seller")
check(any("first Radish" in t for t in texts(w.out)), "the first of each kind is announced")
w.out = []
w.apply("A", dict(t="sell", item="radish", n=1), now)
check(not any("first" in t for t in texts(w.out)) and w.revival["credits"]["A"]["farm"] == 3, "a kind is only credited once")
w.give(b, "strawberry", 3)
w.give(b, "apple", 3)
w.apply("B", dict(t="sell_all"), now)
check("strawberry" in w.revival["shipped"] and "apple" not in w.revival["shipped"], "shipping everything counts crops (fruit is not a crop)")

# ---------------------------------------------------------------- town, museum, friends, exploration
a.update(loc="hall")
w.give(a, "wood", 20)
w.give(a, "copper_ore", 10)
w.apply("A", dict(t="contribute", project="lamps"), now)
check(w.unlocked("lamps") and w.revival["credits"]["A"]["town"] == 1, "finishing a town project credits the farmer")
b.update(loc="museum")
for k in ("quartz", "amethyst", "emerald", "ruby", "diamond"):
    w.give(b, k, 1)
    w.apply("B", dict(t="donate", item=k), now)
check(len(w.museum) == 5 and w.revival["credits"]["B"]["museum"] == 5, "museum donations are credited")
for name in ("Mabel", "Pip", "Juniper"):
    w.befriend(a, name, 100)
check(w.measure("hearts1") == 3 and w.revival["credits"]["A"]["friends"] == 3, "hearts with villagers count and are credited")
check(tick() == [] and w.stage() == 0, "four threads: still Quiet")
for loc in ("town", "beach", "forest", "mountain"):
    w.travel(a, (loc, 5, 5, (0, 1)), now) if hasattr(w, "travel") else None
b["seen"] = ["town", "beach", "forest", "mountain"]
check(w.measure("places") >= 4, "places visited by anyone count")

# ---------------------------------------------------------------- five of six threads: Waking, with a ceremony
got = tick()
check(w.stage() == 1, "five of the six threads: the valley is Waking")
check(any("Waking" in t for t in got) and any("Mayor Hazel" in t for t in got), "the stage-up is announced with Mayor Hazel's speech")
check(w.revival["ups"][0][0] == 1, "the stage-up is dated")
check(tick() == [] and w.stage() == 1, "no second announcement")

# ---------------------------------------------------------------- the meter window and the Valley Book
w.out = []
w.apply("A", dict(t="revival"), now)
menu = [m[1] for m in w.out if m[1].get("menu") == "list"][0]
labels = [r.get("label") or r.get("section") for r in menu["rows"]]
check(menu["id"] == "revival" and any("Bustling" in (l or "") for l in labels), "the meter shows the next stage")
check(any(r.get("label", "").startswith("A") and r.get("right") for r in menu["rows"]), "the credits list farmers by name")
w.out = []
w.apply("A", dict(t="book"), now)
book = [m[1] for m in w.out if m[1].get("menu") == "list"][0]
check(book["id"] == "book" and book["rows"][0]["act"]["t"] == "revival", "K opens the Valley Book with the Revival first")
snap = w.snapshot(now)
check(snap["revival"]["stage"] == 1 and snap["revival"]["name"] == "Waking", "the snapshot carries the stage")

# ---------------------------------------------------------------- In Bloom needs all six
for st in (2, 3, 4):
    w.revival["stage"] = st - 1
    goals = RV.GOALS[st]
    check(RV.NEEDED[st] == (6 if st == 4 else 5), "stage %d needs %d threads" % (st, RV.NEEDED[st]))
w.revival["stage"] = 3
saved = dict(w.projects)
for key, *_ in __import__("valley.townhall", fromlist=["x"]).PROJECTS:
    w.projects[key] = dict(done=True, got={})
for i, k in enumerate(W.ITEMS):
    if len(w.museum) >= 50:
        break
    if __import__("valley.museum", fromlist=["x"]).category_of(k):
        w.museum[k] = "B"
for name in list(w.folk)[:15]:
    a.setdefault("friends", {})[name] = 450
for i in range(5):
    w.fest_scores["1:spring:%d" % i] = {"A": 10}
for k in list(W.CROPS)[:13]:
    w.revival["shipped"][k] = "A"
a["deepest"] = 15
tick()
check(w.stage() == 3, "In Bloom waits for the sixth thread (no voyage yet)")
w.stats["voyages"] = 1
tick()
check(w.stage() == 4 and w.revival_summary()["next"] is None, "all six threads: In Bloom")

# ---------------------------------------------------------------- saving and older farms
d = w.to_dict()
w2 = W.World.from_dict(d)
check(w2.stage() == 4 and w2.revival["shipped"] == w.revival["shipped"], "the stage and shipments survive a reload")
old = W.World()
old.join("C", now)
c = old.players["C"]
for k in ("quartz", "amethyst", "emerald", "ruby", "diamond", "gold_nugget"):
    old.museum[k] = "C"
c["friends"] = {"Mabel": 150, "Pip": 120, "Juniper": 300}
c["seen"] = ["town", "beach", "forest", "mountain", "mine1"]
c["stats"] = {"hearts": 4, "contributed": 2}
old.fest_scores["1:spring:6"] = {"C": 50}
for i, kind in enumerate(["turnip", "potato", "radish", "corn"]):
    old.tiles[(17 + i, 4)] = dict(soil=True, crop=dict(kind=kind, progress=0, planted=now, by="C", harvests=0))
od = old.to_dict()
del od["revival"]
w3 = W.World.from_dict(od)
check(w3.stage() == 1, "a farm from before the Revival starts at the stage it already earned")
check(not any("Revival" in e["text"] for e in w3.log[-3:]), "the catch-up stage-up is quiet")
cr = w3.revival["credits"].get("C", {})
check(cr.get("museum") == 6 and cr.get("friends") == 4 and cr.get("fest") == 1 and cr.get("town") == 2, "older farms credit what everyone already did")

print("\n%d failure(s)" % len(fails) if fails else "\nall good")
sys.exit(1 if fails else 0)
