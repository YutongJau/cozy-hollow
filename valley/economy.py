"""Coins that matter. A ledger of every coin in and out (by what earned or spent it), and things worth saving for:
tool upgrades at Ingrid's forge (a can or hoe that works a whole row, then a square), farm expansions, a farmhouse kitchen
and cellar, a bigger coop and barn, Oakley's furniture catalogue (once the valley is Bustling) and big town projects
(the Minecart Line and the Observatory). Prices are set so an evening of play buys one meaningful thing, never all."""
import random
import time

import areas as AR
import world as W
from valley import crafting as CR
from valley import townhall as TH

H = W.HOUR

# ------------------------------------------------------------------ the ledger: what each action is called in it
SOURCES = {
    "sell": "Selling at shops and the bin", "sell_all": "Shipping hauls", "deliver": "The notice board", "buy": "Marigold's seed shop",
    "purchase": "Shops around the valley", "contribute": "Town projects", "market_sell": "Fennel's market", "market_buy": "Fennel's market",
    "interact": "Favors, stories, fountain coins and the like", "minigame_done": "Festival games", "fest_enter": "Festival entries",
    "forge": "Ingrid's forge", "upgrade": "Upgrades and expansions", "upgrade_tool": "Tool upgrades", "exchange": "Gold nuggets at the bank",
    "build_coop": "The chicken coop", "buy_horse": "Horses", "buy_art": "Velvet's art", "quest_accept": "Villager quests",
    "tick": "Prizes and payouts over time", "fast": "Prizes and payouts over time", "wish": "Wishes", "give": "Gifts between farmers",
}
LEDGER_DAYS = 28

# ------------------------------------------------------------------ tools: (tier name, ore, coins); the can's capacity by tier
TOOL_TIERS = [("Copper", "copper_ore", 1500), ("Iron", "iron_ore", 4000), ("Golden", "gold_ore", 10000)]
TOOL_ORE = 5
CAN_CAP = [W.CAN_CAPACITY, 40, 60, 100]
TOOL_REACH = ["the tile ahead", "3 tiles in a row", "5 tiles in a row", "a 3x3 square ahead"]
UPGRADABLE = {"hoe": "Hoe", "watering_can": "Watering Can"}

# ------------------------------------------------------------------ Oakley's building work: key -> (name, what, coins, materials, needs)
UPGRADES = {
    "field1": ("East Field Extension", "25 more tiles of farmland beside the east field.", 2500, [("wood", 30)], None),
    "field2": ("Pond Field", "48 tiles of farmland between the east field and the pond.", 6000, [("wood", 50), ("stone", 30)], "field1"),
    "field3": ("North Field", "39 tiles of farmland in the sun by the barn.", 12000, [("wood", 60), ("stone", 60)], "field2"),
    "kitchen": ("Farmhouse Kitchen", "A proper range and pantry: every dish you cook comes out as two.", 3000, [("wood", 40)], None),
    "cellar": ("Farmhouse Cellar", "Six oak casks under the house: age cheese, jam, pickles and honey into finer things worth far more.", 7500,
               [("stone", 60), ("iron_ore", 5)], None),
    "big_coop": ("Big Coop", "Room for 20 chickens instead of 10.", 4000, [("wood", 60)], "#coop"),
    "big_barn": ("Big Barn", "Room for 12 cows in the pasture instead of 6.", 8000, [("wood", 100), ("iron_ore", 10)], None),
}
FIELDS = {"field1": (47, 9, 51, 13), "field2": (52, 14, 67, 16), "field3": (33, 4, 45, 6)}

# ------------------------------------------------------------------ the cellar: what ages into what, and how long it takes
AGING = {"cheese": ("aged_cheese", 3 * H), "jam": ("vintage_jam", 3 * H), "pickles": ("aged_pickles", 2 * H), "honey": ("golden_honey", 3 * H)}
W._item("aged_cheese", "Aged Cheese", "artisan", 400, "@", "@", "yellow", hp=40, info="Cheese aged in the cellar. Rich and sharp.")
W._item("vintage_jam", "Vintage Jam", "artisan", 300, "o", "o", "magenta", hp=30, info="Jam aged in an oak cask. Deep and sweet.")
W._item("aged_pickles", "Aged Pickles", "artisan", 240, "o", "o", "green", hp=25, info="Pickles with a proper bite.")
W._item("golden_honey", "Golden Honey", "artisan", 260, "o", "o", "yellow", hp=30, info="Honey that has turned to liquid gold.")
CASKS = 6

# ------------------------------------------------------------------ Oakley's furniture catalogue (placed like machines, picked up with the pickaxe)
DECOR = [("garden_bench", "Garden Bench", 400), ("flower_planter", "Flower Planter", 150), ("lamp_post", "Lamp Post", 600),
         ("garden_gnome", "Garden Gnome", 300), ("bird_bath", "Bird Bath", 500), ("stone_lantern", "Stone Lantern", 700),
         ("scarecrow", "Scarecrow", 350), ("sundial", "Sundial", 900), ("topiary", "Topiary", 450)]
DECOR_LINES = {"garden_bench": "You sit a while and watch the farm.", "flower_planter": "The flowers nod in the breeze.",
               "lamp_post": "A warm little light for the evenings.", "garden_gnome": "The gnome looks very pleased with himself.",
               "bird_bath": "A sparrow splashes about and flies off.", "stone_lantern": "It glows softly after dark.",
               "scarecrow": "He's not scaring anyone, but he tries.", "sundial": "", "topiary": "Clipped into a perfect ball."}
for _k, _n, _p in DECOR:
    W._item(_k, _n, "machine", _p // 2, "&", "&", "yellow", info="Decoration from Oakley's catalogue. Set it down on the farm; the pickaxe picks it up again.")
    CR.MACHINES[_k] = dict(decor=True)
CR.SHOPS["decor"] = ("Oakley's Furniture Catalogue", "Oakley", [(k, p) for k, _, p in DECOR])

# ------------------------------------------------------------------ the big town projects
TH.PROJECTS += [
    ("minecart", "Minecart Line", "Minecarts link the town, the mine on Summit Ridge and Driftwood Beach: E on a cart to ride.",
     [("wood", 80), ("iron_ore", 20)], 5000, []),
    ("observatory", "Hollow Observatory", "Shooting stars fall twice as often, and a telescope on Summit Ridge shows you the night sky.",
     [("stone", 60), ("quartz", 10), ("gold_ore", 8)], 8000, []),
]
TH.PROJECT.update({p[0]: p for p in TH.PROJECTS})
CARTS = {"town": (9, 18), "mountain": (37, 9), "beach": (16, 6)}
CART_NAMES = {"town": "Hollow Town", "mountain": "the mine on Summit Ridge", "beach": "Driftwood Beach"}
TELESCOPE = ("mountain", 56, 6)
AR.TERRAIN_NAMES.update({"X": "minecart", "y": "telescope"})


class Economy:
    # ------------------------------------------------------------------ the shared purse, with a ledger
    @property
    def coins(self):
        return self.__dict__.get("_coins", 0)

    @coins.setter
    def coins(self, v):
        old = self.__dict__.get("_coins")
        self.__dict__["_coins"] = v
        if old is not None and v != old and "econ" in self.__dict__:
            self.ledger(v - old, self.__dict__.get("_coin_src") or "other")

    def ledger(self, delta, src):
        e = self.econ
        book = e["inc"] if delta > 0 else e["out"]
        book[src] = book.get(src, 0) + abs(delta)
        now = time.time()
        key = "%d:%s:%d" % (self.year_at(now), self.season_at(now), self.day_at(now))
        day = e["days"].setdefault(key, [0, 0])
        day[0 if delta > 0 else 1] += abs(delta)
        if len(e["days"]) > LEDGER_DAYS:
            for k in list(e["days"])[:-LEDGER_DAYS]:
                del e["days"][k]

    def _init_economy(self, now):
        self.econ = getattr(self, "econ", None) or dict(inc={}, out={}, days={})
        self.upgrades = getattr(self, "upgrades", None) or []
        self.cellar = getattr(self, "cellar", None) or [None] * CASKS

    def _save_economy(self, out):
        out["econ"] = self.econ
        out["upgrades"] = self.upgrades
        out["cellar"] = self.cellar

    def _load_economy(self, d):
        self.econ = d.get("econ") or dict(inc={}, out={}, days={})
        self.upgrades = d.get("upgrades") or []
        self.cellar = (d.get("cellar") or []) + [None] * CASKS
        self.cellar = self.cellar[:CASKS]
        if self.unlocked("minecart"):
            self.lay_carts()
        if self.unlocked("observatory"):
            self.set_terrain(*TELESCOPE, "y") if self.terrain(TELESCOPE[1], TELESCOPE[2], TELESCOPE[0]) != "y" else None

    def has_upgrade(self, key):
        return key in self.upgrades

    def ledger_menu(self, p, now):
        e = self.econ
        name = lambda src: SOURCES.get(src, src.replace("_", " ").capitalize())
        tin, tout = sum(e["inc"].values()), sum(e["out"].values())
        rows = [dict(section="Coming in  (%dg since the ledger began)" % tin)]
        for src, n in sorted(e["inc"].items(), key=lambda kv: -kv[1])[:8]:
            rows.append(dict(label=name(src), right="+%dg" % n, info="%d%%" % round(100 * n / max(1, tin)), ok=False))
        rows.append(dict(section="Going out  (%dg)" % tout))
        for src, n in sorted(e["out"].items(), key=lambda kv: -kv[1])[:8]:
            rows.append(dict(label=name(src), right="-%dg" % n, info="%d%%" % round(100 * n / max(1, tout)), ok=False))
        rows.append(dict(section="Day by day"))
        for key, (i, o) in list(e["days"].items())[-7:][::-1]:
            y, season, d = key.split(":")
            rows.append(dict(label="%s %s, year %s" % (season.capitalize(), d, y), info="+%dg in, -%dg out" % (i, o), right="%+dg" % (i - o), ok=False))
        if not e["days"]:
            rows.append(dict(label="Nothing yet - the ledger starts now.", ok=False))
        self.list_menu(p, "ledger", "The Farm Ledger", rows, sub="Every coin into and out of the shared purse (%dg now)." % self.coins)

    def act_ledger(self, p, msg, now):
        self.ledger_menu(p, now)

    def _book_economy(self, p, now):
        return [dict(label="The farm ledger", info="Where the coins come from and where they go.", act=dict(t="ledger"), ok=True, right="Open")]

    # ------------------------------------------------------------------ tool upgrades at Ingrid's forge
    def tool_lv(self, p, tool):
        return p.get("tool_lv", {}).get(tool, 0)

    def can_cap(self, p):
        return CAN_CAP[self.tool_lv(p, "watering_can")]

    def _priv_economy(self, p, d):
        d["can_cap"] = self.can_cap(p)
        d["tool_lv"] = dict(p.get("tool_lv", {}))

    def smith_rows(self, p):
        rows = [dict(section="Tool upgrades")]
        for tool, tname in UPGRADABLE.items():
            lv = self.tool_lv(p, tool)
            if lv >= len(TOOL_TIERS):
                rows.append(dict(key=tool, label="Golden %s" % tname, info="The best there is. Works %s." % TOOL_REACH[lv], ok=False, right="✓"))
                continue
            tier, ore, coins = TOOL_TIERS[lv]
            extra = (" Holds %d water." % CAN_CAP[lv + 1]) if tool == "watering_can" else ""
            rows.append(dict(key=tool, label="%s %s" % (tier, tname), info="Works %s.%s  %d %s and %dg." % (TOOL_REACH[lv + 1], extra, TOOL_ORE, W.ITEMS[ore]["name"], coins),
                             act=dict(t="upgrade_tool", tool=tool), ok=self.count(p, ore) >= TOOL_ORE and self.coins >= coins, right="Upgrade"))
        return rows

    def act_upgrade_tool(self, p, msg, now):
        tool = msg.get("tool")
        if tool not in UPGRADABLE or p.get("loc") != "smith":
            return
        lv = self.tool_lv(p, tool)
        if lv >= len(TOOL_TIERS):
            return
        tier, ore, coins = TOOL_TIERS[lv]
        coins = int(coins * (0.9 if self.perk(p, "big_earner") else 1))
        if self.count(p, ore) < TOOL_ORE or self.coins < coins:
            return self.say(p, "Ingrid: For a %s %s I need %d %s and %dg." % (tier.lower(), UPGRADABLE[tool].lower(), TOOL_ORE, W.ITEMS[ore]["name"], coins), "warn")
        self.take(p, ore, TOOL_ORE)
        self.coins -= coins
        p.setdefault("tool_lv", {})[tool] = lv + 1
        if tool == "watering_can":
            p["water"] = self.can_cap(p)
        self.bump(p, "upgrades")
        self.event("Ingrid forged %s a %s %s! It works %s." % (p["name"], tier, UPGRADABLE[tool], TOOL_REACH[lv + 1]), now, "good")
        self.keeper_counter(p, "smith", "Ingrid", now)

    def tool_area(self, p, tool):
        """The tiles an upgraded hoe or can works, starting with the one ahead (None for a plain tool)."""
        lv = self.tool_lv(p, tool)
        if lv <= 0:
            return None
        dx, dy = p["facing"]
        x, y = p["x"], p["y"]
        if lv < 3:
            return [(x + dx * k, y + dy * k) for k in range(1, 4 if lv == 1 else 6)]
        side = (dy, dx) if dx == 0 or dy == 0 else (0, 1)
        return [(x + dx * k + side[0] * s, y + dy * k + side[1] * s) for k in (1, 2, 3) for s in (0, -1, 1)]

    def till_area(self, p, area, now):
        n = 0
        for t in area:
            tl = self.tiles.get(t, {})
            if self.terrain(*t) == "d" and not any(tl.get(k) for k in ("soil", "sprinkler", "tree", "forage", "machine")) and not self.chest_at(*t):
                self.tile(t)["soil"] = True
                self.bump(p, "tilled")
                n += 1
        if not n:
            return self.say(p, "Nothing to till there." if any(self.terrain(*t) == "d" for t in area) else "That's not farmland. Till the sandy fields by the house and along the path.")
        self.swing_anim(p, "hoe", area[0])
        self.dirty = True
        return self.say(p, "Tilled %d tile%s in one swing." % (n, "s" if n > 1 else ""))

    def water_area(self, p, area, now):
        n = 0
        for t in area:
            tl = self.tiles.get(t, {})
            if tl.get("soil") and tl.get("wet_until", 0) <= now and p["water"] > 0:
                p["water"] -= 1
                tl["wet_until"] = now + self.water_time()
                self.bump(p, "watered")
                n += 1
        if not n:
            if p["water"] <= 0:
                return self.say(p, "Your can is empty! Face the pond or the well and press E to refill.", "warn")
            return self.say(p, "Nothing dry to water there.")
        self.swing_anim(p, "watering_can", area[0])
        self.dirty = True
        return self.say(p, "Watered %d tile%s. (%d water left)" % (n, "s" if n > 1 else "", p["water"]))

    # ------------------------------------------------------------------ Oakley: expansions, the farmhouse, the animals, furniture
    def carpenter_rows(self, p, now):
        rows = []
        for title, keys in (("Farm expansions", ["field1", "field2", "field3"]), ("The farmhouse", ["kitchen", "cellar"]), ("Animal buildings", ["big_coop", "big_barn"])):
            rows.append(dict(section=title))
            for key in keys:
                name, what, coins, mats, needs = UPGRADES[key]
                if self.has_upgrade(key):
                    rows.append(dict(label=name + "  ✓", info=what, ok=False, right="Built"))
                    continue
                blocked = ("Build the chicken coop first." if needs == "#coop" and not self.has_coop() else
                           ("Build the %s first." % UPGRADES[needs][0]) if needs and needs != "#coop" and not self.has_upgrade(needs) else None)
                cost = ", ".join("%d %s" % (n, W.ITEMS[k]["name"]) for k, n in mats) + ", %dg" % coins
                rows.append(dict(label=name, info=blocked or "%s  %s." % (what, cost), act=dict(t="upgrade", key=key),
                                 ok=not blocked and self.coins >= coins and all(self.count(p, k) >= n for k, n in mats), right="Build", dim=bool(blocked)))
        rows.append(dict(section="Furniture catalogue"))
        if self.stage() < 2:
            rows.append(dict(label="Oakley's furniture catalogue", info="Oakley will open it once the valley is Bustling (see the Valley Revival, K).", ok=False, dim=True))
        else:
            for key, name, price in DECOR:
                rows.append(dict(key=key, label=name, info=DECOR_LINES[key] or "Tells the time when the sun is out.", right="%dg" % price,
                                 act=dict(t="purchase", shop="decor", item=key), ok=self.coins >= price))
        return rows

    def act_upgrade(self, p, msg, now):
        key = msg.get("key")
        if key not in UPGRADES or p.get("loc") != "carpenter" or self.has_upgrade(key):
            return
        name, what, coins, mats, needs = UPGRADES[key]
        coins = int(coins * (0.9 if self.perk(p, "builder") else 1))
        if (needs == "#coop" and not self.has_coop()) or (needs and needs != "#coop" and not self.has_upgrade(needs)):
            return self.say(p, "Oakley: One thing at a time - that comes after the %s." % ("coop" if needs == "#coop" else UPGRADES[needs][0]), "warn")
        if self.coins < coins or not all(self.count(p, k) >= n for k, n in mats):
            return self.say(p, "Oakley: I'll need %s and %dg for that." % (", ".join("%d %s" % (n, W.ITEMS[k]["name"]) for k, n in mats), coins), "warn")
        for k, n in mats:
            self.take(p, k, n)
        self.coins -= coins
        self.upgrades.append(key)
        if key in FIELDS:
            x0, y0, x1, y1 = FIELDS[key]
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    if self.terrain(x, y) in ".o":
                        self.set_terrain("farm", x, y, "d")
        self.bump(p, "upgrades")
        self.event("Oakley finished the %s for the farm! %s (Paid for by %s.)" % (name, what, p["name"]), now, "good")
        self.carpenter_menu(p, now)

    def chicken_cap(self):
        return 20 if self.has_upgrade("big_coop") else 10

    def cow_cap(self):
        return 12 if self.has_upgrade("big_barn") else W.MAX_COWS

    def cook_count(self):
        return 2 if self.has_upgrade("kitchen") else 1

    # ------------------------------------------------------------------ the cellar
    def kitchen_rows(self, p, now):
        if not self.has_upgrade("cellar"):
            return []
        rows = [dict(section="Down in the cellar (oak casks)")]
        for i, c in enumerate(self.cellar):
            if not c:
                have = [k for k, n in p["inventory"] if k in AGING]
                rows.append(dict(label="Empty cask", info=("Put in your %s (ages into %s)." % (W.ITEMS[have[0]]["name"], W.ITEMS[AGING[have[0]][0]]["name"])) if have else
                                 "Bring cheese, jam, pickles or honey to age.", act=dict(t="cask_put", i=i), ok=bool(have), right="Put in"))
            elif c["ready"] > now:
                rows.append(dict(key=c["item"], label="%s, aging" % W.ITEMS[c["item"]]["name"], info="Becomes %s in %s (put in by %s)." % (
                    W.ITEMS[c["out"]]["name"], W.fmt_duration(c["ready"] - now), c["by"]), ok=False))
            else:
                rows.append(dict(key=c["out"], label=W.ITEMS[c["out"]]["name"], info="Ready! Worth %dg." % W.ITEMS[c["out"]]["sell"], act=dict(t="cask_take", i=i), ok=True, right="Take out"))
        return rows

    def act_cask_put(self, p, msg, now):
        i = int(msg.get("i", -1))
        if not self.has_upgrade("cellar") or p.get("loc") != "house" or not 0 <= i < CASKS or self.cellar[i]:
            return
        sel = self.selected_item(p)
        key = sel if sel in AGING and self.count(p, sel) else next((k for k, n in p["inventory"] if k in AGING), None)
        if not key:
            return self.say(p, "Bring cheese, jam, pickles or honey to age in the cellar.", "warn")
        self.take(p, key, 1)
        out, secs = AGING[key]
        self.cellar[i] = dict(item=key, out=out, by=p["name"], ready=now + secs)
        self.dirty = True
        self.say(p, "Into the cask with the %s. It'll be %s in %s." % (W.ITEMS[key]["name"], W.ITEMS[out]["name"], W.fmt_duration(secs)), "good")
        self.cook_menu(p)

    def act_cask_take(self, p, msg, now):
        i = int(msg.get("i", -1))
        if not self.has_upgrade("cellar") or p.get("loc") != "house" or not 0 <= i < CASKS:
            return
        c = self.cellar[i]
        if not c or c["ready"] > now:
            return
        self.cellar[i] = None
        self.give(p, c["out"], 1)
        p["xp"] += 15
        self.bump(p, "aged")
        self.dirty = True
        self.say(p, "Took a %s out of the cask." % W.ITEMS[c["out"]]["name"], "good")
        self.cook_menu(p)

    # ------------------------------------------------------------------ decorations, the minecarts and the telescope
    def decor_use(self, p, kind, now):
        if kind == "sundial":
            h = self.sky_hour(now)
            if not 6 <= h < 19:
                return self.say(p, "No shadow to read - the sun's down.")
            return self.say(p, "The shadow falls on %d o'clock." % (int(h) % 12 or 12))
        return self.say(p, DECOR_LINES.get(kind) or "Very nice.")

    def project_done(self, key, p, now):
        if key == "minecart":
            self.lay_carts()
        if key == "observatory":
            self.set_terrain(*TELESCOPE, "y")

    def lay_carts(self):
        for loc, (x, y) in CARTS.items():
            if self.terrain(x, y, loc) != "X":
                self.set_terrain(loc, x, y, "X")

    def _use_economy(self, p, loc, fx, fy, now):
        ch = self.terrain(fx, fy, loc)
        if ch == "X" and loc in CARTS:
            rows = [dict(label="Ride to %s" % CART_NAMES[to], act=dict(t="minecart", to=to), ok=True, right="All aboard") for to in CARTS if to != loc]
            return self.list_menu(p, "minecart", "Minecart Line", rows, sub="Rattle along the rails to the other stations. Free for everyone.") or True
        if ch == "y" and (loc, fx, fy) == TELESCOPE:
            return self.telescope(p, now) or True
        return False

    def act_minecart(self, p, msg, now):
        to = msg.get("to")
        here = p.get("loc")
        if not self.unlocked("minecart") or here not in CARTS or to not in CARTS or to == here:
            return
        cx, cy = CARTS[here]
        if abs(p["x"] - cx) + abs(p["y"] - cy) > 1:
            return
        x, y = CARTS[to]
        land = next(((x + dx, y + dy) for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)) if self.walkable(x + dx, y + dy, to)), (x, y + 1))
        self.out.append((p["name"], dict(t="open", menu="close")))
        self.bump(p, "rides")
        return self.travel(p, (to, land[0], land[1], (0, 1)), now, "The minecart rattles along the rails to %s..." % CART_NAMES[to])

    def telescope(self, p, now):
        h = self.sky_hour(now)
        if 6 <= h < 19.5:
            return self.say(p, "You squint through the telescope. Just blue sky and a very surprised bird. Come back after dark.")
        night = int((now - 7 * H) // W.SKY_DAY)
        if p.get("stargazed") == night:
            soon = self.star_next - now
            return self.say(p, "The stars wheel overhead.%s" % (" Something bright is coming - watch the sky!" if 0 < soon < 40 else ""))
        p["stargazed"] = night
        p["xp"] += 10
        if random.random() < 0.3:
            self.give(p, "star_fragment", 1)
            return self.say(p, "Through the telescope you spot a fallen star glinting on the ridge - and there it is at your feet! (+1 Star Fragment)", "good")
        return self.say(p, random.choice(["You find the Great Plough, and the little Seed beside it.", "Saturn's rings! Tiny and perfect.",
                                          "A comet's faint tail, far away.", "The Milky Way spills over the mountains."]))
