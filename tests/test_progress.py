"""Levels unlock things, tree spots, villager quests (stories, deliveries, favors), the quest log, saving.

    python3 tests/test_progress.py          (no server needed: it drives a World directly)
"""
import os
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import world as W                      # noqa: E402
import areas as AR                     # noqa: E402
from valley import progress as PR      # noqa: E402
from valley import quests as Q         # noqa: E402

fails = []


def check(ok, label):
    print(("OK   " if ok else "FAIL ") + label)
    if not ok:
        fails.append(label)


def at_hour(base, h):
    """A time on the same sky day as base when the sky clock reads h o'clock."""
    return base - base % W.SKY_DAY + ((h / 24 * W.SKY_DAY - 360 - W.SKY_SHIFT) % W.SKY_DAY)


def msgs(out):
    return [m[1].get("text") or m[1].get("menu") or m[1].get("t") for m in out]


now = at_hour(time.time(), 11)
w = W.World()
w.coins = 100000
w.join("T", now)
p = w.players["T"]


def act(**m):
    return w.apply("T", m, now)


def set_level(lv):
    p["xp"] = 60 * lv * lv
    w._tick_progress(now)


def put(loc, x, y, facing=(0, 1)):
    p.update(loc=loc, x=x, y=y, facing=list(facing))


def hold(key):
    keys = [k for k, n in p["inventory"]]
    if key not in keys:
        w.give(p, key, 1)
        keys = [k for k, n in p["inventory"]]
    p["selected"] = keys.index(key)


def face_villager(name):
    """Walk the villagers to where they belong at this hour, then stand next to `name` facing them."""
    for i in range(400):
        w.fast(now - 240 + i * 0.6)
    n = w.folk[name]
    for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        put(n["loc"], n["x"] + dx, n["y"] + dy, (-dx, -dy))
        return n


# ---- levels unlock seeds, and leveling up is announced
check(PR.CROP_LEVEL["strawberry"] == 2, "strawberries need level 2")
out = act(t="buy", item="strawberry_seed", n=1) if any(s[0] == "strawberry_seed" for s in w.shop_stock(now)) else None
if out is not None:
    check(w.count(p, "strawberry_seed") == 0 and "level 2" in " ".join(msgs(out)), "level 0 can't buy strawberry seeds")
out = act(t="buy", item="turnip_seed", n=1)
check(w.count(p, "turnip_seed") >= 9, "anyone can buy turnip seeds")
w.out = []
set_level(2)
texts = msgs(w.out)
check(any("reached level 2" in t for t in texts), "level up is announced: %s" % texts[:1])
check(any(t.startswith("New for you") for t in texts), "level up lists what it opened")
check(w.private_player(p).get("next_unlock", "").startswith("Lv3"), "next unlock is shown: %s" % w.private_player(p).get("next_unlock"))

# ---- tree spots: only there, and only once you're the spot's level and the tree's level
w.give(p, "apple_sapling", 3)
hold("apple_sapling")
put("farm", 26, 17, (0, 1))
set_level(0)
p["lv_seen"] = 0
out = act(t="interact")
check("level 1" in " ".join(msgs(out)) and not w.tiles.get((26, 18), {}).get("tree"), "a level-1 spot is closed at level 0")
set_level(1)
out = act(t="interact")
check("level 2" in " ".join(msgs(out)) and not w.tiles.get((26, 18), {}).get("tree"), "apple trees need level 2")
set_level(2)
out = act(t="interact")
check(w.tiles.get((26, 18), {}).get("tree", {}).get("kind") == "apple", "planted an apple tree in the spot")
put("farm", 26, 21, (0, 1))
out = act(t="interact")
check("not" in " ".join(msgs(out)).lower() or "spot" in " ".join(msgs(out)).lower(), "the level-6 spot below is not tree-able at level 2... or not a spot")
put("farm", 20, 19, (0, 1))
out = act(t="interact")
check("tree spots" in " ".join(msgs(out)), "saplings won't go in just anywhere: %s" % msgs(out)[:1])

# ---- the mine: deeper floors wait for you
ladder = next(k for k, v in W.PORTALS.items() if k[0] == "mine1" and v[0] == "mine2")
put("mine1", ladder[1], ladder[2] + 1, (0, -1))
set_level(2)
out = act(t="move", dx=0, dy=-1)
check(p["loc"] == "mine1" and "level 4" in " ".join(msgs(out)), "mine level 2 is closed at level 2")
set_level(4)
put("mine1", ladder[1], ladder[2] + 1, (0, -1))
out = act(t="move", dx=0, dy=-1)
check(p["loc"] == "mine2", "mine level 2 opens at level 4")

# ---- recipes and dishes wait for you too
set_level(0)
w.give(p, "copper_ore", 5); w.give(p, "iron_ore", 5); w.give(p, "stone", 10)
w.tile((40, 12))["machine"] = dict(kind="craft_table", by="T", out=None, ready=None, inp=None)
put("farm", 40, 13, (0, -1))
out = act(t="craft", r="sprinkler")
check("level 3" in " ".join(msgs(out)) and not w.count(p, "sprinkler") > 1, "sprinklers need level 3 to craft")
w.out = []
w.craft_menu(p)
menu = [m[1] for m in w.out if m[1].get("menu") == "list"][-1]
check(any(r.get("right") == "Lv3" for r in menu["rows"]), "the crafting menu shows locked recipes with their level")

# ---- a story: Old Tomas asks for patience
set_level(3)
put("farm", 8, 8)
n = face_villager("Old Tomas")
out = act(t="interact")
qmenu = [m[1] for m in out if m[1].get("menu") == "list" and m[1].get("id") == "quest"]
check(bool(qmenu) and "Patience" in qmenu[0]["title"], "Old Tomas offers his first chapter: %s" % (qmenu[0]["title"] if qmenu else msgs(out)[:2]))
check(w.private_player(p)["quest_marks"].get("Old Tomas") == "!", "a ! over Old Tomas")
out = act(t="quest_accept", who="Old Tomas", kind="story")
check("s:Old Tomas:0" in p["quests"]["active"], "accepted: it's in the quest log")
coins0 = w.coins
for _ in range(5):
    w.bump(p, "fish")
check(w.private_player(p)["quest_marks"].get("Old Tomas") == "?", "a ? once you've done it")
face_villager("Old Tomas")
out = act(t="interact")
check(p["quests"]["story"].get("Old Tomas") == 1 and w.coins == coins0 + 150, "chapter done: +150g and the story moves on")
check(Q.Quests.story_offer(w, p, "Old Tomas") is None, "chapter 2 waits for 2 hearts")
p.setdefault("friends", {})["Old Tomas"] = 250
check(Q.Quests.story_offer(w, p, "Old Tomas") is not None, "...and opens with them")

# ---- a delivery: Pip's parcel for Granny Rose
face_villager("Pip")
out = act(t="interact")
act(t="quest_accept", who="Pip", kind="story")
check(w.count(p, "parcel") == 1, "Pip hands you a parcel")
face_villager("Granny Rose")
out = act(t="interact")
check(w.count(p, "parcel") == 0 and p["quests"]["story"].get("Pip") == 1, "delivered to Granny Rose: %s" % msgs(out)[:1])

# ---- a favor of the day
favors = w.favors_today(now)
check(len(favors) == Q.FAVORS_PER_DAY, "%d villagers have a favor today: %s" % (len(favors), list(favors)))
fetch = next(((name, f) for name, f in favors.items() if f["kind"] == "fetch" and not Q.Quests.story_offer(w, p, name)), None)
if fetch:
    name, f = fetch
    hold("hoe")                       # a farmer holding a giftable item who already chatted today would give it instead
    face_villager(name)
    out = act(t="interact")
    check(any(m[1].get("id") == "quest" for m in out), "%s asks a favor: %s" % (name, f["line"]))
    act(t="quest_accept", who=name, kind="favor")
    qid = "f:%d:%s" % (w.favor_day(now), name)
    check(qid in p["quests"]["active"], "favor accepted")
    w.give(p, f["item"], f["n"])
    coins0 = w.coins
    face_villager(name)
    out = act(t="interact")
    check(qid not in p["quests"]["active"] and w.coins > coins0, "favor done: +%dg" % (w.coins - coins0))
    check(Q.Quests.favor_offer(w, p, name, now) is None, "the same favor isn't offered twice")
w.out = []
act(t="quests")
log = [m[1] for m in w.out if m[1].get("id") == "quests"]
check(bool(log) and any(r.get("section") == "Stories" for r in log[0]["rows"]), "L opens the quest log")

# ---- saving keeps it all
path = os.path.join(tempfile.mkdtemp(), "w.json")
w.save(path)
w2 = W.World.load(path)
p2 = w2.players["T"]
check(p2["quests"]["story"] == p["quests"]["story"] and p2.get("lv_seen") == p.get("lv_seen"), "quests and levels survive a save")
check(w2.tiles.get((26, 18), {}).get("tree", {}).get("kind") == "apple", "the spot's tree survives a save")

print("\nFAILS: %d" % len(fails))
for f in fails:
    print("  - " + f)
sys.exit(1 if fails else 0)
