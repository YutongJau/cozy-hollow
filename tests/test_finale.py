"""The finale: reaching In Bloom starts the Valley Bloom Festival (everyone in the square, fireworks), raises the monument,
opens the credits, Mayor Hazel's one-of-a-kind gifts, and the valley's blessing on every crop. Then the farm goes on.

    python3 tests/test_finale.py          (no server needed: it drives a World directly)
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import areas as AR                     # noqa: E402
import world as W                      # noqa: E402
from valley import finale as FN        # noqa: E402
from valley import festivals as FE     # noqa: E402
from valley import museum as MU        # noqa: E402
from valley import townhall as TH      # noqa: E402

fails = []


def check(ok, label):
    print(("OK   " if ok else "FAIL ") + label)
    if not ok:
        fails.append(label)


def at_hour(base, h):
    return base - base % W.SKY_DAY + ((h / 24 * W.SKY_DAY - 360 - W.SKY_SHIFT) % W.SKY_DAY)


now = at_hour(time.time(), 10)
w = W.World()
w.join("A", now)
w.join("B", now)
a, b = w.players["A"], w.players["B"]
a["xp"] = b["xp"] = 60 * 30 * 30

# a valley that has done everything but the last goal, three stages already behind it
for s in (1, 2, 3):
    w.revival["stage"] = s
    w.revival["ups"].append([s, now - (4 - s) * 3600])
    w.stage_up(s, now - (4 - s) * 3600, quiet=True)
for key, *_ in TH.PROJECTS:
    w.projects[key] = dict(done=True, got={})
for k in [k for k in W.ITEMS if MU.category_of(k)][:50]:
    w.museum[k] = "B"
for name in list(w.folk)[:15]:
    a.setdefault("friends", {})[name] = 450
for i in range(5):
    w.fest_scores["1:spring:%d" % i] = {"A": 10, "B": 5}
for k in list(W.CROPS)[:13]:
    w.revival["shipped"][k] = "A" if len(k) % 2 else "B"
a["deepest"] = 15
w.credit(a, "town", 9)
w.credit(b, "museum", 50)
w.credit(a, "farm", 7)

check(w.stage() == 3 and w.terrain(*FN.MONUMENT[1:], loc="town") != "M", "before the finale: Thriving, no monument")
w.stats["voyages"] = 1
w._rev_check = 0
w.out = []
w._tick_revival(now)
check(w.stage() == 4, "the last thread done: In Bloom")
check(w.terrain(FN.MONUMENT[1], FN.MONUMENT[2], "town") == "M", "the monument rises in the south plaza")
check(w.bloom_on(now) and w.bloom_on(now + FN.BLOOM_FEST - 60) and not w.bloom_on(now + FN.BLOOM_FEST + 1), "the Bloom Festival lasts a day")
texts = " ".join(m[1].get("text", "") for m in w.out if m[1].get("t") == "msg")
check("Valley Bloom Festival begins" in texts, "the festival is announced")
credit_menus = [m for m in w.out if m[1].get("menu") == "list" and m[1].get("id") == "credits"]
check({m[0] for m in credit_menus} == {"A", "B"}, "everyone online sees the credits")
check(w.snapshot(now)["bloom"]["on"], "the snapshot says the festival is on (the clients set off fireworks)")

# ---------------------------------------------------------------- everyone in the square
spots = {}
for name in w.folk:
    s = w.wanted(name, now)
    if name not in ("Rowan", "Velvet"):
        spots[name] = s
check(spots["Mayor Hazel"] == FE.HOST_SPOT, "Mayor Hazel hosts")
check(spots["Coco"][0] == "town" and spots["Prospector Gus"][0] == "town" and spots["Wren"][0] == "town", "folk from the island, the gulch and the beach come too")
walk = AR.AREA_WALK
check(all(s[0] == "town" and AR.MAPS["town"][s[2]][s[1]] in walk for s in spots.values()), "every spot is somewhere to stand")
check(len(set(spots.values())) == len(spots), "nobody shares a spot")
late = at_hour(now, 23)
check(w.bloom_spot("Bram", late) is None, "they go home to bed at night")

# ---------------------------------------------------------------- Mayor Hazel's gifts
hz = w.folk["Mayor Hazel"]
hz.update(loc="town", x=36, y=23)
a.update(loc="town", x=36, y=24, facing=[0, -1])
w.out = []
w.apply("A", dict(t="interact"), now)
m = [x[1] for x in w.out if x[1].get("menu") == "list"]
check(m and m[0]["id"] == "bloom", "talking to Mayor Hazel opens the festival window")
w.apply("A", dict(t="bloom_claim"), now)
check("bloom" in a["wardrobe"] and a["hat"] == "bloom" and w.count(a, "valley_medal") == 1, "she gives you the Bloom Crown and the Valley Medal")
w.apply("A", dict(t="bloom_claim"), now)
check(w.count(a, "valley_medal") == 1, "only once")
w.out = []
w.apply("A", dict(t="interact"), now + FN.BLOOM_FEST + 10)
m = [x[1] for x in w.out if x[1].get("menu") == "list" and x[1].get("id") == "bloom"]
check(not m, "after the festival, with your gifts in hand, Hazel talks as usual")
w.out = []
w.apply("B", dict(t="bloom_claim"), now + FN.BLOOM_FEST + 10)
check(w.count(b, "valley_medal") == 1, "a farmer who missed the festival can still collect their gifts")

# ---------------------------------------------------------------- the monument, the credits, the book
a.update(loc="town", x=36, y=26, facing=[0, 1])
w.out = []
w.apply("A", dict(t="interact"), now)
m = [x[1] for x in w.out if x[1].get("menu") == "list"]
check(m and m[0]["id"] == "monument" and {"A", "B"} <= {r.get("label", "").replace(" (you)", "") for r in m[0]["rows"]}, "the monument lists every farmer")
w.out = []
w.apply("A", dict(t="credits"), now)
rows = [x[1] for x in w.out if x[1].get("id") == "credits"][0]["rows"]
labels = [r.get("label") or r.get("section") for r in rows]
check("Champions of each thread" in labels and "First to ship" in labels and "Thank you for playing" in labels, "the credits: farmers, champions, firsts, the story")
w.out = []
w.apply("A", dict(t="book"), now)
book = [x[1] for x in w.out if x[1].get("id") == "book"][0]
check(any(r.get("act", {}).get("t") == "credits" for r in book["rows"]), "the Valley Book links the credits")
check(not w.walkable(36, 27, "town") if hasattr(w, "walkable") else True, "the monument is solid")

# ---------------------------------------------------------------- the blessing, and the farm goes on
tile = dict(wet_until=0)
check(abs(w.growth_mult(tile, now) - FN.BLOOM_GROWTH) < 1e-9, "the valley's blessing: crops grow faster")
d = w.to_dict()
w2 = W.World.from_dict(d)
check(w2.stage() == 4 and w2.terrain(36, 27, "town") == "M" and "A" in w2.bloom["claimed"], "In Bloom, the monument and the gifts survive a reload")
w2._rev_check = 0
w2.out = []
w2._tick_revival(now + 100)
check(w2.stage() == 4 and not any("Bloom Festival begins" in (m[1].get("text") or "") for m in w2.out), "the finale happens once")

print("\n%d failure(s)" % len(fails) if fails else "\nall good")
sys.exit(1 if fails else 0)
