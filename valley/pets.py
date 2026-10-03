"""Rare pets, the RuneScape way: once in a long while, doing what you love, something small decides to follow you home.
Every activity has a pet of its own and its own tiny odds (a little better the higher your level, and with luck on your
side). The whole farm hears about it when one turns up. Your first pet follows you at once; the rest wait at home, and
the pet window (P, or the Valley Book) lets you choose who comes along. The clinic's dogs and cats join the same family."""
import os
import random
import time

import world as W

# kind: (species, first name, the stat whose every bump rolls for it, 1-in odds, a hint before you've found one,
#        what it does when you pet it, how the stat reads in the farm-wide announcement)
PETS = {
    "otter":     ("Otter Pup", "Puddle", "fish", 1000, "Reeling in fish, anywhere there's water.", "squeaks and rolls onto its back", "fish caught"),
    "golem":     ("Pebble Golem", "Pebble", "mined", 2500, "Breaking rocks and ore in the mines.", "rumbles happily, like a tiny rockslide", "rocks broken"),
    "beaver":    ("Beaver Kit", "Chip", "gathered", 1500, "Chopping wood and cutting fiber out in the wilds.", "thumps its flat tail", "wood and fiber gathered"),
    "sprout":    ("Sproutling", "Sprig", "harvested", 2000, "Harvesting crops.", "wiggles its leaves at you", "crops harvested"),
    "hedgehog":  ("Hedgehog", "Bramble", "foraged", 600, "Foraging wild things.", "snuffles and puffs up its spines", "things foraged"),
    "glowbug":   ("Glowbug", "Glimmer", "bugs", 300, "Catching bugs with a net.", "glows a little brighter", "bugs caught"),
    "mole":      ("Mole", "Digby", "dug", 250, "Digging up wiggling dig spots.", "blinks up at you and sniffs", "dig spots dug"),
    "slimeling": ("Slimeling", "Gloop", "monsters", 1200, "Fighting monsters in the mines and the Depths.", "wobbles and goes blorp", "monsters defeated"),
    "kingling":  ("Lil' Slime King", "Wobble", "kings", 30, "Defeating the Slime King, deep in the Depths.", "straightens its tiny crown, very regal", "Slime Kings defeated"),
    "fox":       ("Fox Kit", "Ember", "hunted", 400, "Hunting wild game in the woods, hills and gulch.", "yips and swishes its bushy tail", "hunts"),
    "chick":     ("Golden Chick", "Sunny", "eggs", 400, "Collecting eggs from the hens.", "cheeps and fluffs up", "eggs collected"),
    "calf":      ("Calf", "Butterbean", "milk", 250, "Milking the cows.", "gives a tiny moo", "milkings"),
    "mouse":     ("Kitchen Mouse", "Crumb", "cooked", 400, "Cooking dishes.", "nibbles a crumb and squeaks", "dishes cooked"),
    "frog":      ("Frog", "Lily", "watered", 3000, "Watering crops.", "ribbits and puffs its throat", "waterings"),
    "parrot":    ("Parrot", "Mango", "voyages", 25, "Sailing out to the mystery islands.", "squawks \"Land ho!\"", "voyages"),
    "starling":  ("Star Sprite", "Twinkle", "wishes", 20, "Wishing on shooting stars.", "twinkles and hums a little tune", "wishes"),
}
ADOPTABLE = {"dog": ("Dog", "wags happily"), "cat": ("Cat", "purrs and headbutts your hand")}
BY_STAT = {spec[2]: kind for kind, spec in PETS.items()}
ORDER = list(PETS)
LEVEL_FULL = 100            # the odds improve steadily up to twice as good at this level
LUCK_BONUS = 1.25
try:
    TEST_LUCK = max(1.0, float(os.environ.get("COZY_PET_LUCK") or 1))   # testing only: COZY_PET_LUCK=100 makes every pet 100x likelier
except ValueError:
    TEST_LUCK = 1.0


def species(kind):
    if kind in PETS:
        return PETS[kind][0]
    if kind in ADOPTABLE:
        return ADOPTABLE[kind][0]
    return str(kind).replace("_", " ").title()


def noise(kind):
    if kind in PETS:
        return PETS[kind][5]
    return ADOPTABLE.get(kind, ("", "looks pleased"))[1]


def fmt_odds(n):
    return "1 in {:,}".format(max(1, int(round(n))))


class Pets:
    def _init_pets(self, now):
        self.pet_firsts = getattr(self, "pet_firsts", {})     # kind -> [who found the first one, when]

    def _save_pets(self, out):
        out["pet_firsts"] = self.pet_firsts

    def _load_pets(self, d):
        self.pet_firsts = d.get("pet_firsts", {})
        for p in self.players.values():
            self.pets_upgrade(p)

    def _join_pets(self, p, now):
        self.pets_upgrade(p)

    def pets_upgrade(self, p):
        """Older saves had one pet and no collection: the pet you have joins your collection as it is."""
        owned = p.setdefault("pets", {})
        pet = p.get("pet")
        if pet and pet.get("kind") and pet["kind"] not in owned:
            owned[pet["kind"]] = dict(name=pet.get("name", species(pet["kind"])), love=pet.get("love", 0), got=0, how="adopted" if pet["kind"] in ADOPTABLE else "found")

    # ------------------------------------------------------------------ the odds
    def pet_odds(self, p, kind, now=None):
        """Your own 1-in-N for this pet right now: the base odds, up to twice as good by level 100, a bit better with luck."""
        base = PETS[kind][3]
        lv = min(LEVEL_FULL, self.level_of(p) if hasattr(self, "level_of") else W.level_for(p.get("xp", 0)))
        odds = base / (1.0 + lv / float(LEVEL_FULL))
        if now is not None and self.has_buff(p, "luck", now):
            odds /= LUCK_BONUS
        return max(1.0 if TEST_LUCK > 1 else 2.0, odds / TEST_LUCK)

    def pet_roll(self, p, stat, now=None):
        """Called by bump(): every time you do the thing, there's a tiny chance."""
        kind = BY_STAT.get(stat)
        if not kind or not p.get("online", True):
            return
        now = time.time() if now is None else now
        if random.random() * self.pet_odds(p, kind, now) < 1.0:
            self.pet_found(p, kind, now)

    # ------------------------------------------------------------------ one turns up
    def pet_found(self, p, kind, now):
        spec = PETS[kind]
        owned = p.setdefault("pets", {})
        kc = p.get("stats", {}).get(spec[2], 0)
        odds = self.pet_odds(p, kind, now)
        if kind in owned:
            name = self.pet_entry(p, kind)["name"]
            return self.say(p, "You feel like you're being watched... but it's only %s's cousin. (You already have a %s; %s.)"
                            % (name, spec[0], fmt_odds(odds)), "good")
        owned[kind] = dict(name=spec[1], love=0, got=now, kc=kc, how="found")
        first = kind not in self.pet_firsts
        if first:
            self.pet_firsts[kind] = [p["name"], now]
        follows = not p.get("pet")
        if follows:
            self.pet_follow_me(p, kind)
        self.dirty = True
        self.event("%s feels something small tagging along... it's %s the %s! (after %s %s, %s)%s"
                   % (p["name"], spec[1], spec[0], "{:,}".format(kc), spec[6], fmt_odds(odds), " The first in the valley!" if first else ""), now, "good")
        self.say(p, ("%s will follow you everywhere. Press P to see all your pets." % spec[1]) if follows else
                 ("%s is waiting for you at home. Press P to bring it along." % spec[1]), "good")
        if hasattr(self, "scrap"):
            self.scrap("%s found %s the %s%s." % (p["name"], spec[1], spec[0], ", the first in the valley" if first else ""), now, "pet")
        pet = p.get("pet") if follows else None
        self.out.append(("all", dict(t="petdrop", who=p["name"], kind=kind, sp=spec[0], name=spec[1], loc=p.get("loc", "farm"),
                                     x=pet["x"] if pet else p["x"], y=pet["y"] if pet else p["y"], follows=follows)))

    # ------------------------------------------------------------------ who follows you
    def pet_entry(self, p, kind):
        """A pet's name and love: the one at your heels holds the live copy."""
        pet = p.get("pet")
        if pet and pet.get("kind") == kind:
            return pet
        return p.get("pets", {}).get(kind) or dict(name=species(kind), love=0)

    def pet_stow(self, p):
        """Your pet goes home: its name and love go back in the collection."""
        pet = p.get("pet")
        if not pet:
            return None
        entry = p.setdefault("pets", {}).setdefault(pet["kind"], dict(got=0, how="adopted" if pet["kind"] in ADOPTABLE else "found"))
        entry["name"], entry["love"] = pet.get("name", species(pet["kind"])), pet.get("love", 0)
        p["pet"] = None
        p["trail"] = []
        return pet

    def pet_follow_me(self, p, kind):
        entry = p["pets"][kind]
        self.pet_stow(p)
        p["pet"] = dict(kind=kind, name=entry.get("name", species(kind)), love=entry.get("love", 0), loc=p.get("loc", "farm"), x=p["x"], y=p["y"], f=[0, 1])
        self.place_pet(p)
        self.moved = True

    def act_pet_call(self, p, msg, now):
        kind = msg.get("kind")
        if kind not in p.get("pets", {}):
            return
        pet = p.get("pet")
        if pet and pet.get("kind") == kind:
            return self.pets_menu(p, now)
        self.pet_follow_me(p, kind)
        self.dirty = True
        self.say(p, "%s comes running!" % p["pet"]["name"], "good")
        self.pets_menu(p, now)

    def act_pet_home(self, p, msg, now):
        pet = self.pet_stow(p)
        if pet:
            self.dirty = True
            self.moved = True
            self.say(p, "%s trots off home for a nap." % pet["name"])
        self.pets_menu(p, now)

    # ------------------------------------------------------------------ the pet window
    def act_pets(self, p, msg, now):
        self.pets_menu(p, now)

    def pets_menu(self, p, now):
        owned = p.get("pets", {})
        pet = p.get("pet")
        rows = []
        if pet:
            rows.append(dict(section="Following you"))
            rows.append(dict(pet=pet["kind"], petname=pet["name"], label="%s the %s" % (pet["name"], species(pet["kind"])),
                             info=self.pet_story(p, pet["kind"]), right="Send home", act=dict(t="pet_home"), ok=True))
        home = [k for k in ORDER + list(ADOPTABLE) if k in owned and not (pet and pet["kind"] == k)]
        if home:
            rows.append(dict(section="Waiting at home"))
            for k in home:
                e = owned[k]
                rows.append(dict(pet=k, petname=e.get("name"), label="%s the %s" % (e.get("name", species(k)), species(k)), info=self.pet_story(p, k),
                                 right="Call", act=dict(t="pet_call", kind=k), ok=True))
        missing = [k for k in ORDER if k not in owned]
        if missing:
            rows.append(dict(section="Still out there"))
            for k in missing:
                spec = PETS[k]
                who = self.pet_firsts.get(k)
                seen = (" %s found the first one." % ("You" if who[0] == p["name"] else who[0])) if who else " Nobody has found one yet."
                rows.append(dict(pet=k, shadow=True, label="???", info="%s Your odds: %s.%s" % (spec[4], fmt_odds(self.pet_odds(p, k, now)), seen),
                                 right="", ok=False, dim=True))
        for k in ADOPTABLE:
            if k not in owned:
                rows.append(dict(pet=k, label="A %s from the clinic" % ADOPTABLE[k][0].lower(), info="Doc Alder always has strays who'd love a home.", right="", ok=False, dim=True))
        found = sum(1 for k in ORDER if k in owned)
        self.list_menu(p, "pets", "Your Pets", rows, keep=True,
                       sub="%d of %d rare pets found. They turn up all by themselves, once in a long while, as you go about your day." % (found, len(ORDER)),
                       foot="Call a pet to have it follow you, or send it home. Rename the one at your heels with /petname.")

    def pet_story(self, p, kind):
        e = self.pet_entry(p, kind)
        hearts = min(10, e.get("love", 0) // 10)
        love = (" " + "♥" * hearts) if hearts else ""
        own = p.get("pets", {}).get(kind, {})
        if kind in PETS and own.get("kc"):
            text = "Found after %s %s, %s." % ("{:,}".format(own["kc"]), PETS[kind][6], self.pet_date(own.get("got")))
        elif kind in PETS:
            text = "Found while %s" % (PETS[kind][4][0].lower() + PETS[kind][4][1:])
        else:
            text = "Adopted from Doc Alder's clinic."
        return text + love

    def pet_date(self, t):
        if t and hasattr(self, "season_at"):
            return "%s, year %d" % (self.season_at(t).capitalize(), self.year_at(t))
        return "long ago"

    def _book_pets(self, p, now):
        found = sum(1 for k in ORDER if k in p.get("pets", {}))
        return [dict(label="Your Pets", info="%d of %d rare pets found (P)" % (found, len(ORDER)), act=dict(t="pets"), ok=True, right="Open")]
