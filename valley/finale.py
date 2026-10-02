"""The finale. When the Valley Revival reaches In Bloom, the Valley Bloom Festival begins: for one real day every
villager in the valley gathers in the square, fireworks go up every night, and a monument rises in the square with every
farmer's name on it. Mayor Hazel hands each farmer gifts nobody can get any other way (the Bloom Crown and the Valley
Medal), the credits list what everyone did, and the valley's blessing makes crops grow a little faster from then on.
Then the farm goes on."""
import areas as AR
import world as W
from valley import crafting as CR
from valley import festivals as FE
from valley import revival as RV

BLOOM_FEST = 24 * W.HOUR
MONUMENT = ("town", 36, 27)
BLOOM_GROWTH = 1.1
W._item("valley_medal", "Valley Medal", "prize", 0, "*", "*", "yellow",
        info="Given to every farmer who brought Cozy Hollow back to life. It says IN BLOOM on the back.")
CR.PRIZE_HATS["bloom"] = "Bloom Crown"
AR.TERRAIN_NAMES["M"] = "the Bloom monument"


def _spots():
    """Places to stand in the square: the festival spots and more in the south plaza, so everyone in the valley fits."""
    rows = AR.MAPS["town"]
    extra = [(x, y) for y in range(24, 31) for x in range(27, 46) if rows[y][x] in "=" and (x + y) % 2 == 0]
    taken = {(x, y) for _, x, y in FE.FEST_SPOTS} | {MONUMENT[1:]} | {(35, 24), (35, 25), (37, 28), (35, 26), (37, 27), (37, 29)}
    return list(FE.FEST_SPOTS) + [("town", x, y) for x, y in extra if (x, y) not in taken]


BLOOM_SPOTS = _spots()


class Finale:
    def _init_finale(self, now):
        self.bloom = getattr(self, "bloom", None) or dict(t0=None, until=0, claimed=[])

    def _save_finale(self, out):
        out["bloom"] = self.bloom

    def _load_finale(self, d):
        self.bloom = d.get("bloom") or dict(t0=None, until=0, claimed=[])
        if self.stage() >= 4:
            self.raise_monument()

    # ------------------------------------------------------------------ In Bloom
    def _stageup_finale(self, stage, now, quiet):
        if stage < 4:
            return
        self.raise_monument()
        if self.bloom.get("t0"):
            return
        self.bloom["t0"] = now
        if quiet:
            return
        self.bloom["until"] = now + BLOOM_FEST
        self.scrap("The Valley Bloom Festival: every villager in the square, fireworks, and the Bloom monument raised with every farmer's name.", now, "stage")
        self.event("The Valley Bloom Festival begins! Every villager is gathering in the square, there'll be fireworks tonight, "
                   "and a monument with every farmer's name now stands in the south plaza. Talk to Mayor Hazel for your gifts!", now, "good")
        for q in self.players.values():
            if q.get("online"):
                self.credits_menu(q, now)

    def raise_monument(self):
        loc, x, y = MONUMENT
        if self.terrain(x, y, loc) != "M":
            self.set_terrain(loc, x, y, "M")

    def bloom_on(self, now):
        return self.bloom.get("until", 0) > now

    def bloom_spot(self, name, now):
        """During the Bloom Festival everyone in the valley comes to the square (8am to 10pm)."""
        if not self.bloom_on(now) or not 8 <= self.sky_hour(now) < 22:
            return None
        if name == "Mayor Hazel":
            return FE.HOST_SPOT
        if name in ("Rowan", "Velvet"):
            return None
        names = sorted(n for n in self.folk if n not in ("Mayor Hazel", "Rowan", "Velvet"))
        i = names.index(name) if name in names else FE.stable(name)
        return BLOOM_SPOTS[i % len(BLOOM_SPOTS)]

    def blessing(self):
        return BLOOM_GROWTH if self.stage() >= 4 else 1.0

    def _snap_finale(self, snap, now):
        snap["bloom"] = dict(on=self.bloom_on(now), left=int(self.bloom.get("until", 0) - now)) if self.bloom.get("t0") else None

    # ------------------------------------------------------------------ Mayor Hazel's gifts, the monument, the credits
    def _use_finale(self, p, loc, fx, fy, now):
        if self.stage() < 4 or loc != "town":
            return False
        if self.terrain(fx, fy, loc) == "M":
            return self.monument_menu(p, now) or True
        name, n = self.npc_at(loc, fx, fy)
        if name == "Mayor Hazel" and (p["name"] not in self.bloom["claimed"] or self.bloom_on(now)):
            return self.bloom_menu(p, now) or True
        return False

    def bloom_menu(self, p, now):
        got = p["name"] in self.bloom["claimed"]
        rows = [dict(section="Your gifts"),
                dict(hat="bloom", label="The Bloom Crown", info="A crown of everblooming flowers. Only the farmers who revived the valley wear one.",
                     ok=not got, act=dict(t="bloom_claim"), right="Received" if got else "Accept"),
                dict(key="valley_medal", label="The Valley Medal", info=W.ITEMS["valley_medal"]["info"], ok=not got, act=dict(t="bloom_claim"),
                     right="Received" if got else "Accept"),
                dict(section="For everyone"),
                dict(label="The valley's blessing", info="Crops everywhere grow %d%% faster, for good." % round((BLOOM_GROWTH - 1) * 100), ok=False),
                dict(label="Read the credits", info="Everything everyone did to bring Cozy Hollow back.", act=dict(t="credits"), ok=True, right="Open"),
                dict(label="The monument", info="In the south plaza, with every farmer's name.", act=dict(t="monument"), ok=True, right="Open")]
        left = self.bloom.get("until", 0) - now
        sub = ("Mayor Hazel: \"Look at everyone! The festival goes on for another %s - stay for the fireworks tonight.\"" % W.fmt_duration(left)) if left > 0 else \
            "Mayor Hazel: \"I still can't believe what you all did. Thank you.\""
        self.list_menu(p, "bloom", "The Valley Bloom Festival", rows, sub=sub, keep=True)

    def act_bloom_claim(self, p, msg, now):
        if self.stage() < 4 or p["name"] in self.bloom["claimed"]:
            return
        self.bloom["claimed"].append(p["name"])
        wardrobe = p.setdefault("wardrobe", ["cowboy", "none"])
        if "bloom" not in wardrobe:
            wardrobe.append("bloom")
        p["hat"] = "bloom"
        self.give(p, "valley_medal", 1)
        p["xp"] += 500
        self.dirty = True
        self.event("Mayor Hazel placed the Bloom Crown on %s's head and pinned on the Valley Medal!" % p["name"], now, "good")
        self.bloom_menu(p, now)

    def farmers_named(self):
        """Every farmer on the monument: anyone who has done anything for the valley, most first."""
        named = [name for _, name, _ in self.credit_lines()]
        return named + sorted(n for n in self.players if n not in named and self.players[n].get("xp", 0) > 0)

    def monument_menu(self, p, now):
        ups = dict((s, t) for s, t in self.revival["ups"])
        rows = [dict(section="IN BLOOM - %s" % (self.date_label(ups[4]) if 4 in ups else "")),
                dict(label="\"Raised by the farmers of %s, who brought the valley back to life.\"" % self.name, ok=False)]
        rows.append(dict(section="The farmers"))
        for name in self.farmers_named():
            rows.append(dict(label=name + (" (you)" if name == p["name"] else ""), ok=False))
        rows.append(dict(label="Read the credits", act=dict(t="credits"), ok=True, right="Open"))
        self.list_menu(p, "monument", "The Bloom Monument", rows, sub="A stone plinth in the south plaza, a golden sprout on top, flowers all around.")

    def act_monument(self, p, msg, now):
        if self.stage() >= 4:
            self.monument_menu(p, now)

    def credits_menu(self, p, now):
        rows = [dict(section="Cozy Hollow - the Valley Revival")]
        for total, name, text in self.credit_lines():
            rows.append(dict(label=name, info=text, right=str(total), ok=False))
        best = {}
        for name, c in self.revival["credits"].items():
            for k, n in c.items():
                if n > best.get(k, (0, ""))[0]:
                    best[k] = (n, name)
        if best:
            rows.append(dict(section="Champions of each thread"))
            for key, title in RV.THREADS:
                if key in best:
                    n, name = best[key]
                    rows.append(dict(label=title, info="%s - %d %s" % (name, n, RV.CREDIT_WORDS[key][0 if n == 1 else 1]), ok=False))
        firsts = self.revival["shipped"]
        if firsts:
            rows.append(dict(section="First to ship"))
            by = {}
            for k, name in firsts.items():
                by.setdefault(name, []).append(W.ITEMS[k]["name"])
            for name, crops in sorted(by.items(), key=lambda kv: -len(kv[1])):
                rows.append(dict(label=name, info=", ".join(crops), ok=False))
        rows.append(dict(section="How it happened"))
        for s, t in self.revival["ups"]:
            rows.append(dict(label=RV.STAGES[s], info=self.date_label(t), ok=False))
        rows.append(dict(section="Thank you for playing"))
        rows.append(dict(label="The farm goes on. There are always more crops to grow, friends to make and floors to explore.", ok=False))
        self.list_menu(p, "credits", "Credits", rows, sub="Everything everyone did to bring Cozy Hollow back to life.")

    def act_credits(self, p, msg, now):
        self.credits_menu(p, now)

    def _book_finale(self, p, now):
        if self.stage() < 4:
            return []
        return [dict(label="Credits", info="Everything everyone did for the Revival.", act=dict(t="credits"), ok=True, right="Open")]
