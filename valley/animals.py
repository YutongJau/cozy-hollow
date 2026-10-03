"""Animals: chickens in a coop yard, a pet that trots after you, a horse to ride."""
import random

import world as W
from valley import pets as PT

COOP = dict(kind="coop", label="COOP", x=4, y=18, w=6, h=4, to="coop")
YARD = dict(x0=11, y0=18, x1=21, y1=23)          # inside the chicken-yard fence
CHICKEN_PRICE = 300
MAX_CHICKENS = 10
EGG_EVERY = 3 * W.HOUR
CHICKEN_NAMES = ["Pip", "Nugget", "Clementine", "Henrietta", "Dottie", "Marigold", "Peaches", "Waffles", "Biscuit", "Olive", "Pancake", "Ginger"]
HORSE_PRICE = 1500
HORSE_COLORS = ["chestnut", "black", "white", "dapple"]
PET_NAMES = {"dog": ["Biscuit", "Scout", "Maple", "Rufus", "Bean"], "cat": ["Mochi", "Pumpkin", "Whiskers", "Juniper", "Tofu"]}

W.INTERIORS["coop"] = [
    "####W####W####",
    "#hh........hh#",
    "#h..........h#",
    "#....oooo....#",
    "#............#",
    "#hh........hh#",
    "######x#######",
]
W._item("chicken", "Chicken", "animal_buy", 0, "c", "c", "white", price=CHICKEN_PRICE)
W._item("adopt_dog", "Adopt a Dog", "animal_buy", 0, "d", "d", "yellow")
W._item("adopt_cat", "Adopt a Cat", "animal_buy", 0, "c", "c", "yellow")


class Animals:
    def _init_animals(self, now):
        self.chickens = getattr(self, "chickens", [])

    def _save_animals(self, out):
        out["chickens"] = self.chickens

    def _load_animals(self, d):
        self.chickens = d.get("chickens", [])
        seen = set()
        for c in self.chickens:            # every bird needs its own id (older saves could share one)
            if c.get("id") in seen:
                c["id"] = max(seen) + 1
            seen.add(c["id"])
        if any(b.get("kind") == "coop" for b in self.xbuildings.get("farm", [])):
            self.portals_for_coop()
        for p in self.players.values():
            p["riding"] = False

    def has_coop(self):
        return any(b.get("kind") == "coop" for b in self.xbuildings.get("farm", []))

    def build_coop(self, now):
        """Raise the coop and fence its yard (once)."""
        if self.has_coop():
            return
        self.add_building("farm", COOP)
        y0, y1, x0, x1 = YARD["y0"] - 1, YARD["y1"] + 1, YARD["x0"] - 1, YARD["x1"] + 1
        for x in range(x0, x1 + 1):
            for y in (y0, y1):
                self.set_terrain("farm", x, y, "#")
        for y in range(y0, y1 + 1):
            for x in (x0, x1):
                self.set_terrain("farm", x, y, "#")
        self.set_terrain("farm", (x0 + x1) // 2, y1, "G")
        for y in range(YARD["y0"], YARD["y1"] + 1):
            for x in range(YARD["x0"], YARD["x1"] + 1):
                if self.terrain(x, y) not in ".":
                    self.set_terrain("farm", x, y, ".")
                t = self.tiles.get((x, y))
                if t and not t.get("tree"):
                    self.tiles.pop((x, y), None)
        for y in range(COOP["y"] + COOP["h"], COOP["y"] + COOP["h"] + 1):
            self.set_terrain("farm", COOP["x"] + COOP["w"] // 2, y, ":")
        self.event("Oakley built a chicken coop on the farm! Chickens are for sale at the seed shop now.", now, "good")

    def portals_for_coop(self):
        pass   # add_building (called on load for saved buildings) already wired the doors

    def in_yard(self, x, y):
        return YARD["x0"] <= x <= YARD["x1"] and YARD["y0"] <= y <= YARD["y1"] and self.terrain(x, y) == "."

    def chicken_at(self, x, y):
        for c in self.chickens:
            if c["x"] == x and c["y"] == y:
                return c
        return None

    def _block_animals(self, loc, x, y):
        return loc == "farm" and self.chicken_at(x, y) is not None

    # ------------------------------------------------------------------ ticking
    def _fast_animals(self, now):
        """When you stop for a moment, your pet trots up and sits beside you (left or right, where you can see and pet it)."""
        for p in self.players.values():
            pet = p.get("pet")
            if not pet or not p.get("online") or now - p.get("stepped", 0) < 1.2 or pet.get("sat") == p.get("stepped", 0):
                continue
            loc = p.get("loc", "farm")
            if pet.get("loc") != loc:
                continue
            fx, fy = p["facing"]
            sides = [(p["x"] + fy, p["y"] + fx), (p["x"] - fy, p["y"] - fx), (p["x"] - fx, p["y"] - fy), (p["x"] + fx, p["y"] + fy)]
            if fy:                                                   # facing up or down: left or right of you
                sides = [(p["x"] - 1, p["y"]), (p["x"] + 1, p["y"]), (p["x"], p["y"] + 1)]
            cur = (pet.get("x"), pet.get("y"))
            if cur in sides[:2]:
                pet["sat"] = p.get("stepped", 0)
                continue
            spot = next((s for s in sides if self.walkable(s[0], s[1], loc) and not self.portal(loc, s[0], s[1])
                         and abs(s[0] - cur[0]) + abs(s[1] - cur[1]) <= 3), None)
            pet["sat"] = p.get("stepped", 0)
            if spot:
                pet["f"] = [max(-1, min(1, p["x"] - spot[0])), max(-1, min(1, p["y"] - spot[1]))]
                pet["x"], pet["y"] = spot
                self.moved = True

    def _tick_animals(self, now):
        for c in self.chickens:
            c["egg"] = min(EGG_EVERY, c.get("egg", 0) + max(0.0, now - c.get("t", now)))
            c["t"] = now
            if now < c.get("next", 0):
                continue
            c["next"] = now + random.uniform(0.6, 2.5)
            if random.random() < 0.4:
                continue
            dx, dy = random.choice([(1, 0), (-1, 0), (0, 1), (0, -1)])
            nx, ny = c["x"] + dx, c["y"] + dy
            if self.in_yard(nx, ny) and not self.chicken_at(nx, ny) and not any(
                    q.get("online") and q.get("loc", "farm") == "farm" and (q["x"], q["y"]) == (nx, ny) for q in self.players.values()):
                c["x"], c["y"] = nx, ny
                if dx:
                    c["facing"] = dx
                self.dirty = True
        for p in self.players.values():
            if p.get("riding") and not (p.get("online") and self.is_outdoor(p.get("loc", "farm")) and not p.get("loc", "").startswith(("mine", "deep"))):
                p["riding"] = False

    def _snap_animals(self, snap, now):
        snap["chickens"] = [dict(id=c["id"], name=c["name"], x=c["x"], y=c["y"], f=c.get("facing", 1), c=c.get("color", "white"),
                                 egg=c.get("egg", 0) >= EGG_EVERY) for c in self.chickens]
        snap["pets"] = [dict(owner=p["name"], kind=p["pet"]["kind"], sp=PT.species(p["pet"]["kind"]), name=p["pet"]["name"], loc=p["pet"].get("loc", "farm"),
                             x=p["pet"].get("x", p["x"]), y=p["pet"].get("y", p["y"]), f=p["pet"].get("f", [0, 1]))
                        for p in self.players.values() if p.get("pet") and p.get("online")]

    def _pub_animals(self, p, d, now):
        d["riding"] = bool(p.get("riding"))
        if p.get("horse"):
            d["horse"] = p["horse"].get("color", "chestnut")

    def _priv_animals(self, p, d):
        d["has_horse"] = bool(p.get("horse"))

    # ------------------------------------------------------------------ the pet follows its farmer
    def _join_animals(self, p, now):
        pet = p.get("pet")
        if pet and pet.get("loc") != p.get("loc", "farm"):     # the pet waits wherever you logged in
            self._arrive_animals(p, None, now)

    def place_pet(self, p):
        """The pet lands beside you (behind you if there's room), never on your own tile where you'd hide it."""
        pet = p.get("pet")
        if not pet:
            return
        loc, fx, fy = p.get("loc", "farm"), p["facing"][0], p["facing"][1]
        spots = [(p["x"] - fx, p["y"] - fy), (p["x"] + fy, p["y"] + fx), (p["x"] - fy, p["y"] - fx), (p["x"] + fx, p["y"] + fy),
                 (p["x"] - 1, p["y"] - 1), (p["x"] + 1, p["y"] - 1), (p["x"] - 1, p["y"] + 1), (p["x"] + 1, p["y"] + 1)]
        spot = next((s for s in spots if self.walkable(s[0], s[1], loc) and not self.portal(loc, s[0], s[1])), (p["x"], p["y"]))
        pet["loc"], pet["x"], pet["y"] = loc, spot[0], spot[1]
        pet["f"] = [max(-1, min(1, p["x"] - spot[0])), max(-1, min(1, p["y"] - spot[1]))]
        if pet["f"][0] and pet["f"][1]:
            pet["f"][1] = 0
        p["trail"] = []

    def _arrive_animals(self, p, frm, now):
        if p.get("pet"):
            self.place_pet(p)
        if p.get("riding") and (p.get("loc", "farm") in W.INTERIORS or p.get("loc", "").startswith(("mine", "deep"))):
            p["riding"] = False
            self.say(p, "You tie up your horse outside.")

    def pet_follow(self, p, ox, oy):
        """Called after the farmer steps from (ox, oy). The pet trails two steps behind (one if you doubled back), so it is
        never on your tile or tucked right behind you where your farmer would hide it."""
        pet = p.get("pet")
        if not pet:
            return
        trail = p.setdefault("trail", [])
        if pet.get("loc") != p.get("loc", "farm"):
            pet["loc"] = p.get("loc", "farm")
            del trail[:]
        trail.append([ox, oy])
        del trail[:-3]
        p["stepped"] = W.time.time()
        here = [p["x"], p["y"]]
        target = next((t for t in (trail[-2] if len(trail) >= 2 else None, trail[-1]) if t and list(t) != here), None)
        if not target:
            return
        tx, ty = target
        if (pet.get("x"), pet.get("y")) != (tx, ty):
            pet["f"] = [max(-1, min(1, tx - pet.get("x", tx))), max(-1, min(1, ty - pet.get("y", ty)))]
            if pet["f"][0] and pet["f"][1]:
                pet["f"][1] = 0
        pet["x"], pet["y"] = tx, ty

    def pet_at(self, loc, x, y):
        for q in self.players.values():
            pet = q.get("pet")
            if pet and q.get("online") and pet.get("loc", "farm") == loc and (pet.get("x"), pet.get("y")) == (x, y):
                return q, pet
        return None, None

    # ------------------------------------------------------------------ E: chickens and pets
    def _use_animals(self, p, loc, fx, fy, now):
        owner, pet = self.pet_at(loc, fx, fy)
        if pet:
            pet["love"] = pet.get("love", 0) + 1
            pet["bubble"] = now
            p["bubble"] = ["<3", now + 2]
            self.dirty = True
            mine = owner is p
            return self.say(p, "%s %s.%s" % (pet["name"], PT.noise(pet["kind"]), "" if mine else " (%s's %s)" % (owner["name"], PT.species(pet["kind"]).lower())), "good") or True
        if loc == "farm":
            c = self.chicken_at(fx, fy)
            if c:
                if c.get("egg", 0) >= EGG_EVERY:
                    c["egg"] = 0.0
                    n = 2 if self.has_buff(p, "luck", now) and random.random() < 0.3 else 1
                    self.give(p, "egg", n)
                    self.fx(p, "lift", "egg", (fx, fy))
                    p["xp"] += 6
                    self.bump(p, "eggs", n)
                    self.dirty = True
                    self.say(p, "%s laid %s!" % (c["name"], "two eggs" if n > 1 else "an egg"), "good")
                else:
                    self.say(p, "%s clucks at you. (egg in %s)" % (c["name"], W.fmt_duration(EGG_EVERY - c.get("egg", 0))))
                return True
        if loc == "coop":
            ch = self.terrain(fx, fy, loc)
            if ch in "ho":
                return self.say(p, "Fresh straw and a feed trough. The hens are out in the yard.") or True
        return False

    # ------------------------------------------------------------------ buying animals
    def buy_chicken(self, p, now):
        if not self.has_coop():
            return self.say(p, "You'll need a coop first - Oakley the carpenter in town can build one.", "warn")
        if len(self.chickens) >= self.chicken_cap():
            return self.say(p, "The coop is full (%d chickens). Oakley can build a bigger one." % self.chicken_cap(), "warn")
        if self.coins < CHICKEN_PRICE:
            return self.say(p, "Not enough coins (a chicken is %dg)." % CHICKEN_PRICE, "warn")
        spots = [(x, y) for y in range(YARD["y0"], YARD["y1"] + 1) for x in range(YARD["x0"], YARD["x1"] + 1)
                 if self.in_yard(x, y) and not self.chicken_at(x, y)]
        if not spots:
            return self.say(p, "There's no room in the yard.", "warn")
        x, y = random.choice(spots)
        used = {c["name"] for c in self.chickens}
        name = random.choice([n for n in CHICKEN_NAMES if n not in used] or CHICKEN_NAMES)
        self.coins -= CHICKEN_PRICE
        self.chickens.append(dict(id=max([c["id"] for c in self.chickens] + [0]) + 1, name=name, x=x, y=y, facing=1, egg=0.0, t=now,
                                  color=random.choice(["white", "brown", "white", "black"])))
        self.bump(p, "spent", CHICKEN_PRICE)
        self.event("%s bought a chicken! %s is pecking around the yard." % (p["name"], name), now, "good")

    def adopt(self, p, kind, now):
        owned = p.setdefault("pets", {})
        if kind in owned:
            return self.say(p, "%s would be jealous!" % self.pet_entry(p, kind)["name"])
        name = random.choice(PET_NAMES[kind])
        owned[kind] = dict(name=name, love=0, got=now, how="adopted")
        follows = not p.get("pet")
        if follows:
            self.pet_follow_me(p, kind)
        self.dirty = True
        self.event("%s adopted a %s named %s! (rename it with /petname)" % (p["name"], kind, name), now, "good")
        if not follows:
            self.say(p, "%s is settling in at home. Press P to call your pets." % name)

    def buy_horse(self, p, color, now):
        if p.get("horse"):
            return self.say(p, "You already have a horse. Press R outdoors to ride.")
        if self.coins < HORSE_PRICE:
            return self.say(p, "A horse costs %dg." % HORSE_PRICE, "warn")
        self.coins -= HORSE_PRICE
        p["horse"] = dict(color=color if color in HORSE_COLORS else "chestnut")
        self.bump(p, "spent", HORSE_PRICE)
        self.event("%s bought a %s horse in Dusty Gulch! Press R outdoors to ride." % (p["name"], p["horse"]["color"]), now, "good")

    def act_ride(self, p, msg, now):
        """R: hop on (or off) your horse, wherever you are outdoors."""
        if not p.get("horse"):
            return self.say(p, "You don't have a horse yet. The stable in Dusty Gulch sells them.")
        loc = p.get("loc", "farm")
        if not self.is_outdoor(loc) or loc.startswith(("mine", "deep")):
            return self.say(p, "No room for a horse in here.")
        if p.get("carry"):
            return self.say(p, "Set the chest down first.", "warn")
        p["riding"] = not p.get("riding")
        self.dirty = True
        self.say(p, "Giddy-up!" if p["riding"] else "You hop down and pat your horse.", "good" if p["riding"] else "info")

    def stable_menu(self, p, now):
        if not self.unlocked("stable"):
            return self.say(p, "The stable is falling apart. The town's projects board at the Town Hall could fix it up.")
        rows = []
        if p.get("horse"):
            rows.append(dict(label="Your %s horse" % p["horse"]["color"], info="Press R outdoors to ride or hop down.", ok=False, right=""))
        else:
            for c in HORSE_COLORS:
                rows.append(dict(horse=c, label="%s horse" % c.capitalize(), info="Gallops at nearly twice walking pace.",
                                 right="%dg" % HORSE_PRICE, act=dict(t="buy_horse", color=c), ok=self.coins >= HORSE_PRICE))
        self.list_menu(p, "stable", "Dusty Gulch Stable", rows, sub="%dg shared" % self.coins, keep=True)

    def act_buy_horse(self, p, msg, now):
        if p.get("loc") != "frontier" or not self.unlocked("stable"):
            return
        self.buy_horse(p, msg.get("color"), now)
        self.stable_menu(p, now)

    def act_adopt(self, p, msg, now):
        if p.get("loc") != "clinic":
            return
        if msg.get("kind") in PET_NAMES:
            self.adopt(p, msg["kind"], now)
        self.out.append((p["name"], dict(t="open", menu="close")))
