"""Festivals in Hollow Town square, two a season or so, and the wandering bard's concerts.

  spring 3  Spring Hoedown        line dancing (a rhythm game)
  spring 6  Rodeo Roundup         bull riding (a balance game); the best rider wins the champion's hat
  summer 4  Livestock Fair        enter your best produce for a ribbon
  fall 5    Fallfest              apple bobbing and the great pumpkin weigh-in
  winter 2  Frost Fishing Derby   catch as many fish as you can in three minutes
  winter 6  Winter Feast          bring a dish to the potluck, swap gifts
"""
import random
import zlib

import world as W

FESTIVALS = {
    ("spring", 3): ("hoedown", "Spring Hoedown"), ("spring", 6): ("rodeo", "Rodeo Roundup"), ("summer", 4): ("fair", "Livestock Fair"),
    ("fall", 5): ("fallfest", "Fallfest"), ("winter", 2): ("derby", "Frost Fishing Derby"), ("winter", 6): ("feast", "Winter Feast"),
}
FEST_SPOTS = [("town", 32, 20), ("town", 40, 20), ("town", 31, 23), ("town", 41, 23), ("town", 34, 17), ("town", 38, 17), ("town", 33, 26),
              ("town", 39, 26), ("town", 30, 21), ("town", 42, 21), ("town", 36, 24), ("town", 35, 16), ("town", 37, 16), ("town", 29, 22),
              ("town", 43, 22), ("town", 32, 26), ("town", 40, 26), ("town", 34, 27), ("town", 38, 27), ("town", 28, 20), ("town", 44, 20),
              ("town", 30, 26), ("town", 42, 26)]
HOST_SPOT = ("town", 36, 23)
DERBY_SECONDS = 180
W._item("blue_ribbon", "Blue Ribbon", "prize", 200, "@", "@", "blue")
W._item("red_ribbon", "Red Ribbon", "prize", 100, "@", "@", "red")
W._item("derby_trophy", "Derby Trophy", "prize", 500, "Y", "Y", "yellow")
W._item("apple_candy", "Candy Apple", "food", 80, "o", "o", "red", hp=20, buff="speed")
W._item("feast_gift", "Wrapped Gift", "present", 0, "&", "&", "magenta")
SONGS = [("valley_waltz", "Valley Waltz"), ("dusty_trail", "Dusty Trail Blues"), ("lighthouse_lullaby", "Lighthouse Lullaby"),
         ("harvest_moon", "Harvest Moon Two-Step"), ("starfall", "Starfall Serenade"), ("rainy_day", "Rainy Day Reel"),
         ("campfire", "Campfire Hum"), ("hollow_anthem", "Hollow Town Anthem")]
BARD_SPOT = ("town", 36, 21)


def stable(text):
    return zlib.crc32(str(text).encode())


class Festivals:
    def _init_fest(self, now):
        self.fest_scores = getattr(self, "fest_scores", {})     # "year:season:day" -> {player: score}
        self.derby = getattr(self, "derby", {})                 # player -> {until, n}

    def _save_fest(self, out):
        out["fest_scores"] = self.fest_scores

    def _load_fest(self, d):
        self.fest_scores = d.get("fest_scores", {})
        for p in self.players.values():
            p.setdefault("songs", [])

    def _join_fest(self, p, now):
        p.setdefault("songs", [])

    def festival(self, now):
        f = FESTIVALS.get((self.season_at(now), self.day_at(now)))
        return f

    def fest_key(self, now):
        return "%d:%s:%d" % (self.year_at(now), self.season_at(now), self.day_at(now))

    def festival_spot(self, name, now):
        if not self.festival(now):
            return None
        if name == "Mayor Hazel":
            return HOST_SPOT
        d = self.folk_def(name) or {}
        if d.get("work") and d["work"] not in ("hall", "store", "saloon", "museum", "clinic", "smith", "bakery", "post", "carpenter") and name != "Old Tomas":
            return None                       # folks from the beach, woods, mountain, island and gulch stay home
        return FEST_SPOTS[stable(name) % len(FEST_SPOTS)]

    def concert_on(self, now):
        h = self.sky_hour(now)
        return self.unlocked("bandstand") and self.day_at(now) in (3, 7) and 18 <= h < 23.5

    def _fast_fest(self, now):
        # the bard appears in the square on concert nights
        on = self.concert_on(now)
        n = self.folk.get("Rowan")
        if on and not n:
            self.folk["Rowan"] = dict(loc=BARD_SPOT[0], x=BARD_SPOT[1], y=BARD_SPOT[2], f=[0, 1], path=[], goal=BARD_SPOT, next=now + 9e9, bubble=["♪", now + 6])
            self.dirty = True
        elif not on and n:
            del self.folk["Rowan"]
            self.dirty = True

    def _tick_fest(self, now):
        for name, d in list(self.derby.items()):
            if now >= d["until"]:
                del self.derby[name]
                p = self.players.get(name)
                if p:
                    self.finish_derby(p, d["n"], now)

    def _snap_fest(self, snap, now):
        f = self.festival(now)
        snap["festival"] = f[0] if f else None
        snap["concert"] = self.concert_on(now)
        snap["derby"] = {k: [int(v["until"] - now), v["n"]] for k, v in self.derby.items()}

    def _pub_fest(self, p, d, now):
        pass

    def _priv_fest(self, p, d):
        d["songs"] = list(p.get("songs", []))

    # ------------------------------------------------------------------ talking to the host and the bard
    def _use_fest(self, p, loc, fx, fy, now):
        name, n = self.npc_at(loc, fx, fy)
        if name == "Mayor Hazel" and self.festival(now) and loc == "town":
            return self.fest_menu(p, now) or True
        if name == "Rowan":
            return self.bard_menu(p, now) or True
        return False

    def fest_menu(self, p, now):
        key, title = self.festival(now)
        scores = self.fest_scores.get(self.fest_key(now), {})
        mine = scores.get(p["name"])
        best = max(scores.values()) if scores else None
        rows = []
        intro = {
            "hoedown": "Grab a partner! Hit the arrows in time with the fiddle.",
            "rodeo": "Stay on Old Thunder as long as you can. The best ride today wins the champion's hat!",
            "fair": "Enter your finest produce. The judges award ribbons.",
            "fallfest": "Bob for candy apples and weigh your biggest pumpkin.",
            "derby": "Three minutes, as many fish as you can land. Fish anywhere in town!",
            "feast": "Bring a cooked dish to the potluck and join the gift swap.",
        }[key]
        if key == "hoedown":
            rows.append(dict(label="Join the line dance", info="Arrow keys (or the buttons) when each arrow reaches the line.", act=dict(t="minigame", game="dance"), ok=True, right="Dance!"))
        elif key == "rodeo":
            rows.append(dict(label="Ride the bull", info="Lean left and right to stay centred for 15 seconds.", act=dict(t="minigame", game="rodeo"), ok=True, right="Ride!"))
        elif key == "fair":
            for k, n in p["inventory"]:
                it = W.ITEMS[k]
                if it["kind"] in ("crop", "fruit", "animal", "artisan") or k == "milk":
                    rows.append(dict(key=k, label="Enter your %s" % it["name"], info="The judges weigh up quality and value.", act=dict(t="fest_enter", item=k), ok=mine is None, right="Enter"))
            if len(rows) == 0:
                rows.append(dict(label="Nothing to enter", info="Bring crops, fruit, eggs, milk, cheese, jam or honey.", ok=False))
        elif key == "fallfest":
            rows.append(dict(label="Bob for apples", info="Press space as the apple bobs into the ring. Five tries.", act=dict(t="minigame", game="apples"), ok=True, right="Bob!"))
            if self.count(p, "pumpkin"):
                rows.append(dict(key="pumpkin", label="Weigh your biggest pumpkin", info="The heaviest pumpkin today wins the witch's hat.", act=dict(t="fest_enter", item="pumpkin"), ok=mine is None, right="Weigh"))
        elif key == "derby":
            going = p["name"] in self.derby
            rows.append(dict(label="Start the derby", info="Three minutes on the clock from when you start.", act=dict(t="derby_start"), ok=not going and mine is None, right="Go!" if not going else "Fishing..."))
        elif key == "feast":
            for k, n in p["inventory"]:
                if W.ITEMS[k]["kind"] == "food":
                    rows.append(dict(key=k, label="Bring %s to the potluck" % W.ITEMS[k]["name"], info="Everyone shares; the town loves it.", act=dict(t="fest_enter", item=k), ok=mine is None, right="Share"))
            rows.append(dict(key="feast_gift", label="Join the gift swap", info="Someone in town has a present for you.", act=dict(t="gift_swap"), ok=not p.get("swapped") == self.fest_key(now), right="Swap"))
        if scores:
            rows.append(dict(section="Best at the %s" % title))
            for who, sc in sorted(scores.items(), key=lambda kv: -kv[1])[:3]:
                rows.append(dict(label=who, info="", right=str(sc), ok=False))
        rows += self.fair_rows(p, now)
        self.list_menu(p, "fest", title, rows, sub="Mayor Hazel: \"%s\"" % intro, keep=True)

    def record(self, p, score, now, game=None):
        key = self.fest_key(now) + (":" + game if game == "apples" else "")     # the apple tub keeps its own tally beside the weigh-in
        scores = self.fest_scores.setdefault(key, {})
        if not any(p["name"] in v for k, v in self.fest_scores.items() if k.split(":apples")[0] == self.fest_key(now)):
            self.credit(p, "fest")                       # the first thing you join on a festival day counts for the Revival
        scores[p["name"]] = max(score, scores.get(p["name"], 0))
        self.dirty = True
        f = self.festival(now)
        if f:
            self.event_points(p, f[0], game, score, now)     # every event earns festival points (see fairground)
        return scores

    def act_minigame(self, p, msg, now):
        f = self.festival(now)
        game = msg.get("game")
        if not f or p.get("loc") != "town" or game not in ("dance", "rodeo", "apples"):
            return
        p["_mg"] = [game, now]
        self.out.append((p["name"], dict(t="minigame", game=game, seed=random.randint(1, 10 ** 6))))

    def act_minigame_done(self, p, msg, now):
        f = self.festival(now)
        game = msg.get("game")
        started = p.pop("_mg", None)
        if not f or p.get("loc") != "town" or not started or started[0] != game or now - started[1] > 600:
            return
        score = max(0, min(100, int(msg.get("score", 0))))
        prev = self.fest_scores.get(self.fest_key(now) + (":apples" if game == "apples" else ""), {}).get(p["name"])
        best = prev or 0
        gain = max(0, score - best)                  # prizes pay for your first go and for beating your best, not for grinding
        if game == "dance" and f[0] == "hoedown":
            self.record(p, score, now)
            prize = (50 if prev is None else 0) + gain * 4
            self.coins += prize
            if prev is None:
                self.befriend_all(p, 10)
            if score >= 70 and best < 70:
                self.give(p, "blue_ribbon", 1)
            how = "danced up a storm" if score >= 70 else "kicked up their heels" if score >= 35 else "gave the line dance a whirl"
            if prize:
                self.event("%s %s at the Hoedown! Score %d (+%dg)." % (p["name"], how, score, prize), now, "good")
            else:
                self.say(p, "Score %d - your best today is still %d. Have another go!" % (score, best))
        elif game == "rodeo" and f[0] == "rodeo":
            secs = round(score * 15 / 100, 1)
            self.record(p, score, now)
            prize = (40 if prev is None else 0) + gain * 5
            self.coins += prize
            if score >= 100 and "champion" not in p.setdefault("wardrobe", []):
                p["wardrobe"].append("champion")
                self.event("%s rode Old Thunder the full 15 seconds! The Rodeo Champion Hat is theirs!" % p["name"], now, "good")
            elif prize:
                self.event("%s held on to Old Thunder for %.1f seconds! (+%dg)" % (p["name"], secs, prize), now, "good")
            else:
                self.say(p, "%.1f seconds - your best today is still %.1f. Saddle up again!" % (secs, best * 15 / 100))
        elif game == "apples" and f[0] == "fallfest":
            self.record(p, score, now, "apples")
            n = score // 20 - best // 20
            if n > 0:
                self.give(p, "apple_candy", n)
                self.say(p, "You bobbed %d apple%s! Juniper hands you %d candy apple%s." % (score // 20, "s" if score // 20 != 1 else "", n, "s" if n != 1 else ""), "good")
            else:
                self.say(p, "You bobbed %d apple%s. (Beat your best of %d for more candy apples.)" % (score // 20, "s" if score // 20 != 1 else "", best // 20))
        self.fest_menu(p, now)

    def act_fest_enter(self, p, msg, now):
        f = self.festival(now)
        key = msg.get("item")
        if not f or p.get("loc") != "town" or not self.count(p, key or ""):
            return
        scores = self.fest_scores.get(self.fest_key(now), {})
        if p["name"] in scores:
            return self.say(p, "You've already entered today.")
        it = W.ITEMS[key]
        if f[0] == "fair":
            score = int(it["sell"] * random.uniform(0.8, 1.6))
            self.record(p, score, now)
            self.take(p, key, 1)
            ribbon = "blue_ribbon" if score >= 150 else "red_ribbon"
            self.give(p, ribbon, 1)
            self.coins += score
            self.event("The judges gave %s's %s a %s! (+%dg)" % (p["name"], it["name"], W.ITEMS[ribbon]["name"], score), now, "good")
        elif f[0] == "fallfest" and key == "pumpkin":
            weight = int(random.triangular(12, 160, 45))
            scores = self.record(p, weight, now)
            self.take(p, key, 1)
            self.coins += weight * 3
            best = max(scores.values())
            if weight >= best and "witch" not in p.setdefault("wardrobe", []):
                p["wardrobe"].append("witch")
                self.event("%s's pumpkin weighed %d lb - the biggest yet! The Fallfest Witch Hat is theirs!" % (p["name"], weight), now, "good")
            else:
                self.event("%s's pumpkin weighed in at %d lb! (+%dg)" % (p["name"], weight, weight * 3), now, "good")
        elif f[0] == "feast" and it["kind"] == "food":
            self.take(p, key, 1)
            self.record(p, it["sell"], now)
            self.befriend_all(p, 40)
            self.coins += it["sell"]
            if "santa" not in p.setdefault("wardrobe", []):
                p["wardrobe"].append("santa")
            self.event("%s brought %s to the Winter Feast! Everyone loved it. (Feast Cap added to your wardrobe)" % (p["name"], it["name"]), now, "good")
        self.fest_menu(p, now)

    def act_gift_swap(self, p, msg, now):
        f = self.festival(now)
        if not f or f[0] != "feast" or p.get("loc") != "town" or p.get("swapped") == self.fest_key(now):
            return
        p["swapped"] = self.fest_key(now)
        giver = random.choice([n for n in self.folk if n != "Rowan"])
        gift = random.choice(["honey_cake", "pumpkin_pie", "diamond", "star_fragment", "monster_treat", "fabric", "bee_house", "art_winter_town", "ruby"])
        self.give(p, gift, 1)
        self.befriend(p, giver, 30)
        self.fest_award(p, "swap", 10, now)
        self.event("%s's secret gift-swap partner was %s: a %s!" % (p["name"], giver, W.ITEMS[gift]["name"]), now, "good")
        self.fest_menu(p, now)

    def befriend_all(self, p, pts):
        for name in self.folk:
            fr = p.setdefault("friends", {})
            fr[name] = min(1000, fr.get(name, 0) + pts)

    # ------------------------------------------------------------------ the fishing derby
    def act_derby_start(self, p, msg, now):
        f = self.festival(now)
        if not f or f[0] != "derby" or p.get("loc") != "town" or p["name"] in self.derby:
            return
        if p["name"] in self.fest_scores.get(self.fest_key(now), {}):
            return self.say(p, "You've had your go at the derby today.")
        self.derby[p["name"]] = dict(until=now + DERBY_SECONDS, n=0)
        self.out.append((p["name"], dict(t="open", menu="close")))
        self.event("%s started the Frost Fishing Derby! Three minutes on the clock!" % p["name"], now, "good")

    def derby_catch(self, p, key):
        d = self.derby.get(p["name"])
        if d and p.get("loc") == "town" and W.ITEMS[key]["kind"] == "fish" and not W.FISH[key]["junk"]:
            d["n"] += 1
            self.say(p, "Derby catch #%d!" % d["n"], "good")

    def finish_derby(self, p, n, now):
        scores = self.record(p, n, now)
        prize = n * 120
        self.coins += prize
        if n >= 5:
            self.give(p, "derby_trophy", 1)
        self.event("Derby over! %s landed %d fish (+%dg)%s" % (p["name"], n, prize, " and a Derby Trophy!" if n >= 5 else "."), now, "good")

    # ------------------------------------------------------------------ the bard
    def bard_menu(self, p, now):
        rows = []
        for key, title in SONGS:
            have = key in p.get("songs", [])
            rows.append(dict(song=key, label=title, info="in your song book" if have else "Request it and he'll teach it to you.",
                             act=dict(t="request_song", song=key), ok=True, right="Play" if have else "Request"))
        self.list_menu(p, "bard", "Rowan the Wandering Bard", rows,
                       sub="\"Evening, friend! Pick a tune. Learn it and you can play it at home with M.\"", keep=True)

    def act_request_song(self, p, msg, now):
        song = msg.get("song")
        if song not in dict(SONGS) or not self.concert_on(now):
            return
        if song not in p.setdefault("songs", []):
            p["songs"].append(song)
            self.bump(p, "songs")
            self.say(p, "Rowan taught you \"%s\". Press M to play your songs." % dict(SONGS)[song], "good")
        n = self.folk.get("Rowan")
        if n:
            n["bubble"] = ["♪ " + dict(SONGS)[song] + " ♪", now + 12]
        for q in self.online_in("town"):
            self.out.append((q["name"], dict(t="song", song=song, title=dict(SONGS)[song])))
        self.check_milestones(now)
        self.out.append((p["name"], dict(t="open", menu="close")))
