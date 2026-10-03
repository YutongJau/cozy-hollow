"""Reshaping the farm: dig ponds and rivers with the landscaping shovel, fill them back in, lay stone paths, span water
with plank bridges. Everyone sees the new shape of the land."""
import world as W

W._item("shovel", "Landscaping Shovel", "gear", 0, "L", "L", "white", price=1000, verb="dig water, fill it in, lift paths (farm only)")
W._item("path_stone", "Path Stones", "machine_kit", 4, ":", ":", "white")
W._item("bridge_kit", "Bridge Kit", "machine_kit", 20, "H", "H", "yellow")


class Landscape:
    def protected(self, x, y):
        """Tiles the shovel leaves alone: the map's rim, doors and the paths off the farm, the pasture and yards, the altar."""
        if x <= 1 or y <= 1 or x >= W.MAP_W - 2 or y >= W.MAP_H - 2:
            return True
        if (x, y) in W.NO_CHEST or any(abs(x - ex) + abs(y - ey) <= 1 for ex, ey in W.FARM_EXITS):
            return True
        P = W.PASTURE
        if P["x0"] - 1 <= x <= P["x1"] + 1 and P["y0"] - 1 <= y <= P["y1"] + 1:
            return True
        if hasattr(self, "in_yard") and (self.in_yard(x, y) or self.terrain(x, y) in "#G@"):
            return True
        t = self.tiles.get((x, y), {})
        if any(t.get(k) for k in ("soil", "crop", "tree", "sprinkler", "machine")) or self.chest_at(x, y) or self.cow_at(x, y):
            return True
        return any(q["x"] == x and q["y"] == y and q.get("loc", "farm") == "farm" for q in self.players.values())

    def _use_land(self, p, loc, fx, fy, now):
        sel = self.selected_item(p)
        if sel not in ("shovel", "path_stone", "bridge_kit"):
            return False
        if loc != "farm":
            return self.say(p, "Landscaping is for the farm - the town likes its streets where they are.", "warn") or True
        if self.protected(fx, fy):
            return self.say(p, "Better leave that spot as it is.", "warn") or True
        ch = self.terrain(fx, fy)
        if sel == "shovel":
            if ch in ".d":
                self.tiles.pop((fx, fy), None)
                self.set_terrain("farm", fx, fy, "~")
                self.swing_anim(p, "hoe", (fx, fy))
                self.bump(p, "landscaped")
                return self.say(p, "Dug out a little water. (E on water with the shovel fills it back in.)", "good") or True
            if ch == "~":
                self.set_terrain("farm", fx, fy, ".")
                self.swing_anim(p, "hoe", (fx, fy))
                self.bump(p, "landscaped")
                return self.say(p, "Filled it in with good earth.", "good") or True
            if ch in ":H":
                self.set_terrain("farm", fx, fy, "." if ch == ":" else "~")
                self.give(p, "path_stone" if ch == ":" else "bridge_kit", 1)
                self.swing_anim(p, "hoe", (fx, fy))
                return self.say(p, "Lifted the %s." % ("path stones" if ch == ":" else "bridge planks"), "good") or True
            return self.say(p, "The shovel works on grass, water, paths and bridges.") or True
        if sel == "path_stone":
            if ch not in ".d":
                return self.say(p, "Path stones go on grass.") or True
            self.take(p, "path_stone", 1)
            self.tiles.pop((fx, fy), None)
            self.set_terrain("farm", fx, fy, ":")
            return self.say(p, "Laid a stone path.", "good") or True
        if sel == "bridge_kit":
            if ch != "~":
                return self.say(p, "Bridges go over water.") or True
            self.take(p, "bridge_kit", 1)
            self.set_terrain("farm", fx, fy, "H")
            return self.say(p, "Built a plank bridge.", "good") or True
        return False
