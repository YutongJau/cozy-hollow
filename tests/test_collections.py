"""Collections and achievements: the Valley Pantry's bundles and rooms (and their lasting perks), the collections page,
and achievements with their permanent rewards.

    python3 tests/test_collections.py          (no server needed: it drives a World directly)
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import world as W                      # noqa: E402
from valley import pantry as PT        # noqa: E402

fails = []


def check(ok, label):
    print(("OK   " if ok else "FAIL ") + label)
    if not ok:
        fails.append(label)


now = time.time()
w = W.World()
w.created = now - 60          # the farm began a minute ago, so the season and day never depend on the real time
w.coins = 1000
w.join("A", now)
w.join("B", now)
a, b = w.players["A"], w.players["B"]
a["xp"] = b["xp"] = 60 * 30 * 30


def menu():
    ms = [m[1] for m in w.out if m[1].get("menu") == "list"]
    return ms[-1] if ms else None


# ---------------------------------------------------------------- collections
w.give(a, "carp", 1)
check(w.collection.get("carp", [None])[0] == "A", "the first carp goes in the collections, found by A")
w.give(b, "carp", 1)
check(w.collection["carp"][0] == "A", "the first finder keeps the credit")
w.give(a, "turnip_seed", 3)
check("turnip_seed" not in w.collection, "seeds aren't collectibles")
w.out = []
w.apply("A", dict(t="collections"), now)
m = menu()
check(m["id"] == "collections" and any(r["label"].startswith("Fish") for r in m["rows"]), "the collections page lists each category")
w.out = []
w.apply("A", dict(t="collection", cat="Fish"), now)
rows = menu()["rows"]
check(any(r["label"] == "Carp" and "A" in r["info"] for r in rows) and any(r["label"] == "???" for r in rows), "a category shows what's found (and ??? for the rest)")

# ---------------------------------------------------------------- the Valley Pantry
a.update(loc="hall")
w.out = []
w.apply("A", dict(t="bundle", b="spring_basket"), now)
check("anything" in " ".join(m[1].get("text", "") for m in w.out), "nothing to give, nothing given")
for k in ("daffodil", "leek"):
    w.give(a, k, 1)
w.apply("A", dict(t="bundle", b="spring_basket"), now)
check(w.pantry["got"]["spring_basket"] == ["daffodil", "leek"] and not w.count(a, "daffodil"), "A puts in a daffodil and a leek")
b.update(loc="hall")
w.give(b, "morel", 1)
w.give(b, "dandelion", 1)
coins = w.coins
w.apply("B", dict(t="bundle", b="spring_basket"), now)
check("spring_basket" in w.pantry["done"] and w.coins == coins + 300 and w.count(b, "mushroom") == 3, "B finishes the Spring Basket: 300g and its prize")
check(w.count(b, "morel") == 1, "a full bundle takes no more than it needs")
check(set(w.pantry["by"]["spring_basket"]) == {"A", "B"}, "both are credited")
check(w.revival["credits"]["A"]["town"] == 2, "bundles count for the Revival")
check(w.forage_interval() == W.FORAGE_INTERVAL, "the Forager's Shelf isn't done yet")
for key in ("wild_basket", "seaside_basket"):
    room, bundle = PT.BUNDLES[key]
    for k, n in bundle[2]:
        w.give(a, k, n)
    w.apply("A", dict(t="bundle", b=key), now)
check(w.room_done("forager") and w.forage_interval() == W.FORAGE_INTERVAL / 2, "the Forager's Shelf is complete: wild things grow twice as often")
for key in ("spring_crates", "summer_crates", "cold_crates", "orchard_crate"):
    for k, n in PT.BUNDLES[key][1][2]:
        w.give(a, k, n)
    w.apply("A", dict(t="bundle", b=key), now)
check(w.room_done("farmer") and w.water_time() == W.WATER_DURATION * 1.5, "the Farmer's Crates: watered soil stays wet longer")
w.out = []
w.apply("A", dict(t="pantry"), now)
m = menu()
check(m["id"] == "pantry" and any("✓" in (r.get("section") or "") for r in m["rows"]), "the pantry window shows finished rooms")
a.update(loc="farm")
w.give(a, "carp", 1)
w.apply("A", dict(t="bundle", b="river_chest"), now)
check("river_chest" not in w.pantry["got"], "bundles are filled at the Town Hall")

# ---------------------------------------------------------------- achievements
a["online"] = True
check(w.max_hp(a) == W.MAX_HP, "before: 100 health")
a["stats"]["mined"] = 200
w._ach_check = 0
w.out = []
w._tick_collect(now)
check("rock_breaker" in a["achievements"] and w.max_hp(a) == W.MAX_HP + 25, "Rock Breaker: +25 maximum health")
check(any("Rock Breaker" in (m[1].get("text") or "") for m in w.out), "the achievement is announced")
check(w.private_player(a)["max_hp"] == W.MAX_HP + 25, "the clients see the bigger health bar")
a["stats"]["fish"] = 50
w._ach_check = 0
w._tick_collect(now)
check("angler" in a["wardrobe"], "Angler: the Angler's Cap")
a["stats"]["cooked"] = 25
w._ach_check = 0
w._tick_collect(now)
a["hp"] = 10
w.give(a, "omelette", 1)
heal = int((W.ITEMS["omelette"].get("hp") or 10) * 1.5)
w.apply("A", dict(t="eat", item="omelette"), now)
check(a["hp"] == 10 + heal, "Home Cook: food heals half as much again")
w.out = []
w.apply("A", dict(t="achievements"), now)
m = menu()
check(m["id"] == "achievements" and len(m["rows"]) == len(PT.ACHIEVEMENTS), "the achievements page lists them all, with progress")
w.out = []
w.apply("A", dict(t="book"), now)
labels = [r["label"] for r in menu()["rows"]]
check("The Valley Pantry" in labels and "Collections" in labels and "Achievements" in labels, "the Valley Book links them")
for name in list(w.folk)[:8]:
    b.setdefault("friends", {})[name] = 400
b["online"] = True
w._ach_check = 0
w._tick_collect(now)
before = 0
b["met"] = {}
nm = list(w.folk)[9]
w.befriend(b, nm, 0)
w.folk[nm].update(loc="town", x=10, y=10)
b.update(loc="town", x=10, y=11, facing=[0, -1])
w.talk(b, nm, w.folk[nm], now)
check(b["friends"][nm] == 30, "Friend to All: a chat earns half as much friendship again")

# ---------------------------------------------------------------- saving, and older farms
d = w.to_dict()
w2 = W.World.from_dict(d)
check(w2.pantry["rooms"] == w.pantry["rooms"] and "rock_breaker" in w2.players["A"]["achievements"] and w2.collection["carp"][0] == "A", "the pantry, achievements and collections survive a reload")
del d["collection"]
d["museum"] = {"ruby": "B"}
w3 = W.World.from_dict(d)
check(w3.collection.get("ruby", [None])[0] == "B", "an older farm's collections start with what it already had")

print("\n%d failure(s)" % len(fails) if fails else "\nall good")
sys.exit(1 if fails else 0)
