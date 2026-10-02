"""The town's development board at the Town Hall: everyone chips in materials and coins, each finished project
opens something new (and brings new neighbours to Hollow Town)."""
import world as W

# key: (title, what it does, materials, coins, new residents)
PROJECTS = [
    ("lamps", "Light Up Main Street", "New lampposts along the streets. Nell the lamplighter moves to town.", [("wood", 20), ("copper_ore", 10)], 0, ["Nell"]),
    ("coop", "Coop Workshop", "Oakley can build you a chicken coop; chickens go on sale.", [("wood", 50), ("stone", 30)], 800, []),
    ("stable", "Mend the Gulch Stable", "The Dusty Gulch stable reopens and sells horses.", [("wood", 40), ("iron_ore", 8)], 500, []),
    ("bandstand", "Bandstand in the Square", "Rowan the wandering bard plays concerts on the 3rd and 7th of each season.", [("wood", 30), ("gold_ore", 5)], 1000, []),
    ("gallery", "Gallery Wing", "Velvet the art dealer visits the square on the 2nd and 5th of each season.", [("stone", 30), ("quartz", 5)], 1500, []),
    ("harbor", "Harbor Dock", "Old Tomas sells Mystery Tickets for voyages to unknown islands.", [("wood", 60), ("stone", 20)], 1500, []),
    ("landscaping", "Landscaping Office", "Oakley sells landscaping shovels to reshape the farm's land and water.", [("stone", 40), ("coal", 10)], 2000, []),
    ("cottages", "Guest Cottages", "Two new cottages by the river. Barnaby and Ivy move in.", [("wood", 80), ("stone", 40)], 3000, ["Barnaby", "Ivy"]),
]
PROJECT = {p[0]: p for p in PROJECTS}
GUEST_COTTAGES = [dict(kind="cottage2", label="", x=24, y=34, w=6, h=5, keeper="Barnaby"), dict(kind="cottage", label="", x=42, y=34, w=6, h=5, keeper="Ivy")]


class TownHall:
    def _init_town(self, now):
        self.projects = getattr(self, "projects", {})        # key -> {"done": bool, "got": {item: n}}
        self.residents = getattr(self, "residents", [])

    def _save_town(self, out):
        out["projects"] = self.projects
        out["residents"] = self.residents

    def _load_town(self, d):
        self.projects = d.get("projects", {})
        self.residents = d.get("residents", [])
        for name in self.residents:
            self.ensure_npc(name)

    def unlocked(self, key):
        return bool(self.projects.get(key, {}).get("done"))

    def population(self):
        return len([n for n in self.folk if n != "Rowan"])

    def _snap_town(self, snap, now):
        snap["town"] = dict(pop=self.population(), done=[k for k, v in self.projects.items() if v.get("done")])

    def town_menu(self, p, now):
        rows = [dict(label="The Valley Pantry", info="Fill bundles together; every finished room gives the farm a lasting perk (%d of 5 rooms)." % len(self.pantry["rooms"]),
                     act=dict(t="pantry"), ok=True, right="Open"), dict(section="Town projects")]
        for key, title, does, mats, coins, people in PROJECTS:
            st = self.projects.get(key, {})
            if st.get("done"):
                rows.append(dict(project=key, label=title + "  ✓", info=does, ok=False, right="Done"))
                continue
            got = st.get("got", {})
            need = ", ".join("%s %d/%d" % (W.ITEMS[k]["name"], got.get(k, 0), n) for k, n in mats)
            have_any = any(self.count(p, k) and got.get(k, 0) < n for k, n in mats)
            ready = all(got.get(k, 0) >= n for k, n in mats)
            rows.append(dict(project=key, label=title, info="%s  ·  %s%s" % (does, need, "  ·  %dg" % coins if coins else ""),
                             act=dict(t="contribute", project=key), ok=have_any or (ready and self.coins >= coins),
                             right="Finish (%dg)" % coins if ready and coins else ("Finish" if ready else "Chip in")))
        self.list_menu(p, "town", "Hollow Town Projects", rows,
                       sub="Mayor Hazel: \"Population %d and growing! Every project needs a little help from everyone.\"  ·  The valley is %s (K for the Revival)" % (self.population(), self.stage_name()), keep=True)

    def act_contribute(self, p, msg, now):
        key = msg.get("project")
        if key not in PROJECT or p.get("loc") != "hall" or self.unlocked(key):
            return
        _, title, does, mats, coins, people = PROJECT[key]
        st = self.projects.setdefault(key, dict(done=False, got={}))
        gave = []
        for k, n in mats:
            want = n - st["got"].get(k, 0)
            have = self.count(p, k)
            if want > 0 and have:
                c = min(want, have)
                self.take(p, k, c)
                st["got"][k] = st["got"].get(k, 0) + c
                gave.append("%d %s" % (c, W.ITEMS[k]["name"]))
        if gave:
            self.bump(p, "contributed")
            self.credit(p, "town")
            self.befriend(p, "Mayor Hazel", 10)
            self.say(p, "You chipped in %s for the %s." % (", ".join(gave), title), "good")
        if all(st["got"].get(k, 0) >= n for k, n in mats):
            if self.coins < coins:
                self.say(p, "All the materials are in! The last step is %dg from the shared purse." % coins, "warn")
            else:
                self.coins -= coins
                st["done"] = True
                self.finish_project(key, p, now)
        self.dirty = True
        self.town_menu(p, now)

    def finish_project(self, key, p, now):
        _, title, does, mats, coins, people = PROJECT[key]
        for name in people:
            if name not in self.residents:
                self.residents.append(name)
                self.ensure_npc(name)
        if key == "lamps":
            for (x, y) in [(8, 13), (22, 15), (50, 15), (62, 15), (6, 24), (30, 24), (58, 24), (10, 33), (62, 33)]:
                if self.terrain(x, y, "town") in ".=":
                    self.set_terrain("town", x, y, "l")
        if key == "cottages":
            for b in GUEST_COTTAGES:
                self.add_building("town", b)
                dx, dy = b["x"] + b["w"] // 2, b["y"] + b["h"]
                if self.terrain(dx, dy, "town") not in ":=":
                    self.set_terrain("town", dx, dy, ":")
        if key == "bandstand":
            for (x, y) in [(34, 21), (38, 21)]:
                self.set_terrain("town", x, y, "l")
        self.project_done(key, p, now)
        self.scrap("The town finished the %s (the last piece from %s)." % (title, p["name"]), now, "project")
        self.bump(p, "projects")
        self.event("The town finished the %s! %s Population: %d." % (title, does, self.population()), now, "good")
        self.check_milestones(now)

    def _use_town(self, p, loc, fx, fy, now):
        return False
