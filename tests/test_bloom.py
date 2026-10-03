"""The world reacts to the Valley Revival: the shuttered stall and Fennel's market, the dry fountain and the coin toss,
Sol's hot spring, the stage-up ceremony in the square, and older farms catching up.

    python3 tests/test_bloom.py          (no server needed: it drives a World directly)
"""
import os
import sys
import random
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import world as W                      # noqa: E402
from valley import bloom as BL         # noqa: E402
from valley import festivals as FE     # noqa: E402

fails = []


def check(ok, label):
    print(("OK   " if ok else "FAIL ") + label)
    if not ok:
        fails.append(label)


def at_hour(base, h):
    return base - base % W.SKY_DAY + ((h / 24 * W.SKY_DAY - 360 - W.SKY_SHIFT) % W.SKY_DAY)


random.seed(7)                # the same coin flips every run
now = at_hour(time.time(), 10)
w = W.World()
w.created = now - 60          # the farm began a minute ago: same season and day whatever the real time (10 o'clock can be earlier than now)
w.coins = 5000
w.join("T", now)
p = w.players["T"]
p["xp"] = 60 * 30 * 30


def act(**m):
    w.out = []
    w.apply("T", m, now)
    return w.out


def said(out):
    return " ".join(m[1].get("text", "") for m in out if m[1].get("t") == "msg")


def menu(out):
    ms = [m[1] for m in out if m[1].get("menu") == "list"]
    return ms[0] if ms else None


def face(loc, x, y, fx, fy):
    p.update(loc=loc, x=x, y=y, facing=[fx, fy])


def go_up(stage):
    while w.stage() < stage:
        s = w.stage() + 1
        w.revival["stage"] = s
        w.revival["ups"].append([s, now])
        w.stage_up(s, now)


# ---------------------------------------------------------------- Quiet: shuttered stall, dry fountain, no spring
face("town", 35, 26, 0, -1)
check("shuttered" in said(act(t="interact")), "Quiet: the market stall is shuttered")
check(menu(act(t="market_buy", item="tomato_seed")) is None and w.count(p, "tomato_seed") == 0, "Quiet: nothing to buy from the stall")
face("town", 36, 20, 0, -1)
check("dry" in said(act(t="interact")), "Quiet: the fountain is dry")
check(all(w.terrain(x, y, "mountain") != "j" for x, y in BL.SPRING), "Quiet: no hot spring yet")
check("Fennel" not in w.folk and "Sol" not in w.folk, "Quiet: Fennel and Sol haven't come back")

# ---------------------------------------------------------------- Waking: Fennel and her market, with a ceremony
go_up(1)
check("Fennel" in w.residents and "Fennel" in w.folk, "Waking: Fennel moves back")
check(w.ceremony and w.ceremony["stage"] == 1, "Waking: a ceremony starts")
check(w.ceremony_spot("Mayor Hazel", now) == FE.HOST_SPOT, "during the ceremony Mayor Hazel speaks in the square")
check(w.ceremony_spot("Bram", now) in FE.FEST_SPOTS, "townsfolk gather round")
check(w.ceremony_spot("Coco", now) is None, "folk who live far away stay home")
check(w.snapshot(now)["ceremony"]["name"] == "Waking", "the snapshot carries the ceremony")
cer, w.ceremony = w.ceremony, None
check(w.wanted("Fennel", now) == ("town", 35, 24), "on a working morning Fennel stands behind her stall")
w.ceremony = cer
face("town", 35, 26, 0, -1)
m = menu(act(t="interact"))
check(m and m["id"] == "market", "Waking: E on the stall opens Fennel's Market")
season = w.season_at(now)
nxt = W.SEASONS[(W.SEASONS.index(season) + 1) % 4]
seeds = [r["key"] for r in m["rows"] if r.get("key", "").endswith("_seed")]
check(seeds and all(nxt in W.CROPS[k[:-5]]["seasons"] and season not in W.CROPS[k[:-5]]["seasons"] for k in seeds), "she sells next season's seeds")
k = seeds[0]
coins = w.coins
act(t="market_buy", item=k)
check(w.count(p, k) == 1 and w.coins == coins - w.market_price(k[:-5]), "buying a seed from Fennel")
want = w.market_want(now)
check(want == w.market_want(now + 60) and want in W.CROPS, "she wants one crop all day")
w.give(p, want, 4)
coins = w.coins
act(t="market_sell")
check(w.count(p, want) == 0 and w.coins == coins + 8 * W.ITEMS[want]["sell"], "she pays double for today's crop")
check(want in w.revival["shipped"], "selling to Fennel ships the crop too")
face("farm", 10, 10, 0, 1)
w.give(p, want, 1)
act(t="market_sell")
check(w.count(p, want) == 1, "you have to be at the stall to sell to her")

# ---------------------------------------------------------------- Bustling: the fountain flows, a coin for luck
go_up(2)
face("town", 36, 20, 0, -1)
coins = w.coins
out = said(act(t="interact"))
check("Plink" in out and w.coins == coins - BL.COIN and w.has_buff(p, "luck", now), "Bustling: a coin in the fountain makes you lucky")
coins = w.coins
act(t="interact")
check(w.coins == coins, "one coin a day")

# ---------------------------------------------------------------- Thriving: Sol and the hot spring
go_up(3)
check(all(w.terrain(x, y, "mountain") == "j" for x, y in BL.SPRING), "Thriving: the hot spring is restored")
check("Sol" in w.folk and w.work_spot("Sol") == ("mountain", 50, 13), "Sol moves to the spring")
check(not w.walkable(47, 12, "mountain") if hasattr(w, "walkable") else True, "you can't walk on the water")
face("mountain", 47, 11, 0, 1)
p["hp"] = 10
out = said(act(t="interact"))
check(p["hp"] == W.MAX_HP and "hot spring" in out and w.has_buff(p, "speed", now), "a soak heals you fully and puts a spring in your step")
before = p["friends"].get("Sol", 0)
act(t="interact")
check(p["friends"].get("Sol", 0) == before, "Sol's friendship for a soak comes once a day")

# ---------------------------------------------------------------- the ceremony ends; saving; older farms
w._tick_bloom(now + BL.CEREMONY_SECONDS + 1)
check(w.ceremony is None and w.snapshot(now)["ceremony"] is None, "the ceremony ends")
d = w.to_dict()
w2 = W.World.from_dict(d)
check(all(w2.terrain(x, y, "mountain") == "j" for x, y in BL.SPRING) and "Sol" in w2.folk and "Fennel" in w2.folk, "the spring and the newcomers survive a reload")
d["revival"]["stage"] = 3
d["residents"] = []
for loc in list(d["edits"]):
    d["edits"][loc] = {k: v for k, v in d["edits"][loc].items() if v != "j"}
w3 = W.World.from_dict(d)
check("Sol" in w3.folk and "Fennel" in w3.folk and w3.terrain(46, 12, "mountain") == "j", "a farm already at a stage gets that stage's town on load")
check(w3.ceremony is None, "no ceremony on load")

print("\n%d failure(s)" % len(fails) if fails else "\nall good")
sys.exit(1 if fails else 0)
