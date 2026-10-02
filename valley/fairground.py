"""Festivals with depth. Every festival now has two or three things to do: its own event, a hunt for things hidden
around town (painted eggs, lucky horseshoes, lost rosettes, candy corn, lost mittens, glass ornaments), Mayor Hazel's
valley quiz, and at the Winter Feast, carols. Everything you do earns festival points; everyone's points add up to the
farm's score for the day, and Bronze, Silver and Gold bring prizes for everyone who joined in (coins, a decoration you
can only get at that festival, rare seeds). The day's champion takes home that festival's hat. Villagers have festival
lines of their own."""
import random

import areas as AR
import world as W
from valley import crafting as CR
from valley import festivals as FE

HUNT = {   # festival -> (item key, name, plural)
    "hoedown": ("painted_egg", "Painted Egg", "painted eggs"), "rodeo": ("lucky_horseshoe", "Lucky Horseshoe", "lucky horseshoes"),
    "fair": ("lost_rosette", "Lost Rosette", "lost rosettes"), "fallfest": ("candy_corn", "Candy Corn", "candy corn"),
    "derby": ("lost_mitten", "Lost Mitten", "lost mittens"), "feast": ("glass_ornament", "Glass Ornament", "glass ornaments"),
}
HUNT_OUT = 10              # hidden around town at any time
HUNT_MAX = 15              # finds that count for points, per farmer per festival
HUNT_PTS = 8
QUIZ_LEN = 3
QUIZ_PTS = 15
CAROL_PTS = 20
SWAP_PTS = 10
TIERS = [(150, "Bronze"), (400, "Silver"), (800, "Gold")]
# the champion's hat for each festival, and the decoration only that festival gives
CHAMPION_HAT = {"hoedown": "bunny", "rodeo": "champion", "fair": "rosette", "fallfest": "witch", "derby": "earmuffs", "feast": "holly"}
FEST_DECOR = {"hoedown": ("maypole", "Maypole"), "rodeo": ("wagon_wheel", "Wagon Wheel"), "fair": ("trophy_cup", "Trophy Cup"),
              "fallfest": ("jack_o_lantern", "Jack-o'-Lantern"), "derby": ("ice_swan", "Ice Swan"), "feast": ("festive_tree", "Festive Tree")}
CR.PRIZE_HATS.update({"bunny": "Bunny Ears", "rosette": "Rosette Hat", "earmuffs": "Earmuffs", "holly": "Holly Crown"})
for _f, (_k, _n, _pl) in HUNT.items():
    W._item(_k, _n, "prize", 15, "o", "o", "magenta", info="Found at the %s. Worth festival points (and a few coins)." % dict(FE.FESTIVALS.values())[_f])
for _f, (_k, _n) in FEST_DECOR.items():
    W._item(_k, _n, "machine", 400, "&", "&", "yellow", info="A decoration you can only win at the %s. Set it down on the farm." % dict(FE.FESTIVALS.values())[_f])
    CR.MACHINES[_k] = dict(decor=True)

FEST_LINES = {
    "hoedown": ["Grab a partner! Even if it's me!", "I've been practising my do-si-do all week.", "Have you found any painted eggs? Pip hid them everywhere.",
                "The fiddle's in tune and the sun is out. Perfect."],
    "rodeo": ["Old Thunder's in a mood today. Hold on tight!", "Yeehaw! Sorry. I always wanted to say that.", "Someone dropped lucky horseshoes all over town.",
              "My money's on you to beat the bull."],
    "fair": ["Those turnips over there are the size of my head!", "I think the judges are hungry. Bring them your best.",
             "Rosettes keep blowing off the stalls - keep an eye out.", "Best in show... a farmer can dream."],
    "fallfest": ["Apple bobbing! Don't get your hair wet... too late.", "Biggest pumpkin I ever saw was here, two years back.",
                 "Candy corn everywhere. Theo's been at it again.", "The leaves are perfect this year."],
    "derby": ["Brrr! Fish bite better when it's cold, they say.", "I lost my mittens again. Have you seen them?", "Three minutes. That's all you get. Go go go!",
              "Hot cocoa for everyone after the derby."],
    "feast": ["Happy Winter Feast! Did you bring something for the potluck?", "Sing us a carol! Go on.", "The glass ornaments came off the big tree in the wind - help us find them?",
              "This is my favourite night of the year."],
}
OWN_LINES = {
    ("Juniper", "feast"): "I baked four pies. FOUR. Please eat one.", ("Rusty", "rodeo"): "Rodeo day's the best day for business. Everyone's thirsty!",
    ("Old Tomas", "derby"): "Forty years I've fished this derby. Still not bored.", ("Professor Fern", "fair"): "I'm judging the odd vegetables. Strictly scientific.",
    ("Pip", "hoedown"): "I hid the eggs! I won't say where. ...Try the benches.", ("Theo", "fallfest"): "The candy corn wasn't me. Probably.",
    ("Mayor Hazel", None): "Welcome, welcome! Everyone's points count towards the farm's score today.",
}
PLACES = {"hall": "the Town Hall", "store": "the Mercantile", "saloon": "the saloon", "museum": "the museum", "clinic": "the clinic", "smith": "the smithy",
          "bakery": "the bakery", "post": "the post office", "carpenter": "the carpenter's shop", "fishshop": "the fish shop", "lighthouse": "the lighthouse",
          "cabin": "the ranger's cabin", "guild": "the Adventurers' Guild", "tiki": "the tiki stand", "assay": "the assay office", "wsaloon": "the Gilded Spur",
          "bank": "the bank", "sheriff": "the sheriff's office", "butcher": "the butcher's counter"}


class Fairground:
    def _init_fair(self, now):
        self.fest_pts = getattr(self, "fest_pts", None) or {}       # fest key -> {player: {activity: points}}
        self.fest_day = getattr(self, "fest_day", None) or {}       # fest key -> {tier, done}
        self.hunt = getattr(self, "hunt", None) or dict(key=None, items=[], found={})

    def _save_fair(self, out):
        out["fest_pts"] = self.fest_pts
        out["fest_day"] = self.fest_day
        out["hunt"] = self.hunt

    def _load_fair(self, d):
        self.fest_pts = d.get("fest_pts") or {}
        self.fest_day = d.get("fest_day") or {}
        self.hunt = d.get("hunt") or dict(key=None, items=[], found={})
        self.hunt["items"] = [tuple(i) for i in self.hunt.get("items", [])]

    # ------------------------------------------------------------------ points and the farm's score
    def points_of(self, key, name):
        return sum(self.fest_pts.get(key, {}).get(name, {}).values())

    def farm_score(self, key):
        return sum(sum(v.values()) for v in self.fest_pts.get(key, {}).values())

    def fest_award(self, p, activity, pts, now, best=True):
        """Festival points for p (for 'best' activities only the improvement on your best counts)."""
        f = self.festival(now)
        if not f or pts <= 0:
            return 0
        if self.perk(p, "party"):
            pts = int(round(pts * 1.1))
        key = self.fest_key(now)
        mine = self.fest_pts.setdefault(key, {}).setdefault(p["name"], {})
        new = not any(mine.values())
        before = mine.get(activity, 0)
        mine[activity] = max(before, pts) if best else before + pts
        gain = mine[activity] - before
        if gain <= 0:
            return 0
        day = self.fest_day.setdefault(key, dict(tier=0, done=False, kind=f[0]))
        score = self.farm_score(key)
        if new:
            self.tier_prizes(p, f[0], day["tier"], 1)          # a latecomer still gets the prizes the farm has already won
        while day["tier"] < len(TIERS) and score >= TIERS[day["tier"]][0]:
            day["tier"] += 1
            self.reach_tier(f, key, day["tier"], now)
        self.dirty = True
        return gain

    def tier_prizes(self, p, kind, tier, start):
        for t in range(start, tier + 1):
            if t == 2:
                self.give(p, FEST_DECOR[kind][0], 1)
            if t == 3:
                self.give(p, "starfruit_seed", 2)

    def reach_tier(self, f, key, tier, now):
        name = TIERS[tier - 1][1]
        prize = {1: "500g for the purse", 2: "a %s for everyone who joined in" % FEST_DECOR[f[0]][1], 3: "rare starfruit seeds for everyone who joined in"}[tier]
        if tier == 1:
            self.coins += 500
        for who in self.fest_pts.get(key, {}):
            q = self.players.get(who)
            if q:
                self.tier_prizes(q, f[0], tier, tier)
        self.event("The farm's %s score reached %s! (%d points) Prize: %s." % (f[1], name, self.farm_score(key), prize), now, "good")
        if tier == 3:
            self.scrap("The farm won Gold at the %s." % f[1], now, "festival")

    def _tick_fair(self, now):
        f = self.festival(now)
        key = self.fest_key(now) if f else None
        for k, day in self.fest_day.items():           # a festival day that has ended: crown its champion
            if k != key and not day.get("done"):
                day["done"] = True
                self.crown_champion(k, day, now)
        if f:
            self.stock_hunt(f, key, now)
        elif self.hunt.get("items"):
            self.hunt = dict(key=None, items=[], found={})
            self.dirty = True

    def crown_champion(self, key, day, now):
        pts = self.fest_pts.get(key, {})
        if not pts:
            return
        name = max(pts, key=lambda n: (sum(pts[n].values()), n))
        q = self.players.get(name)
        kind = day.get("kind")
        title = dict(FE.FESTIVALS.values()).get(kind, "festival")
        if not q or not kind:
            return
        hat = CHAMPION_HAT.get(kind)
        wardrobe = q.setdefault("wardrobe", ["cowboy", "none"])
        if hat and hat not in wardrobe:
            wardrobe.append(hat)
            prize = "the %s" % CR.PRIZE_HATS.get(hat, hat)
        else:
            self.coins += 1000
            prize = "1000g for the purse"
        self.event("%s is the champion of the %s with %d points! They win %s." % (name, title, sum(pts[name].values()), prize), now, "good")
        self.scrap("%s was the champion of the %s (%d points)." % (name, title, sum(pts[name].values())), now, "champion")

    # ------------------------------------------------------------------ the hunt
    def hunt_spots(self):
        rows = AR.MAPS["town"]
        return [(x, y) for y in range(13, 40) for x in range(2, 70) if rows[y][x] in ".=:" and (x * 7 + y * 3) % 5 == 0]

    def stock_hunt(self, f, key, now):
        h = self.hunt
        if h.get("key") != key:
            h.update(key=key, items=[], found={})
        if len(h["items"]) >= HUNT_OUT or now < h.get("next", 0):
            return
        h["next"] = now + 20
        rng = random.Random(int(now) ^ self.seed)
        taken = set(h["items"]) | {(n["x"], n["y"]) for n in self.folk.values() if n["loc"] == "town"}
        free = [s for s in self.hunt_spots() if s not in taken and self.walkable(s[0], s[1], "town")]
        if free:
            h["items"].append(rng.choice(free))
            self.dirty = True

    def _block_fair(self, loc, x, y):
        return False

    def _snap_fair(self, snap, now):
        f = self.festival(now)
        snap["hunt"] = dict(kind=HUNT[f[0]][0], at=[list(i) for i in self.hunt["items"]]) if f and self.hunt.get("items") else None

    def _use_fair(self, p, loc, fx, fy, now):
        f = self.festival(now)
        if not f or loc != "town":
            return False
        spots = {(fx, fy), (p["x"], p["y"])}
        hit = next((i for i in self.hunt["items"] if tuple(i) in spots), None)
        if not hit:
            return False
        self.hunt["items"].remove(hit)
        k, name, plural = HUNT[f[0]]
        found = self.hunt["found"][p["name"]] = self.hunt["found"].get(p["name"], 0) + 1
        self.give(p, k, 1)
        self.fx(p, "lift", k, hit)
        if found <= HUNT_MAX:
            self.fest_award(p, "hunt", HUNT_PTS, now, best=False)
        self.say(p, "You found a %s! (%d today%s)" % (name, found, "" if found <= HUNT_MAX else " - that's plenty for points, but keep them as keepsakes"), "good")
        return True

    # ------------------------------------------------------------------ Mayor Hazel's valley quiz
    def quiz_questions(self, key, name):
        rng = random.Random("%s:%s:%d" % (key, name, self.seed))
        folk = [n for n in self.folk if self.folk_def(n)]
        qs = []
        workers = [(n, self.folk_def(n)["work"]) for n in folk if self.folk_def(n).get("work") in PLACES]
        lovers = [(n, self.folk_def(n)["loves"]) for n in folk if self.folk_def(n).get("loves")]
        crops = [c for c in W.CROPS if len(W.CROPS[c]["seasons"]) == 1 and not W.CROPS[c]["always"]]
        for kind in rng.sample(["work", "love", "crop", "work", "love"], QUIZ_LEN):
            if kind == "work" and workers:
                n, wk = rng.choice(workers)
                wrong = rng.sample([m for m, w in workers if w != wk], 2)
                qs.append(("Who works at %s?" % PLACES[wk], n, [n] + wrong))
            elif kind == "love" and lovers:
                n, loves = rng.choice(lovers)
                right = next((k for k in loves if k in W.ITEMS), None)
                if not right:
                    continue
                others = [k for k in ("stone", "seaweed", "coal", "fiber", "old_boot", "dandelion", "turnip", "egg") if k not in loves and k in W.ITEMS]
                wrong = rng.sample(others, 2)
                qs.append(("Which of these does %s love?" % n, W.ITEMS[right]["name"], [W.ITEMS[right]["name"]] + [W.ITEMS[k]["name"] for k in wrong]))
            elif crops:
                c = rng.choice(crops)
                s = W.CROPS[c]["seasons"][0]
                wrong = rng.sample([x for x in W.SEASONS if x != s], 2)
                qs.append(("In which season does %s grow?" % W.ITEMS[c]["name"], s.capitalize(), [s.capitalize()] + [x.capitalize() for x in wrong]))
        for q in qs:
            rng.shuffle(q[2])
        return qs[:QUIZ_LEN]

    def act_quiz(self, p, msg, now):
        f = self.festival(now)
        if not f or p.get("loc") != "town":
            return
        key = self.fest_key(now)
        st = p.get("quiz") or {}
        if st.get("key") != key:
            st = p["quiz"] = dict(key=key, i=0, right=0)
        qs = self.quiz_questions(key, p["name"])
        if st["i"] >= len(qs):
            return self.say(p, "Mayor Hazel: You've done today's quiz - %d out of %d! Come back next festival." % (st["right"], len(qs)))
        text, right, opts = qs[st["i"]]
        rows = [dict(label=o, act=dict(t="quiz_answer", a=o), ok=True, right="This one") for o in opts]
        self.list_menu(p, "quiz", "The Valley Quiz (%d of %d)" % (st["i"] + 1, len(qs)), rows, sub="Mayor Hazel: \"%s\"" % text)

    def act_quiz_answer(self, p, msg, now):
        f = self.festival(now)
        st = p.get("quiz") or {}
        if not f or st.get("key") != self.fest_key(now):
            return
        qs = self.quiz_questions(st["key"], p["name"])
        if st["i"] >= len(qs):
            return
        text, right, opts = qs[st["i"]]
        st["i"] += 1
        if msg.get("a") == right:
            st["right"] += 1
            self.fest_award(p, "quiz", QUIZ_PTS, now, best=False)
            self.say(p, "Mayor Hazel: Correct! It's %s. (+%d points)" % (right, QUIZ_PTS), "good")
        else:
            self.say(p, "Mayor Hazel: Ooh, not quite - it's %s." % right, "warn")
        self.dirty = True
        if st["i"] < len(qs):
            return self.act_quiz(p, msg, now)
        self.say(p, "Mayor Hazel: That's the quiz! You got %d out of %d." % (st["right"], len(qs)), "good")
        self.fest_menu(p, now)

    # ------------------------------------------------------------------ carols at the Winter Feast
    def act_carol(self, p, msg, now):
        f = self.festival(now)
        if not f or f[0] != "feast" or p.get("loc") != "town":
            return
        songs = p.get("songs", [])
        if not songs:
            return self.say(p, "You don't know any songs yet - Rowan the bard teaches them on concert nights.", "warn")
        if p.get("caroled") == self.fest_key(now):
            return self.say(p, "You've sung your heart out already tonight.")
        p["caroled"] = self.fest_key(now)
        p["bubble"] = ["♪ " + dict(FE.SONGS)[songs[-1]] + " ♪", now + 8]
        gain = self.fest_award(p, "carols", min(100, CAROL_PTS * len(songs)), now)
        self.befriend_all(p, 15)
        self.event("%s sang %d carol%s in the square! (+%d points)" % (p["name"], len(songs), "s" if len(songs) > 1 else "", gain), now, "good")
        self.fest_menu(p, now)

    # ------------------------------------------------------------------ in the festival window, and in villagers' mouths
    def fair_rows(self, p, now):
        f = self.festival(now)
        key = self.fest_key(now)
        k, name, plural = HUNT[f[0]]
        found = self.hunt["found"].get(p["name"], 0)
        rows = [dict(section="More to do")]
        rows.append(dict(key=k, label="The hunt: find the %s" % plural, info="Hidden around town - walk up and press E. You've found %d (points for up to %d)." % (found, HUNT_MAX), ok=False))
        st = p.get("quiz") or {}
        done = st.get("key") == key and st.get("i", 0) >= QUIZ_LEN
        rows.append(dict(label="Mayor Hazel's valley quiz", info="%d questions about the valley, %d points each." % (QUIZ_LEN, QUIZ_PTS) if not done else "Done: %d of %d right." % (st["right"], QUIZ_LEN),
                         act=dict(t="quiz"), ok=not done, right="Play" if not done else "✓"))
        if f[0] == "feast":
            n = len(p.get("songs", []))
            rows.append(dict(label="Sing carols", info="Every song Rowan taught you is %d points (you know %d)." % (CAROL_PTS, n), act=dict(t="carol"),
                             ok=n > 0 and p.get("caroled") != key, right="Sing"))
        score, tier = self.farm_score(key), self.fest_day.get(key, {}).get("tier", 0)
        nxt = TIERS[tier] if tier < len(TIERS) else None
        rows.append(dict(section="The farm's score: %d%s" % (score, (" - " + TIERS[tier - 1][1]) if tier else "")))
        rows.append(dict(label=("Next: %s at %d points" % (nxt[1], nxt[0])) if nxt else "Gold! The best a farm can do.",
                         info="Bronze: 500g. Silver: a %s for everyone who joins in. Gold: rare seeds for everyone." % FEST_DECOR[f[0]][1], ok=False))
        rows.append(dict(section="Today's points (the top scorer at midnight wins the %s)" % CR.PRIZE_HATS.get(CHAMPION_HAT[f[0]], "hat")))
        pts = self.fest_pts.get(key, {})
        for who in sorted(pts, key=lambda n: -sum(pts[n].values()))[:6]:
            rows.append(dict(label=who + (" (you)" if who == p["name"] else ""), info=", ".join("%s %d" % (a, v) for a, v in pts[who].items()), right=str(sum(pts[who].values())), ok=False))
        if not pts:
            rows.append(dict(label="No points yet - be the first!", ok=False))
        return rows

    def fest_line(self, name, now):
        f = self.festival(now)
        if not f:
            return None
        own = OWN_LINES.get((name, f[0])) or OWN_LINES.get((name, None))
        if own and random.random() < 0.6:
            return own
        return random.choice(FEST_LINES[f[0]])

    # points for the festivals' own events (called from festivals.record)
    def event_points(self, p, kind, game, score, now):
        if kind == "derby":
            pts = score * 12
        elif game == "apples" or kind in ("hoedown", "rodeo"):
            pts = score // 2
        elif kind == "fair":
            pts = min(60, score // 4)
        elif kind == "fallfest":
            pts = score // 3
        else:
            pts = min(50, score // 8)
        return self.fest_award(p, game or kind, pts, now)
