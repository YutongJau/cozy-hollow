/* Cozy Hollow art - props
   fences, gate, rocks, barrels, crates, hay, mailbox, lamp, bench, well, stump, wood pile, signpost, bin, board, sprinkler, lily pads, bushes and trees.
   Draw only with px() (fillRect) and drawImage at integer coordinates; finish sprites with outline(canvas, OUT).
   Every material uses four tones (shadow, base, light, highlight) lit from the top-left.
   Render any sprite to a PNG to check it:  node tools/render.js out.png 5 "expr" ...   (expr evaluated against ART) */
"use strict";
(function () {
const { A, cache, blank, px, hash, rng, hex, rgb, shade, mix, cached, outline, mirrored, OUT, COLORS, ITEM_HEX, SEASON, TREE_PAL, WOOD, text3x5, textWidth } = window.ART;
const ART = window.ART;

// ------------------------------------------------------------ material palettes
const WD = { deep: WOOD.deep, dark: WOOD.dark, mid: WOOD.mid, light: WOOD.light, hi: "#f0cf9a" };
const CUT = { deep: "#9c7440", dark: "#c9a36b", mid: "#e2c48a", light: "#f3dfb0" };          // sawn wood faces
const STONE = { deep: "#474a52", dark: "#666a70", mid: "#8b8e8c", light: "#b1b3ae", hi: "#d8d9d2" };
const IRON = { deep: "#1f2025", dark: "#383a41", mid: "#54575f", light: "#7b7e87", hi: "#a9acb5" };
const HAY = { deep: "#8c6a1c", dark: "#bd962e", mid: "#e0c258", light: "#f0d97a", hi: "#fcefad" };
const LEAF = { deep: "#2c6628", dark: "#3f8f3a", mid: "#5fb04a", light: "#8ed66a", hi: "#c6f09a" };
const ROOF = { deep: "#5a2e1c", dark: "#7a4028", mid: "#a4593a", light: "#c97b52", hi: "#e3a47c" };
const CORK_SHADE = "#a67f4c";                                                                // solid shadow tone the pinned notes cast on the cork

// ------------------------------------------------------------ small drawing helpers
function disc(g, cx, cy, r, col) { const rr = (r + 0.5) * (r + 0.5); for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y < rr) px(g, cx + x, cy + y, 1, 1, col); }
function speckle(g, x, y, w, h, col, every, seed) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (hash(i * 7 + seed, j * 3 + seed) % every === 0) px(g, i, j, 1, 1, col); }
function board(g, x, y, w, h) { px(g, x, y, w, h, WD.light); px(g, x, y, w, 1, WD.hi); px(g, x, y + h - 1, w, 1, WD.dark); }
function boardV(g, x, y, w, h) { px(g, x, y, w, h, WD.light); px(g, x, y, 1, h, WD.hi); px(g, x + w - 1, y, 1, h, WD.dark); }
function rows(g, list, col) { list.forEach(([y, x0, x1]) => px(g, x0, y, x1 - x0 + 1, 1, col)); }
function blades(g, x, y, h) { px(g, x, y, 1, h, LEAF.dark); px(g, x + 1, y + 1, 1, h - 1, LEAF.mid); px(g, x - 1, y + 1, 1, h - 1, LEAF.mid); }

// ------------------------------------------------------------ fences and gate
function fencePost(g, x, y, w, h) {
  /* square post: light left face, dark right face, grain, a bevelled cap and a dark foot. (x,y) is the top-left of the body. */
  px(g, x, y, w, h, WD.mid); px(g, x, y, 2, h, WD.light); px(g, x + w - 2, y, 2, h, WD.dark); px(g, x + w - 1, y, 1, h, WD.deep);
  px(g, x + 3, y + 4, 1, 4, WD.dark); px(g, x + 3, y + 11, 1, 3, WD.dark);
  px(g, x - 1, y - 2, w + 2, 2, WD.light); px(g, x, y - 3, w, 1, WD.hi); px(g, x + 1, y - 4, w - 2, 1, WD.hi); px(g, x - 1, y, w + 2, 1, WD.dark);
  px(g, x, y + h - 2, w, 2, WD.deep);
}
function fenceSprite(mask) {
  /* mask bits: 1 north, 2 east, 4 south, 8 west. A post in the middle, two horizontal boards toward E/W, two slim rails toward N/S. */
  return cached("fence:" + mask, A, A, (g, c) => {
    const N = mask & 1, E = mask & 2, S = mask & 4, W_ = mask & 8;
    const railH = (x0, x1) => [10, 18].forEach((y) => { board(g, x0, y, x1 - x0, 4); speckle(g, x0, y + 1, x1 - x0, 2, WD.mid, 9, y); });
    const railV = (y0, y1) => [12, 18].forEach((x) => { px(g, x, y0, 2, y1 - y0, WD.light); px(g, x + 1, y0, 1, y1 - y0, WD.dark); });
    if (E) railH(16, 32);
    if (W_) railH(0, 16);
    if (N) railV(0, 9);
    if (S) railV(25, 32);
    fencePost(g, 12, 8, 8, 18);
    if (E) { px(g, 22, 11, 1, 1, WD.deep); px(g, 22, 19, 1, 1, WD.deep); }
    if (W_) { px(g, 9, 11, 1, 1, WD.deep); px(g, 9, 19, 1, 1, WD.deep); }
    outline(c, OUT);
  });
}
function gateLeaf(g, x0, x1, top, h) {
  /* a flat-topped gate leaf between columns x0..x1 (rows top..top+h-1): two stiles, a straight top and bottom board and one diagonal
     brace running from the foot of the hinge stile up to the head of the latch stile (a Z-brace, so the leaf cannot sag) */
  const bot = top + h - 1, w = x1 - x0 + 1;
  [x0, x1 - 1].forEach((x) => { px(g, x, top, 2, h, WD.mid); px(g, x, top, 1, h, WD.light); px(g, x, top, 2, 1, WD.hi); px(g, x, bot, 2, 1, WD.deep); });
  board(g, x0 + 2, top + 1, w - 4, 4); board(g, x0 + 2, bot - 4, w - 4, 4);
  speckle(g, x0 + 3, top + 2, w - 6, 2, WD.mid, 9, x0); speckle(g, x0 + 3, bot - 3, w - 6, 2, WD.mid, 9, x1);
  const bx0 = x0 + 2, bx1 = x1 - 2, by0 = bot - 5, by1 = top + 5;
  for (let x = bx0; x <= bx1; x++) { const y = Math.round(by0 - (x - bx0) * (by0 - by1) / (bx1 - bx0)); px(g, x, y, 1, 2, WD.mid); px(g, x, y, 1, 1, WD.light); px(g, x, y + 2, 1, 1, WD.dark); }
}
function gateSprite(vertical) {
  return cached("gate:" + vertical, A, A, (g, c) => {
    if (!vertical) {
      /* fence runs east-west: posts left and right, the leaf hinged on the left post and swung open toward the viewer */
      [10, 18].forEach((y) => { board(g, 0, y, 3, 4); board(g, 29, y, 3, 4); });      // stubs meeting the neighbours' rails
      fencePost(g, 2, 6, 6, 20); fencePost(g, 24, 6, 6, 20);
      gateLeaf(g, 8, 19, 9, 16);
      px(g, 7, 11, 3, 2, IRON.dark); px(g, 7, 21, 3, 2, IRON.dark); px(g, 8, 11, 1, 1, IRON.hi); px(g, 8, 21, 1, 1, IRON.hi);   // hinge plates
    } else {
      /* fence runs north-south: posts top and bottom, the leaf hinged on the top post and swung sideways into the tile */
      px(g, 11, 0, 10, 2, WD.light); px(g, 12, 0, 8, 1, WD.hi); px(g, 12, 2, 8, 11, WD.mid); px(g, 12, 2, 2, 11, WD.light); px(g, 18, 2, 2, 11, WD.dark); px(g, 19, 2, 1, 11, WD.deep); px(g, 11, 2, 10, 1, WD.dark);
      px(g, 15, 5, 1, 4, WD.dark); px(g, 12, 11, 8, 2, WD.deep);
      fencePost(g, 12, 24, 8, 8);
      gateLeaf(g, 20, 30, 5, 15);
      px(g, 19, 7, 3, 2, IRON.dark); px(g, 19, 11, 3, 2, IRON.dark); px(g, 20, 7, 1, 1, IRON.hi); px(g, 20, 11, 1, 1, IRON.hi);   // hinge plates on the post's flank
    }
    outline(c, OUT);
  });
}

// ------------------------------------------------------------ lily pad
function lilyPad(v) {
  return cached("lily" + v, A, A, (g, c) => {
    const cx = 15, cy = 16, r = 8, flip = v >= 2 ? -1 : 1;
    const PAD = { dark: "#3a8531", mid: "#52a83f", light: "#76c65a", hi: "#a6e08a" };
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > r + 0.4) continue;
      const a = Math.atan2(y, x * flip);
      if (d > 2.2 && a > -1.15 && a < -0.45) continue;                                  // the notch
      let col = d > r - 1.3 ? PAD.dark : PAD.mid;
      if (d < r - 2.4 && x * flip < 1 && y < 1) col = PAD.light;
      if (d < r - 4 && x * flip < -1 && y < -1) col = PAD.hi;
      if (d < 1.6) col = PAD.dark;
      px(g, cx + x, cy + y, 1, 1, col);
    }
    [0.6, 2.0, 3.4, 4.6].forEach((a) => { for (let d = 2; d < r - 1.5; d++) px(g, cx + Math.round(Math.cos(a) * d) * flip, cy + Math.round(Math.sin(a) * d), 1, 1, PAD.dark); });   // veins
    if (v % 2) {
      const fx = cx + 5 * flip, fy = 10;
      px(g, fx - 3, fy - 1, 7, 3, "#ff86bd"); px(g, fx - 1, fy - 3, 3, 7, "#ff86bd"); px(g, fx - 2, fy - 2, 5, 5, "#ff86bd");
      px(g, fx - 1, fy - 1, 3, 3, "#ffc4dd"); px(g, fx - 2, fy, 1, 1, "#ffc4dd"); px(g, fx + 2, fy, 1, 1, "#ffc4dd"); px(g, fx, fy - 2, 1, 1, "#ffc4dd"); px(g, fx, fy + 2, 1, 1, "#ffc4dd");
      px(g, fx, fy, 1, 1, "#ffd75a"); px(g, fx - 1, fy - 1, 1, 1, "#fff1f6");
    }
    outline(c, OUT);
  });
}

// ------------------------------------------------------------ props & objects
function rock(g) {
  rows(g, [[9, 12, 19], [10, 10, 22], [11, 8, 24], [12, 6, 25], [13, 5, 26], [14, 4, 27], [15, 4, 27], [16, 4, 27], [17, 4, 28], [18, 4, 28], [19, 4, 28], [20, 4, 28], [21, 4, 28], [22, 5, 27], [23, 5, 27], [24, 6, 27], [25, 7, 26], [26, 9, 24]], STONE.mid);
  rows(g, [[10, 11, 18], [11, 9, 20], [12, 7, 19], [13, 6, 17], [14, 5, 15], [15, 5, 13], [16, 5, 11], [17, 5, 9]], STONE.light);
  rows(g, [[10, 12, 15], [11, 10, 13], [12, 8, 10], [9, 13, 16]], STONE.hi);
  rows(g, [[16, 24, 27], [17, 23, 28], [18, 22, 28], [19, 21, 28], [20, 20, 28], [21, 19, 28], [22, 16, 27], [23, 12, 27], [24, 9, 27], [25, 7, 26]], STONE.dark);
  rows(g, [[24, 20, 27], [25, 14, 26], [26, 9, 24], [22, 24, 27], [23, 22, 27]], STONE.deep);
  speckle(g, 6, 12, 18, 10, STONE.dark, 11, 3); speckle(g, 8, 17, 16, 6, STONE.light, 13, 4);
  [[13, 19], [14, 20], [15, 20], [16, 21], [17, 21], [18, 22], [19, 22], [20, 23], [12, 11], [13, 12], [14, 12]].forEach(([y, x]) => px(g, x, y, 1, 1, STONE.deep));
  [[22, 5], [23, 6], [23, 7], [24, 7], [24, 8], [21, 5], [25, 26], [24, 25]].forEach(([y, x]) => px(g, x, y, 1, 1, LEAF.dark));
  [[22, 6], [23, 8], [25, 25]].forEach(([y, x]) => px(g, x, y, 1, 1, LEAF.mid));
  px(g, 27, 25, 3, 2, STONE.mid); px(g, 27, 25, 2, 1, STONE.light); px(g, 1, 24, 3, 2, STONE.mid); px(g, 1, 24, 2, 1, STONE.light); px(g, 3, 25, 1, 1, STONE.dark);
}
function barrel(g, x, y) {
  /* 13 wide, 19 tall: bulging staves, a wooden lid and three iron bands */
  const w = (r) => (r >= 4 && r <= 14 ? [x - 1, 15] : (r === 0 || r === 18 ? [x + 1, 11] : [x, 13]));
  for (let r = 0; r < 19; r++) {
    const [x0, ww] = w(r);
    px(g, x0, y + r, ww, 1, WD.mid); px(g, x0, y + r, 2, 1, WD.light); px(g, x0 + 1, y + r, 1, 1, WD.hi);
    px(g, x0 + 4, y + r, 1, 1, WD.dark); px(g, x0 + 8, y + r, 1, 1, WD.dark); px(g, x0 + ww - 3, y + r, 3, 1, WD.dark); px(g, x0 + ww - 1, y + r, 1, 1, WD.deep);
  }
  px(g, x + 1, y, 11, 1, WD.dark); px(g, x, y + 1, 13, 2, WD.dark); px(g, x + 2, y + 1, 9, 1, CUT.mid); px(g, x + 3, y + 2, 7, 1, CUT.dark); px(g, x + 3, y + 1, 3, 1, CUT.light);
  [[3, 4], [9, 10], [15, 16]].forEach(([r0, r1]) => {
    const [x0, w0] = w(r0), [x1, w1] = w(r1);
    px(g, x0, y + r0, w0, 1, IRON.light); px(g, x1, y + r1, w1, 1, IRON.mid); px(g, x1 + w1 - 2, y + r0, 2, 2, IRON.dark); px(g, x0 + 3, y + r0, 1, 1, IRON.hi);
  });
  px(g, x + 2, y + 18, 9, 1, WD.deep);
}
function crate(g) {
  px(g, 5, 4, 26, 3, WD.light); px(g, 5, 4, 26, 1, WD.hi); px(g, 6, 6, 24, 1, WD.mid); speckle(g, 6, 5, 24, 2, WD.mid, 9, 8);
  px(g, 28, 7, 3, 21, WD.dark); px(g, 30, 7, 1, 21, WD.deep); px(g, 28, 12, 3, 1, WD.deep); px(g, 28, 22, 3, 1, WD.deep);
  px(g, 3, 7, 25, 21, WD.mid); [12, 17, 22].forEach((y) => px(g, 6, y, 19, 1, WD.dark)); speckle(g, 6, 10, 19, 15, WD.dark, 12, 2); speckle(g, 6, 10, 19, 15, WD.light, 14, 6);
  board(g, 3, 7, 25, 3); board(g, 3, 25, 25, 3); boardV(g, 3, 7, 3, 21); boardV(g, 25, 7, 3, 21);
  for (let i = 0; i < 15; i++) {
    const xa = 6 + Math.round(i * 16 / 14), xb = 22 - Math.round(i * 16 / 14);
    px(g, xa, 10 + i, 3, 1, WD.light); px(g, xa + 3, 10 + i, 1, 1, WD.deep);
    px(g, xb, 10 + i, 3, 1, WD.light); px(g, xb + 3, 10 + i, 1, 1, WD.deep);
  }
  px(g, 14, 16, 3, 3, WD.light); px(g, 15, 17, 1, 1, WD.deep);
  [[4, 8], [26, 8], [4, 26], [26, 26]].forEach(([x, y]) => px(g, x, y, 1, 1, WD.deep));
}
function hayBale(g) {
  const fx = 11, fy = 18, r = 9;
  for (let y = -r; y <= r; y++) {
    const ex = Math.floor(6 * Math.sqrt(Math.max(0, 1 - (y * y) / 90)));
    const x1 = 23 + ex, yy = fy + y;
    px(g, fx, yy, x1 - fx + 1, 1, y <= -6 ? HAY.light : (y >= 6 ? HAY.dark : HAY.mid));
    if ((yy + (hash(yy, 3) % 2)) % 3 === 0) px(g, fx + 2 + (hash(yy, 5) % 3), yy, x1 - fx - 4, 1, y >= 5 ? HAY.deep : HAY.dark);
    px(g, x1 - 1, yy, 2, 1, y < -3 ? HAY.dark : HAY.deep);
    if (y === r) px(g, fx, yy, x1 - fx, 1, HAY.deep);
  }
  speckle(g, 12, 10, 16, 16, HAY.hi, 9, 11); speckle(g, 12, 12, 16, 15, HAY.deep, 13, 12);
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.sqrt(x * x + y * y);
    if (d > r + 0.4) continue;
    const a = (Math.atan2(y, x) + Math.PI) / (2 * Math.PI), ring = Math.floor((d + a * 2.6) / 2.6);
    let col = ring % 2 ? HAY.dark : HAY.light;
    if (d > r - 1.2) col = HAY.deep;
    else if (d < 1.4) col = HAY.deep;
    else if (col === HAY.light && x < 0 && y < 0) col = HAY.hi;
    else if (col === HAY.dark && x > 2 && y > 2) col = HAY.deep;
    px(g, fx + x, fy + y, 1, 1, col);
  }
  px(g, 2, 28, 4, 1, HAY.light); px(g, 24, 28, 4, 1, HAY.dark); px(g, 29, 27, 2, 1, HAY.light); px(g, 7, 29, 2, 1, HAY.dark);
}
function mailbox(g) {
  const B = { deep: "#2c4664", dark: "#3f5f88", mid: "#5f7fa8", light: "#8fb0d8", hi: "#c0d8f2" };
  px(g, 14, 16, 4, 14, WD.dark); px(g, 14, 16, 1, 14, WD.mid); px(g, 17, 16, 1, 14, WD.deep); px(g, 13, 29, 6, 2, WD.deep); px(g, 12, 16, 8, 1, WD.deep);
  px(g, 9, 4, 15, 1, B.light); px(g, 8, 5, 17, 1, B.light); px(g, 7, 6, 19, 10, B.mid); px(g, 7, 6, 19, 1, B.light); px(g, 9, 5, 6, 1, B.hi); px(g, 10, 4, 3, 1, B.hi);
  px(g, 7, 6, 1, 8, B.light); px(g, 7, 13, 19, 3, B.dark); px(g, 8, 16, 17, 1, B.deep); px(g, 24, 5, 2, 11, B.dark); px(g, 25, 6, 1, 10, B.deep);
  px(g, 20, 6, 5, 10, B.dark); px(g, 21, 7, 3, 8, B.mid); px(g, 21, 7, 3, 1, B.light); px(g, 22, 10, 1, 2, "#f2c744"); px(g, 22, 10, 1, 1, "#fff0a0");
  px(g, 10, 8, 8, 4, "#f7f1e3"); px(g, 11, 9, 6, 1, "#8a7a6a"); px(g, 11, 11, 4, 1, "#8a7a6a"); px(g, 10, 11, 8, 1, "#d8cdb8");
  px(g, 4, 5, 2, 9, "#a82d2b"); px(g, 4, 5, 1, 9, "#e0524f"); px(g, 1, 3, 6, 4, "#e0524f"); px(g, 1, 3, 6, 1, "#ff8f88"); px(g, 1, 6, 6, 1, "#a82d2b"); px(g, 6, 9, 2, 2, IRON.dark);
}
function lamp(g) {
  px(g, 9, 29, 14, 2, IRON.dark); px(g, 9, 29, 14, 1, IRON.mid); px(g, 11, 27, 10, 2, IRON.mid); px(g, 11, 27, 10, 1, IRON.light); px(g, 9, 30, 14, 1, IRON.deep);
  px(g, 14, 13, 4, 14, IRON.mid); px(g, 14, 13, 1, 14, IRON.light); px(g, 17, 13, 1, 14, IRON.deep); px(g, 13, 24, 6, 2, IRON.dark); px(g, 13, 24, 6, 1, IRON.light); px(g, 13, 13, 6, 1, IRON.dark); px(g, 13, 14, 6, 1, IRON.light);
  px(g, 10, 4, 12, 9, IRON.dark); px(g, 10, 4, 1, 9, IRON.mid);
  px(g, 12, 5, 8, 7, "#ffe9a8"); px(g, 12, 5, 3, 3, "#fff7dc"); px(g, 12, 10, 8, 2, "#f2c15a"); px(g, 19, 6, 1, 6, "#f2c15a"); px(g, 16, 5, 1, 7, IRON.mid); px(g, 15, 7, 2, 3, "#fff7dc");
  px(g, 9, 3, 14, 1, IRON.mid); px(g, 11, 2, 10, 1, IRON.dark); px(g, 13, 1, 6, 1, IRON.mid); px(g, 13, 1, 3, 1, IRON.light); px(g, 15, 0, 2, 1, IRON.light);
  px(g, 9, 12, 14, 1, IRON.dark); px(g, 8, 6, 2, 1, IRON.mid); px(g, 22, 6, 2, 1, IRON.mid); px(g, 8, 12, 2, 1, IRON.mid); px(g, 22, 12, 2, 1, IRON.mid);
}
function bench(g) {
  /* park bench: two pale back slats between uprights, a mid-tone plank seat with a dark front edge, legs and a stretcher */
  px(g, 2, 3, 3, 10, WD.mid); px(g, 2, 3, 1, 10, WD.light); px(g, 4, 3, 1, 10, WD.dark); px(g, 27, 3, 3, 10, WD.mid); px(g, 27, 3, 1, 10, WD.light); px(g, 29, 3, 1, 10, WD.dark);
  px(g, 2, 2, 3, 1, WD.light); px(g, 27, 2, 3, 1, WD.light);
  board(g, 5, 4, 22, 3); board(g, 5, 8, 22, 3); speckle(g, 6, 5, 20, 1, WD.mid, 7, 4); speckle(g, 6, 9, 20, 1, WD.mid, 7, 5);
  px(g, 1, 12, 30, 1, WD.hi); px(g, 1, 13, 30, 1, WD.light); px(g, 1, 14, 30, 1, WD.mid);                               // back plank
  px(g, 1, 15, 30, 1, WD.deep);                                                                                          // plank seam
  px(g, 1, 16, 30, 1, WD.hi); px(g, 1, 17, 30, 1, WD.light); px(g, 1, 18, 30, 1, WD.mid);                               // front plank
  px(g, 1, 19, 30, 1, WD.light); px(g, 1, 20, 30, 1, WD.dark); px(g, 1, 21, 30, 1, WD.deep);                            // lit front-edge lip over the dark front face
  speckle(g, 2, 14, 28, 1, WD.dark, 8, 6); speckle(g, 2, 18, 28, 1, WD.dark, 8, 7);
  px(g, 30, 13, 1, 8, WD.dark); px(g, 1, 20, 1, 2, WD.mid);
  px(g, 4, 21, 3, 6, WD.dark); px(g, 25, 21, 3, 6, WD.dark); px(g, 4, 21, 1, 6, WD.mid); px(g, 25, 21, 1, 6, WD.mid); px(g, 3, 26, 5, 1, WD.deep); px(g, 24, 26, 5, 1, WD.deep);
  px(g, 7, 23, 18, 2, WD.mid); px(g, 7, 23, 18, 1, WD.light); px(g, 7, 24, 18, 1, WD.dark);
}
function well(g) {
  px(g, 4, 16, 24, 14, STONE.mid);
  const stones = (y, off) => { for (let x = 4 + off; x < 28; x += 5) { px(g, x, y, 1, 3, STONE.deep); if (x + 1 < 28) px(g, x + 1, y, Math.min(2, 27 - x), 1, STONE.light); } };
  stones(17, 0); px(g, 4, 20, 24, 1, STONE.deep); stones(21, 2); px(g, 4, 24, 24, 1, STONE.deep); stones(25, 0); px(g, 4, 28, 24, 1, STONE.dark); px(g, 4, 29, 24, 1, STONE.deep);
  px(g, 24, 17, 4, 13, STONE.dark); px(g, 27, 17, 1, 13, STONE.deep); speckle(g, 5, 17, 19, 12, STONE.dark, 9, 5);
  px(g, 5, 15, 22, 1, STONE.light); px(g, 6, 14, 20, 1, STONE.hi); px(g, 4, 16, 24, 1, STONE.light);
  px(g, 9, 16, 14, 4, "#173049"); px(g, 10, 17, 12, 2, "#2c5a86"); px(g, 11, 17, 4, 1, "#5fa8e0"); px(g, 9, 19, 14, 1, "#112536");
  px(g, 6, 7, 2, 10, WD.dark); px(g, 6, 7, 1, 10, WD.mid); px(g, 24, 7, 2, 10, WD.dark); px(g, 24, 7, 1, 10, WD.mid);
  px(g, 8, 8, 16, 2, WD.mid); px(g, 8, 8, 16, 1, WD.light); px(g, 26, 8, 2, 1, IRON.dark); px(g, 27, 6, 1, 3, IRON.mid);      // axle with a crank
  px(g, 12, 10, 1, 1, IRON.dark); px(g, 19, 10, 1, 1, IRON.dark); px(g, 13, 9, 6, 1, IRON.dark); px(g, 15, 9, 1, 1, "#e8d8a8"); px(g, 15, 10, 1, 1, "#e8d8a8");
  px(g, 12, 11, 8, 5, WD.mid); px(g, 12, 11, 8, 1, WD.light); px(g, 12, 11, 1, 5, WD.light); px(g, 12, 13, 8, 1, IRON.mid); px(g, 13, 13, 1, 1, IRON.hi); px(g, 12, 15, 8, 1, WD.dark); px(g, 19, 11, 1, 5, WD.dark);
  rows(g, [[0, 14, 17], [1, 12, 19], [2, 10, 21], [3, 8, 23], [4, 6, 25], [5, 4, 27], [6, 2, 29]], ROOF.mid);
  rows(g, [[1, 12, 15], [3, 8, 15], [5, 4, 15]], ROOF.light); rows(g, [[1, 16, 19], [3, 16, 23], [5, 16, 27]], ROOF.dark);
  rows(g, [[0, 14, 17], [2, 10, 12], [4, 6, 9]], ROOF.hi); px(g, 2, 7, 28, 1, ROOF.deep); [[2, 13], [2, 18], [4, 11], [4, 21], [6, 7], [6, 15], [6, 24]].forEach(([y, x]) => px(g, x, y, 1, 1, ROOF.deep));
}
function shippingBin(g) {
  px(g, 2, 12, 28, 16, WD.mid); [17, 22].forEach((y) => px(g, 5, y, 22, 1, WD.dark)); speckle(g, 5, 13, 22, 14, WD.dark, 12, 21); speckle(g, 5, 13, 22, 14, WD.light, 15, 22);
  px(g, 2, 12, 3, 16, WD.light); px(g, 3, 12, 1, 16, WD.hi); px(g, 27, 12, 3, 16, WD.dark); px(g, 29, 12, 1, 16, WD.deep); px(g, 2, 26, 28, 2, WD.deep);
  [[2, 12], [27, 12], [2, 25], [27, 25]].forEach(([x, y]) => { px(g, x, y, 3, 3, IRON.dark); px(g, x + 1, y + 1, 1, 1, IRON.hi); });
  px(g, 1, 6, 30, 6, WD.light); px(g, 1, 6, 30, 1, WD.hi); px(g, 1, 9, 30, 1, WD.mid); px(g, 1, 11, 30, 1, WD.dark); px(g, 30, 7, 1, 5, WD.dark); speckle(g, 2, 7, 28, 4, WD.mid, 11, 5);
  px(g, 5, 12, 22, 1, WD.deep);
  disc(g, 16, 20, 4, "#f2c744"); px(g, 14, 17, 3, 1, "#ffe680"); px(g, 13, 18, 1, 2, "#ffe680"); px(g, 15, 23, 3, 1, "#c9931e"); px(g, 19, 19, 1, 3, "#c9931e"); px(g, 18, 22, 1, 1, "#c9931e");
  px(g, 15, 19, 2, 3, "#c9931e"); px(g, 15, 19, 1, 1, "#ffe680"); px(g, 15, 18, 3, 1, "#c9931e"); px(g, 14, 22, 3, 1, "#c9931e");
}
function noticeBoard(g) {
  px(g, 5, 19, 3, 12, WD.dark); px(g, 5, 19, 1, 12, WD.mid); px(g, 24, 19, 3, 12, WD.dark); px(g, 24, 19, 1, 12, WD.mid); px(g, 4, 30, 5, 1, WD.deep); px(g, 23, 30, 5, 1, WD.deep);
  px(g, 2, 3, 28, 17, WD.mid); px(g, 2, 3, 28, 1, WD.light); px(g, 2, 3, 1, 17, WD.light); px(g, 29, 3, 1, 17, WD.dark); px(g, 2, 19, 28, 1, WD.dark); px(g, 3, 18, 26, 1, WD.dark);
  px(g, 0, 1, 32, 2, WD.dark); px(g, 0, 1, 32, 1, WD.light); px(g, 1, 3, 30, 1, WD.deep);
  px(g, 4, 5, 24, 13, "#c9a06a"); speckle(g, 4, 5, 24, 13, "#b98e5a", 5, 1); speckle(g, 4, 5, 24, 13, "#dcb97e", 6, 2);
  const note = (x, y, w, h, col, pin) => { px(g, x + 1, y + 1, w, h, CORK_SHADE); px(g, x, y, w, h, col); for (let l = y + 2; l < y + h - 1; l += 2) px(g, x + 1, l, w - 3, 1, "#8a7a6a"); px(g, x + (w >> 1), y, 1, 1, pin); px(g, x + (w >> 1) + 1, y + 1, 1, 1, "#8a7a6a"); };
  note(5, 6, 8, 7, "#f7f1e3", "#e0524f"); note(14, 5, 8, 6, "#f7e27a", "#4a7fe0"); note(19, 10, 8, 7, "#f5b3c8", "#3fa34d"); note(6, 13, 7, 4, "#c8e8f7", "#e0524f");
}
function flowers(g) {
  const cols = ["#ff6b9d", "#f2c744", "#ffffff", "#e0524f", "#c58aff", "#ff9c4a", "#ff6b9d"], his = ["#ffc2d6", "#fff0a0", "#ffffff", "#ff9a98", "#e8d0ff", "#ffd2a8", "#ffc2d6"];
  [[3, 24], [8, 26], [13, 25], [18, 27], [23, 24], [28, 26], [10, 21], [21, 21], [15, 12]].forEach(([x, y]) => blades(g, x, y, 4));
  [[6, 9], [16, 5], [25, 8], [11, 16], [21, 15], [28, 19], [4, 20]].forEach(([x, y], i) => {
    px(g, x, y + 3, 2, 24 - y, LEAF.dark); px(g, x, y + 3, 1, 24 - y, LEAF.mid);
    px(g, x + 2, y + 7, 2, 2, LEAF.mid); px(g, x - 2, y + 9, 2, 2, LEAF.mid); px(g, x + 2, y + 7, 1, 1, LEAF.light);
    px(g, x - 2, y - 1, 6, 4, cols[i]); px(g, x - 1, y - 2, 4, 6, cols[i]); px(g, x - 1, y - 1, 1, 1, his[i]); px(g, x, y - 2, 1, 1, his[i]); px(g, x, y, 2, 2, "#ffe066"); px(g, x + 1, y + 1, 1, 1, "#d99a1e");
  });
}
function stump(g) {
  px(g, 5, 13, 23, 14, WD.mid); px(g, 5, 13, 3, 14, WD.light); px(g, 6, 13, 1, 14, WD.hi); px(g, 24, 13, 4, 14, WD.dark); px(g, 27, 13, 1, 14, WD.deep);
  [9, 13, 17, 21].forEach((x, i) => { px(g, x, 15 + (i % 3), 1, 6 + (i % 2) * 3, WD.dark); px(g, x + 2, 19 + (i % 2), 1, 3, WD.deep); });
  px(g, 2, 23, 4, 4, WD.mid); px(g, 1, 25, 3, 2, WD.mid); px(g, 2, 23, 1, 3, WD.light); px(g, 26, 22, 4, 5, WD.dark); px(g, 29, 24, 2, 3, WD.dark); px(g, 30, 25, 1, 2, WD.deep);
  px(g, 1, 26, 30, 1, WD.deep); px(g, 5, 25, 23, 2, WD.deep); px(g, 8, 25, 16, 1, WD.dark);
  for (let y = -6; y <= 6; y++) for (let x = -11; x <= 11; x++) {
    const nd = Math.sqrt((x * x) / (11.5 * 11.5) + (y * y) / (6.5 * 6.5));
    if (nd >= 1) continue;
    let col = nd > 0.86 ? WD.dark : (Math.floor(nd * 6) % 2 ? CUT.dark : CUT.mid);
    if (nd > 0.86 && x < 0 && y < 0) col = WD.mid;
    if (nd < 0.14) col = CUT.deep;
    if (col === CUT.mid && y < -1 && x < 2) col = CUT.light;
    px(g, 16 + x, 12 + y, 1, 1, col);
  }
  [[13, 17], [14, 18], [14, 19], [15, 20], [15, 21]].forEach(([y, x]) => px(g, x, y, 1, 1, CUT.deep));
  px(g, 1, 20, 4, 2, "#c98f5a"); px(g, 1, 20, 4, 1, "#e6ab72"); px(g, 2, 22, 2, 2, "#f0e0c0"); px(g, 2, 20, 1, 1, "#fbe3c8");
  blades(g, 29, 20, 4); blades(g, 26, 27, 3); blades(g, 7, 27, 3);
}
function logEnd(g, cx, cy, rx, ry, seed, split) {
  /* one log seen end-on. whole: growth rings around the pith inside a bark rim lit on the upper left.
     split: only the lower half - a flat, light cut face along the top with the pith notch at its middle and a dark bark rim below. */
  const ex = (rx + 0.5) * (rx + 0.5), ey = (ry + 0.5) * (ry + 0.5);
  for (let y = split ? 0 : -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    const nd = Math.sqrt((x * x) / ex + (y * y) / ey);
    if (nd >= 1) continue;
    let col;
    if (nd > 0.78) col = !split && x < 0 && y < 0 ? WD.mid : (y > ry * 0.4 ? WD.deep : WD.dark);
    else col = Math.floor(nd * 5 + seed) % 2 ? CUT.dark : CUT.mid;
    if (nd < 0.22) col = CUT.deep;
    if (col === CUT.mid && x < -1 && y < 0) col = CUT.light;
    if (col === CUT.dark && hash(x + seed * 3, y + cx) % 5 === 0) col = CUT.deep;
    if (split && y === 0) col = Math.abs(x) >= rx ? WD.dark : (x === 0 || x === -1 ? CUT.deep : CUT.light);
    if (split && y === 1 && nd <= 0.78 && nd >= 0.22) col = CUT.dark;
    px(g, cx + x, cy + y, 1, 1, col);
  }
}
function woodpile(g) {
  /* a pile of whole rounds and split halves (flat face up) of varied sizes, held between two stakes; the gaps between logs show a dark shadow bed */
  const logs = [[7, 22, 5, 5, 0, false], [17, 23, 5, 4, 1, true], [27, 23, 4, 4, 2, false],                    // [cx, cy, rx, ry, seed, split] bottom row
    [12, 15, 6, 5, 3, true], [23, 15, 5, 5, 4, false],                                                          // middle row
    [6, 12, 3, 3, 7, true], [13, 10, 4, 4, 5, false], [23, 9, 4, 3, 6, true]];                                   // top: a small split on the left flat face, a round, a split
  const inLog = (x, y) => logs.some(([cx, cy, rx, ry, , split]) => (!split || y >= cy) && ((x - cx) * (x - cx)) / ((rx + 0.5) * (rx + 0.5)) + ((y - cy) * (y - cy)) / ((ry + 0.5) * (ry + 0.5)) < 1);
  for (let x = 2; x <= 29; x++) for (let y = 4; y <= 27; y++) if (inLog(x, y)) { px(g, x, y, 1, 28 - y, WD.deep); break; }   // shadow bed under the pile's skyline
  logs.forEach(([cx, cy, rx, ry, seed, split]) => logEnd(g, cx, cy, rx, ry, seed, split));
  px(g, 0, 6, 2, 22, WD.dark); px(g, 0, 6, 1, 22, WD.mid); px(g, 30, 6, 2, 22, WD.dark); px(g, 30, 6, 1, 22, WD.mid);
  px(g, 0, 5, 2, 1, WD.light); px(g, 30, 5, 2, 1, WD.light); px(g, 0, 27, 2, 1, WD.deep); px(g, 30, 27, 2, 1, WD.deep);
}
function signpost(g) {
  px(g, 14, 3, 4, 27, WD.dark); px(g, 14, 3, 1, 27, WD.mid); px(g, 17, 3, 1, 27, WD.deep); px(g, 13, 2, 6, 1, WD.mid); px(g, 12, 29, 8, 2, WD.deep); px(g, 13, 28, 6, 1, WD.dark);
  const INK = "#4a2e1a";
  rows(g, [[4, 3, 21], [5, 3, 22], [6, 3, 23], [7, 3, 24], [8, 3, 24], [9, 3, 23], [10, 3, 22], [11, 3, 21]], CUT.mid);
  px(g, 3, 4, 19, 1, CUT.light); px(g, 3, 11, 19, 1, CUT.deep); px(g, 3, 4, 1, 8, CUT.light); [[5, 22], [6, 23], [7, 24], [8, 24], [9, 23], [10, 22]].forEach(([y, x]) => px(g, x, y, 1, 1, CUT.dark));
  speckle(g, 4, 5, 18, 6, CUT.dark, 13, 7); text3x5(g, 6, 6, "SHOP", INK, 1); px(g, 4, 6, 1, 1, WD.deep); px(g, 4, 9, 1, 1, WD.deep);
  rows(g, [[15, 10, 28], [16, 9, 28], [17, 8, 28], [18, 7, 28], [19, 7, 28], [20, 8, 28], [21, 9, 28], [22, 10, 28]], CUT.mid);
  px(g, 10, 15, 19, 1, CUT.light); px(g, 10, 22, 19, 1, CUT.deep); px(g, 28, 15, 1, 8, CUT.dark); [[16, 9], [17, 8], [18, 7], [19, 7], [20, 8], [21, 9]].forEach(([y, x]) => px(g, x, y, 1, 1, CUT.light));
  speckle(g, 10, 16, 18, 6, CUT.dark, 13, 9); text3x5(g, 12, 17, "POND", INK, 1); px(g, 27, 17, 1, 1, WD.deep); px(g, 27, 20, 1, 1, WD.deep);
  blades(g, 10, 27, 3); blades(g, 21, 28, 3);
}
function sprinkler(g) {
  px(g, 7, 24, 18, 3, IRON.dark); px(g, 7, 24, 18, 1, IRON.mid); px(g, 7, 26, 18, 1, IRON.deep);
  px(g, 10, 16, 12, 8, IRON.mid); px(g, 10, 16, 2, 8, IRON.light); px(g, 20, 16, 2, 8, IRON.dark); px(g, 21, 16, 1, 8, IRON.deep);
  px(g, 12, 14, 8, 2, IRON.light); px(g, 12, 14, 8, 1, IRON.hi); px(g, 13, 19, 6, 2, IRON.dark); px(g, 14, 19, 1, 1, IRON.hi);
  px(g, 14, 10, 4, 4, IRON.mid); px(g, 14, 10, 1, 4, IRON.light); px(g, 17, 10, 1, 4, IRON.deep);
  px(g, 11, 7, 10, 3, "#3fc1e6"); px(g, 12, 6, 8, 1, "#3fc1e6"); px(g, 12, 6, 4, 1, "#9fe6f7"); px(g, 11, 7, 2, 2, "#9fe6f7"); px(g, 11, 9, 10, 1, "#2a8db0"); px(g, 20, 7, 1, 3, "#2a8db0");
  px(g, 13, 5, 6, 1, IRON.light); px(g, 15, 4, 2, 1, IRON.hi);
  px(g, 5, 8, 6, 2, IRON.light); px(g, 21, 8, 6, 2, IRON.light); px(g, 5, 9, 6, 1, IRON.dark); px(g, 21, 9, 6, 1, IRON.dark); px(g, 4, 7, 2, 3, IRON.mid); px(g, 26, 7, 2, 3, IRON.mid);
  [[2, 5], [29, 5], [3, 12], [28, 12], [1, 9], [30, 9], [15, 1]].forEach(([x, y]) => px(g, x, y, 1, 1, "#a8dcf5")); px(g, 15, 2, 2, 1, "#a8dcf5");
}
function blossomBush(g) {
  disc(g, 16, 20, 11, TREE_PAL.green.D);
  puff(g, 16, 18, 10, TREE_PAL.green, 3); puff(g, 8, 22, 7, TREE_PAL.green, 4); puff(g, 24, 22, 7, TREE_PAL.green, 5); puff(g, 16, 13, 7, TREE_PAL.lime, 6);
  [[9, 15], [21, 12], [15, 22], [25, 20], [12, 9], [20, 25], [5, 24]].forEach(([x, y]) => { px(g, x - 1, y, 4, 2, "#ff9ccf"); px(g, x, y - 1, 2, 4, "#ff9ccf"); px(g, x, y, 1, 1, "#ffe0ef"); px(g, x + 1, y + 1, 1, 1, "#e06aa8"); });
  px(g, 15, 29, 2, 2, WD.dark);
}
function propSprite(ch) {
  return cached("prop:" + ch, A, A, (g, c) => {
    if (ch === "#") { g.drawImage(fenceSprite(10), 0, 0); return; }
    if (ch === "o") rock(g);
    else if (ch === "B") { barrel(g, 2, 7); barrel(g, 16, 11); }
    else if (ch === "c") crate(g);
    else if (ch === "h") hayBale(g);
    else if (ch === "m") mailbox(g);
    else if (ch === "l") lamp(g);
    else if (ch === "b") bench(g);
    else if (ch === "w") well(g);
    else if (ch === "$") shippingBin(g);
    else if (ch === "!") noticeBoard(g);
    else if (ch === "f") flowers(g);
    else if (ch === "s") stump(g);
    else if (ch === "p") woodpile(g);
    else if (ch === "g") signpost(g);
    else if (ch === "k") sprinkler(g);
    else if (ch === "u") blossomBush(g);
    else return;
    outline(c, OUT);
  });
}

// ------------------------------------------------------------ trees
function puff(g, cx, cy, r, pal, seed) {
  /* one round leaf cluster: dark rim with a leafy edge, mid body, light cap on the upper left, a few sparkles and shadow flecks */
  const hx = cx - r * 0.3, hy = cy - r * 0.35, rr = (r + 0.5) * (r + 0.5);
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (d2 >= rr) continue;
    if (r >= 6 && d2 > (r - 0.5) * (r - 0.5) && (hash(x * 5 + seed, y * 7 - seed) % 3) === 0) continue;
    const hd = Math.sqrt((x - hx) * (x - hx) + (y - hy) * (y - hy));
    let col = d2 > (r - 1.6) * (r - 1.6) ? pal.D : (hd < r * 0.42 ? pal.L : (hd < r * 0.78 ? pal.M : pal.D));
    if (col === pal.L && (hash(x * 3 + seed, y * 5 + seed) % 7) === 0) col = pal.X;
    if (col === pal.M && (hash(x + seed * 7, y * 3) % 11) === 0) col = pal.L;
    if (col === pal.M && (hash(x * 11 + seed, y + seed * 5) % 13) === 0) col = pal.D;
    px(g, x, y, 1, 1, col);
  }
}
function trunk(g, x, y, w, h, seed) {
  /* bark: light left face, dark right face, grain streaks and a knot; the base flares into roots on the last five rows */
  px(g, x, y, w, h, WD.mid); px(g, x, y, 2, h, WD.light); px(g, x + w - 3, y, 3, h, WD.dark); px(g, x + w - 1, y, 1, h, WD.deep);
  for (let yy = y + 2; yy < y + h - 6; yy++) if (hash(yy, seed) % 4 === 0) px(g, x + 2 + (hash(yy * 3, seed) % (w - 5)), yy, 1, 2 + (hash(yy, seed + 7) % 3), WD.dark);
  for (let yy = y + 2; yy < y + h - 6; yy++) if (hash(yy * 5, seed) % 6 === 0) px(g, x + 2, yy, 1, 2, WD.hi);
  const ky = y + Math.floor(h * 0.45); px(g, x + 4, ky, 3, 3, WD.dark); px(g, x + 5, ky + 1, 1, 1, WD.deep);
  const b = y + h - 1;
  for (let i = 0; i < 5; i++) { const s = i + 1; px(g, x - s, b - 4 + i, w + 2 * s, 1, WD.mid); px(g, x - s, b - 4 + i, 2, 1, WD.light); px(g, x + w + s - 3, b - 4 + i, 3, 1, WD.dark); }
  px(g, x - 5, b, w + 10, 1, WD.deep); px(g, x - 2, b - 1, 1, 1, WD.deep); px(g, x + w + 1, b - 1, 1, 1, WD.deep);
}
function treeSprite(kind, variant, fruitColor, fruit) {
  const W = 48, H = 64, pal = TREE_PAL[kind] || TREE_PAL.green;
  return cached("tree:" + kind + variant + (fruitColor || "") + (fruit || 0), W, H, (g, c) => {
    const r = rng(variant * 977 + 5);
    const j = (n) => Math.floor(r() * n) - Math.floor(n / 2);
    const fit = ([x, y, r]) => [Math.min(Math.max(x, r + 2), W - 3 - r), Math.max(y, r + 2), r];   // every puff and its outline stays inside 1..W-2 x 1..H-2
    trunk(g, 19, 34, 10, 27, variant);
    disc(g, 24 + j(3), 24, 17, pal.D);                                                    // dark mass behind the clusters
    // back clusters first, front (lower) clusters last so their rims separate the puffs
    const puffs = [[24 + j(3), 15 + j(3), 12], [14 + j(3), 22 + j(3), 11], [33 + j(3), 22 + j(3), 11], [24 + j(3), 25 + j(3), 14],
      [13 + j(3), 33 + j(3), 9], [35 + j(3), 33 + j(3), 9], [24 + j(3), 36 + j(3), 10]].map(fit);
    puffs.forEach((pf, i) => puff(g, pf[0], pf[1], pf[2], pal, variant * 13 + i));
    [[16 + j(3), 10 + j(2), 5], [32 + j(3), 11 + j(2), 5]].map(fit).forEach((pf, i) => puff(g, pf[0], pf[1], pf[2], pal, variant * 13 + 9 + i));   // small top tufts
    if (fruit) [[12, 24], [33, 17], [22, 34], [37, 32], [16, 36], [29, 41]].slice(0, fruit).forEach(([x, y]) => {
      px(g, x, y, 4, 4, fruitColor); px(g, x - 1, y + 1, 1, 2, fruitColor); px(g, x + 4, y + 1, 1, 2, fruitColor); px(g, x + 1, y - 1, 2, 1, fruitColor);
      px(g, x + 1, y + 1, 1, 1, "#ffffff"); px(g, x + 2, y + 3, 2, 1, shade(fruitColor, 0.65)); px(g, x + 4, y + 2, 1, 1, shade(fruitColor, 0.65)); px(g, x + 2, y - 2, 1, 1, pal.D);
    });
    outline(c, OUT);
  });
}
function bushSprite(kind, variant) {
  const pal = TREE_PAL[kind] || TREE_PAL.green;
  return cached("bush:" + kind + variant, A, A, (g, c) => {
    disc(g, 16, 20, 11, pal.D);
    puff(g, 16, 14 + (variant % 2), 8, pal, variant); puff(g, 9, 21, 7, pal, variant + 1); puff(g, 23, 21, 7, pal, variant + 2); puff(g, 16, 23, 8, pal, variant + 3);
    if (variant % 3 === 0) [[10, 18], [22, 16], [17, 26]].forEach(([x, y]) => { px(g, x, y, 2, 2, "#e0524f"); px(g, x, y, 1, 1, "#ff9a98"); });
    px(g, 15, 29, 2, 2, WD.dark);
    outline(c, OUT);
  });
}
function youngTree(stage, season) {
  const pal = TREE_PAL[season === "winter" ? "snow" : "green"];
  return cached("young:" + stage + season, A, A, (g, c) => {
    if (stage === 0) {
      /* sapling: a thin 1px stem with a bud and three pairs of small leaves, clearly a different stage from the round-headed young tree */
      const leaf = (y, side, w) => {                                                       // a leaf w wide growing out of the stem at column 16, lit on its upper left, dark underside
        const x0 = side < 0 ? 16 - w : 17, tip = side < 0 ? x0 : x0 + w - 1;
        px(g, x0 + (side < 0 ? 1 : 0), y - 1, w - 1, 1, pal.M); px(g, x0, y, w, 1, pal.M); px(g, x0 + 1, y + 1, w - 2, 1, pal.D);
        px(g, x0 + (side < 0 ? 1 : 0), y - 1, 1, 1, pal.L); px(g, side < 0 ? tip : 17, y, 1, 1, side < 0 ? pal.L : pal.D); px(g, side < 0 ? 15 : tip, y, 1, 1, pal.D);
      };
      px(g, 16, 12, 1, 17, WD.dark); px(g, 16, 13, 1, 2, WD.mid); px(g, 16, 19, 1, 2, WD.mid);
      px(g, 15, 28, 3, 1, WD.deep); px(g, 14, 29, 5, 1, WD.dark);
      leaf(15, -1, 4); leaf(16, 1, 4); leaf(22, -1, 5); leaf(23, 1, 5);
      px(g, 15, 10, 3, 2, pal.M); px(g, 16, 9, 1, 1, pal.L); px(g, 15, 10, 1, 1, pal.L); px(g, 16, 11, 2, 1, pal.D);   // bud
    } else {
      px(g, 14, 18, 4, 12, WD.mid); px(g, 14, 18, 1, 12, WD.light); px(g, 17, 18, 1, 12, WD.dark); px(g, 12, 29, 8, 1, WD.dark); px(g, 13, 28, 1, 1, WD.mid); px(g, 18, 28, 1, 1, WD.mid);
      disc(g, 16, 13, 10, pal.D);
      puff(g, 16, 9, 7, pal, 5); puff(g, 9, 14, 6, pal, 6); puff(g, 23, 14, 6, pal, 7); puff(g, 16, 17, 7, pal, 8);
    }
    outline(c, OUT);
  });
}


/* the farm's shared storage chest: a rounded wooden trunk with brass bands, a heart-shaped lock plate and stubby feet;
   open = the lid thrown back and a glint of what is stored inside */
function chestSprite(open) {
  return cached("chest:" + (open ? 1 : 0), A, A, (g, c) => {
    const W = { L: "#dcae70", M: "#b8834a", D: "#8a5a32", X: "#5e3a1e" }, B = { L: "#ffe9a0", M: "#e6b84a", D: "#a87a22" }, IN = "#3a2416";
    // body: planks with a lit top edge, dark base and two brass bands
    px(g, 4, 17, 24, 11, W.M); px(g, 4, 17, 24, 1, W.L); px(g, 4, 27, 24, 1, W.X); px(g, 4, 17, 1, 11, W.L); px(g, 27, 17, 1, 11, W.D);
    px(g, 5, 21, 22, 1, W.D); px(g, 5, 24, 22, 1, W.D); px(g, 10, 22, 2, 1, W.X); px(g, 19, 25, 2, 1, W.X);
    px(g, 7, 17, 2, 11, B.M); px(g, 23, 17, 2, 11, B.M); px(g, 7, 17, 1, 11, B.L); px(g, 24, 17, 1, 11, B.D);
    px(g, 4, 26, 3, 2, W.X); px(g, 25, 26, 3, 2, W.X);
    if (!open) {
      // domed lid
      px(g, 5, 12, 22, 5, W.M); px(g, 6, 10, 20, 2, W.M); px(g, 8, 9, 16, 1, W.L); px(g, 6, 10, 20, 1, W.L); px(g, 5, 12, 1, 5, W.L);
      px(g, 5, 16, 22, 1, W.X); px(g, 26, 12, 1, 5, W.D); px(g, 25, 11, 1, 1, W.D);
      px(g, 7, 9, 2, 8, B.M); px(g, 23, 9, 2, 8, B.M); px(g, 7, 9, 1, 8, B.L); px(g, 24, 9, 1, 8, B.D); px(g, 7, 9, 2, 1, B.L); px(g, 23, 9, 2, 1, B.L);
      // heart lock plate over the seam
      px(g, 13, 14, 2, 2, B.M); px(g, 17, 14, 2, 2, B.M); px(g, 13, 16, 6, 2, B.M); px(g, 14, 18, 4, 1, B.M); px(g, 15, 19, 2, 1, B.M);
      px(g, 13, 14, 1, 1, B.L); px(g, 17, 14, 1, 1, B.L); px(g, 15, 17, 2, 1, B.D); px(g, 15, 16, 2, 1, W.X);
    } else {
      // lid thrown back behind the body, dark inside, goodies peeking out
      px(g, 5, 4, 22, 6, W.M); px(g, 6, 3, 20, 1, W.L); px(g, 5, 4, 22, 1, W.L); px(g, 5, 9, 22, 1, W.D); px(g, 6, 10, 20, 2, W.X);
      px(g, 7, 3, 2, 9, B.M); px(g, 23, 3, 2, 9, B.M); px(g, 7, 3, 1, 9, B.L); px(g, 24, 3, 1, 9, B.D);
      px(g, 5, 12, 22, 5, IN); px(g, 6, 12, 20, 1, "#241610");
      px(g, 9, 14, 4, 3, "#f2c744"); px(g, 10, 14, 1, 1, "#fff5b0"); px(g, 14, 13, 5, 4, "#e8394a"); px(g, 15, 13, 1, 1, "#ff8a8a"); px(g, 20, 14, 4, 3, "#7fc46a"); px(g, 21, 14, 1, 1, "#b8ec9c");
      px(g, 14, 17, 4, 2, B.M); px(g, 15, 18, 2, 1, B.D); px(g, 14, 17, 1, 1, B.L);
    }
    outline(c, OUT);
  });
}

// ------------------------------------------------------------ rare trees: oak, weeping willow, bonsai
/* grown from the one-in-a-million seeds a harvest can drop. stage 0 = seedling in a little soil ring, 1 = knee-high young tree (both 32x32),
   2 = mature: 48x64 and placed like treeSprite (trunk base at y=60; the game draws it 8px left of and 30px above its tile).
   Fall warms the leaves, winter dusts them with snow, spring and summer stay green. */
const SNOW = { hi: "#ffffff", mid: "#e3edf4", dark: "#b4c5d3" };
const SOIL = { deep: "#3f2818", dark: "#5e3e26", mid: "#7e5636", light: "#a07448", hi: "#c09464" };
const OAKB = { deep: "#33231a", dark: "#4f3826", mid: "#6e5236", light: "#8f7250", hi: "#b3966c" };   // old grey-brown oak bark
const WILB = { deep: "#3b3026", dark: "#5a4a38", mid: "#7a6850", light: "#9c8a6c", hi: "#bcae8e" };   // pale willow bark
const BONB = { deep: "#22150d", dark: "#3a2517", mid: "#553823", light: "#775033", hi: "#9c7249" };   // dark twisted bonsai wood
const POT = { deep: "#1a2c5c", dark: "#274888", mid: "#3a68bc", light: "#6699dc", hi: "#c4e2ff" };    // glazed blue ceramic
const ACORN = { cap: "#5e3c1e", capL: "#8c5c2e", nut: "#c08c3c", nutL: "#e6bf66", nutD: "#8e6226" };
const BLOOM = { hi: "#fff0f6", mid: "#ff9cc8", dark: "#d95c96" };
const RARE_PAL = {
  oak: { green: { S: "#143a1b", D: "#215626", M: "#347f31", L: "#58a843", X: "#9ad26e" },
    fall: { S: "#5a2412", D: "#83361a", M: "#b6562a", L: "#dc893c", X: "#f7c472" },
    winter: { S: "#1c392b", D: "#285036", M: "#3a6947", L: "#5a8a60", X: "#88ae86" } },
  willow: { green: { S: "#3a6224", D: "#527c2a", M: "#82b03e", L: "#afd45e", X: "#def29a" },
    fall: { S: "#6a4e14", D: "#916c1c", M: "#c69a30", L: "#e8c656", X: "#faea98" },
    winter: { S: "#4b6350", D: "#647d66", M: "#8ca58c", L: "#b6cab4", X: "#e4eee4" } },
  bonsai: { green: { S: "#183a24", D: "#255832", M: "#397e3e", L: "#62a84e", X: "#a0d278" },
    fall: { S: "#5a2616", D: "#863a20", M: "#b65c2c", L: "#dc8a42", X: "#f5c478" } },
};
function rarePal(kind, season) { const p = RARE_PAL[kind]; return season === "fall" ? p.fall : (season === "winter" && p.winter) || p.green; }
const dim = (p) => ({ S: p.S, D: p.S, M: p.D, L: p.M, X: p.L });                   // one tone darker, for clusters at the back
function inOval(x, y, cx, cy, rx, ry) { const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5); return dx * dx + dy * dy < 1; }
function oval(g, cx, cy, rx, ry, col) { for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) if (inOval(x, y, cx, cy, rx, ry)) px(g, x, y, 1, 1, col); }
/* shade any shape given by an inside(x,y) test: color(x, y, up, dn, leftOpen, rightOpen) sees how many shape pixels (max 4) lie above and below */
function shape(g, x0, y0, x1, y1, inside, color) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inside(x, y)) continue;
    let up = 0, dn = 0;
    while (up < 4 && inside(x, y - up - 1)) up++;
    while (dn < 4 && inside(x, y + dn + 1)) dn++;
    const c = color(x, y, up, dn, !inside(x - 1, y), !inside(x + 1, y));
    if (c) px(g, x, y, 1, 1, c);
  }
}
/* snow lying on the top edge of a shape: 1..deep rows per column, bright on the lit left, blue-grey where it thins out */
function snowOn(g, x0, x1, y0, y1, inside, seed, deep, lightX) {
  for (let x = x0; x <= x1; x++) {
    let top = -1;
    for (let y = y0; y <= y1; y++) if (inside(x, y)) { top = y; break; }
    if (top < 0) continue;
    const d = 1 + (hash(x * 7 + seed, top + seed) % deep);
    for (let k = 0; k < d && inside(x, top + k); k++) px(g, x, top + k, 1, 1, k === 0 ? (x < lightX ? SNOW.hi : SNOW.mid) : (k === d - 1 ? SNOW.dark : SNOW.mid));
  }
}
function snowCap(g, cx, cy, r, seed) {
  const rr = (r + 0.5) * (r + 0.5);
  snowOn(g, Math.ceil(cx - r * 0.75), Math.floor(cx + r * 0.75), cy - r, cy, (x, y) => (x - cx) * (x - cx) + (y - cy) * (y - cy) < rr, seed, 3, cx);
}
/* branches, trunks and roots as thick strokes along polylines [[pts], r0, r1] (radius tapers from r0 to r1), shaded as one piece:
   lit left and top edges, dark right and bottom edges; twist adds diagonal bark bands; maxY (optional) clips the strokes at a soil line */
function woody(g, W, H, paths, B, twist, maxY) {
  const yMax = maxY === undefined ? H - 2 : Math.min(H - 2, maxY);
  const m = new Uint8Array(W * H);
  paths.forEach(([pts, r0, r1]) => {
    let total = 0, acc = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(len * 2));
      for (let k = 0; k <= n; k++) {
        const t = k / n, cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t, r = r0 + (r1 - r0) * (acc + len * t) / (total || 1);
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
          if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r && x >= 1 && y >= 1 && x < W - 1 && y <= yMax) m[y * W + x] = 1;
      }
      acc += len;
    }
  });
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] === 1;
  shape(g, 0, 0, W - 1, H - 1, inside, (x, y, up, dn, lo, ro) => {
    if (ro) return dn === 0 ? B.deep : B.dark;
    if (lo) return up === 0 ? B.hi : B.light;
    if (dn === 0) return B.dark;
    if (up === 0) return B.light;
    if (twist) { const k = (x + y) % 4; if (k === 0) return B.dark; if (k === 1) return B.light; }
    return B.mid;
  });
}
function acorn(g, x, y) {
  px(g, x + 1, y - 1, 1, 1, ACORN.cap);
  px(g, x, y, 3, 1, ACORN.cap); px(g, x, y, 1, 1, ACORN.capL);
  px(g, x, y + 1, 3, 1, ACORN.nut); px(g, x, y + 1, 1, 1, ACORN.nutL);
  px(g, x, y + 2, 3, 1, ACORN.nutD); px(g, x, y + 2, 1, 1, ACORN.nut); px(g, x + 1, y + 3, 1, 1, ACORN.nutD);
}
function bloom(g, x, y) {
  px(g, x, y - 1, 1, 1, BLOOM.mid); px(g, x - 1, y, 3, 1, BLOOM.mid); px(g, x, y + 1, 1, 1, BLOOM.dark); px(g, x, y, 1, 1, BLOOM.hi);
}
/* a little ring of dug soil around the stem; bonsai seedlings get a border of pale pebbles */
function soilRing(g, pebbles) {
  const inside = (x, y) => inOval(x, y, 16, 26, 7, 2.5), hollow = (x, y) => inOval(x, y, 16, 26, 4.5, 1);
  shape(g, 8, 22, 24, 30, inside, (x, y, up, dn) => hollow(x, y) ? (y < 26 ? SOIL.deep : SOIL.dark)
    : up === 0 ? (x < 16 ? SOIL.hi : SOIL.light) : dn === 0 ? SOIL.dark : (hash(x * 3, y * 5) % 5 === 0 ? SOIL.light : SOIL.mid));
  if (pebbles) [[9, 25], [11, 28], [18, 28], [22, 26], [20, 23], [12, 23]].forEach(([x, y]) => { px(g, x, y, 2, 1, STONE.light); px(g, x, y, 1, 1, STONE.hi); px(g, x, y + 1, 2, 1, STONE.dark); });
}
function willowLock(g, x0, y0, y1, w, arc, pal, tone, seed, shadeRows, deepen) {
  /* one lock of hanging willow leaves: arcs out (arc = sideways reach) then falls straight; columns lit left to right,
     staggered 3px leaf dashes, leaves flicking off the edges, tapering to a pale tip. shadeRows = [y0, y1] band in the crown's shadow;
     deepen darkens the lock as it hangs lower (for the crown's own locks) */
  const T = [pal.S, pal.D, pal.M, pal.L, pal.X], n = Math.max(1, y1 - y0);
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / n, x = x0 + Math.round(arc * (1 - (1 - t) * (1 - t) * (1 - t)));
    const left = y1 - y, cut = left < 2 ? 2 - left : 0, ww = Math.max(1, w - cut), xs = x + Math.floor((w - ww) / 2);
    for (let i = 0; i < ww; i++) {
      let k = tone + (i === 0 ? 1 : 0) - (i === ww - 1 && ww > 2 ? 1 : 0);
      const h = hash(i * 13 + seed, Math.floor((y + i * 2 + seed) / 3)) % 7;
      if (h === 0) k += 1; else if (h === 1) k -= 1;
      if (y - y0 < 2) k += 1;
      if (deepen) k -= Math.floor((y - y0) / 5);
      if (shadeRows && y >= shadeRows[0] && y <= shadeRows[1]) k -= 1;
      if (left < 3 && !deepen) k = Math.max(k, 3) + (left === 0 ? 1 : 0);
      px(g, xs + i, y, 1, 1, T[Math.max(0, Math.min(4, k))]);
    }
    if (left > 3 && y - y0 > 3) { if (hash(y, seed) % 6 === 0) px(g, xs - 1, y, 1, 1, pal.L); if (hash(y + 3, seed * 7) % 6 === 0) px(g, xs + ww, y, 1, 1, pal.D); }
  }
}
function willowDome(g, cx, cy, rx, ry, x0, x1, base, pal, winter, seed) {
  const top = (x) => Math.round(cy + 0.4 - ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / (rx + 0.5)) * ((x - cx) / (rx + 0.5)))));
  const tops = {};
  for (let x = x0; x <= x1; x += 3) {
    const c = x + 1, y0 = top(c), y1 = base + Math.round(Math.abs(c - cx) / 4) + hash(x, seed) % 4;
    willowLock(g, x, y0, y1, 3, 0, pal, c < cx + 4 ? 3 : 2, seed + x, null, true);
    for (let i = 0; i < 3; i++) tops[x + i] = y0;
  }
  for (let x = x0; x <= x1 + 2; x++) {                                                      // round off the steps between locks into a smooth dome
    const t = top(x);
    for (let y = t; y < tops[x]; y++) px(g, x, y, 1, 1, y === t && x < cx ? pal.X : pal.L);
    tops[x] = Math.min(tops[x], t);
  }
  if (winter) snowOn(g, x0, x1 + 2, 0, cy, (x, y) => tops[x] !== undefined && y >= tops[x] && y < tops[x] + 4, seed, 3, cx);
}
/* a flat cloud-shaped pad of tiny needles: dark underside, mid body with needle flecks, light top */
function needlePad(g, cx, cy, rx, pal, seed, winter) {
  /* a flat cloud of tiny needles: three rounded lobes on a flat underside; dark base, mid body with a needle weave, light crown */
  const s = rx - 3, lobes = [[cx - s, cy, 3, 2], [cx, cy - 2, 4, 2], [cx + s, cy, 3, 2], [cx, cy, rx - 2, 1]];
  const inside = (x, y) => y <= cy + 1 && lobes.some(([ox, oy, a, b]) => inOval(x, y, ox, oy, a, b));
  shape(g, cx - rx - 1, cy - 5, cx + rx + 1, cy + 1, inside, (x, y, up, dn, lo, ro) => {
    if (dn === 0) return pal.S;
    if (dn === 1) return (x + y + seed) % 3 === 0 ? pal.M : pal.D;
    if (up === 0) return hash(x * 5 + seed, y) % 3 === 0 ? pal.X : pal.L;
    if (ro) return pal.D;
    const k = (x + 2 * y + seed) % 4;
    return k === 0 ? pal.L : k === 2 && hash(x, y + seed) % 2 ? pal.D : pal.M;
  });
  if (winter) snowOn(g, cx - rx, cx + rx, cy - 5, cy + 1, inside, seed, 2, cx);
}
/* the glazed pot: back rim, soil with moss, a lit front lip with a shine, a shadow under the lip, a tapering body and two small feet */
function bonsaiPot(g, x0, y0, w, bh) {
  const P = POT, x1 = x0 + w - 1;
  px(g, x0 + 1, y0, w - 2, 1, P.dark);
  px(g, x0, y0 + 1, w, 2, P.mid); px(g, x0, y0 + 1, 1, 2, P.light); px(g, x1, y0 + 1, 1, 2, P.dark);
  px(g, x0 + 2, y0 + 1, w - 4, 2, SOIL.dark); px(g, x0 + 2, y0 + 1, w - 4, 1, SOIL.deep);
  for (let x = x0 + 2; x <= x1 - 2; x++) if (hash(x, y0) % 4 === 0) px(g, x, y0 + 2, 1, 1, hash(x, 9) % 2 ? "#6a9a44" : "#4d7a34");
  px(g, x0, y0 + 3, w, 1, P.light); px(g, x0 + 2, y0 + 3, Math.floor(w * 0.35), 1, P.hi);
  px(g, x0, y0 + 4, w, 1, P.mid); px(g, x0, y0 + 4, 1, 1, P.light); px(g, x1 - 1, y0 + 3, 2, 2, P.dark);
  px(g, x0 + 1, y0 + 5, w - 2, 1, P.deep);
  for (let k = 0; k < bh; k++) {
    const y = y0 + 6 + k, xl = x0 + 2 + Math.floor(k / 3), xr = x1 - 2 - Math.floor(k / 3);
    px(g, xl, y, xr - xl + 1, 1, P.mid); px(g, xl, y, 2, 1, P.light); px(g, xr - 2, y, 2, 1, P.dark); px(g, xr, y, 1, 1, P.deep);
    if (k > 0 && k < bh - 1) px(g, xl + 2, y, 1, 1, P.hi);
  }
  const yb = y0 + 6 + bh, xl = x0 + 2 + Math.floor(bh / 3), xr = x1 - 2 - Math.floor(bh / 3);
  px(g, xl, yb, xr - xl + 1, 1, P.dark);
  px(g, xl + 1, yb + 1, 3, 1, P.deep); px(g, xr - 3, yb + 1, 3, 1, P.deep);
}

function clump(g, cx, cy, r, pal, seed) {
  /* an oak leaf clump lit from the top-left: a pale crescent cap along its upper edge, mid body with leaf flecks, a dark crescent underneath
     and a ragged leafy rim; overlapping clumps stack into scalloped layers */
  const rr = (r + 0.5) * (r + 0.5), ins = (x, y) => (x - cx) * (x - cx) + (y - cy) * (y - cy) < rr;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (!ins(x, y)) continue;
    const rim = !ins(x - 1, y) || !ins(x + 1, y) || !ins(x, y - 1) || !ins(x, y + 1), h = hash(x * 5 + seed, y * 7 - seed);
    if (rim && r >= 4 && h % 4 === 0) continue;
    let c;
    if (!ins(x, y + 2) || !ins(x + 2, y + 1)) c = pal.D;
    else if (!ins(x, y - 1) || !ins(x - 1, y - 1)) c = h % 3 === 0 ? pal.X : pal.L;
    else if (!ins(x, y - 2) || !ins(x - 2, y - 2)) c = h % 3 === 0 ? pal.M : pal.L;
    else if (!ins(x + 1, y + 3) || !ins(x + 3, y + 2)) c = h % 4 === 0 ? pal.M : pal.D;
    else c = h % 13 === 0 ? pal.L : pal.M;
    px(g, x, y, 1, 1, c);
  }
}
// ---- seedlings (32x32)
function oakSeedling(g, pal, winter) {
  soilRing(g, false);
  px(g, 16, 17, 1, 8, OAKB.light); px(g, 16, 17, 1, 3, pal.D);
  const leaf = [".L.LL.", "LXLLLL", "LLMMMM", ".MDMMD", "..D.D."];                    // lobed oak leaf, stem end on the right
  leaf.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") { px(g, 10 + i, 14 + j, 1, 1, pal[ch]); px(g, 22 - i, 13 + j, 1, 1, pal[ch === "X" ? "L" : ch]); } }));
  acorn(g, 17, 23);                                                                        // the acorn it sprang from, half buried by the stem
  if (winter) { px(g, 10, 14, 3, 1, SNOW.hi); px(g, 19, 13, 3, 1, SNOW.mid); }
}
function willowSeedling(g, pal, winter) {
  soilRing(g, false);
  px(g, 16, 18, 1, 8, WILB.mid); px(g, 17, 16, 1, 2, WILB.mid); px(g, 16, 18, 1, 2, pal.D);
  [[15, 16], [14, 16], [13, 17], [12, 17], [11, 18], [10, 19], [10, 20]].forEach(([x, y], i, a) => { px(g, x, y, 1, 1, i === a.length - 1 ? pal.X : pal.L); px(g, x, y + 1, 1, 1, pal.M); });
  [[18, 15], [19, 15], [20, 16], [21, 16], [22, 17], [23, 18], [23, 19]].forEach(([x, y], i, a) => { px(g, x, y, 1, 1, i === a.length - 1 ? pal.X : pal.M); px(g, x, y + 1, 1, 1, pal.D); });
  if (winter) { px(g, 13, 16, 3, 1, SNOW.hi); px(g, 18, 14, 2, 1, SNOW.mid); }
}
function bonsaiSeedling(g, pal, winter) {
  soilRing(g, true);
  px(g, 16, 19, 1, 7, BONB.light); px(g, 15, 21, 1, 3, BONB.mid);
  rows(g, [[18, 12, 14], [19, 11, 15], [20, 12, 14]], pal.M); px(g, 12, 18, 2, 1, pal.L); px(g, 12, 20, 3, 1, pal.D);
  rows(g, [[17, 18, 20], [18, 17, 21], [19, 18, 20]], pal.M); px(g, 18, 17, 2, 1, pal.L); px(g, 18, 19, 3, 1, pal.D);
  px(g, 16, 16, 1, 3, pal.D); px(g, 15, 17, 1, 1, pal.L); px(g, 17, 16, 1, 1, pal.L); px(g, 16, 15, 1, 1, pal.X);   // first tuft of needles
  if (winter) { px(g, 12, 18, 3, 1, SNOW.hi); px(g, 18, 17, 3, 1, SNOW.mid); px(g, 16, 15, 1, 1, SNOW.hi); }
}

// ---- young trees (32x32)
function oakYoung(g, pal, winter) {
  for (let y = 18; y <= 29; y++) {
    const fl = y >= 26 ? y - 25 : 0, xl = 13 - fl, xr = 18 + fl;
    px(g, xl, y, xr - xl + 1, 1, OAKB.mid); px(g, xl, y, 1, 1, OAKB.light); px(g, xr - 1, y, 2, 1, OAKB.dark);
    px(g, 15 + ((y >> 2) & 1), y, 1, 1, OAKB.dark); if (y & 1) px(g, 14, y, 1, 1, OAKB.hi);
  }
  px(g, 9, 29, 14, 1, OAKB.deep);
  oval(g, 16, 13, 13, 8, pal.S);
  const back = [[16, 9, 6], [8, 13, 5], [24, 13, 5]];
  const tiers = [[[12, 7, 4], [20, 6, 4]], [[8, 13, 5], [16, 11, 5], [24, 13, 5]], [[11, 18, 5], [21, 18, 5]]];
  back.forEach(([x, y, r], i) => clump(g, x, y, r, dim(pal), 40 + i));
  tiers.forEach((tier, t) => tier.forEach(([x, y, r], i) => clump(g, x, y, r, (i + t) % 2 ? dim(pal) : pal, 50 + t * 5 + i)));
  if (winter) tiers.flat().forEach(([x, y, r], i) => snowCap(g, x, y, r, 60 + i));
  else { acorn(g, 6, 16); acorn(g, 22, 20); }
}
function willowYoung(g, pal, winter) {
  const back = dim(pal);
  willowLock(g, 11, 10, 22, 3, -1, back, 2, 1); willowLock(g, 19, 10, 23, 3, 1, back, 2, 2);
  woody(g, A, A, [[[[15, 29], [15, 23], [17, 15], [18, 9]], 1.5, 0.8], [[[15, 29], [12, 30]], 0.8, 0.5], [[[16, 29], [19, 30]], 0.8, 0.5]], WILB);
  willowLock(g, 6, 10, 23, 3, -2, pal, 2, 3, [10, 13]); willowLock(g, 23, 10, 25, 3, 2, pal, 2, 4, [10, 13]);
  willowDome(g, 16, 12, 11, 10, 5, 26, 11, pal, winter, 5);
}
function bonsaiYoung(g, pal, winter) {
  bonsaiPot(g, 9, 21, 15, 2);
  woody(g, A, A, [[[[16, 22], [13, 18], [17, 14], [16, 11]], 1.6, 0.8], [[[13, 18], [9, 17]], 0.8, 0.6]], BONB, true);
  needlePad(g, 9, 17, 5, pal, 3, winter); needlePad(g, 17, 10, 6, pal, 4, winter);
  if (!winter) bloom(g, 20, 7);
}
// ---- mature trees (48x64)
function oakTrunk(g) {
  const B = OAKB;
  for (let y = 32; y <= 60; y++) {
    const fl = y >= 50 ? Math.round((y - 50) * (y - 50) / 14) : 0;                        // root flare
    const wl = hash(y >> 2, 11) % 3 === 0 ? 1 : 0, wr = hash(y >> 2, 23) % 3 === 0 ? 1 : 0;   // gnarled, wobbling edges
    const burl = y >= 40 && y <= 45 ? (y === 40 || y === 45 ? 1 : 2) : 0;                   // a burl swelling out on the right
    const xl = 18 - fl - wl, xr = 29 + fl + wr + burl;
    px(g, xl, y, xr - xl + 1, 1, B.mid); px(g, xl, y, 2, 1, B.light); px(g, xl, y, 1, 1, B.hi);
    px(g, xr - 2, y, 2, 1, B.dark); px(g, xr, y, 1, 1, B.deep);
    [0.28, 0.5, 0.72].forEach((f, i) => {                                                  // long wavy bark grooves that fan out with the flare
      const gx = xl + Math.round((xr - xl) * f) + (hash(i * 5 + 3, y >> 3) % 3) - 1;
      px(g, gx, y, 1, 1, B.deep);
      if (hash(i * 3, y) % 2) px(g, gx - 1, y, 1, 1, B.light);
    });
  }
  rows(g, [[57, 9, 14], [58, 7, 12], [59, 5, 10], [60, 3, 8]], B.mid); rows(g, [[57, 34, 38], [58, 36, 40], [59, 38, 42], [60, 40, 44]], B.mid);
  [[57, 9], [58, 7], [59, 5], [60, 3]].forEach(([y, x]) => px(g, x, y, 2, 1, B.light));
  [[57, 38], [58, 40], [59, 42], [60, 44]].forEach(([y, x]) => px(g, x - 1, y, 2, 1, B.dark));
  px(g, 3, 60, 42, 1, B.deep); px(g, 12, 60, 24, 1, B.dark);
}
/* knot hole: bark swelling round a dark rim, a black hollow with a sliver of depth, and a lit lower lip */
function knotHole(g, x, y) {
  const B = OAKB, K = "#170e08";
  px(g, x, y - 1, 4, 1, B.light); px(g, x - 1, y, 1, 4, B.light); px(g, x + 4, y + 1, 1, 3, B.deep);
  px(g, x + 1, y, 2, 1, B.deep); px(g, x, y + 1, 4, 3, B.deep); px(g, x + 1, y + 1, 2, 3, K);
  px(g, x + 2, y + 3, 1, 1, "#3a2414");
  px(g, x, y + 4, 4, 1, B.light); px(g, x + 1, y + 4, 2, 1, B.hi); px(g, x, y + 5, 4, 1, B.dark);
}
function oakMature(g, pal, winter) {
  oakTrunk(g);
  oval(g, 24, 22, 19, 15, pal.S);                                                            // deep shade inside the crown
  const back = [[24, 12, 9], [12, 17, 8], [36, 17, 8]];                                       // darker clumps deep in the crown
  const tiers = [                                                                            // four overlapping tiers, each hiding the underside of the one above
    [[17, 8, 6], [30, 8, 6], [24, 6, 4]],
    [[10, 17, 7], [22, 14, 7], [34, 15, 7]],
    [[6, 26, 5], [16, 23, 7], [28, 22, 7], [39, 24, 7]],
    [[9, 33, 6], [20, 32, 6], [31, 33, 6], [41, 31, 5]],
  ];
  back.forEach(([x, y, r], i) => clump(g, x, y, r, dim(pal), 10 + i));
  tiers.forEach((tier, t) => {
    if (t === 3) woody(g, 48, 64, [[[[20, 46], [16, 41], [10, 37]], 2.4, 1.4], [[[28, 45], [33, 40], [39, 37]], 2.4, 1.4]], OAKB);
    tier.forEach(([x, y, r], i) => clump(g, x, y, r, (i + t) % 2 ? dim(pal) : pal, 20 + t * 7 + i));   // alternate dark and mid clumps
  });
  if (winter) tiers.flat().forEach(([x, y, r], i) => snowCap(g, x, y, r, 50 + i));
  else [[12, 36], [34, 37], [23, 25], [40, 28], [15, 16]].forEach(([x, y]) => acorn(g, x, y));
  knotHole(g, 23, 50);                                                                      // below both branch roots, so nothing paints over it
}
function willowMature(g, pal, winter) {
  const back = dim(pal);
  willowLock(g, 11, 14, 42, 3, -1, back, 2, 1); willowLock(g, 34, 14, 44, 3, 1, back, 2, 2); willowLock(g, 20, 14, 36, 3, 0, back, 2, 3);
  willowLock(g, 22, 16, 33, 4, 0, back, 1, 6);                                                // shaded lock behind the fork, so no sky shows between trunk and branch
  woody(g, 48, 64, [[[[22, 59], [23, 50], [25, 38], [27, 26], [27, 16]], 2.6, 1.3], [[[26, 30], [20, 22], [16, 15]], 1.2, 0.8], [[[27, 26], [33, 18], [36, 14]], 1.1, 0.8],
    [[[22, 58], [17, 60]], 1.2, 0.6], [[[23, 58], [28, 60]], 1.2, 0.6]], WILB);
  [[6, 44, 4, -3], [14, 53, 4, -2], [30, 55, 4, 2], [38, 46, 4, 3]].forEach(([x, y1, w, arc], i) => willowLock(g, x, 16, y1, w, arc, pal, 2, 10 + i, [16, 26]));
  willowDome(g, 24, 18, 19, 16, 5, 41, 18, pal, winter, 9);
}
function bonsaiMature(g, pal, winter) {
  bonsaiPot(g, 10, 48, 28, 5);
  /* the trunk and its surface roots stop at the soil (y 50), so the pot's lit front lip stays in front of them */
  woody(g, 48, 64, [[[[23, 50], [21, 47], [16, 45], [19, 43], [27, 41], [24, 37]], 2.4, 1], [[[16, 45], [11, 44]], 1.1, 0.7], [[[27, 41], [34, 40]], 1.1, 0.7],
    [[[22, 49], [17, 50]], 1.2, 0.6], [[[25, 49], [30, 50]], 1.2, 0.6]], BONB, true, 50);
  needlePad(g, 10, 44, 6, pal, 1, winter); needlePad(g, 36, 41, 6, pal, 2, winter); needlePad(g, 24, 37, 7, pal, 3, winter);   // all within the lower half (y >= 32)
  if (!winter) bloom(g, 39, 38);
}
const RARE_DRAW = { oak: [oakSeedling, oakYoung, oakMature], willow: [willowSeedling, willowYoung, willowMature], bonsai: [bonsaiSeedling, bonsaiYoung, bonsaiMature] };
function rareTreeSprite(kind, stage, season) {
  const k = RARE_DRAW[kind] ? kind : "oak", st = stage >= 2 ? 2 : stage >= 1 ? 1 : 0, se = season === "fall" || season === "winter" ? season : "green";
  const big = st === 2;
  return cached("rare:" + k + st + se, big ? 48 : A, big ? 64 : A, (g, c) => { RARE_DRAW[k][st](g, rarePal(k, se), se === "winter"); outline(c, OUT); });
}

Object.assign(window.ART, { fenceSprite, gateSprite, lilyPad, propSprite, puff, treeSprite, bushSprite, youngTree , chestSprite, rareTreeSprite });
window.ART.PH = { trunk, rock, barrel, bench, lamp, signpost, stump, woodpile, crate, hayBale, well, flowers, blossomBush, oval, disc, speckle };
})();
