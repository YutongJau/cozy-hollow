"""Cozy Hollow - the places beyond the farm.

Every outdoor area is a grid of terrain characters (like the farm map) plus a list of buildings drawn
over '@' footprints. Areas are linked by portals: walk off a path at the map edge, through a door,
down a ladder, or take the boat or the stagecoach. world.py owns the rules; this file only lays
things out, so both clients and the server build the very same maps.

Terrain in areas (farm characters keep their meaning):
  .  grass     :  dirt path    ,  sand      =  cobblestone   H  wooden planks (bridge, pier)
  r  gravel    v  cave floor   z  desert    ~  water
  T  tree      P  pine         A  palm      K  cactus        u  bush         C  cliff      R  cave wall
  @  building  F  fountain     E  gravestone L fallen log    V  boat         Q  stagecoach
  U  ladder up D  ladder down  I  water trough   J  market stall   O  wagon
  plus the farm props: o rock, f flower bed, B barrels, c crates, h hay bale, m mailbox, l lamp post,
  b bench, w well, ! notice board, s stump, p wood pile, g signpost, # fence
"""
import random

AREA_WALK = set(".:,=Hrvz")
AREA_NAMES = {
    "farm": "the farm", "town": "Hollow Town", "forest": "Whisperwood", "beach": "Driftwood Beach",
    "mountain": "Summit Ridge", "mine1": "the Mine (level 1)", "mine2": "the Mine (level 2)", "mine3": "the Mine (level 3)",
    "island": "Palm Isle", "frontier": "Dusty Gulch",
}
TERRAIN_NAMES = {
    "=": "cobblestone", "H": "wooden planks", "r": "gravel", "v": "cave floor", "z": "desert sand",
    "P": "pine tree", "A": "palm tree", "K": "cactus", "C": "cliff", "R": "cave wall", "@": "building",
    "F": "fountain", "E": "gravestone", "L": "fallen log", "V": "boat", "Q": "stagecoach",
    "U": "ladder up", "D": "ladder down", "I": "water trough", "J": "market stall", "O": "wagon",
}
PROP_LINES = {
    "F": "The fountain burbles. Someone tossed a coin in for luck.",
    "E": "An old gravestone, mossy and kind. Fresh flowers lie at its foot.",
    "L": "A mossy fallen log. Beetles live here, very politely.",
    "I": "A water trough. The horses drink here.",
    "J": "A market stall, shuttered for now. It smells of apples.",
    "O": "A covered wagon, dusty from the trail.",
    "K": "A tall cactus. You decide not to hug it.",
    "C": "Sheer rock. Best not to climb it.",
}


class Grid:
    def __init__(self, w, h, fill="."):
        self.w, self.h = w, h
        self.g = [[fill] * w for _ in range(h)]

    def ok(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def get(self, x, y):
        return self.g[y][x] if self.ok(x, y) else "#"

    def set(self, x, y, ch, only=None):
        if self.ok(x, y) and (only is None or self.g[y][x] in only):
            self.g[y][x] = ch

    def rect(self, x0, y0, w, h, ch, only=None):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                self.set(x, y, ch, only)

    def ellipse(self, cx, cy, rx, ry, ch, only=None, rng=None, wobble=0.0):
        for y in range(self.h):
            for x in range(self.w):
                e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                if rng is not None and wobble:
                    e += (rng.random() - 0.5) * wobble
                if e <= 1.0:
                    self.set(x, y, ch, only)

    def line(self, pts, ch, width=1, only=None):
        """Axis-aligned path through the points (horizontal first, then vertical)."""
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                for k in range(width):
                    self.set(x, y0 + k, ch, only)
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for k in range(width):
                    self.set(x1 + k, y, ch, only)

    def ring(self, rng, ch="T", inner=0.55, second=0.18):
        """Trees hugging the edge of the map, like the farm."""
        W, H = self.w, self.h
        for y in range(H):
            for x in range(W):
                d = min(x, W - 1 - x, y, H - 1 - y)
                r = rng.random()
                if d == 0 or (d == 1 and r < inner) or (d == 2 and r < second):
                    self.g[y][x] = ch

    def scatter(self, rng, ch, n, only=".", box=None, gap=1):
        x0, y0, x1, y1 = box or (1, 1, self.w - 2, self.h - 2)
        placed = 0
        for _ in range(n * 30):
            if placed >= n:
                break
            x, y = rng.randint(x0, x1), rng.randint(y0, y1)
            if self.g[y][x] not in only:
                continue
            if gap and any(self.get(x + dx, y + dy) == ch for dx in range(-gap, gap + 1) for dy in range(-gap, gap + 1)):
                continue
            self.g[y][x] = ch
            placed += 1

    def rows(self):
        return ["".join(r) for r in self.g]


def building(kind, label, x, y, w, h, to=None, keeper=None):
    """A building drawn over an '@' footprint; its door is the middle tile of the bottom row."""
    return dict(kind=kind, label=label, x=x, y=y, w=w, h=h, door=(x + w // 2, y + h - 1), to=to, keeper=keeper)


def place(gr, b, front=":"):
    gr.rect(b["x"], b["y"], b["w"], b["h"], "@")
    dx, dy = b["door"]
    if gr.get(dx, dy + 1) not in AREA_WALK:
        gr.set(dx, dy + 1, front)


# --------------------------------------------------------------------------- the town
def build_town():
    W, H = 72, 44
    rng = random.Random(7101)
    gr = Grid(W, H)
    gr.ring(rng)
    B = [
        building("store", "MERCANTILE", 5, 7, 10, 6, "store"),
        building("saloon", "SALOON", 17, 7, 9, 6, "saloon"),
        building("hall", "TOWN HALL", 30, 3, 13, 10, "hall"),
        building("museum", "MUSEUM", 46, 6, 10, 7, "museum"),
        building("clinic", "CLINIC", 58, 7, 8, 6, "clinic"),
        building("smith", "BLACKSMITH", 4, 26, 8, 6, "smith"),
        building("bakery", "BAKERY", 14, 26, 8, 6, "bakery"),
        building("post", "POST OFFICE", 50, 26, 7, 6, "post"),
        building("carpenter", "CARPENTER", 59, 26, 9, 6, "carpenter"),
        building("cottage", "", 6, 34, 7, 5, None, "Old Tomas"),
        building("cottage2", "", 16, 34, 7, 5, None, "Juniper"),
        building("cottage3", "", 49, 34, 7, 5, None, "Doc Alder"),
    ]
    # streets: the shopfront street, the plaza, the main road east to the farm, the lanes
    gr.rect(4, 13, 64, 2, "=")
    gr.rect(26, 13, 21, 19, "=")
    gr.rect(2, 21, 68, 3, "=")
    gr.line([(70, 22), (71, 22)], ":")
    gr.rect(3, 32, 66, 1, ":")
    gr.rect(3, 39, 66, 1, ":")
    gr.line([(3, 32), (3, 39)], ":")
    gr.line([(68, 32), (68, 39)], ":")
    gr.line([(15, 14), (15, 21)], ":")
    gr.line([(56, 14), (56, 21)], ":")
    gr.line([(28, 0), (28, 13)], ":")                 # north to the mountain
    gr.line([(36, 32), (36, 43)], ":")                # south over the bridge to the beach
    # the river along the south with a plank bridge
    for x in range(W):
        for y in (41, 42):
            gr.set(x, y, "~")
        gr.set(x, 40, ",")
    gr.rect(35, 40, 3, 3, "H")
    gr.set(36, 43, ":")
    for x in range(W):
        if gr.get(x, 43) != ":":
            gr.set(x, 43, "T")
    # corners of the plaza rounded off, the fountain in the middle
    for (x, y) in [(26, 13), (46, 13), (26, 31), (46, 31)]:
        gr.set(x, y, ".")
    gr.rect(35, 18, 3, 2, "F")
    for b in B:
        place(gr, b, "=" if b["door"][1] + 1 in (13, 14) else ":")
    # the stagecoach stop at the west end of the main road
    gr.rect(3, 18, 3, 2, "Q")
    gr.set(7, 19, "g")
    # graveyard behind a little fence in the south-east
    for x in range(59, 69):
        gr.set(x, 34, "#")
        gr.set(x, 38, "#")
    for y in range(34, 39):
        gr.set(59, y, "#")
        gr.set(68, y, "#")
    gr.set(63, 34, ".")
    gr.rect(60, 35, 8, 3, ".")
    for x in (61, 63, 65, 67):
        gr.set(x, 36, "E")
    gr.set(62, 35, "f")
    gr.set(66, 35, "f")
    # the square: four little lawns round the fountain, crossed by the main road and a north-south walk
    for (lx, ly) in [(27, 15), (40, 15), (27, 25), (40, 25)]:
        gr.rect(lx, ly, 6, 5, ".")
    for (x, y, ch) in [(29, 16, "T"), (43, 16, "T"), (29, 28, "T"), (43, 28, "T"), (27, 15, "f"), (32, 15, "f"), (40, 15, "f"),
                       (45, 15, "f"), (27, 29, "f"), (32, 29, "f"), (40, 29, "f"), (45, 29, "f"), (31, 18, "u"), (41, 18, "u"),
                       (31, 26, "u"), (41, 26, "u"), (33, 18, "b"), (39, 18, "b"), (33, 25, "b"), (39, 25, "b"), (36, 16, "!"),
                       (35, 25, "J"), (37, 28, "J"), (27, 14, "l"), (45, 14, "l"), (27, 31, "l"), (45, 31, "l"), (34, 20, "l"), (38, 20, "l"),
                       (16, 13, "l"), (44, 13, "l"), (57, 13, "l"), (12, 21, "l"), (24, 21, "l"), (52, 21, "l"), (64, 21, "l")]:
        gr.set(x, y, ch)
    # front gardens and street trees
    for b in B:
        if b["y"] + b["h"] - 1 == 12:
            gr.set(b["x"], 13, "f") if gr.get(b["x"], 13) == "=" and b["x"] != 4 else None
    for x in range(5, 68, 6):
        for y in (24, 25):
            if gr.get(x, y) == "." and gr.get(x, y - 1) != "@":
                gr.set(x, y, "u" if (x // 6) % 2 else "f")
    for (x, y) in [(23, 35), (25, 37), (45, 35), (44, 38), (13, 16), (19, 17), (50, 17), (61, 17), (22, 29), (47, 29), (9, 2),
                   (24, 3), (52, 2), (66, 3)]:
        gr.set(x, y, "T", only=".")
    gr.scatter(rng, "f", 6, box=(2, 15, 24, 20))
    # a little park between the lanes: a gazebo-shaded picnic spot, a well, trees and beds
    for (x, y, ch) in [(30, 34, "T"), (42, 34, "T"), (27, 37, "T"), (46, 37, "T"), (33, 35, "b"), (39, 35, "b"), (31, 37, "f"),
                       (41, 37, "f"), (34, 37, "f"), (38, 37, "f"), (36, 35, "w"), (29, 36, "u"), (43, 36, "u"), (25, 34, "s")]:
        gr.set(x, y, ch, only=".")
    gr.scatter(rng, "u", 8, box=(2, 33, 70, 38))
    for b in B:
        if b["kind"].startswith("cottage"):
            gr.set(b["x"] - 1, b["y"] + b["h"] - 1, "m", only=".")
    for x in range(8, 66, 9):
        gr.set(x, 40, "o" if x % 2 else "u", only=",")
    return gr.rows(), B


# --------------------------------------------------------------------------- the beach
def build_beach():
    W, H = 64, 30
    rng = random.Random(7202)
    gr = Grid(W, H)
    import math
    for y in range(H):
        for x in range(W):
            shore = 18 + 2.0 * math.sin(x / 6.0) + 1.2 * math.sin(x / 2.7 + 1)
            dune = 6 + 1.2 * math.sin(x / 4.0 + 2)
            gr.g[y][x] = "~" if y > shore else ("," if y > dune else ".")
    for x in range(W):                                   # trees along the top
        gr.set(x, 0, "T")
        if rng.random() < 0.5:
            gr.set(x, 1, "T")
        if rng.random() < 0.15:
            gr.set(x, 2, "u", only=".")
    for y in range(H):
        gr.set(0, y, "T", only=".,")
        gr.set(W - 1, y, "T", only=".,")
    B = [
        building("fishshop", "FISH SHOP", 40, 2, 8, 5, "fishshop"),
        building("lighthouse", "LIGHTHOUSE", 5, 4, 5, 7, "lighthouse"),
    ]
    gr.line([(30, 0), (30, 9)], ":")
    gr.line([(30, 8), (63, 8)], ":")
    gr.line([(44, 7), (44, 8)], ":")
    for b in B:
        place(gr, b)
        gr.rect(b["x"], b["y"] + b["h"], b["w"], 1, ",", only=".")
    # the pier runs out over the water; the boat to Palm Isle waits at its end
    gr.rect(21, 15, 3, 12, "H")
    gr.rect(21, 27, 2, 1, "V")
    gr.set(23, 27, "~")
    gr.rect(20, 25, 1, 1, "H")
    gr.set(24, 15, "g", only=",")
    # tide pools among the rocks
    for (cx, cy) in [(12, 15), (52, 14)]:
        gr.ellipse(cx, cy, 2.2, 1.4, "~", only=",")
        for (dx, dy) in [(-3, 0), (3, -1), (2, 2), (-2, -2)]:
            gr.set(cx + dx, cy + dy, "o", only=",")
    gr.scatter(rng, "L", 4, only=",", box=(2, 8, 61, 16), gap=3)
    gr.scatter(rng, "o", 5, only=",", box=(2, 8, 61, 16), gap=2)
    gr.scatter(rng, "u", 6, only=".", box=(1, 3, 62, 7), gap=2)
    for (x, y, ch) in [(36, 9, "B"), (37, 9, "c"), (49, 8, "p"), (28, 8, "b"), (14, 10, "l"), (34, 13, "l")]:
        gr.set(x, y, ch, only=".,")
    return gr.rows(), B


# --------------------------------------------------------------------------- the forest
def build_forest():
    W, H = 70, 40
    rng = random.Random(7303)
    gr = Grid(W, H)
    # thick woods everywhere, then clearings carved out of them
    for y in range(H):
        for x in range(W):
            if rng.random() < 0.38:
                gr.g[y][x] = "T"
    for (cx, cy, rx, ry) in [(34, 9, 12, 6), (24, 20, 13, 7), (50, 25, 12, 7), (16, 32, 12, 5), (58, 9, 8, 5), (40, 33, 10, 5)]:
        gr.ellipse(cx, cy, rx, ry, ".", rng=rng, wobble=0.25)
    gr.ring(rng, inner=0.8, second=0.4)
    # a river from the north-east winding south
    x = 47.0
    for y in range(H):
        x += rng.choice((-1, 0, 0, 1)) * 0.6
        for k in (0, 1, 2):
            gr.set(int(x) + k, y, "~")
    # the path from the farm down through the woods and out west toward the beach (planks where it crosses water)
    for pts in ([(34, 0), (34, 14), (24, 14)], [(34, 14), (34, 26), (50, 26)], [(34, 26), (34, 32), (0, 32)]):
        before = [r[:] for r in gr.g]
        gr.line(pts, ":")
        for y in range(H):
            for xx in range(W):
                if before[y][xx] == "~" and gr.g[y][xx] == ":":
                    gr.g[y][xx] = "H"
    # a lily pond in the south-east clearing
    gr.ellipse(56, 30, 4.5, 2.6, "~")
    B = [building("cabin", "RANGER", 20, 9, 8, 5, "cabin")]
    for b in B:
        place(gr, b)
        gr.rect(b["x"] - 1, b["y"] + b["h"], b["w"] + 2, 1, ".", only="T")
    # the hidden grove: a ring of trees in the north-east with one gap
    gr.ellipse(61, 10, 5.5, 4, ".")
    for y in range(4, 17):
        for x in range(54, 69):
            e = ((x - 61) / 6.6) ** 2 + ((y - 10) / 5.0) ** 2
            if 1.0 < e <= 1.6:
                gr.set(x, y, "T")
    gr.set(55, 13, ".")
    gr.set(54, 14, ".")
    for (x, y) in [(60, 9), (63, 11), (59, 12)]:
        gr.set(x, y, "s")
    gr.set(61, 8, "f")
    gr.set(64, 9, "f")
    gr.scatter(rng, "L", 6, gap=3)
    gr.scatter(rng, "s", 7, gap=2)
    gr.scatter(rng, "u", 14, gap=1)
    gr.scatter(rng, "o", 5, gap=2)
    gr.scatter(rng, "f", 5, gap=2)
    for (x, y, ch) in [(26, 15, "p"), (18, 13, "B"), (32, 15, "g"), (30, 27, "b")]:
        gr.set(x, y, ch, only=".")
    gr.set(34, 0, ":")
    gr.set(0, 32, ":")
    return gr.rows(), B


# --------------------------------------------------------------------------- the mountain
def build_mountain():
    W, H = 64, 36
    rng = random.Random(7404)
    gr = Grid(W, H)
    import math
    for y in range(H):                                   # cliffs along the top with a ragged foot
        for x in range(W):
            foot = 6 + int(1.5 * math.sin(x / 3.5) + 1.2 * math.sin(x / 7.0 + 1))
            if y < foot:
                gr.g[y][x] = "C"
    gr.ring(rng, ch="P", inner=0.6, second=0.2)
    for x in range(W):
        for y in range(3):
            gr.set(x, y, "C")
    gr.ellipse(46, 20, 10, 5.2, "~", rng=rng, wobble=0.12)
    gr.ellipse(15, 22, 8, 5, "r", only=".P", rng=rng, wobble=0.3)    # the quarry
    gr.ellipse(32, 10, 7, 3, "r", only=".")
    B = [
        building("mine", "MINE", 30, 4, 5, 4, "mine1"),
        building("guild", "GUILD", 6, 8, 8, 5, "guild"),
    ]
    for b in B:
        gr.rect(b["x"] - 1, b["y"], b["w"] + 2, b["h"] + 2, ".", only="CP")
        place(gr, b)
    gr.rect(29, 4, 1, 4, "C")
    gr.rect(35, 4, 1, 4, "C")
    gr.line([(22, 35), (22, 14), (32, 14), (32, 8)], ":")
    gr.line([(0, 26), (22, 26)], ":")
    gr.line([(10, 13), (10, 18)], ":")
    gr.line([(10, 18), (22, 18)], ":")
    gr.rect(41, 27, 1, 1, ":", only=".")
    gr.rect(36, 23, 3, 1, "H", only="~.")                 # a little fishing dock on the lake
    gr.line([(22, 23), (35, 23)], ":", only=".")
    gr.scatter(rng, "P", 44, gap=1)
    gr.scatter(rng, "o", 14, only=".r", gap=2)
    gr.scatter(rng, "u", 12, gap=2)
    gr.scatter(rng, "f", 8, gap=3)
    gr.scatter(rng, "L", 3, gap=4)
    for (x, y, ch) in [(24, 15, "g"), (28, 14, "l"), (16, 14, "p"), (17, 14, "B"), (41, 13, "b")]:
        gr.set(x, y, ch, only=".r")
    gr.set(22, 35, ":")
    gr.set(0, 26, ":")
    return gr.rows(), B


# --------------------------------------------------------------------------- the mine (three cave levels)
def build_mine(level):
    W, H = 40, 26
    rng = random.Random(7500 + level)
    cells = [[rng.random() < 0.45 for _ in range(W)] for _ in range(H)]
    for _ in range(4):                                   # cellular caves
        nxt = [[False] * W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                n = sum(1 for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                        if (dx or dy) and (not (0 <= x + dx < W and 0 <= y + dy < H) or cells[y + dy][x + dx]))
                nxt[y][x] = n >= 5 or (n >= 4 and cells[y][x])
        cells = nxt
    gr = Grid(W, H, "v")
    for y in range(H):
        for x in range(W):
            if cells[y][x] or x in (0, W - 1) or y in (0, H - 1):
                gr.g[y][x] = "R"
    up, down = (4, 20), (35, 5)
    # make sure a winding tunnel joins the ladders, and clear room round both
    x, y = up
    while (x, y) != down:
        gr.rect(x, y, 2, 2, "v", only="R")
        if rng.random() < 0.6:
            x += (down[0] > x) - (down[0] < x)
        else:
            y += (down[1] > y) - (down[1] < y)
    gr.rect(up[0] - 2, up[1] - 2, 5, 4, "v", only="R")
    gr.rect(down[0] - 2, down[1] - 1, 5, 4, "v", only="R")
    for x in range(W):
        gr.set(x, 0, "R")
        gr.set(x, H - 1, "R")
    for y in range(H):
        gr.set(0, y, "R")
        gr.set(W - 1, y, "R")
    gr.set(*up, "U")
    if level < 3:
        gr.set(*down, "D")
    gr.scatter(rng, "o", 6, only="v", gap=3)
    gr.set(up[0] + 2, up[1] - 1, "l")
    gr.set(down[0] - 2, down[1] + 1, "l")
    gr.scatter(rng, "l", 3, only="v", gap=6)
    return gr.rows(), []


# --------------------------------------------------------------------------- the island
def build_island():
    W, H = 60, 34
    rng = random.Random(7606)
    gr = Grid(W, H, "~")
    gr.ellipse(30, 16, 27, 14.5, ",", rng=rng, wobble=0.12)
    gr.ellipse(31, 14, 23, 11, ".", rng=rng, wobble=0.15)
    B = [
        building("volcano", "", 35, 2, 13, 9, None),
        building("tiki", "TIKI HUT", 13, 10, 7, 5, "tiki"),
    ]
    for b in B:
        place(gr, b)
    gr.rect(28, 26, 3, 6, "H")
    gr.rect(28, 32, 2, 1, "V")
    gr.line([(29, 26), (29, 15), (16, 15)], ":", only=".,")
    gr.scatter(rng, "A", 30, only=".,", gap=2)
    gr.scatter(rng, "u", 34, only=".", gap=1)
    gr.scatter(rng, "f", 12, only=".", gap=2)
    gr.scatter(rng, "o", 5, only=",", gap=3)
    for (x, y, ch) in [(31, 25, "g"), (21, 15, "B"), (12, 15, "l")]:
        gr.set(x, y, ch, only=".,")
    return gr.rows(), B


# --------------------------------------------------------------------------- the frontier
def build_frontier():
    W, H = 64, 36
    rng = random.Random(7707)
    gr = Grid(W, H, "z")
    import math
    for y in range(H):                                   # red mesas framing the gulch
        for x in range(W):
            top = 4 + int(1.5 * math.sin(x / 5.0) + math.sin(x / 2.3))
            bot = H - 4 - int(1.5 * math.sin(x / 4.0 + 1))
            if y < top or y > bot or x < 2 + int(math.sin(y / 3.0) + 1) or x > W - 3 - int(math.sin(y / 2.5) + 1):
                gr.g[y][x] = "C"
    B = [
        building("assay", "GENERAL", 6, 10, 7, 6, "assay"),
        building("wsaloon", "SALOON", 15, 9, 9, 7, "wsaloon"),
        building("bank", "BANK", 26, 10, 7, 6, "bank"),
        building("sheriff", "SHERIFF", 35, 10, 7, 6, "sheriff"),
        building("stable", "STABLE", 45, 10, 8, 6, None, "the horses"),
    ]
    gr.rect(3, 17, 57, 2, ":")
    for b in B:
        gr.rect(b["x"] - 1, b["y"] - 1, b["w"] + 2, b["h"] + 1, "z", only="C")
        place(gr, b)
    gr.rect(2, 15, 3, 2, "Q")
    gr.set(5, 16, "g")
    # a creek where folks pan for gold, crossed by planks
    for y in range(19, H - 3):
        x = 40 + int(2 * math.sin(y / 2.0))
        gr.rect(x, y, 2, 1, "~", only="z:")
    gr.rect(38, 17, 6, 2, "H", only="~")
    # the cattle pen
    for x in range(8, 28):
        gr.set(x, 22, "#")
        gr.set(x, 29, "#")
    for y in range(22, 30):
        gr.set(8, y, "#")
        gr.set(27, y, "#")
    gr.set(17, 22, "G")
    gr.rect(9, 23, 18, 6, "z")
    for (x, y, ch) in [(10, 24, "h"), (11, 24, "h"), (25, 27, "I"), (14, 19, "I"), (31, 20, "O"), (44, 20, "B"), (45, 20, "c"),
                       (24, 16, "l"), (43, 16, "l"), (55, 21, "w"), (34, 16, "p")]:
        gr.set(x, y, ch, only="z")
    gr.scatter(rng, "K", 16, only="z", gap=3)
    gr.scatter(rng, "o", 8, only="z", gap=3)
    return gr.rows(), B


# --------------------------------------------------------------------------- registry
BUILDERS = {"town": build_town, "beach": build_beach, "forest": build_forest, "mountain": build_mountain,
            "mine1": lambda: build_mine(1), "mine2": lambda: build_mine(2), "mine3": lambda: build_mine(3),
            "island": build_island, "frontier": build_frontier}
AREAS = list(BUILDERS)
MAPS, BUILDINGS = {}, {}
for _a, _f in BUILDERS.items():
    MAPS[_a], BUILDINGS[_a] = _f()

# edge links: (area, x, y) <-> (area, x, y). Walking onto either tile carries you to the other map, one step inside.
EDGES = [
    (("farm", 0, 8), ("town", 71, 22)),
    (("farm", 31, 0), ("mountain", 22, 35)),
    (("farm", 46, 29), ("forest", 34, 0)),
    (("town", 28, 0), ("mountain", 0, 26)),
    (("town", 36, 43), ("beach", 30, 0)),
    (("beach", 63, 8), ("forest", 0, 32)),
]
# rides: face it and press E
RIDES = {
    ("beach", "V"): ("island", (29, 25), "You climb into the little boat and row out to Palm Isle..."),
    ("island", "V"): ("beach", (22, 25), "You row back to Driftwood Beach."),
    ("town", "Q"): ("frontier", (6, 17), "The stagecoach rattles west to Dusty Gulch. Yee-haw!"),
    ("frontier", "Q"): ("town", (6, 22), "The stagecoach rolls back into Hollow Town."),
}
LADDERS = {("mine1", "D"): "mine2", ("mine2", "D"): "mine3", ("mine2", "U"): "mine1", ("mine3", "U"): "mine2"}

# the people you meet indoors: name -> (sprite, shirt colour, hat)
NPCS = {
    "Bram": ("boy", "orange", "none"), "Rusty": ("boy", "red", "cowboy"), "Mayor Hazel": ("girl", "magenta", "none"),
    "Professor Fern": ("girl", "green", "none"), "Doc Alder": ("boy", "white", "none"), "Ingrid": ("girl", "red", "none"),
    "Juniper": ("girl", "yellow", "none"), "Pip": ("boy", "blue", "cowboy"), "Oakley": ("boy", "green", "cowboy"),
    "Old Tomas": ("boy", "blue", "cowboy"), "Wren": ("girl", "cyan", "none"), "Ranger Moss": ("boy", "green", "cowboy"),
    "Captain Ash": ("girl", "orange", "cowboy"), "Coco": ("girl", "pink", "none"), "Dolly": ("girl", "magenta", "cowboy"),
    "Mr. Penny": ("boy", "yellow", "none"), "Sheriff Boone": ("boy", "orange", "cowboy"), "Prospector Gus": ("boy", "white", "cowboy"),
}
# interiors of the buildings above (same characters as the farm interiors, plus n: the person who works there,
# d: display case, a: anvil, i: keg)
INTERIORS = {
    "store": ["####W####W####", "#kkkkk..kkkkk#", "#............#", "#..SSSnSSS..i#", "#............#",
              "#..rrrrrr...p#", "#............#", "######x#######"],
    "saloon": ["####W#####W#####", "#iii.SSSnSSS..F#", "#..............#", "#.tt...tt...tt.#", "#.tt...tt...tt.#",
               "#..............#", "#p....rrrr....p#", "#######x########"],
    "hall": ["#####W#####W#####", "#kk....n.....kkp#", "#...............#", "#..rrrrrrrrrrr..#", "#..rr.ttttt.rr..#",
             "#..rrrrrrrrrrr..#", "#...............#", "#p.............p#", "########x########"],
    "museum": ["####W####W####W###", "#kkkk...n....kkkk#", "#................#", "#.dd..dd..dd..dd.#", "#................#",
               "#.dd..rrrrrr..dd.#", "#p.....rrrr.....p#", "########x#########"],
    "clinic": ["####W#####W###", "#b.b.b...SSn.#", "#............#", "#p...........#", "#.....rrrr..p#",
               "######x#######"],
    "smith": ["###W######W###", "#fF..SSnSS...#", "#............#", "#.a...a....i.#", "#............#",
              "#i.........ii#", "######x#######"],
    "bakery": ["###W######W###", "#fF..SSnSSS..#", "#............#", "#.tt..tt..tt.#", "#.tt..tt..tt.#",
               "#p..........p#", "######x#######"],
    "post": ["###W#####W###", "#kk..SSnS..k#", "#...........#", "#.rrrr....i.#", "#p..........#",
             "######x######"],
    "carpenter": ["####W#####W####", "#kk...SSnSS..i#", "#.............#", "#.tttt..tttt..#", "#.............#",
                  "#ii..rrrrr...p#", "#######x#######"],
    "fishshop": ["####W####W###", "#ii..SSnSS.p#", "#...........#", "#.rrrr...tt.#", "#.rrrr...tt.#",
                 "######x######"],
    "lighthouse": ["###W###W###", "#p..n...kk#", "#.........#", "#..rrrrr..#", "#b.......p#", "#####x#####"],
    "cabin": ["###W####W###", "#fF..n...kk#", "#..........#", "#.tt..rrrr.#", "#b...rrrr.p#", "######x#####"],
    "guild": ["####W####W####", "#kk.SSnSS..kk#", "#............#", "#.dd..dd..dd.#", "#............#",
              "######x#######"],
    "tiki": ["###W###W###", "#p..SnS..p#", "#.........#", "#.rrrrr.tt#", "#i.......i#", "#####x#####"],
    "assay": ["###W####W###", "#kk.SSnS.kk#", "#..........#", "#.i..dd..i.#", "#p.........#", "######x#####"],
    "wsaloon": ["####W######W#####", "#iii..SSSnSSS..fF", "#...............#", "#.tt..tt..tt..tt#", "#.tt..tt..tt..tt#",
                "#...............#", "#p.....rrrr....p#", "########x########"],
    "bank": ["###W#####W###", "#kk.SSnSS.kk#", "#...........#", "#.rrrrrrrr..#", "#p.........p#", "######x######"],
    "sheriff": ["###W#####W###", "#kk..n....kk#", "#...........#", "#.tt....b.b.#", "#.tt.......p#", "######x######"],
}
# fix any row that lost its closing wall while typing
for _k, _rows in INTERIORS.items():
    _w = max(len(r) for r in _rows)
    INTERIORS[_k] = [r.ljust(_w, "#")[:-1] + "#" if len(r) < _w or not r.endswith("#") else r for r in _rows]
KEEPERS = {
    "store": "Bram", "saloon": "Rusty", "hall": "Mayor Hazel", "museum": "Professor Fern", "clinic": "Doc Alder",
    "smith": "Ingrid", "bakery": "Juniper", "post": "Pip", "carpenter": "Oakley", "fishshop": "Old Tomas",
    "lighthouse": "Wren", "cabin": "Ranger Moss", "guild": "Captain Ash", "tiki": "Coco", "assay": "Prospector Gus",
    "wsaloon": "Dolly", "bank": "Mr. Penny", "sheriff": "Sheriff Boone",
}
KEEPER_LINES = {
    "Bram": ["Welcome to the Mercantile! Seeds, saplings, the lot.", "Fresh stock every season. Have a look round."],
    "Rusty": ["Pull up a stool, partner. Lemonade's on the house today.", "Heard a farmer caught a sturgeon. Was it you?"],
    "Mayor Hazel": ["Hollow Town is glad to have you two. The farm's looking wonderful.", "One day we'll fill this hall for a harvest festival."],
    "Professor Fern": ["The museum is still setting up. Bring me anything curious you dig out of the mine!", "Every gem tells a story about the valley."],
    "Doc Alder": ["Eat your vegetables and drink plenty of water. Doctor's orders.", "Don't swing that pickaxe too hard down the mine, now."],
    "Ingrid": ["Bring me ore from the mine and one day I'll forge you better tools.", "Copper, iron, gold... the mountain is full of it."],
    "Juniper": ["Fresh bread every morning! The turnip loaf is my favourite.", "Your strawberries would make a lovely pie."],
    "Pip": ["Letters, parcels, the odd lost sock. Pip delivers!", "I left a seed catalogue by your shop last week. Did you find it?"],
    "Oakley": ["Need a fence mended or a shed raised? I'm your carpenter.", "Good timber comes from the Whisperwood, south of your farm."],
    "Old Tomas": ["The fish are biting off the pier today. Try the ocean!", "Rain's coming. The catfish love the rain."],
    "Wren": ["From up here you can see all the way to Palm Isle.", "The lamp keeps the boats safe. Take the little boat at the pier sometime."],
    "Ranger Moss": ["Mushrooms pop up all over the Whisperwood. There's a hidden grove to the north-east...", "Mind the river - the pike in there bite."],
    "Captain Ash": ["The mine goes deeper than anyone's mapped. Three levels so far.", "Gems sparkle in the third level. Bring a good pickaxe arm."],
    "Coco": ["Aloha! Coconuts fall all over the beach here.", "The volcano rumbles at night. Spooky, huh?"],
    "Prospector Gus": ["Gold in that creek! Cast a line, you never know what you'll pull out.", "Thar's a nugget for every patient soul."],
    "Dolly": ["Welcome to the Gilded Spur, sugar. Sarsaparilla?", "The piano's out of tune but the company's sweet."],
    "Mr. Penny": ["Your coins are safe with us. Well... safe-ish.", "Interest rates? Ha. Bring me gold nuggets instead."],
    "Sheriff Boone": ["Quiet day in Dusty Gulch. Just how I like it.", "Seen any bandits on the trail? Me neither. Keep it that way."],
}
INTERIOR_NAMES = {"n": "person", "d": "display case", "a": "anvil", "i": "keg"}
OBJECT_LINES = {
    "d": "A glass case of curious stones and old coins.", "a": "A heavy iron anvil, still warm.",
    "i": "A sturdy oak keg.",
}
# what you can find in each area: forage that sprouts on its ground, fish in its water
AREA_FORAGE = {
    "town": ([".", ","], ["dandelion", "daffodil", "leek", "hazelnut", "holly", "wild_berry"]),
    "forest": (["."], ["mushroom", "morel", "fiddlehead", "wild_berry", "hazelnut", "holly", "snow_yam", "leek"]),
    "beach": ([","], ["seashell", "clam", "coral", "sea_urchin"]),
    "mountain": ([".", "r"], ["leek", "salmonberry", "wild_berry", "mushroom", "snow_yam", "daffodil"]),
    "island": ([",", "."], ["coconut", "ginger", "seashell", "coral"]),
    "frontier": (["z"], ["cactus_fruit", "desert_sage"]),
}
AREA_FISH = {
    "town": ["chub", "bream", "carp", "sunfish", "pike", "old_boot", "seaweed"],
    "forest": ["chub", "bream", "rainbow_trout", "pike", "catfish", "old_boot", "seaweed"],
    "beach": ["sardine", "tuna", "red_snapper", "pufferfish", "octopus", "seaweed", "old_boot"],
    "mountain": ["lake_trout", "bullhead", "carp", "sturgeon", "rainbow_trout", "old_boot"],
    "island": ["blue_tang", "pufferfish", "tuna", "lionfish", "octopus", "seaweed"],
    "frontier": ["pupfish", "gold_nugget", "old_boot", "pupfish", "chub"],
}
# what the pickaxe knocks out of the rocks in each area, with weights
ORE = {
    "mountain": [("stone", 70), ("copper_ore", 25), ("quartz", 5)],
    "mine1": [("stone", 55), ("copper_ore", 35), ("quartz", 10)],
    "mine2": [("stone", 40), ("copper_ore", 20), ("iron_ore", 28), ("quartz", 7), ("amethyst", 5)],
    "mine3": [("stone", 30), ("iron_ore", 25), ("gold_ore", 25), ("amethyst", 7), ("emerald", 5), ("ruby", 4),
              ("diamond", 3), ("prismatic_shard", 1)],
}
ORE_GROUND = {"mountain": "r", "mine1": "v", "mine2": "v", "mine3": "v"}


def all_portals(farm_doors):
    """(loc, x, y) -> (loc2, x2, y2, facing) for every edge, door, interior exit and ladder."""
    out = {}

    def inward(area, x, y):
        rows = MAPS[area] if area != "farm" else None
        w, h = (len(rows[0]), len(rows)) if rows else (90, 30)
        if x == 0:
            return (x + 1, y), (1, 0)
        if x == w - 1:
            return (x - 1, y), (-1, 0)
        if y == 0:
            return (x, y + 1), (0, 1)
        return (x, y - 1), (0, -1)
    for (a, ax, ay), (b, bx, by) in EDGES:
        (tx, ty), f = inward(b, bx, by)
        out[(a, ax, ay)] = (b, tx, ty, f)
        (tx, ty), f = inward(a, ax, ay)
        out[(b, bx, by)] = (a, tx, ty, f)
    for area, blist in BUILDINGS.items():
        for bd in blist:
            if not bd["to"]:
                continue
            dx, dy = bd["door"]
            if bd["to"] in INTERIORS:
                ex = entry_of(bd["to"])
                out[(area, dx, dy)] = (bd["to"], ex[0], ex[1], (0, -1))
                for y, row in enumerate(INTERIORS[bd["to"]]):
                    for x, ch in enumerate(row):
                        if ch == "x":
                            out[(bd["to"], x, y)] = (area, dx, dy + 1, (0, 1))
            else:                                        # the mine entrance opens onto the first cave level
                dest = bd["to"]
                ux, uy = find(dest, "U")
                out[(area, dx, dy)] = (dest, ux + 1, uy, (1, 0))
                out[(dest, ux, uy)] = (area, dx, dy + 1, (0, 1))
    for (area, ch), dest in LADDERS.items():
        x, y = find(area, ch)
        tx, ty = find(dest, "U" if ch == "D" else "D")
        out[(area, x, y)] = (dest, tx + 1, ty, (1, 0))
    for name, (fx, fy) in farm_doors.items():
        pass                                             # farm doors are handled by world.py's own DOORS table
    return out


def entry_of(interior):
    rows = INTERIORS[interior]
    for y, row in enumerate(rows):
        if "x" in row:
            return (row.index("x"), y - 1)
    return (1, 1)


def find(area, ch):
    for y, row in enumerate(MAPS[area]):
        if ch in row:
            return (row.index(ch), y)
    return (1, 1)


if __name__ == "__main__":
    import sys
    for a in (sys.argv[1:] or AREAS):
        print("==", a, len(MAPS[a][0]), "x", len(MAPS[a]))
        print("\n".join(MAPS[a]))
