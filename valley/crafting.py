"""Making things: materials, crafting (tables and the toolbelt), cooking, tailoring, artisan machines, animal traps, shops.

Machines sit on a tile like a sprinkler (traps out in the wild): load one with what it takes and come back later.
"""
import random
import time

import areas as AR
import world as W

MIN = W.MINUTE


def _i(key, name, kind, sell, glyph, color, **kw):
    return W._item(key, name, kind, sell, glyph, glyph if ord(glyph[0]) < 128 else "*", color, **kw)


# ----------------------------------------------------------------------------- things to make things from
_i("fiber", "Fiber", "material", 2, "\"", "green")
_i("fabric", "Fabric", "material", 15, "#", "magenta", price=30)
_i("flour", "Flour", "material", 5, "o", "white", price=15)
_i("coal", "Coal", "mineral", 15, "o", "black")
_i("feather", "Feather", "material", 15, "/", "white")
_i("fur", "Fur", "material", 40, "%", "yellow")
_i("leather", "Leather", "material", 60, "#", "yellow")
_i("egg", "Egg", "animal", 40, "o", "white")
_i("cheese", "Cheese", "artisan", 150, "o", "yellow")
_i("jam", "Jam", "artisan", 120, "u", "red")
_i("pickles", "Pickles", "artisan", 100, "u", "green")
_i("honey", "Honey", "artisan", 100, "u", "yellow")
_i("mayonnaise", "Mayonnaise", "artisan", 90, "u", "white")
# game from hunting and traps, meat from the butcher
_i("wild_rabbit", "Wild Rabbit", "game", 60, "r", "white")
_i("quail", "Quail", "game", 45, "q", "yellow")
_i("deer", "Deer", "game", 200, "D", "yellow")
_i("boar", "Wild Boar", "game", 220, "B", "red")
_i("rabbit_meat", "Rabbit Meat", "meat", 50, "=", "red")
_i("quail_meat", "Quail Meat", "meat", 40, "=", "red")
_i("venison", "Venison", "meat", 90, "=", "red")
_i("boar_meat", "Boar Meat", "meat", 100, "=", "red")

# ----------------------------------------------------------------------------- dishes: (name, ingredients, sell, buff, hp)
# ingredients may name a group: #fish, #fruit, #meat, #veg (any crop)
COOK = {
    "turnip_soup": ("Turnip Soup", [("turnip", 2)], 60, None, 20),
    "tomato_soup": ("Tomato Soup", [("tomato", 2)], 110, None, 25),
    "fried_egg": ("Fried Egg", [("egg", 1)], 50, None, 20),
    "omelette": ("Omelette", [("egg", 1), ("milk", 1)], 120, "speed", 30),
    "pancakes": ("Pancakes", [("flour", 1), ("egg", 1), ("milk", 1)], 180, "speed", 40),
    "baked_potato": ("Cheesy Baked Potato", [("potato", 1), ("cheese", 1)], 220, None, 50),
    "corn_chowder": ("Corn Chowder", [("corn", 2), ("milk", 1)], 180, None, 40),
    "grilled_fish": ("Grilled Fish", [("#fish", 1)], 90, "angler", 25),
    "sushi_roll": ("Sushi Roll", [("#fish", 1), ("seaweed", 1)], 160, "angler", 30),
    "chowder": ("Seafood Chowder", [("clam", 1), ("#fish", 1), ("milk", 1), ("potato", 1)], 320, "angler", 60),
    "risotto": ("Mushroom Risotto", [("mushroom", 1), ("morel", 1), ("cheese", 1)], 300, "luck", 50),
    "fruit_salad": ("Fruit Salad", [("#fruit", 3)], 200, "luck", 40),
    "berry_tart": ("Berry Tart", [("wild_berry", 2), ("flour", 1)], 200, "speed", 35),
    "shortcake": ("Strawberry Shortcake", [("strawberry", 2), ("flour", 1), ("milk", 1)], 260, "luck", 40),
    "pumpkin_pie": ("Pumpkin Pie", [("pumpkin", 1), ("flour", 1), ("egg", 1), ("milk", 1)], 420, "luck", 60),
    "honey_cake": ("Honey Cake", [("honey", 1), ("flour", 1), ("egg", 1)], 280, "speed", 45),
    "cheese_toast": ("Cheese Toast", [("cheese", 1), ("flour", 1)], 200, None, 40),
    "cactus_candy": ("Cactus Candy", [("cactus_fruit", 2), ("honey", 1)], 260, "speed", 30),
    "coconut_curry": ("Coconut Curry", [("coconut", 1), ("ginger", 1), ("#meat", 1)], 360, "strength", 70),
    "hunters_stew": ("Hunter's Stew", [("venison", 1), ("potato", 1), ("mushroom", 1)], 360, "strength", 80),
    "rabbit_pie": ("Rabbit Pie", [("rabbit_meat", 1), ("flour", 1), ("potato", 1)], 300, "strength", 70),
    "roast_quail": ("Roast Quail", [("quail_meat", 1), ("leek", 1)], 200, "strength", 50),
    "boar_roast": ("Boar Roast", [("boar_meat", 1), ("cranberry", 1)], 380, "strength", 90),
    "trail_mix": ("Trail Mix", [("hazelnut", 2), ("wild_berry", 1)], 120, "speed", 25),
}
for _k, (_n, _need, _sell, _buff, _hp) in COOK.items():
    _i(_k, _n, "food", _sell, "&", "yellow", buff=_buff, hp=_hp)
BUFFS = {"speed": ("Quick feet", 150), "luck": ("Lucky", 240), "angler": ("Steady hands", 240), "strength": ("Strong", 180)}

# ----------------------------------------------------------------------------- things you make and place
_i("craft_table", "Crafting Table", "machine", 40, "T", "yellow")
_i("tailor_table", "Tailoring Table", "machine", 60, "T", "magenta")
_i("cheese_press", "Cheese Press", "machine", 80, "P", "yellow")
_i("preserves_jar", "Preserves Jar", "machine", 70, "U", "red")
_i("mayo_machine", "Mayonnaise Machine", "machine", 70, "M", "white")
_i("bee_house", "Bee House", "machine", 90, "H", "yellow")
_i("rock_tumbler", "Rock Tumbler", "machine", 90, "O", "white")
_i("animal_trap", "Animal Trap", "machine", 40, "x", "yellow")
_i("chest_item", "Storage Chest", "machine", 50, "X", "yellow")
_i("toolbelt", "Toolbelt", "key", 0, "=", "yellow")
_i("bug_net", "Bug Net", "gear", 0, "Y", "white", price=250, verb="catch bugs (face one and press E)")
_i("monster_treat", "Monster Treat", "treat", 30, "*", "magenta")
MACHINES = {
    "cheese_press": dict(feeds={"milk": ("cheese", 40 * MIN)}),
    "preserves_jar": dict(feeds={"#fruit": ("jam", 60 * MIN), "#berry": ("jam", 60 * MIN), "#veg": ("pickles", 60 * MIN)}),
    "mayo_machine": dict(feeds={"egg": ("mayonnaise", 30 * MIN)}),
    "rock_tumbler": dict(feeds={"stone": ("#tumble", 45 * MIN)}, need=3),
    "bee_house": dict(auto=("honey", 90 * MIN)),
    "animal_trap": dict(auto=("#trap", 45 * MIN), wild=True),
    "craft_table": dict(), "tailor_table": dict(),
}
BERRIES = {"wild_berry", "salmonberry", "blueberry", "cranberry", "strawberry"}
TUMBLE = [("quartz", 50), ("amethyst", 18), ("emerald", 10), ("ruby", 10), ("gold_nugget", 8), ("diamond", 4)]
TRAP = {"forest": [("wild_rabbit", 40), ("quail", 30), ("fur", 15), ("feather", 15)],
        "mountain": [("wild_rabbit", 45), ("fur", 35), ("feather", 20)],
        "frontier": [("quail", 45), ("wild_rabbit", 35), ("feather", 20)],
        "island": [("feather", 60), ("coconut", 40)], "town": [("feather", 100)], "beach": [("feather", 70), ("clam", 30)]}

# ----------------------------------------------------------------------------- recipes: (out, n, needs, unlock)
CRAFT = {
    "craft_table": ("craft_table", 1, [("wood", 20), ("stone", 5)]),
    "chest_item": ("chest_item", 1, [("wood", 30)]),
    "fabric": ("fabric", 1, [("fiber", 6)]),
    "fertilizer": ("fertilizer", 5, [("fiber", 4), ("stone", 2)]),
    "sprinkler": ("sprinkler", 1, [("copper_ore", 3), ("iron_ore", 2), ("stone", 5)]),
    "tailor_table": ("tailor_table", 1, [("wood", 15), ("fabric", 3), ("copper_ore", 2)]),
    "toolbelt": ("toolbelt", 1, [("leather", 2), ("fabric", 1), ("copper_ore", 5)]),
    "cheese_press": ("cheese_press", 1, [("wood", 25), ("stone", 10), ("copper_ore", 3)]),
    "preserves_jar": ("preserves_jar", 1, [("wood", 15), ("stone", 10), ("coal", 3)]),
    "mayo_machine": ("mayo_machine", 1, [("wood", 15), ("stone", 10), ("copper_ore", 3)]),
    "bee_house": ("bee_house", 1, [("wood", 30), ("coal", 5), ("iron_ore", 3)]),
    "rock_tumbler": ("rock_tumbler", 1, [("stone", 20), ("iron_ore", 5), ("coal", 5)]),
    "animal_trap": ("animal_trap", 1, [("wood", 10), ("fiber", 5), ("copper_ore", 2)]),
    "bug_net": ("bug_net", 1, [("fiber", 10), ("wood", 5)]),
    "bow": ("bow", 1, [("wood", 15), ("fiber", 10)]),
    "arrow": ("arrow", 10, [("wood", 3), ("stone", 2), ("feather", 1)]),
    "sword_copper": ("sword_copper", 1, [("copper_ore", 6), ("wood", 5)]),
    "sword_iron": ("sword_iron", 1, [("iron_ore", 6), ("coal", 2), ("wood", 5)]),
    "sword_gold": ("sword_gold", 1, [("gold_ore", 6), ("coal", 3), ("diamond", 1)]),
    "monster_treat": ("monster_treat", 3, [("wild_berry", 2), ("honey", 1)]),
    "slingshot": ("slingshot", 1, [("wood", 10), ("fiber", 5)]),
    "path_stone": ("path_stone", 5, [("stone", 3)]),
    "bridge_kit": ("bridge_kit", 1, [("wood", 6)]),
}
# hats you can sew: key -> (name, needs); shirts can be dyed any colour for one fabric
HATS = {
    "cowboy": ("Cowboy Hat", [("leather", 1)]), "straw": ("Straw Hat", [("fiber", 6)]), "flower": ("Flower Crown", [("dandelion", 2), ("daffodil", 1)]),
    "beanie": ("Knit Beanie", [("fabric", 2)]), "tophat": ("Top Hat", [("fabric", 3), ("coal", 1)]), "bandana": ("Bandana", [("fabric", 1)]),
    "none": ("No Hat", []),
}
PRIZE_HATS = {"champion": "Rodeo Champion Hat", "witch": "Fallfest Witch Hat", "santa": "Feast Cap", "crown": "Golden Crown"}

# ----------------------------------------------------------------------------- shops out in the valley: id -> (title, keeper, [(item, price)])
SHOPS = {
    "mercantile": ("Mercantile", "Bram", [("flour", 15), ("fabric", 30), ("bug_net", 250), ("fertilizer", 20), ("chest_item", 120)]),
    "gulch": ("Dusty Gulch General", "Prospector Gus", [("bow", 400), ("arrow", 3), ("rifle", 2000), ("bullet", 6), ("animal_trap", 150), ("leather", 90)]),
    "saloon": ("Rusty's Kitchen", "Rusty", [("omelette", 160), ("grilled_fish", 140), ("pancakes", 240), ("cheese_toast", 260)]),
    "bakery": ("Juniper's Bakery", "Juniper", [("flour", 15), ("berry_tart", 260), ("honey_cake", 360), ("pumpkin_pie", 520)]),
    "dolly": ("The Gilded Spur", "Dolly", [("cactus_candy", 330), ("hunters_stew", 450), ("trail_mix", 160)]),
    "butcher": ("Butcher's Counter", "Hank", [("rabbit_meat", 70), ("quail_meat", 60), ("venison", 130), ("boar_meat", 140)]),
    "tiki": ("Coco's Tiki Stand", "Coco", [("coconut", 50), ("ginger", 55), ("coconut_curry", 450)]),
    "ranger": ("Ranger's Supplies", "Ranger Moss", [("animal_trap", 150), ("bug_net", 250), ("slingshot", 200), ("arrow", 3), ("trail_mix", 160)]),
    "tomas": ("Old Tomas's Fish Shop", "Old Tomas", [("mystery_ticket", 500)]),
    "oakley": ("Oakley's Carpentry", "Oakley", [("shovel", 1000), ("bridge_kit", 60), ("path_stone", 8), ("craft_table", 150)]),
}
BUTCHER = {"wild_rabbit": [("rabbit_meat", 2), ("fur", 1)], "quail": [("quail_meat", 2), ("feather", 2)],
           "deer": [("venison", 3), ("leather", 1)], "boar": [("boar_meat", 3), ("leather", 1)]}
WOOD_REST = 8 * MIN          # a wild tree needs a rest after you take some wood
FIBER_REST = 5 * MIN


def matches(key, want):
    """Does item key satisfy an ingredient (a key, or a #group)?"""
    if not want.startswith("#"):
        return key == want
    it = W.ITEMS.get(key, {})
    if want == "#fish":
        return it.get("kind") == "fish" and not W.FISH.get(key, {}).get("junk")
    if want == "#fruit":
        return it.get("kind") == "fruit" or key in ("coconut", "cactus_fruit")
    if want == "#berry":
        return key in BERRIES
    if want == "#meat":
        return it.get("kind") == "meat"
    if want == "#veg":
        return it.get("kind") == "crop" and key not in BERRIES
    return False


def group_name(want):
    return {"#fish": "any fish", "#fruit": "any fruit", "#meat": "any meat", "#veg": "any vegetable", "#berry": "any berry"}.get(want) or W.ITEMS[want]["name"]


class Crafting:
    # ------------------------------------------------------------------ hooks
    def _init_craft(self, now):
        self.rested = getattr(self, "rested", {})   # (loc, x, y) -> time a wild tree or bush is ready again

    def _load_craft(self, d):
        for p in self.players.values():
            p.setdefault("wardrobe", ["cowboy", "none"])
            p.setdefault("buffs", {})

    def _join_craft(self, p, now):
        p.setdefault("wardrobe", ["cowboy", "none"])
        p.setdefault("buffs", {})

    def _priv_craft(self, p, d):
        now = W.time.time()
        d["buffs"] = {k: int(v - now) for k, v in p.get("buffs", {}).items() if v > now}
        d["wardrobe"] = p.get("wardrobe", [])
        d["toolbelt"] = self.count(p, "toolbelt") > 0

    def _tick_craft(self, now):
        self.finish_machines(now)
        # bee houses and traps fill on their own
        for pos, t in self.tiles.items():
            m = t.get("machine")
            if m:
                self.machine_auto(m, "farm", now)
        for area, ts in self.atiles.items():
            for pos, t in ts.items():
                if t.get("machine"):
                    self.machine_auto(t["machine"], area, now)

    def _block_craft(self, loc, x, y):
        if loc == "farm":
            return False
        t = self.atiles.get(loc, {}).get((x, y))
        return bool(t and t.get("machine"))

    def machine_auto(self, m, loc, now):
        spec = MACHINES.get(m["kind"], {})
        auto = spec.get("auto")
        if not auto or m.get("out"):
            return
        if m["kind"] == "bee_house" and self.season_at(now) == "winter":
            m["ready"] = now + auto[1]
            return
        if m.get("ready") is None:
            m["ready"] = now + auto[1]
        if now >= m["ready"]:
            out = auto[0]
            if out == "#trap":
                kinds, weights = zip(*TRAP.get(loc, TRAP["forest"]))
                out = random.choices(kinds, weights)[0]
            m["out"], m["ready"] = out, None
            self.dirty = True

    # ------------------------------------------------------------------ what E does with crafted things
    def _use_craft(self, p, loc, fx, fy, now):
        sel = self.selected_item(p)
        kind = W.ITEMS[sel]["kind"] if sel else None
        tile = (self.tiles.get((fx, fy)) if loc == "farm" else self.atiles.get(loc, {}).get((fx, fy))) or {}
        if tile.get("machine"):
            return self.use_machine(p, loc, (fx, fy), tile, sel, now) or True
        if kind == "machine" and self.is_outdoor(loc):
            return self.place_machine(p, loc, (fx, fy), sel, now) or True
        if loc == "house" and self.terrain(fx, fy, loc) in "fF":
            return self.cook_menu(p) or True
        if loc == "carpenter" and self.terrain(fx, fy, loc) in "nS":
            self.say(p, "Oakley: Use my workbench any time. Or ask me to build you something.")
            return self.carpenter_menu(p, now) or True
        if self.is_outdoor(loc) and loc != "farm":
            ch = self.terrain(fx, fy, loc)
            if sel == "axe" and ch in "TPA":
                return self.gather(p, loc, (fx, fy), "wood", WOOD_REST, now) or True
            if sel == "scythe" and ch == "u":
                return self.gather(p, loc, (fx, fy), "fiber", FIBER_REST, now) or True
        if loc == "farm" and sel == "scythe" and self.terrain(fx, fy) == "u":
            return self.gather(p, loc, (fx, fy), "fiber", FIBER_REST, now) or True
        return False

    def gather(self, p, loc, pos, what, rest, now):
        key = (loc, pos[0], pos[1])
        if self.rested.get(key, 0) > now:
            return self.say(p, "Let it rest a while (%s)." % W.fmt_duration(self.rested[key] - now))
        n = random.randint(2, 4) if what == "wood" else random.randint(1, 3)
        if self.has_buff(p, "luck", now) and random.random() < 0.5:
            n += 1
        self.rested[key] = now + rest
        self.give(p, what, n)
        self.swing_anim(p, "axe" if what == "wood" else "scythe", pos)
        self.fx(p, "lift", what, pos)
        p["xp"] += 2
        self.bump(p, "gathered", n)
        self.say(p, "+%d %s." % (n, W.ITEMS[what]["name"]), "good")

    def has_buff(self, p, name, now):
        return p.get("buffs", {}).get(name, 0) > now

    # ------------------------------------------------------------------ machines
    def machine_ok(self, loc, x, y):
        if loc == "farm":
            t = self.tiles.get((x, y), {})
            return (self.terrain(x, y) in ".:d" and (x, y) not in W.NO_CHEST and not any(t.get(k) for k in ("soil", "crop", "tree", "forage", "sprinkler", "machine"))
                    and not self.cow_at(x, y) and not self.chest_at(x, y) and not self.blocked_extra("farm", x, y)
                    and not any(q["x"] == x and q["y"] == y and q.get("loc", "farm") == "farm" for q in self.players.values()))
        return (self.terrain(x, y, loc) in ".rz" and (x, y) not in self.atiles.get(loc, {}) and not self.portal(loc, x, y)
                and not any(q["x"] == x and q["y"] == y and q.get("loc") == loc for q in self.players.values()))

    def place_machine(self, p, loc, pos, key, now):
        if key == "chest_item":
            if loc != "farm":
                return self.say(p, "The chest belongs on the farm.", "warn")
            if not self.chest_ok(*pos):
                return self.say(p, "Not there - find a clear patch of ground.", "warn")
            self.take(p, key, 1)
            self.chests.append(dict(x=pos[0], y=pos[1]))
            self.fx(p, "drop", "chest", pos)
            self.dirty = True
            return self.say(p, "Placed another storage chest. It opens the same shared storage.", "good")
        wild = MACHINES[key].get("wild")
        if wild and loc in ("farm",) + tuple(k for k in AR.AREAS if k.startswith("mine")):
            return self.say(p, "Traps go out in the wild: the forest, the mountain, the gulch...", "warn")
        if not wild and loc != "farm":
            return self.say(p, "Set that up on the farm.", "warn")
        if not self.machine_ok(loc, *pos):
            return self.say(p, "There's no room for it there.", "warn")
        self.take(p, key, 1)
        m = dict(kind=key, by=p["name"], out=None, ready=None, inp=None)
        if MACHINES[key].get("auto"):
            m["ready"] = now + MACHINES[key]["auto"][1]
        if loc == "farm":
            self.tile(pos)["machine"] = m
        else:
            self.atiles.setdefault(loc, {})[pos] = dict(machine=m)
        self.fx(p, "drop", key, pos)
        self.dirty = True
        self.say(p, "Set down the %s." % W.ITEMS[key]["name"], "good")

    def use_machine(self, p, loc, pos, tile, sel, now):
        m = tile["machine"]
        name = W.ITEMS[m["kind"]]["name"]
        if sel == "pickaxe" and not m.get("ready") and not m.get("out"):
            del tile["machine"]
            if loc == "farm":
                self.prune(pos)
            else:
                self.atiles[loc].pop(pos, None)
            self.give(p, m["kind"], 1)
            self.fx(p, "lift", m["kind"], pos)
            self.dirty = True
            return self.say(p, "Picked up the %s." % name)
        if MACHINES[m["kind"]].get("decor"):
            return self.decor_use(p, m["kind"], now)
        if m["kind"] == "craft_table":
            return self.craft_menu(p)
        if m["kind"] == "tailor_table":
            return self.tailor_menu(p)
        if m.get("out"):
            out = m["out"]
            m["out"] = None
            n = 1
            if MACHINES[m["kind"]].get("auto"):
                m["ready"] = now + MACHINES[m["kind"]]["auto"][1]
            else:
                m["ready"] = None
            if self.has_buff(p, "luck", now) and random.random() < 0.3:
                n = 2
            self.give(p, out, n)
            self.fx(p, "lift", out, pos)
            p["xp"] += 10
            self.bump(p, "artisan", n)
            self.dirty = True
            return self.say(p, "Collected %d %s from the %s." % (n, W.ITEMS[out]["name"], name), "good")
        if m.get("ready"):
            if MACHINES[m["kind"]].get("auto"):
                return self.say(p, "The %s is busy - something in %s." % (name, W.fmt_duration(m["ready"] - now)))
            return self.say(p, "The %s is working: %s ready in %s." % (name, W.ITEMS[m["inp"]]["name"] if m.get("inp") in W.ITEMS else "it'll be", W.fmt_duration(m["ready"] - now)))
        feeds = MACHINES[m["kind"]].get("feeds", {})
        need = MACHINES[m["kind"]].get("need", 1)
        for want, (out, secs) in feeds.items():
            if sel and matches(sel, want):
                if self.count(p, sel) < need:
                    return self.say(p, "It takes %d %s." % (need, W.ITEMS[sel]["name"]), "warn")
                self.take(p, sel, need)
                if out == "#tumble":
                    kinds, weights = zip(*TUMBLE)
                    out = random.choices(kinds, weights)[0]
                m.update(out=None, ready=now + secs, inp=out, pending=out)
                self.fx(p, "drop", sel, pos)
                self.dirty = True
                return self.say(p, "Into the %s it goes. Ready in %s." % (name, W.fmt_duration(secs)), "good")
        if MACHINES[m["kind"]].get("auto"):
            return self.say(p, "The %s is working on its own." % name)
        what = ", ".join(sorted({group_name(k) for k in feeds}))
        return self.say(p, "The %s takes %s%s. Hold one and press E." % (name, ("%d " % need) if need > 1 else "", what))

    def finish_machines(self, now):
        for t in list(self.tiles.values()) + [t for ts in self.atiles.values() for t in ts.values()]:
            m = t.get("machine")
            if m and m.get("ready") and m.get("pending") and now >= m["ready"]:
                m["out"], m["ready"], m["pending"] = m["pending"], None, None
                self.dirty = True

    # ------------------------------------------------------------------ crafting
    def have_all(self, p, needs):
        for want, n in needs:
            if self.count_group(p, want) < n:
                return False
        return True

    def count_group(self, p, want):
        return sum(c for k, c in p["inventory"] if matches(k, want))

    def take_group(self, p, want, n):
        for k, c in list(p["inventory"]):
            if n <= 0:
                break
            if matches(k, want):
                k_take = min(c, n)
                self.take(p, k, k_take)
                n -= k_take

    def needs_text(self, p, needs):
        return ", ".join("%s %d/%d" % (group_name(w), min(self.count_group(p, w), n), n) for w, n in needs)

    def craft_menu(self, p):
        rows = []
        from valley import progress as PR
        lv = self.level_of(p)
        for rk, (out, n, needs) in CRAFT.items():
            need = PR.craft_level(rk)
            if lv < need:
                rows.append(dict(key=out, label=W.ITEMS[out]["name"], info="Unlocks at level %d" % need, ok=False, dim=True, right="Lv%d" % need))
                continue
            ok = self.have_all(p, needs)
            rows.append(dict(key=out, label=W.ITEMS[out]["name"] + (" x%d" % n if n > 1 else ""), info=self.needs_text(p, needs),
                             act=dict(t="craft", r=rk), ok=ok, right="Craft" if ok else ""))
        rows.sort(key=lambda r: bool(r.get("dim")))
        self.list_menu(p, "craft", "Crafting", rows, sub="Make tools, machines and supplies from what you gather.",
                       foot="Wood: an axe on wild trees. Fiber: the scythe on bushes. Stone, coal and ore: the mine.", keep=True)

    def act_craft(self, p, msg, now):
        rk = msg.get("r")
        if rk not in CRAFT:
            return
        if not self.can_craft_here(p):
            return self.say(p, "You need a crafting table (or a toolbelt).", "warn")
        out, n, needs = CRAFT[rk]
        from valley import progress as PR
        if self.level_of(p) < PR.craft_level(rk):
            return self.say(p, self.locked_msg(p, PR.craft_level(rk)), "warn")
        if not self.have_all(p, needs):
            return self.say(p, "Not enough materials.", "warn")
        for want, c in needs:
            self.take_group(p, want, c)
        self.give(p, out, n)
        p["xp"] += 8
        self.bump(p, "crafted")
        self.say(p, "Crafted %s%s!" % (W.ITEMS[out]["name"], " x%d" % n if n > 1 else ""), "good")
        self.check_milestones(now)
        self.craft_menu(p)

    def can_craft_here(self, p):
        if self.count(p, "toolbelt"):
            return True
        loc = p.get("loc", "farm")
        if loc == "carpenter":
            return True
        fx, fy = self.facing_tile(p)
        t = (self.tiles.get((fx, fy)) if loc == "farm" else self.atiles.get(loc, {}).get((fx, fy))) or {}
        return bool(t.get("machine") and t["machine"]["kind"] == "craft_table")

    def act_craft_open(self, p, msg, now):
        """C: the toolbelt lets you craft anywhere."""
        if not self.can_craft_here(p):
            return self.say(p, "You need a crafting table - or craft a Toolbelt to craft anywhere.", "warn")
        self.craft_menu(p)

    # ------------------------------------------------------------------ cooking and eating
    def cook_menu(self, p):
        rows = []
        from valley import progress as PR
        lv = self.level_of(p)
        for ck, (name, needs, sell, buff, hp) in COOK.items():
            if lv < PR.cook_level(ck):
                rows.append(dict(key=ck, label=name, info="Unlocks at level %d" % PR.cook_level(ck), ok=False, dim=True, right="Lv%d" % PR.cook_level(ck)))
                continue
            ok = self.have_all(p, needs)
            rows.append(dict(key=ck, label=name, info=self.needs_text(p, needs) + ("  ·  " + BUFFS[buff][0] if buff else ""),
                             act=dict(t="cook", r=ck), ok=ok, right="Cook" if ok else "%dg" % sell))
        rows.sort(key=lambda r: (bool(r.get("dim")), not r["ok"]))
        rows += self.kitchen_rows(p, time.time())
        self.list_menu(p, "cook", "Kitchen", rows, sub="Cook something good. Eat it with U (or from your bag) for a boost.",
                       foot="Flour is sold at the Mercantile and the bakery.", keep=True)

    def act_cook(self, p, msg, now):
        ck = msg.get("r")
        if ck not in COOK or p.get("loc") != "house":
            return
        name, needs, sell, buff, hp = COOK[ck]
        from valley import progress as PR
        if self.level_of(p) < PR.cook_level(ck):
            return self.say(p, self.locked_msg(p, PR.cook_level(ck)), "warn")
        if not self.have_all(p, needs):
            return self.say(p, "You're missing something for the %s." % name, "warn")
        for want, c in needs:
            self.take_group(p, want, c)
        self.give(p, ck, self.cook_count())
        p["xp"] += 12
        self.bump(p, "cooked")
        self.say(p, "Cooked %s! It smells wonderful." % name, "good")
        self.check_milestones(now)
        self.cook_menu(p)

    def act_eat(self, p, msg, now):
        key = msg.get("item") or self.selected_item(p)
        it = W.ITEMS.get(key or "", {})
        edible = it.get("kind") in ("food", "fruit", "crop", "forage", "artisan", "animal") and key not in ("egg",)
        if not edible or not self.count(p, key):
            return self.say(p, "You can't eat that.", "warn")
        self.take(p, key, 1)
        heal = int((it.get("hp") or 10) * self.heal_mult(p))
        p["hp"] = min(self.max_hp(p), p.get("hp", W.MAX_HP) + heal)
        msgs = ["Ate the %s." % it["name"]]
        if it.get("buff"):
            name, secs = BUFFS[it["buff"]]
            p.setdefault("buffs", {})[it["buff"]] = now + secs
            msgs.append("%s for %s!" % (name, W.fmt_duration(secs)))
        p["bubble"] = ["Yum!", now + 2]
        self.dirty = True
        self.say(p, " ".join(msgs), "good")

    # ------------------------------------------------------------------ tailoring
    def tailor_menu(self, p):
        rows = [dict(section="Hats")]
        for hk, (name, needs) in HATS.items():
            owned = hk in p.get("wardrobe", [])
            wearing = p.get("hat", "cowboy") == hk
            rows.append(dict(hat=hk, label=name + (" (wearing)" if wearing else ""), info="in your wardrobe" if owned else self.needs_text(p, needs),
                             act=dict(t="tailor", hat=hk), ok=(owned and not wearing) or (not owned and self.have_all(p, needs)),
                             right="Wear" if owned else "Sew"))
        for hk, name in PRIZE_HATS.items():
            if hk in p.get("wardrobe", []):
                rows.append(dict(hat=hk, label=name + (" (wearing)" if p.get("hat") == hk else ""), info="a prize", act=dict(t="tailor", hat=hk),
                                 ok=p.get("hat") != hk, right="Wear"))
        rows.append(dict(section="Shirt dye (1 fabric)"))
        for c in W.PLAYER_COLORS:
            rows.append(dict(swatch=c, label=c.capitalize() + " shirt", info="", act=dict(t="tailor", shirt=c),
                             ok=self.count(p, "fabric") > 0 and W.PLAYER_COLORS.index(c) != p["color"], right="Dye"))
        self.list_menu(p, "tailor", "Tailoring", rows, sub="Sew a new hat or dye your shirt.", keep=True)

    def act_tailor(self, p, msg, now):
        if not self.can_tailor_here(p):
            return self.say(p, "You need a tailoring table.", "warn")
        hk, shirt = msg.get("hat"), msg.get("shirt")
        if hk in HATS or hk in PRIZE_HATS:
            wardrobe = p.setdefault("wardrobe", ["cowboy", "none"])
            if hk not in wardrobe:
                if hk in PRIZE_HATS or not self.have_all(p, HATS[hk][1]):
                    return self.say(p, "Not enough materials.", "warn")
                for want, c in HATS[hk][1]:
                    self.take_group(p, want, c)
                wardrobe.append(hk)
                self.say(p, "Sewed a %s!" % HATS[hk][0], "good")
            p["hat"] = hk
            self.dirty = True
        elif shirt in W.PLAYER_COLORS:
            if not self.take(p, "fabric", 1):
                return self.say(p, "Dyeing takes 1 fabric.", "warn")
            p["color"] = W.PLAYER_COLORS.index(shirt)
            self.dirty = True
            self.say(p, "Your shirt is %s now." % shirt, "good")
        self.tailor_menu(p)

    def can_tailor_here(self, p):
        loc = p.get("loc", "farm")
        fx, fy = self.facing_tile(p)
        t = (self.tiles.get((fx, fy)) if loc == "farm" else self.atiles.get(loc, {}).get((fx, fy))) or {}
        return bool(t.get("machine") and t["machine"]["kind"] == "tailor_table")

    # ------------------------------------------------------------------ shops and the carpenter
    def shop_menu(self, p, sid):
        title, keeper, stock = SHOPS[sid]
        rows = []
        for key, price in stock:
            if key in ("rifle", "bullet") and not W.ITEMS.get(key):
                continue
            rows.append(dict(key=key, label=W.ITEMS[key]["name"], info=self.item_info(key), right="%dg" % price,
                             act=dict(t="purchase", shop=sid, item=key), ok=self.coins >= price))
        rows.append(dict(section="Sell to %s" % keeper))
        for key, n in p["inventory"]:
            it = W.ITEMS[key]
            if it["sell"] > 0 and it["kind"] not in ("gear", "key", "weapon"):
                rows.append(dict(key=key, label="%s x%d" % (it["name"], n), info="", right="+%dg" % it["sell"],
                                 act=dict(t="sell", item=key, n=1, menu=sid), ok=True))
        self.list_menu(p, "shop:" + sid, title, rows, sub="%s · %dg shared" % (keeper, self.coins), keep=True)

    def item_info(self, key):
        return describe(key)

    def act_purchase(self, p, msg, now):
        sid, key = msg.get("shop"), msg.get("item")
        if sid not in SHOPS:
            return
        price = dict(SHOPS[sid][2]).get(key)
        if price is None:
            return
        n = max(1, min(50, int(msg.get("n", 1))))
        if key in ("arrow", "bullet"):
            n = 10
        cost = price * n
        if cost > self.coins:
            return self.say(p, "Not enough coins (need %dg)." % cost, "warn")
        if W.ITEMS[key]["kind"] in ("gear", "weapon") and self.count(p, key):
            return self.say(p, "You already have one.")
        if sid == "decor" and (self.stage() < 2 or p.get("loc") != "carpenter"):
            return self.say(p, "Oakley's furniture catalogue opens when the valley is Bustling.", "warn")
        if (key == "mystery_ticket" and not self.unlocked("harbor")) or (key == "shovel" and not self.unlocked("landscaping")):
            return self.say(p, "That needs a town project finished first (see the Town Hall).", "warn")
        self.coins -= cost
        self.give(p, key, n)
        self.bump(p, "spent", cost)
        self.say(p, "Bought %d %s for %dg." % (n, W.ITEMS[key]["name"], cost), "good")
        if sid == "decor":
            return self.carpenter_menu(p, now)
        self.shop_menu(p, sid)

    def carpenter_menu(self, p, now):
        rows = [dict(section="Workbench"), dict(label="Use the workbench", info="Craft tools, machines and supplies.", act=dict(t="craft_open"), ok=True, right="Open")]
        rows.append(dict(section="Build"))
        if self.has_coop():
            rows.append(dict(label="Chicken Coop", info="Built! Buy chickens at the seed shop.", ok=False, right="\u2713"))
        else:
            rows.append(dict(label="Build a Chicken Coop", info="600g, 60 wood and 20 stone. A coop and a fenced yard by the farmhouse." if self.unlocked("coop") else "Finish the Coop Workshop project at the Town Hall first.",
                             act=dict(t="build_coop"), ok=self.unlocked("coop") and self.coins >= 600 and self.count(p, "wood") >= 60 and self.count(p, "stone") >= 20, right="Build"))
        rows.append(dict(section="Supplies"))
        for key, price in SHOPS["oakley"][2]:
            gated = key == "shovel" and not self.unlocked("landscaping")
            rows.append(dict(key=key, label=W.ITEMS[key]["name"], info="After the Landscaping Office project." if gated else self.item_info(key), right="%dg" % price,
                             act=dict(t="purchase", shop="oakley", item=key), ok=not gated and self.coins >= price))
        rows += self.carpenter_rows(p, now)
        self.list_menu(p, "carpenter", "Oakley's Carpentry", rows, sub="Oakley · %dg shared" % self.coins, keep=True)

    def act_build_coop(self, p, msg, now):
        if p.get("loc") != "carpenter" or self.has_coop() or not self.unlocked("coop"):
            return
        if self.coins < 600 or self.count(p, "wood") < 60 or self.count(p, "stone") < 20:
            return self.say(p, "Oakley: I'll need 600g, 60 wood and 20 stone for that.", "warn")
        self.coins -= 600
        self.take(p, "wood", 60)
        self.take(p, "stone", 20)
        self.build_coop(now)
        self.carpenter_menu(p, now)

    def act_butcher(self, p, msg, now):
        done = []
        for game, outs in BUTCHER.items():
            n = self.count(p, game)
            if n:
                self.take(p, game, n)
                for k, c in outs:
                    self.give(p, k, c * n)
                done.append("%d %s" % (n, W.ITEMS[game]["name"]))
        if not done:
            return self.say(p, "Hank: Bring me game from the hunt or your traps and I'll dress it for you.")
        p["xp"] += 5
        self.say(p, "Hank dressed %s. Here's your meat (and the hides)." % ", ".join(done), "good")
        self.shop_menu(p, "butcher")



# ------------------------------------------------------------------ one line on what each thing is for (bag, shops, catalog)
MACHINE_TIPS = {
    "cheese_press": "Set it down on the farm. Milk in, cheese out (40m).",
    "preserves_jar": "Set it down on the farm. Fruit or berries make jam, vegetables make pickles (1h).",
    "mayo_machine": "Set it down on the farm. An egg in, mayonnaise out (30m).",
    "bee_house": "Set it down on the farm. Makes honey by itself every 90m.",
    "rock_tumbler": "Set it down on the farm. 3 stone in, a polished gem out (45m).",
    "animal_trap": "Set it out in the wild (forest, mountain, gulch...). Catches game every 45m.",
    "craft_table": "Set it down on the farm, then E on it to craft.",
    "tailor_table": "Set it down on the farm, then E on it to sew hats and dye clothes.",
    "chest_item": "Another storage chest for the farm (all chests share one store).",
}
GEAR_TIPS = {
    "hoe": "Tills soil for planting, and digs up wriggling spots.", "watering_can": "Waters crops (refill at water).",
    "scythe": "Harvests crops, cuts grass and gathers fiber from bushes.", "axe": "Chops wood from wild trees.",
    "pickaxe": "Breaks rocks and ore, and picks machines back up.", "fishing_rod": "F to cast at any water.",
    "bug_net": "Hold it and E on a bug to catch it for the museum.",
    "shovel": "On the farm: dig ponds and rivers, fill them back in, lift paths and bridges.",
}


def describe(key):
    it = W.ITEMS[key]
    k = it["kind"]
    if k == "food" and key in COOK:
        b = COOK[key][3]
        return "Eat it (U, or the Eat button): +%d health%s. Sells %dg." % (COOK[key][4], (", " + BUFFS[b][0].lower()) if b else "", it["sell"])
    if key in MACHINE_TIPS:
        return MACHINE_TIPS[key]
    if key in GEAR_TIPS:
        return GEAR_TIPS[key]
    if k == "weapon":
        tail = (" Uses %s." % W.ITEMS[it["ammo"]]["name"].lower()) if it.get("ammo") else ""
        return "Power %d: %s.%s" % (it.get("dmg", 0), it.get("verb", "hit things"), tail)
    if k == "ammo":
        return "Ammunition for the %s." % ("bow" if key == "arrow" else "rifle")
    tips = {"artisan": "Fine goods from a farm machine. Sells for %dg, and villagers love them." % it["sell"],
            "game": "Wild game. Hank the butcher in the gulch dresses it into meat and hides.",
            "meat": "Cook it at the farmhouse fireplace, or sell it for %dg." % it["sell"],
            "bug": "A bug for the museum's collection (or sell it for %dg)." % it["sell"],
            "fossil": "Donate it to the museum, or sell it for %dg." % it["sell"],
            "artifact": "Donate it to the museum, or sell it for %dg." % it["sell"],
            "art": "A painting. The museum only hangs the genuine article.",
            "prize": "A festival prize. Something to be proud of.",
            "present": "E with it in hand to open it.",
            "ticket": "Take it to the boat at the beach to sail to a mystery island.",
            "treat": "Feed it to a weakened monster and it may follow you home.",
            "machine_kit": "Hold it and press E on farm ground (%s)." % ("lays a stone path" if key == "path_stone" else "spans dug water"),
            "key": "Lets you craft anywhere (C), no table needed." if key == "toolbelt" else "Press N to open it: the whole valley, and where everyone is right now.",
            "material": "A crafting material. Sells for %dg." % it["sell"]}
    if key == "star_fragment":
        return "A piece of a fallen star. Sells for %dg." % it["sell"]
    return tips.get(k) or ("Sells for %dg." % it["sell"] if it.get("sell") else None)
