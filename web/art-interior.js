/* Cozy Hollow art - interiors: floor, walls, rugs and furniture for the farmhouse, shop and barn rooms (32x32).
   Draw only with px() (fillRect) and drawImage at integer coordinates; furniture sprites have transparent backgrounds
   and end with outline(canvas, OUT). Render to check:  node tools/render.js out.png 5 "interiorObj('b',0)"
   Layout notes (see INTERIORS in world.py): "bb", "SSSqSSS" and "fF" sit on adjacent tiles, so the bed and the shop
   counter are drawn edge to edge (they join seamlessly), "f"/"F" are the left/right halves of one wide hearth and
   Marigold ("q") stands behind her own counter segment so the counter reads as one long piece. */
"use strict";
(function () {
const { A, px, cached, outline, rng, hash, shade, mix, OUT, WOOD } = window.ART;

// ------------------------------------------------------------ palettes
const FLOOR = {
  house: { base: "#c69457", light: "#d6a96b", hi: "#e7c284", dark: "#a97a44", seam: "#7a5230", grain: "#b3864c", knot: "#8c5f36" },
  shop:  { base: "#c8a06a", light: "#d8b57e", hi: "#e9cd95", dark: "#a98352", seam: "#7b5b3a", grain: "#b7925f", knot: "#8f6a44" },
  barn:  { base: "#a37c3d", light: "#b6914f", hi: "#c9a763", dark: "#85632e", seam: "#5c4420", grain: "#957237", knot: "#6b4f26" },
};
const STRAW = { light: "#f2dd80", base: "#e6c95c", dark: "#c6a23a", deep: "#a3822c" };
const WALL = { base: "#6e4a2f", light: "#7d563a", hi: "#916646", dark: "#5a3a24", seam: "#412819", grain: "#5f3d26", knot: "#4a2d1c" };
const BASEB = { hi: "#c9a070", mid: "#a97c4f", dark: "#7f5633", shadow: "#3a2417" };
const CURTAIN = { base: "#d4574a", light: "#ea7d6c", dark: "#a83d33", band: "#e0b25a" };
const STONE = { mortar: "#585650", base: "#8e8c86", light: "#a6a49e", hi: "#bdbbb5", dark: "#726f69", deep: "#4f4d48" };
const BRASS = { hi: "#f7dd85", base: "#e2b64a", dark: "#a67c22" };
const HAY = ["#f6e48e", "#ecd06a", "#d9b44a", "#b8923a", "#8f6d28"];
const LEAF = { d: "#2f7a2a", m: "#4aa03c", l: "#7ccf5a", x: "#a8e07a", stem: "#3a7a30" };
const BOOKS = ["#d0473f", "#3f6fb8", "#5aa04a", "#e0b24a", "#8a5aae", "#3aa6a0", "#efe0c0", "#e07a3a"];
const IRON = { base: "#5c5c62", hi: "#8a8a92", dark: "#3e3e44" };
const WOOD_HI = "#ecc994";

// draw a small run-length bitmap: rows of chars, pal maps char -> colour, "." is transparent
function bm(g, x, y, rows, pal) {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j]; let i = 0;
    while (i < row.length) {
      const c = row[i]; if (c === ".") { i++; continue; }
      let k = i; while (k < row.length && row[k] === c) k++;
      px(g, x + i, y + j, k - i, 1, pal[c]); i = k;
    }
  }
}

// ------------------------------------------------------------ floor: plank boards (barn gets straw)
function interiorFloor(loc, v) {
  const P = FLOOR[loc] || FLOOR.house;
  return cached("ifloor:" + loc + v, A, A, (g) => {
    const r = rng(v * 7919 + (loc === "barn" ? 31 : loc === "shop" ? 17 : 3));
    px(g, 0, 0, A, A, P.base);
    for (let row = 0; row < 4; row++) {
      const y = row * 8;
      const t = r();                                   // each board has its own tint
      const body = t < 0.28 ? mix(P.base, P.light, 0.4) : t > 0.8 ? mix(P.base, P.dark, 0.35) : P.base;
      px(g, 0, y, A, 8, body);
      px(g, 0, y, A, 1, P.light);                      // lit top edge
      px(g, 0, y + 6, A, 1, P.dark);                   // shaded bottom edge
      px(g, 0, y + 7, A, 1, P.seam);                   // gap between boards
      const n = 2 + Math.floor(r() * 3);               // grain streaks
      for (let i = 0; i < n; i++) {
        const gx = Math.floor(r() * A), gl = 3 + Math.floor(r() * 9), gy = y + 2 + Math.floor(r() * 4);
        px(g, gx, gy, Math.min(gl, A - gx), 1, r() < 0.7 ? P.grain : P.hi);
      }
      const e = Math.floor(r() * A);                   // board end
      px(g, e, y, 1, 8, P.seam); if (e + 1 < A) px(g, e + 1, y + 1, 1, 5, P.light);
      if (r() < 0.6) { px(g, (e + 2) % A, y + 3, 1, 1, P.seam); px(g, (e + A - 3) % A, y + 3, 1, 1, P.seam); }   // nails
      if (r() < 0.4) {                                 // knot
        const kx = Math.floor(r() * (A - 4)), ky = y + 2 + Math.floor(r() * 3);
        px(g, kx, ky, 3, 2, P.knot); px(g, kx + 1, ky, 1, 1, P.dark); px(g, kx, ky - 1, 2, 1, P.grain); px(g, kx + 1, ky + 2, 2, 1, P.grain);
      }
    }
    if (loc === "barn") {                              // loose straw and dust
      const s = rng(v * 131 + 5);
      for (let i = 0; i < 16; i++) {
        const sx = Math.floor(s() * A), sy = Math.floor(s() * A), len = 2 + Math.floor(s() * 3), d = s();
        const col = d < 0.35 ? STRAW.base : d < 0.7 ? STRAW.light : d < 0.9 ? STRAW.dark : STRAW.deep;
        const dir = s();
        if (dir < 0.55) px(g, sx, sy, len, 1, col);
        else { const step = dir < 0.8 ? 1 : -1; for (let k = 0; k < len; k++) px(g, sx + k, sy + k * step, 1, 1, col); }
      }
      for (let i = 0; i < 3; i++) px(g, Math.floor(s() * A), Math.floor(s() * A), 1, 1, P.hi);
    }
  });
}

// ------------------------------------------------------------ walls: dark panelling, baseboard, windows
// side (optional): undefined = back wall with crown rail, chair rail and baseboard; "left" / "right" = a side wall column,
// drawn as plain full-height panelling with one corner shadow on the edge that faces into the room, so stacked tiles
// read as one tall wall instead of a pile of ledges.
function interiorWall(ch, v, loc, side) {
  return cached("iwall:" + ch + v + loc + (side ? ":" + side : ""), A, A, (g) => {
    const r = rng(v * 4099 + 11);
    px(g, 0, 0, A, A, WALL.base);
    // vertical boards of uneven width (they always add up to 32 so the tile repeats seamlessly); side walls keep one
    // fixed set of widths so the board seams line up from tile to tile, only the grain and knots change with v
    const widths = side ? [8, 9, 7, 8] : [[7, 9, 8, 8], [8, 7, 9, 8], [9, 8, 7, 8], [8, 8, 7, 9]][v % 4];
    const boards = (y0, y1, dim) => {                  // a run of boards between two rails; dim darkens the lower run
      let x = 0;
      for (let col = 0; col < 4; col++) {
        const w = widths[col], t = r();
        let body = t < 0.3 ? WALL.light : t > 0.82 ? WALL.dark : WALL.base;
        if (dim) body = shade(body, 0.9);
        px(g, x, y0, w, y1 - y0, body);
        px(g, x, y0, 1, y1 - y0, dim ? WALL.light : WALL.hi);         // lit left edge
        px(g, x + 1, y0, 1, y1 - y0, mix(body, WALL.hi, 0.35));
        px(g, x + w - 2, y0, 1, y1 - y0, WALL.dark);                  // shaded right edge
        px(g, x + w - 1, y0, 1, y1 - y0, WALL.seam);                  // seam
        const n = 2 + Math.floor(r() * 3);                           // grain streaks
        for (let i = 0; i < n; i++) {
          const gx = x + 2 + Math.floor(r() * (w - 4)), gy = y0 + Math.floor(r() * (y1 - y0 - 2)), gl = 3 + Math.floor(r() * 8);
          px(g, gx, gy, 1, Math.min(gl, y1 - gy), r() < 0.7 ? WALL.grain : mix(body, WALL.hi, 0.6));
        }
        if (r() < 0.35) {                                            // knot with a ring
          const ky = y0 + 2 + Math.floor(r() * (y1 - y0 - 5)), kx = x + 2 + Math.floor(r() * (w - 6));
          px(g, kx, ky, 3, 2, WALL.knot); px(g, kx + 1, ky, 1, 1, WALL.seam);
          px(g, kx, ky - 1, 2, 1, WALL.grain); px(g, kx + 1, ky + 2, 2, 1, WALL.grain); px(g, kx + 3, ky, 1, 2, WALL.grain);
        }
        x += w;
      }
    };
    if (side) {                                        // side wall: boards run the full height, corner shadow on the inner edge
      boards(0, A, false);
      const e = side === "left" ? A - 1 : 0, d = side === "left" ? -1 : 1;
      px(g, e + d * 2, 0, 1, A, WALL.dark); px(g, e + d, 0, 1, A, WALL.seam); px(g, e, 0, 1, A, BASEB.shadow);
    } else {
      boards(3, 15, false);                            // upper panels
      boards(17, 25, true);                            // wainscot under the chair rail
      // crown rail along the ceiling and a chair rail across the middle
      px(g, 0, 0, A, 1, BASEB.hi); px(g, 0, 1, A, 1, BASEB.mid); px(g, 0, 2, A, 1, BASEB.shadow);
      px(g, 0, 15, A, 1, BASEB.hi); px(g, 0, 16, A, 1, BASEB.dark); px(g, 0, 17, A, 1, BASEB.shadow);
      for (let x = 5 + (v % 2) * 4; x < A; x += 11) px(g, x, 1, 1, 1, BASEB.dark);
      // baseboard with nails and a floor shadow
      px(g, 0, 25, A, 1, BASEB.hi); px(g, 0, 26, A, 4, BASEB.mid); px(g, 0, 30, A, 1, BASEB.dark); px(g, 0, 31, A, 1, BASEB.shadow);
      for (let x = 3; x < A; x += 9) px(g, x, 27, 1, 1, BASEB.dark);
      px(g, 8, 28, 6, 1, mix(BASEB.mid, BASEB.hi, 0.3)); px(g, 22, 28, 5, 1, mix(BASEB.mid, BASEB.dark, 0.3));
    }
    if (ch !== "W") return;
    // window: painted frame, sky with hills, cross mullions, sill
    px(g, 4, 2, 24, 20, "#efe1bf"); px(g, 4, 2, 24, 1, "#fbf3dc"); px(g, 4, 2, 1, 20, "#fbf3dc"); px(g, 27, 3, 1, 19, "#c8b48c"); px(g, 5, 21, 23, 1, "#c8b48c");
    px(g, 6, 4, 20, 4, "#74b5e6"); px(g, 6, 8, 20, 3, "#98d0f3"); px(g, 6, 11, 20, 5, "#bde3f9"); px(g, 6, 16, 20, 4, "#d3effb");
    px(g, 6, 18, 20, 2, "#7bbd57"); px(g, 6, 17, 6, 1, "#7bbd57"); px(g, 16, 17, 10, 1, "#7bbd57"); px(g, 6, 17, 4, 1, "#96d271"); px(g, 17, 17, 6, 1, "#96d271"); px(g, 6, 19, 20, 1, "#5f9e42");
    px(g, 9, 6, 6, 2, "#ffffff"); px(g, 10, 5, 3, 1, "#ffffff"); px(g, 8, 7, 8, 1, "#eef8ff");
    px(g, 20, 5, 3, 3, "#ffe066"); px(g, 21, 6, 1, 1, "#fff4b0"); px(g, 20, 5, 1, 1, "#ffd23a"); px(g, 22, 7, 1, 1, "#ffd23a");
    px(g, 7, 5, 1, 1, "#eaf8ff");
    px(g, 15, 4, 2, 17, "#efe1bf"); px(g, 16, 4, 1, 17, "#d8c8a0"); px(g, 6, 11, 20, 2, "#efe1bf"); px(g, 6, 12, 20, 1, "#d8c8a0");
    px(g, 3, 22, 26, 1, "#fbf3dc"); px(g, 3, 23, 26, 2, "#d9c69c"); px(g, 28, 23, 1, 2, "#b8a27a"); px(g, 3, 25, 26, 1, "#4a3020");
    if (loc === "house") {                             // curtain rod and tied-back curtains
      px(g, 2, 1, 28, 1, "#6e4a2b"); px(g, 1, 0, 2, 2, "#8a5a34"); px(g, 29, 0, 2, 2, "#8a5a34"); px(g, 1, 0, 1, 1, "#a57244"); px(g, 29, 0, 1, 1, "#a57244");
      for (const sd of [0, 1]) {                       // sd 0 = left curtain, 1 = mirrored right curtain
        const m = (x, w) => sd ? A - x - w : x;
        px(g, m(2, 6), 2, 6, 11, CURTAIN.base); px(g, m(3, 1), 2, 1, 11, CURTAIN.light); px(g, m(5, 1), 2, 1, 11, CURTAIN.dark); px(g, m(7, 1), 2, 1, 11, CURTAIN.dark);
        px(g, m(3, 4), 13, 4, 2, CURTAIN.dark); px(g, m(3, 4), 13, 4, 1, CURTAIN.band);
        px(g, m(2, 5), 15, 5, 7, CURTAIN.base); px(g, m(3, 1), 15, 1, 7, CURTAIN.light); px(g, m(5, 1), 15, 1, 7, CURTAIN.dark); px(g, m(2, 5), 21, 5, 1, CURTAIN.dark);
      }
    } else {                                           // a geranium on the sill
      px(g, 13, 19, 6, 1, "#e08a4a"); px(g, 14, 20, 4, 3, "#c96a3a"); px(g, 14, 20, 1, 3, "#d97c48");
      px(g, 12, 17, 3, 2, LEAF.m); px(g, 17, 17, 3, 2, LEAF.m); px(g, 15, 18, 2, 1, LEAF.d); px(g, 12, 17, 1, 1, LEAF.l); px(g, 17, 17, 1, 1, LEAF.l);
      px(g, 12, 15, 2, 2, "#e8394a"); px(g, 18, 15, 2, 2, "#e8394a"); px(g, 15, 14, 2, 2, "#ff6a7a"); px(g, 12, 15, 1, 1, "#ff8a9a"); px(g, 15, 14, 1, 1, "#ff9aaa"); px(g, 18, 15, 1, 1, "#ff8a9a");
    }
  });
}

// ------------------------------------------------------------ rug: woven kilim runner (tiles seamlessly in any tile order)
// The game picks v per tile by hash, so every variant shares the same diamond motif on a 16px repeat and the variants
// differ only in a handful of thread flecks (stray gold threads, worn knots) scattered over the plain red field.
function interiorRug(v) {
  const R = { edge: "#7f2c35", red: "#c4494b", redD: "#b13e41", gold: "#e6b862", goldD: "#c9992f", cream: "#f1e3c6", creamD: "#dfcda6", blue: "#3f6ea9", blueD: "#355f92" };
  return cached("irug:" + v, A, A, (g) => {
    const band = (y, h, c, d) => { px(g, 0, y, A, h, c); for (let yy = y; yy < y + h; yy++) for (let x = yy & 1; x < A; x += 2) px(g, x, yy, 1, 1, d); };
    const gold = (y) => { px(g, 0, y, A, 1, R.gold); for (let x = 1; x < A; x += 3) px(g, x, y, 1, 1, R.goldD); };
    px(g, 0, 0, A, 1, R.edge); band(1, 3, R.red, R.redD); gold(4); band(5, 2, R.cream, R.creamD); band(7, 7, R.red, R.redD);
    gold(14); band(15, 2, R.blue, R.blueD); gold(17); band(18, 7, R.red, R.redD); band(25, 2, R.cream, R.creamD); gold(27); band(28, 3, R.red, R.redD); px(g, 0, 31, A, 1, R.edge);
    const motif = (cy) => {
      for (const cx of [8, 24]) {
        for (let dy = -3; dy <= 3; dy++) { const hw = 3 - Math.abs(dy); px(g, cx - hw, cy + dy, hw * 2 + 1, 1, R.cream); }
        px(g, cx - 1, cy, 3, 1, R.gold); px(g, cx, cy - 1, 1, 3, R.gold); px(g, cx, cy, 1, 1, R.edge);
      }
    };
    motif(10); motif(21);
    // thread flecks, only on the plain red field between the diamonds: [y0, y1, x0, x1] spans
    const spans = [[1, 3, 0, 31], [28, 30, 0, 31], [7, 13, 0, 4], [7, 13, 12, 20], [7, 13, 28, 31], [18, 24, 0, 4], [18, 24, 12, 20], [18, 24, 28, 31]];
    const r = rng(v * 613 + 29);
    for (let i = 0; i < 11; i++) {
      const s = spans[Math.floor(r() * spans.length)], t = r();
      const fy = s[0] + Math.floor(r() * (s[1] - s[0] + 1)), fx = s[2] + Math.floor(r() * (s[3] - s[2] + 1));
      px(g, fx, fy, t < 0.45 ? 1 : 2, 1, t < 0.3 ? mix(R.red, R.gold, 0.5) : t < 0.6 ? R.edge : mix(R.red, R.cream, 0.4));
    }
  });
}

// ------------------------------------------------------------ shared pieces
function drawCounter(g) {                              // full-width shop counter (joins with its neighbours)
  px(g, 0, 17, A, 1, WOOD_HI); px(g, 0, 18, A, 3, WOOD.light);
  px(g, 3, 19, 8, 1, WOOD.mid); px(g, 17, 20, 10, 1, WOOD.mid); px(g, 13, 18, 5, 1, WOOD.mid);
  px(g, 0, 21, A, 1, WOOD.mid); px(g, 0, 22, A, 7, WOOD.mid); px(g, 0, 22, A, 1, mix(WOOD.mid, WOOD.light, 0.4));
  px(g, 3, 23, 26, 5, WOOD.dark); px(g, 4, 24, 24, 3, shade(WOOD.mid, 0.92)); px(g, 4, 24, 24, 1, WOOD.light); px(g, 4, 24, 1, 3, WOOD.light); px(g, 10, 25, 5, 1, WOOD.dark); px(g, 19, 26, 6, 1, WOOD.dark);
  px(g, 0, 29, A, 2, WOOD.deep); px(g, 0, 29, A, 1, WOOD.dark);
}
function drawJar(g, x, y, fill, fillD, lid) {          // 6 wide, 11 tall
  px(g, x, y + 2, 6, 9, fill); px(g, x + 5, y + 3, 1, 8, fillD); px(g, x, y + 10, 6, 1, fillD);
  px(g, x + 1, y + 3, 1, 2, mix(fill, "#ffffff", 0.5));   // glass highlight stops a row above the label so they never merge
  px(g, x, y, 6, 2, lid); px(g, x, y, 6, 1, shade(lid, 1.15)); px(g, x + 5, y + 1, 1, 1, shade(lid, 0.75));
  px(g, x + 1, y + 6, 4, 3, "#f1e3c6"); px(g, x + 4, y + 7, 1, 2, "#dfcda6"); px(g, x + 1, y + 7, 2, 1, fillD);   // print sits left of the label's shaded edge so the two never join into a glyph
}
function leaf(g, x, y, w, h) {                         // rounded leaf lobe, lit from the top-left
  px(g, x + 1, y, w - 2, h, LEAF.m); px(g, x, y + 1, w, h - 2, LEAF.m);
  px(g, x + 1, y, w - 3, 1, LEAF.l); px(g, x, y + 1, 1, h - 3, LEAF.l); px(g, x + 1, y + 1, 1, 1, LEAF.x);
  px(g, x + 1, y + h - 1, w - 2, 1, LEAF.d); px(g, x + w - 1, y + 1, 1, h - 2, LEAF.d);
  px(g, x + 2, y + Math.floor(h / 2), w - 4, 1, LEAF.d);
}
const FIRE = [[
  "...........r............",
  "..........rr............",
  "..........ror...........",
  "....r.....ror.......r...",
  "...rr....royor.....rr...",
  "...rro...royor....rro...",
  "..rroo..rroyyor...rroo..",
  "..rroor.rooyyor..rroor..",
  ".rroooorrooyyyorrrooor..",
  ".rroyoooooyywyoooooyor..",
  ".rooyyoooyywwyyoooyyor..",
  ".royyyyyyoywwwyoyyyyyr..",
], [
  "........................",
  "............r...........",
  "...........rr...........",
  "...r.......ror..........",
  "..rr......royor.....r...",
  "..rro.....royor....rr...",
  "..rroo...rroyyor...rro..",
  ".rrooo..rrooyyor..rroo..",
  ".rroooorroooyyyorrrooo..",
  ".rroyooooooyywyoooyyor..",
  ".rooyyooooyywwyyooyyor..",
  ".royyyyyyyoywwwyyyyyyr..",
]];
const FIRE_PAL = { r: "#e0402a", o: "#f28c28", y: "#ffcf5a", w: "#fff2a8" };
function drawFireplace(g, ox, frame) {                 // 64 wide stone hearth drawn at x offset ox (0 = left half, -32 = right half)
  const X = (x) => x + ox;
  // mantel shelf with candle, books and a picture
  px(g, X(1), 6, 62, 1, WOOD_HI); px(g, X(1), 7, 62, 2, WOOD.light); px(g, X(1), 9, 62, 1, WOOD.mid); px(g, X(1), 10, 62, 1, WOOD.dark);
  px(g, X(3), 11, 4, 2, WOOD.dark); px(g, X(57), 11, 4, 2, WOOD.dark); px(g, X(3), 11, 1, 2, WOOD.mid); px(g, X(57), 11, 1, 2, WOOD.mid);
  px(g, X(8), 5, 5, 1, BRASS.base); px(g, X(9), 4, 3, 1, BRASS.hi); px(g, X(9), 2, 3, 2, "#f4efe0"); px(g, X(11), 2, 1, 2, "#d8d2c4"); px(g, X(9), 2, 1, 1, "#fbf8f0");
  // candle flame flickers: frame 0 is a tall flame with an orange base, frame 1 a short bright lick
  if (frame) px(g, X(10), 1, 1, 1, "#fff2a8"); else { px(g, X(10), 1, 1, 1, "#f28c28"); px(g, X(10), 0, 1, 1, "#ffcf5a"); }
  px(g, X(20), 4, 8, 2, "#3f6fb8"); px(g, X(20), 4, 8, 1, "#5f8fd8"); px(g, X(21), 2, 7, 2, "#d0473f"); px(g, X(21), 2, 7, 1, "#e86a60"); px(g, X(27), 2, 1, 2, "#a8362e");
  px(g, X(37), 2, 3, 4, "#7fbfd9"); px(g, X(37), 2, 1, 4, "#b8e2f2"); px(g, X(36), 0, 5, 2, "#e8394a"); px(g, X(38), 1, 1, 1, "#ffe066");
  px(g, X(46), 0, 10, 6, WOOD.dark); px(g, X(46), 0, 10, 1, WOOD.mid); px(g, X(47), 1, 8, 4, "#9fd4f2"); px(g, X(47), 3, 8, 2, "#63bd52"); px(g, X(52), 1, 2, 1, "#ffe066");
  // stone body in staggered courses
  px(g, X(3), 11, 58, 16, STONE.mortar);
  const r = rng(4242);
  for (let c = 0; c < 4; c++) {
    const y = 11 + c * 4; let x = 3 - (c % 2 ? 5 : 0);
    while (x < 61) {
      const w = 7 + Math.floor(r() * 4), x0 = Math.max(3, x), x1 = Math.min(61, x + w), t = r();
      if (x1 > x0) {
        px(g, X(x0), y, x1 - x0, 3, t < 0.25 ? STONE.light : t < 0.85 ? STONE.base : STONE.dark);
        px(g, X(x0), y, x1 - x0, 1, STONE.hi); px(g, X(x1 - 1), y + 1, 1, 2, STONE.dark); px(g, X(x0), y + 2, x1 - x0, 1, STONE.dark);
        if (r() < 0.4) px(g, X(x0 + 2), y + 1, 2, 1, t < 0.25 ? STONE.hi : STONE.light);
      }
      x += w + 1;
    }
  }
  // firebox with arched top
  px(g, X(20), 13, 24, 1, "#1a1310"); px(g, X(18), 14, 28, 1, "#1a1310"); px(g, X(17), 15, 30, 12, "#1a1310");
  px(g, X(22), 16, 20, 8, frame ? "#2e1d14" : "#2a1a12");
  px(g, X(24), 21, 16, 3, "#6b4a2b"); px(g, X(24), 21, 16, 1, "#8a6a3a"); px(g, X(24), 21, 2, 3, "#a5744a"); px(g, X(38), 21, 2, 3, "#a5744a");
  bm(g, X(20), 13, FIRE[frame ? 1 : 0], FIRE_PAL);
  px(g, X(21), 24, 22, 2, "#6b4a2b"); px(g, X(21), 24, 22, 1, "#8a6a3a"); px(g, X(21), 24, 2, 2, "#a5744a"); px(g, X(41), 24, 2, 2, "#a5744a"); px(g, X(28), 25, 8, 1, "#4e3420");
  for (let i = 0; i < 5; i++) px(g, X(23 + i * 4 + (frame ? 1 : 0)), 26, 2, 1, (i + (frame ? 1 : 0)) % 2 ? "#ff8c3a" : "#ffcf5a");
  // hearth stone
  px(g, X(1), 27, 62, 1, STONE.hi); px(g, X(1), 28, 62, 2, STONE.base); px(g, X(1), 30, 62, 1, STONE.deep);
  for (let x = 11; x < 62; x += 10) px(g, X(x), 28, 1, 2, STONE.mortar);
}

// ------------------------------------------------------------ furniture (transparent, outlined)
// v (optional integer, default 0) varies a tile inside a run of identical characters: the shop counter "S" shows a
// different stock item for each v % 6, the table "t" carries a mug when v is even and an apple when v is odd. Neither
// piece animates, so when v is omitted the frame number stands in for it (lets render.js page through the stock).
function interiorObj(ch, frame, v) {
  v = v === undefined ? frame | 0 : v | 0;
  return cached("iobj:" + ch + frame + (v ? ":" + v : ""), A, A, (g, c) => {
    if (ch === "x") {                                  // woven door mat
      px(g, 3, 9, 26, 17, "#7d5c30"); px(g, 3, 9, 26, 1, "#9a7640"); px(g, 3, 25, 26, 1, "#5c4222"); px(g, 4, 10, 24, 15, "#a8843f");
      px(g, 5, 11, 22, 13, "#c9a45c");
      for (let y = 11; y < 24; y++) for (let x = 5; x < 27; x++) if (((x >> 1) + y) % 2 === 0) px(g, x, y, 1, 1, "#b9944c");
      for (let dy = -3; dy <= 3; dy++) { const hw = 3 - Math.abs(dy); px(g, 16 - hw, 17 + dy, hw * 2 + 1, 1, "#ecd9a8"); }
      px(g, 16, 17, 1, 1, "#b0463e"); px(g, 15, 17, 1, 1, "#e6c27a"); px(g, 17, 17, 1, 1, "#e6c27a");
      for (const cx of [9, 23]) { px(g, cx - 1, 17, 3, 1, "#ecd9a8"); px(g, cx, 16, 1, 3, "#ecd9a8"); }
    } else if (ch === "b") {                           // twin bed: headboard, pillow, turned sheet, patchwork quilt, footboard
      // a 1px margin at x = 0 and x = 31 keeps the outline on both sides, so "bb" reads as two beds side by side
      px(g, 1, 1, 30, 2, WOOD.light); px(g, 1, 1, 30, 1, WOOD_HI); px(g, 1, 3, 30, 4, WOOD.mid); px(g, 1, 7, 30, 1, WOOD.dark);
      for (let x = 3; x < 30; x += 6) px(g, x, 3, 1, 4, WOOD.dark);
      px(g, 1, 2, 1, 6, WOOD_HI); px(g, 30, 3, 1, 5, WOOD.dark);
      px(g, 1, 8, 30, 5, "#efe6d2");
      px(g, 4, 6, 24, 7, "#f8f5ee"); px(g, 4, 6, 24, 1, "#ffffff"); px(g, 4, 6, 1, 7, "#ffffff"); px(g, 27, 7, 1, 6, "#d9d3c5"); px(g, 5, 12, 23, 1, "#d9d3c5"); px(g, 12, 10, 8, 1, "#ece7db"); px(g, 14, 9, 4, 1, "#ece7db"); px(g, 6, 7, 6, 1, "#ffffff");
      px(g, 1, 13, 30, 3, "#f3ead6"); px(g, 1, 13, 30, 1, "#fbf6ea"); px(g, 1, 15, 30, 1, "#d9ccb0");
      const QA = "#d3524c", QB = "#e58a7a", QS = "#efc27a";
      for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
        const x = 1 + i * 6, y = 16 + j * 6, col = (i + j) % 2 ? QB : QA;
        px(g, x, y, 6, 6, col); px(g, x + 2, y + 1, 1, 3, QS); px(g, x + 1, y + 2, 3, 1, QS);
        if (col === QA) { px(g, x + 1, y + 1, 1, 1, "#e0665f"); px(g, x + 4, y + 4, 1, 1, "#b8403c"); } else { px(g, x + 1, y + 1, 1, 1, "#f2a898"); px(g, x + 4, y + 4, 1, 1, "#cf7263"); }
      }
      for (let x = 6; x < 30; x += 6) px(g, x, 16, 1, 12, QS); px(g, 1, 21, 30, 1, QS);
      px(g, 1, 27, 30, 1, "#a83a37");
      px(g, 1, 28, 30, 1, WOOD.light); px(g, 1, 29, 30, 1, WOOD.mid); px(g, 1, 30, 30, 1, WOOD.dark);
    } else if (ch === "t") {                           // farmhouse table: the top runs edge to edge so "tt" joins into one long table
      px(g, 0, 9, A, 7, WOOD.light); px(g, 0, 9, A, 1, WOOD_HI);
      px(g, 4, 11, 9, 1, WOOD.mid); px(g, 17, 13, 10, 1, WOOD.mid); px(g, 7, 14, 6, 1, WOOD.mid); px(g, 20, 11, 7, 1, WOOD.mid);
      px(g, 0, 16, A, 1, WOOD.mid); px(g, 0, 17, A, 1, WOOD.dark);
      // legs sit flush on the outer columns; where two tiles meet they merge into one thick centre post
      px(g, 0, 18, 3, 11, WOOD.dark); px(g, 0, 18, 1, 11, WOOD.mid); px(g, 29, 18, 3, 11, WOOD.dark); px(g, 29, 18, 1, 11, WOOD.mid);
      px(g, 3, 24, 26, 2, WOOD.mid); px(g, 3, 25, 26, 1, WOOD.dark);
      if (v % 2 === 0) {                               // mug of coffee
        px(g, 12, 3, 5, 6, "#f4f1ea"); px(g, 16, 4, 1, 5, "#d8d2c4"); px(g, 12, 2, 5, 1, "#ffffff"); px(g, 13, 3, 3, 1, "#6b3f24"); px(g, 12, 6, 5, 1, "#4a7fe0"); px(g, 16, 6, 1, 1, "#3560b0");
        px(g, 17, 4, 2, 1, "#f4f1ea"); px(g, 18, 4, 1, 3, "#f4f1ea"); px(g, 17, 6, 2, 1, "#f4f1ea");
      } else {                                         // red apple
        px(g, 13, 4, 6, 5, "#e0392e"); px(g, 14, 3, 4, 1, "#e0392e"); px(g, 14, 9, 4, 1, "#a8261f"); px(g, 18, 5, 1, 4, "#a8261f"); px(g, 14, 4, 2, 1, "#ff8a7a"); px(g, 14, 5, 1, 1, "#ff8a7a");
        px(g, 15, 2, 1, 2, "#5a3a22"); px(g, 16, 2, 2, 1, "#63bd52");
      }
    } else if (ch === "c") {                           // banded treasure chest
      px(g, 4, 13, 24, 16, WOOD.mid); px(g, 4, 13, 2, 16, WOOD.light); px(g, 26, 13, 2, 16, WOOD.dark); px(g, 4, 13, 24, 1, WOOD.deep);
      px(g, 4, 19, 24, 1, WOOD.dark); px(g, 6, 20, 20, 1, mix(WOOD.mid, WOOD.light, 0.5)); px(g, 4, 24, 24, 1, WOOD.dark); px(g, 6, 25, 20, 1, mix(WOOD.mid, WOOD.light, 0.5));
      px(g, 12, 16, 6, 1, WOOD.dark); px(g, 10, 22, 4, 1, WOOD.dark); px(g, 4, 27, 24, 2, WOOD.deep);
      px(g, 9, 5, 14, 1, WOOD.light); px(g, 10, 5, 8, 1, WOOD_HI); px(g, 6, 6, 20, 1, WOOD.light); px(g, 7, 6, 12, 1, WOOD_HI); px(g, 5, 7, 22, 1, WOOD.light); px(g, 4, 8, 24, 3, WOOD.mid);
      px(g, 4, 8, 2, 3, WOOD.light); px(g, 6, 8, 20, 1, mix(WOOD.mid, WOOD.light, 0.5)); px(g, 26, 8, 2, 3, WOOD.dark); px(g, 25, 6, 1, 2, WOOD.dark); px(g, 22, 5, 1, 1, WOOD.mid); px(g, 4, 10, 24, 1, WOOD.dark);
      px(g, 4, 11, 24, 2, BRASS.base); px(g, 4, 11, 24, 1, BRASS.hi); px(g, 27, 11, 1, 2, BRASS.dark); px(g, 4, 12, 24, 1, mix(BRASS.base, BRASS.dark, 0.4));
      for (const bx of [8, 21]) { px(g, bx, 6, 3, 23, BRASS.base); px(g, bx, 6, 1, 23, BRASS.hi); px(g, bx + 2, 6, 1, 23, BRASS.dark); px(g, bx + 1, 5, 1, 1, BRASS.base); px(g, bx, 5, 1, 1, BRASS.hi); for (const ry of [8, 16, 21, 26]) px(g, bx + 1, ry, 1, 1, BRASS.dark); }
      px(g, 13, 10, 6, 8, BRASS.base); px(g, 13, 10, 6, 1, BRASS.hi); px(g, 13, 10, 1, 8, BRASS.hi); px(g, 18, 11, 1, 7, BRASS.dark); px(g, 14, 17, 5, 1, BRASS.dark);
      px(g, 15, 12, 2, 2, OUT); px(g, 15, 14, 2, 1, OUT); px(g, 15, 15, 1, 1, OUT);
    } else if (ch === "f") { drawFireplace(g, 0, frame); }
    else if (ch === "F") { drawFireplace(g, -32, frame); }
    else if (ch === "k") {                             // bookshelf
      px(g, 1, 1, 30, 30, WOOD.dark); px(g, 1, 1, 30, 1, WOOD.light); px(g, 1, 2, 30, 2, WOOD.mid); px(g, 1, 2, 1, 28, WOOD.mid); px(g, 30, 2, 1, 28, WOOD.deep); px(g, 1, 29, 30, 1, WOOD.mid); px(g, 1, 30, 30, 1, WOOD.deep);
      px(g, 3, 4, 26, 25, "#4a2e1c");
      for (const sy of [11, 20]) { px(g, 3, sy, 26, 1, WOOD.mid); px(g, 3, sy + 1, 26, 1, WOOD.dark); px(g, 3, sy + 2, 26, 1, "#3a2315"); }
      const r = rng(97);
      const book = (x, yb, w, h, col) => { px(g, x, yb - h + 1, w, h, col); px(g, x, yb - h + 1, 1, h, shade(col, 1.25)); if (w > 2) px(g, x + w - 1, yb - h + 1, 1, h, shade(col, 0.72)); px(g, x, yb - h + 1, w, 1, shade(col, 1.12)); px(g, x + (w > 2 ? 1 : 0), yb - h + 3, 1, 1, "#f1e3c6"); };
      const shelfBooks = (yb, x, xEnd) => { while (x < xEnd) { const w = 2 + Math.floor(r() * 2); if (x + w > xEnd) break; book(x, yb, w, 5 + Math.floor(r() * 3), BOOKS[Math.floor(r() * BOOKS.length)]); x += w; if (r() < 0.12) x += 1; } };
      shelfBooks(10, 3, 29);
      shelfBooks(19, 3, 21); px(g, 23, 15, 4, 5, "#9fd4f2"); px(g, 23, 15, 1, 5, "#cfeafa"); px(g, 26, 16, 1, 4, "#6fa8c8"); px(g, 23, 14, 4, 1, "#e0b24a"); px(g, 24, 17, 2, 2, "#e8394a");
      shelfBooks(28, 3, 20); book(20, 28, 8, 2, "#3f6fb8"); book(21, 26, 7, 2, "#d0473f"); book(20, 24, 7, 2, "#5aa04a");
    } else if (ch === "p") {                           // potted plant
      px(g, 11, 19, 10, 1, "#4e3220");
      px(g, 9, 20, 14, 3, "#e08a4a"); px(g, 9, 20, 14, 1, "#f2a866"); px(g, 22, 21, 1, 2, "#b8622f"); px(g, 9, 22, 14, 1, "#c96a3a");
      px(g, 10, 23, 12, 6, "#c96a3a"); px(g, 10, 23, 1, 6, "#d97c48"); px(g, 20, 23, 2, 6, "#a3502a"); px(g, 11, 29, 10, 1, "#8f4525"); px(g, 12, 25, 8, 1, "#b85c30");
      px(g, 15, 9, 2, 11, LEAF.stem); px(g, 11, 12, 4, 1, LEAF.stem); px(g, 17, 10, 5, 1, LEAF.stem); px(g, 12, 16, 3, 1, LEAF.stem); px(g, 17, 15, 3, 1, LEAF.stem);
      leaf(g, 4, 9, 9, 5); leaf(g, 19, 6, 9, 5); leaf(g, 11, 2, 9, 5); leaf(g, 7, 14, 7, 4); leaf(g, 18, 13, 8, 4); leaf(g, 13, 7, 6, 4);
      px(g, 24, 4, 1, 3, "#ff7eb6"); px(g, 23, 5, 3, 1, "#ff7eb6"); px(g, 24, 5, 1, 1, "#ffe066");
      px(g, 5, 16, 1, 2, "#ff7eb6"); px(g, 4, 17, 3, 1, "#ff7eb6"); px(g, 5, 17, 1, 1, "#ffe066");
    } else if (ch === "S") {                           // shop counter; v % 6 picks what is stocked on this segment
      drawCounter(g);
      const stock = v % 6;
      if (stock === 0) {                               // crate of strawberries with jars of jam and honey
        px(g, 3, 10, 12, 10, WOOD.mid); px(g, 3, 10, 12, 1, WOOD.light); px(g, 3, 10, 1, 10, WOOD.light); px(g, 14, 11, 1, 9, WOOD.dark); px(g, 3, 15, 12, 1, WOOD.dark); px(g, 3, 19, 12, 1, WOOD.deep); px(g, 4, 16, 10, 1, mix(WOOD.mid, WOOD.light, 0.5));
        px(g, 4, 11, 10, 3, "#5a3a22");
        for (const [sx, sy] of [[5, 11], [8, 12], [11, 11], [6, 13]]) { px(g, sx, sy, 2, 2, "#e8394a"); px(g, sx, sy, 1, 1, "#ff8a9a"); px(g, sx + (sx % 2), sy - 1, 1, 1, "#63bd52"); }
        drawJar(g, 17, 9, "#c92a3a", "#8f1f2b", "#f2c744"); drawJar(g, 24, 9, "#f2a53a", "#c47d22", "#efe0c0");
      } else if (stock === 1) {                        // a row of preserves: jam, honey, pickles
        drawJar(g, 5, 9, "#c92a3a", "#8f1f2b", "#f2c744"); drawJar(g, 13, 9, "#f2a53a", "#c47d22", "#efe0c0"); drawJar(g, 21, 9, "#7fb143", "#4f7f27", WOOD.mid);
        px(g, 22, 12, 1, 1, "#4f7f27"); px(g, 24, 13, 1, 2, "#4f7f27"); px(g, 23, 15, 1, 1, "#4f7f27");
      } else if (stock === 2) {                        // brass balance scale, a turnip weighing down the left pan
        px(g, 11, 17, 10, 2, BRASS.base); px(g, 11, 17, 10, 1, BRASS.hi); px(g, 12, 19, 8, 1, BRASS.dark); px(g, 20, 18, 1, 1, BRASS.dark);
        px(g, 15, 9, 2, 8, BRASS.base); px(g, 15, 9, 1, 8, BRASS.hi); px(g, 16, 9, 1, 8, BRASS.dark);
        px(g, 7, 8, 18, 1, BRASS.base); px(g, 7, 8, 9, 1, BRASS.hi); px(g, 24, 8, 1, 1, BRASS.dark); px(g, 15, 7, 2, 1, BRASS.hi); px(g, 16, 7, 1, 1, BRASS.base);
        px(g, 9, 9, 1, 4, BRASS.dark); px(g, 22, 9, 1, 3, BRASS.dark);
        px(g, 6, 13, 7, 2, BRASS.base); px(g, 6, 13, 7, 1, BRASS.hi); px(g, 12, 14, 1, 1, BRASS.dark); px(g, 7, 15, 5, 1, BRASS.dark);
        px(g, 19, 12, 7, 2, BRASS.base); px(g, 19, 12, 7, 1, BRASS.hi); px(g, 25, 13, 1, 1, BRASS.dark); px(g, 20, 14, 5, 1, BRASS.dark);
        px(g, 10, 11, 3, 2, "#f3e9f7"); px(g, 12, 12, 1, 1, "#d9cde6"); px(g, 11, 10, 1, 1, "#c39be0"); px(g, 11, 9, 1, 1, LEAF.m); px(g, 12, 9, 1, 1, LEAF.l);
        px(g, 21, 10, 3, 2, IRON.base); px(g, 21, 10, 1, 2, IRON.hi); px(g, 22, 9, 1, 1, IRON.dark);
      } else if (stock === 3) {                        // wicker basket heaped with turnips
        const turnip = (x, y) => {
          px(g, x + 1, y, 2, 1, "#c39be0"); px(g, x, y + 1, 4, 3, "#f3e9f7"); px(g, x + 3, y + 1, 1, 3, "#d9cde6"); px(g, x + 1, y + 4, 2, 1, "#d9cde6"); px(g, x, y + 1, 1, 1, "#ffffff");
          px(g, x + 1, y - 1, 1, 1, LEAF.m); px(g, x + 2, y - 2, 1, 2, LEAF.l); px(g, x + 3, y - 1, 1, 1, LEAF.m);
        };
        turnip(8, 10); turnip(19, 10); turnip(13, 8);
        px(g, 7, 13, 18, 7, "#b8924c"); px(g, 7, 13, 18, 1, "#e0c078"); px(g, 7, 14, 1, 5, "#d4b06a"); px(g, 24, 14, 1, 5, "#8f6d38"); px(g, 7, 19, 18, 1, "#7d5c30");
        for (let y = 14; y < 19; y++) for (let x = 8 + (y & 1); x < 24; x += 2) px(g, x, y, 1, 1, y & 1 ? "#a8843f" : "#c9a45c");
        px(g, 7, 16, 18, 1, "#8f6d38"); px(g, 8, 17, 16, 1, "#d4b06a");
      } else if (stock === 4) {                        // display box of seed packets
        const packet = (x, top, col) => {
          px(g, x, 7, 4, 8, "#f1e3c6"); px(g, x + 3, 8, 1, 7, "#dfcda6"); px(g, x, 7, 4, 2, top); px(g, x, 7, 1, 1, shade(top, 1.2));
          px(g, x + 1, 10, 2, 2, col); px(g, x + 1, 10, 1, 1, shade(col, 1.25)); px(g, x + 1, 13, 2, 1, "#c9b48c");
        };
        packet(7, "#d0473f", "#e8442e"); packet(12, "#e0b24a", "#f2d15a"); packet(17, "#5aa04a", "#7cc95a"); packet(22, "#3f6fb8", "#4a63c9");
        px(g, 5, 14, 22, 6, WOOD.mid); px(g, 5, 14, 22, 1, WOOD.light); px(g, 5, 14, 1, 6, WOOD.light); px(g, 26, 15, 1, 5, WOOD.dark); px(g, 5, 19, 22, 1, WOOD.deep);
        px(g, 8, 16, 6, 1, WOOD.dark); px(g, 18, 17, 7, 1, WOOD.dark); px(g, 6, 13, 20, 1, "#5a3a22");
      } else {                                         // bushy potted herb (basil) in a terracotta pot
        px(g, 16, 4, 1, 9, LEAF.stem); px(g, 12, 8, 4, 1, LEAF.stem); px(g, 17, 7, 4, 1, LEAF.stem); px(g, 13, 11, 3, 1, LEAF.stem); px(g, 17, 10, 3, 1, LEAF.stem);
        leaf(g, 8, 6, 6, 4); leaf(g, 19, 5, 6, 4); leaf(g, 13, 2, 6, 4); leaf(g, 10, 9, 5, 3); leaf(g, 18, 9, 5, 3); leaf(g, 14, 6, 5, 3);
        px(g, 21, 3, 1, 1, "#ffffff"); px(g, 20, 4, 3, 1, "#ffffff"); px(g, 21, 4, 1, 1, "#ffe066");
        px(g, 10, 12, 13, 2, "#e08a4a"); px(g, 10, 12, 13, 1, "#f2a866"); px(g, 22, 13, 1, 1, "#b8622f");
        px(g, 11, 14, 11, 6, "#c96a3a"); px(g, 11, 14, 1, 6, "#d97c48"); px(g, 20, 14, 2, 6, "#a3502a"); px(g, 12, 19, 9, 1, "#8f4525"); px(g, 13, 16, 7, 1, "#b85c30");
      }
    } else if (ch === "q") {                           // Marigold the shopkeeper, behind her counter
      const HAIR = "#9c5a2c", HAIR_L = "#c07a42", HAIR_X = "#dfa066", SKIN = "#f4c9a0", SKIN_S = "#d9a678", EYE = "#2a1f1a", EYE_SOFT = "#4a3a32", BL = "#f6e9d4", BL_S = "#dcc9ad", AP = "#5ea83c", AP_L = "#7ccf5a", AP_D = "#3f8a2a";
      px(g, 13, 0, 6, 1, HAIR); px(g, 12, 1, 8, 1, HAIR); px(g, 14, 0, 2, 1, HAIR_L); px(g, 15, 0, 1, 1, HAIR_X);
      px(g, 10, 2, 12, 1, HAIR); px(g, 9, 3, 14, 3, HAIR); px(g, 11, 3, 3, 1, HAIR_L); px(g, 11, 2, 1, 1, HAIR_L); px(g, 12, 3, 1, 1, HAIR_X);
      px(g, 15, 2, 2, 1, HAIR_L); px(g, 16, 2, 1, 1, HAIR_X); px(g, 14, 4, 1, 1, HAIR_L);   // strand highlights, the farmer way
      px(g, 10, 5, 12, 8, SKIN); px(g, 21, 6, 1, 7, SKIN_S); px(g, 11, 12, 10, 1, SKIN_S); px(g, 10, 12, 1, 1, SKIN_S);
      px(g, 9, 5, 1, 6, HAIR); px(g, 22, 5, 1, 6, HAIR); px(g, 10, 5, 12, 1, HAIR); px(g, 10, 6, 2, 1, HAIR); px(g, 20, 6, 2, 1, HAIR); px(g, 9, 6, 1, 2, HAIR_L);
      // eyes in the farmer style: 2x3 dark with a softer bottom pixel, no white glint
      px(g, 12, 6, 2, 3, EYE); px(g, 13, 8, 1, 1, EYE_SOFT); px(g, 18, 6, 2, 3, EYE); px(g, 18, 8, 1, 1, EYE_SOFT);
      px(g, 11, 10, 1, 1, "#f0a0a0"); px(g, 20, 10, 1, 1, "#f0a0a0"); px(g, 13, 10, 1, 1, "#c06a5a"); px(g, 14, 11, 4, 1, "#c06a5a"); px(g, 18, 10, 1, 1, "#c06a5a");
      px(g, 19, 1, 3, 2, "#f2a53a"); px(g, 20, 0, 1, 1, "#f2a53a"); px(g, 18, 2, 1, 1, "#f2a53a"); px(g, 20, 1, 1, 1, "#ffe066");
      px(g, 14, 13, 4, 1, SKIN_S);
      px(g, 9, 14, 14, 4, BL); px(g, 8, 15, 16, 3, BL); px(g, 22, 15, 2, 3, BL_S); px(g, 13, 13, 6, 1, BL);
      px(g, 12, 14, 8, 4, AP); px(g, 12, 14, 1, 4, AP_L); px(g, 19, 14, 1, 4, AP_D); px(g, 12, 13, 1, 1, AP_D); px(g, 19, 13, 1, 1, AP_D);
      px(g, 14, 15, 1, 1, "#ff7eb6"); px(g, 16, 15, 1, 1, "#ff7eb6"); px(g, 14, 16, 3, 1, "#ff7eb6"); px(g, 15, 17, 1, 1, "#ff7eb6");
      drawCounter(g);
      px(g, 7, 15, 4, 4, BL); px(g, 10, 15, 1, 4, BL_S); px(g, 7, 19, 4, 2, SKIN); px(g, 10, 19, 1, 2, SKIN_S);
      px(g, 21, 15, 4, 4, BL); px(g, 24, 15, 1, 4, BL_S); px(g, 21, 19, 4, 2, SKIN); px(g, 24, 19, 1, 2, SKIN_S);
    } else if (ch === "h") {                           // hay pile
      const prof = [3, 5, 7, 8, 9, 10, 11, 11, 12, 12, 12, 13, 13, 13, 13, 13, 13, 13, 13, 12, 12];
      for (let i = 0; i < prof.length; i++) {
        const y = 7 + i, hw = prof[i], x0 = 16 - hw, x1 = 15 + hw;
        for (let x = x0; x <= x1; x++) {
          const dx = x - 12, dy = y - 13, d2 = dx * dx + dy * dy;
          let t = d2 < 20 ? 0 : d2 < 90 ? 1 : d2 < 220 ? 2 : 3;
          if (y >= 26 || (y >= 23 && (x < x0 + 2 || x > x1 - 2))) t = 4;
          const h = hash(x >> 1, y);
          if (h % 5 === 0) t = Math.max(0, t - 1); else if (h % 7 === 0) t = Math.min(4, t + 1);
          px(g, x, y, 1, 1, HAY[t]);
        }
      }
      px(g, 13, 5, 1, 2, HAY[1]); px(g, 18, 6, 1, 1, HAY[1]); px(g, 9, 8, 1, 1, HAY[2]); px(g, 2, 20, 1, 1, HAY[2]); px(g, 29, 18, 1, 1, HAY[2]); px(g, 1, 24, 2, 1, HAY[3]); px(g, 29, 25, 2, 1, HAY[3]);
      px(g, 23, 8, 1, 1, HAY[2]); px(g, 6, 11, 1, 1, HAY[1]);
    } else if (ch === "o") {                           // feeding trough
      px(g, 2, 11, 28, 2, WOOD.light); px(g, 2, 11, 28, 1, WOOD_HI);
      px(g, 3, 13, 26, 5, WOOD.deep);
      px(g, 4, 14, 24, 4, HAY[2]); px(g, 4, 14, 24, 1, HAY[1]);
      const hs = rng(77);                                // heaped hay: strands in four tones, some poking over the rim
      for (let i = 0; i < 26; i++) {
        const hx = 4 + Math.floor(hs() * 23), hy = 13 + Math.floor(hs() * 5), len = 2 + Math.floor(hs() * 3), t = hs();
        px(g, hx, hy, Math.min(len, 28 - hx), 1, t < 0.3 ? HAY[0] : t < 0.6 ? HAY[1] : t < 0.85 ? HAY[3] : HAY[4]);
      }
      px(g, 8, 12, 1, 2, HAY[1]); px(g, 14, 11, 1, 3, HAY[0]); px(g, 21, 12, 2, 1, HAY[1]); px(g, 24, 13, 1, 1, HAY[0]);
      px(g, 9, 15, 2, 1, "#8ec46a"); px(g, 19, 16, 2, 1, "#8ec46a"); px(g, 14, 14, 2, 1, "#8ec46a"); px(g, 25, 15, 1, 1, "#6fae4a");
      px(g, 2, 18, 28, 1, WOOD.light);
      px(g, 2, 19, 28, 7, WOOD.mid); px(g, 2, 22, 28, 1, WOOD.dark); px(g, 2, 23, 28, 1, mix(WOOD.mid, WOOD.light, 0.35)); px(g, 2, 25, 28, 1, WOOD.deep);
      px(g, 9, 20, 6, 1, WOOD.dark); px(g, 18, 24, 6, 1, WOOD.dark); px(g, 11, 21, 3, 1, WOOD.dark);
      for (const bx of [5, 25]) { px(g, bx, 11, 2, 15, IRON.base); px(g, bx, 11, 1, 15, IRON.hi); px(g, bx, 13, 2, 1, IRON.dark); px(g, bx, 18, 2, 1, IRON.dark); }
      px(g, 4, 26, 4, 4, WOOD.dark); px(g, 4, 26, 1, 4, WOOD.mid); px(g, 24, 26, 4, 4, WOOD.dark); px(g, 24, 26, 1, 4, WOOD.mid);
    } else return;
    outline(c, OUT);
  });
}
Object.assign(window.ART, { interiorFloor, interiorWall, interiorRug, interiorObj });
})();
