#!/usr/bin/env python3
"""Cozy Hollow - the shared world model.

Everything about the farm lives here: items, crops, trees, the map, weather,
seasons, growth simulation and the rules for what a player can do.  Both the
server and the client import this file so they always agree on the world.
"""
import hashlib
import math
import json
import os
import random
import time

import areas as AR

MINUTE = 60
HOUR = 60 * MINUTE
DAY = 24 * HOUR

SEASONS = ["spring", "summer", "fall", "winter"]
SEASON_SECONDS = 7 * DAY          # one in-game season is one real week
WATER_DURATION = 4 * HOUR         # a watering keeps the soil wet this long
WATER_MULT = 3.0                  # wet soil grows this much faster
FERT_MULT = 1.5                   # fertilised soil grows this much faster
CAN_CAPACITY = 20                 # waterings per refill
FORAGE_INTERVAL = 6 * MINUTE      # a wild plant appears this often
FORAGE_MAX = 12
BUBBLE_SECONDS = 4
QUEST_REFRESH = 12 * HOUR
LOG_LIMIT = 80
MAP_W, MAP_H = 90, 30
PASTURE = dict(x0=71, y0=4, x1=85, y1=24)      # inside the fence, cows live here
COW_PRICE = 500
MAX_COWS = 6
MILK_EVERY = 4 * HOUR
COW_NAMES = ["Daisy", "Clover", "Buttercup", "Maple", "Pepper", "Mabel", "Rosie", "Hazel", "Biscuit", "Nutmeg"]
PRIEST = (67, 6)                 # Father TongTong waits by the pasture gate
FIELDS = [(17, 3, 22, 6), (6, 10, 44, 16), (52, 8, 65, 13)]   # farmland: the only tillable ground
ALTAR = [(66, 8), (67, 8)]       # where the couple stands
PROPOSAL_TIMEOUT = 40
SKY_DAY = 30 * MINUTE            # the sky runs a full day every 30 real minutes

# Interiors you can walk into. Chars: # wall, W window wall, . wood floor, r rug, x door mat (walk onto it to leave),
# b bed, t table, c chest (shared storage), f fireplace, k bookshelf, p plant, S shop counter, q shopkeeper, h hay, o trough
INTERIORS = {
    "house": [
        "#####W#####W####",
        "#kk.........fF.#",
        "#bb....tt....p.#",
        "#......tt......#",
        "#....rrrrrr....#",
        "#....rrrrrr....#",
        "#c.............#",
        "#..............#",
        "#######x########",
    ],
    "shop": [
        "####W####W####",
        "#kkkk...pkkkk#",
        "#............#",
        "#..SSSqSSS...#",
        "#............#",
        "#..rrrrrr....#",
        "#............#",
        "######x#######",
    ],
    "barn": [
        "############",
        "#hh......hh#",
        "#h........h#",
        "#....oo....#",
        "#..........#",
        "#c........c#",
        "#..........#",
        "######x#####",
    ],
}
INTERIORS.update(AR.INTERIORS)
INTERIOR_WALK = set(".rx")
DOORS = {"house": (8, 6), "shop": (53, 5), "barn": (78, 8)}     # the farm tile you walk into to enter
INTERIOR_NAMES = {"#": "wall", "W": "window", ".": "wooden floor", "r": "rug", "x": "doorway", "b": "bed", "t": "table",
                  "c": "chest", "f": "fireplace", "F": "fireplace", "k": "bookshelf", "p": "potted plant", "S": "shop counter",
                  "q": "Marigold the shopkeeper", "h": "hay", "o": "feeding trough"}
INTERIOR_NAMES.update(AR.INTERIOR_NAMES)
for _name, _rows in INTERIORS.items():
    assert len(set(len(r) for r in _rows)) == 1, "interior rows must be equal width: " + _name
WEDDING_LENGTH = 17
SPAWN = (8, 8)
CHEST_HOME = (13, 7)             # where the movable chest starts, beside the shipping bin
MAX_TREE_FRUIT = 3

PLAYER_COLORS = ["cyan", "magenta", "yellow", "green", "red", "blue", "white", "orange", "pink"]
SPRITES = ["boy", "girl"]
OWN_LOOKS = ["claude"]
SKY_SHIFT = float(os.environ.get("COZY_SKY_SHIFT", "0") or 0)    # testing only: move the sky clock (seconds) on a throwaway server       # farmers with a look of their own, drawn by the browser's art (Claude, the AI farmer)
MAX_LEVEL = 1000
# a title for each stretch of levels (the first seven are the original ones, so nobody's title changes)
LEVEL_TITLES = [(0, "Sprout"), (1, "Seedling"), (2, "Grower"), (3, "Green Thumb"), (4, "Harvest Hand"), (5, "Farm Boss"),
                (6, "Valley Legend"), (10, "Master Farmer"), (15, "Orchard Sage"), (25, "Harvest Hero"), (40, "Grand Grower"),
                (60, "Seasoned Steward"), (85, "Valley Elder"), (120, "Hollow Hero"), (170, "Golden Hands"), (250, "Living Legend"),
                (350, "Myth of the Fields"), (500, "Keeper of Seasons"), (700, "Eternal Harvester"), (900, "Spirit of the Valley"),
                (1000, "Cozy Hollow Immortal")]
TITLES = [t for _, t in LEVEL_TITLES]

NPCS = ["Mayor Hazel", "Old Tomas", "Auntie Marigold", "Pip the courier",
        "Juniper the baker", "Doc Alder", "Wren from the lighthouse"]
REASONS = ["the harvest festival", "Sunday soup night", "a pie contest",
           "the school lunch", "a picnic by the pond", "grandma's recipe",
           "the town potluck", "a very hungry goat"]

# --------------------------------------------------------------------------
# Items
# --------------------------------------------------------------------------
ITEMS = {}
CROPS = {}
TREES = {}
FORAGE = {}
FISH = {}


def _item(key, name, kind, sell, glyph, ascii_, color, **extra):
    d = dict(key=key, name=name, kind=kind, sell=sell, glyph=glyph,
             ascii=ascii_, color=color)
    d.update(extra)
    ITEMS[key] = d
    return d


def _crop(key, name, seed_price, sell, grow, regrow, yield_, seasons,
          glyph, ascii_, color, always=False):
    CROPS[key] = dict(key=key, name=name, seed_price=seed_price, sell=sell,
                      grow=grow, regrow=regrow, yield_=yield_, seasons=seasons,
                      glyph=glyph, ascii=ascii_, color=color, always=always)
    _item(key, name, "crop", sell, glyph, ascii_, color)
    _item(key + "_seed", name + " Seeds", "seed", max(1, seed_price // 2),
          "s", "s", color, crop=key, price=seed_price)


def _tree(key, name, price, fruit_sell, mature, fruit_every, color):
    TREES[key] = dict(key=key, name=name, price=price, fruit_sell=fruit_sell,
                      mature=mature, fruit_every=fruit_every, color=color)
    _item(key, name, "fruit", fruit_sell, "o", "o", color)
    _item(key + "_sapling", name + " Sapling", "sapling", price // 2, "t", "t",
          "green", tree=key, price=price)


def _forage(key, name, sell, glyph, ascii_, color, seasons):
    FORAGE[key] = dict(key=key, name=name, sell=sell, glyph=glyph,
                       ascii=ascii_, color=color, seasons=seasons)
    _item(key, name, "forage", sell, glyph, ascii_, color)


def _fish(key, name, sell, weight, difficulty, junk=False):
    FISH[key] = dict(key=key, name=name, sell=sell, weight=weight,
                     difficulty=difficulty, junk=junk)
    _item(key, name, "fish", sell, "f", "f", "cyan")


#      key           name          seed sell  grow         regrow      yield  seasons               glyph ascii color
_crop("turnip",      "Turnip",      6,   15,  15 * MINUTE, None,       (1, 2), ["spring", "fall"],   "o", "o", "white", always=True)
_crop("potato",      "Potato",      12,  28,  40 * MINUTE, None,       (1, 3), ["spring", "fall"],   "o", "o", "yellow", always=True)
_crop("radish",      "Radish",      10,  24,  25 * MINUTE, None,       (1, 2), ["spring", "summer"], "o", "o", "magenta")
_crop("strawberry",  "Strawberry",  30,  22,  90 * MINUTE, 30 * MINUTE, (1, 2), ["spring"],          "♥", "v", "red")
_crop("cauliflower", "Cauliflower", 40,  90,  4 * HOUR,    None,       (1, 1), ["spring"],           "@", "@", "white")
_crop("sunflower",   "Sunflower",   15,  45,  60 * MINUTE, None,       (1, 1), ["summer", "fall"],   "*", "*", "yellow")
_crop("tomato",      "Tomato",      25,  30,  2 * HOUR,    45 * MINUTE, (1, 2), ["summer"],          "●", "o", "red")
_crop("corn",        "Corn",        35,  40,  3 * HOUR,    60 * MINUTE, (1, 2), ["summer", "fall"],  "¥", "Y", "yellow")
_crop("blueberry",   "Blueberry",   40,  20,  3 * HOUR,    60 * MINUTE, (2, 4), ["summer"],          "%", "%", "blue")
_crop("melon",       "Melon",       45,  120, 5 * HOUR,    None,       (1, 1), ["summer"],           "@", "@", "green")
_crop("starfruit",   "Starfruit",   200, 500, 24 * HOUR,   None,       (1, 1), ["summer"],           "*", "*", "magenta")
_crop("pumpkin",     "Pumpkin",     50,  160, 8 * HOUR,    None,       (1, 1), ["fall"],             "@", "@", "yellow")
_crop("cranberry",   "Cranberry",   45,  25,  4 * HOUR,    80 * MINUTE, (2, 3), ["fall"],            "%", "%", "red")
_crop("snowdrop",    "Snowdrop",    20,  40,  2 * HOUR,    None,       (1, 1), ["winter"],           "*", "*", "white")
_crop("winter_root", "Winter Root", 25,  55,  3 * HOUR,    None,       (1, 2), ["winter"],           "o", "o", "cyan")

_tree("cherry", "Cherry", 120, 28, 8 * HOUR, 2 * HOUR, "red")
_tree("apple", "Apple", 150, 35, 10 * HOUR, 3 * HOUR, "green")
_tree("peach", "Peach", 180, 45, 12 * HOUR, 4 * HOUR, "yellow")
_tree("plum", "Plum", 220, 60, 14 * HOUR, 4 * HOUR, "magenta")

# legendary trees: their seeds are never sold; one harvested crop in a million drops one
RARE_SEED_CHANCE = 1.0 / 1000000
RARE_TREES = ["oak", "willow", "bonsai"]


def _rare_tree(key, name, seed_name, mature, color):
    TREES[key] = dict(key=key, name=name, price=0, fruit_sell=0, mature=mature, fruit_every=0, color=color, rare=True)
    _item(key + "_seed", seed_name, "sapling", 5000, "t", "t", color, tree=key, rare=True)


_rare_tree("oak", "Ancient Oak", "Ancient Oak Seed", 2 * DAY, "green")
_rare_tree("willow", "Weeping Willow", "Weeping Willow Seed", 2 * DAY, "green")
_rare_tree("bonsai", "Bonsai", "Bonsai Seed", 1 * DAY, "green")

_forage("wild_berry", "Wild Berry", 10, "%", "%", "red", ["summer", "fall"])
_forage("mushroom", "Mushroom", 14, "♠", "m", "yellow", ["spring", "fall"])
_forage("daffodil", "Daffodil", 8, "*", "*", "yellow", ["spring"])
_forage("dandelion", "Dandelion", 6, "*", "*", "white", SEASONS)
_forage("leek", "Leek", 12, "|", "|", "green", ["spring"])
_forage("hazelnut", "Hazelnut", 11, "o", "o", "yellow", ["fall"])
_forage("snow_yam", "Snow Yam", 15, "o", "o", "white", ["winter"])
_forage("holly", "Holly", 9, "%", "%", "green", ["winter"])

_fish("sardine", "Sardine", 18, 30, 1)
_fish("carp", "Carp", 22, 28, 1)
_fish("sunfish", "Sunfish", 30, 18, 2)
_fish("rainbow_trout", "Rainbow Trout", 55, 12, 2)
_fish("catfish", "Catfish", 90, 7, 3)
_fish("sturgeon", "Sturgeon", 150, 3, 4)
_fish("golden_koi", "Golden Koi", 500, 1, 5)
_fish("old_boot", "Old Boot", 1, 6, 1, junk=True)
_fish("seaweed", "Seaweed", 5, 6, 1, junk=True)

FARM_FISH = list(FISH)          # the farm pond keeps its own fish; everything below lives out in the valley
_fish("chub", "Chub", 25, 30, 1)
_fish("bream", "Bream", 35, 20, 2)
_fish("pike", "Pike", 110, 6, 3)
_fish("lake_trout", "Lake Trout", 60, 16, 2)
_fish("bullhead", "Bullhead", 50, 18, 2)
_fish("tuna", "Tuna", 120, 8, 3)
_fish("red_snapper", "Red Snapper", 70, 14, 2)
_fish("pufferfish", "Pufferfish", 180, 4, 4)
_fish("octopus", "Octopus", 220, 3, 5)
_fish("blue_tang", "Blue Tang", 140, 8, 3)
_fish("lionfish", "Lionfish", 200, 4, 4)
_fish("pupfish", "Desert Pupfish", 40, 18, 2)
_fish("gold_nugget", "Gold Nugget", 150, 6, 3)
ITEMS["gold_nugget"].update(kind="mineral", glyph="*", ascii="*", color="yellow")

_forage("morel", "Morel", 30, "♠", "m", "yellow", ["spring"])
_forage("fiddlehead", "Fiddlehead Fern", 20, "%", "%", "green", ["summer"])
_forage("salmonberry", "Salmonberry", 12, "%", "%", "red", ["spring", "summer"])
_forage("seashell", "Seashell", 12, "@", "@", "white", SEASONS)
_forage("clam", "Clam", 18, "o", "o", "white", SEASONS)
_forage("coral", "Coral", 30, "*", "*", "red", SEASONS)
_forage("sea_urchin", "Sea Urchin", 40, "*", "*", "magenta", SEASONS)
_forage("coconut", "Coconut", 35, "o", "o", "yellow", SEASONS)
_forage("ginger", "Ginger", 40, "%", "%", "yellow", SEASONS)
_forage("cactus_fruit", "Cactus Fruit", 45, "o", "o", "magenta", SEASONS)
_forage("desert_sage", "Desert Sage", 20, "%", "%", "green", SEASONS)

# what the pickaxe breaks out of rocks on the mountain and down the mine
_item("stone", "Stone", "mineral", 2, "o", "o", "white")
_item("copper_ore", "Copper Ore", "mineral", 8, "o", "o", "orange")
_item("iron_ore", "Iron Ore", "mineral", 15, "o", "o", "white")
_item("gold_ore", "Gold Ore", "mineral", 30, "o", "o", "yellow")
_item("quartz", "Quartz", "mineral", 25, "*", "*", "white")
_item("amethyst", "Amethyst", "mineral", 100, "*", "*", "magenta")
_item("emerald", "Emerald", "mineral", 250, "*", "*", "green")
_item("ruby", "Ruby", "mineral", 250, "*", "*", "red")
_item("diamond", "Diamond", "mineral", 750, "*", "*", "cyan")
_item("prismatic_shard", "Prismatic Shard", "mineral", 2000, "*", "*", "magenta")
GEMS = {"amethyst", "emerald", "ruby", "diamond", "prismatic_shard"}

_item("fertilizer", "Fertilizer", "tool", 5, "=", "=", "green", price=20)
_item("sprinkler", "Sprinkler", "tool", 100, "¤", "&", "cyan", price=400)
_item("wood", "Wood", "material", 6, "=", "=", "yellow")
_item("milk", "Milk", "material", 45, "u", "u", "white")
_item("cow", "Cow", "animal", 0, "C", "C", "white", price=COW_PRICE)
# the farmer's own tools: everyone gets these, they never leave the bag
TOOLS = ["hoe", "watering_can", "scythe", "axe", "pickaxe", "fishing_rod"]
_item("hoe", "Hoe", "gear", 0, "/", "/", "white", verb="till grass")
_item("watering_can", "Watering Can", "gear", 0, "u", "u", "cyan", verb="water soil")
_item("scythe", "Scythe", "gear", 0, ")", ")", "white", verb="harvest and cut crops")
_item("axe", "Axe", "gear", 0, "P", "P", "yellow", verb="chop trees you planted")
_item("pickaxe", "Pickaxe", "gear", 0, "T", "T", "white", verb="break rocks and ore, undo soil, lift sprinklers")
_item("fishing_rod", "Fishing Rod", "gear", 0, "j", "j", "cyan", verb="fish in ponds, rivers, lakes and the sea")
_item("valley_map", "Valley Map", "key", 0, "m", "m", "yellow")      # Father TongTong's gift: N shows the valley and where everyone is

MILESTONES = [
    ("cows", 1, "Moo-ving In"), ("milk", 10, "Dairy Days"), ("weddings", 1, "Happily Ever After"),
    ("rare_seeds", 1, "One in a Million"), ("rare_trees", 1, "Legendary Gardener"),
    ("harvested", 1, "First Harvest"), ("harvested", 25, "Bountiful"),
    ("harvested", 100, "Green Thumbs"), ("harvested", 500, "Legendary Farmers"),
    ("planted", 1, "Seeds of Hope"), ("planted", 50, "Field of Dreams"),
    ("fish", 1, "Gone Fishin'"), ("fish", 10, "Angler"), ("fish", 50, "Master Angler"),
    ("foraged", 1, "Nature's Gift"), ("foraged", 25, "Forager"),
    ("earned", 100, "First Coins"), ("earned", 1000, "Thriving"),
    ("earned", 10000, "Farm Tycoons"),
    ("trees", 1, "Orchard Beginnings"), ("fruit", 20, "Fruit Basket"),
    ("quests", 1, "Helping Hands"), ("quests", 10, "Pillars of the Valley"),
    ("explored", 3, "Wanderer"), ("explored", 9, "Valley Explorer"), ("mined", 1, "Rock Bottom"),
    ("mined", 100, "Prospectors"), ("gems", 1, "Shiny Things"), ("rides", 1, "All Aboard"),
    ("crafted", 1, "Handy"), ("crafted", 25, "Master Crafter"), ("cooked", 1, "First Supper"), ("cooked", 20, "Chef"),
    ("artisan", 10, "Artisan"), ("eggs", 1, "Egg-cellent"), ("donated", 1, "Curator"), ("donated", 30, "Museum Patron"),
    ("bugs", 10, "Bug Catcher"), ("dug", 5, "Archaeologist"), ("gifts", 10, "Good Neighbour"), ("hearts", 5, "Well Loved"),
    ("monsters", 1, "Monster Hunter"), ("monsters", 100, "Slayer"), ("tamed", 1, "Beast Friend"), ("depth_record", 5, "Spelunker"),
    ("hunted", 1, "Hunter"), ("wishes", 1, "Wishful"), ("voyages", 1, "Castaway"), ("songs", 3, "Music Lover"),
    ("projects", 1, "Town Builder"), ("projects", 8, "Founders of Hollow Town"), ("landscaped", 10, "Landscaper"),
]

# --------------------------------------------------------------------------
# Map
# --------------------------------------------------------------------------
# Terrain characters used in the map layer:
#   .  grass (tillable)      #  fence         T  tree        ~  water
#   :  dirt path             ,  sand          W  farmhouse   +  house door
#   S  the shop              $  shipping bin  !  notice board
#   o  rock                  f  flower bed
#   B  barrels   c  crates   h  hay bale   m  mailbox   l  lamp post
#   b  bench     w  well     (props: pretty, and they block the way)
WALKABLE = set(".:,fGdH")
TERRAIN_NAMES = {
    ".": "grass", "#": "fence", "T": "tree", "~": "pond", ":": "path",
    ",": "sand", "W": "farmhouse", "+": "farmhouse door", "S": "shop",
    "$": "shipping bin", "!": "notice board", "o": "rock", "f": "flower bed",
    "B": "barrels", "c": "crates", "h": "hay bale", "m": "mailbox",
    "l": "lamp post", "b": "bench", "w": "well", "N": "barn",
    "s": "tree stump", "p": "wood pile", "g": "signpost", "G": "pasture gate", "Y": "Father TongTong",
    "d": "farmland", "u": "bush", "X": "storage chest",
}
PROP_LINES = {
    "B": "Barrels of last season's cider. They smell wonderful.",
    "c": "Crates of seed packets, stacked neatly.",
    "h": "A fresh hay bale. Soft enough to nap on.",
    "b": "You sit for a moment and watch the clouds drift over the pond.",
    "l": "The lamp post glows softly in the evening.",
    "s": "An old stump, worn smooth. Good for sitting on.",
    "p": "Firewood, neatly stacked for chilly evenings.",
    "g": "The sign reads: Hollow Town west, Summit Ridge north, Whisperwood south. The seed shop is just east.",
}
MAIL = [
    "A letter from Auntie Marigold: 'The turnips you sent were the sweetest yet. Come by for pie!'",
    "A note from Mayor Hazel: 'The town is proud of what you two are growing out there.'",
    "A postcard from Old Tomas: 'Rain's coming. Good day to leave the watering can inside.'",
    "A scribble from Pip the courier: 'Left a seed catalogue by the shop. New saplings this season!'",
    "A tiny card: 'Thinking of you. Grow something wonderful today.'",
]


def build_map():
    W, H = MAP_W, MAP_H
    g = [["."] * W for _ in range(H)]
    rng = random.Random(20260926)
    for x in range(W):
        g[0][x] = "#"
        g[H - 1][x] = "#"
    for y in range(H):
        g[y][0] = "#"
        g[y][W - 1] = "#"
    # trees hugging the fence line
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            d = min(x - 1, W - 2 - x, y - 1, H - 2 - y)
            r = rng.random()
            if d == 0 and r < 0.55:
                g[y][x] = "T"
            elif d == 1 and r < 0.18:
                g[y][x] = "T"

    def rect(x0, y0, w, h, ch):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                g[y][x] = ch

    rect(3, 2, 11, 5, "W")          # farmhouse
    g[6][8] = "+"                   # its door
    for x in (2, 15):               # flower beds beside the house
        g[3][x] = "f"
        g[5][x] = "f"
    g[7][11] = "$"                  # shipping bin by the porch (the movable chest starts beside it, see World.chests)
    rect(8, 7, 1, 2, ":")           # path from the door...
    rect(8, 8, 46, 1, ":")          # ...east across the farm...
    rect(53, 6, 1, 2, ":")          # ...up to the shop door
    rect(48, 2, 11, 4, "S")         # the shop
    g[7][56] = "!"                  # notice board
    cx, cy, rx, ry = 57.0, 21.0, 8.5, 4.0
    for y in range(H):              # the pond and its sandy shore
        for x in range(W):
            if g[y][x] != ".":
                continue
            e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if e <= 1.0:
                g[y][x] = "~"
            elif e <= 1.55:
                g[y][x] = ","
    for (x, y) in [(20, 20), (33, 12), (40, 24), (12, 22), (25, 5), (44, 17)]:
        g[y][x] = "o"
    # cozy props around the buildings and paths
    for (x, y, ch) in [(47, 4, "B"), (47, 5, "B"), (59, 3, "c"), (59, 4, "c"), (16, 4, "h"), (16, 5, "h"),
                       (5, 7, "m"), (20, 9, "l"), (40, 9, "l"), (49, 16, "l"), (45, 19, "b"), (24, 3, "w"),
                       (3, 10, "s"), (66, 12, "s"), (12, 26, "s"), (15, 7, "p"), (54, 9, "g")]:
        if g[y][x] == ".":
            g[y][x] = ch
    # the pasture on the east side: fence, gate, barn at the top
    P = PASTURE
    for x in range(P["x0"] - 1, P["x1"] + 2):
        g[P["y0"] - 1][x] = "#"
        g[P["y1"] + 1][x] = "#"
    for y in range(P["y0"] - 1, P["y1"] + 2):
        g[y][P["x0"] - 1] = "#"
        g[y][P["x1"] + 1] = "#"
    for y in range(P["y0"], P["y1"] + 1):
        for x in range(P["x0"], P["x1"] + 1):
            g[y][x] = "."
    g[15][P["x0"] - 1] = "G"                       # the gate on the farm side
    g[PRIEST[1]][PRIEST[0]] = "Y"                  # the priest, an easter egg
    rect(74, 4, 9, 5, "N")                         # the barn (shared storage + the cows' home)
    for y in range(7, 10):          # keep the spawn area clear
        for x in range(6, 11):
            if g[y][x] == "T":
                g[y][x] = "."
    # bushes on the inner ring and a few by the buildings
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            d = min(x - 1, W - 2 - x, y - 1, H - 2 - y)
            if d == 2 and g[y][x] == "." and rng.random() < 0.22:
                g[y][x] = "u"
    for (x, y) in [(2, 8), (14, 2), (46, 2), (60, 2), (44, 10), (44, 14), (48, 15), (28, 3), (36, 3)]:
        if g[y][x] == ".":
            g[y][x] = "u"
    # paths off the farm: west to town, north to the mountain, south to the forest
    for x in range(0, 8):
        g[8][x] = ":"
    for y in range(0, 8):
        g[y][31] = ":"
    for y in range(9, H):
        g[y][46] = ":"
    # farmland: sandy worked ground where the hoe is allowed
    for (x0, y0, x1, y1) in FIELDS:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if g[y][x] == ".":
                    g[y][x] = "d"
    return ["".join(r) for r in g]


FARM_EXITS = [(x, y) for e in AR.EDGES for (a, x, y) in e if a == "farm"]
AREA_FORAGE_MAX = 6
ORE_INTERVAL = 3 * MINUTE          # a fresh rock or ore vein shows up in each rocky place this often
ORE_MAX = {"mountain": 7, "mine1": 14, "mine2": 16, "mine3": 18}


def chest_blocked(g):
    """Tiles the movable chest may never sit on: the ground in front of every door and either side of the
    pasture gate (farmers must step there to pass), the paths off the farm, the wedding altar and the spawn point."""
    out = set(ALTAR) | {SPAWN} | set(FARM_EXITS)
    for gx, gy in list(DOORS.values()) + FARM_EXITS + [(x, y) for y, row in enumerate(g) for x, ch in enumerate(row) if ch == "G"]:
        for x, y in ((gx, gy + 1), (gx, gy - 1), (gx + 1, gy), (gx - 1, gy)):
            if 0 <= x < MAP_W and 0 <= y < MAP_H and g[y][x] in WALKABLE:
                out.add((x, y))
    return out


NO_CHEST = chest_blocked(build_map())
OUTDOOR = {"farm"} | set(AR.AREAS)


def build_portals():
    """(loc, x, y) -> (loc2, x2, y2, facing): stepping onto the tile carries you there."""
    out = AR.all_portals(DOORS)
    for name, (dx, dy) in DOORS.items():
        rows = INTERIORS[name]
        ex = next(((row.index("x"), y - 1) for y, row in enumerate(rows) if "x" in row), (1, 1))
        out[("farm", dx, dy)] = (name, ex[0], ex[1], (0, -1))
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == "x":
                    out[(name, x, y)] = ("farm", dx, dy + 1, (0, 1))
    return out


PORTALS = build_portals()


def neighbors8(pos):
    x, y = pos
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx or dy:
                yield (x + dx, y + dy)


NUM_FIELDS = {"dx", "dy", "n", "i", "score", "amount", "qty", "x", "y"}
FLAG_FIELDS = {"ok", "yes"}


def clean_msg(msg):
    """Make a client's message safe to act on, whoever sent it: number fields become ints (or go away if they aren't
    numbers), flags become booleans, ids stay plain ints or strings, and every other field must be a short string."""
    out = {}
    if not isinstance(msg, dict):
        return out
    for k, v in msg.items():
        if not isinstance(k, str):
            continue
        if k in NUM_FIELDS:
            if isinstance(v, bool):
                v = int(v)
            if isinstance(v, str):
                try:
                    v = int(v.strip())
                except ValueError:
                    continue
            if isinstance(v, (int, float)) and v == v and abs(v) < 10 ** 9:
                out[k] = int(v)
        elif k in FLAG_FIELDS:
            out[k] = bool(v)
        elif k in ("id", "a"):
            if isinstance(v, (int, str)) and not isinstance(v, bool):
                out[k] = v if isinstance(v, int) else v[:200]
        elif isinstance(v, str):
            out[k] = v[:400]
    return out


FACE_DIRS = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}
FACE_ACTS = {"move", "interact", "fish_start", "clear", "face", "rest", "eat"}


def level_for(xp):
    """Level from experience: level L needs 60 * L * L xp (the same curve as always), up to level 1000."""
    return min(MAX_LEVEL, int((max(0, xp) / 60.0) ** 0.5))


def title_for(level):
    return [t for lv, t in LEVEL_TITLES if level >= lv][-1]


def fmt_duration(sec):
    sec = int(max(0, sec))
    if sec < 60:
        return "%ds" % sec
    if sec < 3600:
        return "%dm" % (sec // 60)
    if sec < DAY:
        h, m = divmod(sec, 3600)
        return "%dh%02dm" % (h, m // 60) if m else "%dh" % h
    d, rem = divmod(sec, DAY)
    return "%dd%dh" % (d, rem // 3600)


ROOM_TITLES = {"house": "the farmhouse", "shop": "the seed shop", "barn": "the barn", "assay": "the general store", "cabin": "the ranger's cabin",
               "wsaloon": "the gulch saloon", "coop": "the chicken coop", "smith": "the blacksmith's", "carpenter": "the carpenter's workshop",
               "butcher": "the butcher's shop", "sheriff": "the sheriff's office", "guild": "the Adventurers' Guild", "tiki": "the tiki hut"}
for _bl in AR.BUILDINGS.values():                # everywhere else is called what its sign says
    for _b in _bl:
        if _b.get("to") in INTERIORS and _b.get("label"):
            ROOM_TITLES.setdefault(_b["to"], "the " + _b["label"].title())


def catalog():
    """Everything a client needs to name and draw things (JSON-able)."""
    return dict(
        items={k: dict(name=v["name"], kind=v["kind"], sell=v["sell"], color=v["color"],
                       crop=v.get("crop"), tree=v.get("tree"), price=v.get("price"), rare=bool(v.get("rare")),
                       info=crafting.describe(k))
               for k, v in ITEMS.items()},
        crops={k: dict(name=c["name"], grow=c["grow"], regrow=c["regrow"], sell=c["sell"],
                       seasons=c["seasons"], color=c["color"], yield_=list(c["yield_"]),
                       seed_price=c["seed_price"]) for k, c in CROPS.items()},
        trees={k: dict(name=t["name"], mature=t["mature"], fruit_every=t["fruit_every"],
                       fruit_sell=t["fruit_sell"], color=t["color"], price=t["price"], rare=bool(t.get("rare")))
               for k, t in TREES.items()},
        forage={k: dict(name=f["name"], color=f["color"], sell=f["sell"]) for k, f in FORAGE.items()},
        fish={k: dict(name=f["name"], sell=f["sell"], difficulty=f["difficulty"], junk=f["junk"])
              for k, f in FISH.items()},
        player_colors=PLAYER_COLORS, sprites=SPRITES, titles=TITLES, max_level=MAX_LEVEL,
        tree_spots=[list(t) for t in progress.TREE_SPOTS],
        water_mult=WATER_MULT, water_duration=WATER_DURATION, can=CAN_CAPACITY,
        terrain_names=TERRAIN_NAMES, map_w=MAP_W, map_h=MAP_H, pasture=PASTURE, cow_price=COW_PRICE, max_cows=MAX_COWS,
        fields=FIELDS, priest=PRIEST, altar=ALTAR, interiors=INTERIORS, interior_names=INTERIOR_NAMES, doors=DOORS,
        no_chest=sorted(NO_CHEST),
        areas={a: AR.MAPS[a] for a in AR.AREAS}, area_names=AR.AREA_NAMES, buildings=AR.BUILDINGS,
        portals=sorted([k[0], k[1], k[2]] for k in PORTALS), npcs=AR.NPCS, keepers=AR.KEEPERS,
        area_terrain=AR.TERRAIN_NAMES, rooms=ROOM_TITLES, ores={a: [k for k, w in v] for a, v in AR.ORE.items()},
    )


# --------------------------------------------------------------------------
# World
# --------------------------------------------------------------------------
# the feature modules: each registers its items when imported and adds a mixin to World
from valley import crafting, animals, villagers, museum, festivals, skies, combat, landscape, townhall, progress, quests, revival, bloom, finale, economy, fairground, pantry, chapters, pets   # noqa: E402
HOOKS = ["craft", "animals", "folk", "museum", "fest", "sky", "combat", "land", "town", "progress", "quests", "revival", "bloom", "finale", "economy", "fair", "collect", "chapters", "pets"]
MAX_HP = 100


class World(crafting.Crafting, animals.Animals, villagers.Villagers, museum.Museum, festivals.Festivals, skies.Skies,
            combat.Combat, landscape.Landscape, townhall.TownHall, progress.Progress, quests.Quests, revival.Revival, bloom.Bloom, finale.Finale, economy.Economy, fairground.Fairground, pantry.Collections, chapters.Chapters, pets.Pets):
    def _run(self, phase, *args):
        """Call every feature module's hook for this phase (init, load, save, tick, fast, snap, join, leave, pub, priv)."""
        for n in HOOKS:
            f = getattr(self, "_%s_%s" % (phase, n), None)
            if f:
                f(*args)

    def _init_core(self, now):
        self.edits = {}            # loc -> {"x,y": terrain char}: land reshaped, buildings raised
        self.xbuildings = {}       # loc -> [building]: buildings put up after the map was drawn (coops, cottages)
        self.xportals = {}         # (loc, x, y) -> (loc2, x2, y2, facing) for those buildings
        self.amaps = {a: list(AR.MAPS[a]) for a in AR.AREAS}
        self.dyn_maps = {}         # generated places (mystery islands, dungeon floors): loc -> rows
        self.dyn_rev = {}          # loc -> revision, so clients refetch a regenerated map

    def __init__(self):
        now = time.time()
        self.name = "Cozy Hollow"
        self.created = now
        self.seed = random.randint(1, 10 ** 9)
        self.coins = 120
        self.tiles = {}          # (x, y) -> dict
        self.players = {}        # name -> dict
        self.stats = {}
        self.milestones = []
        self.quest = None
        self.storage = {}        # shared barn storage: item -> count
        self.chests = [dict(x=CHEST_HOME[0], y=CHEST_HOME[1])]   # the shared chest(s) on the farm; a farmer can carry one and set it down elsewhere
        self.cows = [dict(id=1, name="Daisy", x=77, y=16, facing=-1, milk=0.0, moved=now, pause=3.0)]   # one cow to start
        self.gift_cow = True
        self.marriages = []      # [[name, name, ts]]
        self.proposal = None     # {couple, t0, answers, stage}
        self.wedding = None      # {couple, t0, guests}
        self.priest_bubble = None
        self.cooldowns = {}
        self.forage_timer = 0.0
        self.ore_timer = 0.0
        self.atiles = {a: {} for a in AR.AREAS}    # out in the valley: area -> (x, y) -> {forage | ore}
        self.log = []
        self.last_tick = now
        self.map = build_map()
        self.dirty = True
        self.out = []
        self._weather_bucket = None
        self._init_core(now)
        self._run("init", now)
        self._starter_patch(now)
        self.new_quest(now)

    def _starter_patch(self, now):
        """A little patch of turnips already sprouting by the house."""
        for x in range(17, 20):
            for y in range(3, 6):
                t = self.tile((x, y))
                t["soil"] = True
                t["wet_until"] = now + WATER_DURATION
                t["crop"] = dict(kind="turnip", progress=0.0, planted=now,
                                 by="the previous farmer", harvests=0)
        for _ in range(4):
            self.spawn_forage(now + random.random())
        self.stock_areas(now)
        self.event("A new farm! The old farmer left a patch of turnips by the house.", now)

    # ---------------------------------------------------------------- persistence
    def to_dict(self):
        out = dict(
            version=1, name=self.name, created=self.created, seed=self.seed,
            coins=self.coins,
            tiles={"%d,%d" % pos: t for pos, t in self.tiles.items()},
            players=self.players, stats=self.stats, milestones=self.milestones,
            quest=self.quest, forage_timer=self.forage_timer, log=self.log,
            last_tick=self.last_tick, storage=self.storage, cows=self.cows, marriages=self.marriages, gift_cow=True,
            chests=self.chests, ore_timer=self.ore_timer,
            atiles={a: {"%d,%d" % pos: t for pos, t in ts.items()} for a, ts in self.atiles.items() if a not in self.dyn_maps},
            edits=self.edits, xbuildings=self.xbuildings,
        )
        self._run("save", out)
        return out

    @classmethod
    def from_dict(cls, d):
        w = cls.__new__(cls)
        w.name = d.get("name", "Cozy Hollow")
        w.created = d.get("created", time.time())
        w.seed = d.get("seed", 1)
        w.coins = d.get("coins", 0)
        w.tiles = {}
        w.map = build_map()
        w.edits = {}
        for loc, ed in (d.get("edits") or {}).items():
            if loc == "farm":
                for k, ch in ed.items():
                    x, y = (int(v) for v in k.split(","))
                    if 0 <= x < MAP_W and 0 <= y < MAP_H:
                        w.map[y] = w.map[y][:x] + ch + w.map[y][x + 1:]
        for k, t in d.get("tiles", {}).items():
            x, y = k.split(",")
            x, y = int(x), int(y)
            if 0 <= x < MAP_W and 0 <= y < MAP_H and w.map[y][x] in ".d":
                w.tiles[(x, y)] = t
        w.players = d.get("players", {})
        saved = d["chests"] if isinstance(d.get("chests"), list) else [dict(x=CHEST_HOME[0], y=CHEST_HOME[1])]
        todo = [(int(c["x"]), int(c["y"])) for c in saved]
        for p in w.players.values():
            p["online"] = False
            p["fishing"] = None
            p["bubble"] = None
            if p.get("carry") == "chest":      # the server stopped while someone carried the chest: set it down by them
                todo.append((p["x"], p["y"]) if p.get("loc", "farm") == "farm" else CHEST_HOME)
            p["carry"] = None
        w.stats = d.get("stats", {})
        w.milestones = d.get("milestones", [])
        w.quest = d.get("quest")
        w.storage = d.get("storage", {})
        w.last_tick = d.get("last_tick", time.time())
        w.cows = d.get("cows", [])
        w.gift_cow = True
        if not d.get("gift_cow") and not any(c.get("id") == 1 for c in w.cows):
            # every farm gets one cow to start; the rest cost gold at the shop
            w.cows.append(dict(id=1, name="Daisy", x=77, y=16, facing=-1, milk=0.0, moved=w.last_tick, pause=3.0))
        w.marriages = d.get("marriages", [])
        w.chests = []
        for pos in todo or [CHEST_HOME]:       # once tiles, farmers and cows are in: keep each chest only where it may sit
            if not w.chest_ok(*pos):
                pos = w.free_spot_near(pos)
            w.chests.append(dict(x=pos[0], y=pos[1]))
        w.proposal = None
        w.wedding = None
        w.priest_bubble = None
        w.cooldowns = {}
        w.forage_timer = d.get("forage_timer", 0.0)
        w.ore_timer = d.get("ore_timer", 0.0)
        w._init_core(w.last_tick)
        for loc, ed in (d.get("edits") or {}).items():
            for k, ch in ed.items():
                x, y = (int(v) for v in k.split(","))
                w.set_terrain(loc, x, y, ch)
        for loc, bl in (d.get("xbuildings") or {}).items():
            for b in bl:
                w.add_building(loc, b, edit=False)
        w.atiles = {a: {} for a in AR.AREAS}
        for a, ts in (d.get("atiles") or {}).items():
            if a not in w.atiles:
                continue
            for k, t in ts.items():
                x, y = (int(v) for v in k.split(","))
                if w.terrain(x, y, a) in AR.AREA_WALK:
                    w.atiles[a][(x, y)] = t
        for p in w.players.values():
            if p.get("loc", "farm") not in OUTDOOR and p.get("loc") not in INTERIORS:
                p["loc"], p["x"], p["y"] = "farm", SPAWN[0], SPAWN[1]
        if not d.get("atiles"):
            w.stock_areas(w.last_tick)
        w.log = d.get("log", [])
        w.last_tick = d.get("last_tick", time.time())
        w.dirty = False
        w.out = []
        w._weather_bucket = None
        w._run("init", w.last_tick)
        w._run("load", d)
        return w

    def save(self, path):
        tmp = path + ".tmp"
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f)
        os.replace(tmp, path)
        self.dirty = False

    @classmethod
    def load(cls, path):
        with open(path, "r", encoding="utf-8") as f:
            return cls.from_dict(json.load(f))

    # ---------------------------------------------------------------- time & weather
    def season_at(self, t):
        return SEASONS[int((t - self.created) // SEASON_SECONDS) % 4]

    def day_at(self, t):
        return int(((t - self.created) % SEASON_SECONDS) // DAY) + 1

    def year_at(self, t):
        return int((t - self.created) // (4 * SEASON_SECONDS)) + 1

    def sky_hour(self, t):
        """In-game hour 0..24 for the sky: sunrise, day, sunset, night."""
        return ((t + 6 * 60 + SKY_SHIFT) % SKY_DAY) / SKY_DAY * 24.0

    def weather_at(self, t):
        bucket = int(t // (2 * HOUR))
        h = hashlib.md5(("%d:%d" % (self.seed, bucket)).encode()).digest()
        r = int.from_bytes(h[:4], "big") / 2.0 ** 32
        if r < 0.25:
            return "snow" if self.season_at(t) == "winter" else "rain"
        return "sun"

    # ---------------------------------------------------------------- helpers
    def terrain(self, x, y, loc="farm"):
        if loc != "farm":
            rows = self.rows_of(loc)
            if 0 <= y < len(rows) and 0 <= x < len(rows[0]):
                return rows[y][x]
            return "#" if loc in INTERIORS else "C"
        if 0 <= x < MAP_W and 0 <= y < MAP_H:
            return self.map[y][x]
        return "#"

    def door_of(self, x, y):
        for name, pos in DOORS.items():
            if pos == (x, y):
                return name
        return None

    def entry_tile(self, loc):
        rows = INTERIORS[loc]
        for y, row in enumerate(rows):
            if "x" in row:
                return (row.index("x"), y - 1)
        return (1, 1)

    def tile(self, pos):
        return self.tiles.setdefault(pos, {})

    def prune(self, pos):
        t = self.tiles.get(pos)
        if t is not None and not any(t.get(k) for k in
                                     ("soil", "crop", "tree", "forage", "sprinkler", "machine")):
            del self.tiles[pos]

    def walkable(self, x, y, loc="farm"):
        if loc in INTERIORS:
            return self.terrain(x, y, loc) in INTERIOR_WALK and not self.blocked_extra(loc, x, y)
        if loc != "farm":
            return self.terrain(x, y, loc) in AR.AREA_WALK and not self.atiles.get(loc, {}).get((x, y), {}).get("ore") and not self.blocked_extra(loc, x, y)
        if self.terrain(x, y) not in WALKABLE:
            return False
        if self.cow_at(x, y) or self.chest_at(x, y) or self.blocked_extra("farm", x, y):
            return False
        t = self.tiles.get((x, y))
        return not (t and (t.get("tree") or t.get("machine")))

    def chest_at(self, x, y):
        for c in self.chests:
            if c["x"] == x and c["y"] == y:
                return c
        return None

    def chest_ok(self, x, y):
        """The one rule for where the chest may sit: bare ground or path (not a NO_CHEST tile), nothing growing or placed
        there, and no cow, chest or farmer on it (any farmer outdoors, online or not: they log back in where they stood)."""
        t = self.tiles.get((x, y), {})
        return (self.terrain(x, y) in ".:,d" and (x, y) not in NO_CHEST
                and not any(t.get(k) for k in ("soil", "crop", "tree", "forage", "sprinkler"))
                and not self.cow_at(x, y) and not self.chest_at(x, y)
                and not any(q["x"] == x and q["y"] == y and q.get("loc", "farm") == "farm" for q in self.players.values()))

    def free_spot_near(self, pos):
        """The nearest tile to pos where the chest may sit (for a chest set down on someone's behalf); failing that,
        the nearest one to its home by the shipping bin."""
        for (cx, cy), reach in ((pos, 6), (CHEST_HOME, max(MAP_W, MAP_H))):
            for r in range(reach):
                for dy in range(-r, r + 1):
                    for dx in range(-r, r + 1):
                        if max(abs(dx), abs(dy)) == r and self.chest_ok(cx + dx, cy + dy):
                            return (cx + dx, cy + dy)
        return CHEST_HOME

    def fx(self, p, kind, item, pos):
        """Tell everyone an object left a tile into someone's hands ("lift") or landed on one ("drop"); clients animate it."""
        self.out.append(("all", dict(t="fx", kind=kind, who=p["name"], item=item, x=pos[0], y=pos[1])))

    def spouse_of(self, name):
        for a, b, ts in self.marriages:
            if a == name:
                return b
            if b == name:
                return a
        return None

    # ---- the wedding easter egg ------------------------------------------------
    def near_priest(self, p):
        return max(abs(p["x"] - PRIEST[0]), abs(p["y"] - PRIEST[1])) <= 2

    def check_couples(self, now):
        if self.proposal or self.wedding:
            return
        online = [p for p in self.players.values() if p.get("online") and p.get("loc", "farm") == "farm"]
        for i, a in enumerate(online):
            for b in online[i + 1:]:
                if a.get("sprite", "boy") == b.get("sprite", "boy"):
                    continue
                if abs(a["x"] - b["x"]) != 1 or a["y"] != b["y"]:
                    continue
                if not (self.near_priest(a) and self.near_priest(b)):
                    continue
                if self.spouse_of(a["name"]) or self.spouse_of(b["name"]):
                    continue
                key = tuple(sorted([a["name"], b["name"]]))
                if now < self.cooldowns.get(key, 0):
                    continue
                self.proposal = dict(couple=[a["name"], b["name"]], t0=now, answers={}, stage=0)
                self.priest_bubble = ["Oh!", now + 1.6]
                return

    def run_proposal(self, now):
        pr = self.proposal
        if not pr:
            return
        a, b = pr["couple"]
        pa, pb = self.players.get(a), self.players.get(b)
        if not (pa and pb and pa.get("online") and pb.get("online") and pa.get("loc", "farm") == "farm" and pb.get("loc", "farm") == "farm"):
            self.proposal = None
            self.priest_bubble = ["Come back when you're both here.", now + 3]
            self.cooldowns[tuple(sorted(pr["couple"]))] = now + 30
            for me in (a, b):
                self.out.append((me, dict(t="open", menu="close")))
            return
        t = now - pr["t0"]
        if pr["stage"] == 0 and t >= 1.6:
            pr["stage"] = 1
            self.priest_bubble = ["You two make a lovely pair.", now + 2.6]
        elif pr["stage"] == 1 and t >= 4.2:
            pr["stage"] = 2
            self.priest_bubble = ["Shall I marry you two?", now + PROPOSAL_TIMEOUT]
            for me, other in ((a, b), (b, a)):
                self.out.append((me, dict(t="open", menu="proposal", partner=other)))
        elif pr["stage"] == 2:
            if len(pr["answers"]) == 2:
                if all(pr["answers"].values()):
                    self.start_wedding(now)
                else:
                    self.cooldowns[tuple(sorted(pr["couple"]))] = now + 90
                    self.priest_bubble = ["Perhaps another day.", now + 3]
                    self.proposal = None
                    for me in (a, b):
                        self.out.append((me, dict(t="open", menu="close")))
            elif t > 4.2 + PROPOSAL_TIMEOUT:
                self.cooldowns[tuple(sorted(pr["couple"]))] = now + 90
                self.priest_bubble = ["Take your time, then.", now + 3]
                self.proposal = None
                for me in (a, b):
                    self.out.append((me, dict(t="open", menu="close")))

    def act_propose_answer(self, p, msg, now):
        pr = self.proposal
        if not pr or p["name"] not in pr["couple"] or pr["stage"] != 2:
            return
        pr["answers"][p["name"]] = bool(msg.get("yes"))
        other = [n for n in pr["couple"] if n != p["name"]][0]
        if pr["answers"][p["name"]]:
            p["bubble"] = ["Yes!", now + 4]
            self.out.append((other, dict(t="msg", text="%s said yes!" % p["name"], style="good")))
        else:
            p["bubble"] = ["Not today...", now + 4]
            self.out.append((other, dict(t="msg", text="%s isn't ready." % p["name"], style="warn")))
        self.dirty = True

    def start_wedding(self, now):
        a, b = self.proposal["couple"]
        self.proposal = None
        pa, pb = self.players[a], self.players[b]
        pa["loc"] = pb["loc"] = "farm"
        pa["x"], pa["y"] = ALTAR[0]
        pb["x"], pb["y"] = ALTAR[1]
        pa["facing"], pb["facing"] = [1, 0], [-1, 0]
        spots = [(x, y) for y in range(10, 14) for x in range(62, 70) if self.walkable(x, y)]
        random.shuffle(spots)
        guests = []
        for q in self.players.values():
            if q.get("online") and q["name"] not in (a, b) and spots:
                q["loc"] = "farm"
                q["x"], q["y"] = spots.pop()
                q["facing"] = [0, -1]
        for i, name in enumerate(NPCS):
            if not spots:
                break
            x, y = spots.pop()
            guests.append(dict(name=name, x=x, y=y, sprite=["boy", "girl"][i % 2],
                               color=(i * 3 + 1) % len(PLAYER_COLORS), hat=["none", "cowboy"][i % 3 == 0]))
        self.wedding = dict(couple=[a, b], t0=now, guests=guests, phase="gather")
        self.priest_bubble = ["Gather round, everyone!", now + 3]
        for me in (a, b):
            self.out.append((me, dict(t="open", menu="close")))
        self.dirty = True

    def run_wedding(self, now):
        wd = self.wedding
        if not wd:
            return
        t = now - wd["t0"]
        a, b = wd["couple"]
        pa, pb = self.players.get(a), self.players.get(b)
        if pa and pb:
            pa["x"], pa["y"] = ALTAR[0]
            pb["x"], pb["y"] = ALTAR[1]
            pa["facing"], pb["facing"] = [1, 0], [-1, 0]
        if wd["phase"] == "gather" and t >= 3:
            wd["phase"] = "vows"
            self.priest_bubble = ["Dearly beloved, we are gathered on this fine farm...", now + 4]
        elif wd["phase"] == "vows" and t >= 7:
            wd["phase"] = "ask"
            self.priest_bubble = ["Do you take each other, in rain and in sun?", now + 3.5]
        elif wd["phase"] == "ask" and t >= 10.5:
            wd["phase"] = "ido"
            for q in (pa, pb):
                if q:
                    q["bubble"] = ["I do!", now + 3]
        elif wd["phase"] == "ido" and t >= 12.5:
            wd["phase"] = "married"
            self.priest_bubble = ["I now pronounce you married!", now + 5]
            self.marriages.append([a, b, now])
            self.bump(None, "weddings")
            self.event("%s and %s got married by the barn! Congratulations!" % (a, b), now, "good")
            self.scrap("%s and %s got married by the barn." % (a, b), now, "wedding")
            self.check_milestones(now)
        elif wd["phase"] == "married" and t >= WEDDING_LENGTH:
            self.wedding = None
            self.priest_bubble = ["Bless you both.", now + 4]
        self.dirty = True

    def cow_at(self, x, y):
        for c in self.cows:
            if c["x"] == x and c["y"] == y:
                return c
        return None

    def in_pasture(self, x, y):
        P = PASTURE
        return P["x0"] <= x <= P["x1"] and P["y0"] <= y <= P["y1"] and self.terrain(x, y) == "."

    def wander_cows(self, now):
        """Cows amble: a few unhurried steps in one direction (one tile per tick, so clients can glide them
        between tiles), then a long graze. They turn to face the way they walk and never share a tile."""
        for c in self.cows:
            steps = c.get("steps", 0)
            if steps <= 0:
                if now - c.get("moved", 0) < c.get("pause", 3):
                    continue
                c["moved"] = now
                if random.random() < 0.45:                       # keep grazing a while longer
                    c["pause"] = random.uniform(2, 6)
                    if random.random() < 0.3:                   # ...maybe turning to look the other way
                        c["facing"] = -c.get("facing", 1)
                        self.dirty = True
                    continue
                c["heading"] = random.choice([(1, 0), (-1, 0), (0, 1), (0, -1)])
                c["steps"] = steps = random.randint(2, 5)
                c["pause"] = random.uniform(4, 10)
            elif now - c.get("moved", 0) < 0.9:
                continue
            dx, dy = c.get("heading", (1, 0))
            nx, ny = c["x"] + dx, c["y"] + dy
            blocked = not self.in_pasture(nx, ny) or self.cow_at(nx, ny) or self.chest_at(nx, ny) or any(
                p.get("online") and p["x"] == nx and p["y"] == ny and p.get("loc", "farm") == "farm" for p in self.players.values())
            if blocked:                                          # fence, another cow, the chest or a farmer: stop and graze
                c["steps"] = 0
                c["moved"] = now
                continue
            c["x"], c["y"] = nx, ny
            c["moved"] = now
            c["steps"] = steps - 1
            if dx:
                c["facing"] = dx
            self.dirty = True

    def growth_mult(self, tile, now):
        wet = tile.get("wet_until", 0) > now
        m = WATER_MULT if wet else 1.0
        if tile.get("fert"):
            m *= FERT_MULT
        return m * self.blessing()          # the valley's blessing once it is In Bloom

    def say(self, p, text, style="info"):
        self.out.append((p["name"], dict(t="msg", text=text, style=style)))

    def event(self, text, now, style="event"):
        self.log.append(dict(ts=now, text=text))
        del self.log[:-LOG_LIMIT]
        self.out.append(("all", dict(t="msg", text=text, style=style)))
        self.dirty = True

    def bump(self, p, key, n=1):
        self.stats[key] = self.stats.get(key, 0) + n
        if p is not None:
            ps = p.setdefault("stats", {})
            ps[key] = ps.get(key, 0) + n
            self.pet_roll(p, key)          # every time you do the thing, a tiny chance a pet decides to follow you
        self.dirty = True

    def check_milestones(self, now):
        for key, threshold, title in MILESTONES:
            if self.stats.get(key, 0) >= threshold and title not in self.milestones:
                self.milestones.append(title)
                self.event("Milestone unlocked: %s!" % title, now, "good")

    # inventory ------------------------------------------------------------
    def give(self, p, key, n):
        if hasattr(self, "note_found"):
            self.note_found(p, key)
        for slot in p["inventory"]:
            if slot[0] == key:
                slot[1] += n
                return
        p["inventory"].append([key, n])

    def count(self, p, key):
        for slot in p["inventory"]:
            if slot[0] == key:
                return slot[1]
        return 0

    def take(self, p, key, n):
        for i, slot in enumerate(p["inventory"]):
            if slot[0] == key:
                if slot[1] < n:
                    return False
                slot[1] -= n
                if slot[1] <= 0:
                    del p["inventory"][i]
                    if p["selected"] >= len(p["inventory"]):
                        p["selected"] = max(0, len(p["inventory"]) - 1)
                return True
        return False

    def selected_item(self, p):
        inv = p["inventory"]
        if not inv:
            return None
        p["selected"] = max(0, min(p["selected"], len(inv) - 1))
        return inv[p["selected"]][0]

    # ---------------------------------------------------------------- shop & quests
    def shop_stock(self, now):
        season = self.season_at(now)
        stock = []
        for key, c in CROPS.items():
            if c["always"] or season in c["seasons"]:
                stock.append([key + "_seed", c["seed_price"], progress.CROP_LEVEL.get(key, 0)])
        for key, tr in TREES.items():
            if tr.get("rare"):
                continue
            stock.append([key + "_sapling", tr["price"], progress.TREE_LEVEL.get(key, 0)])
        stock.append(["fertilizer", ITEMS["fertilizer"]["price"]])
        stock.append(["sprinkler", ITEMS["sprinkler"]["price"]])
        stock.append(["cow", COW_PRICE])
        if self.has_coop():
            stock.append(["chicken", 300])
        return stock

    def new_quest(self, now):
        rng = random.Random(int(now) ^ self.seed)
        season = self.season_at(now)
        prev = self.quest["item"] if self.quest else None
        for _ in range(10):
            roll = rng.random()
            if roll < 0.65:
                pool = [k for k, c in CROPS.items() if c["always"] or season in c["seasons"]]
                item, n = rng.choice(pool), rng.randint(3, 8)
            elif roll < 0.85:
                pool = [k for k, f in FORAGE.items() if season in f["seasons"]]
                item, n = rng.choice(pool), rng.randint(2, 5)
            else:
                pool = [k for k, f in FISH.items() if f["difficulty"] <= 3 and not f["junk"] and ITEMS[k]["kind"] == "fish"]
                item, n = rng.choice(pool), rng.randint(1, 3)
            if item != prev:
                break
        reward = int(n * ITEMS[item]["sell"] * 1.8) + 40
        folk = sorted(getattr(self, "folk", None) or {})          # a neighbour who actually lives here pins the request up
        self.quest = dict(item=item, n=n, reward=reward, who=rng.choice(folk or NPCS),
                          reason=rng.choice(REASONS), since=now)
        self.dirty = True

    # ---------------------------------------------------------------- simulation
    def spawn_forage(self, t):
        count = sum(1 for tile in self.tiles.values() if tile.get("forage"))
        if count >= FORAGE_MAX:
            return
        rng = random.Random(int(t * 1000) ^ self.seed)
        season = self.season_at(t)
        pool = [k for k, f in FORAGE.items() if season in f["seasons"]]
        for _ in range(60):
            x, y = rng.randint(2, MAP_W - 3), rng.randint(2, MAP_H - 3)
            if self.map[y][x] not in ".d" or self.chest_at(x, y):
                continue
            tile = self.tiles.get((x, y))
            if tile and any(tile.get(k) for k in ("soil", "tree", "forage", "sprinkler")):
                continue
            self.tile((x, y))["forage"] = rng.choice(pool)
            self.dirty = True
            return

    def spawn_area_forage(self, area, t):
        ground, pool = AR.AREA_FORAGE[area]
        tiles = self.atiles[area]
        if sum(1 for tl in tiles.values() if tl.get("forage")) >= AREA_FORAGE_MAX:
            return
        season = self.season_at(t)
        pool = [k for k in pool if season in FORAGE[k]["seasons"]]
        rows = self.rows_of(area)
        rng = random.Random(int(t * 1000) ^ self.seed ^ hash(area) & 0xffff)
        for _ in range(60):
            x, y = rng.randint(1, len(rows[0]) - 2), rng.randint(1, len(rows) - 2)
            if rows[y][x] not in ground or (x, y) in tiles or (area, x, y) in PORTALS or not pool:
                continue
            tiles[(x, y)] = dict(forage=rng.choice(pool))
            self.dirty = True
            return

    def spawn_ore(self, area, t):
        tiles = self.atiles[area]
        if sum(1 for tl in tiles.values() if tl.get("ore")) >= ORE_MAX[area]:
            return
        rows, ground = self.rows_of(area), AR.ORE_GROUND[area]
        rng = random.Random(int(t * 1000) ^ self.seed ^ (hash(area) & 0xffff) ^ 0x5a5a)
        kinds, weights = zip(*AR.ORE[area])
        for _ in range(60):
            x, y = rng.randint(1, len(rows[0]) - 2), rng.randint(1, len(rows) - 2)
            if rows[y][x] != ground or (x, y) in tiles or any((area, x + dx, y + dy) in PORTALS for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                continue
            if any(q.get("online") and q.get("loc") == area and (q["x"], q["y"]) == (x, y) for q in self.players.values()):
                continue
            tiles[(x, y)] = dict(ore=rng.choices(kinds, weights)[0])
            self.dirty = True
            return

    def stock_areas(self, now):
        """A fresh valley: a little forage in every wild place, rocks and ore on the mountain and in the mine."""
        for i, area in enumerate(AR.AREA_FORAGE):
            for k in range(3):
                self.spawn_area_forage(area, now + i * 7.3 + k * 1.7)
        for i, area in enumerate(ORE_MAX):
            for k in range(ORE_MAX[area]):
                self.spawn_ore(area, now + i * 11.1 + k * 2.3)

    def advance(self, t0, t1):
        """Simulate the farm from t0 to t1. Handles long offline gaps too."""
        if t1 <= t0:
            return
        big = (t1 - t0) > 2 * DAY
        t = t0
        while t < t1:
            step = min(1800.0 if big else 300.0, t1 - t)
            mid = t + step / 2
            weather = self.weather_at(mid)
            bucket = int(mid // (2 * HOUR))
            if bucket != self._weather_bucket:
                if self._weather_bucket is not None and weather != "sun":
                    self.event("%s is falling over the farm - the crops drink it up." %
                               weather.capitalize(), t, "weather")
                self._weather_bucket = bucket
            wet_weather = weather != "sun"
            # sprinklers water their neighbours
            for pos, tile in list(self.tiles.items()):
                if tile.get("sprinkler"):
                    for npos in neighbors8(pos):
                        nt = self.tiles.get(npos)
                        if nt and nt.get("soil"):
                            nt["wet_until"] = max(nt.get("wet_until", 0), mid + WATER_DURATION)
            for pos, tile in list(self.tiles.items()):
                if wet_weather and tile.get("soil"):
                    tile["wet_until"] = max(tile.get("wet_until", 0), mid + WATER_DURATION)
                mult = self.growth_mult(tile, mid)
                crop = tile.get("crop")
                if crop:
                    c = CROPS[crop["kind"]]
                    if crop["progress"] < c["grow"]:
                        crop["progress"] = min(c["grow"], crop["progress"] + step * mult)
                tree = tile.get("tree")
                if tree:
                    tr = TREES[tree["kind"]]
                    if tree["progress"] < tr["mature"]:
                        tree["progress"] = min(tr["mature"], tree["progress"] + step * mult)
                    elif tree["fruit"] < MAX_TREE_FRUIT and not tr.get("rare"):
                        tree["fruit_progress"] += step
                        while tree["fruit_progress"] >= tr["fruit_every"] and tree["fruit"] < MAX_TREE_FRUIT:
                            tree["fruit_progress"] -= tr["fruit_every"]
                            tree["fruit"] += 1
            for c in self.cows:
                c["milk"] = min(MILK_EVERY, c.get("milk", 0) + step)
            self.forage_timer += step
            while self.forage_timer >= self.forage_interval():
                self.forage_timer -= self.forage_interval()
                self.spawn_forage(mid)
                for i, area in enumerate(AR.AREA_FORAGE):
                    self.spawn_area_forage(area, mid + i * 0.37)
            self.ore_timer += step
            while self.ore_timer >= self.ore_interval():
                self.ore_timer -= self.ore_interval()
                for i, area in enumerate(ORE_MAX):
                    self.spawn_ore(area, mid + i * 0.53)
            t += step
        self.dirty = True

    def tick(self, now):
        self.out = []
        self._coin_src = "tick"
        self.advance(self.last_tick, now)
        self.last_tick = now
        if self.quest is None or now - self.quest["since"] > QUEST_REFRESH:
            self.new_quest(now)
        self.wander_cows(now)
        self._run("tick", now)
        self.check_couples(now)
        self.run_proposal(now)
        self.run_wedding(now)
        if self.priest_bubble and self.priest_bubble[1] < now:
            self.priest_bubble = None
        return self.out

    def fast(self, now):
        """A quick tick (4 a second) for things that move fast: monsters, critters, balloons, arrows."""
        self.out = []
        self.moved = False
        self._coin_src = "fast"
        self._run("fast", now)
        return self.out

    # ---------------------------------------------------------------- the shape of the world
    @staticmethod
    def atile_view(t):
        if t.get("forage"):
            return {"g": t["forage"]}
        if t.get("ore"):
            return {"o": t["ore"]}
        m = t.get("machine")
        if m:
            return {"m": [m["kind"], 2 if m.get("out") else (1 if m.get("ready") else 0), m.get("out")]}
        if t.get("opened"):
            return {"x": 1}
        return None

    def is_outdoor(self, loc):
        return loc == "farm" or loc in self.amaps or loc in self.dyn_maps

    def rows_of(self, loc):
        if loc == "farm":
            return self.map
        return INTERIORS.get(loc) or self.amaps.get(loc) or self.dyn_maps.get(loc) or []

    def set_terrain(self, loc, x, y, ch, record=True):
        """Reshape the land: one tile of any outdoor map becomes ch (and the change is saved and sent to everyone)."""
        rows = self.map if loc == "farm" else (self.amaps.get(loc) or self.dyn_maps.get(loc))
        if rows is None or not (0 <= y < len(rows) and 0 <= x < len(rows[0])):
            return False
        rows[y] = rows[y][:x] + ch + rows[y][x + 1:]
        if record and loc not in self.dyn_maps:
            self.edits.setdefault(loc, {})["%d,%d" % (x, y)] = ch
        self.dirty = True
        return True

    def add_building(self, loc, b, edit=True):
        """Raise a building on an outdoor map after the fact (a coop, a cottage): footprint, door portal and interior exit."""
        b = dict(b)
        b.setdefault("door", (b["x"] + b["w"] // 2, b["y"] + b["h"] - 1))
        b["door"] = tuple(b["door"])
        self.xbuildings.setdefault(loc, [])
        if not any(o["x"] == b["x"] and o["y"] == b["y"] for o in self.xbuildings[loc]):
            self.xbuildings[loc].append(b)
        for yy in range(b["y"], b["y"] + b["h"]):
            for xx in range(b["x"], b["x"] + b["w"]):
                self.set_terrain(loc, xx, yy, "@", record=edit)
        dx, dy = b["door"]
        if b.get("to") in INTERIORS:
            rows = INTERIORS[b["to"]]
            ex = next(((row.index("x"), y - 1) for y, row in enumerate(rows) if "x" in row), (1, 1))
            self.xportals[(loc, dx, dy)] = (b["to"], ex[0], ex[1], (0, -1))
            for y, row in enumerate(rows):
                for x, ch in enumerate(row):
                    if ch == "x":
                        self.xportals[(b["to"], x, y)] = (loc, dx, dy + 1, (0, 1))
        self.dirty = True
        return b

    def buildings_in(self, loc):
        return AR.BUILDINGS.get(loc, []) + self.xbuildings.get(loc, [])

    def portal(self, loc, x, y):
        return self.xportals.get((loc, x, y)) or PORTALS.get((loc, x, y))

    def blocked_extra(self, loc, x, y):
        """Something a feature module put on the tile (a chicken, a machine, a trap, a villager's stall) blocks the way."""
        for n in HOOKS:
            f = getattr(self, "_block_" + n, None)
            if f and f(loc, x, y):
                return True
        return False

    def intercept(self, p, loc, fx, fy, now):
        """E: the feature modules get the first look (a villager, an animal, a machine, a monster, a bug...)."""
        for n in ("combat", "fest", "fair", "finale", "chapters", "folk", "animals", "sky", "museum", "land", "craft", "town", "bloom", "economy"):
            f = getattr(self, "_use_" + n, None)
            if f and f(p, loc, fx, fy, now):
                return True
        return False

    def place_name(self, loc):
        if loc in AR.AREA_NAMES:
            return AR.AREA_NAMES[loc]
        for n in HOOKS:
            f = getattr(self, "_name_" + n, None)
            name = f(loc) if f else None
            if name:
                return name
        return loc

    def fish_pool(self, loc):
        for n in HOOKS:
            f = getattr(self, "_fish_" + n, None)
            pool = f(loc) if f else None
            if pool:
                return pool
        return AR.AREA_FISH.get(loc)

    def held(self, p):
        return self.selected_item(p)

    def facing_tile(self, p):
        return p["x"] + p["facing"][0], p["y"] + p["facing"][1]

    def online_in(self, loc):
        return [q for q in self.players.values() if q.get("online") and q.get("loc", "farm") == loc]

    def list_menu(self, p, mid, title, rows, sub="", foot="", keep=False):
        """A generic window both clients can draw: rows of {key (item icon), label, info, right, act (message to send), ok}."""
        self.out.append((p["name"], dict(t="open", menu="list", id=mid, title=title, sub=sub, rows=rows, foot=foot, keep=keep)))

    # ---------------------------------------------------------------- players
    def join(self, name, now, sprite=None, color=None, hat=None):
        self.out = []
        p = self.players.get(name)
        if p is None:
            p = dict(name=name, x=SPAWN[0], y=SPAWN[1], facing=[0, 1],
                     inventory=[["turnip_seed", 8], ["potato_seed", 4]],
                     selected=0, water=CAN_CAPACITY, xp=0,
                     color=len(self.players) % len(PLAYER_COLORS), sprite="boy",
                     stats={}, bubble=None, fishing=None, joined=now)
            self.players[name] = p
            self.event("%s arrived at the farm for the first time! Welcome!" % name, now, "good")
        else:
            self.event("%s is back in the valley." % name, now)
        if sprite in SPRITES or sprite in OWN_LOOKS:
            p["sprite"] = sprite
        p.setdefault("sprite", "boy")
        if color in PLAYER_COLORS:
            p["color"] = PLAYER_COLORS.index(color)
        if hat in ("cowboy", "none"):
            p["hat"] = hat
        p.setdefault("hat", "cowboy")
        p["online"] = True
        p["fishing"] = None
        p["last_seen"] = now
        p.setdefault("hp", MAX_HP)
        if p.get("loc", "farm") in self.dyn_maps or not (p.get("loc", "farm") in INTERIORS or self.is_outdoor(p.get("loc", "farm"))):
            p["loc"], p["x"], p["y"] = "farm", SPAWN[0], SPAWN[1]     # the generated place they were in is gone
        self.give_tools(p)
        self._run("join", p, now)
        self.dirty = True
        return self.out

    def give_tools(self, p):
        """Every farmer carries the six tools, always in the first slots."""
        have = [k for k, n in p["inventory"]]
        missing = [t for t in TOOLS if t not in have]
        if missing:
            p["inventory"] = [[t, 1] for t in missing] + p["inventory"]
            p["selected"] = min(p["selected"] + len(missing), len(p["inventory"]) - 1) if have else 0

    def leave(self, name, now):
        self.out = []
        p = self.players.get(name)
        if p and p.get("online"):
            p["online"] = False
            p["fishing"] = None
            p["last_seen"] = now
            if p.get("carry") == "chest":      # nobody leaves with the farm's chest: it stays where they stood
                spot = self.free_spot_near((p["x"], p["y"]) if p.get("loc", "farm") == "farm" else CHEST_HOME)
                self.chests.append(dict(x=spot[0], y=spot[1]))
                p["carry"] = None
            self._run("leave", p, now)
            self.event("%s headed home for now." % name, now)
        return self.out

    def public_player(self, p, now):
        bubble = p.get("bubble")
        if bubble and bubble[1] < now:
            bubble = None
        inv = p["inventory"]
        held = inv[min(p["selected"], len(inv) - 1)][0] if inv else None
        d = dict(name=p["name"], x=p["x"], y=p["y"], facing=p["facing"], held=held, hat=p.get("hat", "cowboy"),
                    carry=p.get("carry"), spouse=self.spouse_of(p["name"]), loc=p.get("loc", "farm"),
                    color=p["color"], sprite=p.get("sprite", "boy"), online=bool(p.get("online")),
                    bubble=bubble[0] if bubble else None,
                    level=level_for(p["xp"]), title=title_for(level_for(p["xp"])),
                    fishing=bool(p.get("fishing")), o=p.get("off"))
        self._run("pub", p, d, now)
        return d

    def private_player(self, p):
        lvl = level_for(p["xp"])
        nxt = 60 * (lvl + 1) ** 2 if lvl < MAX_LEVEL else None
        d = dict(inventory=p["inventory"], selected=p["selected"], loc=p.get("loc", "farm"),
                 water=p["water"], xp=p["xp"], level=lvl, title=title_for(lvl),
                 next_xp=nxt, stats=p.get("stats", {}), hp=p.get("hp", MAX_HP), max_hp=self.max_hp(p))
        self._run("priv", p, d)
        return d

    def snapshot(self, now):
        tiles = {}
        for (x, y), tile in self.tiles.items():
            d = {}
            if tile.get("soil"):
                d["s"] = 1
            if tile.get("wet_until", 0) > now:
                d["w"] = 1
            if tile.get("fert"):
                d["f"] = 1
            if tile.get("sprinkler"):
                d["k"] = 1
            if tile.get("forage"):
                d["g"] = tile["forage"]
            m = tile.get("machine")
            if m:
                d["m"] = [m["kind"], 2 if m.get("out") else (1 if m.get("ready") else 0), m.get("out")]
            crop = tile.get("crop")
            if crop:
                c = CROPS[crop["kind"]]
                frac = crop["progress"] / c["grow"]
                ripe = crop["progress"] >= c["grow"]
                mult = self.growth_mult(tile, now)
                eta = 0 if ripe else (c["grow"] - crop["progress"]) / mult
                d["c"] = [crop["kind"], min(3, int(frac * 4)), 1 if ripe else 0,
                          int(frac * 100), int(eta)]
            tree = tile.get("tree")
            if tree:
                tr = TREES[tree["kind"]]
                frac = tree["progress"] / tr["mature"]
                stage = 2 if frac >= 1 else (1 if frac >= 0.4 else 0)
                mult = self.growth_mult(tile, now)
                if frac < 1:
                    eta = (tr["mature"] - tree["progress"]) / mult
                elif tree["fruit"] < MAX_TREE_FRUIT and not tr.get("rare"):
                    eta = tr["fruit_every"] - tree["fruit_progress"]
                else:
                    eta = 0
                d["t"] = [tree["kind"], stage, tree["fruit"], int(frac * 100), int(eta)]
            if d:
                tiles["%d,%d" % (x, y)] = d
        snap = dict(
            t="state", now=now, farm=self.name, season=self.season_at(now),
            day=self.day_at(now), year=self.year_at(now),
            weather=self.weather_at(now), coins=self.coins, sky=round(self.sky_hour(now), 2),
            players=[self.public_player(p, now) for p in self.players.values()],
            tiles=tiles, quest=self.quest,
            areas={a: {"%d,%d" % pos: self.atile_view(t) for pos, t in ts.items() if self.atile_view(t)} for a, ts in self.atiles.items()}, milestones=len(self.milestones), storage=dict(self.storage), chests=list(self.chests),
            cows=[dict(id=c["id"], name=c["name"], x=c["x"], y=c["y"], f=c.get("facing", 1), w=1 if c.get("steps", 0) > 0 else 0,
                       milk=c.get("milk", 0) >= MILK_EVERY, pct=int(100 * c.get("milk", 0) / MILK_EVERY)) for c in self.cows],
            priest=dict(x=PRIEST[0], y=PRIEST[1], bubble=self.priest_bubble[0] if self.priest_bubble and self.priest_bubble[1] > now else None),
            wedding=(dict(couple=self.wedding["couple"], phase=self.wedding["phase"], guests=self.wedding["guests"],
                          altar=ALTAR, t=now - self.wedding["t0"]) if self.wedding else None),
            edits=self.edits, xb=self.xbuildings, dyn=self.dyn_rev, xp=sorted([k[0], k[1], k[2]] for k in self.xportals),
        )
        self._run("snap", snap, now)
        return snap

    # ---------------------------------------------------------------- actions
    def apply(self, name, msg, now):
        self.out = []
        p = self.players.get(name)
        if p is None:
            return self.out
        msg = clean_msg(msg)                 # anything off the wire: numbers are numbers, names are strings, or they're dropped
        t = msg.get("t")
        if msg.get("f") in FACE_DIRS and t in FACE_ACTS:     # the browser moves freely: it says which way you face as you act
            p["facing"] = list(FACE_DIRS[msg["f"]])
        handler = getattr(self, "act_" + str(t), None)
        self._coin_src = str(t)            # the ledger files any coins this action moves under its name
        if handler is None:
            self.say(p, "Unknown action: %r" % (t,), "warn")
        else:
            handler(p, msg, now)
        return self.out

    def act_move(self, p, msg, now):
        if self.wedding:
            return
        dx = max(-1, min(1, int(msg.get("dx", 0))))
        dy = max(-1, min(1, int(msg.get("dy", 0))))
        if not (dx or dy):
            return
        p["facing"] = list(FACE_DIRS[msg["f"]]) if msg.get("f") in FACE_DIRS else ([dx, 0] if dx else [0, dy])
        p.pop("off", None)
        nx, ny = p["x"] + dx, p["y"] + dy
        loc = p.get("loc", "farm")
        if self.terrain(nx, ny, loc) == "D" and (loc == "mine3" or loc.startswith("deep")) and not self.portal(loc, nx, ny):
            if not self.mine_gate(p, "deep1"):
                return
            self.link_down(loc, nx, ny)
        dest = self.portal(loc, nx, ny)
        if dest and dest[0] != loc and not self.mine_gate(p, dest[0]):
            return
        if dest:
            if p.get("carry"):
                return self.say(p, "The chest stays on the farm. Set it down first (E).", "warn")
            return self.travel(p, dest, now)
        if self.walkable(nx, ny, loc):
            ox, oy = p["x"], p["y"]
            pet_was = (p["pet"].get("x"), p["pet"].get("y")) if p.get("pet") and p["pet"].get("loc") == loc else None
            p["x"], p["y"] = nx, ny
            p["fishing"] = None
            self.pet_follow(p, ox, oy)
            self.companion_follow(p, ox, oy, pet_was)
            self.dirty = True

    def travel(self, p, dest, now, text=None):
        """Carry a farmer through a door, off the edge of a map, down a ladder or on a ride."""
        to, tx, ty, f = dest
        frm = p.get("loc", "farm")
        p["loc"], p["x"], p["y"], p["facing"], p["fishing"] = to, tx, ty, list(f), None
        self.dirty = True
        if to == "farm":
            c = self.cow_at(tx, ty)
            if c:                                            # shoo the cow off the doorstep to a free tile, if any
                for sx, sy in ((c["x"], c["y"] + 1), (c["x"] - 1, c["y"]), (c["x"] + 1, c["y"])):
                    if self.in_pasture(sx, sy) and not self.chest_at(sx, sy) and not self.cow_at(sx, sy) and not any(
                            q.get("online") and (q["x"], q["y"]) == (sx, sy) and q.get("loc", "farm") == "farm" for q in self.players.values()):
                        c["x"], c["y"] = sx, sy
                        break
        if self.is_outdoor(to) and to != "farm" and to in AR.AREA_NAMES:
            seen = p.setdefault("seen", [])
            if to not in seen:
                seen.append(to)
                self.bump(p, "explored")
                self.credit(p, "explore")
                self.check_milestones(now)
        if text:
            return self.say(p, text, "event")
        if to in AR.KEEPERS:
            return self.say(p, "%s: %s" % (AR.KEEPERS[to], random.choice(AR.KEEPER_LINES[AR.KEEPERS[to]])))
        if to in INTERIORS:
            return self.say(p, {"house": "Home sweet home.", "shop": "Marigold: Welcome in! Have a look around.",
                                "barn": "It smells of hay in here."}.get(to, "You step inside."))
        if self.is_outdoor(to) and to != frm and self.is_outdoor(frm):
            self.say(p, "~ %s ~" % self.place_name(to).replace("the ", "The ", 1), "event")
        self._run("arrive", p, frm, now)

    def act_rest(self, p, msg, now):
        """The browser lets you stop anywhere inside a tile: remember where, so everyone else sees you standing just there."""
        try:
            ox, oy = float(msg.get("ox", 0)), float(msg.get("oy", 0))
        except (TypeError, ValueError):
            return
        if not (math.isfinite(ox) and math.isfinite(oy)):     # "nan" or "inf" would turn into invalid JSON for everyone
            return
        p["off"] = [round(max(-0.6, min(0.6, ox)), 2), round(max(-0.6, min(0.6, oy)), 2)]
        self.dirty = True

    def act_face(self, p, msg, now):
        """Turn without stepping (used by click-to-act)."""
        dx = max(-1, min(1, int(msg.get("dx", 0))))
        dy = max(-1, min(1, int(msg.get("dy", 0))))
        if (dx or dy) and not (dx and dy):
            p["facing"] = [dx, dy]
            self.dirty = True

    def act_select(self, p, msg, now):
        i = int(msg.get("i", 0))
        if 0 <= i < len(p["inventory"]):
            p["selected"] = i
            self.dirty = True

    def act_interact(self, p, msg, now):
        """E: use what you hold on the tile ahead (or the one you stand on)."""
        fx, fy = p["x"] + p["facing"][0], p["y"] + p["facing"][1]
        loc = p.get("loc", "farm")
        if self.intercept(p, loc, fx, fy, now):
            return
        if loc in AR.INTERIORS:
            return self.interact_inside(p, loc, fx, fy, now)
        if self.is_outdoor(loc) and loc != "farm":
            return self.interact_area(p, loc, fx, fy, now)
        if loc != "farm":
            ch = self.terrain(fx, fy, loc)
            if ch == "c":
                return self.act_barn(p, msg, now)
            if ch in "Sq":
                return self.act_shop(p, msg, now)
            if ch == "k":
                return self.act_journal(p, msg, now)
            lines = {"b": "You flop onto the bed for a moment. So cozy.", "t": "A sturdy table. Someone left a mug of cocoa.",
                     "f": "The fire crackles warmly.", "F": "The fire crackles warmly.", "p": "A happy little plant. It likes you.",
                     "h": "Sweet-smelling hay. The cows love it.", "o": "The trough is full of oats.", "W": "A view over the farm.",
                     "x": "The way out."}
            if ch in lines:
                return self.say(p, lines[ch])
            return self.say(p, "Nothing to do here. Head back out the door to farm.")
        fpos, pos = (fx, fy), (p["x"], p["y"])
        if p.get("carry"):
            return self.act_place(p, msg, now)
        fterr = self.terrain(fx, fy)
        ftile = self.tiles.get(fpos, {})
        sel = self.selected_item(p)
        kind = ITEMS[sel]["kind"] if sel else None
        if fterr == "S":
            return self.act_shop(p, msg, now)
        if fterr == "$":
            return self.out.append((p["name"], dict(t="open", menu="sell")))
        if fterr == "!":
            return self.out.append((p["name"], dict(t="open", menu="board", quest=self.quest)))
        if fterr == "+":
            return self.act_journal(p, msg, now)
        if fterr == "N" or self.chest_at(fx, fy):
            return self.act_barn(p, msg, now)
        if fterr == "Y":
            if not self.count(p, "valley_map"):
                self.give(p, "valley_map", 1)
                self.dirty = True
                self.event("Father TongTong gave %s a Valley Map." % p["name"], now)
                return self.say(p, "Father TongTong: Take this map, child, so you never lose sight of your friends. (Press N to open it.)", "good")
            sp = self.spouse_of(p["name"])
            if sp:
                return self.say(p, "Father TongTong: Bless you and %s. How are the crops?" % sp)
            return self.say(p, "Father TongTong: Lovely day for a wedding, wouldn't you say? *wink*")
        cow = self.cow_at(fx, fy)
        if cow:
            if cow.get("milk", 0) >= MILK_EVERY:
                cow["milk"] = 0.0
                self.give(p, "milk", 1)
                p["xp"] += 8
                self.bump(p, "milk")
                self.swing_anim(p, "hand", fpos)
                self.dirty = True
                return self.say(p, "Milked %s. She seems pleased." % cow["name"], "good")
            return self.say(p, "%s: Moo. (milk in %s)" % (cow["name"], fmt_duration(MILK_EVERY - cow.get("milk", 0))))
        if fterr == "~":
            if sel == "fishing_rod":
                return self.act_fish_start(p, msg, now)
            return self.refill(p, now)
        if fterr == "w":
            return self.refill(p, now)
        if fterr == "m":
            return self.say(p, random.choice(MAIL), "event")
        if fterr in PROP_LINES:
            return self.say(p, PROP_LINES[fterr])
        if ftile.get("tree"):
            if sel == "axe":
                return self.chop(p, fpos, ftile, now)
            return self.pick_fruit(p, fpos, ftile, now)
        if ftile.get("forage"):
            return self.pick_forage(p, fpos, ftile, now)
        targets = [fpos, pos]
        if sel in ("hoe", "watering_can") and self.tool_area(p, sel):     # an upgraded tool works a whole row or square
            return self.till_area(p, self.tool_area(p, sel), now) if sel == "hoe" else self.water_area(p, self.tool_area(p, sel), now)
        if sel == "hoe":
            for t in targets:
                tl = self.tiles.get(t, {})
                if self.terrain(*t) == "d" and not any(tl.get(k) for k in ("soil", "sprinkler", "tree", "forage")):
                    self.tile(t)["soil"] = True
                    self.bump(p, "tilled")
                    self.swing_anim(p, "hoe", t)
                    return self.say(p, "Tilled the soil. Hold seeds and press E to plant.")
            if any(self.terrain(*t) == "." for t in targets):
                return self.say(p, "That's not farmland. Till the sandy fields by the house and along the path.")
            return self.say(p, "Nothing to till here.")
        if sel == "watering_can":
            for t in targets:
                tl = self.tiles.get(t, {})
                if tl.get("soil"):
                    self.swing_anim(p, "watering_can", t)
                    return self.water(p, tl, now)
            return self.say(p, "Nothing to water here." + (" Refill at the pond or the well." if p["water"] <= 0 else ""))
        if sel == "scythe":
            for t in targets:
                tl = self.tiles.get(t, {})
                crop = tl.get("crop")
                if crop:
                    self.swing_anim(p, "scythe", t)
                    if crop["progress"] >= CROPS[crop["kind"]]["grow"]:
                        return self.harvest(p, t, tl, now)
                    name = CROPS[crop["kind"]]["name"]
                    del tl["crop"]
                    tl.pop("fert", None)
                    self.prune(t)
                    return self.say(p, "Cut down the young %s." % name, "warn")
                if tl.get("forage"):
                    return self.pick_forage(p, t, tl, now)
            return self.say(p, "Swish. Nothing to cut here.")
        if sel == "pickaxe":
            for t in targets:
                tl = self.tiles.get(t)
                if not tl:
                    continue
                self.swing_anim(p, "pickaxe", t)
                if tl.get("sprinkler"):
                    del tl["sprinkler"]
                    self.give(p, "sprinkler", 1)
                    self.fx(p, "lift", "sprinkler", t)
                    self.prune(t)
                    return self.say(p, "Picked up the sprinkler.")
                if tl.get("crop"):
                    name = CROPS[tl["crop"]["kind"]]["name"]
                    self.fx(p, "lift", tl["crop"]["kind"], t)
                    del tl["crop"]
                    tl.pop("fert", None)
                    self.prune(t)
                    return self.say(p, "Dug up the %s." % name, "warn")
                if tl.get("soil"):
                    for k in ("soil", "fert", "wet_until"):
                        tl.pop(k, None)
                    self.prune(t)
                    return self.say(p, "Smoothed the soil back into grass.")
            return self.say(p, "Nothing to dig here.")
        if sel == "axe":
            return self.say(p, "Face a tree you planted to chop it.")
        if sel == "fishing_rod":
            return self.say(p, "Face the pond and press E to cast.")
        if kind == "sapling":
            return self.plant_at_spot(p, fpos, sel, now)
        if kind == "seed":
            for t in targets:
                tl = self.tiles.get(t, {})
                if tl.get("soil") and not tl.get("crop") and not tl.get("tree"):
                    if kind == "seed":
                        return self.plant(p, t, tl, sel, now)
                    return self.plant_tree(p, t, tl, sel, now)
            return self.say(p, "Seeds need tilled soil - use the hoe first (slot 1).", "warn")
        if sel == "fertilizer":
            for t in targets:
                tl = self.tiles.get(t, {})
                if tl.get("soil") and not tl.get("fert"):
                    return self.fertilize(p, tl, now)
            return self.say(p, "Fertilizer goes on tilled soil.")
        if sel == "sprinkler":
            for t in targets:
                tl = self.tiles.get(t, {})
                if self.terrain(*t) == "d" and not any(tl.get(k) for k in ("crop", "tree", "sprinkler", "forage")):
                    return self.place_sprinkler(p, t, now)
            return self.say(p, "Sprinklers go on farmland.")
        for t in targets:
            tl = self.tiles.get(t, {})
            crop = tl.get("crop")
            if crop and crop["progress"] >= CROPS[crop["kind"]]["grow"]:
                return self.harvest(p, t, tl, now)
            if tl.get("forage"):
                return self.pick_forage(p, t, tl, now)
        if kind == "food":
            return self.act_eat(p, {}, now)
        if self.terrain(*pos) in ".d" or self.tiles.get(pos, {}).get("soil"):
            return self.say(p, "Pick a tool with 1-6: hoe to till farmland, seeds to plant, can to water, scythe to harvest.")
        self.say(p, "Nothing to do here.")

    # out in the valley -------------------------------------------------------
    def interact_inside(self, p, loc, fx, fy, now):
        ch = self.terrain(fx, fy, loc)
        keeper = AR.KEEPERS.get(loc)
        if ch in "nS" and keeper:
            if not self.npc_present(keeper, loc):
                h = self.sky_hour(now)
                return self.say(p, "Nobody's behind the counter. %s" % ("Closed for the night - back in the morning." if h >= 21 or h < 7 else "%s must be out for a bit." % keeper))
            return self.keeper_counter(p, loc, keeper, now)
        if ch in AR.OBJECT_LINES:
            return self.say(p, AR.OBJECT_LINES[ch])
        lines = {"b": "A neatly made bed.", "t": "A sturdy table, a little sticky.", "f": "The fire crackles warmly.",
                 "F": "The fire crackles warmly.", "p": "A happy little plant.", "k": "Shelves of books and odds and ends.",
                 "W": "You peek out of the window.", "x": "The way out."}
        if ch in lines:
            return self.say(p, lines[ch])
        return self.say(p, "Nothing to do here.")

    def keeper_counter(self, p, loc, keeper, now):
        """What each shopkeeper does when you step up to their counter."""
        hi = "%s: %s" % (keeper, random.choice(AR.KEEPER_LINES[keeper]))
        if loc == "store":
            self.say(p, hi)
            rows = [dict(label="Seeds, saplings and cows", info="Bram stocks the same as Marigold's seed shop.", act=dict(t="shop_open"), ok=True, right="Browse")]
            self.out.append((p["name"], dict(t="open", menu="close")))
            return self.mercantile(p, rows)
        if loc in ("saloon", "bakery", "wsaloon", "assay", "tiki"):
            self.say(p, hi)
            return self.shop_menu(p, {"saloon": "saloon", "bakery": "bakery", "wsaloon": "dolly", "assay": "gulch", "tiki": "tiki"}[loc])
        if loc == "butcher":
            self.say(p, hi)
            return self.act_butcher(p, {}, now)
        if loc == "hall":
            return self.town_menu(p, now)
        if loc == "museum":
            return self.museum_menu(p, now)
        if loc == "clinic":
            rows = [dict(key="adopt_dog", label="Adopt a dog", info="A loyal friend who follows you everywhere.", act=dict(t="adopt", kind="dog"), ok="dog" not in p.get("pets", {}), right="Adopt"),
                    dict(key="adopt_cat", label="Adopt a cat", info="An independent friend who follows you anyway.", act=dict(t="adopt", kind="cat"), ok="cat" not in p.get("pets", {}), right="Adopt"),
                    dict(label="A check-up", info="Back to full health for 50g.", act=dict(t="heal"), ok=p.get("hp", MAX_HP) < self.max_hp(p) and self.coins >= 50, right="50g")]
            return self.list_menu(p, "clinic", "Doc Alder's Clinic", rows, sub="\"Strays turn up here all the time. Want to give one a home?\"")
        if loc == "smith":
            rows = [dict(key="sword_copper", label="Forge a Copper Sword", info="6 copper ore and 100g.", act=dict(t="forge", item="sword_copper"), ok=self.count(p, "copper_ore") >= 6 and self.coins >= 100, right="Forge"),
                    dict(key="sword_iron", label="Forge an Iron Sword", info="6 iron ore and 300g.", act=dict(t="forge", item="sword_iron"), ok=self.count(p, "iron_ore") >= 6 and self.coins >= 300, right="Forge"),
                    dict(key="sword_gold", label="Forge a Golden Sword", info="6 gold ore and 800g.", act=dict(t="forge", item="sword_gold"), ok=self.count(p, "gold_ore") >= 6 and self.coins >= 800, right="Forge"),
                    dict(key="coal", label="Buy coal", info="20g a lump.", act=dict(t="forge", item="coal"), ok=self.coins >= 20, right="20g")]
            rows += self.smith_rows(p)
            return self.list_menu(p, "smith", "Ingrid's Smithy", rows, sub=hi, keep=True)
        if loc == "fishshop":
            rows = [dict(key="mystery_ticket", label="Mystery Ticket", info="Sail to an island nobody's mapped. Different every time.", act=dict(t="purchase", shop="tomas", item="mystery_ticket"),
                         ok=self.unlocked("harbor") and self.coins >= 500, right="500g" if self.unlocked("harbor") else "after the Harbor project")]
            return self.list_menu(p, "fishshop", "Old Tomas's Fish Shop", rows, sub=hi)
        if loc == "bank":
            n = self.count(p, "gold_nugget")
            rows = [dict(key="gold_nugget", label="Exchange gold nuggets", info="Mr. Penny pays 220g a nugget (the shipping bin pays 150g).", act=dict(t="exchange"), ok=n > 0, right="x%d" % n)]
            return self.list_menu(p, "bank", "Bank of Dusty Gulch", rows, sub=hi)
        if loc == "post":
            return self.say(p, "%s hands you a letter. %s" % (keeper, random.choice(MAIL)), "event")
        if loc == "cabin":
            self.say(p, hi)
            return self.shop_menu(p, "ranger")
        return self.say(p, hi)

    def mercantile(self, p, rows):
        from valley.crafting import SHOPS
        title, keeper, stock = SHOPS["mercantile"]
        for key, price in stock:
            rows.append(dict(key=key, label=ITEMS[key]["name"], info=self.item_info(key), right="%dg" % price, act=dict(t="purchase", shop="mercantile", item=key), ok=self.coins >= price))
        self.list_menu(p, "shop:mercantile", "Mercantile", rows, sub="Bram · %dg shared" % self.coins, keep=True)

    def act_shop_open(self, p, msg, now):
        if p.get("loc") == "store":
            self.act_shop(p, {}, now)

    def act_forge(self, p, msg, now):
        key = msg.get("item")
        cost = {"sword_copper": ("copper_ore", 100), "sword_iron": ("iron_ore", 300), "sword_gold": ("gold_ore", 800), "coal": (None, 20)}.get(key)
        if not cost or p.get("loc") != "smith":
            return
        ore, coins = cost
        if self.coins < coins or (ore and self.count(p, ore) < 6):
            return self.say(p, "Ingrid: You're a bit short on that.", "warn")
        if ore:
            self.take(p, ore, 6)
        self.coins -= coins
        self.give(p, key, 1)
        self.say(p, "Ingrid hands you a %s%s." % (ITEMS[key]["name"], ", still warm" if ore else ""), "good")
        self.keeper_counter(p, "smith", "Ingrid", now)

    def act_exchange(self, p, msg, now):
        n = self.count(p, "gold_nugget")
        if p.get("loc") != "bank" or not n:
            return
        self.take(p, "gold_nugget", n)
        self.coins += 220 * n
        self.bump(p, "earned", 220 * n)
        self.say(p, "Mr. Penny counts out %dg for your %d nugget%s." % (220 * n, n, "s" if n > 1 else ""), "good")
        self.out.append((p["name"], dict(t="open", menu="close")))

    def interact_area(self, p, loc, fx, fy, now):
        ch = self.terrain(fx, fy, loc)
        tiles = self.atiles.setdefault(loc, {})
        sel = self.selected_item(p)
        for pos in ((fx, fy), (p["x"], p["y"])):
            tl = tiles.get(pos)
            if tl and tl.get("forage"):
                return self.pick_area_forage(p, loc, pos, tl, now)
        tl = tiles.get((fx, fy))
        if tl and tl.get("ore"):
            if sel != "pickaxe":
                return self.say(p, "A %s. Hold the pickaxe (5) and press E to break it." %
                                ("rock" if tl["ore"] == "stone" else "rock with " + ITEMS[tl["ore"]]["name"].lower() + " in it"))
            return self.mine(p, loc, (fx, fy), tl, now)
        ride = AR.RIDES.get((loc, ch))
        if ride:
            to, (tx, ty), text = ride
            self.bump(p, "rides")
            self.check_milestones(now)
            return self.travel(p, (to, tx, ty, (0, 1)), now, text)
        if ch == "~":
            if sel == "fishing_rod":
                return self.act_fish_start(p, {}, now)
            return self.refill(p, now)
        if ch == "w" or ch == "I":
            return self.refill(p, now)
        if ch == "!":
            return self.out.append((p["name"], dict(t="open", menu="board", quest=self.quest)))
        if ch == "m":
            return self.say(p, "Not your mailbox! You resist the urge to peek.")
        if ch == "@":
            for b in self.buildings_in(loc):
                if b["x"] <= fx < b["x"] + b["w"] and b["y"] <= fy < b["y"] + b["h"]:
                    if b["kind"] == "stable":
                        return self.stable_menu(p, now)
                    if tuple(b["door"]) == (fx, fy) and not b.get("to"):
                        who = b.get("keeper")
                        if who == "the horses":
                            return self.say(p, "The stable doors are shut. Somewhere inside, a horse whinnies.")
                        return self.say(p, "%s's cottage. Nobody answers - they must be out." % who if who else "It's locked.")
                    if b["kind"] == "volcano":
                        return self.say(p, "The volcano rumbles softly. Too hot to climb today.")
                    return self.say(p, "The %s. The door is at the front." % b["label"].title() if b["label"] else "A building.")
        if ch == "g":
            return self.say(p, {
                "town": "Hollow Town. Farm east, Summit Ridge north, Driftwood Beach south. Stagecoach to Dusty Gulch here.",
                "beach": "Driftwood Beach. Boat to Palm Isle at the end of the pier.",
                "forest": "Whisperwood. Farm north, beach west. Mind the river.",
                "mountain": "Summit Ridge. Mine to the north, the lake east, Hollow Town west, the farm south.",
                "island": "Palm Isle. The boat home leaves from the dock.",
                "frontier": "Dusty Gulch, est. 1889. Stagecoach back to Hollow Town here.",
            }.get(loc, "A signpost."))
        if ch in PROP_LINES:
            return self.say(p, PROP_LINES[ch])
        if ch in AR.PROP_LINES:
            return self.say(p, AR.PROP_LINES[ch])
        if ch in "TPA":
            return self.say(p, {"T": "A big old tree.", "P": "A tall pine. It smells of resin.", "A": "A palm tree. Coconuts drop now and then."}[ch])
        if ch in "UD":
            return self.say(p, "A ladder. Walk onto it to climb.")
        if sel and ITEMS[sel]["kind"] == "food":
            return self.act_eat(p, {}, now)
        return self.say(p, "Nothing to do here. Forage, fish, or explore!")

    def pick_area_forage(self, p, loc, pos, tl, now):
        key = tl.pop("forage")
        if not tl:
            del self.atiles[loc][pos]
        self.give(p, key, 2 if self.perk(p, "forager") and random.random() < 0.2 else 1)
        self.fx(p, "lift", key, pos)
        p["xp"] += 5
        self.bump(p, "foraged")
        self.dirty = True
        self.say(p, "Found a %s!" % ITEMS[key]["name"], "good")
        self.check_milestones(now)

    def mine(self, p, loc, pos, tl, now):
        kind = tl["ore"]
        del self.atiles[loc][pos]
        self.swing_anim(p, "pickaxe", pos)
        got = [(kind, 1)]
        if kind != "stone" and random.random() < 0.5:
            got.append(("stone", 1))
        if kind == "stone" and random.random() < 0.25:
            got = [("stone", 2)]
        for k, n in got:
            self.give(p, k, n)
        self.fx(p, "lift", kind, pos)
        p["xp"] += {"stone": 3}.get(kind, 12 if kind not in GEMS else 30)
        self.bump(p, "mined")
        self.dirty = True
        if kind in GEMS:
            self.bump(p, "gems")
            self.event("%s found %s %s in %s!" % (p["name"], "an" if kind[0] in "aeiou" else "a", ITEMS[kind]["name"],
                                                  self.place_name(loc)), now, "good")
        else:
            self.say(p, "Broke the rock: " + ", ".join("%d %s" % (n, ITEMS[k]["name"]) for k, n in got) + ".", "good")
        self.check_milestones(now)

    # barn: shared storage ---------------------------------------------------
    def act_barn(self, p, msg, now):
        self.out.append((p["name"], dict(t="open", menu="barn", storage=dict(self.storage))))

    def act_store(self, p, msg, now):
        item, n = msg.get("item"), max(1, int(msg.get("n", 1)))
        if item not in ITEMS or ITEMS[item]["kind"] == "gear":
            return self.say(p, "You can't put that in the chest.", "warn")
        n = min(n, self.count(p, item))
        if n <= 0:
            return self.say(p, "You don't have any %s." % ITEMS[item]["name"], "warn")
        self.take(p, item, n)
        self.storage[item] = self.storage.get(item, 0) + n
        self.dirty = True
        self.say(p, "Put %d %s in the chest." % (n, ITEMS[item]["name"]))
        self.act_barn(p, msg, now)

    def act_withdraw(self, p, msg, now):
        item, n = msg.get("item"), max(1, int(msg.get("n", 1)))
        have = self.storage.get(item, 0)
        if item not in ITEMS or have <= 0:
            return self.say(p, "There's none of that in the chest.", "warn")
        n = min(n, have)
        self.storage[item] = have - n
        if self.storage[item] <= 0:
            del self.storage[item]
        self.give(p, item, n)
        self.dirty = True
        self.say(p, "Took %d %s from the chest." % (n, ITEMS[item]["name"]))
        self.act_barn(p, msg, now)

    # the movable chest -------------------------------------------------------
    def act_pickup(self, p, msg, now):
        """X (or the chest window's button) facing the chest: hoist it overhead and carry it."""
        if p.get("loc", "farm") != "farm":
            return
        if p.get("carry"):
            return self.say(p, "Your arms are full already.", "warn")
        fx, fy = p["x"] + p["facing"][0], p["y"] + p["facing"][1]
        chest = self.chest_at(fx, fy)
        if not chest:
            return self.say(p, "Face the chest to pick it up.")
        self.chests.remove(chest)
        p["carry"] = "chest"
        p["fishing"] = None
        self.fx(p, "lift", "chest", (fx, fy))
        self.out.append((p["name"], dict(t="open", menu="close")))
        self.dirty = True
        self.say(p, "Picked up the chest. Walk somewhere and press E to set it down.")

    def act_place(self, p, msg, now):
        """E or X while carrying: set the chest down on the tile ahead."""
        if not p.get("carry"):
            return self.say(p, "You're not carrying anything.")
        if p.get("loc", "farm") != "farm":
            return self.say(p, "The chest belongs outside. Take it out the door first.", "warn")
        fx, fy = p["x"] + p["facing"][0], p["y"] + p["facing"][1]
        if (fx, fy) in NO_CHEST:
            return self.say(p, "Not there - folks need that spot clear to get by.", "warn")
        if not self.chest_ok(fx, fy):
            return self.say(p, "Not there - find a clear patch of ground.", "warn")
        self.chests.append(dict(x=fx, y=fy))
        p["carry"] = None
        self.fx(p, "drop", "chest", (fx, fy))
        self.dirty = True
        self.say(p, "Set the chest down here.")

    def swing_anim(self, p, tool, target, item=None):
        """Tell everyone a tool was swung (clients animate it)."""
        self.out.append(("all", dict(t="swing", who=p["name"], tool=tool, x=target[0], y=target[1], item=item)))

    def chop(self, p, pos, tile, now):
        tree = tile["tree"]
        tr = TREES[tree["kind"]]
        if tr.get("rare"):
            return self.say(p, "You can't bring yourself to chop down the %s." % tr["name"], "warn")
        n = 5 if tree["progress"] >= tr["mature"] else 2
        del tile["tree"]
        self.prune(pos)
        self.give(p, "wood", n)
        p["xp"] += 4
        self.swing_anim(p, "axe", pos)
        self.say(p, "Chopped down the %s tree. +%d wood." % (tr["name"], n), "warn")

    def act_clear(self, p, msg, now):
        if p.get("loc", "farm") in INTERIORS:
            return self.say(p, "Not in here - take it outside.")
        if p.get("loc", "farm") != "farm":
            return self.say(p, "Nothing to clear here - X works on the farm.")
        if p.get("carry"):
            return self.act_place(p, msg, now)
        if self.chest_at(p["x"] + p["facing"][0], p["y"] + p["facing"][1]):
            return self.act_pickup(p, msg, now)
        pos = (p["x"], p["y"])
        tile = self.tiles.get(pos)
        if not tile:
            return self.say(p, "Nothing to clear here.")
        if tile.get("tree") and TREES[tile["tree"]["kind"]].get("rare"):
            return self.say(p, "You can't bring yourself to dig up the %s." % TREES[tile["tree"]["kind"]]["name"], "warn")
        self.swing_anim(p, "pickaxe", pos)
        if tile.get("forage"):
            return self.pick_forage(p, pos, tile, now)
        if tile.get("crop"):
            name = CROPS[tile["crop"]["kind"]]["name"]
            self.fx(p, "lift", tile["crop"]["kind"], pos)
            del tile["crop"]
            self.say(p, "Dug up the %s." % name, "warn")
        elif tile.get("tree"):
            name = TREES[tile["tree"]["kind"]]["name"]
            del tile["tree"]
            self.say(p, "Chopped down the %s tree." % name, "warn")
        elif tile.get("sprinkler"):
            del tile["sprinkler"]
            self.give(p, "sprinkler", 1)
            self.fx(p, "lift", "sprinkler", pos)
            self.say(p, "Picked up the sprinkler.")
        elif tile.get("soil"):
            tile.pop("soil", None)
            tile.pop("fert", None)
            tile.pop("wet_until", None)
            self.say(p, "Smoothed the soil back into grass.")
        self.prune(pos)
        self.dirty = True

    # farming ----------------------------------------------------------------
    def water(self, p, tile, now):
        if tile.get("wet_until", 0) > now:
            return self.say(p, "The soil is already wet.")
        if p["water"] <= 0:
            return self.say(p, "Your can is empty! Face the pond and press E to refill.", "warn")
        p["water"] -= 1
        tile["wet_until"] = now + self.water_time()
        self.bump(p, "watered")
        crop = tile.get("crop")
        if crop:
            self.say(p, "Watered the %s. (%dx growth for %s)" %
                     (CROPS[crop["kind"]]["name"], WATER_MULT, fmt_duration(WATER_DURATION)))
        else:
            self.say(p, "Watered the soil.")

    def refill(self, p, now):
        fx, fy = p["x"] + p["facing"][0], p["y"] + p["facing"][1]
        hint = " (F to fish!)" if self.terrain(fx, fy, p.get("loc", "farm")) == "~" else ""
        if p["water"] >= self.can_cap(p):
            return self.say(p, "The watering can is already full." + hint)
        p["water"] = self.can_cap(p)
        self.dirty = True
        self.say(p, "Refilled the watering can." + hint)

    def plant(self, p, pos, tile, seed_key, now):
        crop_key = ITEMS[seed_key]["crop"]
        if not self.take(p, seed_key, 1):
            return self.say(p, "You have no %s." % ITEMS[seed_key]["name"], "warn")
        tile["crop"] = dict(kind=crop_key, progress=0.0, planted=now, by=p["name"], harvests=0)
        self.fx(p, "drop", seed_key, pos)
        self.bump(p, "planted")
        c = CROPS[crop_key]
        self.say(p, "Planted %s. Ready in %s (%s if watered)." %
                 (c["name"], fmt_duration(c["grow"]), fmt_duration(c["grow"] / WATER_MULT)))
        self.check_milestones(now)

    def plant_tree(self, p, pos, tile, sapling_key, now):
        tree_key = ITEMS[sapling_key]["tree"]
        for npos in neighbors8(pos):
            nt = self.tiles.get(npos)
            if nt and nt.get("tree"):
                return self.say(p, "Too close to another tree - leave a gap.", "warn")
        if not self.take(p, sapling_key, 1):
            return
        tile["tree"] = dict(kind=tree_key, progress=0.0, fruit=0, fruit_progress=0.0,
                            planted=now, by=p["name"])
        self.fx(p, "drop", sapling_key, pos)
        tile.pop("crop", None)
        self.bump(p, "trees")
        tr = TREES[tree_key]
        if tr.get("rare"):
            self.bump(p, "rare_trees")
            self.event("%s planted a legendary %s seed! It will be fully grown in %s." %
                       (p["name"], tr["name"], fmt_duration(tr["mature"])), now, "good")
        else:
            self.event("%s planted a %s sapling. It will bear fruit in %s." %
                       (p["name"], tr["name"], fmt_duration(tr["mature"])), now)
        self.check_milestones(now)

    def fertilize(self, p, tile, now):
        if tile.get("fert"):
            return self.say(p, "Already fertilised.")
        if not self.take(p, "fertilizer", 1):
            return self.say(p, "No fertilizer left.", "warn")
        tile["fert"] = True
        self.say(p, "Fertilised the soil (+50%% growth until harvest).")

    def place_sprinkler(self, p, pos, now):
        if not self.take(p, "sprinkler", 1):
            return
        tile = self.tile(pos)
        tile.pop("soil", None)
        tile.pop("crop", None)
        tile.pop("wet_until", None)
        tile["sprinkler"] = True
        self.fx(p, "drop", "sprinkler", pos)
        self.event("%s placed a sprinkler. The 8 tiles around it stay watered." % p["name"], now)

    def harvest(self, p, pos, tile, now):
        crop = tile["crop"]
        c = CROPS[crop["kind"]]
        self.swing_anim(p, "hand", pos)
        self.fx(p, "lift", crop["kind"], pos)
        lo, hi = c["yield_"]
        n = random.randint(lo, hi)
        if random.random() < min(0.6, 0.03 * level_for(p["xp"])) + (0.05 if self.perk(p, "green_thumb") else 0):           # a bonus crop now and then, more often as you level
            n += 1
        self.give(p, crop["kind"], n)
        p["xp"] += 8 + c["sell"] // 4
        self.bump(p, "harvested", n)
        if random.random() < RARE_SEED_CHANCE:      # one in a million: a legendary seed tumbles out of the harvest
            seed = random.choice(RARE_TREES) + "_seed"
            self.give(p, seed, 1)
            self.bump(p, "rare_seeds")
            self.fx(p, "lift", seed, pos)
            self.event("%s found a %s in the %s harvest! ONE IN A MILLION!" % (p["name"], ITEMS[seed]["name"], c["name"]), now, "good")
        if c["regrow"]:
            crop["progress"] = c["grow"] - c["regrow"]
            crop["harvests"] += 1
            tile.pop("fert", None) if crop["harvests"] >= 4 else None
            self.say(p, "Harvested %d %s! It will regrow in %s." %
                     (n, c["name"], fmt_duration(c["regrow"])), "good")
        else:
            del tile["crop"]
            tile.pop("fert", None)
            self.say(p, "Harvested %d %s!" % (n, c["name"]), "good")
        self.check_milestones(now)

    def pick_fruit(self, p, pos, tile, now):
        tree = tile["tree"]
        tr = TREES[tree["kind"]]
        if tree["progress"] < tr["mature"]:
            return self.say(p, "The %s %s is still growing (%d%%)." %
                            (tr["name"], "seedling" if tr.get("rare") else "tree", 100 * tree["progress"] / tr["mature"]))
        if tr.get("rare"):
            return self.say(p, {"oak": "The ancient oak creaks softly. It has seen a thousand harvests.",
                                "willow": "The willow's branches sway and brush your hat.",
                                "bonsai": "The bonsai looks perfectly content. So do you."}[tree["kind"]], "good")
        if tree["fruit"] <= 0:
            return self.say(p, "No fruit yet. Next %s in %s." %
                            (tr["name"], fmt_duration(tr["fruit_every"] - tree["fruit_progress"])))
        n = tree["fruit"]
        tree["fruit"] = 0
        self.give(p, tree["kind"], n)
        self.fx(p, "lift", tree["kind"], pos)
        p["xp"] += 6 * n
        self.bump(p, "fruit", n)
        self.say(p, "Picked %d %s!" % (n, tr["name"] + ("s" if n > 1 else "")), "good")
        self.check_milestones(now)

    def pick_forage(self, p, pos, tile, now):
        key = tile.pop("forage")
        self.prune(pos)
        self.give(p, key, 2 if self.perk(p, "forager") and random.random() < 0.2 else 1)
        self.fx(p, "lift", key, pos)
        p["xp"] += 5
        self.bump(p, "foraged")
        self.say(p, "Found a %s!" % ITEMS[key]["name"], "good")
        self.check_milestones(now)

    # shop / selling / quests -------------------------------------------------
    def act_shop(self, p, msg, now):
        self.out.append((p["name"], dict(t="open", menu="shop", stock=self.shop_stock(now),
                                         season=self.season_at(now))))

    def act_buy(self, p, msg, now):
        item, n = msg.get("item"), max(1, min(99, int(msg.get("n", 1))))
        price = dict((s[0], s[1]) for s in self.shop_stock(now)).get(item)
        if price is None:
            return self.say(p, "The shop doesn't sell that right now.", "warn")
        need = progress.seed_level(item)
        if self.level_of(p) < need:
            return self.say(p, "Marigold: Those are tricky to grow - come back at level %d." % need, "warn")
        if item == "chicken":
            self.buy_chicken(p, now)
            return self.act_shop(p, msg, now)
        if item == "cow":
            n = 1
        cost = price * n
        if cost > self.coins:
            return self.say(p, "Not enough coins (need %dg, have %dg)." % (cost, self.coins), "warn")
        if item == "cow":
            if len(self.cows) >= self.cow_cap():
                return self.say(p, "The pasture is full (%d cows). Oakley can build a bigger barn." % self.cow_cap(), "warn")
            occupied = {(q["x"], q["y"]) for q in self.players.values() if q.get("online") and q.get("loc", "farm") == "farm"}
            spots = [(x, y) for y in range(PASTURE["y0"] + 6, PASTURE["y1"] + 1) for x in range(PASTURE["x0"], PASTURE["x1"] + 1)
                     if self.in_pasture(x, y) and not self.cow_at(x, y) and not self.chest_at(x, y) and (x, y) not in occupied]
            x, y = random.choice(spots)
            used = {c["name"] for c in self.cows}
            name = random.choice([nm for nm in COW_NAMES if nm not in used] or COW_NAMES)
            self.coins -= cost
            self.cows.append(dict(id=int(now * 1000) % 10 ** 9, name=name, x=x, y=y, facing=random.choice((-1, 1)),
                                  milk=0.0, moved=now, pause=3.0))
            self.bump(p, "spent", cost)
            self.bump(p, "cows")
            self.event("%s bought a cow! %s is grazing in the pasture." % (p["name"], name), now, "good")
            return self.act_shop(p, msg, now)
        self.coins -= cost
        self.give(p, item, n)
        self.bump(p, "spent", cost)
        self.say(p, "Bought %d %s for %dg." % (n, ITEMS[item]["name"], cost), "good")

    def act_sell(self, p, msg, now):
        item, n = msg.get("item"), max(1, int(msg.get("n", 1)))
        if item not in ITEMS or ITEMS[item]["sell"] <= 0:
            return self.say(p, "You can't sell that.", "warn")
        have = self.count(p, item)
        if have <= 0:
            return self.say(p, "You don't have any %s." % ITEMS[item]["name"], "warn")
        n = min(n, have)
        self.take(p, item, n)
        self.note_shipped(p, item, now)
        earned = int(ITEMS[item]["sell"] * n * (1.05 if self.perk(p, "collector") else 1))
        self.coins += earned
        p["xp"] += max(1, earned // 20)
        self.bump(p, "earned", earned)
        self.say(p, "Sold %d %s for %dg." % (n, ITEMS[item]["name"], earned), "good")
        self.check_milestones(now)
        if str(msg.get("menu", "")) in crafting.SHOPS:
            self.shop_menu(p, msg["menu"])

    def act_sell_all(self, p, msg, now):
        total = 0
        for key, n in list(p["inventory"]):
            if ITEMS[key]["kind"] not in ("gear", "tool", "seed", "sapling", "machine", "machine_kit", "key", "weapon", "ammo", "treat", "ticket", "present", "food", "art") and ITEMS[key]["sell"] > 0:
                self.take(p, key, n)
                self.note_shipped(p, key, now)
                total += ITEMS[key]["sell"] * n
        if total <= 0:
            return self.say(p, "Nothing to sell (seeds and tools stay).", "warn")
        if self.perk(p, "collector"):
            total = int(total * 1.05)
        self.coins += total
        p["xp"] += max(1, total // 20)
        self.bump(p, "earned", total)
        self.event("%s shipped a haul for %dg!" % (p["name"], total), now, "good")
        self.check_milestones(now)

    def act_deliver(self, p, msg, now):
        q = self.quest
        if not q:
            return self.say(p, "The board is empty right now.")
        if self.count(p, q["item"]) < q["n"]:
            return self.say(p, "You need %d %s (you have %d)." %
                            (q["n"], ITEMS[q["item"]]["name"], self.count(p, q["item"])), "warn")
        self.take(p, q["item"], q["n"])
        self.coins += q["reward"]
        p["xp"] += 25
        self.bump(p, "quests")
        self.bump(p, "earned", q["reward"])
        self.event("%s delivered %d %s to %s and earned %dg!" %
                   (p["name"], q["n"], ITEMS[q["item"]]["name"], q["who"], q["reward"]), now, "good")
        if q["who"] in getattr(self, "folk", {}):
            self.befriend(p, q["who"], 80)
        self.new_quest(now)
        self.out.append((p["name"], dict(t="open", menu="board", quest=self.quest)))
        self.check_milestones(now)

    def act_journal(self, p, msg, now):
        players = []
        for q in self.players.values():
            players.append(dict(name=q["name"], online=bool(q.get("online")),
                                level=level_for(q["xp"]), title=title_for(level_for(q["xp"])),
                                stats=q.get("stats", {}), last_seen=q.get("last_seen", 0)))
        self.out.append((p["name"], dict(
            t="open", menu="journal", farm=self.name, created=self.created,
            stats=self.stats, milestones=self.milestones, players=players,
            all_milestones=[m[2] for m in MILESTONES])))

    # fishing -------------------------------------------------------------------
    def act_fish_start(self, p, msg, now):
        loc = p.get("loc", "farm")
        if not self.is_outdoor(loc):
            return self.say(p, "There's no water in here.")
        if p.get("carry"):
            return self.say(p, "Your arms are full - set the chest down first (E).", "warn")
        fx, fy = p["x"] + p["facing"][0], p["y"] + p["facing"][1]
        if self.terrain(fx, fy, loc) != "~":
            return self.say(p, "Face the water to fish.", "warn")
        raining = self.weather_at(now) != "sun"
        keys = FARM_FISH if loc == "farm" else (self.fish_pool(loc) or FARM_FISH)
        weights = []
        for k in keys:
            w = FISH[k]["weight"]
            if raining and FISH[k]["difficulty"] >= 3:
                w *= 2.5
            weights.append(w)
        key = random.choices(keys, weights)[0]
        wait = random.uniform(1.5, 5.0)
        p["fishing"] = dict(fish=key, started=now)
        self.dirty = True
        self.out.append((p["name"], dict(t="fish_bite", fish=key, name=FISH[key]["name"],
                                         difficulty=FISH[key]["difficulty"], wait=wait,
                                         level=level_for(p["xp"]))))

    def act_fish_result(self, p, msg, now):
        f = p.get("fishing")
        p["fishing"] = None
        if not f:
            return
        key = f["fish"]
        if not msg.get("ok"):
            return self.say(p, "It got away...", "warn")
        fish = FISH[key]
        two = not fish["junk"] and self.room_done("fisher") and random.random() < 0.15
        self.give(p, key, 2 if two else 1)
        if two:
            self.say(p, "Two on one line! (the Fisher's Chest)", "good")
        if fish["junk"]:
            p["xp"] += 2
            return self.say(p, "You fished up... %s%s. Huh." % ("an " if key[0] in "aeiou" else "a ", fish["name"]))
        p["xp"] += 5 * fish["difficulty"] + 5
        self.derby_catch(p, key)
        if key == "gold_nugget":
            self.event("%s panned a Gold Nugget out of the creek! Eureka!" % p["name"], now, "good")
            return self.check_milestones(now)
        self.bump(p, "fish")
        if fish["difficulty"] >= 3:
            self.event("%s caught a %s! (worth %dg)" % (p["name"], fish["name"], fish["sell"]), now, "good")
        else:
            self.say(p, "Caught a %s! (worth %dg)" % (fish["name"], fish["sell"]), "good")
        self.check_milestones(now)

    # chat -------------------------------------------------------------------
    def act_chat(self, p, msg, now):
        text = "".join(ch for ch in str(msg.get("text", "")) if ch.isprintable()).strip()[:160]
        if not text:
            return
        if text.startswith("/"):
            return self.command(p, text, now)
        p["bubble"] = [text, now + BUBBLE_SECONDS]
        self.log.append(dict(ts=now, text="%s: %s" % (p["name"], text)))
        del self.log[:-LOG_LIMIT]
        self.out.append(("all", dict(t="chat", sender=p["name"], text=text)))
        self.dirty = True

    def act_ping(self, p, msg, now):
        text = "".join(ch for ch in str(msg.get("text") or "hi") if ch.isprintable()).strip()[:120] or "hi"
        p["bubble"] = [text, now + BUBBLE_SECONDS]
        self.event("%s pinged everyone: %s" % (p["name"], text), now, "ping")

    def command(self, p, text, now):
        parts = text.split()
        cmd = parts[0].lower()
        if cmd in ("/ping@all", "/ping", "/pingall"):
            return self.act_ping(p, dict(text=" ".join(parts[1:])), now)
        if cmd == "/farm":
            name = " ".join(parts[1:]).strip()[:32]
            if not name:
                return self.say(p, "Usage: /farm <new farm name>")
            self.name = name
            return self.event("%s renamed the farm to '%s'." % (p["name"], name), now, "good")
        if cmd == "/give":
            if len(parts) < 3:
                return self.say(p, "Usage: /give <player> <item> [count]")
            target = self.players.get(parts[1])
            if target is None:
                return self.say(p, "No farmer called %s." % parts[1], "warn")
            want = parts[2].lower()
            key = None
            for k, n in p["inventory"]:
                if k == want or ITEMS[k]["name"].lower() == want or ITEMS[k]["name"].lower().startswith(want):
                    key = k
                    break
            if key is None:
                return self.say(p, "You don't carry anything called '%s'." % want, "warn")
            if ITEMS[key]["kind"] == "gear":
                return self.say(p, "Your tools stay with you.", "warn")
            n = int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else 1
            n = min(n, self.count(p, key))
            self.take(p, key, n)
            self.give(target, key, n)
            self.event("%s gave %d %s to %s." % (p["name"], n, ITEMS[key]["name"], target["name"]), now)
            return
        if cmd == "/look":
            want = parts[1].lower() if len(parts) > 1 else ""
            if want not in SPRITES:
                return self.say(p, "Usage: /look boy  or  /look girl")
            p["sprite"] = want
            self.dirty = True
            return self.say(p, "You are now the farm %s." % want, "good")
        if cmd == "/hat":
            want = parts[1].lower() if len(parts) > 1 else ""
            if want in ("on", "cowboy"):
                p["hat"] = "cowboy"
            elif want in ("off", "none", "no"):
                p["hat"] = "none"
            else:
                return self.say(p, "Usage: /hat on  or  /hat off")
            self.dirty = True
            return self.say(p, "Cowboy hat %s." % ("on" if p["hat"] == "cowboy" else "off"), "good")
        if cmd == "/color":
            want = parts[1].lower() if len(parts) > 1 else ""
            if want not in PLAYER_COLORS:
                return self.say(p, "Shirt colours: " + ", ".join(PLAYER_COLORS))
            p["color"] = PLAYER_COLORS.index(want)
            self.dirty = True
            return self.say(p, "New %s shirt. Looking good!" % want, "good")
        if cmd == "/petname":
            name = "".join(ch for ch in " ".join(parts[1:]) if ch.isalnum() or ch in " -'")[:16].strip()
            if not p.get("pet") or not name:
                return self.say(p, "Usage: /petname <name> (renames the pet following you - adopt one at the clinic, or press P to call one)")
            p["pet"]["name"] = name
            p.setdefault("pets", {}).setdefault(p["pet"]["kind"], {})["name"] = name
            self.dirty = True
            return self.say(p, "Your %s is called %s now." % (pets.species(p["pet"]["kind"]).lower(), name), "good")
        if cmd == "/pets":
            return self.pets_menu(p, now)
        if cmd in ("/ledger", "/economy"):
            return self.ledger_menu(p, now)
        if cmd == "/me":
            action = " ".join(parts[1:])
            return self.event("* %s %s" % (p["name"], action), now, "chat")
        if cmd == "/help":
            return self.say(p, "Commands: /ping@all [msg], /look boy|girl, /hat on|off, /color <shirt>, /farm <name>, /give <player> <item> [n], /me <action>, /pets, /petname <name>, /ledger")
        self.say(p, "Unknown command %s. Try /help." % cmd, "warn")
