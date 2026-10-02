"""Festivals with depth: the hunt, the valley quiz, carols, festival points for every event, the farm's shared score with
Bronze/Silver/Gold prizes, the day's champion and their hat, and villagers' festival lines.

    python3 tests/test_festivals.py          (no server needed: it drives a World directly)
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import world as W                      # noqa: E402
from valley import fairground as FG    # noqa: E402

fails = []


def check(ok, label):
    print(("OK   " if ok else "FAIL ") + label)
    if not ok:
        fails.append(label)


def at_hour(base, h):
    return base - base % W.SKY_DAY + ((h / 24 * W.SKY_DAY - 360 - W.SKY_SHIFT) % W.SKY_DAY)


def festival_world(day):
    w = W.World()
    w.coins = 1000
    now = at_hour(time.time(), 11)
    w.created = now - (day - 1) * W.DAY - 60       # spring, on the given day
    for n in ("A", "B"):
        w.join(n, now)
        w.players[n]["xp"] = 60 * 30 * 30
        w.players[n].update(loc="town", x=36, y=24)
    return w, now


def said(w):
    return " ".join(m[1].get("text", "") for m in w.out if m[1].get("t") == "msg")


w, now = festival_world(3)
a, b = w.players["A"], w.players["B"]
key = w.fest_key(now)
check(w.festival(now)[0] == "hoedown", "spring 3: the Hoedown")

# ---------------------------------------------------------------- the hunt
for i in range(40):
    w._tick_fair(now + i * 21)
check(len(w.hunt["items"]) == FG.HUNT_OUT and w.snapshot(now)["hunt"]["kind"] == "painted_egg", "painted eggs are hidden around town")
x, y = w.hunt["items"][0]
nb = next((x + dx, y + dy, -dx, -dy) for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)) if w.walkable(x + dx, y + dy, "town"))
a.update(x=nb[0], y=nb[1], facing=[nb[2], nb[3]])
w.out = []
w.apply("A", dict(t="interact"), now)
check(w.count(a, "painted_egg") == 1 and (x, y) not in w.hunt["items"] and w.points_of(key, "A") == FG.HUNT_PTS, "E on an egg: you find it and earn points")
check("Painted Egg" in said(w), "and you're told")
for i in range(FG.HUNT_MAX + 3):
    w.hunt["items"].append((a["x"], a["y"]))
    w.apply("A", dict(t="interact"), now)
check(w.points_of(key, "A") == FG.HUNT_PTS * FG.HUNT_MAX, "points stop after %d finds" % FG.HUNT_MAX)

# ---------------------------------------------------------------- the farm's score: Bronze
coins = w.coins
check(w.fest_day[key]["tier"] == 0 and w.farm_score(key) == 120, "120 points: no tier yet")
for q in w.quiz_questions(key, "B"):
    pass
w.out = []
w.apply("B", dict(t="quiz"), now)
m = [x[1] for x in w.out if x[1].get("menu") == "list"][0]
check(m["id"] == "quiz" and len(m["rows"]) == 3, "Mayor Hazel's quiz: a question and three answers")
qs = w.quiz_questions(key, "B")
w.apply("B", dict(t="quiz_answer", a=qs[0][1]), now)
w.apply("B", dict(t="quiz_answer", a="nobody"), now)
w.apply("B", dict(t="quiz_answer", a=qs[2][1]), now)
check(w.points_of(key, "B") == 2 * FG.QUIZ_PTS, "two right answers: 30 points")
check(w.fest_day[key]["tier"] == 1 and w.coins >= coins + 500, "150 points together: Bronze, 500g for the purse")
w.apply("B", dict(t="quiz_answer", a=qs[0][1]), now)
w.apply("B", dict(t="quiz"), now)
check(w.points_of(key, "B") == 2 * FG.QUIZ_PTS, "the quiz is once a festival")

# ---------------------------------------------------------------- events earn points (your best counts)
w._mg = None
a["_mg"] = ["dance", now]
w.apply("A", dict(t="minigame_done", game="dance", score=80), now)
before = w.points_of(key, "A")
a["_mg"] = ["dance", now]
w.apply("A", dict(t="minigame_done", game="dance", score=60), now)
check(w.points_of(key, "A") == before, "a worse dance doesn't add points")
a["_mg"] = ["dance", now]
w.apply("A", dict(t="minigame_done", game="dance", score=90), now)
check(w.points_of(key, "A") == before + 5, "a better dance adds the difference")

# ---------------------------------------------------------------- Silver and Gold
w.fest_award(a, "test", 400, now)
check(w.fest_day[key]["tier"] >= 2 and w.count(a, "maypole") == 1 and w.count(b, "maypole") == 1, "Silver: a Maypole for everyone who joined in")
w.join("C", now)
c = w.players["C"]
c.update(loc="town", x=30, y=24)
w.fest_award(c, "test", 5, now)
check(w.count(c, "maypole") == 1, "someone who joins in later still gets the Silver prize")
w.fest_award(b, "test", 400, now)
check(w.fest_day[key]["tier"] == 3 and w.count(a, "starfruit_seed") == 2 and w.count(c, "starfruit_seed") == 2, "Gold: rare seeds for everyone")

# ---------------------------------------------------------------- the festival window and the villagers
w.out = []
w.fest_menu(a, now)
rows = [x[1] for x in w.out if x[1].get("id") == "fest"][0]["rows"]
secs = [r.get("section") or "" for r in rows]
check(any("More to do" in s for s in secs) and any("farm's score" in s for s in secs), "the festival window: more to do, the farm's score")
check(any("Bunny Ears" in s for s in secs), "and what the champion wins")
juniper = w.folk["Juniper"]
juniper.update(loc="town", x=36, y=23)
a.update(x=36, y=24, facing=[0, -1])
lines = set()
for i in range(12):
    a.setdefault("met", {})["Juniper"] = -1
    w.out = []
    w.talk(a, "Juniper", juniper, now)
    lines.add(said(w))
check(any(any(l in t for l in FG.FEST_LINES["hoedown"]) for t in lines), "villagers have Hoedown lines")

# ---------------------------------------------------------------- the champion, at the end of the day
d = w.to_dict()
check(W.World.from_dict(d).fest_pts[key] == w.fest_pts[key], "festival points survive a reload")
later = now + W.DAY
w.out = []
w._tick_fair(later)
top = max(w.fest_pts[key], key=lambda n: sum(w.fest_pts[key][n].values()))
champ = w.players[top]
check("bunny" in champ["wardrobe"] and "champion of the Spring Hoedown" in said(w), "the day's top scorer is crowned and wins the Bunny Ears")
check(not w.snapshot(later)["hunt"], "the hunt is cleared after the festival")
w.out = []
w._tick_fair(later + 5)
check("champion" not in said(w), "crowned once")

# ---------------------------------------------------------------- carols at the Winter Feast
w2, now2 = festival_world(1)
w2.created -= (3 * 7) * W.DAY                       # winter
w2.created = now2 - 21 * W.DAY - 5 * W.DAY - 60     # winter 6
check(w2.festival(now2) and w2.festival(now2)[0] == "feast", "winter 6: the Winter Feast")
p2 = w2.players["A"]
w2.out = []
w2.apply("A", dict(t="carol"), now2)
check(w2.points_of(w2.fest_key(now2), "A") == 0, "no songs, no carols")
p2["songs"] = ["valley_waltz", "dusty_trail", "starfall"]
w2.apply("A", dict(t="carol"), now2)
check(w2.points_of(w2.fest_key(now2), "A") == 3 * FG.CAROL_PTS, "three songs: three carols' worth of points")
w2.apply("A", dict(t="carol"), now2)
check(w2.points_of(w2.fest_key(now2), "A") == 3 * FG.CAROL_PTS, "once a night")

print("\n%d failure(s)" % len(fails) if fails else "\nall good")
sys.exit(1 if fails else 0)
