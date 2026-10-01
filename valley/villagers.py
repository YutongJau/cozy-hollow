"""The people of the valley: they keep homes and shops, walk to work along the paths, lunch in the square,
gather at the saloon after dark and go home to bed. Talk to them every day and bring gifts to make friends."""
import collections
import random
import zlib

import areas as AR
import world as W

HIDDEN = "_home"
STEP = 0.55                     # seconds per tile when strolling
TOWN_SPOTS = [("town", 33, 19), ("town", 39, 19), ("town", 33, 24), ("town", 39, 24), ("town", 36, 17), ("town", 36, 22),
              ("town", 30, 21), ("town", 42, 22), ("town", 36, 34), ("town", 33, 36), ("town", 39, 36), ("town", 20, 39),
              ("town", 52, 39), ("town", 12, 22), ("town", 60, 22)]
SALOON_SEATS = [("saloon", 4, 2), ("saloon", 9, 2), ("saloon", 13, 2), ("saloon", 4, 5), ("saloon", 9, 5), ("saloon", 13, 5), ("saloon", 6, 6)]

# name: home ("cottage" door in town, or None to live above the shop), haunts, evening (saloon or a spot), loves, likes, hates
FOLK = {
    "Mayor Hazel": dict(work="hall", haunts=TOWN_SPOTS[:6], evening="plaza", loves=["pumpkin_pie", "honey"], likes=["cheese", "#fruit"], hates=["old_boot"]),
    "Bram": dict(work="store", haunts=TOWN_SPOTS[:8], evening="saloon", loves=["jam", "coconut_curry"], likes=["#veg"], hates=["seaweed"]),
    "Rusty": dict(work="saloon", haunts=TOWN_SPOTS[:4], evening=None, loves=["boar_roast", "hunters_stew"], likes=["#meat", "corn"], hates=["fiber"]),
    "Professor Fern": dict(work="museum", haunts=TOWN_SPOTS[4:10], evening="plaza", loves=["diamond", "prismatic_shard", "ammonite"], likes=["#gem", "#fossil"], hates=["#junk"]),
    "Doc Alder": dict(work="clinic", home=(52, 38), haunts=TOWN_SPOTS[8:12], evening="saloon", loves=["fruit_salad", "ginger"], likes=["#fruit", "honey"], hates=["cactus_candy"]),
    "Ingrid": dict(work="smith", haunts=TOWN_SPOTS[10:15], evening="saloon", loves=["gold_ore", "diamond"], likes=["iron_ore", "coal"], hates=["daffodil"]),
    "Juniper": dict(work="bakery", home=(19, 38), haunts=TOWN_SPOTS[:6], evening="plaza", loves=["strawberry", "honey_cake"], likes=["egg", "milk", "flour"], hates=["coal"]),
    "Pip": dict(work="post", haunts=TOWN_SPOTS, evening="saloon", loves=["pancakes", "star_fragment"], likes=["#food"], hates=["stone"]),
    "Oakley": dict(work="carpenter", haunts=TOWN_SPOTS[6:12], evening="saloon", loves=["hunters_stew", "pine_cone"], likes=["wood", "leather"], hates=["seaweed"]),
    "Old Tomas": dict(work="fishshop", home=(9, 38), haunts=[("beach", 22, 18), ("beach", 30, 12), ("town", 20, 39)], evening="saloon",
                      loves=["sturgeon", "chowder"], likes=["#fish"], hates=["mayonnaise"]),
    "Wren": dict(work="lighthouse", haunts=[("beach", 12, 13), ("beach", 18, 10), ("beach", 40, 10)], evening=None, loves=["star_fragment", "coral"], likes=["seashell", "#gem"], hates=["boar_meat"]),
    "Ranger Moss": dict(work="cabin", haunts=[("forest", 34, 20), ("forest", 26, 26), ("forest", 50, 24), ("forest", 60, 10)], evening=None,
                        loves=["morel", "trail_mix"], likes=["#forage"], hates=["mayonnaise"]),
    "Captain Ash": dict(work="guild", haunts=[("mountain", 24, 16), ("mountain", 30, 12), ("mountain", 36, 22)], evening=None,
                        loves=["slime_jelly", "boar_roast"], likes=["#meat", "#gem"], hates=["dandelion"]),
    "Coco": dict(work="tiki", haunts=[("island", 22, 20), ("island", 29, 18), ("island", 34, 22)], evening=None, loves=["coconut_curry", "blue_tang"], likes=["#fruit"], hates=["snow_yam"]),
    "Prospector Gus": dict(work="assay", haunts=[("frontier", 39, 22), ("frontier", 30, 18), ("frontier", 20, 18)], evening="wsaloon",
                           loves=["gold_nugget", "cactus_candy"], likes=["gold_ore", "#meat"], hates=["flower"]),
    "Dolly": dict(work="wsaloon", haunts=[("frontier", 20, 18), ("frontier", 26, 18)], evening=None, loves=["cactus_fruit", "ruby"], likes=["#gem", "honey"], hates=["stone"]),
    "Mr. Penny": dict(work="bank", haunts=[("frontier", 30, 18), ("frontier", 34, 18)], evening="wsaloon", loves=["gold_nugget", "diamond"], likes=["#gem"], hates=["#junk"]),
    "Sheriff Boone": dict(work="sheriff", haunts=[("frontier", 14, 18), ("frontier", 44, 18), ("frontier", 52, 18), ("frontier", 30, 21)], evening="wsaloon",
                          loves=["hunters_stew", "venison"], likes=["#meat"], hates=["flower"]),
    "Hank": dict(work="butcher", haunts=[("frontier", 46, 18), ("frontier", 54, 18)], evening="wsaloon", loves=["boar_roast", "rabbit_pie"], likes=["#meat"], hates=["#veg"]),
    # folks who just live here
    "Mabel": dict(home=None, haunts=TOWN_SPOTS[8:15] + [("town", 30, 35)], evening="plaza", loves=["daffodil", "sunflower"], likes=["#forage", "#veg"], hates=["coal"]),
    "Granny Rose": dict(home=None, haunts=[("town", 33, 18), ("town", 39, 18), ("town", 33, 35), ("town", 39, 35)], evening="saloon",
                        loves=["berry_tart", "honey"], likes=["#food", "#fruit"], hates=["#junk"]),
    "Theo": dict(home=None, haunts=[("town", 20, 39), ("town", 50, 39), ("beach", 23, 22), ("beach", 30, 12)], evening="plaza",
                 loves=["golden_koi", "cicada"], likes=["#bug", "#fish"], hates=["pickles"]),
}
NEW_FOLK_LOOKS = {"Hank": ("boy", "red", "none"), "Mabel": ("girl", "green", "none"), "Granny Rose": ("girl", "white", "none"),
                  "Theo": ("boy", "cyan", "cowboy"), "Nell": ("girl", "orange", "none"), "Barnaby": ("boy", "blue", "none"),
                  "Ivy": ("girl", "cyan", "none"), "Rowan": ("boy", "magenta", "cowboy"), "Velvet": ("girl", "magenta", "none")}
AR.NPCS.update(NEW_FOLK_LOOKS)
FOLK_LINES = {
    "Hank": ["Bring me your game and I'll dress it. Clean cuts, fair trade.", "Venison stew tonight. Nothing like it."],
    "Mabel": ["My roses are coming along. Do you garden too?", "The square looks lovely when the lamps come on."],
    "Granny Rose": ["Sit with me a while, dear. My knees aren't what they were.", "In my day we walked to the beach and back before breakfast!"],
    "Theo": ["I'm gonna catch a golden koi someday!", "Did you know cicadas sing louder when it's hot?"],
    "Nell": ["Every lamp in town, lit by hand. It's a calling.", "Thank you for the new lampposts!"],
    "Barnaby": ["The guest cottage is so cosy. I might stay forever.", "Is it always this friendly round here?"],
    "Ivy": ["I came for the festivals and stayed for the pie.", "Have you seen the shooting stars from the beach?"],
}
AR.KEEPER_LINES.update(FOLK_LINES)
MORE_FOLK = {   # people who move in as the town grows (see townhall)
    "Nell": dict(home=None, haunts=TOWN_SPOTS, evening="plaza", loves=["coal", "honey"], likes=["#food"], hates=["seaweed"]),
    "Barnaby": dict(home=None, haunts=TOWN_SPOTS[6:], evening="saloon", loves=["chowder"], likes=["#fish"], hates=["coal"]),
    "Ivy": dict(home=None, haunts=TOWN_SPOTS[:10], evening="plaza", loves=["star_fragment", "fruit_salad"], likes=["#fruit"], hates=["stone"]),
}
GIFT_POINTS = dict(love=120, like=60, neutral=25, hate=-30)
TALK_POINTS = 20
HEART = 100


def sh(text):
    """A stable hash (Python's own changes every run), so routines survive restarts."""
    return zlib.crc32(text.encode())


def outer(loc):
    """The outdoor map whose door leads into an interior (or the map itself)."""
    for (area, x, y), dest in W.PORTALS.items():
        if dest[0] == loc and area in AR.MAPS:
            return area
    return loc


def gift_matches(key, want):
    it = W.ITEMS.get(key, {})
    if want == "#gem":
        return key in W.GEMS or key == "quartz"
    if want == "#fossil":
        return it.get("kind") == "fossil"
    if want == "#junk":
        return key in ("old_boot", "seaweed")
    if want == "#forage":
        return it.get("kind") == "forage"
    if want == "#food":
        return it.get("kind") == "food"
    if want == "#bug":
        return it.get("kind") == "bug"
    if want == "flower":
        return key in ("daffodil", "dandelion", "sunflower")
    from valley.crafting import matches
    return matches(key, want)


class Villagers:
    def _init_folk(self, now):
        self.folk = getattr(self, "folk", None) or {}
        for name in list(FOLK) + [n for n in MORE_FOLK if n in getattr(self, "residents", [])]:
            self.ensure_npc(name)

    def ensure_npc(self, name):
        if name not in self.folk:
            self.folk[name] = dict(loc=HIDDEN, x=0, y=0, f=[0, 1], path=[], goal=None, next=0.0, bubble=None)

    def folk_def(self, name):
        return FOLK.get(name) or MORE_FOLK.get(name)

    def _load_folk(self, d):
        for p in self.players.values():
            p.setdefault("friends", {})
            p.setdefault("met", {})

    def _join_folk(self, p, now):
        p.setdefault("friends", {})
        p.setdefault("met", {})

    # ------------------------------------------------------------------ where everyone wants to be
    def work_spot(self, name):
        d = self.folk_def(name)
        loc = d.get("work")
        if not loc:
            return None
        rows = W.INTERIORS[loc]
        for y, row in enumerate(rows):
            if "n" in row:
                return (loc, row.index("n"), y)
        return None

    def home_spot(self, name):
        d = self.folk_def(name)
        if d.get("home"):
            return ("town",) + tuple(d["home"])
        if d.get("work"):
            return self.work_spot(name)
        return ("saloon", 7, 6)

    def wanted(self, name, now):
        """Where this villager should be right now, by the sky clock (festivals call everyone to the square)."""
        d = self.folk_def(name)
        h = self.sky_hour(now)
        rng = random.Random(sh(name) ^ int(now // W.SKY_DAY))
        fest = self.festival_spot(name, now) if hasattr(self, "festival_spot") else None
        if fest and 8 <= h < 22:
            return fest
        if h < 6 or h >= 22:
            return (HIDDEN, 0, 0)
        haunts = d.get("haunts") or TOWN_SPOTS
        if 6 <= h < 8 or (12 <= h < 13.5):
            return haunts[int(h * 2 + rng.random() * 3) % len(haunts)]
        if 8 <= h < 18:
            if d.get("work"):
                return self.work_spot(name)
            return haunts[int(h / 1.5 + rng.random() * 5) % len(haunts)]
        ev = d.get("evening")
        if ev == "saloon":
            return SALOON_SEATS[sh(name) % len(SALOON_SEATS)]
        if ev == "wsaloon":
            return ("wsaloon", 3 + sh(name) % 11, 5)
        if ev == "plaza":
            return TOWN_SPOTS[sh(name) % 6]
        return self.work_spot(name) or haunts[0]

    # ------------------------------------------------------------------ walking
    def npc_walkable(self, loc, x, y, goal):
        if (loc, x, y) == goal:
            return True
        if loc in W.INTERIORS:
            return self.terrain(x, y, loc) in W.INTERIOR_WALK
        return self.terrain(x, y, loc) in AR.AREA_WALK

    def npc_route(self, src, goal):
        """Breadth-first search across maps (through doors and map edges) from src to goal."""
        if src == goal:
            return []
        allowed = {src[0], goal[0], outer(src[0]), outer(goal[0]), "town"}
        prev = {src: None}
        q = collections.deque([src])
        while q:
            cur = q.popleft()
            if cur == goal:
                break
            loc, x, y = cur
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                dest = self.portal(loc, nx, ny)
                if dest and dest[0] in allowed:
                    nxt = (dest[0], dest[1], dest[2])
                elif self.npc_walkable(loc, nx, ny, goal):
                    nxt = (loc, nx, ny)
                else:
                    continue
                if nxt not in prev:
                    prev[nxt] = cur
                    q.append(nxt)
        if goal not in prev:
            return None
        path, cur = [], goal
        while cur != src:
            path.append(cur)
            cur = prev[cur]
        return path[::-1]

    def farmer_on(self, loc, x, y):
        return any(q.get("online") and q.get("loc", "farm") == loc and q["x"] == x and q["y"] == y for q in self.players.values())

    def _block_folk(self, loc, x, y):
        """Villagers are solid: you walk around them (and face them to talk)."""
        return any(n["loc"] == loc and n["x"] == x and n["y"] == y for n in self.folk.values())

    def _fast_folk(self, now):
        moved = False
        for name, n in self.folk.items():
            if now < n.get("next", 0):
                continue
            goal = self.wanted(name, now)
            if goal != n.get("goal"):
                n["goal"] = goal
                if goal[0] == HIDDEN:
                    n["path"] = []
                else:
                    start = (n["loc"], n["x"], n["y"])
                    if n["loc"] == HIDDEN:
                        start = self.home_spot(name)
                        n["loc"], n["x"], n["y"] = start
                        moved = True
                    route = self.npc_route(start, goal)
                    if route is None:            # unreachable: just appear there
                        n["loc"], n["x"], n["y"] = goal
                        route = []
                    n["path"] = route
                n["next"] = now + random.uniform(0.2, 1.5)
                continue
            if n["path"]:
                loc, x, y = n["path"][0]
                if self.farmer_on(loc, x, y) and n.get("wait", 0) < 4:     # someone's in the way: wait a moment, then squeeze past
                    n["wait"] = n.get("wait", 0) + 1
                    n["next"] = now + STEP * 2
                    continue
                n["wait"] = 0
                n["path"].pop(0)
                if loc == n["loc"]:
                    n["f"] = [max(-1, min(1, x - n["x"])), max(-1, min(1, y - n["y"]))]
                n["loc"], n["x"], n["y"] = loc, x, y
                n["next"] = now + STEP
                moved = True
            elif goal[0] == HIDDEN and n["loc"] != HIDDEN:
                home = self.home_spot(name)
                if (n["loc"], n["x"], n["y"]) == home or n["loc"] in W.INTERIORS:
                    n["loc"] = HIDDEN
                    moved = True
                else:
                    route = self.npc_route((n["loc"], n["x"], n["y"]), home)
                    n["path"] = route or []
                    if route is None:
                        n["loc"] = HIDDEN
                n["next"] = now + STEP
            else:
                n["next"] = now + random.uniform(1.0, 3.0)
                here = (n["loc"], n["x"], n["y"])
                if n["loc"] != HIDDEN and (self.farmer_on(*here) or any(o is not n and (o["loc"], o["x"], o["y"]) == here for o in self.folk.values())):
                    taken = {(o["loc"], o["x"], o["y"]) for o in self.folk.values()} | {
                        (q.get("loc", "farm"), q["x"], q["y"]) for q in self.players.values() if q.get("online")}
                    for dx, dy in random.sample([(1, 0), (-1, 0), (0, 1), (0, -1)], 4):     # two folk on one spot: one steps aside
                        nx, ny = n["x"] + dx, n["y"] + dy
                        if (n["loc"], nx, ny) not in taken and self.npc_walkable(n["loc"], nx, ny, None) and not self.portal(n["loc"], nx, ny):
                            n["x"], n["y"], n["f"] = nx, ny, [-dx, -dy] if n["loc"] not in W.INTERIORS else [0, 1]
                            moved = True
                            break
                elif n["loc"] in W.INTERIORS:
                    n["f"] = [0, 1]
            if n.get("bubble") and n["bubble"][1] < now:
                n["bubble"] = None
                moved = True
        if moved:
            self.dirty = True
            self.moved = True

    def _snap_folk(self, snap, now):
        snap["npcs"] = [dict(n=name, loc=n["loc"], x=n["x"], y=n["y"], f=n["f"], b=n["bubble"][0] if n.get("bubble") else None)
                        for name, n in self.folk.items() if n["loc"] != HIDDEN]

    def npc_at(self, loc, x, y):
        for name, n in self.folk.items():
            if n["loc"] == loc and n["x"] == x and n["y"] == y:
                return name, n
        return None, None

    def npc_present(self, name, loc):
        n = self.folk.get(name)
        return bool(n and n["loc"] == loc)

    # ------------------------------------------------------------------ talking and gifts
    def day_key(self, now):
        return int(now // W.SKY_DAY)

    def hearts(self, p, name):
        return min(10, p.get("friends", {}).get(name, 0) // HEART)

    def _use_folk(self, p, loc, fx, fy, now):
        name, n = self.npc_at(loc, fx, fy)
        if not name:
            return False
        if loc in AR.KEEPERS and AR.KEEPERS[loc] == name:
            return False                     # the shopkeeper behind the counter: the shop handles it
        sel = self.selected_item(p)
        if sel and W.ITEMS[sel]["kind"] not in ("gear", "key", "weapon", "machine", "ammo", "treat") and sel not in W.TOOLS:
            if p.get("met", {}).get(name) != self.day_key(now):      # say hello first; the next E hands it over
                self.talk(p, name, n, now)
                return self.say(p, "(E again to give %s your %s.)" % (name, W.ITEMS[sel]["name"])) or True
            return self.give_gift(p, name, n, sel, now) or True
        return self.talk(p, name, n, now) or True

    def talk(self, p, name, n, now):
        day = self.day_key(now)
        met = p.setdefault("met", {})
        first = name not in met
        if met.get(name) != day:
            met[name] = day
            self.befriend(p, name, TALK_POINTS)
        lines = list(AR.KEEPER_LINES.get(name, ["Lovely day, isn't it?"]))
        hearts = self.hearts(p, name)
        if hearts >= 3:
            lines.append("It's always nice to see you, %s." % p["name"])
        if hearts >= 6:
            lines.append("You know, you're one of my favourite people in the valley.")
        season = self.season_at(now)
        lines.append({"spring": "The blossoms are out. Smells like spring!", "summer": "Hot one today. Stay out of the sun at noon.",
                      "fall": "Pumpkins everywhere. I love this time of year.", "winter": "Brr! Keep warm, dear farmer."}[season])
        line = ("Oh! You must be the new farmer. I'm %s. " % name if first else "") + random.choice(lines)
        n["bubble"] = ["...", now + 2.5]
        n["f"] = [-p["facing"][0], -p["facing"][1]]
        self.dirty = True
        self.say(p, "%s: %s  %s" % (name, line, "♥" * hearts))

    def befriend(self, p, name, pts):
        fr = p.setdefault("friends", {})
        before = fr.get(name, 0) // HEART
        fr[name] = max(0, min(10 * HEART, fr.get(name, 0) + pts))
        after = fr[name] // HEART
        if after > before:
            self.say(p, "You and %s are closer now (%d hearts)." % (name, after), "good")
            self.bump(p, "hearts")
        self.dirty = True

    def give_gift(self, p, name, n, key, now):
        day = self.day_key(now)
        gifted = p.setdefault("gifted", {})
        if gifted.get(name) == day:
            return self.say(p, "%s: You already gave me something today. Thank you though!" % name)
        d = self.folk_def(name) or {}
        mood = "neutral"
        if any(gift_matches(key, w) for w in d.get("hates", [])):
            mood = "hate"
        if any(gift_matches(key, w) for w in d.get("likes", [])):
            mood = "like"
        if any(gift_matches(key, w) for w in d.get("loves", [])):
            mood = "love"
        self.take(p, key, 1)
        gifted[name] = day
        self.befriend(p, name, GIFT_POINTS[mood])
        item = W.ITEMS[key]["name"]
        n["bubble"] = [{"love": "<3 <3", "like": "<3", "neutral": ":)", "hate": ":("}[mood], now + 3]
        self.fx(p, "drop", key, (n["x"], n["y"]))
        self.bump(p, "gifts")
        self.check_milestones(now)
        self.say(p, {"love": "%s: A %s?! I love it! You're the best!", "like": "%s: Oh, a %s. How thoughtful, thank you!",
                     "neutral": "%s: A %s. Thank you kindly.", "hate": "%s: Um... a %s. ...Thanks, I suppose."}[mood] % (name, item),
                 "good" if mood in ("love", "like") else "info")

    def friends_menu(self, p):
        rows = []
        for name in sorted(self.folk):
            pts = p.get("friends", {}).get(name, 0)
            h = min(10, pts // HEART)
            d = self.folk_def(name) or {}
            where = d.get("work")
            rows.append(dict(npc=name, label=name, info=("♥" * h + "♡" * (10 - h)) + ("   works at the %s" % where if where else ""),
                             right="%d%%" % int(100 * (pts % HEART) / HEART) if h < 10 else "best friends", ok=False))
        self.list_menu(p, "friends", "Friends", rows, sub="Talk every day and bring gifts they like. Hold an item and press E on someone to give it.")

    def act_friends(self, p, msg, now):
        self.friends_menu(p)
