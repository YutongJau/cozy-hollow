"""Yearly chapters and the scrapbook: Year One (the valley wakes), Year Two (the lighthouse and its glowfish), Year Three
(the Palm Resort: guests, hammocks, drinks), the Years of Plenty after that, and the scrapbook of the farm's story.

    python3 tests/test_chapters.py          (no server needed: it drives a World directly)
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import world as W                      # noqa: E402
from valley import chapters as CH      # noqa: E402

fails = []


def check(ok, label):
    print(("OK   " if ok else "FAIL ") + label)
    if not ok:
        fails.append(label)


def at_hour(base, h):
    return base - base % W.SKY_DAY + ((h / 24 * W.SKY_DAY - 360 - W.SKY_SHIFT) % W.SKY_DAY)


YEAR = 4 * W.SEASON_SECONDS
w = W.World()
now = at_hour(time.time() + 60, 11)
w.created = now - 100
w.coins = 1000
w.join("A", now)
a = w.players["A"]
a["xp"] = 60 * 30 * 30


def said():
    return " ".join(m[1].get("text", "") for m in w.out if m[1].get("t") == "msg")


def in_year(y):
    w.created = now - (y - 1) * YEAR - 100


# ---------------------------------------------------------------- Year One
check(w.current_chapter(now)["key"] == "waking", "Year One: The Valley Wakes")
w.out = []
w.apply("A", dict(t="chapter"), now)
m = [x[1] for x in w.out if x[1].get("menu") == "list"][0]
check(m["id"] == "chapter" and any("Bustling" in (r.get("label") or "") for r in m["rows"]), "the chapter window shows the goal")
w._tick_chapters(now)
check(not w.chapter_done("waking"), "not until the valley is Bustling")
w.revival["stage"] = 2
coins = w.coins
w.out = []
w._tick_chapters(now)
check(w.chapter_done("waking") and w.coins == coins + 2000 and "Year One" in said(), "Bustling: Year One is complete (+2000g)")
check(w.current_chapter(now) is None, "nothing more until Year Two")
w.out = []
w.apply("A", dict(t="chapter"), now)
m = [x[1] for x in w.out if x[1].get("menu") == "list"][0]
check(any("Year Two" in (r.get("label") or "") and "Opens in year 2" in (r.get("info") or "") for r in m["rows"]), "the window says when the next chapter opens")

# ---------------------------------------------------------------- Year Two: the lighthouse (done in Year Three: chapters stay open)
in_year(3)
check(w.current_chapter(now)["key"] == "lighthouse", "a chapter stays open after its year")
a.update(loc="farm")
w.give(a, "stone", 80)
w.out = []
w.apply("A", dict(t="chapter_give"), now)
check(w.count(a, "stone") == 80, "you bring things to the lighthouse, not anywhere")
a.update(loc="lighthouse")
w.apply("A", dict(t="chapter_give"), now)
check(w.chapters["got"]["lighthouse"]["stone"] == 80 and w.count(a, "stone") == 0, "stone for the lighthouse")
w.coins = 10000
w.apply("A", dict(t="chapter_give"), now)
check(w.chapters["got"]["lighthouse"].get("#coins", 0) == 0, "the coins go in last, once everything else is in")
for k, n in (("iron_ore", 20), ("quartz", 10), ("gold_ore", 5)):
    w.give(a, k, n)
w.out = []
w.apply("A", dict(t="chapter_give"), now)
check(w.chapter_done("lighthouse") and w.coins == 7000, "everything in, then 3000g: the lighthouse shines again")
check(w.snapshot(now)["chapters"]["lighthouse"], "the clients light the beam")
check("glowfish" in (w.fish_pool("beach") or []) if 20 <= w.sky_hour(time.time()) or w.sky_hour(time.time()) < 5 else "glowfish" not in (w.fish_pool("beach") or []), "glowfish off the beach at night only")

# ---------------------------------------------------------------- Year Three: the Palm Resort
check(w.current_chapter(now)["key"] == "resort", "Year Three: The Island Resort")
a.update(loc="tiki")
for k, n in (("wood", 150), ("stone", 60), ("coconut", 20), ("fabric", 10)):
    w.give(a, k, n)
w.coins = 20000
w.apply("A", dict(t="chapter_give"), now)
check(w.chapter_done("resort") and any(b["kind"] == "resort" for b in w.xbuildings.get("island", [])), "the Palm Resort is built on Palm Isle")
check(all(w.terrain(x, y, "island") == "@" for x in range(39, 48) for y in range(15, 20)), "its footprint is solid")
a.update(loc="island", x=43, y=20, facing=[0, -1])
w.out = []
w.apply("A", dict(t="interact"), now)
m = [x[1] for x in w.out if x[1].get("menu") == "list"]
check(m and m[0]["id"] == "resort", "E on the resort: hammocks and drinks")
a["hp"] = 5
w.apply("A", dict(t="hammock"), now)
check(a["hp"] == w.max_hp(a) and w.has_buff(a, "luck", now), "a hammock nap: full health and lucky")
w.apply("A", dict(t="resort_buy", item="coconut_cooler"), now)
check(w.count(a, "coconut_cooler") == 1, "a Coconut Cooler")
coins = w.coins
w._tick_chapters(now)
w._tick_chapters(now + W.DAY)
check(w.coins > coins, "guests pay the farm each day")
d = w.to_dict()
w2 = W.World.from_dict(d)
check(any(b["kind"] == "resort" for b in w2.xbuildings.get("island", [])) and w2.chapter_done("lighthouse"), "chapters and the resort survive a reload")

# ---------------------------------------------------------------- Year Four on: a Year of Plenty
in_year(4)
ch = w.current_chapter(now)
check(ch and ch["key"] == "plenty4", "Year Four: a Year of Plenty")
w.econ["days"]["4:spring:1"] = [CH.PLENTY_EARN, 0]
w.fest_day["4:spring:3"] = dict(tier=3, done=True, kind="hoedown")
w._tick_chapters(now)
check(not w.chapter_done("plenty4"), "earning is not enough: Gold at two festivals too")
w.fest_day["4:spring:6"] = dict(tier=3, done=True, kind="rodeo")
coins = w.coins
w._tick_chapters(now)
check(w.chapter_done("plenty4") and w.coins >= coins + CH.PLENTY_COINS, "a Year of Plenty, well lived (+5000g)")

# ---------------------------------------------------------------- the scrapbook
texts = [e["text"] for e in w.scrapbook]
check(any("A arrived in the valley" in t for t in texts), "the scrapbook: arrivals")
check(any("Chapter complete" in t and "Lighthouse" in t for t in texts), "chapters")
w.give(a, "sturgeon", 1)
check(any("first fish" in e["text"] for e in w.scrapbook) and any("found a Sturgeon" in e["text"] for e in w.scrapbook), "the farm's first fish, and rare finds")
w.revival["stage"] = 2
w.stage_up(3, now)
check(any(e["kind"] == "stage" and "Thriving" in e["text"] for e in w.scrapbook), "stage-ups")
w.farm_record("depth", 5, now, "Record: A reached floor 5 of the Depths.")
w.farm_record("depth", 4, now, "Record: should not appear")
check(any("floor 5" in e["text"] for e in w.scrapbook) and not any("should not" in e["text"] for e in w.scrapbook), "records only when they're beaten")
w.out = []
w.apply("A", dict(t="scrapbook"), now)
m = [x[1] for x in w.out if x[1].get("id") == "scrapbook"][0]
check(m["rows"][0].get("section") and "year" in m["rows"][0]["section"], "the scrapbook window, by season, newest first")
w.out = []
w.apply("A", dict(t="book"), now)
labels = [r["label"] for r in [x[1] for x in w.out if x[1].get("id") == "book"][0]["rows"]]
check("The Year's Chapter" in labels and "The Scrapbook" in labels, "the Valley Book links the chapter and the scrapbook")
old = w.to_dict()
del old["scrapbook"]
old["log"] = [dict(ts=now - 500, text="Bo arrived at the farm for the first time! Welcome!"), dict(ts=now - 400, text="Milestone unlocked: First Harvest!"),
              dict(ts=now - 300, text="Bo and Cy got married by the barn! Congratulations!")]
w3 = W.World.from_dict(old)
t3 = [e["text"] for e in w3.scrapbook]
check("Bo arrived in the valley." in t3 and "Milestone: First Harvest" in t3 and any("married" in t for t in t3), "an older farm's scrapbook starts from its log")

print("\n%d failure(s)" % len(fails) if fails else "\nall good")
sys.exit(1 if fails else 0)
