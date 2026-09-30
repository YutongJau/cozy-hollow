/* Cozy Hollow art - plants
   crops by growth stage, wild forage, and inventory icons (tools, seeds, produce).
   Draw only with px() (fillRect) and drawImage at integer coordinates; finish sprites with outline(canvas, OUT).
   Render any sprite to a PNG to check it:  node tools/render.js out.png 5 "expr" ...   (expr evaluated against ART) */
"use strict";
(function () {
const { A, cache, blank, px, hash, rng, hex, rgb, shade, mix, cached, outline, mirrored, OUT, COLORS, ITEM_HEX, SEASON, TREE_PAL, WOOD, text3x5, textWidth } = window.ART;
const ART = window.ART;

// ------------------------------------------------------------ palettes
const LEAF = { D: "#2a6a2a", M: "#3f9438", L: "#63bd52", X: "#9ae07f" };          // foliage: shadow, base, light, highlight
const STEM = { D: "#2f6b26", M: "#4a8f3a", L: "#6fb455" };
const SOIL = { D: "#6b4629", M: "#8d5f38", L: "#a97a4a", X: "#c4955c" };
const METAL = { D: "#5a616a", M: "#8f98a2", L: "#c3cad1", X: "#eef1f4" };
const PAPER = { D: "#c9a36b", M: "#f1e2c2", L: "#fbf3e2", X: "#ffffff" };
const WHITE = "#ffffff";

// ------------------------------------------------------------ pixel helpers (all integer fillRects)
/* ellipse inscribed in the rect x,y,w,h drawn as whole rows */
function disc(g, x, y, w, h, col) {
  for (let j = 0; j < h; j++) {
    const v = ((j + 0.5) / h) * 2 - 1, hw = Math.sqrt(Math.max(0, 1 - v * v)) * (w / 2);
    const x0 = Math.round(w / 2 - hw), x1 = Math.round(w / 2 + hw);
    if (x1 > x0) px(g, x + x0, y + j, x1 - x0, 1, col);
  }
}
/* a shaded round object lit from the top-left: dark rim bottom-right, light patch and a highlight glint */
function ball(g, x, y, w, h, col, glint) {
  const D = shade(col, 0.66), L = shade(col, 1.18), X = mix(col, WHITE, 0.6);
  disc(g, x, y, w, h, D);
  disc(g, x, y, w - 1, h - 1, col);
  if (w > 5 && h > 5) disc(g, x + 1, y + 1, w - 4, h - 4, L);
  if (glint !== false) px(g, x + Math.max(1, Math.round(w * 0.25)), y + Math.max(1, Math.round(h * 0.2)), w > 8 ? 2 : 1, 1, X);
}
/* thick line: a w x h block at every step from (x0,y0) to (x1,y1) */
function line(g, x0, y0, x1, y1, w, h, col) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= n; i++) px(g, Math.round(x0 + dx * i / n), Math.round(y0 + dy * i / n), w, h, col);
}
/* a leaf blob: dark underside row, base body, light streak on top */
function leafBlob(g, x, y, w, h, P) {
  P = P || LEAF;
  disc(g, x, y + 1, w, h, P.D);
  disc(g, x, y, w, h - 1, P.M);
  if (w >= 5) px(g, x + Math.round(w * 0.3), y + (h > 3 ? 1 : 0), Math.max(1, Math.round(w * 0.35)), 1, P.L);
  if (w >= 7) px(g, x + Math.round(w * 0.35), y + (h > 3 ? 1 : 0), 1, 1, P.X);
}
/* a pointed blade of leaf from (x0,y0) to (x1,y1), 2px thick with a lit top-left edge */
function blade(g, x0, y0, x1, y1, P) {
  P = P || LEAF;
  line(g, x0, y0, x1, y1, 2, 2, P.M);
  line(g, x0, y0, x1, y1, 1, 1, P.L);
  line(g, x0 + 1, y0 + 1, x1 + 1, y1 + 1, 1, 1, P.D);
}
/* a pointed leaf along the line (x0,y0)->(x1,y1): width swells to `thick` mid-way and tapers to a point at both ends;
   lit edge toward the top-left, dark underside, and a dark mid-rib on the broad ones */
function leafAt(g, x0, y0, x1, y1, thick, P) {
  P = P || LEAF;
  const dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy), 1), horiz = Math.abs(dx) >= Math.abs(dy);
  for (let i = 0; i <= n; i++) {
    const t = i / n, w = Math.max(1, Math.round(Math.sin(t * Math.PI) * thick));
    const cx = Math.round(x0 + dx * t), cy = Math.round(y0 + dy * t);
    if (horiz) {
      const top = cy - (w >> 1);
      px(g, cx, top, 1, w, P.M);
      if (w >= 2) px(g, cx, top + w - 1, 1, 1, P.D);
      if (w >= 3) px(g, cx, top, 1, 1, P.L);
      if (w >= 5 && t > 0.2 && t < 0.8) px(g, cx, cy, 1, 1, P.D);
    } else {
      const left = cx - (w >> 1);
      px(g, left, cy, w, 1, P.M);
      if (w >= 2) px(g, left + w - 1, cy, 1, 1, P.D);
      if (w >= 3) px(g, left, cy, 1, 1, P.L);
      if (w >= 5 && t > 0.2 && t < 0.8) px(g, cx, cy, 1, 1, P.D);
    }
  }
}
/* a broad three-lobed leaf (pumpkin / melon / vine) with its stalk joint at (x,y), lobes of size s */
function lobed(g, x, y, s, P) {
  P = P || LEAF;
  leafAt(g, x, y, x - s, y - s + 1, s - 1, P); leafAt(g, x, y, x + s, y - s + 1, s - 1, P);
  leafAt(g, x, y, x, y - s - 2, s - 1, P);
  px(g, x, y - 1, 1, 1, P.D);
}
/* vertical stem with a lit left side */
function stem(g, cx, top, h, P) { P = P || STEM; px(g, cx - 1, top, 2, h, P.D); px(g, cx - 1, top, 1, h, P.M); }
/* a wooden handle from (x0,y0) to (x1,y1): 3px band with light and dark edges */
function handle(g, x0, y0, x1, y1) {
  line(g, x0, y0, x1, y1, 3, 2, WOOD.mid);
  line(g, x0, y0, x1, y1, 1, 1, WOOD.light);
  line(g, x0 + 2, y0 + 1, x1 + 2, y1 + 1, 1, 1, WOOD.dark);
}
/* a mound of worked soil */
function mound(g, cx, y, w, h) {
  // a wide, low heap of turned earth (a taller bowl shape read as a flower pot in game): flat top, no bright rim
  const hh = Math.min(h, 4), ww = Math.min(28, w + 4), x = Math.max(1, cx - (ww >> 1)), yy = y + (h - hh);
  disc(g, x, yy, ww, hh, SOIL.D);
  disc(g, x + 1, yy, ww - 2, hh - 1, SOIL.M);
  px(g, x + 3, yy, 3, 1, SOIL.L); px(g, x + ww - 8, yy, 2, 1, SOIL.L);        // two faint lit crumbs on the crest
  px(g, x + 5, yy + 1, 1, 1, SOIL.D); px(g, x + ww - 6, yy + 2, 2, 1, SOIL.D);   // clods
}
/* a rounded clump of foliage: dark silhouette with a base-tone body, then many small pointed leaves scattered over it,
   the ones toward the top-left in lighter greens and the ones toward the bottom-right in shadow */
function clump(g, x, y, w, h, seed, P) {
  P = P || LEAF;
  const r = rng(seed + 11), cx = x + w / 2, cy = y + h / 2;
  disc(g, x, y + 1, w, h, P.D);
  disc(g, x, y, w - 1, h - 1, P.M);
  const n = Math.max(5, Math.round(w * h / 16)), leaves = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.8;
    const lx = cx + Math.cos(a) * rr * (w / 2 - 1), ly = cy + Math.sin(a) * rr * (h / 2 - 1);
    const ang = Math.atan2(ly - cy, (lx - cx) * (h / w)) + (r() - 0.5) * 1.3, len = 3 + Math.floor(r() * 3);
    leaves.push([lx, ly, ang, len]);
  }
  leaves.sort((p, q) => p[1] - q[1]);
  for (const [lx, ly, ang, len] of leaves) {
    const light = (lx - cx) / w + (ly - cy) / h;
    const pal = light < -0.1 ? { D: P.M, M: P.L, L: P.X } : light > 0.2 ? { D: P.D, M: P.D, L: P.M } : P;
    leafAt(g, Math.round(lx), Math.round(ly), Math.round(lx + Math.cos(ang) * len), Math.round(ly + Math.sin(ang) * len), 3, pal);
  }
  // ragged edge: a few small dark leaf tips poking out of the silhouette, rooted inside it so none floats as a stray speck
  const tip = { D: P.D, M: P.D, L: P.M, X: P.M };
  for (let i = 0; i < 3; i++) {
    const ex = Math.round(cx + (r() - 0.5) * w * 0.3), top = r() < 0.5, dir = r() < 0.5 ? -2 : 2;
    if (top) leafAt(g, ex, y + 1, ex + dir, y - 1, 2, tip); else leafAt(g, ex, y + h - 1, ex + dir, y + h + 1, 2, tip);
  }
}
/* a low mound of dark worked soil under a seedling (rows base-2..base): no rim, just turned earth with a lit crest */
function soilMound(g, cx, base, w) {
  const x = cx - (w >> 1);
  disc(g, x, base - 2, w, 3, SOIL.D);
  disc(g, x + 1, base - 2, w - 2, 2, SOIL.M);
  px(g, x + 2, base - 2, Math.max(2, (w >> 1) - 2), 1, SOIL.L); px(g, x + 3, base - 2, 1, 1, SOIL.X);
  px(g, x + w - 3, base - 1, 1, 1, SOIL.D); px(g, x + 3, base - 1, 1, 1, SOIL.D);
}
/* deterministic per-crop seed folded from the crop's name, so every kind gets its own leaf count and clump scatter */
function strSeed(s) { let h = hash(s.length, 7); for (let i = 0; i < s.length; i++) h = hash(h & 0xffff, s.charCodeAt(i) + i); return h; }
/* foliage palette of a growing crop: LEAF nudged ~15% toward the crop's own colour, so a field shows what is planted before harvest */
const TINT = {};
function tintLeaf(kind) {
  if (TINT[kind]) return TINT[kind];
  const c = ITEM_HEX[kind];
  return (TINT[kind] = c ? { D: mix(LEAF.D, c, 0.15), M: mix(LEAF.M, c, 0.15), L: mix(LEAF.L, c, 0.15), X: mix(LEAF.X, c, 0.15) } : LEAF);
}

// ------------------------------------------------------------ crops
const FAMILY = {
  turnip: "leafy", potato: "leafy", radish: "leafy", winter_root: "leafy", cauliflower: "leafy", snowdrop: "leafy",
  strawberry: "bush", blueberry: "bush", cranberry: "trail", tomato: "bush", pumpkin: "vine", melon: "vine",
  corn: "stalk", sunflower: "stalk", starfruit: "stalk",
};
const CRAN = { D: "#3a5a2a", M: "#5a8a3a", L: "#82b054", X: "#b4d47a" };   // bronze-green trailing cranberry foliage
function leafy(g, cx, base, height, leaf, dark, leafL) {   // kept for compatibility (other modules may call it)
  const P = { D: dark, M: leaf, L: leafL, X: leafL };
  stem(g, cx, base - height, height, { D: dark, M: leaf });
  for (let i = 1; i <= Math.floor(height / 4); i++) {
    const y = base - i * 4, w = 6 - Math.min(2, i - 1);
    leafBlob(g, cx - w - 1, y - 1, w + 1, 3, P); leafBlob(g, cx + 1, y - 3, w + 1, 3, P);
  }
}
/* stage 0: a seedling in a low soil mound with 2-4 leaves (P: leaf palette, v: 0..2 variant picks the leaf count) */
function sproutPlant(g, cx, base, P, v) {
  P = P || LEAF; v = v || 0;
  // no mound: the sprout stands straight on the tilled soil (an outlined mound read as a flower pot in game)
  stem(g, cx, base - 6, 6);
  leafAt(g, cx, base - 5, cx - 6, base - 9, 3, P); leafAt(g, cx, base - 5, cx + 6, base - 9, 3, P);
  if (v === 1) leafAt(g, cx, base - 6, cx + 1, base - 11, 2, P);
  if (v === 2) { leafAt(g, cx, base - 6, cx - 3, base - 11, 2, P); leafAt(g, cx, base - 6, cx + 3, base - 11, 2, P); }
  px(g, cx - 1, base - 7, 1, 1, P.X);
}
/* rosette of pointed leaves fanning out from the crown: stage 1..3 (back leaves first, drooping front leaves last)
   P: leaf palette; v: 0..2 variant (1 = fewer, narrower leaves, 2 = more leaves and a wider spread) */
function rosette(g, cx, base, stage, P, v) {
  P = P || LEAF; v = v || 0;
  const crown = base - 2, s = v === 2 ? 1 : 0;
  if (stage === 1) {
    leafAt(g, cx, crown, cx - 3, crown - 9, 3, P); leafAt(g, cx, crown, cx + 3, crown - 9, 3, P);
    if (v) leafAt(g, cx, crown, cx + (v === 1 ? -1 : 1), crown - 11, 3, P);
    px(g, cx - 1, crown - 1, 2, 2, STEM.D);
    leafAt(g, cx, crown, cx - 8 - s, crown - 4, 3, P); leafAt(g, cx, crown, cx + 8 + s, crown - 4, 3, P);
    return;
  }
  if (stage === 2) {
    leafAt(g, cx, crown, cx - 3, crown - 14, 4, P); leafAt(g, cx, crown, cx + 3, crown - 13, 4, P);
    if (v === 2) leafAt(g, cx, crown, cx, crown - 15, 4, P);
    leafAt(g, cx, crown, cx - 8 - s, crown - 11, 4, P); leafAt(g, cx, crown, cx + 8 + s, crown - 11, 4, P);
    px(g, cx - 1, crown - 1, 2, 2, STEM.D);
    leafAt(g, cx, crown, cx - 11 - s, crown - 5, 4, P); leafAt(g, cx, crown, cx + 11 + s, crown - 5, 4, P);
    if (v !== 1) { leafAt(g, cx, crown, cx - 5, crown + 1, 3, P); leafAt(g, cx, crown, cx + 5, crown + 1, 3, P); }
    return;
  }
  if (v !== 1) leafAt(g, cx, crown, cx, crown - 18, 5, P);
  leafAt(g, cx, crown, cx - 6, crown - 16, 5, P); leafAt(g, cx, crown, cx + 6, crown - 16, 5, P);
  if (v === 2) { leafAt(g, cx, crown, cx - 3, crown - 19, 4, P); leafAt(g, cx, crown, cx + 3, crown - 19, 4, P); }
  leafAt(g, cx, crown, cx - 11 - s, crown - 12, 5, P); leafAt(g, cx, crown, cx + 11 + s, crown - 12, 5, P);
  px(g, cx - 1, crown - 1, 2, 2, STEM.D);
  leafAt(g, cx, crown, cx - 14, crown - 5, 5, P); leafAt(g, cx, crown, cx + 14, crown - 5, 5, P);
  if (v !== 1) { leafAt(g, cx, crown, cx - 8, crown + 1, 4, P); leafAt(g, cx, crown, cx + 8, crown + 1, 4, P); }
  else { leafAt(g, cx, crown, cx - 9, crown - 1, 4, P); leafAt(g, cx, crown, cx + 9, crown - 1, 4, P); }
  px(g, cx - 1, crown - 3, 2, 1, P.X);
}
/* bush crops: sprig -> small clump -> big clump (P: leaf palette, v: 0..2 variant changes leaf pairs and clump width) */
function bushStage(g, cx, base, stage, seed, P, v) {
  P = P || LEAF; v = v || 0;
  if (stage === 1) {   // a woody sprig with pairs of leaves
    px(g, cx - 1, base - 11, 2, 11, STEM.D); px(g, cx - 1, base - 11, 1, 11, STEM.M);
    leafAt(g, cx, base - 4, cx - 7, base - 7, 3, P); leafAt(g, cx, base - 4, cx + 7, base - 7, 3, P);
    if (v === 2) { leafAt(g, cx, base - 7, cx - 5, base - 11, 3, P); leafAt(g, cx, base - 7, cx + 5, base - 11, 3, P); }
    if (v === 1) leafAt(g, cx, base - 10, cx + 2, base - 15, 3, P);
    else { leafAt(g, cx, base - 10, cx - 2, base - 15, 3, P); leafAt(g, cx, base - 10, cx + 3, base - 14, 3, P); }
    return;
  }
  const w2 = v === 2 ? 18 : 16, w3 = v === 2 ? 26 : v === 1 ? 22 : 24;
  if (stage === 2) {
    px(g, cx - 1, base - 6, 2, 6, STEM.D); px(g, cx - 1, base - 6, 1, 6, STEM.M);
    clump(g, cx - (w2 >> 1), base - 16, w2, 12, seed, P);
    leafAt(g, cx - 6, base - 6, cx - 11, base - 3, 3, P); leafAt(g, cx + 6, base - 6, cx + 11, base - 3, 3, P);
    return;
  }
  px(g, cx - 2, base - 7, 3, 7, STEM.D); px(g, cx - 2, base - 7, 1, 7, STEM.M);
  clump(g, cx - (w3 >> 1), base - 20, w3, v === 1 ? 17 : 16, seed, P);
  leafAt(g, cx - 9, base - 6, cx - 15, base - 3, 3, P); leafAt(g, cx + 9, base - 6, cx + 15, base - 3, 3, P);
}
/* vine crops (P: leaf palette, v: 0..2 variant changes lobe size, leaf count and which way the tendril curls) */
function vineStage(g, cx, base, stage, P, v) {
  P = P || LEAF; v = v || 0;
  if (stage === 1) {
    stem(g, cx, base - 6, 6);
    leafAt(g, cx, base - 4, cx - 8, base - 8, 5, P); leafAt(g, cx, base - 4, cx + 8, base - 9, 5, P);
    leafAt(g, cx, base - 6, cx + 1 - v, base - 13, 4, P);
    if (v === 2) leafAt(g, cx, base - 5, cx + 5, base - 12, 3, P);
    return;
  }
  const s = v === 1 ? 4 : 5;
  // a trailing vine along the ground with broad three-lobed leaves on short stalks
  line(g, cx - 13, base - 2, cx + 12, base - 3, 2, 1, STEM.D); line(g, cx - 13, base - 2, cx + 12, base - 3, 1, 1, STEM.M);
  if (v === 2) line(g, cx - 13, base - 2, cx - 15, base - 5, 1, 1, STEM.D); else line(g, cx + 12, base - 3, cx + 14, base - 6, 1, 1, STEM.D);   // tendril
  stem(g, cx - 8, base - 7, 5); stem(g, cx + 2, base - 8, 6); stem(g, cx + 10, base - 6, 4);
  if (stage === 3) {
    stem(g, cx - 3, base - 15, 9); stem(g, cx + 8, base - 16, 10);
    lobed(g, cx - 3, base - 15, s, P); lobed(g, cx + 8, base - 16, s, P);
    if (v === 2) { stem(g, cx - 11, base - 12, 5); lobed(g, cx - 11, base - 12, 4, P); }
    ball(g, cx - 4, base - 8, 7, 6, "#8fc95a");   // a green baby fruit
  }
  lobed(g, cx - 8, base - 7, stage === 3 ? s : 4, P); lobed(g, cx + 10, base - 6, 4, P); lobed(g, cx + 2, base - 8, stage === 3 ? s : v === 1 ? 4 : 5, P);
}
/* stalk crops (P: leaf palette, v: 0..2 variant changes blade lean and count) */
function stalkStage(g, cx, base, stage, P, v) {
  P = P || LEAF; v = v || 0;
  const h = stage === 1 ? 9 : stage === 2 ? 15 : 22, k = v === 1 ? -1 : v === 2 ? 1 : 0;
  stem(g, cx, base - h, h);
  blade(g, cx - 2, base - 5, cx - 8 - k, base - 9, P); blade(g, cx + 1, base - 7, cx + 7 + k, base - 11, P);
  if (v === 2) blade(g, cx + 1, base - 4, cx + 5, base - 6, P);
  if (stage >= 2) {
    blade(g, cx - 2, base - 11, cx - 8 - k, base - 16, P); blade(g, cx + 1, base - 13, cx + 6 + k, base - 18, P);
    if (v === 2) blade(g, cx - 2, base - 9, cx - 5, base - 12, P);
  }
  if (stage === 3) { blade(g, cx - 2, base - 17, cx - 7 - k, base - 22, P); blade(g, cx + 1, base - 19, cx + 5 + k, base - 24, P); leafBlob(g, cx - 3, base - 26, 6, 4, P); }
  else leafBlob(g, cx - 2, base - h - 3, 5, 3, P);
}
/* cranberry: a low trailing mat of runners along the ground with short upright shoots of small paired leaves
   (stage 1..3 grows more runners and shoots; V is the foliage palette) */
function cranberryMat(g, cx, base, stage, V) {
  V = V || CRAN;
  line(g, cx - 5, base - 4, cx + 4, base - 2, 1, 1, STEM.D);
  if (stage >= 2) {
    line(g, cx - 14, base - 3, cx - 5, base - 4, 1, 1, STEM.D); line(g, cx + 4, base - 2, cx + 14, base - 4, 1, 1, STEM.D);
    px(g, cx - 12, base - 4, 3, 1, STEM.M); px(g, cx + 8, base - 4, 3, 1, STEM.M);
  } else px(g, cx - 3, base - 4, 3, 1, STEM.M);
  const shoots = stage === 1 ? [[cx - 3, 6], [cx + 4, 5]] : stage === 2 ? [[cx - 9, 6], [cx - 3, 8], [cx + 4, 7], [cx + 9, 5]] : [[cx - 10, 7], [cx - 3, 9], [cx + 4, 8], [cx + 10, 6]];
  shoots.forEach(([x, h], i) => {
    px(g, x, base - 3 - h, 1, h, STEM.D);
    for (let j = 1; j < h; j += 3) { leafAt(g, x, base - 3 - j, x - 3, base - 5 - j, 2, V); leafAt(g, x + 1, base - 4 - j, x + 4, base - 6 - j, 2, V); }
    leafAt(g, x, base - 3 - h, x + (i % 2 ? 2 : -2), base - 6 - h, 2, V);
  });
  const ground = stage === 1 ? [[cx - 4, base - 4, -3], [cx + 3, base - 3, 3]]
    : [[cx - 13, base - 4, 3], [cx - 7, base - 5, -3], [cx + 1, base - 3, 3], [cx + 7, base - 3, -3], [cx + 13, base - 5, -3]];
  ground.forEach(([x, y, d]) => leafAt(g, x, y, x + d, y - 3, 2, V));
}
/* an explicit 7x7 five-point star centred on (cx,cy): 1-2px arms, darker rim on the lower-right arms, highlight top-left */
function star(g, cx, cy, col, colD, colL, colX) {
  const x = cx - 3, y = cy - 3;
  px(g, x + 3, y, 1, 1, colX || colL); px(g, x + 2, y + 1, 3, 1, col); px(g, x, y + 2, 7, 1, col); px(g, x + 1, y + 3, 5, 1, col); px(g, x + 2, y + 4, 3, 1, col);
  px(g, x + 1, y + 5, 2, 1, col); px(g, x + 4, y + 5, 2, 1, col); px(g, x + 1, y + 6, 1, 1, col); px(g, x + 5, y + 6, 1, 1, colD);
  px(g, x + 4, y + 1, 1, 1, colD); px(g, x + 6, y + 2, 1, 1, colD); px(g, x + 5, y + 3, 1, 1, colD); px(g, x + 4, y + 4, 1, 1, colD); px(g, x + 5, y + 5, 1, 1, colD);
  px(g, x + 2, y + 1, 1, 1, colL); px(g, x, y + 2, 2, 1, colL); px(g, x + 2, y + 3, 1, 1, colL);
}
function ripeCrop(g, kind, cx, base, col) {
  const D = shade(col, 0.66), L = shade(col, 1.2), X = mix(col, WHITE, 0.6);
  switch (kind) {
    case "turnip": {
      mound(g, cx, base - 4, 18, 5);
      const purple = "#b07ac9", purpleD = "#8a57a8";
      disc(g, cx - 5, base - 11, 11, 10, D); disc(g, cx - 5, base - 11, 10, 9, col);
      disc(g, cx - 4, base - 10, 8, 4, purple); px(g, cx - 4, base - 10, 8, 1, purpleD); px(g, cx - 2, base - 9, 3, 1, mix(purple, WHITE, 0.5));
      px(g, cx - 3, base - 6, 3, 1, X); px(g, cx - 1, base - 2, 2, 2, D);
      rosette(g, cx, base - 10, 2);
      return;
    }
    case "radish": {
      mound(g, cx, base - 4, 18, 5);
      disc(g, cx - 5, base - 11, 10, 10, D); disc(g, cx - 5, base - 11, 9, 9, col); disc(g, cx - 4, base - 10, 5, 4, L); px(g, cx - 3, base - 9, 2, 1, X);
      px(g, cx - 1, base - 2, 2, 3, "#f4eef0"); px(g, cx - 1, base - 2, 1, 3, WHITE);
      rosette(g, cx, base - 10, 2);
      return;
    }
    case "winter_root": {
      mound(g, cx, base - 3, 20, 4); px(g, cx - 9, base - 5, 18, 2, "#eef3f6"); px(g, cx - 7, base - 6, 5, 1, WHITE); px(g, cx + 2, base - 6, 4, 1, WHITE);
      disc(g, cx - 6, base - 12, 12, 9, D); disc(g, cx - 6, base - 12, 11, 8, col); disc(g, cx - 5, base - 11, 6, 3, L); px(g, cx - 4, base - 10, 2, 1, X);
      px(g, cx - 3, base - 8, 5, 1, D); px(g, cx - 2, base - 6, 4, 1, D);
      rosette(g, cx, base - 11, 2);
      return;
    }
    case "potato": {
      mound(g, cx, base - 6, 24, 7);
      [[cx - 10, base - 6, 7, 5], [cx + 3, base - 7, 8, 6], [cx - 4, base - 4, 7, 5]].forEach(([x, y, w, h]) => {
        disc(g, x, y, w, h, D); disc(g, x, y, w - 1, h - 1, col); px(g, x + 2, y + 1, 2, 1, L); px(g, x + 1, y + 2, 1, 1, D); px(g, x + w - 3, y + 1, 1, 1, D);
      });
      rosette(g, cx, base - 8, 2);
      return;
    }
    case "cauliflower": {
      const curd = "#f7f3e8", curdD = "#c6bb9f", curdX = WHITE, BL = { D: "#2f6f4a", M: "#4a9a60", L: "#7cc487", X: "#b6e6b4" };   // blue-green wrapper leaves
      // broad rounded lobed wrapper leaves: two big ones behind the curd, a cradle leaf under it, two small cups curling over its lower corners
      const wrap = (x, y, w, h, lit) => { disc(g, x, y + 1, w, h, BL.D); disc(g, x + (lit ? 0 : 1), y, w - 1, h - 1, BL.M); };
      wrap(cx - 15, base - 22, 11, 16, true); disc(g, cx - 15, base - 17, 5, 7, BL.D); disc(g, cx - 15, base - 18, 5, 7, BL.M);   // left, with an outer side lobe
      px(g, cx - 13, base - 20, 2, 5, BL.L); px(g, cx - 13, base - 20, 1, 1, BL.X); px(g, cx - 14, base - 16, 1, 1, BL.L); line(g, cx - 10, base - 20, cx - 11, base - 8, 1, 1, BL.D);
      px(g, cx - 12, base - 23, 1, 1, BL.M); px(g, cx - 8, base - 22, 1, 1, BL.M);   // ruffle at the top edge
      wrap(cx + 3, base - 22, 11, 16, false); disc(g, cx + 9, base - 17, 5, 7, BL.D); disc(g, cx + 10, base - 18, 5, 7, BL.M);   // right, with an outer side lobe
      px(g, cx + 6, base - 20, 2, 3, BL.L); line(g, cx + 9, base - 20, cx + 9, base - 8, 1, 1, BL.D);
      px(g, cx + 10, base - 23, 1, 1, BL.M); px(g, cx + 6, base - 22, 1, 1, BL.M);
      disc(g, cx - 8, base - 9, 17, 7, BL.D); disc(g, cx - 8, base - 9, 16, 6, BL.M); px(g, cx - 6, base - 9, 4, 1, BL.L);   // cradle leaf under the curd
      disc(g, cx - 9, base - 21, 18, 15, curdD); disc(g, cx - 9, base - 21, 17, 14, curd);
      [[cx - 7, base - 19, 5, 4], [cx - 2, base - 20, 6, 5], [cx + 3, base - 18, 5, 4], [cx - 6, base - 15, 5, 4], [cx - 1, base - 14, 6, 4], [cx + 4, base - 13, 5, 4], [cx - 8, base - 12, 4, 3], [cx, base - 10, 5, 3]]
        .forEach(([x, y, w, h]) => { disc(g, x, y + 1, w, h, curdD); disc(g, x, y, w, h - 1, curd); px(g, x + 1, y, 2, 1, curdX); });
      wrap(cx - 13, base - 11, 8, 8, true); px(g, cx - 11, base - 10, 3, 1, BL.L); px(g, cx - 12, base - 9, 1, 2, BL.L); line(g, cx - 9, base - 9, cx - 10, base - 5, 1, 1, BL.D);   // front-left cup
      px(g, cx - 13, base - 7, 1, 1, BL.M); px(g, cx - 7, base - 11, 1, 1, BL.M);
      wrap(cx + 5, base - 11, 8, 8, false); px(g, cx + 7, base - 10, 3, 1, BL.L); line(g, cx + 9, base - 9, cx + 10, base - 5, 1, 1, BL.D);   // front-right cup
      px(g, cx + 12, base - 7, 1, 1, BL.M); px(g, cx + 6, base - 11, 1, 1, BL.M);
      px(g, cx - 6, base - 4, 12, 2, BL.D); px(g, cx - 4, base - 4, 8, 1, mix(BL.D, BL.M, 0.5)); px(g, cx - 3, base - 2, 6, 1, BL.D);   // stub of stalk and its shadow on the soil
      return;
    }
    case "snowdrop": {
      const bell = "#f4f7fa", bellD = "#c8d4de", bellM = "#e2e9ef", bellX = WHITE, tip = "#8ec96b", tipD = "#5a9a44";
      const GL = { D: "#3f7a34", M: "#5fa84a", L: "#9bd47a", X: "#c8ec9a" };   // glaucous snowdrop leaves
      soilMound(g, cx, base, 13);
      leafAt(g, cx - 5, base - 1, cx - 10, base - 15, 3, GL); leafAt(g, cx + 5, base - 1, cx + 10, base - 14, 3, GL);
      leafAt(g, cx - 1, base - 1, cx - 3, base - 17, 3, GL); leafAt(g, cx + 2, base - 1, cx + 4, base - 16, 3, GL);
      px(g, cx - 5, base - 2, 3, 1, "#e6eef2"); px(g, cx + 3, base - 2, 3, 1, "#e6eef2"); px(g, cx - 4, base - 2, 1, 1, WHITE); px(g, cx - 2, base - 1, 2, 1, "#e6eef2");   // snow dusting the mound
      // three arching stems, each ending in a drooping bell: a 2px green neck, a skirt widening to 5px, a notched hem, shadow lower-right
      [[cx - 9, base - 23, cx - 6], [cx + 1, base - 26, cx + 3], [cx - 2, base - 20, cx + 9]].forEach(([x0, top, x1], i) => {
        line(g, i === 2 ? cx : x0 + 2, base - 4, x0 + 3, top, 1, 1, STEM.D); line(g, x0 + 3, top, x1, top + 2, 1, 1, STEM.D);
        px(g, x1, top + 3, 2, 2, tip); px(g, x1 + 1, top + 3, 1, 2, tipD);                                   // neck / ovary
        px(g, x1, top + 5, 3, 1, bell); px(g, x1 - 1, top + 6, 5, 3, bell);                                   // skirt
        px(g, x1 + 3, top + 6, 1, 3, bellD); px(g, x1 + 2, top + 8, 1, 1, bellD); px(g, x1 + 2, top + 6, 1, 2, bellM); px(g, x1 + 1, top + 8, 1, 1, bellM);
        px(g, x1 - 1, top + 6, 1, 2, bellX); px(g, x1, top + 5, 1, 1, bellX);
        px(g, x1 - 1, top + 9, 1, 1, bell); px(g, x1 + 1, top + 9, 1, 1, tipD); px(g, x1 + 3, top + 9, 1, 1, bellD);   // notched hem, green mark on the middle petal
      });
      return;
    }
    case "strawberry": {
      clump(g, cx - 12, base - 16, 24, 11, 7);   // raised so the hanging berries stay on the base line
      leafAt(g, cx - 10, base - 9, cx - 16, base - 6, 3); leafAt(g, cx + 10, base - 9, cx + 16, base - 6, 3);
      const berry = (x, y) => {   // a tapered berry hanging under a green calyx, seeds as pale flecks
        px(g, x - 1, y - 1, 2, 1, LEAF.M); px(g, x + 1, y - 1, 3, 1, LEAF.L); px(g, x + 4, y - 1, 2, 1, LEAF.M); px(g, x + 2, y - 2, 1, 1, LEAF.D);
        px(g, x, y, 5, 3, col); px(g, x + 1, y + 3, 3, 2, col); px(g, x + 2, y + 5, 1, 1, D);
        px(g, x + 4, y + 1, 1, 2, D); px(g, x + 3, y + 3, 1, 2, D); px(g, x + 1, y + 4, 1, 1, D);
        px(g, x, y, 1, 2, L); px(g, x + 1, y, 2, 1, L);
        px(g, x + 1, y + 1, 1, 1, X); px(g, x + 3, y + 2, 1, 1, X); px(g, x + 2, y + 3, 1, 1, X);
      };
      [[cx - 11, base - 12], [cx - 4, base - 10], [cx + 4, base - 12], [cx, base - 17], [cx - 7, base - 6], [cx + 8, base - 7]].forEach(([x, y]) => berry(x, y));
      return;
    }
    case "blueberry": {
      px(g, cx - 2, base - 6, 3, 6, STEM.D); px(g, cx - 2, base - 6, 1, 6, STEM.M);
      clump(g, cx - 11, base - 21, 22, 17, 3);
      leafAt(g, cx - 9, base - 8, cx - 15, base - 5, 3); leafAt(g, cx + 9, base - 8, cx + 15, base - 5, 3);
      [[cx - 9, base - 15], [cx - 5, base - 11], [cx - 2, base - 18], [cx + 3, base - 14], [cx + 7, base - 11], [cx + 1, base - 8], [cx - 8, base - 7], [cx + 6, base - 18], [cx - 3, base - 14]]
        .forEach(([x, y]) => { disc(g, x, y, 4, 4, D); disc(g, x, y, 3, 3, col); px(g, x, y, 1, 1, X); px(g, x + 1, y + 2, 1, 1, "#7d8fd9"); });
      return;
    }
    case "cranberry": {
      // a low, wide trailing mat with the berries sitting near the ground
      cranberryMat(g, cx, base, 3, CRAN);
      [[cx - 13, base - 8], [cx - 8, base - 5], [cx - 4, base - 9], [cx + 1, base - 6], [cx + 6, base - 10], [cx + 9, base - 5], [cx + 11, base - 8], [cx - 2, base - 4]]
        .forEach(([x, y]) => { disc(g, x, y, 4, 4, D); disc(g, x, y, 3, 3, col); px(g, x, y, 1, 1, X); px(g, x + 1, y + 1, 1, 1, L); });
      return;
    }
    case "tomato": {
      // stake
      px(g, cx + 2, base - 24, 3, 24, WOOD.mid); px(g, cx + 2, base - 24, 1, 24, WOOD.light); px(g, cx + 4, base - 24, 1, 24, WOOD.dark); px(g, cx + 2, base - 25, 3, 1, WOOD.light);
      px(g, cx + 1, base - 15, 5, 1, "#8a6a4a"); px(g, cx + 1, base - 7, 5, 1, "#8a6a4a");
      // vine winding around it
      line(g, cx - 2, base - 1, cx - 3, base - 20, 2, 1, STEM.D); line(g, cx - 2, base - 1, cx - 3, base - 20, 1, 1, STEM.M);
      line(g, cx - 3, base - 20, cx + 1, base - 25, 1, 1, STEM.D);
      leafAt(g, cx - 3, base - 4, cx - 13, base - 7, 4); leafAt(g, cx - 3, base - 10, cx - 12, base - 14, 4); leafAt(g, cx - 3, base - 16, cx - 12, base - 20, 4);
      leafAt(g, cx - 1, base - 22, cx - 7, base - 27, 4); leafAt(g, cx + 5, base - 19, cx + 13, base - 22, 4); leafAt(g, cx + 5, base - 11, cx + 13, base - 14, 4); leafAt(g, cx + 5, base - 5, cx + 12, base - 8, 3);
      [[cx - 8, base - 10], [cx - 2, base - 16], [cx + 5, base - 6], [cx + 6, base - 18], [cx + 8, base - 12]].forEach(([x, y]) => {
        ball(g, x, y, 6, 6, col); px(g, x + 1, y - 1, 3, 1, LEAF.L); px(g, x, y - 1, 1, 1, LEAF.M); px(g, x + 4, y - 1, 1, 1, LEAF.M); px(g, x + 2, y - 2, 1, 1, STEM.D);
      });
      return;
    }
    case "pumpkin": {
      // vine and lobed leaves behind
      line(g, cx - 13, base - 3, cx - 5, base - 4, 2, 1, STEM.D); line(g, cx + 6, base - 4, cx + 13, base - 5, 2, 1, STEM.D);
      stem(g, cx - 11, base - 9, 5); stem(g, cx + 11, base - 8, 4); lobed(g, cx - 11, base - 9, 4); lobed(g, cx + 11, base - 8, 4);
      const O = "#d96f16";
      disc(g, cx - 11, base - 15, 23, 15, D);
      disc(g, cx - 11, base - 15, 22, 14, col);
      // ridges: darker seams and lit crowns
      [-7, -2, 3].forEach((dx) => { px(g, cx + dx, base - 13, 1, 12, O); });
      px(g, cx - 10, base - 12, 1, 8, O); px(g, cx + 8, base - 12, 1, 8, O);
      [[-11, 3], [-6, 4], [-1, 4], [4, 4], [8, 3]].forEach(([dx, w]) => { px(g, cx + dx + 1, base - 14, w - 1, 1, L); px(g, cx + dx + 1, base - 13, 1, 3, L); });
      px(g, cx - 5, base - 13, 1, 1, X); px(g, cx, base - 13, 1, 2, X);
      disc(g, cx - 10, base - 4, 20, 3, D);
      // stem with a curl
      px(g, cx - 2, base - 19, 4, 5, STEM.D); px(g, cx - 2, base - 19, 2, 5, STEM.M); px(g, cx - 3, base - 20, 6, 2, STEM.D); px(g, cx - 3, base - 20, 3, 1, STEM.L);
      line(g, cx + 3, base - 19, cx + 7, base - 22, 1, 1, STEM.D); px(g, cx + 7, base - 23, 2, 1, STEM.D);
      return;
    }
    case "melon": {
      const S = "#3f8a2e", SL = "#b6e28c";
      line(g, cx + 6, base - 4, cx + 13, base - 6, 2, 1, STEM.D); line(g, cx - 13, base - 4, cx - 6, base - 5, 2, 1, STEM.D);
      stem(g, cx + 11, base - 10, 5); stem(g, cx - 11, base - 8, 4); lobed(g, cx + 11, base - 10, 4); lobed(g, cx - 11, base - 8, 4);
      disc(g, cx - 11, base - 16, 22, 16, D); disc(g, cx - 11, base - 16, 21, 15, col);
      disc(g, cx - 9, base - 14, 12, 8, L);
      // dark stripes following the curve
      [-8, -4, 0, 4, 8].forEach((dx) => { line(g, cx + dx, base - 14, cx + dx + (dx < 0 ? -1 : dx > 0 ? 1 : 0), base - 4, 1, 1, S); });
      px(g, cx - 6, base - 12, 1, 1, SL); px(g, cx - 2, base - 13, 2, 1, SL); px(g, cx - 3, base - 10, 1, 1, SL); px(g, cx + 1, base - 11, 1, 1, SL);
      px(g, cx - 7, base - 13, 2, 1, WHITE);
      disc(g, cx - 9, base - 4, 18, 3, D);
      px(g, cx - 1, base - 18, 2, 3, STEM.D); line(g, cx + 1, base - 18, cx + 5, base - 20, 1, 1, STEM.D);
      return;
    }
    case "corn": {
      stem(g, cx, base - 23, 23, { D: STEM.D, M: STEM.L });
      blade(g, cx - 2, base - 3, cx - 12, base - 8); blade(g, cx + 1, base - 6, cx + 11, base - 12);
      blade(g, cx - 2, base - 11, cx - 11, base - 18); blade(g, cx + 1, base - 13, cx + 10, base - 20);
      blade(g, cx - 2, base - 18, cx - 6, base - 23); blade(g, cx + 1, base - 19, cx + 4, base - 25);
      // tassel (its top row sits at y=1 so the outline can cap it)
      px(g, cx - 2, base - 25, 4, 1, "#e8d48a"); px(g, cx - 3, base - 26, 2, 1, "#e8d48a"); px(g, cx + 1, base - 26, 2, 1, "#e8d48a"); px(g, cx - 1, base - 27, 2, 1, "#f2e4a8");
      // two 5px cobs of checkered kernels in 7px husks peeled open at the top
      const KB = shade(col, 0.8);
      const husk = (x, y) => {
        px(g, x, y, 7, 12, LEAF.M); px(g, x, y, 1, 12, LEAF.L); px(g, x + 6, y, 1, 12, LEAF.D); px(g, x + 1, y + 11, 5, 1, LEAF.D);
        px(g, x - 1, y - 2, 2, 3, LEAF.L); px(g, x + 6, y - 2, 2, 3, LEAF.D); px(g, x, y - 3, 1, 1, LEAF.L); px(g, x + 7, y - 3, 1, 1, LEAF.M);   // peeled-back husk tips
        for (let j = 0; j < 9; j++) for (let i = 0; i < 5; i++) px(g, x + 1 + i, y + 1 + j, 1, 1, ((i + j) & 1) ? KB : col);   // two-colour kernel checker
        px(g, x + 5, y + 2, 1, 8, D); px(g, x + 2, y + 1, 1, 1, X); px(g, x + 1, y + 2, 1, 1, X);   // dark rim on the right, glint top-left
        px(g, x + 3, y - 4, 1, 3, "#e8d48a"); px(g, x + 4, y - 3, 1, 2, "#d9b95a"); px(g, x + 2, y - 3, 1, 1, "#e8d48a");   // silk
      };
      husk(cx - 9, base - 17); husk(cx + 3, base - 13);
      return;
    }
    case "sunflower": {
      stem(g, cx, base - 18, 18, { D: STEM.D, M: STEM.M });
      leafAt(g, cx, base - 6, cx - 11, base - 10, 5); leafAt(g, cx, base - 10, cx + 11, base - 14, 5);
      const YP = { D: "#d9a621", M: "#f7d23e", L: "#ffe97a", X: "#fff5b0" }, C = "#5a3a1a", CD = "#3f2812", CL = "#8a5a2a";
      const hx = cx, hy = base - 19;
      // petals: a shadowed inner ring, then twelve pointed petals fanning out from it
      disc(g, hx - 8, hy - 7, 17, 15, YP.D);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
        leafAt(g, Math.round(hx + c * 3), Math.round(hy + s * 3), Math.round(hx + c * 9), Math.round(hy + s * 8), 4, YP);
      }
      px(g, hx - 7, hy - 3, 2, 1, YP.X); px(g, hx - 3, hy - 7, 1, 2, YP.X);
      disc(g, hx - 5, hy - 5, 11, 10, CD); disc(g, hx - 5, hy - 5, 10, 9, C);
      for (let y = -3; y <= 2; y += 2) for (let x = -4; x <= 3; x += 2) px(g, hx + x + ((y + 3) % 4 ? 1 : 0), hy + y, 1, 1, CL);
      px(g, hx - 3, hy - 3, 2, 1, "#a87a3a"); px(g, hx - 4, hy - 2, 1, 1, "#a87a3a");
      return;
    }
    case "starfruit": {
      stem(g, cx, base - 22, 22, { D: STEM.D, M: STEM.M });
      blade(g, cx - 2, base - 6, cx - 10, base - 10); blade(g, cx + 1, base - 10, cx + 9, base - 15); blade(g, cx - 2, base - 16, cx - 8, base - 22);
      leafBlob(g, cx - 2, base - 26, 6, 4);
      line(g, cx - 1, base - 19, cx - 7, base - 25, 1, 1, STEM.D); line(g, cx + 1, base - 14, cx + 8, base - 20, 1, 1, STEM.D);
      line(g, cx - 1, base - 11, cx - 6, base - 14, 1, 1, STEM.D); line(g, cx + 1, base - 8, cx + 4, base - 9, 1, 1, STEM.D);
      star(g, cx - 8, base - 24, col, D, L, X); star(g, cx + 9, base - 19, col, D, L, X); star(g, cx + 5, base - 6, col, D, L, X); star(g, cx - 9, base - 13, col, D, L, X);
      return;
    }
  }
  // fallback: a bush with round fruit
  clump(g, cx - 10, base - 14, 20, 12, 1);
  [[cx - 7, base - 10], [cx + 1, base - 6], [cx + 4, base - 12]].forEach(([x, y]) => ball(g, x, y, 5, 5, col));
}
function cropSprite(kind, stage, ripe) {
  return cached("crop:" + kind + stage + ripe, A, A, (g, c) => {
    const col = ITEM_HEX[kind] || "#f2c744", cx = 16, base = 28;
    if (!ripe) {
      // every kind gets its own leaf tint and leaf-count variant, so a field reads what is planted before harvest
      const fam = FAMILY[kind] || "leafy", P = tintLeaf(kind), seed = strSeed(kind), v = seed % 3, st = Math.min(3, stage);
      if (stage <= 0) sproutPlant(g, cx, base, P, v);
      else {
        if (fam === "bush") bushStage(g, cx, base, st, hash(seed & 0xffff, st), P, v);
        else if (fam === "vine") vineStage(g, cx, base, st, P, v);
        else if (fam === "stalk") stalkStage(g, cx, base, st, P, v);
        else if (fam === "trail") { cranberryMat(g, cx, base, st, P); if (st === 3) [[cx - 9, base - 8], [cx + 2, base - 7], [cx + 8, base - 9]].forEach(([x, y]) => px(g, x, y, 2, 2, "#a8d070")); }
        else rosette(g, cx, base, st, P, v);
      }
    } else ripeCrop(g, kind, cx, base, col);
    outline(c, OUT);
  });
}

// ------------------------------------------------------------ forage
function forageSprite(key) {
  const col = ITEM_HEX[key] || "#f2c744";
  return cached("forage:" + key, A, A, (g, c) => {
    const D = shade(col, 0.66), L = shade(col, 1.2), X = mix(col, WHITE, 0.6);
    if (key === "mushroom") {
      const cap = "#c98f5a", capD = "#8f5f34", capL = "#e0b07a", st = "#f3e6cc", stD = "#cbb48e";
      // small one behind left
      disc(g, 3, 15, 9, 6, capD); disc(g, 3, 15, 8, 5, cap); px(g, 5, 16, 2, 1, capL); px(g, 6, 20, 3, 7, st); px(g, 8, 20, 1, 7, stD);
      // big one
      px(g, 13, 17, 7, 11, st); px(g, 18, 18, 2, 10, stD); px(g, 13, 17, 1, 10, "#fbf5e8"); px(g, 12, 26, 9, 2, stD);
      disc(g, 8, 8, 18, 11, capD); disc(g, 8, 8, 17, 10, cap); disc(g, 10, 9, 8, 4, capL);
      px(g, 8, 16, 17, 2, capD); px(g, 12, 17, 9, 1, "#7a4f2a");
      [[12, 11, 2, 2], [19, 12, 2, 2], [16, 9, 1, 1], [22, 15, 1, 1], [9, 14, 1, 1]].forEach(([x, y, w, h]) => px(g, x, y, w, h, "#fff6e6"));
      px(g, 14, 20, 4, 1, "#e8d8b8");   // gill line
    } else if (key === "leek") {
      const W = "#f4f1ea", WD = "#d6cdb8", G = "#5fae3f", GD = "#3f8f3a", GL = "#8fd14f";
      px(g, 11, 22, 10, 6, W); px(g, 11, 22, 3, 6, "#ffffff"); px(g, 18, 22, 3, 6, WD); px(g, 12, 28, 8, 1, WD);
      px(g, 12, 27, 1, 3, "#e0d8c4"); px(g, 15, 28, 1, 3, "#e0d8c4"); px(g, 18, 27, 1, 3, "#e0d8c4");   // roots
      px(g, 12, 14, 8, 8, mix(W, G, 0.5)); px(g, 12, 14, 3, 8, mix("#ffffff", GL, 0.4));
      blade(g, 12, 15, 4, 3, { M: G, L: GL, D: GD }); blade(g, 15, 13, 12, 1, { M: G, L: GL, D: GD }); blade(g, 18, 15, 25, 3, { M: G, L: GL, D: GD }); blade(g, 19, 17, 28, 9, { M: G, L: GL, D: GD }); blade(g, 12, 17, 4, 11, { M: G, L: GL, D: GD });
    } else if (key === "hazelnut") {
      const nut = "#a5744a", nutD = "#6e4a2a", nutL = "#c9975f", cup = "#d2ad78", cupL = "#ecd3a0", cupD = "#b08a55", seam = "#4e3018";
      [[6, 13], [17, 15], [11, 19]].forEach(([x, y]) => {
        disc(g, x, y, 10, 10, nutD); disc(g, x, y, 9, 9, nut);
        disc(g, x + 1, y + 4, 4, 3, nutL); px(g, x + 2, y + 4, 1, 1, "#eed6ad"); px(g, x + 1, y + 7, 1, 1, nutD);   // glossy shell with a glint
        // the pale tan husk cap: rounded top, a scalloped hem and a 1px dark seam where it meets the shell
        px(g, x + 2, y, 5, 1, cup); px(g, x + 1, y + 1, 7, 1, cup);
        px(g, x, y + 2, 2, 1, cup); px(g, x + 3, y + 2, 3, 1, cup); px(g, x + 7, y + 2, 2, 1, cup); px(g, x + 2, y + 2, 1, 1, seam); px(g, x + 6, y + 2, 1, 1, seam);
        px(g, x, y + 3, 2, 1, seam); px(g, x + 3, y + 3, 3, 1, seam); px(g, x + 7, y + 3, 2, 1, seam);
        px(g, x + 2, y, 2, 1, cupL); px(g, x + 1, y + 1, 2, 1, cupL); px(g, x + 7, y + 1, 1, 1, cupD); px(g, x + 8, y + 2, 1, 1, cupD); px(g, x + 4, y + 2, 1, 1, cupD);
        px(g, x + 4, y - 2, 1, 2, "#5a3a22");   // stalk nub
      });
      leafAt(g, 16, 12, 28, 4, 5); leafAt(g, 12, 12, 2, 5, 5); px(g, 14, 10, 1, 3, "#5a3a22");
    } else if (key === "snow_yam") {
      const SN = "#eef3f6", SNL = "#fbfdff", SND = "#c9d6de", SNX = "#b3c4d0";
      disc(g, 1, 22, 30, 7, SND); disc(g, 1, 22, 30, 6, SN); px(g, 3, 27, 26, 1, SND);                                // the snow bank, rounded
      disc(g, 5, 21, 6, 3, SNL); disc(g, 20, 21, 7, 3, SNL); px(g, 13, 22, 3, 1, SNL);                                 // clumps heaped on top
      disc(g, 1, 20, 9, 6, SND); disc(g, 1, 19, 8, 6, SN); px(g, 3, 20, 3, 1, SNL); px(g, 2, 21, 1, 1, SNL);       // drifted lumps break the slab
      disc(g, 23, 20, 8, 6, SND); disc(g, 23, 19, 7, 6, SN); px(g, 25, 20, 2, 1, SNL);
      disc(g, 12, 25, 8, 3, SNL); px(g, 4, 25, 3, 1, SNL); px(g, 25, 24, 2, 1, SNL); px(g, 8, 26, 2, 1, SND); px(g, 21, 26, 1, 1, SND);
      disc(g, 8, 20, 19, 5, SNX);                                                                                   // cast shadow under the yam
      disc(g, 8, 7, 16, 16, D); disc(g, 8, 7, 15, 15, col); disc(g, 10, 9, 6, 5, L); px(g, 11, 10, 2, 1, WHITE);
      const R = "#b39a7a", RD = "#8f7658";
      line(g, 10, 15, 14, 16, 1, 1, R); line(g, 15, 12, 20, 11, 1, 1, R); line(g, 12, 19, 17, 20, 1, 1, R); px(g, 19, 16, 3, 1, R); px(g, 16, 8, 2, 1, R);   // ridges following the curve
      px(g, 5, 16, 3, 1, RD); px(g, 4, 17, 1, 1, RD); px(g, 6, 12, 2, 1, RD); px(g, 24, 14, 3, 1, RD); px(g, 27, 13, 1, 1, RD); px(g, 23, 19, 3, 1, RD); px(g, 26, 20, 1, 1, RD);   // root hairs
      px(g, 14, 4, 2, 3, "#8a6a4a"); px(g, 13, 3, 1, 1, "#8a6a4a"); px(g, 16, 2, 1, 2, "#8a6a4a"); px(g, 14, 4, 1, 1, "#b08a5a");   // sprout nub
    } else if (key === "wild_berry") {
      // a bramble: two arching thorny canes with serrated leaves and clusters of berries, nothing like the tidy blueberry dome
      const BR = { D: "#2a5a2a", M: "#3f8a38", L: "#6bbd55", X: "#a4de84" }, thorn = "#1e3e1a";
      const cane = (pts) => {
        for (let i = 0; i < pts.length - 1; i++) line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2, 2, STEM.D);
        for (let i = 0; i < pts.length - 1; i++) line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1, 1, STEM.M);
      };
      cane([[4, 27], [7, 18], [13, 9], [20, 6], [25, 10], [28, 18]]);
      cane([[9, 28], [12, 22], [19, 18], [26, 22]]);
      [[5, 22], [9, 14], [17, 5], [23, 7], [28, 13], [14, 21], [22, 17], [27, 19]].forEach(([x, y]) => px(g, x, y, 1, 1, thorn));   // thorns
      leafAt(g, 7, 18, 1, 14, 4, BR); leafAt(g, 13, 9, 8, 4, 4, BR); leafAt(g, 20, 6, 21, 1, 3, BR); leafAt(g, 25, 10, 30, 6, 4, BR);
      leafAt(g, 12, 22, 6, 26, 4, BR); leafAt(g, 19, 18, 16, 13, 4, BR); leafAt(g, 26, 22, 30, 26, 3, BR); leafAt(g, 28, 18, 30, 24, 3, BR);
      leafAt(g, 16, 8, 14, 13, 3, BR); leafAt(g, 8, 18, 10, 24, 3, BR);
      // berries in clusters of three, each a shaded drupelet ball with a glint
      const berry = (x, y) => { disc(g, x, y, 4, 4, D); disc(g, x, y, 3, 3, col); px(g, x, y, 1, 1, X); px(g, x + 1, y + 1, 1, 1, L); px(g, x + 2, y + 2, 1, 1, D); };
      [[9, 10], [12, 12], [8, 14], [22, 8], [25, 11], [21, 12], [14, 20], [17, 23], [21, 21], [4, 20], [24, 15]].forEach(([x, y]) => berry(x, y));
    } else if (key === "holly") {
      const H = { D: "#1e5a1e", M: "#3f8f3a", L: "#63bd52", X: "#a8e08a" };
      // spiky leaves: stacked rects with notched edges
      const leaf = (x, y, flip) => {
        px(g, x, y + 2, 11, 4, H.D); px(g, x, y + 1, 10, 4, H.M); px(g, x + 2, y, 2, 1, H.M); px(g, x + 6, y, 2, 1, H.M); px(g, x - 1, y + 2, 1, 1, H.M); px(g, x + 10, y + 2, 1, 1, H.M);
        px(g, x + 2, y + 6, 2, 1, H.D); px(g, x + 6, y + 6, 2, 1, H.D); px(g, x + 1, y + 2, 4, 1, H.L); px(g, x + 2, y + 1, 1, 1, H.X); px(g, x + 1, y + 3, 7, 1, H.D);
      };
      leaf(3, 6); leaf(17, 9); leaf(9, 17); leaf(20, 19);
      px(g, 15, 14, 1, 4, STEM.D);
      [[12, 12], [16, 11], [14, 15]].forEach(([x, y]) => ball(g, x, y, 5, 5, "#d62c3a"));
    } else if (key === "daffodil") {
      const Y = "#f7d23e", YD = "#d1a41f", YL = "#fff2a0", T = "#f2a52a", TD = "#c77d14";
      blade(g, 9, 27, 5, 14); blade(g, 20, 27, 25, 13); blade(g, 12, 27, 10, 16); blade(g, 19, 27, 22, 15);
      stem(g, 16, 12, 16, { D: STEM.D, M: STEM.M });
      // petals: six petals around the trumpet
      [[10, 4, 5, 5], [17, 4, 5, 5], [7, 9, 5, 5], [20, 9, 5, 5], [9, 13, 5, 5], [18, 13, 5, 5]].forEach(([x, y, w, h]) => { disc(g, x, y + 1, w, h, YD); disc(g, x, y, w, h - 1, Y); px(g, x + 1, y + 1, 2, 1, YL); });
      disc(g, 12, 7, 8, 9, TD); disc(g, 12, 7, 7, 8, T); px(g, 14, 9, 3, 3, TD); px(g, 13, 8, 2, 1, "#ffcf6a"); px(g, 15, 10, 1, 1, "#ffe6a8");
    } else if (key === "dandelion") {
      const Y = "#fbe36a", YD = "#d9b93a", YL = "#fff8c8";
      // jagged leaves
      [[2, 26, 6, 16], [8, 27, 6, 19], [24, 27, 27, 15], [19, 27, 25, 20]].forEach(([x0, y0, x1, y1]) => { blade(g, x0, y0, x1, y1); px(g, Math.round((x0 + x1) / 2) - 2, Math.round((y0 + y1) / 2), 1, 1, LEAF.D); });
      stem(g, 15, 12, 16, { D: STEM.D, M: STEM.L }); stem(g, 10, 16, 12, { D: STEM.D, M: STEM.L });
      disc(g, 8, 3, 15, 11, YD); disc(g, 8, 3, 14, 10, Y);
      for (let y = 3; y < 13; y += 2) for (let x = 9 + (y % 4 ? 0 : 1); x < 22; x += 3) px(g, x, y, 1, 1, YD);
      px(g, 10, 5, 3, 1, YL); px(g, 12, 4, 1, 1, "#ffffff"); px(g, 11, 6, 1, 1, YL);
      disc(g, 6, 12, 7, 6, "#f1f3e6"); disc(g, 6, 12, 6, 5, "#ffffff"); px(g, 7, 13, 1, 1, "#c9d0b8"); px(g, 9, 15, 1, 1, "#c9d0b8"); px(g, 10, 13, 1, 1, "#c9d0b8");
    } else {
      // generic wild flower on a stalk
      stem(g, 16, 14, 14); blade(g, 14, 24, 8, 20); blade(g, 17, 20, 23, 16);
      disc(g, 9, 4, 14, 12, D); disc(g, 9, 4, 13, 11, col); disc(g, 12, 7, 6, 5, D); px(g, 11, 6, 2, 1, X);
    }
    outline(c, OUT);
  });
}

// ------------------------------------------------------------ icons (tools, items)
const FISH_PAL = {
  sardine: ["#6f9fc9", "#b7d3e8", "#3f6f9a"], carp: ["#c98a4a", "#ecc08a", "#8a5a2a"], sunfish: ["#c9a83a", "#f0d86a", "#8a6a1a"],
  rainbow_trout: ["#7fa88a", "#c9dcc0", "#4f7a5a"], catfish: ["#6f7a6a", "#aeb5a6", "#454d43"], sturgeon: ["#5a6a7a", "#98a6b4", "#37424d"],
  golden_koi: ["#f2a12a", "#ffe08a", "#c9711a"],
};
function fishIcon(g, key) {
  const [B, L, D] = FISH_PAL[key] || ["#5fa8e0", "#a8d4f0", "#3f7fb8"], X = mix(L, WHITE, 0.6);
  // tail (right), body (left-centre), fins, head
  px(g, 24, 9, 4, 4, D); px(g, 24, 19, 4, 4, D); px(g, 22, 11, 6, 10, D); px(g, 25, 10, 2, 3, B); px(g, 25, 19, 2, 3, B); px(g, 23, 12, 4, 8, B); px(g, 25, 11, 1, 2, L);
  disc(g, 3, 9, 22, 14, D); disc(g, 3, 9, 21, 13, B);
  disc(g, 5, 11, 12, 6, L); px(g, 7, 12, 3, 1, X);
  disc(g, 6, 17, 16, 5, mix(B, WHITE, 0.35));   // belly
  px(g, 11, 6, 8, 3, D); px(g, 12, 7, 6, 2, B); px(g, 13, 7, 2, 1, L);   // dorsal fin
  px(g, 12, 21, 5, 3, D); px(g, 13, 21, 3, 2, B);   // pelvic fin
  px(g, 9, 10, 1, 11, D);   // gill line
  px(g, 5, 12, 3, 3, WHITE); px(g, 6, 13, 1, 1, "#1a1a1a"); px(g, 6, 12, 1, 1, "#4a4a4a");
  px(g, 3, 15, 2, 1, D);
  if (key === "rainbow_trout") { px(g, 10, 15, 13, 2, "#e08aa0"); px(g, 10, 15, 13, 1, "#f0aac0"); [[12, 12], [17, 12], [20, 18], [14, 19]].forEach(([x, y]) => px(g, x, y, 1, 1, D)); }
  if (key === "golden_koi") { disc(g, 12, 10, 6, 5, "#f8f2e6"); disc(g, 17, 16, 5, 4, "#f8f2e6"); px(g, 13, 11, 2, 1, WHITE); }
  if (key === "catfish") { line(g, 3, 16, 0, 20, 1, 1, D); line(g, 4, 17, 1, 23, 1, 1, D); px(g, 4, 15, 4, 1, X); }
  if (key === "sturgeon") { for (let x = 11; x < 22; x += 3) px(g, x, 10, 1, 1, L); }
  if (key === "sunfish") { [[13, 12], [18, 13], [15, 17]].forEach(([x, y]) => px(g, x, y, 1, 1, "#e0524f")); px(g, 12, 6, 6, 2, "#d9a621"); }
  if (key === "carp") { for (let x = 11; x < 21; x += 3) { px(g, x, 12, 1, 1, D); px(g, x + 1, 15, 1, 1, D); } }
}
// ------------------------------------------------------------ legendary tree seeds (the one-in-a-million harvest drop)
/* a four-point twinkle centred on (x,y): white core, c1 on the inner arm pixels, c2 on the tips; r = arm length (0 = one pixel) */
function twinkle(g, x, y, r, c1, c2) {
  px(g, x, y, 1, 1, WHITE);
  for (let i = 1; i <= r; i++) { const cc = i === r && r > 1 ? c2 : c1; px(g, x - i, y, 1, 1, cc); px(g, x + i, y, 1, 1, cc); px(g, x, y - i, 1, 1, cc); px(g, x, y + i, 1, 1, cc); }
}
/* fill rows given as [y, x0, w] */
function spans(g, rows, col) { rows.forEach(([y, x0, w]) => px(g, x0, y, w, 1, col)); }
function oakSeedIcon(g) {
  const N = { DD: "#6e3a14", D: "#9c5a1e", M: "#cb8a30", L: "#e8ae4c", X: "#fbdc8e" };   // glossy golden-brown nut
  const C = { D: "#553519", M: "#80592f", L: "#a98048", X: "#cba36a" };                  // scaly cap
  const SP = "#fff2a0", SPT = "#f5cf4a";
  // soft golden glow behind the acorn (faint enough that the outline pass ignores it)
  disc(g, 1, 1, 30, 30, "rgba(255,214,90,0.07)"); disc(g, 4, 3, 24, 27, "rgba(255,214,90,0.08)");
  // nut: widest just under the cap, tapering to a point
  const nut = [[13, 9, 14], [14, 8, 16], [15, 8, 16], [16, 8, 16], [17, 8, 16], [18, 8, 16], [19, 8, 16], [20, 8, 16], [21, 9, 14], [22, 9, 14], [23, 10, 12], [24, 11, 10], [25, 12, 8], [26, 13, 6], [27, 14, 4], [28, 15, 2]];
  nut.forEach(([y, x0, w]) => {
    px(g, x0, y, w, 1, N.M);
    px(g, x0, y, w > 6 ? 2 : 1, 1, N.L);                                  // lit left flank
    if (w > 8) px(g, x0 + w - 6, y, 2, 1, mix(N.M, N.D, 0.45));
    px(g, x0 + w - (w > 8 ? 4 : 2), y, w > 8 ? 4 : 2, 1, N.D);            // shadowed right flank
    px(g, x0 + w - 1, y, 1, 1, N.DD);
  });
  spans(g, [[25, 12, 8], [26, 13, 6], [27, 14, 4], [28, 15, 2]], N.D); px(g, 13, 25, 2, 1, N.M); px(g, 14, 26, 1, 1, N.M);
  px(g, 17, 28, 1, 1, N.DD); px(g, 15, 29, 2, 1, N.DD);                 // point
  px(g, 20, 20, 1, 3, N.L); px(g, 19, 23, 1, 1, N.L);                    // reflected light on the shadow side (glossy)
  px(g, 10, 15, 2, 6, N.X); px(g, 11, 21, 1, 2, N.X); px(g, 10, 14, 4, 1, N.X);   // glossy highlight streak
  px(g, 10, 15, 1, 2, WHITE); px(g, 11, 14, 2, 1, WHITE);
  px(g, 9, 14, 14, 1, N.DD); px(g, 10, 15, 12, 1, N.D); px(g, 10, 15, 1, 1, N.X); px(g, 11, 15, 1, 1, WHITE);   // cap's shadow on the nut
  // cap: a dome of overlapping scales
  const cap = [[6, 12, 8], [7, 10, 12], [8, 8, 16], [9, 7, 18], [10, 6, 20], [11, 6, 20], [12, 6, 20], [13, 7, 18]];
  spans(g, cap, C.M);
  spans(g, [[6, 12, 5], [7, 10, 5], [8, 8, 5], [9, 7, 4], [10, 6, 3], [11, 6, 2]], C.L);
  spans(g, [[7, 19, 3], [8, 21, 3], [9, 22, 3], [10, 23, 3], [11, 23, 3], [12, 22, 4], [13, 7, 18]], C.D);
  for (let r = 0; r < 3; r++) {
    const y = 7 + r * 2, [ , x0, w] = cap[r * 2 + 1];
    for (let x = x0 + 1 + (r % 2) * 2; x < x0 + w - 1; x += 4) { px(g, x, y, 2, 1, x < 14 ? C.X : C.L); px(g, x + 1, y + 1, 2, 1, C.D); }
  }
  px(g, 8, 12, 17, 1, shade(C.D, 0.85)); px(g, 7, 12, 1, 1, C.M);       // rim lip
  // stem, curling to the right
  px(g, 15, 3, 2, 3, C.D); px(g, 15, 3, 1, 3, C.L); px(g, 17, 2, 1, 2, C.D);
  // golden twinkles
  twinkle(g, 5, 6, 2, SP, SPT); twinkle(g, 27, 15, 1, SP, SPT); twinkle(g, 5, 24, 1, SP, SPT); twinkle(g, 26, 5, 0, SP, SPT);
}
function willowSeedIcon(g) {
  const F = { D: "#a2b0c6", M: "#d2dbe7", L: "#edf2f8", X: "#ffffff" }, RAY = "#b3c0d2", RAYD = "#8f9db3", CORE = "#7d8ba2";
  const B1 = "#c6ecff", B2 = "#86ccf4";
  // the tuft: a ball of silky filaments, lit from the top-left, cool blue in its shade
  disc(g, 8, 3, 16, 16, F.M);
  // an uneven fluffy rim: soft puffs of two sizes and a few stray wisps
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 + 0.12, ca = Math.cos(a), sa = Math.sin(a), l = -ca - sa;
    const big = k % 3 === 0, rr = big ? 7.4 : k % 3 === 1 ? 8.3 : 7.9, col = l > 0.4 ? F.X : l > -0.6 ? F.L : F.M;
    const bx = Math.round(15.5 + ca * rr), by = Math.round(10.5 + sa * rr);
    if (big) { disc(g, bx - 2, by - 2, 5, 5, col); } else { px(g, bx - 1, by, 3, 1, col); px(g, bx, by - 1, 1, 3, col); }
    if (k % 3 === 1) line(g, bx, by, Math.round(15.5 + ca * 10), Math.round(10.5 + sa * 10), 1, 1, l > -0.6 ? F.L : F.M);
  }
  for (let y = 1; y < 21; y++) for (let x = 5; x < 27; x++) {              // shade the whole puff: light top-left, cool shadow bottom-right
    const dx = x + 0.5 - 16, dy = y + 0.5 - 11, r = Math.hypot(dx, dy), lit = (-dx - dy) / 11;
    if (r > 7.2) continue;
    if (lit > 0.3) px(g, x, y, 1, 1, F.L); else if (lit < -0.3) px(g, x, y, 1, 1, F.D);
  }
  // filaments radiating from the heart of the tuft
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.26, ca = Math.cos(a), sa = Math.sin(a);
    line(g, Math.round(15.5 + ca * 2.2), Math.round(10.5 + sa * 2.2), Math.round(15.5 + ca * 6.6), Math.round(10.5 + sa * 6.6), 1, 1, -ca - sa > 0.3 ? RAY : RAYD);
  }
  px(g, 15, 10, 2, 2, CORE); px(g, 16, 11, 1, 1, "#66748b");                // where the filaments meet
  px(g, 11, 5, 2, 1, F.X); px(g, 10, 6, 1, 2, F.X);                        // sheen on the lit shoulder
  // a slender stalk down to the tiny dark seed
  px(g, 16, 20, 1, 2, "#b9c3cf"); px(g, 15, 22, 1, 2, "#b9c3cf"); px(g, 15, 19, 2, 1, F.D);
  const SD = { D: "#30231b", M: "#523c2c", L: "#80634b" };
  spans(g, [[24, 15, 1], [25, 14, 3], [26, 14, 3], [27, 14, 3], [28, 15, 1]], SD.M);
  px(g, 16, 25, 1, 3, SD.D); px(g, 14, 25, 1, 2, SD.L); px(g, 15, 24, 1, 1, SD.L);
  // pale blue twinkles
  twinkle(g, 6, 24, 2, B1, B2); twinkle(g, 25, 25, 1, B1, B2); twinkle(g, 28, 3, 1, B1, B2); twinkle(g, 3, 3, 0, B1, B2);
}
/* a raindrop-shaped seed: round end centred on (cx,cy) with radius r, tapering to a point `len` away along angle `ang` */
function inDrop(x, y, cx, cy, r, len, ang) {
  const dx = x - cx, dy = y - cy, ca = Math.cos(ang), sa = Math.sin(ang), u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
  return u <= 0 ? u * u + v * v <= r * r : u < len && Math.abs(v) <= r * Math.sqrt(1 - u / len);
}
function bonsaiSeedIcon(g) {
  const S = { DD: "#5e0f1c", D: "#8c1c2b", M: "#c22f3c", L: "#e45656", X: "#ff9486" };   // red silk
  const G = { D: "#a4701c", M: "#e2ac36", L: "#f9d86c", X: "#fff6c4" };                  // gold cord
  const J = { D: "#237252", M: "#4ead7e", L: "#8fd6ab", X: "#dcf8e6" };                  // milky jade
  // a plump folded silk pouch with softly rounded ends and a glossy sheen
  spans(g, [[16, 5, 22], [17, 4, 24], [18, 3, 26], [19, 3, 26], [20, 3, 26], [21, 3, 26], [22, 3, 26], [23, 3, 26], [24, 3, 26], [25, 4, 24], [26, 5, 22], [27, 7, 18]], S.M);
  spans(g, [[25, 4, 24], [26, 5, 22]], S.D); px(g, 7, 27, 18, 1, S.DD); px(g, 4, 24, 1, 1, S.D); px(g, 27, 24, 1, 1, S.DD);
  px(g, 3, 18, 1, 6, S.L); px(g, 4, 17, 1, 1, S.L); px(g, 28, 18, 1, 7, S.D); px(g, 27, 17, 1, 1, S.D);
  line(g, 5, 23, 8, 20, 1, 1, S.X); line(g, 6, 24, 7, 23, 1, 1, S.L); line(g, 22, 23, 25, 20, 1, 1, S.L);
  // envelope flap folded over the top
  spans(g, [[16, 5, 22], [17, 5, 22], [18, 7, 18], [19, 9, 14], [20, 11, 10], [21, 13, 6], [22, 15, 2]], S.L);
  spans(g, [[16, 6, 9], [17, 6, 6], [18, 8, 3]], S.X);
  [[17, 25], [18, 24], [19, 22], [20, 20], [21, 18], [22, 16]].forEach(([y, x]) => px(g, x, y, 2, 1, S.D));   // fold shadow, right edge
  [[18, 7], [19, 9], [20, 11], [21, 13]].forEach(([y, x]) => px(g, x, y, 2, 1, shade(S.M, 0.9)));
  // gold knot button fastening the flap; one cord end trails off to a tassel
  px(g, 18, 24, 2, 1, G.M); px(g, 20, 25, 1, 1, G.M); px(g, 13, 24, 1, 2, G.M);
  px(g, 14, 21, 4, 4, G.M); px(g, 13, 22, 6, 2, G.M); px(g, 14, 21, 2, 1, G.X); px(g, 13, 22, 2, 1, G.L); px(g, 17, 23, 2, 1, G.D); px(g, 16, 24, 2, 1, G.D); px(g, 15, 22, 2, 2, G.L); px(g, 16, 23, 1, 1, G.D);
  px(g, 20, 26, 2, 1, G.D); px(g, 20, 26, 1, 1, G.L);                     // tassel cap
  px(g, 19, 27, 4, 3, G.M); px(g, 19, 27, 4, 1, G.L); px(g, 19, 28, 1, 2, G.L); px(g, 21, 28, 1, 2, G.D); px(g, 22, 27, 1, 3, G.D);   // fringe
  px(g, 19, 30, 1, 1, G.M); px(g, 21, 30, 1, 1, G.D);
  // jade seed resting on the flap, its shadow on the silk
  px(g, 12, 18, 9, 2, S.D); px(g, 13, 20, 7, 1, shade(S.L, 0.82));
  const ang = -1.2;
  for (let y = 4; y < 21; y++) for (let x = 8; x < 24; x++) {
    const cx = x + 0.5, cy = y + 0.5;
    if (!inDrop(cx, cy, 15.5, 14, 5, 7, ang)) continue;
    let col = J.D;
    if (inDrop(cx, cy, 14.8, 13.3, 4.4, 6.4, ang)) col = J.M;
    if (inDrop(cx, cy, 14.2, 12.6, 2.5, 4.2, ang)) col = J.L;
    px(g, x, y, 1, 1, col);
  }
  px(g, 17, 16, 2, 1, J.L); px(g, 18, 15, 1, 1, J.L); px(g, 16, 17, 1, 1, J.L);   // light glowing through the jade
  px(g, 12, 12, 1, 2, J.X); px(g, 13, 11, 1, 1, J.X); px(g, 12, 12, 1, 1, WHITE);   // glint
  // twinkles
  twinkle(g, 25, 7, 2, G.X, G.L); twinkle(g, 6, 9, 1, G.X, G.L); twinkle(g, 27, 14, 0, G.X, G.L);
}
const LEGEND_SEED = { oak_seed: oakSeedIcon, willow_seed: willowSeedIcon, bonsai_seed: bonsaiSeedIcon };
function iconCanvas(key, cat) {
  const it = (cat && cat.items[key]) || { kind: "crop", color: "yellow" };
  const col = ITEM_HEX[key] || COLORS[it.color] || "#f2c744";
  return cached("icon:" + key, A, A, (g, c) => {
    const K = it.kind, D = shade(col, 0.66), L = shade(col, 1.2), X = mix(col, WHITE, 0.6);
    if (key === "hoe") {
      handle(g, 3, 27, 22, 6);
      px(g, 22, 5, 5, 3, METAL.M); px(g, 22, 5, 5, 1, METAL.L);            // neck ferrule
      px(g, 23, 8, 8, 4, METAL.M); px(g, 23, 8, 8, 1, METAL.L); px(g, 24, 12, 7, 5, METAL.M); px(g, 24, 12, 1, 5, METAL.L); px(g, 29, 9, 2, 8, METAL.D); px(g, 24, 17, 7, 1, METAL.D);
      px(g, 24, 9, 2, 1, METAL.X); px(g, 25, 13, 1, 2, METAL.X);
    } else if (key === "watering_can") {
      const B = "#4f7fa8", BD = "#2f5f88", BL = "#7fa8cc", BX = "#a8cce8";
      // top handle (arch) and side handle
      px(g, 8, 6, 12, 2, BD); px(g, 7, 8, 2, 4, BD); px(g, 19, 8, 2, 4, BD); px(g, 9, 6, 10, 1, BL);
      px(g, 1, 14, 4, 2, BD); px(g, 1, 16, 2, 7, BD); px(g, 1, 22, 4, 2, BD); px(g, 2, 14, 2, 1, BL);
      // spout
      line(g, 21, 17, 27, 11, 3, 2, B); line(g, 21, 17, 27, 11, 1, 1, BL); line(g, 23, 18, 29, 12, 1, 1, BD);
      px(g, 26, 8, 5, 4, B); px(g, 26, 8, 5, 1, BL); px(g, 30, 8, 1, 4, BD); px(g, 27, 9, 1, 1, BX);
      // body
      px(g, 5, 12, 17, 15, B); px(g, 5, 12, 17, 2, BL); px(g, 5, 12, 2, 15, BL); px(g, 20, 13, 2, 14, BD); px(g, 6, 26, 15, 1, BD);
      px(g, 5, 19, 17, 1, BD); px(g, 5, 18, 17, 1, BL);                     // band
      px(g, 7, 14, 3, 4, BX); px(g, 7, 15, 1, 6, BX);
      px(g, 9, 10, 9, 2, BD); px(g, 10, 9, 7, 1, BL);                       // filler mouth
      // drops
      [[30, 13], [29, 16], [30, 19]].forEach(([x, y]) => { px(g, x, y, 1, 2, "#7fc4f0"); });
    } else if (key === "scythe") {
      handle(g, 3, 27, 20, 8);
      px(g, 10, 21, 5, 2, WOOD.dark); px(g, 8, 19, 3, 2, WOOD.dark);       // grip peg
      px(g, 19, 5, 5, 3, METAL.D);
      // curved blade sweeping right and down from the top of the snath
      const pts = [[20, 4], [23, 4], [25, 5], [27, 7], [28, 10], [28, 13], [27, 16], [25, 19], [23, 21]];
      for (let i = 0; i < pts.length - 1; i++) { line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 3, 3, METAL.M); }
      for (let i = 0; i < pts.length - 1; i++) { line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1, 1, METAL.D); }
      for (let i = 0; i < pts.length - 1; i++) { line(g, pts[i][0] + 2, pts[i][1] + 2, pts[i + 1][0] + 2, pts[i + 1][1] + 2, 1, 1, METAL.X); }
      px(g, 22, 22, 3, 2, METAL.X); px(g, 20, 3, 3, 1, METAL.L);
    } else if (key === "axe") {
      handle(g, 3, 27, 22, 6);
      // head: a dark poll at the haft, cheeks flaring out into a wedge that widens toward the broad curved bit on the right
      [[3, 26, 4], [4, 24, 7], [5, 22, 9], [6, 20, 11], [7, 19, 12], [8, 19, 12], [9, 19, 12], [10, 20, 11], [11, 22, 9], [12, 24, 7], [13, 26, 4]].forEach(([y, x0, w]) => px(g, x0, y, w, 1, METAL.M));
      px(g, 26, 3, 4, 1, METAL.L); px(g, 24, 4, 3, 1, METAL.L); px(g, 22, 5, 3, 1, METAL.L); px(g, 20, 6, 3, 1, METAL.L); px(g, 19, 7, 2, 1, METAL.L); px(g, 19, 8, 1, 1, METAL.L);   // lit upper cheek
      px(g, 26, 13, 4, 1, METAL.D); px(g, 24, 12, 3, 1, METAL.D); px(g, 22, 11, 3, 1, METAL.D); px(g, 20, 10, 3, 1, METAL.D); px(g, 19, 9, 1, 1, METAL.D);   // shadowed lower cheek
      px(g, 30, 4, 1, 9, METAL.X); px(g, 29, 3, 1, 1, METAL.X); px(g, 29, 5, 1, 7, METAL.L); px(g, 25, 5, 3, 1, METAL.X);   // bright bevel along the cutting edge, a glint on the cheek
      px(g, 16, 6, 4, 5, METAL.D); px(g, 16, 6, 4, 1, shade(METAL.D, 1.25)); px(g, 16, 6, 1, 5, shade(METAL.D, 0.8));   // the dark poll
      px(g, 21, 7, 2, 3, WOOD.dark); px(g, 21, 7, 1, 3, WOOD.light);   // eye where the haft passes through
    } else if (key === "pickaxe") {
      handle(g, 3, 27, 22, 6);
      line(g, 13, 2, 29, 14, 3, 3, METAL.M); line(g, 12, 1, 14, 3, 2, 2, METAL.M); line(g, 29, 14, 30, 16, 1, 1, METAL.M);
      line(g, 13, 2, 29, 14, 1, 1, METAL.L); line(g, 15, 4, 30, 16, 1, 1, METAL.D);
      px(g, 13, 2, 2, 1, METAL.X); px(g, 21, 8, 3, 3, METAL.D); px(g, 22, 9, 1, 1, WOOD.dark);
    } else if (key === "fishing_rod") {
      line(g, 6, 24, 27, 3, 2, 2, WOOD.mid); line(g, 6, 24, 27, 3, 1, 1, WOOD.light);
      line(g, 3, 28, 8, 23, 3, 3, "#5a3a22"); line(g, 3, 28, 8, 23, 1, 1, "#8a5a34");                 // cork grip
      px(g, 27, 2, 2, 2, "#8a8a8a"); px(g, 16, 13, 1, 1, "#8a8a8a"); px(g, 11, 18, 1, 1, "#8a8a8a");   // line guides
      px(g, 8, 20, 6, 6, METAL.D); px(g, 9, 21, 4, 4, METAL.M); px(g, 10, 22, 1, 1, METAL.L); px(g, 12, 25, 3, 2, METAL.D);   // reel
      px(g, 29, 3, 1, 12, "#e8e8e8"); px(g, 29, 15, 1, 1, "#cfcfcf");
      px(g, 26, 16, 5, 3, "#e0524f"); px(g, 27, 15, 3, 1, "#e0524f"); px(g, 26, 19, 5, 3, "#f4f1ea"); px(g, 27, 22, 3, 1, "#d8d4cc"); px(g, 27, 16, 1, 1, "#ff9a98");
    } else if (LEGEND_SEED[key]) { LEGEND_SEED[key](g);          // rare tree seeds: drawn by key so they never fall into the generic sapling art
    } else if (K === "seed") {
      const cc = ITEM_HEX[it.crop] || col;
      px(g, 7, 4, 18, 24, PAPER.M); px(g, 7, 4, 2, 24, PAPER.L); px(g, 23, 5, 2, 23, PAPER.D); px(g, 8, 27, 16, 1, PAPER.D);
      px(g, 7, 4, 18, 5, PAPER.D); px(g, 7, 4, 18, 1, mix(PAPER.D, WHITE, 0.4)); px(g, 9, 8, 14, 1, shade(PAPER.D, 0.85)); px(g, 15, 2, 2, 2, PAPER.D); px(g, 15, 2, 1, 2, PAPER.M);   // flap and notch
      px(g, 9, 22, 14, 3, cc); px(g, 9, 22, 14, 1, shade(cc, 1.2)); px(g, 9, 24, 14, 1, shade(cc, 0.7));   // colour band
      ball(g, 11, 11, 10, 10, cc);                                            // the crop
      px(g, 14, 9, 4, 2, LEAF.M); px(g, 15, 8, 2, 1, LEAF.L); px(g, 16, 10, 1, 1, LEAF.D);
      px(g, 10, 26, 3, 1, PAPER.D); px(g, 19, 26, 3, 1, PAPER.D);
    } else if (K === "crop") { g.drawImage(cropSprite(key, 3, 1), 0, 0); return; }
    else if (K === "fruit") {
      if (key === "cherry") {
        line(g, 12, 15, 16, 4, 1, 1, STEM.D); line(g, 22, 15, 17, 4, 1, 1, STEM.D); px(g, 16, 3, 2, 2, STEM.D);
        leafAt(g, 17, 7, 26, 3, 4); ball(g, 6, 14, 11, 11, col); ball(g, 17, 15, 11, 11, col);
      } else if (key === "plum") {
        ball(g, 8, 8, 16, 19, col); px(g, 16, 9, 1, 15, D); px(g, 15, 5, 2, 4, STEM.D); leafAt(g, 17, 7, 26, 3, 4);
      } else if (key === "peach") {
        ball(g, 7, 9, 18, 17, col); px(g, 15, 11, 1, 13, shade(col, 0.8)); disc(g, 17, 14, 7, 8, mix(col, "#e8394a", 0.35)); px(g, 15, 5, 2, 4, STEM.D); leafAt(g, 17, 8, 26, 4, 4);
      } else {
        ball(g, 7, 9, 18, 17, col); px(g, 13, 9, 6, 2, D); px(g, 14, 8, 4, 1, D); px(g, 15, 4, 2, 5, STEM.D); leafAt(g, 17, 7, 26, 3, 4);
      }
    }
    else if (K === "sapling") { g.drawImage(ART.youngTree(0, "spring"), 0, 0); return; }
    else if (K === "forage") { g.drawImage(forageSprite(key), 0, 0); return; }
    else if (K === "fish") {
      if (key === "old_boot") {
        const B = "#6b4a2b", BD = "#4a3118", BL = "#8a6a4a", S = "#3a2a1a";
        px(g, 9, 5, 9, 15, B); px(g, 9, 5, 2, 15, BL); px(g, 16, 6, 2, 14, BD);
        px(g, 9, 18, 17, 8, B); px(g, 9, 18, 2, 6, BL); px(g, 24, 19, 2, 7, BD); px(g, 8, 24, 19, 4, S); px(g, 8, 24, 19, 1, "#5a4a3a");
        px(g, 12, 8, 2, 1, BD); px(g, 12, 11, 2, 1, BD); px(g, 12, 14, 2, 1, BD); px(g, 11, 7, 1, 8, "#c9b89a");   // laces
        px(g, 20, 21, 4, 2, BL); px(g, 14, 12, 2, 3, "#3a5a8a"); px(g, 20, 7, 3, 3, "#3f8f3a");   // hole, seaweed bit
        px(g, 17, 3, 3, 2, BD); px(g, 9, 4, 9, 1, BD);
      } else if (key === "seaweed") {
        const S = { D: "#1f6b2f", M: "#2f8f3f", L: "#5fb04a" };
        [[8, 27, 6, 6], [15, 27, 17, 3], [22, 27, 25, 8], [11, 27, 13, 12]].forEach(([x0, y0, x1, y1]) => {
          const n = y0 - y1; for (let i = 0; i <= n; i++) { const wobble = Math.round(Math.sin(i / 3) * 2); px(g, Math.round(x0 + (x1 - x0) * i / n) + wobble, y0 - i, 3, 1, S.M); px(g, Math.round(x0 + (x1 - x0) * i / n) + wobble, y0 - i, 1, 1, S.L); px(g, Math.round(x0 + (x1 - x0) * i / n) + wobble + 2, y0 - i, 1, 1, S.D); }
        });
        px(g, 6, 26, 20, 3, "#8a7a5a"); px(g, 8, 25, 5, 1, "#a8987a"); px(g, 19, 26, 4, 1, "#a8987a");
      } else fishIcon(g, key);
    }
    else if (key === "sprinkler") { if (ART.propSprite) { g.drawImage(ART.propSprite("k"), 0, 0); return; } px(g, 12, 8, 8, 18, METAL.M); }
    else if (key === "fertilizer") {
      const S = "#c4996b", SD = "#8f6a44", SL = "#dcb98a", SX = "#f0d6ae";
      disc(g, 5, 10, 22, 19, SD); disc(g, 5, 10, 21, 18, S); px(g, 7, 12, 6, 3, SL); px(g, 8, 13, 2, 1, SX); px(g, 6, 24, 20, 3, SD);
      px(g, 11, 6, 10, 5, S); px(g, 11, 6, 3, 5, SL); px(g, 18, 6, 3, 5, SD); px(g, 10, 9, 12, 2, "#6a4a2a"); px(g, 10, 9, 12, 1, "#8a6a4a"); px(g, 12, 4, 8, 2, SL); px(g, 12, 4, 8, 1, SX);
      for (let y = 15; y < 26; y += 3) for (let x = 8 + (y % 2 ? 1 : 0); x < 24; x += 3) px(g, x, y, 1, 1, shade(S, 0.88));
      px(g, 11, 15, 10, 8, "#eee2c8"); px(g, 11, 15, 10, 1, WHITE); px(g, 11, 22, 10, 1, "#c9b89a");   // label
      leafBlob(g, 12, 17, 8, 4); px(g, 15, 21, 1, 1, LEAF.D);
    }
    else if (key === "wood") {
      // two split logs stacked, cut faces showing rings
      px(g, 3, 15, 22, 10, WOOD.mid); px(g, 3, 15, 22, 2, WOOD.light); px(g, 3, 23, 22, 2, WOOD.dark); px(g, 6, 18, 8, 1, WOOD.dark); px(g, 15, 20, 6, 1, WOOD.dark); px(g, 8, 21, 4, 1, WOOD.deep);
      disc(g, 23, 15, 7, 10, WOOD.dark); disc(g, 23, 15, 6, 9, WOOD.light); disc(g, 24, 17, 4, 6, WOOD.mid); px(g, 25, 19, 2, 2, WOOD.light);
      px(g, 7, 6, 20, 9, WOOD.mid); px(g, 7, 6, 20, 2, WOOD.light); px(g, 7, 13, 20, 2, WOOD.dark); px(g, 10, 9, 10, 1, WOOD.dark); px(g, 18, 11, 6, 1, WOOD.deep); px(g, 9, 11, 4, 1, WOOD.deep);
      disc(g, 25, 6, 6, 9, WOOD.dark); disc(g, 25, 6, 5, 8, WOOD.light); disc(g, 26, 8, 3, 5, WOOD.mid); px(g, 27, 9, 1, 2, WOOD.light);
      px(g, 4, 15, 3, 1, WOOD.deep); px(g, 8, 6, 4, 1, WOOD.deep);
    }
    else if (key === "milk") {
      const M = "#fbf8f1", MD = "#dcd5c6", GL = "#cfe3ee", GD = "#9fbccb";
      px(g, 12, 4, 8, 4, GL); px(g, 12, 4, 2, 4, WHITE); px(g, 18, 4, 2, 4, GD); px(g, 11, 3, 10, 2, "#e0524f"); px(g, 11, 3, 10, 1, "#f07a78");   // cap
      px(g, 11, 8, 10, 3, GL); px(g, 10, 10, 12, 18, M); px(g, 10, 10, 2, 18, WHITE); px(g, 20, 11, 2, 17, MD); px(g, 11, 27, 10, 1, MD);
      px(g, 9, 12, 1, 15, GD); px(g, 22, 12, 1, 15, GD); px(g, 10, 11, 1, 1, GD); px(g, 21, 11, 1, 1, GD);   // glass edge
      px(g, 12, 14, 8, 6, "#5fa8e0"); px(g, 12, 14, 8, 1, "#8fc6f0"); px(g, 13, 16, 6, 2, WHITE); px(g, 14, 16, 4, 2, "#e0524f");   // label
      px(g, 12, 12, 2, 1, WHITE); px(g, 12, 21, 1, 5, WHITE);
    }
    else if (key === "cow") {
      const W = "#f6f2ea", WD = "#d4cec2", K = "#3a3230", P = "#f2b8b0", PD = "#c98a86", H = "#e8d4a8";
      px(g, 3, 10, 5, 5, WD); px(g, 24, 10, 5, 5, WD); px(g, 4, 11, 3, 3, P);                    // ears
      px(g, 8, 4, 3, 5, H); px(g, 21, 4, 3, 5, H); px(g, 8, 4, 1, 5, "#f7ecc9"); px(g, 10, 6, 1, 3, "#c9b384"); px(g, 21, 6, 1, 3, "#c9b384");   // horns
      disc(g, 7, 7, 18, 20, WD); disc(g, 7, 7, 17, 19, W); px(g, 9, 9, 4, 3, WHITE);
      px(g, 8, 8, 5, 6, K); px(g, 9, 7, 3, 1, K); px(g, 18, 10, 5, 5, K); px(g, 20, 15, 3, 3, K); px(g, 9, 9, 1, 1, "#5a5250");   // patches
      px(g, 11, 15, 2, 2, WHITE); px(g, 19, 15, 2, 2, WHITE); px(g, 12, 16, 1, 1, "#1a1a1a"); px(g, 20, 16, 1, 1, "#1a1a1a");   // eyes
      px(g, 10, 12, 3, 2, "#e8c8a0"); px(g, 19, 12, 3, 1, "#e8c8a0");
      disc(g, 9, 19, 14, 8, PD); disc(g, 9, 19, 13, 7, P); px(g, 11, 20, 4, 1, "#fbd3cc"); px(g, 12, 22, 2, 2, PD); px(g, 18, 22, 2, 2, PD); px(g, 13, 25, 6, 1, PD);   // muzzle
    }
    else if (K === "animal") { disc(g, 6, 8, 20, 18, D); disc(g, 6, 8, 19, 17, col); px(g, 10, 13, 2, 2, "#1a1a1a"); px(g, 20, 13, 2, 2, "#1a1a1a"); }
    else { // generic material: a tidy crate-like block
      px(g, 6, 8, 20, 18, D); px(g, 6, 8, 19, 17, col); px(g, 6, 8, 19, 2, L); px(g, 6, 8, 2, 17, L); px(g, 8, 11, 3, 2, X);
    }
    outline(c, OUT);
  });
}
function toolSprite(key) { return iconCanvas(key, null); }

Object.assign(window.ART, { cropSprite, forageSprite, iconCanvas, toolSprite, leafy, disc, ball, leafBlob, blade, leafAt, lobed, clump });
})();
