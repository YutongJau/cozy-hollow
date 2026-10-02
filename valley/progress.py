"""Progress you can feel: levels unlock seeds, saplings, recipes and deeper mines, and fruit trees grow in marked tree
spots in the orchard meadow that open as you level. Leveling up is announced along with what it opened."""
import world as W
from valley import crafting as CR

# ------------------------------------------------------------------ what unlocks when
CROP_LEVEL = {"turnip": 0, "potato": 0, "radish": 1, "sunflower": 1, "snowdrop": 1, "strawberry": 2, "tomato": 3,
              "winter_root": 3, "corn": 4, "cauliflower": 5, "blueberry": 6, "cranberry": 7, "melon": 8, "pumpkin": 9,
              "starfruit": 14}
TREE_LEVEL = {"apple": 2, "cherry": 4, "peach": 7, "plum": 11, "oak": 18, "willow": 18, "bonsai": 18}
CRAFT_LEVEL = {"craft_table": 0, "chest_item": 0, "fabric": 1, "fertilizer": 1, "bug_net": 1, "path_stone": 2, "slingshot": 2,
               "sprinkler": 3, "cheese_press": 3, "preserves_jar": 4, "mayo_machine": 4, "bow": 5, "arrow": 5,
               "tailor_table": 5, "animal_trap": 6, "bee_house": 6, "sword_copper": 6, "monster_treat": 7, "toolbelt": 8,
               "bridge_kit": 9, "sword_iron": 10, "rock_tumbler": 12, "sword_gold": 16}


def cook_level(key):
    sell = W.ITEMS[key]["sell"]
    return 0 if sell <= 90 else 2 if sell <= 180 else 4 if sell <= 260 else 6 if sell <= 320 else 9


MINE_LEVEL = {"mine2": 4, "mine3": 8, "deep": 12}

# fruit trees take root only in these marked spots in the orchard meadow (x, y, the level that opens it); the last ones
# are grand spots. Spaced so no two trees ever crowd each other.
TREE_SPOTS = [(26, 18, 1), (30, 18, 1), (34, 18, 3), (38, 18, 3), (42, 18, 3), (26, 21, 6), (30, 21, 6), (34, 21, 6),
              (38, 21, 10), (42, 21, 10), (26, 24, 10), (30, 24, 15), (34, 24, 15), (38, 24, 25), (42, 24, 25)]
SPOT_AT = {(x, y): lv for x, y, lv in TREE_SPOTS}


def seed_level(key):
    it = W.ITEMS.get(key, {})
    if it.get("kind") == "seed":
        return CROP_LEVEL.get(it["crop"], 0)
    if it.get("kind") == "sapling":
        return TREE_LEVEL.get(it["tree"], 0)
    return 0


def craft_level(rk):
    return CRAFT_LEVEL.get(rk, CRAFT_LEVEL.get(CR.CRAFT[rk][0], 0) if rk in CR.CRAFT else 0)


def unlocks_at(level):
    """Everything that opens at exactly this level, as short labels."""
    out = []
    out += ["%s seeds" % W.CROPS[c]["name"] for c, lv in CROP_LEVEL.items() if lv == level and c in W.CROPS]
    out += ["%s saplings" % W.TREES[t]["name"] for t, lv in TREE_LEVEL.items() if lv == level and t in W.TREES and not W.TREES[t].get("rare")]
    if level == TREE_LEVEL["oak"]:
        out.append("planting legendary seeds")
    out += [W.ITEMS[CR.CRAFT[rk][0]]["name"] for rk in CR.CRAFT if craft_level(rk) == level and level > 0]
    out += [W.ITEMS[ck]["name"] for ck in CR.COOK if cook_level(ck) == level and level > 0]
    spots = sum(1 for _, _, lv in TREE_SPOTS if lv == level)
    if spots:
        out.append("%d tree spot%s" % (spots, "s" if spots > 1 else ""))
    out += [{"mine2": "the mine's 2nd level", "mine3": "the mine's 3rd level", "deep": "the Depths"}[k] for k, lv in MINE_LEVEL.items() if lv == level]
    return out


def next_unlocks(level, count=3):
    out, lv = [], level + 1
    while len(out) < count and lv <= W.MAX_LEVEL:
        u = unlocks_at(lv)
        if u:
            out.append((lv, u))
        lv += 1
        if lv > 40 and not out:
            break
    return out


class Progress:
    # ------------------------------------------------------------------ levels
    def level_of(self, p):
        return W.level_for(p.get("xp", 0))

    def _join_progress(self, p, now):
        p.setdefault("lv_seen", self.level_of(p))

    def _load_progress(self, d):
        for p in self.players.values():
            p.setdefault("lv_seen", self.level_of(p))

    def _tick_progress(self, now):
        for p in self.players.values():
            lv, seen = self.level_of(p), p.get("lv_seen")
            if seen is None:
                p["lv_seen"] = lv
            elif lv > seen:
                p["lv_seen"] = lv
                self.event("%s reached level %d: %s!" % (p["name"], lv, W.title_for(lv)), now, "good")
                opened = [u for level in range(seen + 1, lv + 1) for u in unlocks_at(level)]
                if opened:
                    self.say(p, "New for you: " + ", ".join(opened) + ".", "good")
                self.dirty = True

    def _priv_progress(self, p, d):
        nxt = next_unlocks(self.level_of(p), 1)
        d["next_unlock"] = ("Lv%d: %s" % (nxt[0][0], ", ".join(nxt[0][1]))) if nxt else ""

    def locked_msg(self, p, need):
        return "That opens at level %d (you're level %d)." % (need, self.level_of(p))

    # ------------------------------------------------------------------ the mine goes deeper as you grow
    def mine_gate(self, p, dest_loc):
        key = "deep" if dest_loc.startswith("deep") else dest_loc
        need = MINE_LEVEL.get(key)
        if need and self.level_of(p) < need:
            self.say(p, "The ladder creaks under you. Better come back stronger - %s opens at level %d." % (
                {"deep": "the Depths", "mine2": "the mine's 2nd level", "mine3": "the mine's 3rd level"}[key], need), "warn")
            return False
        return True

    # ------------------------------------------------------------------ tree spots
    def plant_at_spot(self, p, pos, sapling_key, now):
        """Plant a sapling in the marked spot ahead. Returns a message (always handled)."""
        need = SPOT_AT.get(pos)
        if need is None:
            return self.say(p, "Trees only take root in the marked tree spots - the little stakes in the orchard meadow south of the fields.", "warn")
        lv = self.level_of(p)
        if lv < need:
            return self.say(p, "This tree spot opens at level %d (you're level %d)." % (need, lv), "warn")
        tree = W.ITEMS[sapling_key]["tree"]
        if lv < TREE_LEVEL.get(tree, 0):
            return self.say(p, "You're not ready to grow a %s yet - that takes level %d." % (W.TREES[tree]["name"], TREE_LEVEL[tree]), "warn")
        tile = self.tile(pos)
        if tile.get("tree"):
            return self.say(p, "Something's already growing in this spot.")
        tile.pop("forage", None)
        return self.plant_tree(p, pos, tile, sapling_key, now)

    def _snap_progress(self, snap, now):
        pass
