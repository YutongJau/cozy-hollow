"""Little wonders: shooting stars to wish on (star fragments wash up on the beach by morning), presents floating by on
balloons (pop one with a slingshot, bow or rifle), and voyages to mystery islands that are different every time."""
import math
import random

import areas as AR
import world as W

MIN = W.MINUTE
W._item("star_fragment", "Star Fragment", "mineral", 80, "*", "*", "yellow")
W._item("present", "Present", "present", 0, "&", "&", "red")
W._item("mystery_ticket", "Mystery Ticket", "ticket", 0, "=", "=", "cyan", price=500)
BALLOON_AREAS = ("farm", "town", "forest", "beach", "mountain", "island", "frontier")
PRESENTS = [("fabric", 3, 14), ("honey", 2, 10), ("monster_treat", 3, 8), ("star_fragment", 1, 8), ("bee_house", 1, 4), ("cheese_press", 1, 4),
            ("diamond", 1, 3), ("ruby", 1, 5), ("art_meadow_dawn", 1, 2), ("mystery_ticket", 1, 5), ("#coins", 500, 14), ("#hat", 1, 10),
            ("arrow", 20, 8), ("pumpkin_pie", 1, 6)]
ISLAND_KINDS = [("orchard", "Orchard Isle"), ("rocky", "Rocky Isle"), ("bugs", "Buzzing Isle"), ("fishing", "Lagoon Isle"), ("flowers", "Blossom Isle")]


class Skies:
    def _init_sky(self, now):
        self.star = None              # {id, t0} while a shooting star is crossing the sky
        forced = W.os.environ.get("COZY_STAR_IN")    # the host can ask for a star: COZY_STAR_IN=<seconds> when starting the server
        self.star_next = now + (float(forced) if forced else random.uniform(40, 90))
        self.star_forced = bool(forced)
        self.wishes = getattr(self, "wishes", 0)
        self.balloon = None           # {loc, x, y, vx, t0, id}
        self.balloon_next = now + random.uniform(120, 240)
        self.mystery = getattr(self, "mystery", None)

    def _save_sky(self, out):
        out["wishes"] = self.wishes

    def _load_sky(self, d):
        self.wishes = d.get("wishes", 0)

    def _name_sky(self, loc):
        if loc == "mystery" and self.mystery:
            return self.mystery["name"]
        return None

    def _fish_sky(self, loc):
        if loc == "mystery" and self.mystery:
            return ["tuna", "blue_tang", "lionfish", "octopus", "pufferfish", "red_snapper", "golden_koi"] if self.mystery["kind"] == "fishing" else ["blue_tang", "tuna", "sardine", "red_snapper", "seaweed"]
        return None

    # ------------------------------------------------------------------ shooting stars
    def _fast_sky(self, now):
        h = self.sky_hour(now)
        outdoors = [q for q in self.players.values() if q.get("online") and self.is_outdoor(q.get("loc", "farm")) and not q.get("loc", "").startswith(("mine", "deep"))]
        if self.star and now - self.star["t0"] > 3.5:
            self.star = None
        if not self.star and now >= self.star_next:
            if self.star_forced and not outdoors:
                self.star_next = now + 2                  # the host's star waits until someone is outside to see it
                return
            self.star_next = now + random.uniform(35, 110)
            if outdoors and (self.star_forced or ((h >= 20.5 or h < 4.5) and self.weather_at(now) == "sun")):
                self.star_forced = False
                self.star = dict(id=random.randint(1, 10 ** 9), t0=now, x=random.random(), y=random.uniform(0.05, 0.35), dx=random.choice((-1, 1)))
                self.out.append(("all", dict(t="star", id=self.star["id"], x=self.star["x"], y=self.star["y"], dx=self.star["dx"])))
        # a present drifting by on a balloon, over wherever somebody is
        b = self.balloon
        if b:
            dt = now - b["t"]
            b["t"] = now
            b["x"] += b["vx"] * dt
            b["y"] = b["y0"] + math.sin((now - b["t0"]) * 0.9) * 0.8
            rows = self.rows_of(b["loc"])
            if not rows or b["x"] < -3 or b["x"] > len(rows[0]) + 3 or not any(q.get("loc", "farm") == b["loc"] for q in outdoors):
                self.balloon = None
            self.moved = True
        elif now >= self.balloon_next:
            self.balloon_next = now + random.uniform(150, 330)
            cands = [q for q in outdoors if q.get("loc", "farm") in BALLOON_AREAS]
            if cands and 7.5 <= h < 18:
                q = random.choice(cands)
                rows = self.rows_of(q.get("loc", "farm"))
                vx = random.choice((1.1, -1.1))
                self.balloon = dict(id=random.randint(1, 10 ** 9), loc=q.get("loc", "farm"), x=-2.0 if vx > 0 else len(rows[0]) + 2.0,
                                    y0=max(2.0, min(len(rows) - 3.0, q["y"] + random.uniform(-4, 2))), y=0.0, vx=vx, t0=now, t=now)
                self.balloon["y"] = self.balloon["y0"]
                self.moved = True

    def _tick_sky(self, now):
        # wishes made overnight wash up as star fragments on the beach in the morning
        h = self.sky_hour(now)
        if self.wishes and 6 <= h < 7:
            rng = random.Random(int(now))
            rows = self.rows_of("beach")
            for _ in range(min(self.wishes, 6)):
                for _ in range(40):
                    x, y = rng.randint(1, len(rows[0]) - 2), rng.randint(8, len(rows) - 2)
                    if rows[y][x] == "," and (x, y) not in self.atiles["beach"]:
                        self.atiles["beach"][(x, y)] = dict(forage="star_fragment")
                        break
            self.event("Star fragments glitter on Driftwood Beach this morning...", now, "good")
            self.wishes = 0
            self.dirty = True

    def _snap_sky(self, snap, now):
        b = self.balloon
        snap["balloon"] = dict(loc=b["loc"], x=round(b["x"], 2), y=round(b["y"], 2), id=b["id"]) if b else None
        snap["mystery"] = dict(name=self.mystery["name"], kind=self.mystery["kind"], rev=self.mystery["rev"]) if self.mystery else None

    def act_wish(self, p, msg, now):
        if not self.star or int(msg.get("id", 0)) != self.star["id"]:
            return self.say(p, "Too late - it's gone. Watch the sky...")
        wished = self.star.setdefault("wished", [])
        if p["name"] in wished:
            return
        wished.append(p["name"])
        self.wishes += 1
        self.bump(p, "wishes")
        p["bubble"] = ["★ a wish ★", now + 3]
        self.check_milestones(now)
        self.say(p, "You make a wish on the shooting star...", "good")

    def pop_balloon(self, p, now):
        """Called by a ranged shot that crosses the balloon: the present falls to the ground below it."""
        b = self.balloon
        self.balloon = None
        loc = b["loc"]
        x, y = int(round(b["x"])), int(round(b["y"]))
        spot = None
        for r in range(0, 6):
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    tx, ty = x + dx, y + dy
                    if self.walkable(tx, ty, loc) and (loc != "farm" or not self.tiles.get((tx, ty))) and (tx, ty) not in self.atiles.get(loc, {}):
                        spot = (tx, ty)
                        break
                if spot:
                    break
            if spot:
                break
        if not spot:
            spot = (p["x"], p["y"])
        if loc == "farm":
            self.tile(spot)["forage"] = "present"
        else:
            self.atiles.setdefault(loc, {})[spot] = dict(forage="present")
        self.out.append(("all", dict(t="pop", loc=loc, x=b["x"], y=b["y"], tx=spot[0], ty=spot[1])))
        self.event("%s popped a balloon! A present floated down." % p["name"], now, "good")
        self.dirty = True

    def open_present(self, p, now):
        kinds = [x for x in PRESENTS]
        key, n, _ = random.choices(kinds, [x[2] for x in kinds])[0]
        if key == "#coins":
            self.coins += n
            return self.say(p, "Inside the present: %dg!" % n, "good")
        if key == "#hat":
            hat = random.choice(["straw", "flower", "beanie", "tophat", "bandana"])
            p.setdefault("wardrobe", ["cowboy", "none"])
            if hat not in p["wardrobe"]:
                p["wardrobe"].append(hat)
            return self.say(p, "Inside the present: a hat! (Wear it at a tailoring table.)", "good")
        self.give(p, key, n)
        self.say(p, "Inside the present: %s%s!" % ("%d " % n if n > 1 else "a ", W.ITEMS[key]["name"]), "good")

    # ------------------------------------------------------------------ mystery islands
    def sail_menu(self, p, now):
        rows = [dict(label="Palm Isle", info="Coco's tiki hut, coconuts and the volcano.", act=dict(t="sail", to="island"), ok=True, right="Sail")]
        if self.unlocked("harbor"):
            t = self.count(p, "mystery_ticket")
            rows.append(dict(key="mystery_ticket", label="A mystery island", info="Uses a Mystery Ticket (%d in your bag). Old Tomas sells them." % t,
                             act=dict(t="sail", to="mystery"), ok=t > 0, right="Sail"))
        self.list_menu(p, "sail", "The little boat", rows, sub="Where to?")

    def act_sail(self, p, msg, now):
        if p.get("loc") != "beach":
            return
        to = msg.get("to")
        self.out.append((p["name"], dict(t="open", menu="close")))
        if to == "island":
            return self.travel(p, ("island", 29, 25, (0, -1)), now, "You row out to Palm Isle...")
        if to == "mystery" and self.unlocked("harbor"):
            if not self.take(p, "mystery_ticket", 1):
                return self.say(p, "You need a Mystery Ticket.", "warn")
            if not self.mystery or not self.online_in("mystery"):
                self.make_mystery(now)
            dx, dy = self.mystery["dock"]
            self.bump(p, "voyages")
            self.credit(p, "explore")
            self.check_milestones(now)
            return self.travel(p, ("mystery", dx, dy - 1, (0, -1)), now, "The boat bobs off over the waves to %s..." % self.mystery["name"])

    def make_mystery(self, now):
        rng = random.Random(int(now * 1000) ^ self.seed)
        kind, name = rng.choice(ISLAND_KINDS)
        W_, H_ = 48, 32
        g = [["~"] * W_ for _ in range(H_)]
        cx, cy = W_ / 2, H_ / 2 - 1
        bumps = [(rng.uniform(0, 6.3), rng.uniform(0.1, 0.25), rng.randint(2, 5)) for _ in range(4)]
        for y in range(H_):
            for x in range(W_):
                a = math.atan2(y - cy, (x - cx) * 0.7)
                r = 1 + sum(amp * math.sin(k * a + ph) for ph, amp, k in bumps)
                e = ((x - cx) / (18 * r)) ** 2 + ((y - cy) / (11 * r)) ** 2
                if e < 0.62:
                    g[y][x] = "."
                elif e < 1.0:
                    g[y][x] = ","
        dock_x = int(cx)
        for y in range(H_ - 7, H_ - 1):
            if g[y][dock_x] == "~" or y > H_ - 4:
                g[y][dock_x] = "H"
        g[H_ - 1][dock_x] = "V"
        y = H_ - 7
        while y > 0 and g[y][dock_x] == "~":
            g[y][dock_x] = "H"
            y -= 1
        land = [(x, y) for y in range(H_) for x in range(W_) if g[y][x] in ".,"]
        rng.shuffle(land)
        features = {"orchard": ("A", 22), "rocky": ("o", 14), "bugs": ("u", 30), "fishing": ("u", 10), "flowers": ("f", 26)}[kind]
        for (x, y) in land[:features[1]]:
            if g[y][x] == "." or features[0] == "A":
                g[y][x] = features[0]
        for (x, y) in land[features[1]:features[1] + 12]:
            if g[y][x] == ".":
                g[y][x] = rng.choice("Auf")
        if kind == "fishing":
            for _ in range(3):
                px, py = rng.choice(land)
                for yy in range(py - 1, py + 2):
                    for xx in range(px - 2, px + 3):
                        if 0 < xx < W_ - 1 and 0 < yy < H_ - 1 and g[yy][xx] == ".":
                            g[yy][xx] = "~"
        rows = ["".join(r) for r in g]
        self.dyn_maps["mystery"] = rows
        self.dyn_rev["mystery"] = self.dyn_rev.get("mystery", 0) + 1
        self.mystery = dict(name=name, kind=kind, rev=self.dyn_rev["mystery"], dock=(dock_x, H_ - 1))
        tiles = self.atiles["mystery"] = {}
        open_ground = [(x, y) for y in range(H_) for x in range(W_) if rows[y][x] in ".,"]
        rng.shuffle(open_ground)
        pick = {"orchard": ["cherry", "apple", "peach", "plum", "coconut"], "rocky": [], "bugs": ["wild_berry", "ginger"], "fishing": ["seashell", "coral", "clam"],
                "flowers": ["daffodil", "dandelion", "sunflower", "wild_berry"]}[kind]
        for (x, y) in open_ground[:18]:
            if pick:
                tiles[(x, y)] = dict(forage=rng.choice(pick))
        if kind == "rocky":
            for (x, y) in open_ground[18:40]:
                tiles[(x, y)] = dict(ore=rng.choices(["stone", "copper_ore", "iron_ore", "gold_ore", "amethyst", "emerald", "ruby", "diamond"],
                                                     [30, 20, 15, 12, 8, 6, 6, 3])[0])
        else:
            for (x, y) in open_ground[18:24]:
                tiles[(x, y)] = dict(ore=rng.choice(["stone", "copper_ore", "quartz"]))
        if kind == "bugs":
            self.bugs["mystery"] = {pos: dict(k=rng.choice(["rainbow_beetle", "swallowtail", "monarch", "tarantula", "hermit_crab", "luna_moth"]), until=now + 3600)
                                    for pos in open_ground[24:36]}
        # the boat home
        self.xportals = {k: v for k, v in self.xportals.items() if k[0] != "mystery"}
        self.out.append(("all", dict(t="area", name="mystery", map=rows, rev=self.dyn_rev["mystery"], title=name)))
        self.dirty = True

    def _use_sky(self, p, loc, fx, fy, now):
        ch = self.terrain(fx, fy, loc) if self.is_outdoor(loc) else ""
        if loc == "beach" and ch == "V":
            return self.sail_menu(p, now) or True
        if loc == "mystery" and ch == "V":
            return self.travel(p, ("beach", 22, 25, (0, 1)), now, "You sail home to Driftwood Beach.") or True
        for pos in ((fx, fy), (p["x"], p["y"])):
            t = (self.tiles.get(pos) if loc == "farm" else self.atiles.get(loc, {}).get(pos)) or {}
            if t.get("forage") == "present":
                t.pop("forage")
                if loc == "farm":
                    self.prune(pos)
                else:
                    self.atiles[loc].pop(pos, None)
                self.fx(p, "lift", "present", pos)
                self.dirty = True
                self.open_present(p, now)
                return True
        return False
