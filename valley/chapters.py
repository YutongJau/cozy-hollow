"""Yearly chapters and the scrapbook. Each in-game year (four seasons, about a real month) opens a chapter the whole
farm works on: Year One wakes the valley, Year Two relights Wren's lighthouse (and the beach gets night fishing), Year
Three builds Coco's resort on Palm Isle (guests, hammocks, tropical drinks), and every year after is a Year of Plenty.
A chapter stays open until it's done, so nobody is ever locked out. The scrapbook keeps the farm's story: firsts,
festival champions, records, stage-ups, weddings and chapters, each with its date and names."""
import random
import time

import world as W
from valley import revival as RV

# ------------------------------------------------------------------ the chapters
CHAPTERS = [
    dict(year=1, key="waking", title="Year One: The Valley Wakes", who="Mayor Hazel",
         story="Hollow Town has been quiet for years. Bring the Valley Revival to Bustling and the valley will remember this year.",
         goals=[("stage", 2)], coins=2000, done="The first chapter of the valley's new story is written."),
    dict(year=2, key="lighthouse", title="Year Two: The Lighthouse", who="Wren", where=("lighthouse", "beach"),
         story="Wren's lighthouse has been dark since the storm. Bring her what she needs at the lighthouse, and its beam will sweep the sea again.",
         goals=[("give", "stone", 80), ("give", "iron_ore", 20), ("give", "quartz", 10), ("give", "gold_ore", 5), ("coins", 3000)], coins=0,
         done="The lighthouse shines again! At night, glowfish rise to its light off Driftwood Beach."),
    dict(year=3, key="resort", title="Year Three: The Island Resort", who="Coco", where=("tiki", "island"),
         story="Coco dreams of a little resort on Palm Isle - hammocks, cold drinks and guests from over the sea. Build it with her (bring things to the tiki hut).",
         goals=[("give", "wood", 150), ("give", "stone", 60), ("give", "coconut", 20), ("give", "fabric", 10), ("coins", 10000)], coins=0,
         done="The Palm Resort is open! Guests pay the farm every day, and there are hammocks and tropical drinks for farmers too."),
]
PLENTY_EARN = 50000
PLENTY_GOLD = 2
PLENTY_COINS = 5000
RESORT = dict(kind="resort", label="PALM RESORT", x=39, y=15, w=9, h=5, keeper="Coco")
RESORT_GUESTS = (150, 350)
W._fish("glowfish", "Glowfish", 320, 2.0, 3)
W.ITEMS["glowfish"]["info"] = "It shines in the lighthouse's beam off Driftwood Beach, after dark."
W._item("coconut_cooler", "Coconut Cooler", "food", 90, "u", "u", "white", hp=25, buff="speed", info="A cold one from the Palm Resort.")
W._item("sunset_smoothie", "Sunset Smoothie", "food", 110, "u", "u", "magenta", hp=30, buff="luck", info="Mango and passionfruit at the Palm Resort.")
RESORT_DRINKS = [("coconut_cooler", 120), ("sunset_smoothie", 150)]
SCRAP_LIMIT = 500
FIRSTS = {"Crops": "first crop", "Fish": "first fish", "Bugs": "first bug", "Fossils and artifacts": "first fossil or artifact",
          "Minerals and gems": "first mineral", "Dishes": "first home-cooked dish", "Art": "first painting", "Artisan goods": "first artisan good"}
RARE = {"golden_koi", "sturgeon", "glowfish", "diamond", "prismatic_shard", "dino_skull", "mammoth_tusk", "golden_idol", "oak_seed", "willow_seed",
        "bonsai_seed", "crown"}
LEVELS = (10, 25, 50, 100, 250, 500, 1000)


def a_an(name):
    return ("an " if name[0].lower() in "aeiou" else "a ") + name


def plenty(year):
    return dict(year=year, key="plenty%d" % year, title="Year %d: A Year of Plenty" % year, who="Mayor Hazel",
                story="Another year in a living valley. Earn %dg for the farm this year and win Gold at %d festivals." % (PLENTY_EARN, PLENTY_GOLD),
                goals=[("year_earned", PLENTY_EARN), ("year_gold", PLENTY_GOLD)], coins=PLENTY_COINS, done="A year of plenty, well lived.")


class Chapters:
    def _init_chapters(self, now):
        self.chapters = getattr(self, "chapters", None) or dict(done={}, got={})
        self.scrapbook = getattr(self, "scrapbook", None) or []
        self.records = getattr(self, "records", None) or {}

    def _save_chapters(self, out):
        out["chapters"] = self.chapters
        out["scrapbook"] = self.scrapbook
        out["records"] = self.records

    def _load_chapters(self, d):
        self.chapters = d.get("chapters") or dict(done={}, got={})
        self.records = d.get("records") or {}
        if not d.get("scrapbook"):              # an older farm: start the scrapbook from what it remembers
            self.scrapbook = []
            self.scrap("%s was founded." % self.name, self.created, "arrival")
            for name, p in sorted(self.players.items(), key=lambda kv: kv[1].get("joined") or self.created):
                if p.get("joined"):
                    self.scrap("%s arrived in the valley." % name, p["joined"], "arrival")
            if self.milestones:
                self.scrap("Milestones from before the scrapbook: %s." % ", ".join(self.milestones), self.last_tick, "milestone")
            for e in self.log:
                text = e.get("text", "")
                if "arrived at the farm for the first time" in text:
                    if not any(x["text"] == text.split(" arrived")[0] + " arrived in the valley." for x in self.scrapbook):
                        self.scrap(text.split(" arrived")[0] + " arrived in the valley.", e["ts"], "arrival")
                elif text.startswith("Milestone unlocked: ") and not any(x["text"] == "Milestone: " + text[20:].rstrip("!") for x in self.scrapbook):
                    self.scrap("Milestone: " + text[len("Milestone unlocked: "):].rstrip("!"), e["ts"], "milestone")
                elif "got married" in text:
                    self.scrap(text, e["ts"], "wedding")
            self.scrapbook.sort(key=lambda e: e["t"])
        else:
            self.scrapbook = d["scrapbook"]
        if self.chapter_done("resort"):
            self.raise_resort()

    # ------------------------------------------------------------------ the scrapbook
    def scrap(self, text, now, kind="moment"):
        self.scrapbook.append(dict(t=now, text=text, kind=kind))
        del self.scrapbook[:-SCRAP_LIMIT]
        self.dirty = True

    def scrapbook_menu(self, p, now):
        rows = []
        season = None
        for e in reversed(self.scrapbook):
            label = "%s, year %d" % (self.season_at(e["t"]).capitalize(), self.year_at(e["t"]))
            if label != season:
                season = label
                rows.append(dict(section=label))
            rows.append(dict(label=e["text"], info="Day %d" % self.day_at(e["t"]), ok=False))
        if not rows:
            rows.append(dict(label="Nothing yet - the story starts now.", ok=False))
        self.list_menu(p, "scrapbook", "The Scrapbook", rows, sub="The farm's story: firsts, champions, records and big days, newest first.")

    def act_scrapbook(self, p, msg, now):
        self.scrapbook_menu(p, now)

    def farm_record(self, key, value, now, text):
        """A farm record: only a new best goes in the scrapbook."""
        if value > self.records.get(key, 0):
            self.records[key] = value
            self.scrap(text, now, "record")
            return True
        return False

    def scrap_found(self, p, key, category):
        """The first of a kind of thing, and rare finds, go in the scrapbook."""
        now = time.time()
        if category in FIRSTS and not self.records.get("first:" + category):
            self.records["first:" + category] = 1
            self.scrap("The farm's %s: %s found %s." % (FIRSTS[category], p["name"], a_an(W.ITEMS[key]["name"])), now, "first")
        if key in RARE:
            self.scrap("%s found %s!" % (p["name"], a_an(W.ITEMS[key]["name"])), now, "rare")

    def _join_chapters(self, p, now):
        if not any(e.get("kind") == "arrival" and e["text"].startswith(p["name"] + " arrived") for e in self.scrapbook[-200:]) and p.get("joined", now) >= now - 5:
            self.scrap("%s arrived in the valley." % p["name"], now, "arrival")

    def _tick_chapters(self, now):
        for p in self.players.values():
            lv = W.level_for(p.get("xp", 0))
            got = p.setdefault("lv_scrap", max([l for l in LEVELS if l <= lv] or [0]))
            nxt = max([l for l in LEVELS if l <= lv] or [0])
            if nxt > got:
                p["lv_scrap"] = nxt
                self.scrap("%s reached level %d." % (p["name"], nxt), now, "level")
        ch = self.current_chapter(now)
        if ch and self.chapter_met(ch, now):
            self.finish_chapter(ch, None, now)
        self.resort_guests(now)

    # ------------------------------------------------------------------ chapters
    def chapter_done(self, key):
        return key in self.chapters["done"]

    def chapter_list(self, now):
        year = max(1, self.year_at(now))
        return CHAPTERS + [plenty(y) for y in range(4, max(4, year) + 1)]

    def current_chapter(self, now):
        year = max(1, self.year_at(now))
        for ch in self.chapter_list(now):
            if ch["year"] <= year and not self.chapter_done(ch["key"]):
                return ch
        return None

    def goal_state(self, ch, goal, now):
        kind = goal[0]
        got = self.chapters["got"].get(ch["key"], {})
        if kind == "stage":
            return self.stage(), goal[1], "Bring the Valley Revival to %s" % RV.STAGES[goal[1]]
        if kind == "give":
            return got.get(goal[1], 0), goal[2], "%d %s" % (goal[2], W.ITEMS[goal[1]]["name"])
        if kind == "coins":
            return got.get("#coins", 0), goal[1], "%dg from the purse" % goal[1]
        if kind == "year_earned":
            y = str(ch["year"])
            earned = sum(v[0] for k, v in self.econ["days"].items() if k.split(":")[0] == y)
            return earned, goal[1], "Earn %dg this year" % goal[1]
        if kind == "year_gold":
            n = sum(1 for k, v in self.fest_day.items() if k.split(":")[0] == str(ch["year"]) and v.get("tier", 0) >= 3)
            return n, goal[1], "Win Gold at %d festivals this year" % goal[1]
        return 0, 1, "?"

    def chapter_met(self, ch, now):
        return all(h >= n for h, n, _ in (self.goal_state(ch, g, now) for g in ch["goals"]))

    def chapter_menu(self, p, now):
        ch = self.current_chapter(now)
        rows = []
        if ch:
            here = not ch.get("where") or p.get("loc") in ch["where"]
            rows.append(dict(section=ch["title"]))
            rows.append(dict(label=ch["story"], ok=False))
            for g in ch["goals"]:
                h, n, text = self.goal_state(ch, g, now)
                rows.append(dict(key=g[1] if g[0] == "give" else None, label=text + ("  ✓" if h >= n else ""), right="%d/%d" % (min(h, n), n), ok=False, dim=h < n))
            if any(g[0] in ("give", "coins") for g in ch["goals"]):
                rows.append(dict(label="Chip in", info="Give what you're carrying (and the coins, once the rest is in)." if here else
                                 "Bring things to %s (%s)." % (ch["who"], "the lighthouse" if ch["key"] == "lighthouse" else "the tiki hut on Palm Isle"),
                                 act=dict(t="chapter_give"), ok=here, right="Give"))
        else:
            nxt = next((c for c in self.chapter_list(now) + [plenty(self.year_at(now) + 1)] if not self.chapter_done(c["key"])), None)
            rows.append(dict(section="Every chapter so far is written"))
            if nxt:
                days = max(0, int((self.created + (nxt["year"] - 1) * 4 * W.SEASON_SECONDS - now) // W.DAY) + 1)
                rows.append(dict(label="Next: %s" % nxt["title"], info="Opens in year %d (in about %d day%s)." % (nxt["year"], days, "s" if days != 1 else ""), ok=False))
        done = [c for c in self.chapter_list(now) if self.chapter_done(c["key"])]
        if done:
            rows.append(dict(section="Chapters written"))
            for c in done:
                rows.append(dict(label=c["title"] + "  ✓", info=c["done"], ok=False))
        self.list_menu(p, "chapter", "The Year's Chapter", rows, sub="A goal for the whole farm each year. It stays open until it's done.", keep=True)

    def act_chapter(self, p, msg, now):
        self.chapter_menu(p, now)

    def act_chapter_give(self, p, msg, now):
        ch = self.current_chapter(now)
        if not ch or (ch.get("where") and p.get("loc") not in ch["where"]):
            return
        got = self.chapters["got"].setdefault(ch["key"], {})
        gave = []
        for g in ch["goals"]:
            if g[0] == "give":
                want = g[2] - got.get(g[1], 0)
                n = min(want, self.count(p, g[1]))
                if n > 0:
                    self.take(p, g[1], n)
                    got[g[1]] = got.get(g[1], 0) + n
                    gave.append("%d %s" % (n, W.ITEMS[g[1]]["name"]))
        items_in = all(got.get(g[1], 0) >= g[2] for g in ch["goals"] if g[0] == "give")
        for g in ch["goals"]:
            if g[0] == "coins" and items_in and got.get("#coins", 0) < g[1]:
                n = min(g[1] - got.get("#coins", 0), self.coins)
                if n > 0:
                    self.coins -= n
                    got["#coins"] = got.get("#coins", 0) + n
                    gave.append("%dg" % n)
        if not gave:
            return self.say(p, "%s: Nothing you're carrying is on my list just now." % ch["who"])
        self.credit(p, "town", len(gave))
        self.say(p, "You gave %s for %s." % (", ".join(gave), ch["title"].split(": ")[1]), "good")
        self.dirty = True
        if self.chapter_met(ch, now):
            self.finish_chapter(ch, p, now)
        self.chapter_menu(p, now)

    def finish_chapter(self, ch, p, now):
        self.chapters["done"][ch["key"]] = now
        if ch.get("coins"):
            self.coins += ch["coins"]
        if ch["key"] == "resort":
            self.raise_resort()
        self.event("%s is complete! %s%s" % (ch["title"], ch["done"], (" (+%dg for the purse)" % ch["coins"]) if ch.get("coins") else ""), now, "good")
        self.scrap("Chapter complete - %s." % ch["title"], now, "chapter")

    def _snap_chapters(self, snap, now):
        snap["chapters"] = dict(lighthouse=self.chapter_done("lighthouse"), resort=self.chapter_done("resort"))

    def _book_chapters(self, p, now):
        ch = self.current_chapter(now)
        return [dict(label="The Year's Chapter", info=ch["title"] if ch else "Every chapter so far is written", act=dict(t="chapter"), ok=True, right="Open"),
                dict(label="The Scrapbook", info="%d moments so far" % len(self.scrapbook), act=dict(t="scrapbook"), ok=True, right="Open")]

    # ------------------------------------------------------------------ the lighthouse and the resort
    def _fish_chapters(self, loc):
        if loc == "beach" and self.chapter_done("lighthouse"):
            h = self.sky_hour(time.time())
            if h >= 20 or h < 5:
                import areas as AR
                return list(AR.AREA_FISH.get("beach", [])) + ["glowfish", "glowfish"]
        return None

    def raise_resort(self):
        if not any(b.get("kind") == "resort" for b in self.xbuildings.get("island", [])):
            self.add_building("island", RESORT)
            dx, dy = RESORT["x"] + RESORT["w"] // 2, RESORT["y"] + RESORT["h"]
            if self.terrain(dx, dy, "island") not in ".,:":
                self.set_terrain("island", dx, dy, ".")

    def resort_guests(self, now):
        if not self.chapter_done("resort"):
            return
        day = int((now - self.created) // W.DAY)
        if self.chapters.get("guest_day") == day:
            return
        first = "guest_day" not in self.chapters
        self.chapters["guest_day"] = day
        if first:
            return
        n = random.randint(*RESORT_GUESTS)
        self.coins += n
        self.event("Guests at the Palm Resort paid %dg to the farm today." % n, now, "good")

    def _use_chapters(self, p, loc, fx, fy, now):
        ch = self.current_chapter(now)
        name, n = self.npc_at(loc, fx, fy)
        if ch and name == ch.get("who") and ch.get("where") and loc in ch["where"] and not self.chapter_done(ch["key"]):
            sel = self.selected_item(p)
            wanted = {g[1] for g in ch["goals"] if g[0] == "give"}
            holding_gift = sel and sel not in wanted and W.ITEMS[sel]["kind"] not in ("gear", "key", "weapon", "machine", "ammo", "treat") and sel not in W.TOOLS
            if p.get("met", {}).get(name) == self.day_key(now) and not holding_gift:   # say hello first; then Wren and Coco show you their list
                return self.chapter_menu(p, now) or True
        if loc == "island" and self.chapter_done("resort"):
            for b in self.xbuildings.get("island", []):
                if b.get("kind") == "resort" and b["x"] <= fx < b["x"] + b["w"] and b["y"] <= fy < b["y"] + b["h"]:
                    return self.resort_menu(p, now) or True
        return False

    def resort_menu(self, p, now):
        rested = p.get("hammock") == self.day_key(now)
        rows = [dict(label="Swing in a hammock", info="Full health and a lucky afternoon (once a day)." if not rested else "You've had your nap today.",
                     act=dict(t="hammock"), ok=not rested, right="Relax")]
        rows.append(dict(section="Tropical drinks"))
        for key, price in RESORT_DRINKS:
            rows.append(dict(key=key, label=W.ITEMS[key]["name"], info=W.ITEMS[key]["info"], right="%dg" % price, act=dict(t="resort_buy", item=key), ok=self.coins >= price))
        self.list_menu(p, "resort", "The Palm Resort", rows, sub="Coco: \"Welcome, welcome! Shoes off, worries off.\"", keep=True)

    def act_hammock(self, p, msg, now):
        if not self.chapter_done("resort") or p.get("loc") != "island" or p.get("hammock") == self.day_key(now):
            return
        p["hammock"] = self.day_key(now)
        p["hp"] = self.max_hp(p)
        from valley.crafting import BUFFS
        p.setdefault("buffs", {})["luck"] = now + BUFFS["luck"][1]
        self.say(p, "You sway in a hammock between two palms and doze off to the sound of the waves. (Full health, Lucky)", "good")
        self.resort_menu(p, now)

    def act_resort_buy(self, p, msg, now):
        price = dict(RESORT_DRINKS).get(msg.get("item"))
        if not price or not self.chapter_done("resort") or p.get("loc") != "island":
            return
        if self.coins < price:
            return self.say(p, "Not enough coins.", "warn")
        self.coins -= price
        self.give(p, msg["item"], 1)
        self.say(p, "Coco hands you a %s with a little umbrella in it." % W.ITEMS[msg["item"]]["name"], "good")
        self.resort_menu(p, now)
