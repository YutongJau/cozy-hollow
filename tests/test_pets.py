"""Rare pets: tiny-chance drops from everyday activities (RuneScape style), the pet collection, calling a pet to follow you
or sending it home, the clinic's dogs and cats joining the same family, and older saves keeping the pet they had.

    python3 tests/test_pets.py          (no server needed: it drives a World directly)
"""
import json
import os
import re
import sys
import tempfile
import time
import types

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import world as W                      # noqa: E402
from valley import pets as PT          # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
fails = []


def check(ok, label):
    print(("OK   " if ok else "FAIL ") + label)
    if not ok:
        fails.append(label)


def lucky(on=True):
    """Make every pet roll succeed (or fail), without touching anyone else's randomness."""
    PT.random = types.SimpleNamespace(random=(lambda: 0.0) if on else (lambda: 0.999999))


def msgs(kind=None, to=None):
    return [m for who, m in w.out if (kind is None or m.get("t") == kind) and (to is None or who == to)]


def menu():
    ms = [m for who, m in w.out if m.get("menu") == "list"]
    return ms[-1] if ms else None


now = time.time()
w = W.World()
w.coins = 5000
w.join("A", now)
w.join("B", now)
a, b = w.players["A"], w.players["B"]

# ---------------------------------------------------------------- every pet belongs to an activity that really happens
src = "".join(open(os.path.join(ROOT, f)).read() for f in ["world.py"] + ["valley/" + n for n in os.listdir(os.path.join(ROOT, "valley")) if n.endswith(".py")])
bumped = set(re.findall(r'bump\(p, "([a-z_]+)"', src)) | {"slimes", "bats", "crabs", "ghosts", "kings"}
dead = [k for k, spec in PT.PETS.items() if spec[2] not in bumped]
check(not dead, "every pet's activity is counted somewhere in the game (no pet nobody can get): %s" % (dead or "all %d" % len(PT.PETS)))
check(len(set(PT.BY_STAT)) == len(PT.PETS), "one pet per activity")
check(all(spec[3] >= 100 for spec in PT.PETS.values()), "every pet is rare (1 in 100 at the very least)")

# ---------------------------------------------------------------- the odds
a["xp"] = 0
check(abs(w.pet_odds(a, "otter") - PT.PETS["otter"][3]) < 1e-6, "a new farmer gets the base odds")
a["xp"] = 60 * 100 * 100
check(abs(w.pet_odds(a, "otter") - PT.PETS["otter"][3] / 2) < 1e-6, "by level 100 the odds are twice as good")
a["xp"] = 60 * 900 * 900
check(abs(w.pet_odds(a, "otter") - PT.PETS["otter"][3] / 2) < 1e-6, "and no better past that")
a["buffs"] = {"luck": now + 600}
lucky_odds = w.pet_odds(a, "otter", now)
a.pop("buffs")
check(abs(lucky_odds - PT.PETS["otter"][3] / 2 / PT.LUCK_BONUS) < 1e-6, "luck makes them better still")
a["xp"] = 0

# ---------------------------------------------------------------- nothing happens most of the time
lucky(False)
for _ in range(50):
    w.bump(a, "fish")
check(not a["pets"] and not a.get("pet"), "an unlucky roll finds nothing")

# ---------------------------------------------------------------- the first one follows you at once
lucky(True)
w.out = []
w.bump(a, "fish")
check("otter" in a["pets"] and (a.get("pet") or {}).get("kind") == "otter", "a lucky catch: the otter pup follows A")
check(a["pets"]["otter"]["kc"] == a["stats"]["fish"], "it remembers how many fish it took (%d)" % a["pets"]["otter"]["kc"])
ev = [m["text"] for m in msgs("msg", "all")]
check(any("Puddle the Otter Pup" in t and "fish caught" in t and "1 in" in t for t in ev), "the whole farm hears about it: %s" % (ev[-1] if ev else None))
check(any("first in the valley" in t for t in ev) and w.pet_firsts["otter"][0] == "A", "and that A found the valley's first")
drop = msgs("petdrop")
check(drop and drop[0]["kind"] == "otter" and drop[0]["sp"] == "Otter Pup" and drop[0]["follows"], "clients get a petdrop to celebrate")
check(any(e.get("kind") == "pet" and "Puddle" in e["text"] for e in w.scrapbook), "it goes in the scrapbook")
pet = a["pet"]
check((pet["x"], pet["y"]) != (a["x"], a["y"]) and pet["loc"] == a.get("loc", "farm"), "it appears beside A, not on top of them")

# ---------------------------------------------------------------- the next waits at home; a duplicate is just a cousin
w.out = []
w.bump(a, "mined")
check("golem" in a["pets"] and a["pet"]["kind"] == "otter", "a second pet waits at home; the otter keeps following")
w.out = []
w.bump(a, "fish")
check(len(a["pets"]) == 2 and any("cousin" in m["text"] for m in msgs("msg", "A")), "a duplicate otter is only a cousin")
check(not msgs("petdrop"), "and nobody else is told")
w.out = []
w.bump(b, "fish")
check("otter" in b["pets"] and not any("first in the valley" in m["text"] for m in msgs("msg", "all")), "B's otter isn't the valley's first")
lucky(False)

# ---------------------------------------------------------------- calling and sending home
a["pet"]["love"] = 37
w.out = []
w.apply("A", dict(t="chat", text="/petname Otto"), now)
check(a["pet"]["name"] == "Otto" and a["pets"]["otter"]["name"] == "Otto", "/petname renames the pet at your heels (and in the collection)")
w.apply("A", dict(t="pet_call", kind="golem"), now)
check(a["pet"]["kind"] == "golem" and a["pet"]["name"] == "Pebble", "calling the golem: Pebble follows now")
check(a["pets"]["otter"]["love"] == 37 and a["pets"]["otter"]["name"] == "Otto", "Otto goes home with his name and love")
w.apply("A", dict(t="pet_call", kind="otter"), now)
check(a["pet"]["kind"] == "otter" and a["pet"]["love"] == 37 and a["pet"]["name"] == "Otto", "and comes back just as he was")
w.apply("A", dict(t="pet_home"), now)
check(not a.get("pet"), "send home: nobody follows")
snap = w.snapshot(now)
check(not any(pt["owner"] == "A" for pt in snap["pets"]), "and the snapshot shows no pet for A")
w.apply("A", dict(t="pet_call", kind="otter"), now)
for junk in (dict(t="pet_call", kind="dragon"), dict(t="pet_call", kind=["otter"]), dict(t="pet_call"), dict(t="pet_call", kind=None), dict(t="pet_call", kind={"a": 1})):
    w.apply("B", junk, now)
check(b["pet"]["kind"] == "otter" and len(b["pets"]) == 1, "junk pet messages change nothing")
w.apply("B", dict(t="pet_call", kind="golem"), now)
check(b["pet"]["kind"] == "otter", "you can't call a pet you don't have")

# ---------------------------------------------------------------- the clinic's dogs and cats join the family
a["loc"] = "clinic"
w.out = []
w.apply("A", dict(t="adopt", kind="cat"), now)
check("cat" in a["pets"] and a["pet"]["kind"] == "otter", "adopting a cat while Otto follows: the cat settles in at home")
name = a["pets"]["cat"]["name"]
w.apply("A", dict(t="adopt", kind="cat"), now)
check(a["pets"]["cat"]["name"] == name and len([k for k in a["pets"] if k == "cat"]) == 1, "one cat is enough")
w.apply("A", dict(t="adopt", kind="dog"), now)
check("dog" in a["pets"], "a dog too")
a["loc"] = "farm"
w.out = []
w.apply("A", dict(t="pets"), now)
m = menu()
rows = m["rows"] if m else []
check(m and m["id"] == "pets", "P opens the pet window")
check(any(r.get("section") == "Following you" for r in rows) and any(r.get("section") == "Waiting at home" for r in rows), "it shows who follows and who's at home")
locked = [r for r in rows if r.get("shadow")]
check(len(locked) == len(PT.PETS) - 2 and all(r["label"] == "???" and "Your odds: 1 in" in r["info"] for r in locked), "pets not found yet are mysteries with a hint and your odds")
check("2 of %d" % len(PT.PETS) in m["sub"], "it counts rare pets found (not the adopted ones)")
calls = [r for r in rows if r.get("act", {}).get("t") == "pet_call"]
check({r["act"]["kind"] for r in calls} == {"golem", "cat", "dog"}, "every pet at home can be called")
w.out = []
w.apply("A", dict(t="book"), now)
check(any(r.get("act", {}).get("t") == "pets" for r in menu()["rows"]), "the Valley Book has a Your Pets page")
w.out = []
w.apply("B", dict(t="pets"), now)
golem_row = next(r for r in menu()["rows"] if r.get("pet") == "golem")
check("A found the first one" in golem_row["info"], "others can see who found the valley's first of each")
a["loc"] = "clinic"
w.out = []
w.keeper_counter(a, "clinic", "Doc Alder", now)
clinic = next((m for who, m in w.out if m.get("id") == "clinic"), None)
adopt_rows = [r for r in (clinic or {}).get("rows", []) if r.get("act", {}).get("t") == "adopt"]
check(len(adopt_rows) == 2 and not any(r["ok"] for r in adopt_rows), "the clinic knows A has a dog and a cat already")
a["loc"] = "farm"

# ---------------------------------------------------------------- petting a rare pet
w.apply("A", dict(t="pet_home"), now)          # (A's own otter would be standing in the same spot)
bp = b["pet"]
a["x"], a["y"], a["facing"] = bp["x"] - 1, bp["y"], [1, 0]
a["loc"] = bp["loc"]
w.out = []
w._use_animals(a, a["loc"], bp["x"], bp["y"], now)
said = [m["text"] for m in msgs("msg", "A")]
check(any("squeaks and rolls onto its back" in t and "B's otter pup" in t for t in said), "petting B's otter pup: %s" % (said[-1] if said else None))
w.apply("A", dict(t="pet_call", kind="otter"), now)

# ---------------------------------------------------------------- snapshots stay valid JSON
snap = w.snapshot(now)
json.dumps(snap, allow_nan=False)
ours = [pt for pt in snap["pets"] if pt["owner"] == "A"]
check(ours and ours[0]["sp"] == "Otter Pup" and ours[0]["name"] == "Otto", "the snapshot names the species for the clients")

# ---------------------------------------------------------------- save and load
fn = tempfile.mktemp(suffix=".json")
w.save(fn)
w2 = W.World.load(fn)
a2 = w2.players["A"]
check(set(a2["pets"]) == set(a["pets"]) and a2["pet"]["name"] == "Otto", "pets survive a save and load")
check(w2.pet_firsts.get("otter", [None])[0] == "A", "so does who found the valley's first")
os.remove(fn)

# ---------------------------------------------------------------- an older save: one pet, no collection
old = W.World()
old.join("Old", now)
o = old.players["Old"]
o["pet"] = dict(kind="dog", name="Rufus", loc="farm", x=o["x"], y=o["y"] + 1, f=[0, 1], love=12)
o.pop("pets", None)
fn = tempfile.mktemp(suffix=".json")
old.save(fn)
old2 = W.World.load(fn)
o2 = old2.players["Old"]
check(o2["pets"].get("dog", {}).get("name") == "Rufus" and o2["pet"]["name"] == "Rufus", "an old save keeps its dog, now in the collection")
old2.join("Old", now)
check(len(o2["pets"]) == 1, "and joining again doesn't add it twice")
os.remove(fn)

# ---------------------------------------------------------------- every activity can roll its pet
lucky(True)
c = W.World()
c.join("C", now)
cp = c.players["C"]
c.out = []
c.bump(cp, "harvested", 3)
check("sprout" in cp["pets"] and cp["pets"]["sprout"]["kc"] == 3, "harvesting 3 crops at once rolls once (kc 3)")
for stat, kind in PT.BY_STAT.items():
    cp.setdefault("pets", {}).pop(kind, None)
    c.bump(cp, stat)
    if kind not in cp["pets"]:
        check(False, "%s rolls the %s" % (stat, kind))
check(all(k in cp["pets"] for k in PT.PETS), "all %d pets can drop" % len(PT.PETS))
lucky(False)

# ---------------------------------------------------------------- the real odds, roughly: the rarest-but-one at level 0
import random as _r     # noqa: E402
PT.random = _r
rng = _r.Random(5)
odds = PT.PETS["starling"][3]
tries = odds * 400
hits = sum(1 for _ in range(tries) if rng.random() * c.pet_odds(dict(xp=0), "starling") < 1.0)
check(320 <= hits <= 480, "a 1 in %d pet drops about 400 times in %d tries (%d)" % (odds, tries, hits))

print("\n%d failure(s)" % len(fails) if fails else "\nall good")
sys.exit(1 if fails else 0)
