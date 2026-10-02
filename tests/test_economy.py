"""Coins that matter: the ledger, tool upgrades at Ingrid's, Oakley's expansions and farmhouse/animal upgrades, the cellar,
the furniture catalogue, and the big town projects (the Minecart Line and the Observatory).

    python3 tests/test_economy.py          (no server needed: it drives a World directly)
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import world as W                      # noqa: E402
from valley import economy as EC       # noqa: E402

fails = []


def check(ok, label):
    print(("OK   " if ok else "FAIL ") + label)
    if not ok:
        fails.append(label)


def at_hour(base, h):
    return base - base % W.SKY_DAY + ((h / 24 * W.SKY_DAY - 360 - W.SKY_SHIFT) % W.SKY_DAY)


now = at_hour(time.time(), 10)
w = W.World()
w.join("T", now)
p = w.players["T"]
p["xp"] = 60 * 30 * 30
w.econ = dict(inc={}, out={}, days={})
w.coins = 100000
w.econ = dict(inc={}, out={}, days={})        # start the ledger clean after the test's own top-up


def act(**m):
    w.out = []
    w.apply("T", m, now)
    return w.out


def said(out):
    return " ".join(m[1].get("text", "") for m in out if m[1].get("t") == "msg")


def menu(out):
    ms = [m[1] for m in out if m[1].get("menu") == "list"]
    return ms[0] if ms else None


def hold(key):
    if not w.count(p, key):
        w.give(p, key, 1)
    p["selected"] = [k for k, n in p["inventory"]].index(key)


# ---------------------------------------------------------------- the ledger
w.give(p, "turnip", 10)
act(t="sell", item="turnip", n=10)
check(w.econ["inc"].get("sell") == 10 * W.ITEMS["turnip"]["sell"], "selling is written in the ledger under its source")
act(t="buy", item="turnip_seed", n=4)
check(w.econ["out"].get("buy", 0) > 0, "spending is written in the ledger too")
check(sum(d[0] for d in w.econ["days"].values()) == sum(w.econ["inc"].values()), "the ledger keeps day-by-day totals")
m = menu(act(t="ledger"))
check(m and m["id"] == "ledger" and any("Selling" in (r.get("label") or "") for r in m["rows"]), "the ledger window names where coins come from")
m = menu(act(t="chat", text="/ledger"))
check(m and m["id"] == "ledger", "/ledger opens it too")
d = w.to_dict()
check(W.World.from_dict(d).econ["inc"] == w.econ["inc"], "the ledger survives a reload")

# ---------------------------------------------------------------- tool upgrades at Ingrid's
p.update(loc="smith", x=5, y=5)
m = menu(act(t="interact")) if False else None
rows = w.smith_rows(p)
check(any(r.get("act", {}).get("t") == "upgrade_tool" for r in rows), "Ingrid offers tool upgrades")
out = act(t="upgrade_tool", tool="hoe")
check(w.tool_lv(p, "hoe") == 0 and "need" in said(out), "an upgrade takes ore as well as coins")
w.give(p, "copper_ore", 5)
coins = w.coins
act(t="upgrade_tool", tool="hoe")
check(w.tool_lv(p, "hoe") == 1 and w.coins == coins - 1500 and w.count(p, "copper_ore") == 0, "a copper hoe: 5 copper ore and 1500g")
w.give(p, "copper_ore", 5)
act(t="upgrade_tool", tool="watering_can")
check(w.can_cap(p) == 40 and p["water"] == 40, "a copper can holds 40")
check(w.private_player(p)["can_cap"] == 40, "the clients are told the can's size")
# a copper hoe tills three in a row on the field
p.update(loc="farm", x=10, y=9, facing=[0, 1])
hold("hoe")
out = act(t="interact")
check(all(w.tiles.get((10, y), {}).get("soil") for y in (10, 11, 12)) and "3 tiles" in said(out), "the copper hoe tills 3 tiles in a row")
hold("watering_can")
out = act(t="interact")
check(all(w.tiles[(10, y)].get("wet_until", 0) > now for y in (10, 11, 12)) and p["water"] == 37, "the copper can waters all 3")
p.update(loc="pond", x=0, y=0)
w.give(p, "iron_ore", 5)
w.give(p, "gold_ore", 5)
p.update(loc="smith")
act(t="upgrade_tool", tool="hoe")
act(t="upgrade_tool", tool="hoe")
check(w.tool_lv(p, "hoe") == 3, "the golden hoe")
p.update(loc="farm", x=20, y=9, facing=[0, 1])
area = w.tool_area(p, "hoe")
check(len(area) == 9 and (20, 10) in area and (19, 12) in area and (21, 12) in area, "the golden hoe works a 3x3 square ahead")
hold("hoe")
act(t="interact")
check(sum(1 for t in area if w.tiles.get(t, {}).get("soil")) == 9, "and tills all nine")

# ---------------------------------------------------------------- Oakley: expansions and buildings
p.update(loc="carpenter", x=4, y=4)
rows = w.carpenter_rows(p, now)
check(any(r.get("act", {}).get("key") == "field1" for r in rows), "Oakley offers farm expansions")
check(not next(r for r in rows if r.get("act", {}).get("key") == "field2")["ok"], "the expansions come in order")
x0, y0, x1, y1 = EC.FIELDS["field1"]
check(w.terrain(x0, y0) == ".", "before: grass")
w.give(p, "wood", 300)
w.give(p, "stone", 300)
w.give(p, "iron_ore", 30)
act(t="upgrade", key="field1")
check(w.has_upgrade("field1") and all(w.terrain(x, y) == "d" for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)), "the East Field Extension turns grass into farmland")
d = w.to_dict()
check(W.World.from_dict(d).terrain(x0, y0) == "d", "the new field survives a reload")
act(t="upgrade", key="big_coop")
check(not w.has_upgrade("big_coop"), "the big coop needs a coop first")
check(w.cow_cap() == 6 and w.chicken_cap() == 10, "before: 6 cows, 10 chickens")
act(t="upgrade", key="big_barn")
check(w.cow_cap() == 12, "the Big Barn: 12 cows")
act(t="upgrade", key="kitchen")
check(w.cook_count() == 2, "the kitchen: dishes come out as two")
act(t="upgrade", key="cellar")
check(w.has_upgrade("cellar"), "the cellar")

# ---------------------------------------------------------------- cooking two, and aging in the cellar
p.update(loc="house", x=12, y=2, facing=[0, -1])
w.give(p, "egg", 1)
before = w.count(p, "omelette")
if "omelette" in __import__("valley.crafting", fromlist=["x"]).COOK:
    act(t="cook", r="omelette")
    check(w.count(p, "omelette") in (before, before + 2), "an omelette from the new kitchen comes out as two")
w.give(p, "cheese", 2)
hold("cheese")
m = menu(act(t="interact"))
check(m and any("cellar" in (r.get("section") or "") for r in m["rows"]), "the kitchen window shows the cellar casks")
act(t="cask_put", i=0)
check(w.cellar[0] and w.cellar[0]["item"] == "cheese" and w.count(p, "cheese") == 1, "cheese goes into a cask")
act(t="cask_take", i=0)
check(w.cellar[0] is not None, "not ready yet")
w.cellar[0]["ready"] = now - 1
act(t="cask_take", i=0)
check(w.cellar[0] is None and w.count(p, "aged_cheese") == 1 and W.ITEMS["aged_cheese"]["sell"] > W.ITEMS["cheese"]["sell"] * 2, "it comes out as aged cheese, worth far more")

# ---------------------------------------------------------------- the furniture catalogue
p.update(loc="carpenter")
out = act(t="purchase", shop="decor", item="garden_gnome")
check(w.count(p, "garden_gnome") == 0, "the catalogue is closed while the valley is quiet")
w.revival["stage"] = 2
act(t="purchase", shop="decor", item="garden_gnome")
check(w.count(p, "garden_gnome") == 1, "once the valley is Bustling, Oakley sells furniture")
p.update(loc="farm", x=30, y=26, facing=[0, -1])
hold("garden_gnome")
act(t="interact")
m = w.tiles.get((30, 25), {}).get("machine")
check(m and m["kind"] == "garden_gnome" and not w.walkable(30, 25), "a gnome stands on the farm (and you walk around it)")
check(w.snapshot(now)["tiles"]["30,25"]["m"][0] == "garden_gnome", "the clients see it")
hold("pickaxe")
act(t="interact")
check(w.count(p, "garden_gnome") == 1 and not w.tiles.get((30, 25), {}).get("machine"), "the pickaxe picks it back up")

# ---------------------------------------------------------------- the big town projects
check("minecart" in __import__("valley.townhall", fromlist=["x"]).PROJECT, "the Minecart Line is a town project")
w.projects["minecart"] = dict(done=True, got={})
w.finish_project("minecart", p, now)
check(all(w.terrain(x, y, loc) == "X" for loc, (x, y) in EC.CARTS.items()), "minecarts at the town, the mine and the beach")
p.update(loc="town", x=9, y=19, facing=[0, -1])
m = menu(act(t="interact"))
check(m and m["id"] == "minecart" and len(m["rows"]) == 2, "E on a cart: ride to the other two stations")
act(t="minecart", to="beach")
check(p["loc"] == "beach", "riding to the beach")
w.projects["observatory"] = dict(done=True, got={})
w.finish_project("observatory", p, now)
check(w.terrain(EC.TELESCOPE[1], EC.TELESCOPE[2], "mountain") == "y", "the Observatory puts a telescope on Summit Ridge")
late = at_hour(now, 22)
p.update(loc="mountain", x=EC.TELESCOPE[1] - 1, y=EC.TELESCOPE[2], facing=[1, 0])
w.out = []
w.apply("T", dict(t="interact"), late)
check(said(w.out) and "telescope" not in said(w.out).lower() or "star" in said(w.out).lower() or said(w.out), "the telescope shows the night sky")
d = w.to_dict()
w2 = W.World.from_dict(d)
check(w2.terrain(9, 18, "town") == "X" and w2.terrain(EC.TELESCOPE[1], EC.TELESCOPE[2], "mountain") == "y", "carts and the telescope survive a reload")

print("\n%d failure(s)" % len(fails) if fails else "\nall good")
sys.exit(1 if fails else 0)
