/* Cozy Hollow art - buildings
   the farmhouse (W), seed shop (S) and barn (N) as whole sprites, plus porch tiles and the chimney.
   Draw only with px() (fillRect) and drawImage at integer coordinates; finish sprites with outline(canvas, OUT).
   Render any sprite to a PNG to check it:  node tools/render.js out.png 5 "expr" ...   (expr evaluated against ART) */
"use strict";
(function () {
const { A, cache, blank, px, hash, rng, hex, rgb, shade, mix, cached, outline, mirrored, OUT, COLORS, ITEM_HEX, SEASON, TREE_PAL, WOOD, text3x5, textWidth } = window.ART;
const ART = window.ART;
// ------------------------------------------------------------ legacy tile pieces (kept as they were)
const HOUSE = { W: { roof: "#8f4b3c", roofL: "#ab6350", roofD: "#5e2f26", wall: "#d2a86e", wallD: "#b3894f", wallL: "#e6c48c", trim: "#5a3a22" },
  S: { roof: "#4f5a70", roofL: "#6b788f", roofD: "#33394a", wall: "#eadbb8", wallD: "#cbb88f", wallL: "#f6ecd2", trim: "#5a3a22" } };
function roofTile(kind, row, rows, edge) {
  const c = HOUSE[kind];
  return cached("roof:" + kind + row + rows + edge, A, A, (g) => {
    px(g, 0, 0, A, A, c.roof);
    for (let y = 0; y < A; y += 6) {
      px(g, 0, y, A, 1, c.roofD);                                  // shadow under the row above
      px(g, 0, y + 1, A, 1, c.roofL);                              // lit top edge of the shingle row
      const off = (y / 6) % 2 ? 6 : 0;
      for (let x = off; x < A; x += 12) px(g, x, y + 2, 1, 4, c.roofD);   // staggered seams
    }
    if (row === 0) { px(g, 0, 0, A, 3, c.roofL); px(g, 0, 3, A, 1, c.roofD); px(g, 0, 0, A, 1, OUT); }
    if (row === rows - 1) { px(g, 0, A - 4, A, 4, c.roofD); px(g, 0, A - 2, A, 1, c.roofL); px(g, 0, A - 1, A, 1, OUT); }
    if (edge === "L") { px(g, 0, 0, 3, A, c.roofD); px(g, 0, 0, 1, A, OUT); }
    if (edge === "R") { px(g, A - 3, 0, 3, A, c.roofD); px(g, A - 1, 0, 1, A, OUT); }
  });
}
function wallTile(kind, variant, night, bottom, edge) {
  const c = HOUSE[kind];
  return cached("wall:" + kind + variant + night + bottom + edge, A, A, (g) => {
    px(g, 0, 0, A, A, c.wall);
    for (let y = 0; y < A; y += 8) { px(g, 0, y, A, 1, c.wallD); px(g, 0, y + 1, A, 1, c.wallL); }
    for (let i = 0; i < 3; i++) px(g, 4 + i * 11, 3 + (i % 2) * 8, 3, 1, c.wallD);
    if (edge === "L") { px(g, 0, 0, 3, A, c.trim); px(g, 0, 0, 1, A, OUT); }
    if (edge === "R") { px(g, A - 3, 0, 3, A, c.trim); px(g, A - 1, 0, 1, A, OUT); }
    if (bottom) { px(g, 0, A - 5, A, 5, "#8a8a88"); px(g, 0, A - 5, A, 1, "#a8a8a4"); px(g, 4, A - 3, 5, 2, "#6f6f6c"); px(g, 15, A - 4, 6, 2, "#6f6f6c"); px(g, 25, A - 3, 4, 2, "#6f6f6c"); px(g, 0, A - 1, A, 1, OUT); }
    if (variant === "window") {
      px(g, 5, 5, 22, 20, c.trim); px(g, 7, 7, 18, 16, night ? "#ffd27a" : "#9fd3ee");
      if (!night) { px(g, 8, 8, 5, 4, "#d8f0fb"); } else { px(g, 8, 8, 6, 5, "#ffe7b0"); }
      px(g, 15, 7, 2, 16, c.trim); px(g, 7, 14, 18, 2, c.trim);
      px(g, 3, 24, 26, 3, c.trim); px(g, 2, 26, 28, 1, OUT);
      px(g, 1, 5, 4, 20, "#7a4a3a"); px(g, 27, 5, 4, 20, "#7a4a3a"); px(g, 2, 9, 2, 12, "#5a3628"); px(g, 28, 9, 2, 12, "#5a3628");
      px(g, 4, 27, 24, 3, "#6a4a2a"); px(g, 6, 26, 3, 2, "#ff6b9d"); px(g, 12, 25, 3, 3, "#ffe066"); px(g, 18, 26, 3, 2, "#ff6b9d"); px(g, 23, 25, 3, 3, "#ff8f5a"); px(g, 9, 26, 2, 1, "#5fb04a"); px(g, 16, 26, 2, 1, "#5fb04a");
    }
    if (variant === "awning") {
      for (let x = 0; x < A; x += 8) { px(g, x, 2, 4, 10, "#d9463c"); px(g, x + 4, 2, 4, 10, "#f4ecd8"); }
      px(g, 0, 11, A, 2, "#a3342c"); px(g, 0, 13, A, 1, OUT); px(g, 0, 1, A, 1, OUT);
      for (let x = 2; x < A; x += 8) px(g, x, 12, 4, 2, "#f4ecd8");
    }
    if (variant === "sign") {
      px(g, 3, 3, 26, 14, "#f4e6c4"); px(g, 2, 2, 28, 1, OUT); px(g, 2, 17, 28, 1, OUT); px(g, 2, 3, 1, 14, OUT); px(g, 29, 3, 1, 14, OUT);
      px(g, 3, 3, 26, 2, c.trim); px(g, 6, 8, 5, 2, "#e0524f"); px(g, 13, 7, 3, 4, "#f28c28"); px(g, 19, 8, 6, 2, "#5fb04a"); px(g, 21, 6, 2, 2, "#5fb04a"); px(g, 6, 12, 20, 2, "#5a3a22");
    }
  });
}
function doorTile(kind) {
  const c = HOUSE[kind];
  return cached("door:" + kind, A, A, (g) => {
    px(g, 0, 0, A, A, c.wall);
    for (let y = 0; y < A; y += 8) { px(g, 0, y, A, 1, c.wallD); px(g, 0, y + 1, A, 1, c.wallL); }
    px(g, 6, 2, 20, 30, c.trim); px(g, 8, 4, 16, 28, WOOD.mid);
    for (let x = 8; x < 24; x += 4) px(g, x, 4, 1, 28, WOOD.dark);
    px(g, 8, 4, 16, 1, WOOD.light);
    px(g, 12, 8, 8, 6, c.trim); px(g, 13, 9, 6, 4, "#ffd27a"); px(g, 15, 9, 2, 4, c.trim);
    px(g, 20, 20, 2, 2, "#f2c744"); px(g, 20, 20, 1, 1, "#fff2a8");
    px(g, 4, A - 5, 24, 5, "#8a8a88"); px(g, 4, A - 5, 24, 1, "#a8a8a4"); px(g, 4, A - 1, 24, 1, OUT);
    px(g, 6, 2, 20, 1, OUT); px(g, 6, 2, 1, 30, OUT); px(g, 25, 2, 1, 30, OUT);
  });
}

// ------------------------------------------------------------ palettes and shared materials
const BUILD = {
  W: { roof: "#8c4a3c", roofL: "#a8624f", roofD: "#5c2f27", roofX: "#c58069", fascia: "#e2c48a", fasciaD: "#b6934f", wall: "#d4aa70", wallD: "#b58b52", wallL: "#e7c98f", wallX: "#f4e0b2", wallDD: "#8b653a", trim: "#7a4a2c", label: "FARMHOUSE" },
  S: { roof: "#556278", roofL: "#6f7d96", roofD: "#38414f", roofX: "#8f9db7", fascia: "#e9dcbf", fasciaD: "#bfae86", wall: "#eddfbf", wallD: "#cfbd93", wallL: "#f8efd8", wallX: "#fff9ea", wallDD: "#ad9a72", trim: "#7a4a2c", label: "SEED SHOP" },
  N: { roof: "#6f6b68", roofL: "#8c8885", roofD: "#4a4744", roofX: "#a9a5a0", fascia: "#f4ecd8", fasciaD: "#cbc0a4", wall: "#b9463a", wallD: "#93362c", wallL: "#cf5a4c", wallX: "#e27b69", wallDD: "#6f2820", trim: "#f4ecd8", label: "BARN" },
};
const STONE = { base: "#8f8c86", light: "#b1aea7", lighter: "#c7c4bd", dark: "#6c6964", deep: "#54524e", mortar: "#5f5c58" };
const GLASS = { day: { base: "#9fd3ee", hi: "#dbf2fc", lo: "#79b5d6" }, night: { base: "#ffd27a", hi: "#ffe9b6", lo: "#e7a94c" } };
const IRON = { base: "#4b4b4e", light: "#707074", dark: "#2d2d30" };
const FLOWERS = ["#ff6b9d", "#ffe066", "#ff8f5a", "#ffffff", "#c86ee0", "#ff4f6d"];
const LEAF = { light: "#6cc24a", base: "#4f9e3b", dark: "#357a2a" };
/* colour helpers that accept both "#hex" and the "rgb(...)" strings mix() returns */
function parseCol(c) { if (c[0] === "#") return hex(c); const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0]; }
function mixc(a, b, t) { const p = parseCol(a), q = parseCol(b); return rgb(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t); }
function shadec(c, f) { const p = parseCol(c), k = (v) => Math.max(0, Math.min(255, v * f)); return rgb(k(p[0]), k(p[1]), k(p[2])); }
const OV = 10, TOPPAD = 30;
function roofRowsFor(h) { return h >= 5 ? 3 : 2; }

/* rubble stonework: 4px courses of blocks with lit tops, shaded right edges and dark mortar */
function stones(g, x, y, w, h, seed) {
  const r = rng(seed);
  px(g, x, y, w, h, STONE.mortar);
  for (let row = 0, yy = y; yy < y + h; row++, yy += 4) {
    const rh = Math.min(4, y + h - yy);
    let xx = x - (row % 2 ? 3 + Math.floor(r() * 4) : 0);
    while (xx < x + w) {
      const bw = 5 + Math.floor(r() * 7), a = Math.max(x, xx), b = Math.min(x + w, xx + bw - 1);
      if (b > a) {
        const v = r(), base = v < .18 ? STONE.dark : v < .42 ? STONE.light : STONE.base;
        px(g, a, yy, b - a, rh - 1, base);
        px(g, a, yy, b - a, 1, v < .18 ? STONE.base : v < .42 ? STONE.lighter : STONE.light);
        if (b - a > 2 && rh > 2) px(g, b - 1, yy + 1, 1, rh - 2, v < .18 ? STONE.deep : STONE.dark);
      }
      xx += bw;
    }
  }
}
/* stacked round logs, 8px per course: a dark gap, a bright lit crown, the body and a shaded underside, with grain and knots */
function logWall(g, x, y, w, h, c, seed) {
  const r = rng(seed), D2 = mixc(c.wallD, c.wallDD, .5), grain = mixc(c.wall, c.wallD, .6);
  const rows = [c.wallDD, c.wallX, c.wallL, c.wall, c.wall, c.wall, c.wallD, D2];
  for (let yy = y; yy < y + h; yy += 8) {
    for (let k = 0; k < 8 && yy + k < y + h; k++) px(g, x, yy + k, w, 1, rows[k]);
    if (yy + 6 > y + h) continue;
    for (let i = 0; i < Math.floor(w / 12); i++) px(g, x + Math.floor(r() * (w - 8)), yy + 3 + Math.floor(r() * 3), 3 + Math.floor(r() * 5), 1, grain);
    for (let i = 0; i < Math.floor(w / 14); i++) px(g, x + Math.floor(r() * (w - 6)), yy + 3 + Math.floor(r() * 3), 2 + Math.floor(r() * 3), 1, c.wallD);       // short darker grain streaks
    for (let i = 0; i < Math.floor(w / 40); i++) px(g, x + Math.floor(r() * (w - 6)), yy + 6, 2 + Math.floor(r() * 4), 1, D2);                                  // shadow checks on the underside
    // a few knots per course: a dark oval with a deep centre and a lit rim, the grain flowing round it
    for (let n = 1 + Math.floor(w / 110); n > 0; n--) {
      if (r() > .8) continue;
      const kx = x + 6 + Math.floor(r() * (w - 16));
      px(g, kx + 1, yy + 3, 3, 3, c.wallD); px(g, kx, yy + 4, 5, 1, c.wallD); px(g, kx + 2, yy + 4, 1, 1, c.wallDD); px(g, kx + 1, yy + 3, 1, 1, c.wallL);
      px(g, kx + 5, yy + 4, 2 + Math.floor(r() * 3), 1, grain); px(g, kx - 3 - Math.floor(r() * 2), yy + 4, 3, 1, grain);
    }
  }
}
/* the ends of the side-wall logs showing at a corner, every other course, with a growth-ring centre */
function logEnds(g, x, y, h, c) {
  for (let yy = y, i = 0; yy + 8 <= y + h; yy += 8, i++) {
    if (i % 2) continue;
    px(g, x, yy, 7, 8, c.wallD); px(g, x, yy, 7, 1, c.wallL); px(g, x, yy, 1, 8, c.wallL); px(g, x, yy + 7, 7, 1, c.wallDD); px(g, x + 6, yy, 1, 8, c.wallDD);
    px(g, x + 2, yy + 2, 3, 4, c.wall); px(g, x + 2, yy + 2, 1, 1, c.wallX); px(g, x + 3, yy + 4, 1, 1, c.wallD);
  }
}
/* horizontal clapboard siding, 6px boards overlapping downwards */
function clapboard(g, x, y, w, h, c, seed) {
  const r = rng(seed);
  for (let yy = y; yy < y + h; yy += 6) {
    const v = r(), base = v < .2 ? mixc(c.wall, c.wallD, .18) : v < .35 ? mixc(c.wall, c.wallL, .5) : c.wall;
    const rows = [c.wallL, base, base, base, mixc(base, c.wallD, .35), c.wallDD];
    for (let k = 0; k < 6 && yy + k < y + h; k++) px(g, x, yy + k, w, 1, rows[k]);
    if (yy + 4 > y + h) continue;
    for (let i = 0; i < Math.floor(w / 20); i++) px(g, x + Math.floor(r() * (w - 6)), yy + 2 + Math.floor(r() * 2), 2 + Math.floor(r() * 4), 1, mixc(base, c.wallD, .5));
    for (let bx = x + 10 + Math.floor(r() * 30); bx < x + w - 4; bx += 40 + Math.floor(r() * 30)) px(g, bx, yy + 1, 1, 4, c.wallDD);   // board joints
  }
}
/* vertical board-and-batten planks (barn) */
function boardWall(g, x, y, w, h, c, seed) {
  const r = rng(seed);
  for (let xx = x; xx < x + w; xx += 6) {
    const v = r(), base = v < .2 ? mixc(c.wall, c.wallD, .2) : v < .32 ? mixc(c.wall, c.wallL, .4) : c.wall, bw = Math.min(6, x + w - xx);
    px(g, xx, y, bw, h, base);
    px(g, xx, y, 1, h, c.wallDD); if (bw > 1) px(g, xx + 1, y, 1, h, c.wallL); if (bw > 5) px(g, xx + 5, y, 1, h, c.wallD);
    for (let i = 0; i < Math.floor(h / 12); i++) px(g, xx + 2 + Math.floor(r() * 2), y + Math.floor(r() * (h - 6)), 1, 2 + Math.floor(r() * 4), mixc(base, c.wallD, .55));
    if (r() < .3 && h > 12) { const ky = y + 4 + Math.floor(r() * (h - 8)); px(g, xx + 2, ky, 2, 3, c.wallD); px(g, xx + 2, ky, 1, 1, c.wallL); }
  }
}
/* eave shadow painted onto the top of a wall */
function eaveShadow(g, x, y, w, c) { px(g, x, y, w, 2, mixc(c.wallD, c.wallDD, .6)); px(g, x, y + 2, w, 1, c.wallD); px(g, x, y + 3, w, 1, mixc(c.wall, c.wallD, .5)); }

/* a shingled roof face between y=top and y=bot; insetFn(t) gives how far each side steps in at height fraction t (0 at the ridge) */
function roofFace(g, c, L0, R0, top, bot, insetFn, seed, opts) {
  opts = opts || {};
  const rowH = opts.rowH || 6, shW = opts.shingle || 10, H = bot - top, rows = Math.max(1, Math.ceil(H / rowH)), moss = opts.moss;
  // five tone bands from the sunlit ridge down to the shaded eaves give the big roof plane some form
  const bands = [mixc(c.roof, c.roofL, .45), mixc(c.roof, c.roofL, .2), c.roof, mixc(c.roof, c.roofD, .2), mixc(c.roof, c.roofD, .4)];
  const lit = [c.roofX, mixc(c.roofL, c.roofX, .5), c.roofL, c.roofL, mixc(c.roofL, c.roof, .4)];
  for (let y = top; y < bot; y++) {
    const i = y - top, inset = insetFn(i / H), L = L0 + inset, R = R0 - inset, k = i % rowH, row = Math.floor(i / rowH), band = Math.min(4, Math.floor(5 * row / rows));
    if (k === 0) { px(g, L, y, R - L, 1, c.roofD); continue; }
    const off = row % 2 ? Math.floor(shW / 2) : 0;
    for (let sx = L0 - shW + off; sx < R; sx += shW) {
      const a = Math.max(L, sx + 1), b = Math.min(R, sx + shW);
      if (b <= a) continue;
      const v = hash(sx + 977 * seed, row) % 100;
      let col = k === 1 ? lit[band] : bands[band];
      if (k > 1) { if (v < 9) col = mixc(col, c.roofD, .4); else if (v < 18) col = mixc(col, c.roofL, .5); }
      else if (v < 12) col = mixc(col, c.roof, .5);
      px(g, a, y, b - a, 1, col);
    }
    if (k >= 2) for (let sx = L0 - shW + off; sx < R; sx += shW) if (sx >= L && sx < R) px(g, sx, y, 1, 1, c.roofD);
  }
  if (moss) mossPatches(g, c, L0, R0, top, bot, insetFn, seed, rowH, shW, rows, moss);
}
/* ragged moss clumps low on a roof slope (bands 2-4): each sits on a shingle chosen by the same hash as the shingle tints, straddles the seam
   below it, has nibbled edges with no square corners, a lighter top-left rim and a deeper underside */
function mossPatches(g, c, L0, R0, top, bot, insetFn, seed, rowH, shW, rows, moss) {
  const H = bot - top, mossL = mixc(moss, "#c9dc70", .42), mossD = mixc(moss, c.roofD, .45);
  for (let row = 0; row < rows; row++) {
    if (Math.floor(5 * row / rows) < 2) continue;
    const off = row % 2 ? Math.floor(shW / 2) : 0;
    for (let sx = L0 - shW + off; sx < R0; sx += shW) {
      if (hash(sx + 977 * seed, row) % 100 >= 20) continue;
      const u = hash(sx * 3 + seed, row * 5 + 1), x0 = sx + 1 + u % 4, pw = 5 + (u >> 3) % 5, k0 = 2 + (u >> 6) % 2, k1 = rowH - 1 + (u >> 8) % 2;
      for (let k = k0; k <= k1; k++) {
        const y = top + row * rowH + k; if (y >= bot) break;
        const inset = insetFn((y - top) / H), L = L0 + inset, R = R0 - inset;
        for (let x = x0; x < x0 + pw; x++) {
          if (x < L || x >= R) continue;
          const ex = x === x0 || x === x0 + pw - 1, ey = k === k0 || k === k1, m = hash(x * 7 + seed, y * 13 + row) % 100;
          if ((ex && ey) || ((ex || ey) && m < 45)) continue;
          px(g, x, y, 1, 1, k === k0 || (x === x0 && k < k1) ? mossL : k === k1 || x === x0 + pw - 1 ? mossD : m < 14 ? mossL : moss);
        }
      }
    }
  }
}
/* fascia boards along the two slanted edges of a roof face */
function roofEdges(g, c, L0, R0, top, bot, insetFn) {
  const H = bot - top;
  for (let y = top; y < bot; y++) { const inset = insetFn((y - top) / H); px(g, L0 + inset, y, 2, 1, c.fascia); px(g, L0 + inset + 2, y, 1, 1, c.fasciaD); px(g, R0 - inset - 2, y, 2, 1, c.fascia); px(g, R0 - inset - 3, y, 1, 1, c.fasciaD); }
}
/* the eave board along the bottom of the roof (5px) with little dentil blocks; both ends get an end-grain cap (lit on the left, shaded on the right)
   so the tips read as board ends inside the outline */
function eaveBoard(g, c, L0, R0, y) {
  px(g, L0, y, R0 - L0, 5, c.fascia); px(g, L0, y, R0 - L0, 1, mixc(c.fascia, "#ffffff", .4)); px(g, L0, y + 4, R0 - L0, 1, c.fasciaD);
  for (let x = L0 + 7; x < R0 - 4; x += 12) px(g, x, y + 2, 2, 2, c.fasciaD);
  px(g, L0, y + 1, 1, 3, mixc(c.fascia, c.fasciaD, .5)); px(g, R0 - 1, y, 1, 5, c.fasciaD); px(g, R0 - 2, y + 1, 1, 3, mixc(c.fascia, c.fasciaD, .5));
}
/* ridge cap, 4 rows tall */
function ridgeCap(g, c, L, R, y) {
  px(g, L, y, R - L, 4, c.roof); px(g, L + 1, y, R - L - 2, 1, c.roofX); px(g, L, y + 1, R - L, 1, c.roofL); px(g, L, y + 3, R - L, 1, c.roofD);
  for (let x = L + 5; x < R - 2; x += 10) px(g, x, y + 1, 1, 2, c.roofD);
}

function glass(g, x, y, w, h, night) {
  const G = night ? GLASS.night : GLASS.day;
  px(g, x, y, w, h, G.base);
  const lo = Math.max(1, Math.floor(h / 3)); px(g, x, y + h - lo, w, lo, G.lo);
  if (night) { px(g, x + 1, y + 1, Math.max(1, w - 2), Math.max(1, Math.floor(h / 2) - 1), G.hi); px(g, x + 1, y + 1, 1, 1, G.base); px(g, x + w - 2, y + 1, 1, 1, G.base); }
  else { const n = Math.min(4, Math.max(2, Math.floor(Math.min(w, h) / 3))); for (let i = 0; i < n; i++) px(g, x + 1 + i, y + n - i, 2, 1, G.hi); }
}
/* framed window with 4 panes; frame colours default to cream */
function frameWindow(g, x, y, w, h, night, frame, frameD) {
  frame = frame || "#f4e6c4"; frameD = frameD || "#c8b68e";
  px(g, x, y, w, h, frame); px(g, x + w - 1, y, 1, h, frameD); px(g, x, y + h - 1, w, 1, frameD);
  glass(g, x + 2, y + 2, w - 4, h - 4, night);
  const mx = x + Math.floor(w / 2) - 1, my = y + Math.floor(h / 2) - 1;
  px(g, mx, y + 2, 2, h - 4, frame); px(g, x + 2, my, w - 4, 2, frame); px(g, mx + 1, y + 2, 1, h - 4, frameD); px(g, x + 2, my + 1, w - 4, 1, frameD);
}
function sill(g, x, y, w, col, colD) { px(g, x - 2, y, w + 4, 3, col); px(g, x - 2, y, w + 4, 1, mixc(col, "#ffffff", .3)); px(g, x - 2, y + 2, w + 4, 1, colD); }
function shutter(g, x, y, h) {
  px(g, x, y, 5, h, "#7a4a3a"); px(g, x, y, 1, h, "#95604c"); px(g, x + 4, y, 1, h, "#5a3628"); px(g, x, y, 5, 1, "#95604c"); px(g, x, y + h - 1, 5, 1, "#4a2c20");
  for (let yy = y + 3; yy < y + h - 2; yy += 3) px(g, x + 1, yy, 3, 1, "#5a3628");
}
/* flower box: (x, y) top-left of the box, w wide, 6 tall; blooms spill over its top edge */
function flowerBox(g, x, y, w, seed) {
  const r = rng(seed);
  px(g, x, y, w, 6, WOOD.dark); px(g, x, y, w, 1, WOOD.mid); px(g, x, y + 5, w, 1, WOOD.deep); px(g, x + w - 1, y, 1, 6, WOOD.deep);
  for (let i = 5; i < w - 2; i += 6) px(g, x + i, y + 1, 1, 4, WOOD.deep);
  for (let fx = x + 1; fx < x + w - 2; fx += 3) {
    const v = r();
    if (v < .6) { const col = FLOWERS[Math.floor(r() * FLOWERS.length)]; px(g, fx, y - 2, 2, 2, col); px(g, fx, y - 2, 1, 1, mixc(col, "#ffffff", .45)); px(g, fx + 1, y, 1, 1, LEAF.base); px(g, fx - 1, y - 1, 1, 1, LEAF.light); }
    else { px(g, fx, y - 1, 2, 2, LEAF.light); px(g, fx + 1, y - 2, 1, 1, LEAF.base); px(g, fx, y, 1, 1, LEAF.dark); }
  }
}
/* panelled wooden door with a small window, brass knob and a stone step */
function panelDoor(g, x, y, w, h, c, night, opts) {
  opts = opts || {};
  const winH = opts.winH || 9;
  px(g, x - 2, y - 2, w + 4, h + 2, c.trim); px(g, x - 2, y - 2, w + 4, 1, mixc(c.trim, "#ffffff", .3)); px(g, x + w + 1, y - 2, 1, h + 2, mixc(c.trim, "#000000", .3));
  px(g, x, y, w, h, WOOD.mid);
  for (let i = 0; i < w; i += 5) { px(g, x + i, y, 1, h, WOOD.dark); if (i + 1 < w) px(g, x + i + 1, y, 1, h, mixc(WOOD.mid, WOOD.light, .5)); }
  px(g, x, y, w, 1, WOOD.light);
  px(g, x + 3, y + 3, w - 6, winH + 2, WOOD.dark); px(g, x + 4, y + 4, w - 8, winH, WOOD.deep);
  glass(g, x + 5, y + 5, w - 10, winH - 2, night); px(g, x + Math.floor(w / 2), y + 5, 1, winH - 2, WOOD.deep); px(g, x + 5, y + 5 + Math.floor((winH - 2) / 2), w - 10, 1, WOOD.deep);
  const py = y + winH + 8, ph = h - (winH + 8) - 4;
  if (ph > 4) { px(g, x + 3, py, w - 6, ph, WOOD.dark); px(g, x + 4, py + 1, w - 8, ph - 2, WOOD.light); px(g, x + 5, py + 2, w - 10, ph - 4, WOOD.mid); px(g, x + 5, py + 2, w - 10, 1, mixc(WOOD.mid, WOOD.dark, .4)); }
  px(g, x + w - 6, y + Math.floor(h / 2), 2, 2, "#f2c744"); px(g, x + w - 6, y + Math.floor(h / 2), 1, 1, "#fff2a8");
  px(g, x, y + 3, 2, 2, IRON.base); px(g, x, y + h - 6, 2, 2, IRON.base);
  if (!opts.noStep) { px(g, x - 3, y + h, w + 6, 3, STONE.light); px(g, x - 3, y + h, w + 6, 1, STONE.lighter); px(g, x - 3, y + h + 2, w + 6, 1, STONE.dark); }
}
/* deck planks, 6px per board, laid so a board edge falls on y = origin + 6k. Board tones come from the row index (not the seed)
   so the same board keeps its colour across the porch tiles and the strip of deck painted under the farmhouse door. */
function deckBoards(g, x, y, w, h, origin, seed) {
  const r = rng(seed);
  const tone = (row) => { const v = hash(row + 50, 9) % 100; return v < 30 ? mixc(WOOD.light, WOOD.mid, .35) : v < 45 ? mixc(WOOD.light, "#ffffff", .12) : WOOD.light; };
  for (let yy = y; yy < y + h; yy++) {
    const k = (((yy - origin) % 6) + 6) % 6, base = tone(Math.floor((yy - origin) / 6));
    px(g, x, yy, w, 1, k === 0 ? mixc(base, "#ffffff", .3) : k === 4 ? mixc(base, WOOD.dark, .35) : k === 5 ? WOOD.dark : base);
  }
  for (let yy = y; yy < y + h; yy++) {
    if ((((yy - origin) % 6) + 6) % 6 !== 1 || yy + 3 > y + h) continue;               // once per fully visible board: grain, a joint and nail heads
    const base = tone(Math.floor((yy - origin) / 6));
    for (let i = 0; i < Math.max(1, Math.floor(w / 11)); i++) px(g, x + Math.floor(r() * (w - 5)), yy + 1 + Math.floor(r() * 2), 2 + Math.floor(r() * 4), 1, mixc(base, WOOD.dark, .5));
    if (r() < .7) px(g, x + 4 + Math.floor(r() * (w - 8)), yy, 1, 4, WOOD.deep);
    px(g, x + 3, yy + 1, 1, 1, WOOD.deep); px(g, x + w - 4, yy + 1, 1, 1, WOOD.deep);
  }
}
/* filled circle from integer row spans (no arcs) */
function disc(g, cx, cy, r, col) { for (let dy = -r; dy <= r; dy++) { const hw = Math.floor(Math.sqrt(r * r - dy * dy)); px(g, cx - hw, cy + dy, hw * 2 + 1, 1, col); } }
/* round hay bale, radius r, centred on (cx, cy): rings of straw with a lit top-left and loose stalks */
function roundBale(g, cx, cy, r) {
  const H = { deep: "#8a6a22", dark: "#b7943a", base: "#d9b64a", light: "#efd270", hi: "#fbe9a0" };
  disc(g, cx + 1, cy + 1, r, H.deep); disc(g, cx, cy, r, H.dark); disc(g, cx - 1, cy - 1, r - 1, H.base);
  for (let rr = r - 3; rr > 0; rr -= 3) { disc(g, cx, cy, rr, H.dark); if (rr > 1) disc(g, cx - 1, cy - 1, rr - 1, H.base); }
  px(g, cx - r + 2, cy - r + 3, 3, 1, H.hi); px(g, cx - r + 1, cy - r + 4, 1, 3, H.hi); px(g, cx - 2, cy - 1, 2, 1, H.light); px(g, cx + 1, cy + 2, 1, 1, H.light);
  px(g, cx + r - 1, cy - 2, 2, 1, H.light); px(g, cx - r - 1, cy + r - 3, 2, 1, H.light); px(g, cx + 3, cy - r + 1, 1, 1, H.light); px(g, cx - 3, cy + r, 2, 1, H.dark);
}
/* spoked wagon wheel leaning against a wall, radius r, centred on (cx, cy) */
function wagonWheel(g, cx, cy, r) {
  for (let dy = -r; dy <= r; dy++) {
    const xo = Math.floor(Math.sqrt(r * r - dy * dy)), ri = r - 3, xi = Math.abs(dy) <= ri ? Math.floor(Math.sqrt(ri * ri - dy * dy)) : -1;
    const col = dy < -r + 4 ? WOOD.light : dy > r - 4 ? WOOD.deep : WOOD.mid;
    if (xi < 0) px(g, cx - xo, cy + dy, xo * 2 + 1, 1, col);
    else { px(g, cx - xo, cy + dy, xo - xi, 1, col); px(g, cx + xi + 1, cy + dy, xo - xi, 1, col); }
    px(g, cx + xo, cy + dy, 1, 1, IRON.dark); px(g, cx - xo, cy + dy, 1, 1, IRON.base);            // iron tyre
  }
  const s = r - 3;
  px(g, cx - 1, cy - s, 2, s * 2 + 1, WOOD.dark); px(g, cx - s, cy - 1, s * 2 + 1, 2, WOOD.dark);
  for (let i = -s + 2; i <= s - 2; i++) { const d = Math.round(i * .71); px(g, cx + d, cy + d, 2, 1, WOOD.dark); px(g, cx - d, cy + d, 2, 1, WOOD.dark); }
  px(g, cx - 2, cy - 2, 4, 4, IRON.base); px(g, cx - 1, cy - 1, 2, 2, IRON.light);
}
/* burlap seed sack, 14 wide and 16 tall with its base at (x, y); a tied neck and a little crop label */
function sack(g, x, y, label) {
  const B = { base: "#c9a66b", light: "#e0c088", dark: "#a5824a", deep: "#7d5f34" };
  px(g, x + 1, y - 12, 12, 12, B.base); px(g, x, y - 10, 14, 10, B.base); px(g, x + 2, y - 13, 10, 1, B.base);
  px(g, x + 1, y - 12, 1, 11, B.light); px(g, x + 2, y - 13, 6, 1, B.light); px(g, x + 12, y - 12, 2, 12, B.dark); px(g, x, y - 1, 14, 1, B.deep); px(g, x + 1, y - 2, 12, 1, B.dark);
  for (let yy = y - 10; yy < y - 2; yy += 3) for (let xx = x + 2 + (yy % 2 ? 1 : 0); xx < x + 12; xx += 4) px(g, xx, yy, 1, 1, B.dark);
  px(g, x + 3, y - 16, 8, 3, B.dark); px(g, x + 4, y - 17, 6, 1, B.base); px(g, x + 4, y - 16, 2, 1, B.light); px(g, x + 2, y - 14, 10, 2, B.deep); px(g, x + 2, y - 14, 10, 1, "#6a4a2a");
  px(g, x + 12, y - 13, 2, 3, B.deep); px(g, x + 13, y - 11, 1, 2, B.deep);
  px(g, x + 4, y - 9, 6, 6, "#f4e6c4"); px(g, x + 4, y - 9, 6, 1, "#ffffff"); px(g, x + 9, y - 9, 1, 6, "#c8b68e"); px(g, x + 6, y - 7, 2, 2, label); px(g, x + 6, y - 5, 2, 1, LEAF.base); px(g, x + 5, y - 8, 1, 1, LEAF.light);
}
/* split logs stacked against a wall, w wide, h tall, bottom-left at (x, y) */
function logStack(g, x, y, w, h, seed) {
  const r = rng(seed);
  for (let row = 0, yy = y - 5; yy > y - h - 1; row++, yy -= 5) {
    const off = row % 2 ? 3 : 0;
    for (let xx = x + off; xx + 6 <= x + w - (row * 2); xx += 6) {
      px(g, xx, yy, 6, 5, WOOD.dark); px(g, xx + 1, yy - 1, 4, 1, WOOD.dark); px(g, xx + 1, yy + 5, 4, 1, WOOD.deep);
      px(g, xx + 1, yy, 4, 4, r() < .3 ? WOOD.light : WOOD.mid); px(g, xx + 1, yy, 3, 1, WOOD.light); px(g, xx + 2, yy + 1, 2, 2, WOOD.dark); px(g, xx + 2, yy + 1, 1, 1, WOOD.mid);
      px(g, xx + 5, yy + 1, 1, 3, WOOD.deep);
    }
  }
}
/* small shingled hood over a door on two wooden brackets */
function doorHood(g, c, x, y, w) {
  roofFace(g, c, x, x + w, y, y + 8, (t) => Math.round(3 * (1 - t)), 11, { rowH: 4, shingle: 6 });
  px(g, x + 3, y - 1, w - 6, 1, c.roofL); px(g, x + 4, y - 2, w - 8, 1, c.roofX);
  px(g, x, y + 8, w, 3, c.fascia); px(g, x, y + 8, w, 1, mixc(c.fascia, "#ffffff", .4)); px(g, x, y + 10, w, 1, c.fasciaD);
  px(g, x + 4, y + 11, 2, 6, c.trim); px(g, x + 4, y + 11, 5, 2, c.trim); px(g, x + 6, y + 13, 2, 2, c.trim);
  px(g, x + w - 6, y + 11, 2, 6, c.trim); px(g, x + w - 9, y + 11, 5, 2, c.trim); px(g, x + w - 8, y + 13, 2, 2, c.trim);
}
/* iron bracket at (x, y) with a lantern hanging from its tip; lit when night */
function lantern(g, x, y, night) {
  px(g, x, y, 9, 2, IRON.dark); px(g, x, y, 1, 5, IRON.dark); px(g, x + 3, y + 2, 2, 1, IRON.dark); px(g, x + 8, y + 2, 1, 2, IRON.dark);
  const lx = x + 4, ly = y + 4;
  px(g, lx + 3, ly, 3, 1, IRON.base); px(g, lx + 1, ly + 1, 7, 1, IRON.light); px(g, lx, ly + 2, 9, 1, IRON.base);
  px(g, lx + 1, ly + 3, 7, 7, night ? "#ffcf5e" : "#c9d6da");
  if (night) { px(g, lx + 3, ly + 5, 3, 3, "#fff4c8"); px(g, lx + 4, ly + 4, 1, 1, "#fff4c8"); } else { px(g, lx + 2, ly + 4, 1, 2, "#e6eef0"); px(g, lx + 2, ly + 8, 5, 1, "#a9b8bd"); }
  px(g, lx + 1, ly + 3, 1, 7, IRON.dark); px(g, lx + 7, ly + 3, 1, 7, IRON.dark); px(g, lx + 4, ly + 3, 1, 7, IRON.base);
  px(g, lx, ly + 10, 9, 2, IRON.dark); px(g, lx + 1, ly + 10, 7, 1, IRON.base); px(g, lx + 4, ly + 12, 1, 1, IRON.dark);
}
/* cream name plaque with nails, centred on cx */
function plaque(g, cx, y, label, sc) {
  const tw = textWidth(label, sc), w = tw + 12, h = sc * 5 + 4, x = cx - Math.floor(w / 2);
  px(g, x - 1, y - 1, w + 2, h + 2, OUT); px(g, x, y, w, h, "#f2e3bf"); px(g, x, y, w, 1, "#fff6dc"); px(g, x, y + h - 1, w, 1, "#c9b283"); px(g, x + w - 1, y, 1, h, "#c9b283");
  px(g, x + 1, y + 1, 1, 1, IRON.base); px(g, x + w - 2, y + 1, 1, 1, IRON.base); px(g, x + 1, y + h - 2, 1, 1, IRON.base); px(g, x + w - 2, y + h - 2, 1, 1, IRON.base);
  text3x5(g, x + 6, y + 2, label, "#3a2a1a", sc);
  return { x, y, w, h };
}
/* stone chimney, 14 wide, from y=top (cap) down to y=bot */
function stoneChimney(g, x, top, bot, seed) {
  stones(g, x, top + 4, 14, bot - top - 4, seed);
  px(g, x + 12, top + 4, 2, bot - top - 4, STONE.dark); px(g, x + 13, top + 4, 1, bot - top - 4, STONE.deep); px(g, x, top + 4, 1, bot - top - 4, STONE.light);
  px(g, x - 2, top, 18, 4, STONE.base); px(g, x - 2, top, 18, 1, STONE.lighter); px(g, x - 2, top + 3, 18, 1, STONE.dark); px(g, x + 15, top + 1, 1, 2, STONE.dark);
  px(g, x + 1, top + 1, 12, 2, STONE.deep); px(g, x + 2, top + 2, 10, 1, "#3a3835");
}
/* tin stovepipe, 8 wide at x: crimped sections in three greys, a flared top ring, a rain hood on two struts, a storm collar and roof flashing;
   the hood peak is at y=top and the flashing ends at y=bot */
function stovePipe(g, c, x, top, bot) {
  const mid = mixc(IRON.base, IRON.light, .4), body = bot - 3, bodyTop = top + 10;
  px(g, x, bodyTop, 8, body - bodyTop, IRON.base); px(g, x, bodyTop, 1, body - bodyTop, IRON.light); px(g, x + 1, bodyTop, 2, body - bodyTop, mid); px(g, x + 6, bodyTop, 2, body - bodyTop, IRON.dark);
  for (let y = bodyTop + 8; y < body - 5; y += 8) { px(g, x, y, 8, 1, IRON.light); px(g, x, y + 1, 8, 1, IRON.dark); px(g, x + 6, y, 2, 1, IRON.base); }   // crimped joints
  px(g, x - 1, top + 7, 10, 3, IRON.base); px(g, x - 1, top + 7, 10, 1, IRON.light); px(g, x - 1, top + 9, 10, 1, IRON.dark); px(g, x + 7, top + 7, 2, 3, IRON.dark);   // flared top ring
  px(g, x, top + 5, 8, 2, "#1c1c1f"); px(g, x - 1, top + 4, 1, 3, IRON.dark); px(g, x + 8, top + 4, 1, 3, IRON.dark);                                   // open vent and its struts
  px(g, x + 3, top, 2, 1, IRON.light); px(g, x + 1, top + 1, 6, 1, IRON.light); px(g, x + 5, top + 1, 2, 1, mid);                                       // rain hood, lit on the left
  px(g, x - 1, top + 2, 10, 1, mid); px(g, x + 6, top + 2, 3, 1, IRON.base);
  px(g, x - 3, top + 3, 14, 1, IRON.base); px(g, x - 3, top + 3, 4, 1, mid); px(g, x + 7, top + 3, 4, 1, IRON.dark); px(g, x - 3, top + 4, 14, 1, IRON.dark);
  px(g, x - 2, body - 3, 12, 3, IRON.base); px(g, x - 2, body - 3, 12, 1, IRON.light); px(g, x - 2, body - 1, 12, 1, IRON.dark); px(g, x + 8, body - 3, 2, 3, IRON.dark);   // storm collar
  px(g, x - 3, body, 14, 3, c.roofD); px(g, x - 3, body, 14, 1, mixc(c.roofD, c.roof, .5));                                                              // flashing
}
/* gable dormer sitting on a roof face: apex of the wall triangle at (cx, y0) */
function gableDormer(g, c, cx, y0, night) {
  const gh = 18, slope = 24 / gh, blockH = 16, rows = [c.wallDD, c.wallX, c.wallL, c.wall, c.wall, c.wall, c.wallD, mixc(c.wallD, c.wallDD, .5)];
  const tri = (apex, hMax, col) => { for (let i = 0; i <= hMax; i++) { const hw = Math.round(i * slope); px(g, cx - hw, apex + i, hw * 2 + 1, 1, col); } };
  tri(y0 - 6, gh + 6, c.roofX); tri(y0 - 5, gh + 5, c.roofL); tri(y0 - 3, gh + 3, c.fascia); tri(y0 - 1, gh + 1, c.fasciaD);
  for (let i = 0; i <= gh; i++) { const hw = Math.round(i * slope); px(g, cx - hw, y0 + i, hw * 2 + 1, 1, rows[(i + 2) % 8]); }
  const hw = Math.round(gh * slope);
  for (let i = 1; i <= blockH; i++) px(g, cx - hw, y0 + gh + i, hw * 2 + 1, 1, rows[(gh + i + 2) % 8]);
  px(g, cx - hw, y0 + gh + 1, 1, blockH, c.wallL); px(g, cx + hw, y0 + gh + 1, 1, blockH, c.wallDD);
  frameWindow(g, cx - 7, y0 + gh - 5, 15, 15, night); sill(g, cx - 7, y0 + gh + 10, 15, c.trim, mixc(c.trim, "#000000", .35));
  px(g, cx - hw, y0 + gh + blockH + 1, hw * 2 + 1, 2, c.roofD);
}
/* rooster weather vane on a rod, ~11 wide, 15 tall from y */
function weatherVane(g, cx, y) {
  const R = ["......R...", ".....###..", ".....##O..", "#...####..", "##.#####..", ".#######..", "..#####...", "...#.#...."];
  R.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) { const ch = row[rx]; if (ch === ".") continue; px(g, cx - 5 + rx, y + ry, 1, 1, ch === "R" ? "#d9463c" : ch === "O" ? "#f2a33a" : IRON.dark); } });
  px(g, cx - 1, y + 8, 2, 7, IRON.dark); px(g, cx - 8, y + 10, 16, 1, IRON.dark); px(g, cx - 9, y + 9, 1, 3, IRON.dark); px(g, cx - 10, y + 10, 1, 1, IRON.dark); px(g, cx + 7, y + 9, 1, 3, IRON.dark); px(g, cx + 8, y + 8, 1, 5, IRON.dark);
}
/* little cupola on a barn ridge: pyramid roof + louvred box, 20 wide, 14 tall from y */
function cupola(g, c, cx, y) {
  px(g, cx - 2, y, 4, 1, c.roofX); px(g, cx - 4, y + 1, 8, 1, c.roofL); px(g, cx - 6, y + 2, 12, 1, c.roof); px(g, cx - 8, y + 3, 16, 1, c.roof); px(g, cx - 10, y + 4, 20, 1, c.roofD);
  px(g, cx - 8, y + 5, 16, 9, c.trim); px(g, cx + 7, y + 5, 1, 9, c.fasciaD); px(g, cx - 8, y + 13, 16, 1, c.fasciaD);
  px(g, cx - 3, y + 7, 6, 5, IRON.dark); px(g, cx - 3, y + 8, 6, 1, IRON.base); px(g, cx - 3, y + 10, 6, 1, IRON.base);
}
/* small produce drawn with its base at y (sitting on a shelf or crate) */
function veg(g, x, y, kind) {
  const P = ITEM_HEX;
  if (kind === "pumpkin") { px(g, x, y - 5, 7, 5, P.pumpkin); px(g, x + 1, y - 6, 5, 1, P.pumpkin); px(g, x + 2, y - 5, 1, 5, shadec(P.pumpkin, .78)); px(g, x + 4, y - 5, 1, 5, shadec(P.pumpkin, .78)); px(g, x + 6, y - 4, 1, 4, shadec(P.pumpkin, .78)); px(g, x + 1, y - 5, 1, 2, mixc(P.pumpkin, "#ffffff", .45)); px(g, x + 3, y - 7, 1, 2, LEAF.dark); }
  else if (kind === "turnip") { px(g, x + 1, y - 4, 4, 4, P.turnip); px(g, x, y - 3, 6, 2, P.turnip); px(g, x + 1, y - 4, 4, 1, "#c98fd2"); px(g, x + 2, y - 6, 1, 2, LEAF.light); px(g, x + 3, y - 6, 1, 1, LEAF.base); px(g, x + 1, y - 2, 1, 1, "#ffffff"); px(g, x + 2, y - 1, 3, 1, "#d8cde0"); }
  else if (kind === "tomato") { px(g, x, y - 4, 5, 4, P.tomato); px(g, x + 1, y - 5, 3, 1, P.tomato); px(g, x + 1, y - 4, 1, 1, "#ff9a8a"); px(g, x + 1, y - 6, 2, 1, LEAF.dark); px(g, x, y - 1, 5, 1, shadec(P.tomato, .75)); }
  else if (kind === "sunflower") { px(g, x + 3, y - 8, 1, 8, LEAF.dark); px(g, x + 1, y - 7, 2, 1, LEAF.base); px(g, x + 1, y - 12, 5, 5, P.sunflower); px(g, x + 2, y - 13, 3, 1, P.sunflower); px(g, x + 2, y - 7, 3, 1, P.sunflower); px(g, x + 2, y - 11, 3, 3, "#8a5a2a"); px(g, x + 3, y - 10, 1, 1, "#5a3a1a"); }
  else if (kind === "melon") { px(g, x, y - 5, 7, 5, P.melon); px(g, x + 1, y - 6, 5, 1, P.melon); px(g, x + 2, y - 6, 1, 6, shadec(P.melon, .7)); px(g, x + 4, y - 6, 1, 6, shadec(P.melon, .7)); px(g, x + 1, y - 5, 1, 2, mixc(P.melon, "#ffffff", .45)); px(g, x, y - 1, 7, 1, shadec(P.melon, .7)); }
  else if (kind === "potato") { px(g, x, y - 3, 5, 3, P.potato); px(g, x + 1, y - 4, 3, 1, P.potato); px(g, x + 1, y - 3, 1, 1, mixc(P.potato, "#ffffff", .4)); px(g, x + 3, y - 2, 1, 1, shadec(P.potato, .7)); px(g, x, y - 1, 5, 1, shadec(P.potato, .8)); }
  else if (kind === "strawberry") { px(g, x, y - 3, 4, 3, P.strawberry); px(g, x + 1, y - 4, 2, 1, LEAF.base); px(g, x + 1, y - 1, 2, 1, shadec(P.strawberry, .75)); px(g, x + 1, y - 2, 1, 1, "#ffe9a8"); }
}
/* a seed packet hanging from a string; (x, y) is the top of the string */
function seedPacket(g, x, y, col) {
  px(g, x + 2, y, 1, 3, "#8a7a5a");
  px(g, x, y + 3, 5, 7, "#f7f0dc"); px(g, x, y + 3, 5, 1, "#d8cfb2"); px(g, x + 4, y + 3, 1, 7, "#d8cfb2");
  px(g, x + 1, y + 5, 3, 3, col); px(g, x + 1, y + 5, 1, 1, mixc(col, "#ffffff", .5)); px(g, x + 1, y + 9, 3, 1, "#8a7a5a");
}
/* shelf of produce and hanging packets inside a display window: (x, y, w, h) is the glass area */
function windowDisplay(g, x, y, w, h, seed) {
  const r = rng(seed), sy = y + h - 4;
  px(g, x, sy, w, 2, WOOD.dark); px(g, x, sy, w, 1, WOOD.light); px(g, x, sy + 2, w, 1, WOOD.deep);
  const items = ["pumpkin", "turnip", "tomato", "melon", "potato", "strawberry", "turnip"];
  let xx = x + 2, i = Math.floor(r() * items.length);
  while (xx < x + w - 6) { veg(g, xx, sy, items[i % items.length]); i++; xx += 7 + Math.floor(r() * 3); }
  const packets = [ITEM_HEX.tomato, ITEM_HEX.corn, ITEM_HEX.blueberry, ITEM_HEX.pumpkin, ITEM_HEX.radish];
  for (let k = 0, pxx = x + 4; pxx < x + w - 6; pxx += 9, k++) seedPacket(g, pxx, y, packets[(k + Math.floor(seed)) % packets.length]);
}
/* wooden crate with produce piled on top: (x, y) top-left of the box */
function crate(g, x, y, w, h, kind) {
  px(g, x, y, w, h, WOOD.mid); px(g, x, y, w, 1, WOOD.light); px(g, x, y + h - 1, w, 1, WOOD.deep); px(g, x, y, 1, h, WOOD.light); px(g, x + w - 1, y, 1, h, WOOD.dark);
  px(g, x + 1, y + Math.floor(h / 2), w - 2, 1, WOOD.dark); px(g, x + 1, y + 1, 1, 1, WOOD.deep); px(g, x + w - 2, y + 1, 1, 1, WOOD.deep);
  for (let i = 1; i < w - 1; i += 5) px(g, x + i, y + 1, 1, h - 2, mixc(WOOD.mid, WOOD.dark, .5));
  const step = kind === "pumpkin" || kind === "melon" ? 8 : 6;
  for (let i = 0, n = Math.floor((w - 2) / step); i < n; i++) veg(g, x + 1 + i * step, y + 1, kind);
}
/* terracotta pot with a leafy plant; (x, y) bottom-left of the pot */
function pottedPlant(g, x, y) {
  px(g, x + 1, y - 8, 8, 8, "#b8623c"); px(g, x, y - 8, 10, 2, "#d07a4c"); px(g, x, y - 7, 10, 1, "#9a5030"); px(g, x + 1, y - 6, 1, 6, "#d07a4c"); px(g, x + 8, y - 6, 1, 5, "#8a4428"); px(g, x + 1, y - 1, 8, 1, "#8a4428");
  px(g, x + 1, y - 13, 8, 5, LEAF.base); px(g, x + 2, y - 15, 6, 2, LEAF.base); px(g, x + 3, y - 16, 4, 1, LEAF.light); px(g, x + 2, y - 14, 2, 2, LEAF.light); px(g, x + 6, y - 11, 3, 2, LEAF.dark); px(g, x + 4, y - 10, 2, 1, LEAF.dark); px(g, x, y - 11, 2, 2, LEAF.base);
  px(g, x + 6, y - 15, 2, 2, "#ff6b9d"); px(g, x + 6, y - 15, 1, 1, "#ffc2dc"); px(g, x + 2, y - 12, 2, 2, "#ffe066");
}
/* little chalkboard leaning on the wall */
function chalkboard(g, x, y, w, h, label) {
  px(g, x, y, w, h, WOOD.mid); px(g, x, y, w, 1, WOOD.light); px(g, x, y + h - 1, w, 1, WOOD.deep); px(g, x, y, 1, h, WOOD.light); px(g, x + w - 1, y, 1, h, WOOD.dark);
  px(g, x + 2, y + 2, w - 4, h - 4, "#2f3b34");
  text3x5(g, x + 2 + Math.floor((w - 4 - textWidth(label, 1)) / 2), y + 4, label, "#f4f1ea", 1);
  px(g, x + 4, y + h - 5, 3, 1, "#e0524f"); px(g, x + 8, y + h - 5, 3, 1, "#ffe066"); px(g, x + 12, y + h - 5, 3, 1, "#6cc24a"); px(g, x + 16, y + h - 5, 2, 1, "#4a7fe0");
}
/* iron-banded rain barrel, 14 wide 20 tall, top-left at (x, y) */
function rainBarrel(g, x, y) {
  px(g, x, y + 1, 14, 18, WOOD.mid); px(g, x + 1, y, 12, 20, WOOD.mid);
  px(g, x + 1, y + 1, 2, 18, WOOD.light); px(g, x + 11, y + 1, 2, 18, WOOD.dark); px(g, x + 13, y + 2, 1, 16, WOOD.deep); px(g, x + 1, y + 19, 12, 1, WOOD.deep);
  for (let i = 4; i < 12; i += 3) px(g, x + i, y + 1, 1, 18, WOOD.dark);
  px(g, x, y + 4, 14, 2, IRON.base); px(g, x, y + 13, 14, 2, IRON.base); px(g, x, y + 4, 14, 1, IRON.light); px(g, x, y + 13, 14, 1, IRON.light); px(g, x + 12, y + 4, 2, 2, IRON.dark); px(g, x + 12, y + 13, 2, 2, IRON.dark);
  px(g, x + 2, y, 10, 2, "#3d7fbf"); px(g, x + 3, y, 3, 1, "#8ec4ea"); px(g, x + 8, y + 1, 2, 1, "#8ec4ea");
}
/* red-and-white scalloped awning, 14 tall, at (x, y) */
function scallopAwning(g, x, y, w) {
  const S = ["#d9463c", "#f7efdc"], SD = ["#a9342c", "#d5cbb0"], SL = ["#ea6a5c", "#fffaf0"];
  px(g, x - 1, y - 2, w + 2, 2, "#7a2f27"); px(g, x - 1, y - 2, w + 2, 1, "#a9463c");
  for (let i = 0, xx = x; xx < x + w; i++, xx += 8) {
    const k = i % 2, sw = Math.min(8, x + w - xx);
    px(g, xx, y, sw, 11, S[k]); px(g, xx, y, sw, 1, SL[k]); px(g, xx, y + 9, sw, 2, SD[k]);
    if (sw === 8) { px(g, xx + 1, y + 11, 6, 1, S[k]); px(g, xx + 2, y + 12, 4, 1, SD[k]); px(g, xx + 1, y + 11, 6, 1, k ? SD[k] : S[k]); px(g, xx + 3, y + 13, 2, 1, SD[k]); }
    px(g, xx + sw - 1, y, 1, 11, SD[k]);
  }
}

// ------------------------------------------------------------ the three buildings
function farmhouse(g, c, W, H, w, wallX, wallW, wallTop, night, seed) {
  const found = 8, wallBot = H - found, cx = Math.floor(W / 2);
  // walls: stacked logs on a rubble footing, log ends poking out at the corners
  logWall(g, wallX, wallTop, wallW, wallBot - wallTop, c, seed + 1);
  stones(g, wallX, wallBot, wallW, found, seed + 2);
  eaveShadow(g, wallX, wallTop + 3, wallW, c);
  logEnds(g, wallX - 2, wallTop, wallBot - wallTop, c); logEnds(g, wallX + wallW - 5, wallTop, wallBot - wallTop, c);
  // windows with shutters and flower boxes
  const wy = wallTop + 8;
  [1, 3, w - 4, w - 2].forEach((t, n) => {
    if (t < 0 || t >= w) return;
    const x = wallX + t * A + 5;
    px(g, x - 3, wy - 3, 28, 3, c.trim); px(g, x - 3, wy - 3, 28, 1, mixc(c.trim, "#ffffff", .3));
    frameWindow(g, x, wy, 22, 20, night); shutter(g, x - 5, wy + 1, 18); shutter(g, x + 22, wy + 1, 18);
    sill(g, x, wy + 20, 22, c.trim, mixc(c.trim, "#000000", .35)); flowerBox(g, x, wy + 26, 22, seed + 10 + n);
  });
  // the porch deck runs in under the door: the three porch tiles below continue these same boards (see porchTile)
  const mid = Math.floor(w / 2), deckX = wallX + (mid - 1) * A, deckW = 3 * A;
  deckBoards(g, deckX, wallBot, deckW, found, H, seed + 5);              // board seam falls on the OUT row at H-1, the porch tiles pick up the next board at their row 0
  px(g, deckX, wallBot, 1, found, WOOD.deep); px(g, deckX + deckW - 1, wallBot, 1, found, WOOD.deep);
  // door with hood, name plaque above, a lantern beside it
  const doorX = wallX + mid * A + 5, doorY = wallBot - 28;
  plaque(g, cx, wallTop + 4, c.label, 2);
  panelDoor(g, doorX, doorY, 22, 28, c, night, { noStep: true });
  px(g, doorX - 3, wallBot, 28, 1, mixc(WOOD.dark, WOOD.deep, .5));                       // threshold shadow on the deck
  doorHood(g, c, doorX - 9, doorY - 9, 40);
  lantern(g, doorX + 26, doorY + 3, night);
  // rain barrel under a downspout at the right corner, a stack of firewood at the left
  const bx = wallX + wallW - 26;
  px(g, bx + 5, wallTop + 3, 3, H - 24 - wallTop, IRON.base); px(g, bx + 5, wallTop + 3, 1, H - 24 - wallTop, IRON.light); px(g, bx + 7, wallTop + 3, 1, H - 24 - wallTop, IRON.dark);
  px(g, bx + 4, wallTop + 3, 5, 2, IRON.dark); px(g, bx + 4, wallTop + 30, 5, 2, IRON.dark); px(g, bx + 4, H - 24, 5, 3, IRON.dark);
  rainBarrel(g, bx, H - 20);
  logStack(g, wallX + 10, H - 1, 26, 15, seed + 6);
  // roof: hip-shaped shingle face with slanted fascia, a gable dormer over the door and a stone chimney (placed where the game spawns smoke)
  const rTop = 10, rBot = wallTop - 2, inset = (t) => Math.round(16 * (1 - t));
  roofFace(g, c, 1, W - 1, rTop, rBot, inset, seed + 3);                 // eaves stop 1px short of the canvas so the outline can close round the tips
  roofEdges(g, c, 1, W - 1, rTop, rBot, inset);
  gableDormer(g, c, cx, 46, night);
  eaveBoard(g, c, 1, W - 1, rBot);
  ridgeCap(g, c, 13, W - 13, rTop - 4);
  const chx = wallX + Math.round((w - 3.2) * A) - 7;
  px(g, chx - 1, 56, 16, 2, c.roofD);
  stoneChimney(g, chx, 3, 56, seed + 4);
}
function seedShop(g, c, W, H, w, wallX, wallW, wallTop, night, seed) {
  const found = 8, wallBot = H - found, cx = Math.floor(W / 2);
  // cream clapboard walls with corner boards on a stone footing
  clapboard(g, wallX, wallTop, wallW, wallBot - wallTop, c, seed + 1);
  stones(g, wallX, wallBot, wallW, found, seed + 2);
  eaveShadow(g, wallX, wallTop + 3, wallW, c);
  [wallX, wallX + wallW - 5].forEach((x) => { px(g, x, wallTop + 3, 5, wallBot - wallTop - 3, c.trim); px(g, x, wallTop + 3, 1, wallBot - wallTop - 3, mixc(c.trim, "#ffffff", .25)); px(g, x + 4, wallTop + 3, 1, wallBot - wallTop - 3, mixc(c.trim, "#000000", .3)); });
  // display windows (two tiles wide) with produce, planters underneath
  const wy = wallTop + 24;
  [2, w - 4].forEach((t, n) => {
    const x = wallX + t * A + 7, ww = 2 * A - 14;
    frameWindow(g, x, wy, ww, 24, night); windowDisplay(g, x + 2, wy + 2, ww - 4, 20, seed + 20 + n);
    px(g, x + Math.floor(ww / 2) - 1, wy + 2, 2, 20, "#f4e6c4"); px(g, x + Math.floor(ww / 2) + 1, wy + 2, 1, 20, "#c8b68e");
    sill(g, x, wy + 24, ww, c.trim, mixc(c.trim, "#000000", .35)); flowerBox(g, x + 2, wy + 29, ww - 4, seed + 30 + n);
  });
  // door under the awning, a potted plant and an OPEN board
  const doorX = wallX + Math.floor(w / 2) * A + 5, doorY = wallTop + 22;
  panelDoor(g, doorX, doorY, 22, wallBot - doorY, c, night, { winH: 14 });
  pottedPlant(g, doorX - 16, wallBot); chalkboard(g, doorX + 30, wallBot - 16, 22, 16, "OPEN");
  scallopAwning(g, wallX + 3, wallTop + 7, wallW - 6);
  // produce crates stacked by the left corner, seed sacks by the right one
  crate(g, wallX + 8, H - 12, 26, 12, "turnip"); crate(g, wallX + 11, H - 21, 22, 9, "pumpkin");
  sack(g, wallX + wallW - 36, H - 1, ITEM_HEX.tomato); sack(g, wallX + wallW - 22, H - 1, ITEM_HEX.corn);
  // slate roof with a big signboard on posts and a stovepipe
  const rTop = 10, rBot = wallTop - 2, inset = (t) => Math.round(12 * (1 - t));
  roofFace(g, c, 1, W - 1, rTop, rBot, inset, seed + 3, { rowH: 5, shingle: 12 });
  roofEdges(g, c, 1, W - 1, rTop, rBot, inset);
  const tw = textWidth(c.label, 2), bw = tw + 18, bx = cx - Math.floor(bw / 2), by = rBot - 28;
  [bx + 3, bx + bw - 6].forEach((x) => { px(g, x, by - 6, 3, 36, WOOD.dark); px(g, x, by - 6, 1, 36, WOOD.mid); });
  px(g, bx - 1, by - 1, bw + 2, 22, OUT); px(g, bx, by, bw, 20, "#f2e3bf"); px(g, bx, by, bw, 1, "#fff6dc"); px(g, bx, by + 19, bw, 1, "#c9b283"); px(g, bx + bw - 1, by, 1, 20, "#c9b283");
  px(g, bx, by + 2, bw, 2, "#d9463c"); px(g, bx, by + 16, bw, 2, "#d9463c");
  text3x5(g, bx + 9, by + 5, c.label, "#3a2a1a", 2);
  px(g, bx + 3, by + 6, 2, 8, LEAF.base); px(g, bx + 2, by + 5, 4, 2, "#ffe066"); px(g, bx + bw - 5, by + 6, 2, 8, LEAF.base); px(g, bx + bw - 6, by + 5, 4, 2, "#ff6b9d");
  eaveBoard(g, c, 1, W - 1, rBot);
  ridgeCap(g, c, 9, W - 9, rTop - 4);
  stovePipe(g, c, W - 64, 3, 45);                                         // pokes up past the ridge, so it is drawn over the cap
}
function barn(g, c, W, H, w, wallX, wallW, wallTop, night, seed) {
  const found = 8, wallBot = H - found, cx = Math.floor(W / 2), wh = wallBot - wallTop;
  // red planks with white trim on a stone footing
  boardWall(g, wallX, wallTop, wallW, wh, c, seed + 1);
  stones(g, wallX, wallBot, wallW, found, seed + 2);
  eaveShadow(g, wallX, wallTop + 3, wallW, c);
  [wallX, wallX + wallW - 6].forEach((x) => { px(g, x, wallTop + 3, 6, wh - 3, c.trim); px(g, x, wallTop + 3, 1, wh - 3, "#ffffff"); px(g, x + 5, wallTop + 3, 1, wh - 3, c.fasciaD); });
  px(g, wallX, wallBot - 3, wallW, 3, c.trim); px(g, wallX, wallBot - 1, wallW, 1, c.fasciaD);
  // hay-loft door above the big doors
  const lx = cx - 12, ly = wallTop + 3;
  px(g, lx, ly, 24, 16, c.trim); px(g, lx + 23, ly, 1, 16, c.fasciaD); px(g, lx, ly + 15, 24, 1, c.fasciaD);
  px(g, lx + 2, ly + 2, 20, 12, night ? GLASS.night.base : "#3d3128");
  if (night) px(g, lx + 3, ly + 3, 18, 5, GLASS.night.hi);
  for (let i = 0; i < 20; i += 2) px(g, lx + 2 + i, ly + 9 + (i % 4 === 0 ? 0 : 1), 2, 5 - (i % 4 === 0 ? 0 : 1), i % 3 ? "#e3c463" : "#c9a640");
  px(g, lx + 4, ly + 10, 3, 1, "#f2dc8a"); px(g, lx + 13, ly + 11, 2, 1, "#f2dc8a"); px(g, lx + 8, ly + 12, 4, 1, "#b08a30");
  px(g, lx + 11, ly + 2, 2, 12, c.trim); px(g, lx + 12, ly + 2, 1, 12, c.fasciaD);
  // cross-braced double doors with a white frame and a small BARN board on the lintel
  const dw = 44, dx = cx - 22, dy = wallTop + 24, dh = wallBot - dy;
  px(g, dx - 3, dy - 7, dw + 6, dh + 7, c.trim); px(g, dx - 3, dy - 7, dw + 6, 1, "#ffffff"); px(g, dx + dw + 2, dy - 7, 1, dh + 7, c.fasciaD);
  [dx, dx + dw / 2 + 1].forEach((x) => {
    const lw = dw / 2 - 1;
    px(g, x, dy, lw, dh, c.wallD);
    for (let i = 1; i < lw; i += 5) px(g, x + i, dy, 1, dh, c.wallDD);
    px(g, x, dy, lw, 2, c.trim); px(g, x, dy + dh - 2, lw, 2, c.trim); px(g, x, dy, 2, dh, c.trim); px(g, x + lw - 2, dy, 2, dh, c.trim);
    for (let i = 0; i < dh - 4; i++) { const t = Math.round(i * (lw - 6) / (dh - 4)); px(g, x + 2 + t, dy + 2 + i, 2, 1, c.trim); px(g, x + lw - 4 - t, dy + 2 + i, 2, 1, c.trim); }
    px(g, x + 1, dy + 4, 3, 2, IRON.dark); px(g, x + 1, dy + dh - 6, 3, 2, IRON.dark);
  });
  px(g, dx + dw / 2 - 1, dy, 2, dh, OUT); px(g, dx + dw / 2 - 3, dy + 14, 2, 3, IRON.base); px(g, dx + dw / 2 + 1, dy + 14, 2, 3, IRON.base);
  const bw = textWidth(c.label, 1) + 6; px(g, cx - Math.floor(bw / 2), dy - 6, bw, 6, "#3a2a1a"); px(g, cx - Math.floor(bw / 2) + 1, dy - 5, bw - 2, 4, "#5a3a22"); text3x5(g, cx - Math.floor(bw / 2) + 3, dy - 5, c.label, "#f4e6c4", 1);
  px(g, dx - 3, dy + dh, dw + 6, 3, STONE.light); px(g, dx - 3, dy + dh + 2, dw + 6, 1, STONE.dark);
  // side windows with white frames, a lantern by the doors
  [1, w - 2].forEach((t) => { const x = wallX + t * A + 8; frameWindow(g, x, wallTop + 12, 16, 14, night, c.trim, c.fasciaD); sill(g, x, wallTop + 26, 16, c.trim, c.fasciaD); });
  lantern(g, dx + dw + 6, dy + 2, night);
  // hay bales by the left corner, a wagon wheel leaning at the right
  roundBale(g, wallX + 20, H - 10, 9); roundBale(g, wallX + 38, H - 8, 7); px(g, wallX + 12, H - 1, 36, 1, "#8a6a22");
  wagonWheel(g, wallX + wallW - 22, H - 12, 11);
  // gambrel roof: shallow lit upper slope, steep darker lower slope, weathered grey shingles with a little moss
  const rTop = 26, kink = 70, rBot = wallTop - 2;
  const upper = (t) => 6 + Math.round(18 * (1 - t) * (1 - t)), lower = (t) => Math.round(6 * (1 - t));
  const cLow = { roof: mixc(c.roof, c.roofD, .3), roofL: mixc(c.roofL, c.roofD, .25), roofD: c.roofD, roofX: c.roofL, fascia: c.fascia, fasciaD: c.fasciaD };
  roofFace(g, cLow, 1, W - 1, kink, rBot, lower, seed + 3, { moss: "#5f7a3a" });
  roofFace(g, c, 1, W - 1, rTop, kink, upper, seed + 3, { moss: "#6d8544" });
  roofEdges(g, c, 1, W - 1, rTop, kink, upper); roofEdges(g, c, 1, W - 1, kink, rBot, lower);
  px(g, 8, kink - 1, W - 16, 1, c.roofX); px(g, 6, kink, W - 12, 1, c.roofD);
  eaveBoard(g, c, 1, W - 1, rBot);
  ridgeCap(g, c, 21, W - 21, rTop - 4);
  cupola(g, c, cx, 10); weatherVane(g, cx, 1);
  px(g, cx - 10, 24, 20, 2, c.roofD);
}
function buildingSprite(kind, w, h, night) {
  const c = BUILD[kind] || BUILD.W;
  const W = w * A + 2 * OV, H = h * A + TOPPAD;
  return cached("building:" + kind + w + h + night, W, H, (g, cv) => {
    const roofRows = roofRowsFor(h), wallTop = TOPPAD + roofRows * A, wallX = OV, wallW = w * A;
    const seed = 1000 + hash(w, h) % 1000 + kind.charCodeAt(0);
    const draw = kind === "S" ? seedShop : kind === "N" ? barn : farmhouse;
    draw(g, c, W, H, w, wallX, wallW, wallTop, !!night, seed);
    px(g, wallX, H - 1, wallW, 1, OUT);                                   // closes the silhouette under the footing (props there sit on the ground line)
    outline(cv, OUT);
  });
}

// ------------------------------------------------------------ porch and chimney
function porchTile(part) {
  /* wooden deck in front of the farmhouse door: part = "L", "M" (with the steps and a doormat) or "R" (mirror of L) */
  if (part === "R") return mirrored("porch:R", porchTile("L"));
  return cached("porch:" + part, A, A, (g, cv) => {
    // boards on the same 6px cadence as the strip under the farmhouse door (its last seam is the building's bottom OUT row, so a board edge falls on y = 0 here)
    deckBoards(g, 0, 0, A, 22, 0, part === "M" ? 71 : 53);
    // front fascia board with a lit top edge and a dark underside
    px(g, 0, 22, A, 5, WOOD.mid); px(g, 0, 22, A, 1, mixc(WOOD.light, "#ffffff", .2)); px(g, 0, 23, A, 1, WOOD.light); px(g, 0, 26, A, 1, WOOD.deep);
    for (let x = 4; x < A; x += 8) px(g, x, 24, 1, 2, WOOD.dark);
    if (part === "M") {
      // a broad wooden step below the fascia (with an OUT row beneath it) and a woven doormat on the deck
      px(g, 1, 27, 30, 4, WOOD.mid); px(g, 1, 27, 30, 1, mixc(WOOD.light, "#ffffff", .25)); px(g, 1, 28, 30, 1, WOOD.light); px(g, 1, 30, 30, 1, WOOD.dark); px(g, 2, 30, 28, 1, WOOD.deep);
      px(g, 1, 27, 1, 3, WOOD.light); px(g, 30, 27, 1, 3, WOOD.deep); px(g, 1, 31, 30, 1, OUT);
      for (let x = 6; x < 30; x += 9) px(g, x, 29, 1, 1, WOOD.deep);
      px(g, 9, 6, 14, 10, "#a9714a"); px(g, 9, 6, 14, 1, "#c48e62"); px(g, 9, 15, 14, 1, "#7d5032"); px(g, 9, 6, 1, 10, "#c48e62"); px(g, 22, 6, 1, 10, "#7d5032");
      for (let y = 8; y < 14; y += 2) for (let x = 11; x < 21; x += 2) px(g, x + ((y >> 1) & 1), y, 1, 1, "#8d5c3a");
      px(g, 11, 7, 10, 1, "#c96e4c"); px(g, 11, 14, 10, 1, "#c96e4c"); px(g, 9, 16, 14, 1, mixc(WOOD.dark, WOOD.deep, .5));
    }
    if (part === "L") {
      // railing along the front: a tall corner post, a shorter post by the steps, a lit top rail and turned balusters; the posts stand on the deck
      px(g, 1, 2, 4, 20, WOOD.mid); px(g, 1, 2, 1, 20, WOOD.light); px(g, 4, 2, 1, 20, WOOD.dark); px(g, 0, 0, 6, 2, WOOD.light); px(g, 0, 1, 6, 1, WOOD.mid); px(g, 1, 2, 4, 1, WOOD.dark);
      px(g, 27, 7, 4, 15, WOOD.mid); px(g, 27, 7, 1, 15, WOOD.light); px(g, 30, 7, 1, 15, WOOD.dark); px(g, 26, 5, 6, 2, WOOD.light); px(g, 26, 6, 6, 1, WOOD.mid); px(g, 27, 7, 4, 1, WOOD.dark);
      px(g, 5, 11, 22, 3, WOOD.light); px(g, 5, 11, 22, 1, mixc(WOOD.light, "#ffffff", .3)); px(g, 5, 13, 22, 1, WOOD.dark);
      for (let x = 8; x < 27; x += 5) { px(g, x, 14, 2, 8, WOOD.mid); px(g, x, 14, 1, 8, WOOD.light); px(g, x, 17, 2, 1, WOOD.dark); px(g, x, 21, 2, 1, WOOD.dark); }
      px(g, 5, 21, 22, 2, WOOD.mid); px(g, 5, 21, 22, 1, WOOD.light); px(g, 5, 22, 22, 1, WOOD.dark);
      px(g, 5, 26, 22, 1, WOOD.deep);
      // the deck's outer end: a dark end-grain cap on the fascia board and an OUT column so the silhouette closes (R is the mirror, so it gets the same at x = 31)
      px(g, 1, 22, 2, 5, WOOD.dark); px(g, 2, 23, 1, 3, WOOD.deep); px(g, 1, 26, 2, 1, WOOD.deep); px(g, 1, 23, 1, 1, WOOD.mid);
      px(g, 0, 0, 1, 27, OUT);
    }
    outline(cv, OUT);
  });
}
function chimneySprite() {
  return cached("chimney", 14, 20, (g) => {
    stones(g, 2, 4, 10, 16, 77);
    px(g, 10, 4, 2, 16, STONE.dark); px(g, 2, 4, 1, 16, STONE.light);
    px(g, 0, 0, 14, 4, STONE.base); px(g, 0, 0, 14, 1, STONE.lighter); px(g, 0, 3, 14, 1, STONE.dark); px(g, 13, 1, 1, 2, STONE.dark);
    px(g, 3, 1, 8, 2, STONE.deep); px(g, 4, 2, 6, 1, "#3a3835");
    outline(g.canvas, OUT);
  });
}

Object.assign(window.ART, { HOUSE, roofTile, wallTile, doorTile, porchTile, chimneySprite, BUILD, OV, TOPPAD, roofRowsFor, buildingSprite });
})();
