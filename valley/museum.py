"""Collecting: bugs to catch with a net, dig spots full of fossils and old things, paintings from a travelling art dealer
(some of them forgeries!), and Professor Fern's museum that wants one of everything."""
import random

import areas as AR
import world as W

MIN = W.MINUTE

# ----------------------------------------------------------------------------- bugs: key, name, sell, seasons, when, where, ground, weight
BUGS = [
    ("cabbage_white", "Cabbage White", 30, ["spring", "summer"], "day", ["farm", "town", "forest", "mountain"], ".", 30),
    ("monarch", "Monarch Butterfly", 90, ["summer", "fall"], "day", ["farm", "town", "forest", "mountain"], ".", 14),
    ("swallowtail", "Swallowtail", 120, ["spring", "summer"], "day", ["forest", "mountain", "island"], ".", 10),
    ("bumblebee", "Bumblebee", 60, ["spring", "summer"], "day", ["farm", "town", "mountain"], ".", 18),
    ("ladybug", "Ladybug", 50, ["spring", "summer", "fall"], "day", ["farm", "town", "forest"], ".", 20),
    ("dragonfly", "Dragonfly", 110, ["summer", "fall"], "day", ["farm", "town", "forest", "mountain"], "~", 14),
    ("firefly", "Firefly", 140, ["summer"], "night", ["farm", "town", "forest"], ".", 16),
    ("cicada", "Cicada", 100, ["summer"], "day", ["forest", "town", "farm"], ".", 14),
    ("stag_beetle", "Stag Beetle", 300, ["summer"], "night", ["forest"], ".", 5),
    ("cricket", "Cricket", 70, ["fall"], "night", ["farm", "town", "forest", "mountain"], ".", 18),
    ("grasshopper", "Grasshopper", 60, ["summer", "fall"], "day", ["farm", "town", "mountain", "frontier"], ".z", 18),
    ("luna_moth", "Luna Moth", 220, ["spring", "summer", "fall"], "night", ["forest", "mountain"], ".", 7),
    ("snow_flea", "Snow Flea", 120, ["winter"], "any", ["farm", "town", "forest", "mountain"], ".", 16),
    ("scorpion", "Scorpion", 400, W.SEASONS, "night", ["frontier"], "z", 8),
    ("tarantula", "Tarantula", 500, ["summer", "fall"], "night", ["frontier", "island"], "z.", 5),
    ("hermit_crab", "Hermit Crab", 150, W.SEASONS, "any", ["beach", "island"], ",", 14),
    ("rainbow_beetle", "Rainbow Beetle", 800, ["spring", "summer", "fall"], "day", ["island"], ".", 4),
    ("cave_cricket", "Cave Cricket", 160, W.SEASONS, "any", ["mine1", "mine2", "mine3"], "v", 12),
]
BUG = {b[0]: b for b in BUGS}
for _b in BUGS:
    W._item(_b[0], _b[1], "bug", _b[2], "¤", "*", "green")
BUG_LIFE = 6 * MIN
BUG_MAX = 4

# ----------------------------------------------------------------------------- fossils and artifacts: key, name, kind, sell
DIGS = [
    ("ammonite", "Ammonite", "fossil", 150), ("trilobite", "Trilobite", "fossil", 140), ("fern_fossil", "Fern Fossil", "fossil", 110),
    ("amber", "Amber", "fossil", 200), ("dino_tooth", "Dino Tooth", "fossil", 260), ("fossil_fish", "Fossil Fish", "fossil", 180),
    ("dino_skull", "Dino Skull", "fossil", 900), ("mammoth_tusk", "Mammoth Tusk", "fossil", 700),
    ("arrowhead", "Arrowhead", "artifact", 80), ("old_coin", "Old Coin", "artifact", 120), ("clay_pot", "Clay Pot", "artifact", 100),
    ("rusty_spur", "Rusty Spur", "artifact", 130), ("ships_compass", "Ship's Compass", "artifact", 220), ("tin_soldier", "Tin Soldier", "artifact", 160),
    ("golden_idol", "Golden Idol", "artifact", 1200),
]
for _d in DIGS:
    W._item(_d[0], _d[1], _d[2], _d[3], "&", "&", "yellow")
W._item("clay", "Clay", "material", 10, "o", "o", "red")
DIG_TABLE = {
    "farm": [("clay", 40), ("stone", 25), ("arrowhead", 12), ("old_coin", 8), ("fern_fossil", 8), ("tin_soldier", 5), ("ammonite", 2)],
    "town": [("clay", 30), ("old_coin", 20), ("tin_soldier", 14), ("clay_pot", 14), ("arrowhead", 10), ("stone", 12)],
    "forest": [("clay", 25), ("fern_fossil", 20), ("amber", 14), ("arrowhead", 16), ("trilobite", 10), ("dino_tooth", 5), ("mammoth_tusk", 2)],
    "beach": [("clay", 20), ("fossil_fish", 18), ("ammonite", 18), ("ships_compass", 10), ("old_coin", 14), ("seashell", 20)],
    "mountain": [("stone", 25), ("trilobite", 20), ("ammonite", 15), ("dino_tooth", 12), ("amber", 10), ("dino_skull", 3), ("mammoth_tusk", 4)],
    "frontier": [("clay", 20), ("rusty_spur", 25), ("arrowhead", 20), ("old_coin", 12), ("dino_tooth", 10), ("dino_skull", 4), ("gold_nugget", 6)],
    "island": [("clay", 20), ("amber", 20), ("fossil_fish", 15), ("ammonite", 15), ("golden_idol", 3), ("coconut", 20)],
}
DIG_MAX = 3
DIG_LIFE = 20 * MIN

# ----------------------------------------------------------------------------- paintings (each also comes as a forgery)
ART = [
    ("meadow_dawn", "Meadow at Dawn"), ("moonlit_pond", "Moonlit Pond"), ("lighthouse_storm", "Storm over Driftwood"),
    ("prize_cow", "Portrait of a Prize Cow"), ("starry_valley", "Starry Valley Night"), ("still_turnips", "Still Life with Turnips"),
    ("mesa_dusk", "Mesa at Dusk"), ("watering_girl", "Girl with a Watering Can"), ("pumpkin_patch", "The Pumpkin Patch"),
    ("winter_town", "Hollow Town in Snow"),
]
for _k, _n in ART:
    W._item("art_" + _k, _n, "art", 1200, "#", "#", "magenta", art=_k)
    W._item("fake_" + _k, _n, "art", 40, "#", "#", "magenta", art=_k, fake=True)
ART_PRICE = (1600, 3200)
FAKE_CHANCE = 0.35

CATEGORIES = [
    ("Fish", lambda k, it: it["kind"] == "fish" and not W.FISH.get(k, {}).get("junk")),
    ("Bugs", lambda k, it: it["kind"] == "bug"),
    ("Fossils", lambda k, it: it["kind"] == "fossil"),
    ("Artifacts", lambda k, it: it["kind"] == "artifact"),
    ("Minerals & Gems", lambda k, it: k in ("quartz", "amethyst", "emerald", "ruby", "diamond", "prismatic_shard", "gold_nugget", "star_fragment")),
    ("Art", lambda k, it: it["kind"] == "art" and not it.get("fake")),
]
REWARDS = [(5, "300g", 300, None), (10, "a Sprinkler", 0, ("sprinkler", 1)), (20, "1,500g", 1500, None), (30, "a Rock Tumbler", 0, ("rock_tumbler", 1)),
           (45, "5,000g and the Golden Crown", 5000, ("crown", 1)), (60, "a legendary seed", 0, ("oak_seed", 1))]


def category_of(key):
    it = W.ITEMS.get(key)
    if not it:
        return None
    for name, test in CATEGORIES:
        if test(key, it):
            return name
    return None


def collectibles():
    out = {}
    for name, test in CATEGORIES:
        out[name] = [k for k, it in W.ITEMS.items() if test(k, it)]
    return out


class Museum:
    def _init_museum(self, now):
        self.museum = getattr(self, "museum", {})        # item key -> donor
        self.bugs = getattr(self, "bugs", {})            # loc -> {(x, y): {k, until}}
        self.digs = getattr(self, "digs", {})            # loc -> {(x, y): until}
        self.art_stock = getattr(self, "art_stock", None)
        self.museum_rewards = getattr(self, "museum_rewards", [])

    def _save_museum(self, out):
        out["museum"] = self.museum
        out["museum_rewards"] = self.museum_rewards

    def _load_museum(self, d):
        self.museum = d.get("museum", {})
        self.museum_rewards = d.get("museum_rewards", [])

    # ------------------------------------------------------------------ spawning bugs and dig spots where people are
    def ground_spots(self, loc, ground, rng, tries=60):
        rows = self.rows_of(loc)
        if not rows:
            return None
        for _ in range(tries):
            x, y = rng.randint(1, len(rows[0]) - 2), rng.randint(1, len(rows) - 2)
            ch = rows[y][x]
            if ground == "~":
                if ch in ".," and any(rows[y + dy][x + dx] == "~" for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + dy < len(rows) and 0 <= x + dx < len(rows[0])):
                    return (x, y)
                continue
            if ch in ground and not self.portal(loc, x, y) and (loc != "farm" or not self.tiles.get((x, y))) and (x, y) not in self.atiles.get(loc, {}):
                return (x, y)
        return None

    def _tick_museum(self, now):
        h = self.sky_hour(now)
        night = h >= 20 or h < 5
        season = self.season_at(now)
        rng = random.Random(int(now * 10) ^ self.seed)
        locs = {q.get("loc", "farm") for q in self.players.values() if q.get("online") and self.is_outdoor(q.get("loc", "farm"))}
        for loc in list(self.bugs):
            for pos, b in list(self.bugs[loc].items()):
                if b["until"] < now:
                    del self.bugs[loc][pos]
                    self.dirty = True
        for loc in list(self.digs):
            for pos, until in list(self.digs[loc].items()):
                if until < now:
                    del self.digs[loc][pos]
        for loc in locs:
            bl = self.bugs.setdefault(loc, {})
            if len(bl) < BUG_MAX and rng.random() < 0.08:
                pool = [b for b in BUGS if season in b[3] and (b[4] == "any" or (b[4] == "night") == night)
                        and (loc in b[5] or (loc == "mystery" and "island" in b[5]))]
                if pool:
                    b = rng.choices(pool, [x[7] for x in pool])[0]
                    pos = self.ground_spots(loc, b[6], rng)
                    if pos and pos not in bl:
                        bl[pos] = dict(k=b[0], until=now + BUG_LIFE * rng.uniform(0.6, 1.4))
                        self.dirty = True
            dl = self.digs.setdefault(loc, {})
            table = DIG_TABLE.get(loc) or DIG_TABLE.get("island" if loc == "mystery" else "")
            if table and len(dl) < DIG_MAX and rng.random() < 0.03:
                pos = self.ground_spots(loc, ".,zr", rng)
                if pos:
                    dl[pos] = now + DIG_LIFE
                    self.dirty = True

    def _snap_museum(self, snap, now):
        snap["bugs"] = {loc: {"%d,%d" % pos: b["k"] for pos, b in bl.items()} for loc, bl in self.bugs.items() if bl}
        snap["digs"] = {loc: ["%d,%d" % pos for pos in dl] for loc, dl in self.digs.items() if dl}
        snap["museum"] = list(self.museum)
        snap["art_dealer"] = bool(self.art_stock) and self.art_day(now)

    # ------------------------------------------------------------------ E: the net and the hoe
    def _use_museum(self, p, loc, fx, fy, now):
        sel = self.selected_item(p)
        bl = self.bugs.get(loc, {})
        for pos in ((fx, fy), (p["x"], p["y"])):
            if pos in bl and sel == "bug_net":
                b = bl.pop(pos)
                self.swing_anim(p, "scythe", pos)
                self.dirty = True
                chance = 0.8 + (0.15 if self.has_buff(p, "luck", now) else 0)
                if random.random() < chance:
                    self.give(p, b["k"], 1)
                    self.fx(p, "lift", b["k"], pos)
                    p["xp"] += 8
                    self.bump(p, "bugs")
                    self.check_milestones(now)
                    return self.say(p, "Caught a %s!%s" % (BUG[b["k"]][1], "" if b["k"] in self.museum else " (The museum doesn't have one yet!)"), "good") or True
                return self.say(p, "The %s got away!" % BUG[b["k"]][1], "warn") or True
            if pos in bl and sel != "bug_net" and pos == (fx, fy):
                return self.say(p, "A %s! Hold a bug net to catch it." % BUG[bl[pos]["k"]][1]) or True
        dl = self.digs.get(loc, {})
        for pos in ((fx, fy), (p["x"], p["y"])):
            if pos in dl:
                if sel not in ("hoe", "shovel"):
                    return self.say(p, "Something is wriggling in the ground here. Dig with the hoe (1).") or True
                del dl[pos]
                table = DIG_TABLE.get(loc) or DIG_TABLE["island"]
                kinds, weights = zip(*table)
                key = random.choices(kinds, weights)[0]
                n = 2 if key in ("clay", "stone") else 1
                self.give(p, key, n)
                self.swing_anim(p, "hoe", pos)
                self.fx(p, "lift", key, pos)
                p["xp"] += 10
                self.bump(p, "dug")
                self.dirty = True
                cat = category_of(key)
                note = " (Professor Fern would love that for the museum!)" if cat and key not in self.museum else ""
                if key in ("dino_skull", "golden_idol", "mammoth_tusk"):
                    self.event("%s dug up a %s! What a find!" % (p["name"], W.ITEMS[key]["name"]), now, "good")
                else:
                    self.say(p, "Dug up %s%s!%s" % ("%d " % n if n > 1 else "a ", W.ITEMS[key]["name"], note), "good")
                self.check_milestones(now)
                return True
        if loc == "town" and self.art_day(now) and self.terrain(fx, fy, loc) == "J" and (fx, fy) == (35, 25):
            return self.art_menu(p, now) or True
        return False

    # ------------------------------------------------------------------ the art dealer visits the square on the 2nd and 5th of each season
    def art_day(self, now):
        return self.unlocked("gallery") and self.day_at(now) in (2, 5)

    def art_menu(self, p, now):
        day = (self.season_at(now), self.day_at(now), self.year_at(now))
        if not self.art_stock or self.art_stock.get("day") != list(day):
            rng = random.Random(hash(day) ^ self.seed)
            picks = rng.sample(ART, 3)
            self.art_stock = dict(day=list(day), items=[("fake_" if rng.random() < FAKE_CHANCE else "art_") + k for k, n in picks],
                                  prices=[rng.randint(*ART_PRICE) // 10 * 10 for _ in picks], sold=[])
        st = self.art_stock
        rows = []
        for i, key in enumerate(st["items"]):
            sold = i in st["sold"]
            rows.append(dict(key=key, label=W.ITEMS[key]["name"], info="Sold!" if sold else "Is it genuine? Look closely...",
                             right="" if sold else "%dg" % st["prices"][i], act=dict(t="buy_art", i=i), ok=not sold and self.coins >= st["prices"][i]))
        self.list_menu(p, "art", "Velvet's Art Cart", rows, sub="\"Every one a masterpiece, darling. Mostly.\"  ·  %dg shared" % self.coins, keep=True)

    def act_buy_art(self, p, msg, now):
        st = self.art_stock
        i = int(msg.get("i", -1))
        if not st or not (0 <= i < len(st["items"])) or i in st["sold"] or p.get("loc") != "town":
            return
        price = st["prices"][i]
        if self.coins < price:
            return self.say(p, "Not enough coins.", "warn")
        self.coins -= price
        st["sold"].append(i)
        self.give(p, st["items"][i], 1)
        self.bump(p, "spent", price)
        self.say(p, "Bought %s. Velvet winks at you." % W.ITEMS[st["items"][i]]["name"], "good")
        self.art_menu(p, now)

    # ------------------------------------------------------------------ the museum
    def museum_menu(self, p, now):
        total = sum(len(v) for v in collectibles().values())
        rows = [dict(section="Donate")]
        donatable = [(k, n) for k, n in p["inventory"] if category_of(k) and k not in self.museum]
        fakes = [(k, n) for k, n in p["inventory"] if W.ITEMS[k].get("fake")]
        for k, n in donatable:
            rows.append(dict(key=k, label=W.ITEMS[k]["name"], info=category_of(k), right="Donate", act=dict(t="donate", item=k), ok=True))
        for k, n in fakes:
            rows.append(dict(key=k, label=W.ITEMS[k]["name"], info="Art", right="Donate", act=dict(t="donate", item=k), ok=True))
        if not donatable and not fakes:
            rows.append(dict(label="Nothing new in your bag", info="Fish, bugs, fossils, old things, gems and paintings all belong here.", ok=False))
        for name, keys in collectibles().items():
            have = [k for k in keys if k in self.museum]
            rows.append(dict(section="%s  %d / %d" % (name, len(have), len(keys))))
            for k in keys:
                got = k in self.museum
                rows.append(dict(key=k if got else None, label=W.ITEMS[k]["name"] if got else "?????",
                                 info=("donated by " + self.museum[k]) if got else "", ok=False, dim=not got))
        nxt = next((r for r in REWARDS if r[0] > len(self.museum)), None)
        self.list_menu(p, "museum", "Hollow Museum", rows,
                       sub="Professor Fern · %d of %d donated%s" % (len(self.museum), total, ("  ·  next reward at %d: %s" % (nxt[0], nxt[1])) if nxt else ""), keep=True)

    def act_donate(self, p, msg, now):
        key = msg.get("item")
        if p.get("loc") != "museum" or not self.count(p, key or ""):
            return
        it = W.ITEMS[key]
        if it.get("fake"):
            self.take(p, key, 1)
            self.say(p, "Professor Fern: Hmm... the brushwork is all wrong. This %s is a forgery! I'll have to dispose of it." % it["name"], "warn")
            return self.museum_menu(p, now)
        if not category_of(key) or key in self.museum:
            return
        self.take(p, key, 1)
        self.museum[key] = p["name"]
        p["xp"] += 20
        self.bump(p, "donated")
        self.credit(p, "museum")
        self.befriend(p, "Professor Fern", 15)
        self.event("%s donated a %s to the museum! (%d pieces)" % (p["name"], it["name"], len(self.museum)), now, "good")
        for n, label, coins, item in REWARDS:
            if len(self.museum) >= n and n not in self.museum_rewards:
                self.museum_rewards.append(n)
                self.coins += coins
                if item:
                    if item[0] in ("crown",):
                        p.setdefault("wardrobe", []).append("crown")
                    else:
                        self.give(p, item[0], item[1])
                self.event("The museum reached %d pieces! Professor Fern gave %s %s as thanks." % (n, p["name"], label), now, "good")
        self.check_milestones(now)
        self.museum_menu(p, now)
