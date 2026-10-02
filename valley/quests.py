"""Villager quests. Favors: each in-game morning a few villagers wear a "!" - talk to them for a small job sized to your
level (fetch something, carry a parcel across the valley, catch a bug). Stories: villagers have questlines of their own
that open with friendship and level. A "?" means you have what someone asked for. L opens your quest log."""
import random

import world as W
import areas as AR
from valley import progress as PR

W._item("parcel", "Parcel", "quest", 0, "=", "=", "yellow")
MAX_FAVORS = 3
FAVORS_PER_DAY = 3

# ------------------------------------------------------------------ story questlines
# each chapter: title, needs friendship hearts h and level lv, what they say when asking, what's needed, what they say
# after, and the reward. Needs: ("item", key, n) handed over; ("stat", name, n, label) done after accepting;
# ("depth", n) Depths floor reached; ("deliver", villager) carry a parcel to them.
def ch(title, h, lv, ask, needs, done, coins=0, xp=30, items=(), hat=None, news=None):
    return dict(title=title, h=h, lv=lv, ask=ask, needs=list(needs), done=done, coins=coins, xp=xp, items=list(items), hat=hat, news=news)


STORIES = {
    "Mayor Hazel": [
        ch("The Silent Clock", 0, 1, "The town hall clock stopped the winter I was elected. Bring me 5 Copper Ore and we'll start mending it.",
           [("item", "copper_ore", 5)], "Look at that - the hands moved! Just a little. We're getting there.", coins=200),
        ch("Gears That Sing", 2, 4, "The gears need iron - 5 Iron Ore - and a Quartz to make them sing.",
           [("item", "iron_ore", 5), ("item", "quartz", 1)], "Tick... tock! Here, wear this. Every mayor's helper deserves a good hat.", coins=400, hat="tophat"),
        ch("The Mainspring", 4, 8, "The old mainspring was lost down in the Depths. A Treasure Key from a deep chest should open the clock's case.",
           [("item", "treasure_key", 1)], "Listen... the town hall clock is chiming again! Thank you, truly.", coins=1000, xp=120,
           news="The town hall clock chimes again, thanks to {name}!"),
    ],
    "Old Tomas": [
        ch("Patience", 0, 0, "Fishing's all about patience. Catch any 5 fish and come tell me about it.",
           [("stat", "fish", 5, "fish caught")], "Five! You've got the patience. Good.", coins=150),
        ch("The Sly Catfish", 2, 3, "Catfish hide in the deep river pools. Bring me one - they're sly.",
           [("item", "catfish", 1)], "Hah! A fine one. You're a real angler now.", coins=300),
        ch("The One That Got Away", 4, 10, "Forty years I've chased the Golden Koi. Bring it to me before I'm too old to see it.",
           [("item", "golden_koi", 1)], "...It's beautiful. Forty years. Thank you, friend.", coins=1500, xp=150, items=[("star_fragment", 2)],
           news="{name} brought Old Tomas the Golden Koi he chased for forty years!"),
    ],
    "Juniper": [
        ch("Grandma's Recipe Box", 0, 0, "I found my grandma's recipe box! Her turnip soup first - bring me 5 Turnips.",
           [("item", "turnip", 5)], "Smells just like her kitchen. Take some pancakes!", coins=120, items=[("pancakes", 3)]),
        ch("Strawberry Shortcake", 2, 3, "Her famous shortcake: 5 Strawberries and 2 Milk.",
           [("item", "strawberry", 5), ("item", "milk", 2)], "Perfect! Have some - it's even better fresh.", coins=250, items=[("shortcake", 3)]),
        ch("Pie for the Whole Town", 5, 9, "Her last recipe: pumpkin pie for everyone. 3 Pumpkins and a jar of Honey.",
           [("item", "pumpkin", 3), ("item", "honey", 1)], "The whole town's lining up for pie! Grandma would be so happy.", coins=600, items=[("honey_cake", 3)],
           news="Juniper baked pumpkin pie for all of Hollow Town with {name}'s help!"),
    ],
    "Professor Fern": [
        ch("A Growing Collection", 0, 0, "The museum needs you! Donate any 3 pieces - bugs, fish, fossils, anything.",
           [("stat", "donated", 3, "museum donations")], "Wonderful additions. The collection is growing!", coins=200),
        ch("Under Our Feet", 2, 4, "The valley is full of history. Dig up 3 of those wriggling spots with your hoe.",
           [("stat", "dug", 3, "spots dug up")], "History, everywhere! Here's something for your trouble.", coins=300, items=[("quartz", 2)]),
        ch("The Dinosaur", 4, 9, "Somewhere in this valley is a Dino Skull. Find it and bring it to me.",
           [("item", "dino_skull", 1)], "A complete skull! I'll give it pride of place.", coins=1200, xp=120,
           news="{name} found a Dino Skull for the museum!"),
    ],
    "Doc Alder": [
        ch("Field Medicine", 0, 1, "My tonic needs 3 Mushrooms from the woods.",
           [("item", "mushroom", 3)], "Excellent. That'll keep the whole valley healthy.", coins=150),
        ch("An Apple a Day", 2, 3, "Leeks and berries keep folks well: 3 Leeks and 3 Wild Berries, please.",
           [("item", "leek", 3), ("item", "wild_berry", 3)], "Doctor's orders: take these with you.", coins=300, items=[("trail_mix", 3)]),
    ],
    "Ingrid": [
        ch("Forge Fire", 0, 2, "My forge is starving. Bring me 10 Coal and I'll make you something sharp.",
           [("item", "coal", 10)], "Now she burns! Here - a copper sword, fresh off the anvil.", coins=100, items=[("sword_copper", 1)]),
        ch("Good Steel", 3, 7, "Iron's the heart of good steel. 10 Iron Ore.",
           [("item", "iron_ore", 10)], "An iron sword. Treat it well.", coins=200, items=[("sword_iron", 1)]),
        ch("Gold and Fire", 5, 14, "My masterpiece: 5 Gold Ore and a Ruby for the pommel.",
           [("item", "gold_ore", 5), ("item", "ruby", 1)], "The best blade I've ever made. It's yours.", coins=300, items=[("sword_gold", 1)],
           news="Ingrid forged a golden sword for {name}!"),
    ],
    "Pip": [
        ch("Lost Mail", 0, 0, "I'm swamped! Could you take this parcel to Granny Rose?",
           [("deliver", "Granny Rose")], "Delivered? You're a lifesaver!", coins=100),
        ch("Up the Mountain", 2, 2, "This one's for Captain Ash at the guild on Summit Ridge.",
           [("deliver", "Captain Ash")], "All the way up the mountain! Thanks a ton.", coins=200),
        ch("Gulch Express", 3, 6, "Last one, and it's far - Dolly at the saloon in Dusty Gulch. Take the stagecoach!",
           [("deliver", "Dolly")], "You're the fastest courier in the valley. Here, wear it with pride.", coins=400, hat="bandana"),
    ],
    "Oakley": [
        ch("Birdhouses", 0, 1, "I'm building birdhouses for the whole town. 30 Wood, please.",
           [("item", "wood", 30)], "The birds thank you. So do I - here's some path stones.", coins=200, items=[("path_stone", 10)]),
        ch("Bridges", 2, 5, "Planning a few footbridges: 40 Wood and 20 Fiber.",
           [("item", "wood", 40), ("item", "fiber", 20)], "Take a couple of bridge kits for your own farm.", coins=300, items=[("bridge_kit", 2)]),
    ],
    "Captain Ash": [
        ch("Slime Season", 0, 2, "The mine's crawling. Defeat 10 monsters and report back.",
           [("stat", "monsters", 10, "monsters defeated")], "Not bad, farmer. Take these treats - they calm a weakened monster.", coins=250, items=[("monster_treat", 2)]),
        ch("Into the Depths", 2, 12, "Prove yourself: reach floor 5 of the Depths.",
           [("depth", 5)], "Floor five! The guild salutes you.", coins=800, xp=100),
        ch("The Bottom of the World", 4, 16, "No one's been below floor 15. Will you be the first?",
           [("depth", 15)], "Legendary. Wear this crown - you've earned it.", coins=2000, xp=200, hat="crown",
           news="{name} reached floor 15 of the Depths!"),
    ],
    "Wren": [
        ch("The Lighthouse Lens", 0, 2, "The lighthouse lens is cracked. 3 Quartz will patch it.",
           [("item", "quartz", 3)], "The light's shining again! Ships can find their way.", coins=200),
        ch("A Brighter Beam", 3, 6, "For a beam the whole sea can see: 2 Amethyst and an Emerald.",
           [("item", "amethyst", 2), ("item", "emerald", 1)], "It's the brightest light on the coast now.", coins=600, items=[("star_fragment", 1)],
           news="The lighthouse shines brighter than ever, thanks to {name}!"),
    ],
    "Ranger Moss": [
        ch("Roots", 0, 1, "Every farmer should plant a tree. Plant one in a tree spot in your orchard meadow.",
           [("stat", "trees", 1, "trees planted")], "That tree will outlive us both. Here's another for when you're ready.", coins=150, items=[("apple_sapling", 1)]),
        ch("Gifts of the Forest", 2, 5, "Forage 10 wild things - learn what the land gives freely.",
           [("stat", "foraged", 10, "things foraged")], "You've got a forager's eye. A cherry sapling for your orchard.", coins=300, items=[("cherry_sapling", 1)]),
    ],
    "Granny Rose": [
        ch("The Lost Locket", 0, 0, "I lost my locket years ago... maybe it's buried somewhere. Dig up 2 wriggling spots for me?",
           [("stat", "dug", 2, "spots dug up")], "No locket, but what treasures! You're a dear.", coins=150),
        ch("Seaside Memories", 3, 4, "My husband and I collected shells on the beach. 3 Seashells and a Coral, for old times.",
           [("item", "seashell", 3), ("item", "coral", 1)], "Just like we used to find. Here, a flower hat for you.", coins=300, hat="flower"),
    ],
    "Coco": [
        ch("Island Feast", 0, 3, "I'm throwing a feast at the tiki hut! 5 Coconuts, please.",
           [("item", "coconut", 5)], "Let's eat! Take some curry home.", coins=250, items=[("coconut_curry", 2)]),
    ],
    "Rusty": [
        ch("House Special", 0, 2, "New house special: Honey and Wild Berries. 2 Honey, 5 Wild Berries.",
           [("item", "honey", 2), ("item", "wild_berry", 5)], "It's a hit! Drinks are on me.", coins=300),
        ch("Cheese Board", 3, 6, "Fancy folk want a cheese board. 2 Cheese and a Jam.",
           [("item", "cheese", 2), ("item", "jam", 1)], "Classy! The saloon's never been fancier.", coins=500),
    ],
    "Prospector Gus": [
        ch("Gold Fever", 0, 3, "Pan the creek in the gulch and bring me a Gold Nugget, partner.",
           [("item", "gold_nugget", 1)], "Eureka! You've got the fever too.", coins=400),
        ch("The Mother Lode", 3, 8, "The mine's got real gold. 10 Gold Ore, and we'll call it a strike.",
           [("item", "gold_ore", 10)], "The mother lode! Here's your share.", coins=900, xp=90),
    ],
    "Sheriff Boone": [
        ch("Rustlers", 0, 4, "Varmints are raiding the gulch. Bag 3 wild game for me.",
           [("stat", "hunted", 3, "game hunted")], "The gulch is safer already. Obliged.", coins=300),
    ],
}
for _who, _chs in STORIES.items():                 # every item a story asks for or gives really exists
    for _c in _chs:
        for _n in _c["needs"]:
            assert _n[0] != "item" or _n[1] in W.ITEMS, _n
        for _k, _ in _c["items"]:
            assert _k in W.ITEMS, _k

# ------------------------------------------------------------------ favors: small jobs, sized to your level
FAVOR_LINES = {
    "fetch": ["Could you bring me {n} {item}? I'd be ever so grateful.", "I need {n} {item} - any chance you have some?",
              "{n} {item} would really make my day.", "Running low on {item}. Bring me {n}?"],
    "deliver": ["Would you take this parcel to {to}? I can't leave right now.", "This needs to get to {to}. Could you carry it?"],
    "bug": ["I've always wanted to see a {item} up close. Catch me one?", "Could you net me a {item}? Bug nets are at the Mercantile... or make one!"],
}


class Quests:
    # ------------------------------------------------------------------ bookkeeping
    def qstate(self, p):
        q = p.setdefault("quests", {})
        q.setdefault("active", {})
        q.setdefault("story", {})
        q.setdefault("favors_done", [])
        q.setdefault("seen_places", [])
        q.setdefault("later", {})            # villager -> the day you said "not now" (their offer waits until tomorrow)
        return q

    def _join_quests(self, p, now):
        self.qstate(p)

    def _arrive_quests(self, p, frm, now):
        seen = self.qstate(p)["seen_places"]
        if p.get("loc") not in seen:
            seen.append(p.get("loc"))

    def favor_day(self, now):
        return int((now + 360 + W.SKY_SHIFT) // W.SKY_DAY)

    def hearts_with(self, p, name):
        return (p.get("friends") or {}).get(name, 0) // 100

    def residents_now(self):
        return [n for n in getattr(self, "folk", {})]

    # ------------------------------------------------------------------ what a villager has for you
    def story_offer(self, p, name):
        chs = STORIES.get(name)
        if not chs:
            return None
        q = self.qstate(p)
        idx = q["story"].get(name, 0)
        if idx >= len(chs) or ("s:%s:%d" % (name, idx)) in q["active"]:
            return None
        c = chs[idx]
        if self.hearts_with(p, name) < c["h"] or self.level_of(p) < c["lv"]:
            return None
        return idx, c

    def favors_today(self, now):
        """The villagers who have a favor to ask today (the same for everyone) and what it is."""
        day = self.favor_day(now)
        rng = random.Random(day * 7919 ^ self.seed)
        folk = sorted(self.residents_now())
        out = {}
        season = self.season_at(now)
        for name in rng.sample(folk, min(FAVORS_PER_DAY, len(folk))):
            out[name] = self.make_favor(name, season, rng)
        return out

    def make_favor(self, name, season, rng):
        kind = rng.choice(["fetch", "fetch", "fetch", "deliver", "bug"])
        if kind == "deliver":
            others = [n for n in sorted(self.residents_now()) if n != name]
            to = rng.choice(others) if others else name
            return dict(kind="deliver", to=to, line=rng.choice(FAVOR_LINES["deliver"]).format(to=to))
        if kind == "bug":
            from valley import museum as MU
            bugs = [b[0] for b in MU.BUGS if season in b[3]]
            if bugs:
                item = rng.choice(sorted(bugs))
                return dict(kind="bug", item=item, n=1, line=rng.choice(FAVOR_LINES["bug"]).format(item=W.ITEMS[item]["name"]))
        pool = []
        for k, c in W.CROPS.items():
            if season in c["seasons"] and PR.CROP_LEVEL.get(k, 0) <= 6:
                pool.append((k, rng.randint(2, 5)))
        for k, f in W.FORAGE.items():
            if season in f.get("seasons", ()):
                pool.append((k, rng.randint(2, 4)))
        for k in ("copper_ore", "coal", "stone", "wood", "fiber", "milk", "egg", "sardine", "carp"):
            if k in W.ITEMS:
                pool.append((k, rng.randint(2, 6) if k in ("stone", "wood", "fiber") else rng.randint(1, 3)))
        item, n = rng.choice(sorted(pool))
        return dict(kind="fetch", item=item, n=n, line=rng.choice(FAVOR_LINES["fetch"]).format(n=n, item=W.ITEMS[item]["name"]))

    def favor_offer(self, p, name, now):
        fav = self.favors_today(now).get(name)
        if not fav:
            return None
        q = self.qstate(p)
        qid = "f:%d:%s" % (self.favor_day(now), name)
        if qid in q["active"] or qid in q["favors_done"]:
            return None
        if sum(1 for k in q["active"] if k.startswith("f:")) >= MAX_FAVORS:
            return None
        return qid, fav

    # ------------------------------------------------------------------ progress on what's needed
    def need_progress(self, p, quest, need):
        kind = need[0]
        if kind == "item":
            have = self.count(p, need[1])
            return min(have, need[2]), need[2], "%s %d/%d" % (W.ITEMS[need[1]]["name"], min(have, need[2]), need[2])
        if kind == "stat":
            have = (p.get("stats") or {}).get(need[1], 0) - quest.get("base", {}).get(need[1], 0)
            return min(have, need[2]), need[2], "%s %d/%d" % (need[3], min(have, need[2]), need[2])
        if kind == "depth":
            have = p.get("deepest", 0)
            return min(have, need[1]), need[1], "Depths floor %d/%d" % (min(have, need[1]), need[1])
        if kind == "deliver":
            have = 1 if self.count(p, "parcel") else 0
            return have, 1, "Parcel for %s%s" % (need[1], "" if have else " (lost - ask again tomorrow)")
        return 0, 1, "?"

    def quest_ready(self, p, quest):
        return all(self.need_progress(p, quest, n)[0] >= self.need_progress(p, quest, n)[1] for n in quest["needs"])

    def turn_in_for(self, p, name):
        for qid, quest in self.qstate(p)["active"].items():
            if quest["to"] == name and self.quest_ready(p, quest):
                return qid, quest
        return None

    # ------------------------------------------------------------------ talking (called first when you face a villager)
    def put_off(self, p, name, now):
        return self.qstate(p)["later"].get(name) == self.day_key(now)

    def quest_talk(self, p, name, n, now):
        ready = self.turn_in_for(p, name)
        if ready:
            self.complete_quest(p, *ready, now=now)
            return True
        if self.put_off(p, name, now):
            return False                                    # you said "not now": a normal chat (or their shop) today
        sel = self.selected_item(p)
        giftable = sel and W.ITEMS[sel]["kind"] not in ("gear", "key", "weapon", "machine", "ammo", "treat", "quest") and sel not in W.TOOLS
        if giftable and (p.get("met") or {}).get(name) == self.day_key(now):
            return False                                    # you've said hello today and you're holding a gift: give it
        counter = p.get("loc") in AR.KEEPERS and AR.KEEPERS[p.get("loc")] == name
        later = dict(label="Let me shop first" if counter else "Not now", act=dict(t="quest_close", who=name), ok=True)
        offer = self.story_offer(p, name)
        if offer:
            idx, c = offer
            self.talk_points(p, name, now)
            self.list_menu(p, "quest", "%s: %s" % (name, c["title"]), [
                dict(label="Accept", info=self.needs_line(c["needs"]) + self.reward_line(c), act=dict(t="quest_accept", who=name, kind="story"), ok=True, right="OK"),
                later],
                sub="%s: \"%s\"" % (name, c["ask"]), foot="Story chapter %d of %d. L opens your quest log." % (idx + 1, len(STORIES[name])))
            return True
        fav = self.favor_offer(p, name, now)
        if fav:
            qid, f = fav
            self.talk_points(p, name, now)
            reward = self.favor_reward(f)
            self.list_menu(p, "quest", "%s has a favor to ask" % name, [
                dict(label="Sure, I'll help", info="Reward: %dg, friendship, %d xp" % (reward[0], reward[1]),
                     act=dict(t="quest_accept", who=name, kind="favor"), ok=True, right="OK"),
                later],
                sub="%s: \"%s\"" % (name, f["line"]), foot="A favor for today. L opens your quest log.")
            return True
        return False

    def talk_points(self, p, name, now):
        """Asking a favor still counts as today's chat (friendship), like a normal talk would."""
        day = self.day_key(now)
        met = p.setdefault("met", {})
        if met.get(name) != day:
            met[name] = day
            self.befriend(p, name, 20)

    @staticmethod
    def needs_line(needs):
        parts = []
        for n in needs:
            if n[0] == "item":
                parts.append("%d %s" % (n[2], W.ITEMS[n[1]]["name"]))
            elif n[0] == "stat":
                parts.append("%d %s" % (n[2], n[3]))
            elif n[0] == "depth":
                parts.append("reach Depths floor %d" % n[1])
            elif n[0] == "deliver":
                parts.append("a parcel to %s" % n[1])
        return "Needs: " + ", ".join(parts)

    @staticmethod
    def reward_line(c):
        bits = (["%dg" % c["coins"]] if c["coins"] else []) + ["%d xp" % c["xp"]]
        bits += ["%s x%d" % (W.ITEMS[k]["name"], n) for k, n in c["items"]]
        if c.get("hat"):
            bits.append("a hat")
        return "  ·  Reward: " + ", ".join(bits)

    def favor_reward(self, f):
        if f["kind"] == "fetch":
            value = W.ITEMS[f["item"]]["sell"] * f["n"]
            return max(40, int(value * 1.6) + 25), 15 + value // 10
        return (90, 20) if f["kind"] == "deliver" else (120, 25)

    # ------------------------------------------------------------------ accepting, finishing, giving up
    def act_quest_accept(self, p, msg, now):
        name, kind = msg.get("who"), msg.get("kind")
        q = self.qstate(p)
        if name not in getattr(self, "folk", {}):
            return
        if kind == "story":
            offer = self.story_offer(p, name)
            if not offer:
                return
            idx, c = offer
            qid = "s:%s:%d" % (name, idx)
            quest = dict(giver=name, title=c["title"], story=[name, idx], needs=c["needs"], to=name,
                         base={nd[1]: (p.get("stats") or {}).get(nd[1], 0) for nd in c["needs"] if nd[0] == "stat"}, since=now)
            for nd in c["needs"]:
                if nd[0] == "deliver":
                    quest["to"] = nd[1]
                    self.give(p, "parcel", 1)
            q["active"][qid] = quest
            self.say(p, "Quest started: %s. (L for your quest log)" % c["title"], "good")
        elif kind == "favor":
            offer = self.favor_offer(p, name, now)
            if not offer:
                return
            qid, f = offer
            coins, xp = self.favor_reward(f)
            if f["kind"] == "deliver":
                needs, to = [("deliver", f["to"])], f["to"]
                self.give(p, "parcel", 1)
                title = "Parcel for %s" % f["to"]
            else:
                needs, to = [("item", f["item"], f["n"])], name
                title = "%s for %s" % (W.ITEMS[f["item"]]["name"], name)
            q["active"][qid] = dict(giver=name, title=title, story=None, needs=needs, to=to, base={}, coins=coins, xp=xp, since=now)
            self.say(p, "Favor accepted: %s. (L for your quest log)" % title, "good")
        self.out.append((p["name"], dict(t="open", menu="close")))
        self.dirty = True

    def act_quest_close(self, p, msg, now):
        """Not now: their offer waits until tomorrow; at a shop counter, the shop opens right away."""
        name = msg.get("who")
        self.out.append((p["name"], dict(t="open", menu="close")))
        if name in getattr(self, "folk", {}):
            self.qstate(p)["later"][name] = self.day_key(now)
            loc = p.get("loc")
            if loc in AR.KEEPERS and AR.KEEPERS[loc] == name and self.npc_present(name, loc):
                self.keeper_counter(p, loc, name, now)
        self.dirty = True

    def complete_quest(self, p, qid, quest, now):
        q = self.qstate(p)
        for nd in quest["needs"]:
            if nd[0] == "item":
                self.take(p, nd[1], nd[2])
            elif nd[0] == "deliver":
                self.take(p, "parcel", 1)
        del q["active"][qid]
        self.bump(p, "quests")
        if quest.get("story"):
            name, idx = quest["story"]
            c = STORIES[name][idx]
            q["story"][name] = idx + 1
            coins, xp = c["coins"], c["xp"]
            for k, n in c["items"]:
                self.give(p, k, n)
            if c.get("hat") and c["hat"] not in p.setdefault("wardrobe", ["cowboy", "none"]):
                p["wardrobe"].append(c["hat"])
            self.befriend(p, name, 150)
            line = "%s: \"%s\"" % (name, c["done"])
            news = (c.get("news") or "{name} finished %s's story: %s." % (name, c["title"])).format(name=p["name"])
            self.event(news, now, "good")
        else:
            coins, xp = quest["coins"], quest["xp"]
            q["favors_done"] = (q["favors_done"] + [qid])[-40:]
            self.befriend(p, quest["giver"], 60)
            if quest["to"] != quest["giver"]:
                self.befriend(p, quest["to"], 20)
            line = "%s: \"Thank you so much!\"" % quest["to"]
        if coins:
            self.coins += coins
            self.bump(p, "earned", coins)
        p["xp"] += xp
        self.say(p, line, "good")
        self.say(p, "Quest complete: %s (+%dg, +%d xp)." % (quest["title"], coins, xp), "good")
        self.check_milestones(now)
        self.dirty = True

    def act_quest_abandon(self, p, msg, now):
        q = self.qstate(p)
        qid = msg.get("id")
        quest = q["active"].pop(qid, None)
        if not quest:
            return
        if any(nd[0] == "deliver" for nd in quest["needs"]):
            self.take(p, "parcel", 1)
        if qid.startswith("f:"):
            q["favors_done"].append(qid)
        self.say(p, "Gave up on: %s." % quest["title"])
        self.act_quests(p, {}, now)

    # ------------------------------------------------------------------ the quest log (L)
    def act_quests(self, p, msg, now):
        q = self.qstate(p)
        rows = []
        stories = [(qid, quest) for qid, quest in q["active"].items() if quest.get("story")]
        favors = [(qid, quest) for qid, quest in q["active"].items() if not quest.get("story")]
        rows.append(dict(section="Stories"))
        if not stories:
            rows.append(dict(label="No story in progress", info="Make friends - villagers open up and ask for help as you grow closer.", dim=True))
        for qid, quest in stories:
            name, idx = quest["story"]
            prog = [self.need_progress(p, quest, nd)[2] for nd in quest["needs"]]
            ready = self.quest_ready(p, quest)
            rows.append(dict(npc=name, label="%s - %s (%d/%d)" % (name, quest["title"], idx + 1, len(STORIES[name])),
                             info=("Ready! Talk to %s.  " % quest["to"] if ready else "") + " · ".join(prog), right="Ready" if ready else ""))
        rows.append(dict(section="Favors (today)"))
        if not favors:
            rows.append(dict(label="No favors right now", info="Look for villagers with a ! over their heads.", dim=True))
        for qid, quest in favors:
            prog = [self.need_progress(p, quest, nd)[2] for nd in quest["needs"]]
            ready = self.quest_ready(p, quest)
            rows.append(dict(npc=quest["giver"], label=quest["title"], info=("Ready! Talk to %s.  " % quest["to"] if ready else "") + " · ".join(prog),
                             act=dict(t="quest_abandon", id=qid), ok=True, right="Give up"))
        done = sum(q["story"].values())
        rows.append(dict(section="Your progress"))
        rows.append(dict(label="Story chapters finished: %d of %d" % (done, sum(len(c) for c in STORIES.values())),
                         info="Quests completed: %d" % (p.get("stats") or {}).get("quests", 0)))
        for lv, items in PR.next_unlocks(self.level_of(p), 3):
            rows.append(dict(label="Level %d" % lv, info="Unlocks: " + ", ".join(items), dim=True))
        self.list_menu(p, "quests", "Quest Log", rows, sub="Level %d %s" % (self.level_of(p), W.title_for(self.level_of(p))),
                       foot="! over a villager: they have something for you. ? : you have what they asked for.", keep=True)

    # ------------------------------------------------------------------ the marks over villagers' heads, just for you
    def _priv_quests(self, p, d):
        now = W.time.time()
        marks = {}
        folk = getattr(self, "folk", {})
        today = self.favors_today(now) if folk else {}
        for name in folk:
            if self.turn_in_for(p, name):
                marks[name] = "?"
            elif not self.put_off(p, name, now) and (self.story_offer(p, name) or (name in today and self.favor_offer(p, name, now))):
                marks[name] = "!"
        d["quest_marks"] = marks
