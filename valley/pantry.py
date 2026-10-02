"""Collections and achievements. The Valley Pantry at the Town Hall: five rooms of bundles in the spirit of Stardew's
Community Center - fill a bundle for a prize, finish a room and the whole farm gets a lasting perk. The collections page
remembers everything the farm has ever found or made (every crop, fruit, forage, fish, bug, fossil, mineral, artisan good,
dish and painting) and who found it first. Achievements are your own: each one brings a small permanent reward."""
import time

import world as W
from valley import crafting as CR
from valley import museum as MU

# ------------------------------------------------------------------ the Valley Pantry: room -> (title, perk text, [bundles])
# a bundle: (key, title, [(item, n)], how many different entries it takes, reward coins, reward item)
ROOMS = [
    ("forager", "The Forager's Shelf", "Wild things grow on the farm twice as often.", [
        ("spring_basket", "Spring Basket", [("daffodil", 1), ("leek", 1), ("dandelion", 1), ("morel", 1)], 3, 300, ("mushroom", 3)),
        ("wild_basket", "Summer and Fall Basket", [("wild_berry", 1), ("fiddlehead", 1), ("salmonberry", 1), ("hazelnut", 1), ("mushroom", 1)], 4, 400, ("trail_mix", 2)),
        ("seaside_basket", "Seaside Basket", [("seashell", 1), ("clam", 1), ("coral", 1), ("sea_urchin", 1)], 4, 500, ("chowder", 1)),
    ]),
    ("farmer", "The Farmer's Crates", "Watered soil stays wet half as long again.", [
        ("spring_crates", "Spring Crops", [("turnip", 1), ("potato", 1), ("strawberry", 1), ("cauliflower", 1)], 3, 400, ("sprinkler", 1)),
        ("summer_crates", "Summer Crops", [("tomato", 1), ("corn", 1), ("blueberry", 1), ("melon", 1)], 3, 500, ("sprinkler", 1)),
        ("cold_crates", "Fall and Winter Crops", [("pumpkin", 1), ("cranberry", 1), ("snowdrop", 1), ("winter_root", 1)], 3, 600, ("fertilizer", 10)),
        ("orchard_crate", "Orchard Crate", [("cherry", 1), ("apple", 1), ("peach", 1), ("plum", 1)], 3, 600, ("peach_sapling", 1)),
    ]),
    ("fisher", "The Fisher's Chest", "Every catch has a chance of landing two.", [
        ("river_chest", "River and Lake", [("carp", 1), ("sunfish", 1), ("rainbow_trout", 1), ("catfish", 1), ("pike", 1), ("bream", 1)], 4, 500, ("grilled_fish", 2)),
        ("ocean_chest", "Ocean", [("sardine", 1), ("tuna", 1), ("red_snapper", 1), ("pufferfish", 1), ("octopus", 1)], 3, 700, ("sushi_roll", 2)),
    ]),
    ("miner", "The Miner's Box", "Rocks and ore veins come back twice as fast.", [
        ("ore_box", "Ore", [("copper_ore", 10), ("iron_ore", 5), ("gold_ore", 3)], 3, 600, ("coal", 10)),
        ("gem_box", "Gems", [("quartz", 1), ("amethyst", 1), ("emerald", 1), ("ruby", 1)], 3, 900, ("rock_tumbler", 1)),
    ]),
    ("kitchen", "The Kitchen Pantry", "Everything you eat heals half as much again.", [
        ("artisan_crate", "Artisan Goods", [("cheese", 1), ("jam", 1), ("honey", 1), ("mayonnaise", 1)], 3, 700, ("preserves_jar", 1)),
        ("chef_table", "The Chef's Table", [("turnip_soup", 1), ("omelette", 1), ("pancakes", 1), ("baked_potato", 1), ("grilled_fish", 1), ("berry_tart", 1)], 3, 800, ("pumpkin_pie", 2)),
    ]),
]
BUNDLES = {b[0]: (room, b) for room, _, _, bs in ROOMS for b in bs}
PANTRY_DONE_COINS = 5000

# ------------------------------------------------------------------ the collections: category -> how to recognise its items
CATEGORIES = [
    ("Crops", lambda k, it: k in W.CROPS and it["kind"] == "crop"), ("Fruit", lambda k, it: it["kind"] == "fruit"),
    ("Forage", lambda k, it: it["kind"] == "forage"), ("Fish", lambda k, it: it["kind"] == "fish" and not W.FISH.get(k, {}).get("junk")),
    ("Bugs", lambda k, it: it["kind"] == "bug"), ("Fossils and artifacts", lambda k, it: it["kind"] in ("fossil", "artifact")),
    ("Minerals and gems", lambda k, it: it["kind"] == "mineral" and k not in ("stone", "coal")), ("Artisan goods", lambda k, it: it["kind"] == "artisan"),
    ("Dishes", lambda k, it: k in CR.COOK), ("Art", lambda k, it: it["kind"] == "art" and not it.get("fake")),
]


def collectibles():
    out = {}
    for name, test in CATEGORIES:
        out[name] = [k for k, it in W.ITEMS.items() if test(k, it)]
    return out


COLLECT = {k for ks in collectibles().values() for k in ks}

# ------------------------------------------------------------------ achievements: key -> (title, what, measure, need, reward kind, reward)
ACHIEVEMENTS = [
    ("green_thumb", "Green Thumb", "Harvest 100 crops", ("stat", "harvested"), 100, "perk", "Harvests give a bonus crop a little more often."),
    ("angler", "Angler", "Catch 50 fish", ("stat", "fish"), 50, "hat", "angler"),
    ("rock_breaker", "Rock Breaker", "Break 200 rocks and ore veins", ("stat", "mined"), 200, "perk", "+25 maximum health."),
    ("forager", "Forager", "Forage 100 wild things", ("stat", "foraged"), 100, "perk", "A one-in-five chance of finding two."),
    ("home_cook", "Home Cook", "Cook 25 dishes", ("stat", "cooked"), 25, "perk", "Food you eat heals half as much again."),
    ("friend_to_all", "Friend to All", "4 hearts with 8 villagers", ("hearts", 4), 8, "perk", "Chatting earns half as much friendship again."),
    ("explorer", "Explorer", "Visit every place in the valley", ("places", None), 9, "hat", "explorer"),
    ("spelunker", "Spelunker", "Reach floor 10 of the Depths", ("depth", None), 10, "hat", "miner"),
    ("party", "Life of the Party", "Earn 300 festival points", ("festpts", None), 300, "perk", "+10% festival points."),
    ("collector", "Collector", "Be first to find 40 things for the collections", ("firsts", None), 40, "perk", "Shops pay you 5% more for everything."),
    ("builder", "Town Builder", "Chip in to the town 10 times", ("stat", "contributed"), 10, "perk", "Oakley's building work costs you 10% less."),
    ("big_earner", "Big Earner", "Earn 25,000g for the farm", ("stat", "earned"), 25000, "perk", "Ingrid's tool upgrades cost you 10% less."),
]
ACH = {a[0]: a for a in ACHIEVEMENTS}
HAT_NAMES = {"angler": "Angler's Cap", "explorer": "Explorer's Hat", "miner": "Miner's Helmet"}
CR.PRIZE_HATS.update(HAT_NAMES)
ACH_CHECK = 5.0


class Collections:
    def _init_collect(self, now):
        self.pantry = getattr(self, "pantry", None) or dict(got={}, by={}, done=[], rooms=[])
        self.collection = getattr(self, "collection", None) or {}
        self._ach_check = 0.0

    def _save_collect(self, out):
        out["pantry"] = self.pantry
        out["collection"] = self.collection

    def _load_collect(self, d):
        self.pantry = d.get("pantry") or dict(got={}, by={}, done=[], rooms=[])
        self.collection = d.get("collection")
        if self.collection is None:            # a farm from before collections: remember what it obviously already had
            self.collection = {}
            for k, donor in getattr(self, "museum", {}).items():
                if k in COLLECT:
                    self.collection.setdefault(k, [donor, self.last_tick])
            for k, who in self.revival.get("shipped", {}).items():
                self.collection.setdefault(k, [who, self.last_tick])
            for p in self.players.values():
                for k, n in p.get("inventory", []):
                    if k in COLLECT:
                        self.collection.setdefault(k, [p["name"], self.last_tick])
            for k in self.storage:
                if k in COLLECT:
                    self.collection.setdefault(k, ["the farm", self.last_tick])
        for p in self.players.values():
            p.setdefault("achievements", [])

    def _join_collect(self, p, now):
        p.setdefault("achievements", [])

    # ------------------------------------------------------------------ collections
    def note_found(self, p, key):
        """Called whenever someone gets an item: the first of each collectible goes in the book."""
        if key in COLLECT and key not in self.collection:
            self.collection[key] = [p["name"], time.time()]
            self.dirty = True

    def collections_menu(self, p, now):
        rows = []
        cats = collectibles()
        have = sum(1 for ks in cats.values() for k in ks if k in self.collection)
        total = sum(len(ks) for ks in cats.values())
        for name, keys in cats.items():
            n = sum(1 for k in keys if k in self.collection)
            rows.append(dict(label=name + ("  ✓" if n == len(keys) else ""), info="%d of %d found" % (n, len(keys)), right="%d%%" % (100 * n // max(1, len(keys))),
                             act=dict(t="collection", cat=name), ok=True))
        self.list_menu(p, "collections", "Collections", rows, sub="Everything the farm has ever found or made: %d of %d." % (have, total))

    def act_collections(self, p, msg, now):
        self.collections_menu(p, now)

    def act_collection(self, p, msg, now):
        cats = collectibles()
        name = msg.get("cat")
        if name not in cats:
            return
        rows = []
        for k in cats[name]:
            got = self.collection.get(k)
            rows.append(dict(key=k if got else None, label=W.ITEMS[k]["name"] if got else "???", info=("first found by %s" % got[0]) if got else "not found yet",
                             ok=False, dim=not got))
        rows.append(dict(label="Back to all collections", act=dict(t="collections"), ok=True, right="Back"))
        self.list_menu(p, "collection", name, rows, sub="%d of %d found." % (sum(1 for k in cats[name] if k in self.collection), len(cats[name])))

    # ------------------------------------------------------------------ the Valley Pantry
    def room_done(self, room):
        return room in self.pantry["rooms"]

    def pantry_menu(self, p, now):
        rows = []
        for room, title, perk, bundles in ROOMS:
            done = self.room_done(room)
            rows.append(dict(section="%s%s - %s" % (title, "  ✓" if done else "", perk)))
            for key, btitle, needs, take, coins, item in bundles:
                got = self.pantry["got"].get(key, [])
                if key in self.pantry["done"]:
                    rows.append(dict(label=btitle + "  ✓", info="Filled by " + ", ".join(sorted(set(self.pantry["by"].get(key, [])))), ok=False, right="Done"))
                    continue
                parts = ["%s%s%s" % ("✓ " if k in got else "", ("%d " % n) if n > 1 else "", W.ITEMS[k]["name"]) for k, n in needs]
                can = any(k not in got and self.count(p, k) >= n for k, n in needs)
                rows.append(dict(key=next((k for k, n in needs if k not in got), None), label="%s (%d/%d)" % (btitle, len(got), take),
                                 info="Any %d of: %s.  Prize: %dg and %d %s." % (take, ", ".join(parts), coins, item[1], W.ITEMS[item[0]]["name"]),
                                 act=dict(t="bundle", b=key), ok=can, right="Give"))
        n = len(self.pantry["rooms"])
        self.list_menu(p, "pantry", "The Valley Pantry", rows, sub="Fill the bundles together. Each finished room gives the whole farm a lasting perk (%d of %d rooms)." % (n, len(ROOMS)), keep=True)

    def act_pantry(self, p, msg, now):
        self.pantry_menu(p, now)

    def act_bundle(self, p, msg, now):
        key = msg.get("b")
        if key not in BUNDLES or key in self.pantry["done"] or p.get("loc") != "hall":
            return
        room, (_, btitle, needs, take, coins, item) = BUNDLES[key]
        got = self.pantry["got"].setdefault(key, [])
        gave = []
        for k, n in needs:
            if len(got) >= take:
                break
            if k not in got and self.count(p, k) >= n:
                self.take(p, k, n)
                got.append(k)
                gave.append(W.ITEMS[k]["name"])
                self.pantry["by"].setdefault(key, []).append(p["name"])
        if not gave:
            return self.say(p, "You don't have anything this bundle still needs.", "warn")
        self.credit(p, "town", len(gave))
        self.bump(p, "bundled", len(gave))
        self.say(p, "You put %s into the %s." % (", ".join(gave), btitle), "good")
        if len(got) >= take:
            self.pantry["done"].append(key)
            self.coins += coins
            self.give(p, item[0], item[1])
            self.event("The %s is full! (%dg for the purse, and %d %s for %s)" % (btitle, coins, item[1], W.ITEMS[item[0]]["name"], p["name"]), now, "good")
            rtitle, perk = next((t, pk) for r, t, pk, bs in ROOMS if r == room)
            if all(b[0] in self.pantry["done"] for r, t, pk, bs in ROOMS if r == room for b in bs):
                self.pantry["rooms"].append(room)
                self.event("%s is complete! From now on: %s" % (rtitle, perk), now, "good")
                if len(self.pantry["rooms"]) == len(ROOMS):
                    self.coins += PANTRY_DONE_COINS
                    self.event("The Valley Pantry is full to the rafters! Mayor Hazel adds %dg to the purse." % PANTRY_DONE_COINS, now, "good")
        self.dirty = True
        self.pantry_menu(p, now)

    def forage_interval(self):
        return W.FORAGE_INTERVAL / (2 if self.room_done("forager") else 1)

    def ore_interval(self):
        return W.ORE_INTERVAL / (2 if self.room_done("miner") else 1)

    def water_time(self):
        return W.WATER_DURATION * (1.5 if self.room_done("farmer") else 1)

    # ------------------------------------------------------------------ achievements
    def perk(self, p, key):
        return key in p.get("achievements", [])

    def max_hp(self, p):
        return W.MAX_HP + (25 if self.perk(p, "rock_breaker") else 0)

    def heal_mult(self, p):
        return (1.5 if self.perk(p, "home_cook") else 1) * (1.5 if self.room_done("kitchen") else 1)

    def ach_progress(self, p, measure, need):
        kind, arg = measure
        if kind == "stat":
            return p.get("stats", {}).get(arg, 0)
        if kind == "hearts":
            return sum(1 for v in p.get("friends", {}).values() if v // 100 >= arg)
        if kind == "places":
            return len(p.get("seen", []))
        if kind == "depth":
            return p.get("deepest", 0)
        if kind == "festpts":
            return sum(v.get(p["name"], {}) and sum(v[p["name"]].values()) or 0 for v in getattr(self, "fest_pts", {}).values())
        if kind == "firsts":
            return sum(1 for who, t in self.collection.values() if who == p["name"])
        return 0

    def _tick_collect(self, now):
        if now - self._ach_check < ACH_CHECK:
            return
        self._ach_check = now
        for p in self.players.values():
            if not p.get("online"):
                continue
            mine = p.setdefault("achievements", [])
            for key, title, what, measure, need, kind, reward in ACHIEVEMENTS:
                if key in mine or self.ach_progress(p, measure, need) < need:
                    continue
                mine.append(key)
                if kind == "hat":
                    wardrobe = p.setdefault("wardrobe", ["cowboy", "none"])
                    if reward not in wardrobe:
                        wardrobe.append(reward)
                    text = "the %s" % HAT_NAMES[reward]
                else:
                    text = reward[0].lower() + reward[1:-1]
                self.event("%s earned the achievement %s! (%s: %s)" % (p["name"], title, what, text), now, "good")
                self.dirty = True

    def achievements_menu(self, p, now):
        mine = p.get("achievements", [])
        rows = []
        for key, title, what, measure, need, kind, reward in ACHIEVEMENTS:
            have = min(need, self.ach_progress(p, measure, need))
            prize = ("Prize: the %s." % HAT_NAMES[reward]) if kind == "hat" else "Prize: " + reward
            rows.append(dict(hat=reward if kind == "hat" else None, label=title + ("  ✓" if key in mine else ""), info="%s.  %s" % (what, prize),
                             right="Done" if key in mine else "%d/%d" % (have, need), ok=False, dim=key not in mine))
        self.list_menu(p, "achievements", "Achievements", rows, sub="Yours alone - %d of %d. Each brings a small reward that lasts." % (len(mine), len(ACHIEVEMENTS)))

    def act_achievements(self, p, msg, now):
        self.achievements_menu(p, now)

    def _book_collect(self, p, now):
        cats = collectibles()
        have = sum(1 for ks in cats.values() for k in ks if k in self.collection)
        total = sum(len(ks) for ks in cats.values())
        return [dict(label="The Valley Pantry", info="%d of %d rooms finished (at the Town Hall)" % (len(self.pantry["rooms"]), len(ROOMS)), act=dict(t="pantry"), ok=True, right="Open"),
                dict(label="Collections", info="%d of %d things found" % (have, total), act=dict(t="collections"), ok=True, right="Open"),
                dict(label="Achievements", info="%d of %d earned" % (len(p.get("achievements", [])), len(ACHIEVEMENTS)), act=dict(t="achievements"), ok=True, right="Open")]
