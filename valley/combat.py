"""Adventure: swords, a slingshot, a bow and a rifle; monsters in the mine and the endless Depths below it (tame one with a
treat and it fights beside you); wild game in the woods, hills and gulch to hunt, and the butcher to dress it."""
import collections
import random

import areas as AR
import world as W

W._item("sword_rusty", "Rusty Sword", "weapon", 0, "/", "/", "white", dmg=8, verb="hit monsters in front of you")
W._item("sword_copper", "Copper Sword", "weapon", 0, "/", "/", "orange", dmg=14, verb="hit monsters in front of you")
W._item("sword_iron", "Iron Sword", "weapon", 0, "/", "/", "white", dmg=22, verb="hit monsters in front of you")
W._item("sword_gold", "Golden Sword", "weapon", 0, "/", "/", "yellow", dmg=34, verb="hit monsters in front of you")
W._item("slingshot", "Slingshot", "weapon", 0, "Y", "Y", "yellow", dmg=6, ammo="stone", range=6, price=200, verb="shoot stones (balloons, critters, monsters)")
W._item("bow", "Bow", "weapon", 0, ")", ")", "yellow", dmg=16, ammo="arrow", range=8, price=400, verb="shoot arrows")
W._item("rifle", "Rifle", "weapon", 0, "=", "=", "white", dmg=40, ammo="bullet", range=12, price=2000, verb="shoot bullets")
W._item("arrow", "Arrow", "ammo", 1, "|", "|", "yellow", price=3)
W._item("bullet", "Bullet", "ammo", 2, ".", ".", "white", price=6)
W._item("slime_jelly", "Slime Jelly", "material", 20, "o", "o", "green")
W._item("bat_wing", "Bat Wing", "material", 25, "v", "v", "magenta")
W._item("crab_shell", "Crab Shell", "material", 35, "o", "o", "red")
W._item("ectoplasm", "Ectoplasm", "material", 60, "~", "~", "cyan")
W._item("treasure_key", "Old Key", "material", 50, "k", "k", "yellow")

# monster: hp, damage, step seconds, aggro range, drops [(item, weight)], xp
MONSTERS = {
    "slime": dict(name="Green Slime", hp=20, dmg=4, step=0.9, aggro=6, drops=[("slime_jelly", 70), ("coal", 15), ("copper_ore", 15)], xp=6),
    "blue_slime": dict(name="Frost Slime", hp=34, dmg=9, step=0.8, aggro=7, drops=[("slime_jelly", 60), ("iron_ore", 25), ("quartz", 15)], xp=10),
    "bat": dict(name="Cave Bat", hp=14, dmg=4, step=0.38, aggro=8, drops=[("bat_wing", 75), ("coal", 25)], xp=7),
    "rock_crab": dict(name="Rock Crab", hp=46, dmg=11, step=0.7, aggro=3, drops=[("crab_shell", 60), ("iron_ore", 25), ("gold_ore", 15)], xp=14),
    "ghost": dict(name="Mine Ghost", hp=60, dmg=14, step=0.55, aggro=9, drops=[("ectoplasm", 60), ("gold_ore", 20), ("amethyst", 12), ("ruby", 8)], xp=20),
    "slime_king": dict(name="Slime King", hp=260, dmg=18, step=1.0, aggro=9, drops=[("diamond", 50), ("prismatic_shard", 10), ("treasure_key", 40)], xp=120),
}
LEVEL_MONSTERS = {"mine1": (["slime", "slime", "bat"], 4), "mine2": (["slime", "blue_slime", "bat", "rock_crab"], 6),
                  "mine3": (["blue_slime", "bat", "rock_crab", "ghost"], 7)}
# wild game: hp, step, flee range, game item
CRITTERS = {"rabbit": dict(name="Wild Rabbit", hp=1, step=0.45, flee=4, item="wild_rabbit"), "quail": dict(name="Quail", hp=1, step=0.5, flee=3, item="quail"),
            "deer": dict(name="Deer", hp=2, step=0.5, flee=5, item="deer"), "boar": dict(name="Wild Boar", hp=3, step=0.6, flee=0, item="boar", dmg=8)}
CRITTER_AREAS = {"forest": (["rabbit", "rabbit", "deer", "boar", "quail"], 5), "mountain": (["rabbit", "deer", "quail"], 4),
                 "frontier": (["quail", "quail", "rabbit"], 4), "island": (["boar"], 2)}
REGEN = 3.0                    # seconds per health point regained out of a fight
HIT_COOLDOWN = 1.6
INVULN = 1.5          # after a hit you get a moment to back off before anything can hurt you again
ASH_GOALS = [("slimes", 20, "Slime Slayer", ("sword_copper", 1), 500), ("bats", 15, "Bat Batter", ("bow", 1), 400),
             ("crabs", 10, "Crab Cracker", ("monster_treat", 5), 600), ("ghosts", 8, "Ghost Buster", ("sword_iron", 1), 1000),
             ("depth", 5, "Delver", ("rifle", 1), 1500), ("depth", 10, "Deep Delver", ("sword_gold", 1), 3000), ("kings", 1, "Kingslayer", ("prismatic_shard", 1), 5000)]


class Combat:
    def _init_combat(self, now):
        self.mobs = {}                 # loc -> [monster]
        self.critters = {}             # loc -> [critter]
        self.next_id = 1
        self.ash_done = getattr(self, "ash_done", {})

    def _save_combat(self, out):
        out["ash_done"] = self.ash_done

    def _load_combat(self, d):
        self.ash_done = d.get("ash_done", {})
        for p in self.players.values():
            p.setdefault("hp", W.MAX_HP)

    def _name_combat(self, loc):
        if loc.startswith("deep"):
            return "the Depths (floor %s)" % loc[4:]
        return None

    def _pub_combat(self, p, d, now):
        c = p.get("companion")
        if c:
            d["companion"] = dict(kind=c["kind"], name=c["name"], x=c.get("x", p["x"]), y=c.get("y", p["y"]), loc=c.get("loc", p.get("loc", "farm")))
        if p.get("hurt", 0) > now:
            d["hurt"] = 1

    def _priv_combat(self, p, d):
        d["deepest"] = p.get("deepest", 0)

    def uid(self):
        self.next_id += 1
        return self.next_id

    # ------------------------------------------------------------------ the Depths: a new cave floor each time you go down
    def deep_floor(self, n):
        loc = "deep%d" % n
        if loc in self.dyn_maps:
            return loc
        rows, _ = AR.build_mine(100 + n)
        rows = [list(r) for r in rows]
        rng = random.Random(self.seed ^ (n * 7919) ^ int(W.time.time() // W.DAY))
        for _ in range(3 + n // 3):                    # treasure chests in the side caves
            for _ in range(50):
                x, y = rng.randint(2, 37), rng.randint(2, 23)
                if rows[y][x] == "v" and rows[y - 1][x] == "R":
                    rows[y][x] = "Z"
                    break
        rows = ["".join(r) for r in rows]
        self.dyn_maps[loc] = rows
        self.dyn_rev[loc] = self.dyn_rev.get(loc, 0) + 1
        self.atiles[loc] = {}
        up, down = AR.find_rows(rows, "U"), AR.find_rows(rows, "D")
        kinds, weights = zip(*[("stone", 22), ("coal", 10), ("iron_ore", 20), ("gold_ore", 18 + n), ("amethyst", 5 + n), ("emerald", 4 + n),
                               ("ruby", 3 + n), ("diamond", 2 + n // 2), ("prismatic_shard", 1 + n // 5)])
        for _ in range(min(32, 14 + n)):                 # richer veins the deeper you go
            for _ in range(40):
                x, y = rng.randint(1, len(rows[0]) - 2), rng.randint(1, len(rows) - 2)
                if rows[y][x] == "v" and (x, y) not in self.atiles[loc] and min(abs(x - up[0]) + abs(y - up[1]), abs(x - down[0]) + abs(y - down[1])) > 2:
                    self.atiles[loc][(x, y)] = dict(ore=rng.choices(kinds, weights)[0])
                    break
        above = "mine3" if n == 1 else "deep%d" % (n - 1)
        a_down = AR.find_rows(self.rows_of(above), "D") if above in self.dyn_maps or above in AR.MAPS else None
        self.xportals[(loc, up[0], up[1])] = (above, a_down[0] + 1, a_down[1], (1, 0)) if a_down else ("mine3", 5, 20, (1, 0))
        self.out.append(("all", dict(t="area", name=loc, map=rows, rev=self.dyn_rev[loc], title="The Depths - floor %d" % n)))
        return loc

    def link_down(self, loc, x, y):
        """Stepping onto a ladder down from mine3 or a Depths floor makes the next floor (if need be)."""
        n = 1 if loc == "mine3" else int(loc[4:]) + 1
        nxt = self.deep_floor(n)
        up = AR.find_rows(self.dyn_maps[nxt], "U")
        self.xportals[(loc, x, y)] = (nxt, up[0] + 1, up[1], (1, 0))
        self.xportals[(nxt, up[0], up[1])] = (loc, x + 1, y, (1, 0))
        return self.xportals[(loc, x, y)]

    def _arrive_combat(self, p, frm, now):
        loc = p.get("loc", "farm")
        if loc.startswith("deep"):
            n = int(loc[4:])
            if n > p.get("deepest", 0):
                p["deepest"] = n
                self.bump(p, "depth_record")
                if n % 5 == 0:
                    self.credit(p, "explore")
                    self.farm_record("depth", n, now, "Record: %s reached floor %d of the Depths." % (p["name"], n))
                if n % 5 == 0:
                    self.event("%s reached floor %d of the Depths!" % (p["name"], n), now, "good")
            if n % 5 == 0 and not any(m["kind"] == "slime_king" for m in self.mobs.get(loc, [])) and not self.mobs.get(loc + ":king"):
                self.mobs.setdefault(loc + ":king", [1])
                self.spawn_mob(loc, "slime_king", now)
        c = p.get("companion")
        if c:
            c["loc"], c["x"], c["y"] = loc, p["x"], p["y"]

    def prune_depths(self, now):
        used = {q.get("loc") for q in self.players.values() if q.get("online")}
        for loc in [l for l in self.dyn_maps if l.startswith("deep") and l not in used]:
            n = int(loc[4:])
            if any(u and u.startswith("deep") and int(u[4:]) > n for u in used):
                continue                         # someone is deeper: keep the floors above them
            del self.dyn_maps[loc]
            self.atiles.pop(loc, None)
            self.mobs.pop(loc, None)
            self.mobs.pop(loc + ":king", None)
            self.xportals = {k: v for k, v in self.xportals.items() if k[0] != loc and v[0] != loc}

    # ------------------------------------------------------------------ spawning
    def cave_spot(self, loc, rng, avoid):
        rows = self.rows_of(loc)
        for _ in range(80):
            x, y = rng.randint(1, len(rows[0]) - 2), rng.randint(1, len(rows) - 2)
            if rows[y][x] == "v" and all(abs(x - a) + abs(y - b) > 7 for a, b in avoid) and not self.mob_at(loc, x, y):
                return (x, y)
        return None

    def spawn_mob(self, loc, kind, now):
        avoid = [(q["x"], q["y"]) for q in self.online_in(loc)]
        pos = self.cave_spot(loc, random.Random(), avoid)
        if not pos:
            return
        spec = MONSTERS[kind]
        floor = int(loc[4:]) if loc.startswith("deep") else 0
        hp = int(spec["hp"] * (1 + floor * 0.12))
        self.mobs.setdefault(loc, []).append(dict(id=self.uid(), kind=kind, x=pos[0], y=pos[1], hp=hp, max=hp, next=now + 1, hit=0, f=1))
        self.dirty = True

    def mob_at(self, loc, x, y):
        for m in self.mobs.get(loc, []):
            if m["x"] == x and m["y"] == y:
                return m
        return None

    def critter_at(self, loc, x, y):
        for c in self.critters.get(loc, []):
            if c["x"] == x and c["y"] == y:
                return c
        return None

    def _tick_combat(self, now):
        locs = {q.get("loc", "farm") for q in self.players.values() if q.get("online")}
        for loc in locs:
            if loc in LEVEL_MONSTERS or loc.startswith("deep"):
                kinds, cap = LEVEL_MONSTERS.get(loc, (None, 0))
                if loc.startswith("deep"):
                    n = int(loc[4:])
                    kinds, cap = (["slime", "blue_slime", "bat", "rock_crab", "ghost"][:2 + min(3, n // 2)], 6 + min(8, n))
                if len([m for m in self.mobs.get(loc, []) if m["kind"] != "slime_king"]) < cap and random.random() < 0.15:
                    self.spawn_mob(loc, random.choice(kinds), now)
            if loc in CRITTER_AREAS:
                kinds, cap = CRITTER_AREAS[loc]
                cl = self.critters.setdefault(loc, [])
                if len(cl) < cap and random.random() < 0.06:
                    rows = self.rows_of(loc)
                    rng = random.Random()
                    for _ in range(40):
                        x, y = rng.randint(2, len(rows[0]) - 3), rng.randint(2, len(rows) - 3)
                        if rows[y][x] in ".z" and not any(abs(q["x"] - x) + abs(q["y"] - y) < 8 for q in self.online_in(loc)):
                            k = rng.choice(kinds)
                            cl.append(dict(id=self.uid(), kind=k, x=x, y=y, hp=CRITTERS[k]["hp"], next=now + 1, f=1))
                            self.dirty = True
                            break
        for loc in list(self.critters):
            if loc not in locs:
                self.critters[loc] = []
        for loc in list(self.mobs):
            if ":" not in loc and loc not in locs and random.random() < 0.02:
                self.mobs[loc] = []
        # health comes back slowly when nothing is biting
        for p in self.players.values():
            if p.get("online") and p.get("hp", W.MAX_HP) < self.max_hp(p) and now - p.get("last_hit", 0) > 6:
                if now - p.get("regen", 0) >= REGEN:
                    p["regen"] = now
                    p["hp"] = min(self.max_hp(p), p.get("hp", W.MAX_HP) + 1)
                    self.dirty = True
        self.prune_depths(now)

    # ------------------------------------------------------------------ monsters and critters move (4 times a second)
    def walk_ok(self, loc, x, y, flying=False):
        ch = self.terrain(x, y, loc)
        if flying:
            return ch in "v.:,=zrH"
        return ch in AR.AREA_WALK and not self.atiles.get(loc, {}).get((x, y), {}).get("ore")

    def _fast_combat(self, now):
        for loc, ml in self.mobs.items():
            if ":" in loc:
                continue
            players = [q for q in self.online_in(loc) if q.get("hp", 1) > 0]
            for m in ml:
                spec = MONSTERS[m["kind"]]
                if now < m["next"]:
                    continue
                m["next"] = now + spec["step"] * random.uniform(0.85, 1.15)
                target = min(players, key=lambda q: abs(q["x"] - m["x"]) + abs(q["y"] - m["y"]), default=None)
                dist = abs(target["x"] - m["x"]) + abs(target["y"] - m["y"]) if target else 99
                flying = m["kind"] in ("bat", "ghost")
                if target and dist <= 1:
                    if now - m.get("hit", 0) >= HIT_COOLDOWN:
                        m["hit"] = now
                        self.hurt(target, spec["dmg"], spec["name"], now)
                    continue
                if target and dist <= spec["aggro"]:
                    opts = [(dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                            if self.walk_ok(loc, m["x"] + dx, m["y"] + dy, flying) and not self.mob_at(loc, m["x"] + dx, m["y"] + dy)]
                    opts.sort(key=lambda d: abs(target["x"] - m["x"] - d[0]) + abs(target["y"] - m["y"] - d[1]) + random.random() * 0.5)
                    step = opts[0] if opts else None
                elif random.random() < 0.5:
                    step = random.choice(((1, 0), (-1, 0), (0, 1), (0, -1)))
                    if not self.walk_ok(loc, m["x"] + step[0], m["y"] + step[1], flying) or self.mob_at(loc, m["x"] + step[0], m["y"] + step[1]):
                        step = None
                else:
                    step = None
                if step and not any((q["x"], q["y"]) == (m["x"] + step[0], m["y"] + step[1]) for q in players):
                    m["x"] += step[0]
                    m["y"] += step[1]
                    if step[0]:
                        m["f"] = step[0]
                    self.moved = True
        for loc, cl in self.critters.items():
            players = self.online_in(loc)
            for c in cl:
                spec = CRITTERS[c["kind"]]
                if now < c["next"]:
                    continue
                c["next"] = now + spec["step"] * random.uniform(0.8, 1.6)
                near = min(players, key=lambda q: abs(q["x"] - c["x"]) + abs(q["y"] - c["y"]), default=None)
                d = abs(near["x"] - c["x"]) + abs(near["y"] - c["y"]) if near else 99
                if c["kind"] == "boar" and near and d <= 1 and c.get("angry"):
                    if now - c.get("hit", 0) >= 1.2:
                        c["hit"] = now
                        self.hurt(near, spec["dmg"], "the wild boar", now)
                    continue
                if near and (d <= spec["flee"] or (c["kind"] == "boar" and c.get("angry") and d <= 7)):
                    away = c["kind"] != "boar" or not c.get("angry")
                    opts = [(dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if self.walk_ok(loc, c["x"] + dx, c["y"] + dy) and not self.critter_at(loc, c["x"] + dx, c["y"] + dy)]
                    opts.sort(key=lambda o: (-1 if away else 1) * (abs(near["x"] - c["x"] - o[0]) + abs(near["y"] - c["y"] - o[1])))
                    step = opts[0] if opts else None
                    c["next"] = now + spec["step"] * 0.6
                elif random.random() < 0.35:
                    step = random.choice(((1, 0), (-1, 0), (0, 1), (0, -1)))
                    if not self.walk_ok(loc, c["x"] + step[0], c["y"] + step[1]):
                        step = None
                else:
                    step = None
                if step and not any((q["x"], q["y"]) == (c["x"] + step[0], c["y"] + step[1]) for q in players):
                    c["x"] += step[0]
                    c["y"] += step[1]
                    if step[0]:
                        c["f"] = step[0]
                    self.moved = True
        # companions fight beside their farmer
        for p in self.players.values():
            comp = p.get("companion")
            if not comp or not p.get("online"):
                continue
            loc = p.get("loc", "farm")
            if now - comp.get("swing", 0) < 1.3:
                continue
            for m in self.mobs.get(loc, []):
                if abs(m["x"] - comp.get("x", p["x"])) + abs(m["y"] - comp.get("y", p["y"])) <= 1 or abs(m["x"] - p["x"]) + abs(m["y"] - p["y"]) <= 1:
                    comp["swing"] = now
                    self.damage_mob(p, loc, m, 6 + comp.get("level", 0) * 2, now, by=comp["name"])
                    break

    def _snap_combat(self, snap, now):
        snap["mobs"] = {loc: [dict(id=m["id"], k=m["kind"], x=m["x"], y=m["y"], hp=round(m["hp"] / m["max"], 2), f=m["f"], h=1 if now - m.get("ouch", 0) < 0.4 else 0)
                              for m in ml] for loc, ml in self.mobs.items() if ":" not in loc and ml}
        snap["critters"] = {loc: [dict(id=c["id"], k=c["kind"], x=c["x"], y=c["y"], f=c["f"]) for c in cl] for loc, cl in self.critters.items() if cl}
        chests = {}
        for loc, rows in self.dyn_maps.items():
            if loc.startswith("deep"):
                opened = [k for k, t in self.atiles.get(loc, {}).items() if t.get("opened")]
                if opened:
                    chests[loc] = ["%d,%d" % k for k in opened]
        snap["opened"] = chests

    # ------------------------------------------------------------------ getting hurt
    def hurt(self, p, dmg, by, now):
        if now - p.get("last_hit", 0) < INVULN:
            return
        if self.has_buff(p, "strength", now):
            dmg = max(1, int(dmg * 0.6))
        p["hp"] = p.get("hp", W.MAX_HP) - dmg
        p["last_hit"] = now
        p["hurt"] = now + 0.4
        self.dirty = True
        self.moved = True
        if p["hp"] <= 0:
            p["hp"] = self.max_hp(p) // 2
            p["riding"] = False
            lost = random.sample(p["inventory"], 0)
            self.out.append((p["name"], dict(t="msg", text="Everything goes dark... You wake up outside the mine, a little bruised.", style="warn")))
            self.event("%s was knocked out by %s in %s." % (p["name"], by, self.place_name(p.get("loc", "farm"))), now, "warn")
            self.travel(p, ("mountain", 32, 9, (0, 1)), now, "Captain Ash dragged you out of the mine. Rest up!")
            del lost
        else:
            self.out.append((p["name"], dict(t="ouch", n=dmg)))

    # ------------------------------------------------------------------ E: swords, treats, chests and the ladder down
    def _use_combat(self, p, loc, fx, fy, now):
        sel = self.selected_item(p)
        it = W.ITEMS.get(sel or "", {})
        ch = self.terrain(fx, fy, loc) if self.is_outdoor(loc) else ""
        if loc.startswith("deep") and ch == "Z":
            return self.open_chest(p, loc, (fx, fy), now) or True
        if it.get("kind") == "weapon" and it.get("ammo") and self.is_outdoor(loc):
            return self.shoot(p, loc, sel, now) or True
        m = self.mob_at(loc, fx, fy) or self.mob_at(loc, p["x"], p["y"])
        if m and sel == "monster_treat":
            return self.tame(p, loc, m, now) or True
        if m and it.get("kind") == "weapon":
            dmg = it["dmg"] + (8 if self.has_buff(p, "strength", now) else 0)
            self.act_anim(p, "sword", (m["x"], m["y"]))
            self.damage_mob(p, loc, m, dmg, now)
            return True
        if m:
            return self.say(p, "A %s! Hold a weapon (a sword from Captain Ash at the Guild) and press E." % MONSTERS[m["kind"]]["name"]) or True
        c = self.critter_at(loc, fx, fy)
        if c:
            return self.say(p, "A %s. It's too quick to grab - a bow, rifle or slingshot might do." % CRITTERS[c["kind"]]["name"].lower()) or True
        if loc == "guild" and self.terrain(fx, fy, loc) in "nS" and self.npc_present("Captain Ash", "guild"):
            return self.guild_menu(p, now) or True
        return False

    def damage_mob(self, p, loc, m, dmg, now, by=None):
        m["hp"] -= dmg
        m["ouch"] = now
        dx, dy = m["x"] - p["x"], m["y"] - p["y"]
        kx, ky = (max(-1, min(1, dx)), 0) if abs(dx) >= abs(dy) else (0, max(-1, min(1, dy)))
        if m["kind"] != "slime_king" and self.walk_ok(loc, m["x"] + kx, m["y"] + ky, m["kind"] in ("bat", "ghost")) and not self.mob_at(loc, m["x"] + kx, m["y"] + ky):
            m["x"] += kx
            m["y"] += ky
        m["next"] = max(m["next"], now + 0.5)
        self.moved = True
        self.dirty = True
        if m["hp"] > 0:
            return
        self.mobs[loc].remove(m)
        spec = MONSTERS[m["kind"]]
        kinds, weights = zip(*spec["drops"])
        drop = random.choices(kinds, weights)[0]
        n = 1 + (1 if self.has_buff(p, "luck", now) and random.random() < 0.4 else 0)
        self.give(p, drop, n)
        p["xp"] += spec["xp"]
        stat = {"slime": "slimes", "blue_slime": "slimes", "bat": "bats", "rock_crab": "crabs", "ghost": "ghosts", "slime_king": "kings"}[m["kind"]]
        self.bump(p, stat)
        self.bump(p, "monsters")
        self.out.append(("all", dict(t="poof", loc=loc, x=m["x"], y=m["y"], kind=m["kind"])))
        if m["kind"] == "slime_king":
            self.event("%s defeated the Slime King on %s! It dropped %s." % (p["name"], self.place_name(loc), W.ITEMS[drop]["name"]), now, "good")
        else:
            self.say(p, "%s the %s! +%d %s" % ("Your %s beat" % by if by else "Defeated", spec["name"], n, W.ITEMS[drop]["name"]), "good")
        self.check_milestones(now)

    def shoot(self, p, loc, weapon, now):
        it = W.ITEMS[weapon]
        if not self.take(p, it["ammo"], 1):
            return self.say(p, "Out of %s! %s" % (W.ITEMS[it["ammo"]]["name"].lower() + "s" if it["ammo"] != "stone" else "stones",
                                                 "Craft arrows or buy some in Dusty Gulch." if it["ammo"] == "arrow" else "Break rocks for stones." if it["ammo"] == "stone" else "Gus sells bullets in Dusty Gulch."), "warn")
        fx, fy = p["facing"]
        x, y = p["x"], p["y"]
        hit = None
        for i in range(1, it["range"] + 1):
            x, y = p["x"] + fx * i, p["y"] + fy * i
            b = self.balloon
            if b and b["loc"] == loc and abs(b["x"] - x) < 1.1 and abs(b["y"] - (y - 1.5)) < 1.6:
                hit = ("balloon", None)
                break
            m = self.mob_at(loc, x, y)
            if m:
                hit = ("mob", m)
                break
            c = self.critter_at(loc, x, y)
            if c:
                hit = ("critter", c)
                break
            ch = self.terrain(x, y, loc)
            if ch in "#TPACRW@SNKLu" or (loc in W.INTERIORS):
                break
        self.out.append(("all", dict(t="shot", loc=loc, who=p["name"], x0=p["x"], y0=p["y"], x1=x, y1=y, kind=it["ammo"])))
        if not hit:
            return
        kind, target = hit
        if kind == "balloon":
            return self.pop_balloon(p, now)
        if kind == "mob":
            return self.damage_mob(p, loc, target, it["dmg"], now)
        target["hp"] -= 1 if weapon == "slingshot" else (2 if weapon == "bow" else 3)
        spec = CRITTERS[target["kind"]]
        if target["kind"] == "boar":
            target["angry"] = True
        if target["hp"] <= 0:
            self.critters[loc].remove(target)
            self.give(p, spec["item"], 1)
            p["xp"] += 10
            self.bump(p, "hunted")
            self.out.append(("all", dict(t="poof", loc=loc, x=target["x"], y=target["y"], kind=target["kind"])))
            self.say(p, "You bagged a %s! Take it to Hank, the butcher in Dusty Gulch." % spec["name"].lower(), "good")
            self.check_milestones(now)
        else:
            self.say(p, "Hit! The %s bolts." % spec["name"].lower())
        self.moved = True

    def tame(self, p, loc, m, now):
        if m["kind"] == "slime_king":
            return self.say(p, "The Slime King scoffs at your treat.", "warn")
        self.take(p, "monster_treat", 1)
        if m["hp"] > m["max"] * 0.6:
            return self.say(p, "The %s snatches the treat but is still too wild. Wear it down first." % MONSTERS[m["kind"]]["name"], "warn")
        if random.random() > 0.6:
            return self.say(p, "The %s gobbles the treat... and growls. Try another!" % MONSTERS[m["kind"]]["name"], "warn")
        self.mobs[loc].remove(m)
        old = p.get("companion")
        name = random.choice({"slime": ["Gloop", "Jiggles", "Blobby"], "blue_slime": ["Frosty", "Glacier", "Bubbles"], "bat": ["Flutter", "Nibbles", "Echo"],
                              "rock_crab": ["Pebble", "Clacker", "Boulder"], "ghost": ["Boo", "Wisp", "Casper"]}[m["kind"]])
        p["companion"] = dict(kind=m["kind"], name=name, loc=loc, x=m["x"], y=m["y"], level=0)
        self.bump(p, "tamed")
        self.dirty = True
        self.check_milestones(now)
        self.event("%s tamed a %s! %s follows them now%s." % (p["name"], MONSTERS[m["kind"]]["name"], name,
                                                               " (%s went back to the wild)" % old["name"] if old else ""), now, "good")

    def companion_follow(self, p, ox, oy, pet_was):
        c = p.get("companion")
        if not c:
            return
        c["loc"] = p.get("loc", "farm")
        if pet_was:
            c["x"], c["y"] = pet_was
        else:
            c["x"], c["y"] = ox, oy

    def open_chest(self, p, loc, pos, now):
        t = self.atiles.setdefault(loc, {}).setdefault(pos, {})
        if t.get("opened"):
            return self.say(p, "Empty. Somebody beat you to it!")
        t["opened"] = True
        n = int(loc[4:])
        loot = random.choices(["#coins", "gold_ore", "iron_ore", "amethyst", "emerald", "ruby", "diamond", "monster_treat", "treasure_key", "art_starry_valley", "oak_seed"],
                              [30, 15, 15, 10, 8, 8, 4 + n, 8, 6, 1, 0.3])[0]
        self.dirty = True
        self.fx(p, "lift", "present", pos)
        if loot == "#coins":
            c = random.randint(100, 300) * (1 + n // 3)
            self.coins += c
            return self.say(p, "The chest creaks open: %dg!" % c, "good")
        self.give(p, loot, 1)
        if loot in ("oak_seed", "art_starry_valley"):
            self.event("%s found a %s in a chest in the Depths!" % (p["name"], W.ITEMS[loot]["name"]), now, "good")
        self.say(p, "The chest creaks open: a %s!" % W.ITEMS[loot]["name"], "good")

    # ------------------------------------------------------------------ the adventurers' guild
    def guild_menu(self, p, now):
        rows = []
        if not self.count(p, "sword_rusty") and not p.get("got_sword"):
            p["got_sword"] = True
            self.give(p, "sword_rusty", 1)
            self.say(p, "Captain Ash: Going down the mine? Take this. It's rusty but it'll keep the slimes off you.", "good")
        stats = p.get("stats", {})
        done = self.ash_done.setdefault(p["name"], [])
        for key, n, title, prize, coins in ASH_GOALS:
            have = p.get("deepest", 0) if key == "depth" else stats.get(key, 0)
            got = title in done
            rows.append(dict(key=prize[0], label=title, info="%s %d/%d  ·  prize: %s and %dg" % ({"depth": "reach floor", "kings": "defeat the Slime King"}.get(key, "defeat " + key), min(have, n), n, W.ITEMS[prize[0]]["name"], coins),
                             act=dict(t="claim_goal", goal=title), ok=have >= n and not got, right="Claimed" if got else ("Claim" if have >= n else "")))
        rows.append(dict(section="Heal"))
        rows.append(dict(label="Patch me up", info="Back to full health for 50g.", act=dict(t="heal"), ok=p.get("hp", 100) < self.max_hp(p) and self.coins >= 50, right="50g"))
        self.list_menu(p, "guild", "Adventurers' Guild", rows, sub="Captain Ash: \"Monsters lurk in the mine, and worse in the Depths below level three.\"", keep=True)

    def act_claim_goal(self, p, msg, now):
        if p.get("loc") != "guild":
            return
        for key, n, title, prize, coins in ASH_GOALS:
            if title == msg.get("goal"):
                have = p.get("deepest", 0) if key == "depth" else p.get("stats", {}).get(key, 0)
                done = self.ash_done.setdefault(p["name"], [])
                if have >= n and title not in done:
                    done.append(title)
                    self.give(p, prize[0], prize[1])
                    self.coins += coins
                    self.event("%s earned the guild title \"%s\"!" % (p["name"], title), now, "good")
        self.guild_menu(p, now)

    def act_heal(self, p, msg, now):
        if p.get("loc") not in ("guild", "clinic") or self.coins < 50:
            return
        self.coins -= 50
        p["hp"] = self.max_hp(p)
        self.say(p, "Good as new!", "good")
        self.dirty = True
