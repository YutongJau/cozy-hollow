"""The world reacts to the Valley Revival. A Quiet town looks worn (weeds, a dry fountain, boarded windows, dim lamps,
wilted planters, a shuttered market stall); every stage-up changes it for everyone, with a ceremony in the square led by
Mayor Hazel. Waking: Fennel reopens the market stall. Bustling: the fountain flows again (toss in a coin for luck).
Thriving: Sol restores the old hot spring above the mountain lake. (In Bloom is the finale - see finale.py.)
The weeds, wilted planters, boarded windows and bunting are drawn by the clients from the stage in the snapshot."""
import random

import world as W
from valley import festivals as FE

STALLS = [("town", 35, 25), ("town", 37, 28)]
SPRING = [(x, y) for y in (12, 13) for x in range(46, 50)]      # above the lake on Summit Ridge
CEREMONY_SECONDS = 150
COIN = 10


class Bloom:
    def _init_bloom(self, now):
        self.ceremony = getattr(self, "ceremony", None)       # {stage, t0} while Mayor Hazel speaks in the square

    def _load_bloom(self, d):
        self._stageup_bloom(self.stage(), self.last_tick, True)      # make sure the town matches the stage it is at

    # ------------------------------------------------------------------ the town changes with each stage
    def _stageup_bloom(self, stage, now, quiet):
        if stage >= 1 and "Fennel" not in self.residents:
            self.residents.append("Fennel")
            self.ensure_npc("Fennel")
        if stage >= 3:
            if "Sol" not in self.residents:
                self.residents.append("Sol")
                self.ensure_npc("Sol")
            for x, y in SPRING:
                if self.terrain(x, y, "mountain") != "j":
                    self.set_terrain("mountain", x, y, "j")
        if not quiet:
            self.ceremony = dict(stage=stage, t0=now)
        self.dirty = True

    def ceremony_spot(self, name, now):
        """During a stage-up ceremony Mayor Hazel speaks by the fountain and the townsfolk gather round."""
        c = self.ceremony
        if not c or now - c["t0"] > CEREMONY_SECONDS:
            return None
        h = self.sky_hour(now)
        if name == "Mayor Hazel":
            return FE.HOST_SPOT
        if not 7 <= h < 21:
            return None
        d = self.folk_def(name) or {}
        if d.get("work") and d["work"] not in ("hall", "store", "saloon", "museum", "clinic", "smith", "bakery", "post", "carpenter"):
            return None
        if name in ("Rowan", "Velvet", "Sol"):
            return None
        return FE.FEST_SPOTS[FE.stable(name) % len(FE.FEST_SPOTS)]

    def _tick_bloom(self, now):
        if self.ceremony and now - self.ceremony["t0"] > CEREMONY_SECONDS:
            self.ceremony = None
            self.dirty = True

    def _snap_bloom(self, snap, now):
        c = self.ceremony
        snap["ceremony"] = dict(stage=c["stage"], name=self.stage_name(c["stage"]), t=round(now - c["t0"], 1)) if c else None

    # ------------------------------------------------------------------ E on the stall, the fountain, the spring
    def _use_bloom(self, p, loc, fx, fy, now):
        ch = self.terrain(fx, fy, loc)
        if loc == "town" and ch == "J":
            if self.stage() < 1:
                return self.say(p, "A market stall, shuttered and dusty. A note on it says: \"Back when the valley wakes up. - F\"") or True
            return self.market_menu(p, now) or True
        if loc == "town" and ch == "F":
            return self.fountain(p, now) or True
        if loc == "mountain" and ch == "j":
            return self.soak(p, now) or True
        return False

    def market_menu(self, p, now):
        season = self.season_at(now)
        nxt = W.SEASONS[(W.SEASONS.index(season) + 1) % 4]
        rows = [dict(section="Seeds for %s - plant ahead" % nxt.capitalize())]
        lv = self.level_of(p)
        for key, c in W.CROPS.items():
            if c["always"] or season in c["seasons"] or nxt not in c["seasons"]:
                continue
            need = __import__("valley.progress", fromlist=["x"]).CROP_LEVEL.get(key, 0)
            price = self.market_price(key)
            rows.append(dict(key=key + "_seed", label=W.ITEMS[key + "_seed"]["name"], info=("Opens at level %d." % need) if lv < need else "%s crop, ready in %s." % (
                             "/".join(s.capitalize() for s in c["seasons"]), W.fmt_duration(c["grow"])),
                             right="%dg" % price, act=dict(t="market_buy", item=key + "_seed"), ok=lv >= need and self.coins >= price, dim=lv < need))
        want = self.market_want(now)
        rows.append(dict(section="Fennel pays double today for"))
        have = self.count(p, want)
        rows.append(dict(key=want, label=W.ITEMS[want]["name"], info="You have %d. She takes them all at %dg each." % (have, 2 * W.ITEMS[want]["sell"]),
                         right="Sell all", act=dict(t="market_sell"), ok=have > 0))
        self.list_menu(p, "market", "Fennel's Market", rows, sub="Fennel: \"Fresh from the valley! Tomorrow I'll want something else.\"  ·  %dg shared" % self.coins, keep=True)

    def market_price(self, key):
        return int(W.CROPS[key]["seed_price"] * 1.25 + 0.5)

    def market_want(self, now):
        season = self.season_at(now)
        pool = sorted(k for k, c in W.CROPS.items() if c["always"] or season in c["seasons"])
        return random.Random(self.seed ^ int(now // W.SKY_DAY) * 7919).choice(pool)

    def near_stall(self, p):
        return p.get("loc") == "town" and any(abs(p["x"] - x) + abs(p["y"] - y) <= 2 for _, x, y in STALLS)

    def act_market_buy(self, p, msg, now):
        key = str(msg.get("item", ""))
        crop = key[:-5] if key.endswith("_seed") else None
        season = self.season_at(now)
        nxt = W.SEASONS[(W.SEASONS.index(season) + 1) % 4]
        if self.stage() < 1 or not self.near_stall(p) or crop not in W.CROPS or nxt not in W.CROPS[crop]["seasons"]:
            return
        need = __import__("valley.progress", fromlist=["x"]).CROP_LEVEL.get(crop, 0)
        if self.level_of(p) < need:
            return self.say(p, self.locked_msg(p, need), "warn")
        n = max(1, min(20, int(msg.get("n", 1))))
        cost = self.market_price(crop) * n
        if cost > self.coins:
            return self.say(p, "Not enough coins (need %dg)." % cost, "warn")
        self.coins -= cost
        self.give(p, key, n)
        self.bump(p, "spent", cost)
        self.say(p, "Bought %d %s from Fennel for %dg." % (n, W.ITEMS[key]["name"], cost), "good")
        self.market_menu(p, now)

    def act_market_sell(self, p, msg, now):
        if self.stage() < 1 or not self.near_stall(p):
            return
        want = self.market_want(now)
        n = self.count(p, want)
        if not n:
            return self.say(p, "Fennel: No %s on you? Maybe tomorrow!" % W.ITEMS[want]["name"])
        self.take(p, want, n)
        self.note_shipped(p, want, now)
        earned = 2 * W.ITEMS[want]["sell"] * n
        self.coins += earned
        p["xp"] += max(1, earned // 20)
        self.bump(p, "earned", earned)
        self.befriend(p, "Fennel", 15)
        self.say(p, "Fennel bought %d %s for %dg. \"Perfect - just what I needed!\"" % (n, W.ITEMS[want]["name"], earned), "good")
        self.check_milestones(now)
        self.market_menu(p, now)

    def fountain(self, p, now):
        if self.stage() < 2:
            return self.say(p, "The fountain is dry. Leaves have gathered in the basin. (It will flow again when the valley is Bustling.)")
        day = int(now // W.SKY_DAY)
        if p.get("wished") == day:
            return self.say(p, "The fountain burbles. Your coin from this morning glints at the bottom.")
        if self.coins < COIN:
            return self.say(p, "You pat your pockets - not even %dg for the fountain." % COIN, "warn")
        self.coins -= COIN
        p["wished"] = day
        from valley.crafting import BUFFS
        p.setdefault("buffs", {})["luck"] = now + BUFFS["luck"][1]
        fortune = random.choice(["A good harvest is coming.", "Someone in town is thinking of you.", "Look under rocks today.",
                                 "The fish are biting somewhere.", "A friend will surprise you.", "Your next coin comes back doubled... in spirit."])
        self.say(p, "You toss %dg into the fountain. Plink! %s (Lucky for %s)" % (COIN, fortune, W.fmt_duration(BUFFS["luck"][1])), "good")
        self.dirty = True

    def soak(self, p, now):
        if self.stage() < 3:
            return self.say(p, "Warm water bubbles up between the stones.")
        p["hp"] = self.max_hp(p)
        from valley.crafting import BUFFS
        p.setdefault("buffs", {})["speed"] = now + BUFFS["speed"][1]
        day = int(now // W.SKY_DAY)
        if p.get("soaked") != day:
            p["soaked"] = day
            self.befriend(p, "Sol", 15)
            p["xp"] += 5
        p["bubble"] = ["~ ahh ~", now + 3]
        self.dirty = True
        self.say(p, "You sink into the hot spring up to your shoulders. Every ache melts away. (Full health, Quick feet for %s)" % W.fmt_duration(BUFFS["speed"][1]), "good")
