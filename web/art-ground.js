/* Cozy Hollow art - ground
   grass, water, farmland, paths, sand and tilled soil tiles (32x32) plus scattered floor decorations.
   Draw only with px() (fillRect) and drawImage at integer coordinates; finish solid sprites with outline(canvas, OUT).
   Render any sprite to a PNG to check it:  node tools/render.js out.png 5 "expr" ...   (expr evaluated against ART) */
"use strict";
(function () {
const { A, blank, px, hash, rng, mix, cached, outline, OUT, SEASON, WOOD, ITEM_HEX } = window.ART;
const ART = window.ART;

// ------------------------------------------------------------ small deterministic drawing helpers
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));              // inclusive integer in [a, b]
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const dot = (g, x, y, col) => px(g, x, y, 1, 1, col);
function hexOf(col) {
  /* "#rrggbb" or "rgb(r,g,b)" -> "#rrggbb" (core mix()/shade() only parse hex) */
  if (col[0] === "#") return col;
  const p = /\(([^)]+)\)/.exec(col)[1].split(",").map(Number);
  return "#" + p.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
const mixh = (a, b, t) => hexOf(mix(hexOf(a), hexOf(b), t));
function rrect(g, x, y, w, h, col) {
  /* chunky rounded rectangle: 1px corners knocked off, a 2-1 stair on bigger shapes */
  if (w < 3 || h < 3) { px(g, x, y, w, h, col); return; }
  if (w >= 7 && h >= 5) { px(g, x + 2, y, w - 4, h, col); px(g, x, y + 2, w, h - 4, col); px(g, x + 1, y + 1, w - 2, h - 2, col); return; }
  px(g, x + 1, y, w - 2, h, col); px(g, x, y + 1, w, h - 2, col);
}
function shape(g, x, y, pts, col) { for (let i = 0; i < pts.length; i++) px(g, x + pts[i][0], y + pts[i][1], 1, 1, col); }
function speckle(g, r, n, cols, w) { for (let i = 0; i < n; i++) px(g, ri(r, 0, A - 1), ri(r, 0, A - 1), w || 1, 1, pick(r, cols)); }
function stone(g, x, y, w, h, P) {
  /* a little stone: lit top-left, shaded bottom, cast shadow underneath */
  px(g, x, y, w, h, P.stone);
  px(g, x, y, Math.max(1, w - 1), 1, P.stoneL);
  if (h > 1) px(g, x + 1, y + h - 1, w - 1, 1, P.stoneD); else dot(g, x + w - 1, y, P.stoneD);
  px(g, x + 1, y + h, w - 1, 1, P.shadow);
}
function crack(g, r, col) {
  /* thin wandering line of dark pixels */
  let x = ri(r, 2, 24), y = ri(r, 2, 24);
  const len = ri(r, 4, 8), vert = r() < 0.35, dir = r() < 0.5 ? 1 : -1;
  for (let k = 0; k < len; k++) {
    dot(g, x, y, col);
    if (vert) { y += 1; if (r() < 0.4) x += dir; } else { x += 1; if (r() < 0.4) y += dir; }
  }
}
function weed(g, x, y, dark, light) { shape(g, x, y, [[0, 0], [0, 1], [2, 0], [2, 1], [1, 1], [1, 2]], dark); dot(g, x + 1, y - 1, light); dot(g, x + 3, y, light); }

// ------------------------------------------------------------ noise
function noise2(x, y) {
  /* smooth value noise on a 4-tile lattice, 0..1 */
  const x0 = Math.floor(x / 4), y0 = Math.floor(y / 4), fx = (x % 4) / 4, fy = (y % 4) / 4;
  const v = (a, b) => (hash(a * 17 + 3, b * 29 + 7) % 1000) / 1000;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const top = v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx, bot = v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx;
  return top * (1 - sy) + bot * sy;
}

// ------------------------------------------------------------ grass
const TUFTS = [
  [[0, 0], [2, 0], [1, 1]],                              // v
  [[0, 0], [0, 1], [2, 0], [2, 1], [1, 2]],              // deep v
  [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0]],              // w
  [[0, 0], [2, 0], [1, 1], [1, 2]],                      // y
  [[0, 0], [0, 1]],                                      // blade
  [[0, 0], [2, 0], [1, 1]],                              // v again (most common)
  [[0, 0], [1, 1]],                                      // diagonal pair
];
function flower(g, x, y, col, center, stem) {
  /* tiny 3x3 cross bloom on a 2px stem with one leaf */
  px(g, x, y + 2, 1, 2, stem); dot(g, x + 1, y + 3, stem);
  px(g, x - 1, y, 3, 1, col); px(g, x, y - 1, 1, 3, col); dot(g, x, y, center);
}
function clover(g, x, y, dark, light, under) {
  /* a rounded three-lobed clover leaf, 5x4, seen from above: a notch between the two top lobes, the top-left lobe lit, no stalk */
  const dk = under || mixh(dark, OUT, 0.3);
  px(g, x, y, 2, 1, dark); px(g, x + 3, y, 2, 1, dark);       // two top lobes either side of the notch
  px(g, x, y + 1, 5, 2, dark);                                 // body
  px(g, x + 1, y + 3, 3, 1, dk);                               // bottom lobe, in shade
  dot(g, x, y, light); dot(g, x + 1, y + 1, light);            // light on the top-left lobe
  dot(g, x + 2, y + 1, dk); dot(g, x + 4, y + 2, dk);          // crease between lobes, shaded right edge
}
function leaf(g, x, y, kind, col, lt, dk, stem) {
  /* a fallen leaf: pointed oval 4-6px long with a 1px stem and a darker underside.  kind 0 lies flat, 1 leans \, 2 leans /, 3 stands upright */
  if (kind === 0) {
    px(g, x + 1, y, 3, 1, col); px(g, x, y + 1, 5, 1, col); px(g, x + 1, y + 2, 3, 1, dk);
    dot(g, x + 1, y, lt); dot(g, x + 1, y + 1, lt); dot(g, x + 4, y + 1, dk); px(g, x - 2, y + 1, 2, 1, stem);
  } else if (kind === 1) {
    px(g, x + 1, y + 1, 2, 1, col); px(g, x + 1, y + 2, 3, 1, col); px(g, x + 2, y + 3, 2, 1, col); dot(g, x + 4, y + 3, dk); px(g, x + 3, y + 4, 2, 1, dk);
    dot(g, x + 1, y + 1, lt); dot(g, x, y, stem);
  } else if (kind === 2) {
    px(g, x + 2, y + 1, 2, 1, col); px(g, x + 1, y + 2, 3, 1, col); px(g, x + 1, y + 3, 2, 1, col); dot(g, x, y + 3, dk); px(g, x, y + 4, 2, 1, dk);
    dot(g, x + 2, y + 1, lt); dot(g, x + 4, y, stem);
  } else {
    dot(g, x + 1, y, col); px(g, x, y + 1, 3, 3, col); dot(g, x + 2, y + 3, dk); dot(g, x + 2, y + 2, dk); dot(g, x + 1, y + 4, dk);
    dot(g, x, y + 1, lt); dot(g, x + 1, y + 1, lt); px(g, x + 1, y + 5, 1, 2, stem);
  }
}
function grassTile(season, v, tone) {
  const s = SEASON[season];
  tone = tone || 0; v = ((v % 24) + 24) % 24;
  return cached("grass:" + season + ":" + v + ":" + tone, A, A, (g) => {
    const r = rng(v * 7919 + 13 + (tone + 3) * 101);
    if (season === "winter") { snowTile(g, s, v, tone, r); return; }
    const base = tone < 0 ? mixh(s.grass, s.deep, 0.11 * -tone) : mixh(s.grass, s.light, 0.16 * tone);   // ~5 RGB units per step so the noise2 tone patches read across a field
    const dark = s.dark, light = s.light, deep = s.deep;
    const patchD = mixh(base, dark, 0.38), patchL = mixh(base, light, 0.3);
    px(g, 0, 0, A, A, base);
    // soft mottling so the field is not one flat colour
    for (let i = 0; i < 4; i++) rrect(g, ri(r, -2, 26), ri(r, -2, 28), ri(r, 6, 11), ri(r, 3, 6), patchD);
    for (let i = 0; i < 3; i++) rrect(g, ri(r, -2, 26), ri(r, -2, 28), ri(r, 4, 9), ri(r, 2, 4), patchL);
    // dark tufts everywhere, a few very deep ones
    for (let i = 0; i < 17; i++) shape(g, ri(r, -1, A - 2), ri(r, -1, A - 2), pick(r, TUFTS), i < 3 ? deep : dark);
    // lit tufts: a dark v whose top-left blade catches the light
    for (let i = 0; i < 8; i++) { const x = ri(r, 0, A - 3), y = ri(r, 1, A - 2); shape(g, x, y, TUFTS[0], dark); dot(g, x, y - 1, light); if (r() < 0.4) dot(g, x + 2, y - 1, light); }
    // loose highlight blades: short / strokes and single tips
    for (let i = 0; i < 9; i++) { const x = ri(r, 0, A - 2), y = ri(r, 1, A - 1); dot(g, x, y, light); if (r() < 0.6) dot(g, x + 1, y - 1, light); }
    // occasional embellishments (the game scatters bigger decor separately)
    if (v === 11) { const x = ri(r, 5, 22), y = ri(r, 6, 22); stone(g, x, y, 5, 3, STONE_GREY); shape(g, x - 1, y + 2, [[0, 0], [0, 1]], deep); shape(g, x + 5, y + 1, [[0, 0], [0, 1]], deep); }
    if (v === 13 || v === 22) { const x = ri(r, 4, 20), y = ri(r, 4, 22); rrect(g, x, y, ri(r, 6, 9), ri(r, 3, 5), mixh(base, "#a67c31", 0.55)); rrect(g, x + 1, y + 1, 4, 2, mixh(base, "#c2933e", 0.5)); shape(g, x - 1, y + 2, TUFTS[0], dark); }
    if (v === 17) { const x = ri(r, 5, 22), y = ri(r, 6, 22); px(g, x + 1, y + 2, 2, 2, "#f2dfba"); px(g, x + 2, y + 3, 1, 1, "#c9b08a"); px(g, x, y + 1, 4, 1, "#c98f5a"); px(g, x + 1, y, 2, 1, "#c98f5a"); dot(g, x + 1, y, "#e8b37a"); dot(g, x + 3, y + 1, "#a06a3a"); }
    if (v === 20 && s.flowers.length) { const x = ri(r, 5, 20), y = ri(r, 6, 20); [[0, 0], [6, 3], [3, 7]].forEach((d, i) => { const fc = s.flowers[(v + i) % s.flowers.length]; flower(g, x + d[0], y + d[1], fc, fc === "#ffe066" ? "#f28c28" : "#ffe066", deep); }); }
    if (v % 11 === 4 && s.flowers.length) { const fc = s.flowers[v % s.flowers.length]; flower(g, ri(r, 8, 22), ri(r, 8, 22), fc, fc === "#ffe066" ? "#f28c28" : "#ffe066", deep); }
    if (v % 11 === 7) { const x = ri(r, 4, 18), y = ri(r, 4, 18); clover(g, x, y, dark, light, deep); clover(g, x + 6, y + 1, mixh(dark, deep, 0.5), light, deep); if (r() < 0.6) clover(g, x + 2, y + 5, dark, light, deep); }
    if ((v === 2 || v === 9) && season !== "fall") { const x = ri(r, 6, 22), y = ri(r, 6, 22); px(g, x, y + 2, 1, 4, deep); dot(g, x + 1, y + 4, deep); if (v === 2) { rrect(g, x - 1, y - 1, 3, 3, "#ffe066"); dot(g, x, y, "#f7d23e"); } else { rrect(g, x - 1, y - 1, 3, 3, "#f4f1ea"); dot(g, x, y, "#d8d4c8"); dot(g, x + 2, y - 2, "#f4f1ea"); } }
    if ((v === 2 || v === 9) && season === "fall") { const x = ri(r, 4, 22), y = ri(r, 4, 22); px(g, x, y, 2, 1, "#d8703a"); px(g, x + 1, y + 1, 2, 1, "#e0803a"); dot(g, x + 3, y + 1, "#a5522a"); px(g, x + 6, y + 4, 2, 1, "#c9a34a"); dot(g, x + 7, y + 5, "#a5744a"); }
  });
}
const STONE_GREY = { stone: "#8f8f8c", stoneL: "#b9b9b5", stoneD: "#6c6c69", shadow: "#3b4a2a" };
function snowTile(g, s, v, tone, r) {
  /* winter: snow with blue shadows, sparkle, little drifts and dry grass poking through */
  const base = tone < 0 ? mixh(s.grass, s.dark, 0.09 * -tone) : mixh(s.grass, s.light, 0.1 * tone);
  const shadow = mixh(base, s.dark, 0.8), drift = mixh(base, s.light, 0.7), deep = s.deep;
  px(g, 0, 0, A, A, base);
  for (let i = 0; i < 1 + (v % 3 === 1 ? 1 : 0); i++) { const x = ri(r, -2, 22), y = ri(r, -2, 26), w = ri(r, 7, 13), h = ri(r, 3, 5); rrect(g, x + 1, y + 1, w, h, shadow); rrect(g, x, y, w, h, drift); px(g, x + 1, y, 3, 1, "#ffffff"); }
  for (let i = 0; i < 2; i++) rrect(g, ri(r, -2, 26), ri(r, -2, 28), ri(r, 5, 9), 2, shadow);
  for (let i = 0; i < 3; i++) rrect(g, ri(r, -2, 26), ri(r, -2, 28), ri(r, 3, 6), 2, drift);
  for (let i = 0; i < 12; i++) dot(g, ri(r, 0, A - 1), ri(r, 0, A - 1), s.dark);
  for (let i = 0; i < 5; i++) dot(g, ri(r, 0, A - 1), ri(r, 0, A - 1), deep);
  for (let i = 0; i < 6; i++) dot(g, ri(r, 0, A - 1), ri(r, 0, A - 1), "#ffffff");
  if (v % 3 === 0) for (let i = 0; i < 3; i++) { const x = ri(r, 1, 28), y = ri(r, 2, 28); shape(g, x, y, [[0, 0], [0, 1], [2, 0], [2, 1], [1, 2]], "#a89a6a"); dot(g, x, y - 1, "#d9cfa8"); px(g, x, y + 3, 3, 1, shadow); }
  if (v === 11) { const x = ri(r, 5, 22), y = ri(r, 6, 22); stone(g, x, y, 5, 3, { stone: "#8f8f8c", stoneL: "#b9b9b5", stoneD: "#6c6c69", shadow: s.deep }); px(g, x, y - 1, 4, 1, "#ffffff"); }
  if (v % 11 === 7) { const x = ri(r, 4, 22), y = ri(r, 4, 22); shape(g, x, y, [[0, 0], [1, 1], [2, 2], [3, 2], [4, 3]], "#8a6a48"); dot(g, x + 1, y, "#a5744a"); }
}

// ------------------------------------------------------------ water (3 animation frames)
function waterTile(frame, v) {
  /* frame 0..2 animates; v 0..3 picks a different dash layout so neighbouring pond tiles do not repeat (old callers omit it) */
  frame = ((frame % 3) + 3) % 3; v = (((v | 0) % 4) + 4) % 4;
  return cached("water:" + frame + ":" + v, A, A, (g) => {
    const base = "#3d8dd4", deep = "#2f6fb0", mid = "#4d9ce0", hi = "#7fc6f0", hi2 = "#a9dcf7", hi3 = "#dcf2fc";
    px(g, 0, 0, A, A, base);
    const r = rng(9001 + v * 613);                              // layout depends only on the variant; the frame just drifts it
    const band = mixh(base, deep, 0.4), trough = mixh(base, deep, 0.7), lift = mixh(base, mid, 0.6);
    // long, thin tonal bands: the gentle undulation of the surface
    for (let i = 0; i < 4; i++) { const x = ri(r, -4, 20), y = ri(r, 0, 30), w = ri(r, 10, 18); px(g, x, y, w, 2, band); if (i < 2) px(g, x + 2, y + 1, w - 5, 1, mixh(band, deep, 0.4)); }
    for (let i = 0; i < 3; i++) px(g, ri(r, -4, 22), ri(r, 0, 30), ri(r, 8, 14), 1, lift);
    // ripples: 1px crests spread over the tile, each drifting 1px per frame and cycling dim -> bright -> brightest
    const CREST = [mixh(mid, hi, 0.45), hi, hi2];
    for (let i = 0; i < 10; i++) {
      const L = ri(r, 4, 9), bx = ri(r, 0, A - L - 3), y = 1 + i * 3 + ri(r, 0, 2), st = (frame + i + v) % 3;
      const x = bx + frame;
      px(g, x, y, L, 1, CREST[st]);
      if (st === 2) { dot(g, x + 1, y, hi3); if (L > 6) dot(g, x + L - 2, y, hi3); }        // brightest phase: sparkle on the crest
      if (st === 0 && L > 5) dot(g, x + L - 1, y, mid);                                       // dimmest phase: the tail fades out
      if (i % 2 === 0) px(g, x + 1, y + 1, L - 1, 1, trough);                                 // dark trough under half of them
    }
    // twinkles that hop about between frames
    for (let i = 0; i < 5; i++) { const x = ri(r, 1, 29), y = ri(r, 1, 30); if ((i + frame) % 3 === 0) { dot(g, x, y, hi2); dot(g, x + 1, y, hi); } }
  });
}

// ------------------------------------------------------------ dirt, path, sand
function specklesTile(key, base, dots, seed) {
  return cached(key, A, A, (g) => {
    px(g, 0, 0, A, A, base);
    const r = rng(seed);
    for (let i = 0; i < 12; i++) { const x = Math.floor(r() * A), y = Math.floor(r() * A); px(g, x, y, 1 + Math.floor(r() * 2), 1, dots[i % dots.length]); }
  });
}
const FIELD = { base: "#d5a54c", dark: "#c2933e", darker: "#a67c31", light: "#e4b86a", lighter: "#eed08a", stone: "#b9ad98", stoneL: "#d9d0bc", stoneD: "#8a7f6c", shadow: "#a67c31" };
const PATH = { base: "#c8a066", dark: "#b08a55", darker: "#9c7845", light: "#dcbb84", lighter: "#e8cc98", stone: "#b59d7a", stoneL: "#d6c19f", stoneD: "#8a7252", shadow: "#8a6a3c" };   // stones warmed toward the path base
const SAND = { base: "#e6d3a0", dark: "#d1bb82", darker: "#c2ad78", light: "#f4e6bd", lighter: "#fbf1d2", stone: "#c9bfae", stoneL: "#e6ddd0", stoneD: "#9c9080", shadow: "#c2ad78" };
function dirtTile(key, P, seed, o) {
  return cached(key, A, A, (g) => {
    const r = rng(seed);
    const patchD = mixh(P.base, P.dark, 0.3), patchL = mixh(P.base, P.light, 0.35);
    px(g, 0, 0, A, A, P.base);
    for (let i = 0; i < (o.patches == null ? 3 : o.patches); i++) { const x = ri(r, -3, 24), y = ri(r, -3, 26), w = ri(r, 7, 13), h = ri(r, 3, 6); rrect(g, x, y, w, h, patchD); rrect(g, x + ri(r, -3, 3), y + ri(r, -2, 2), ri(r, 5, 9), ri(r, 2, 4), patchD); }
    for (let i = 0; i < 2; i++) rrect(g, ri(r, -2, 24), ri(r, -2, 26), ri(r, 5, 10), ri(r, 2, 4), patchL);
    speckle(g, r, o.fine || 44, [P.dark, P.dark, P.light, P.light, P.darker, P.lighter]);
    speckle(g, r, 9, [P.dark, P.light, P.darker], 2);
    for (let i = 0; i < (o.cracks || 0); i++) crack(g, r, P.darker);
    const sw = o.stoneW || [2, 3], sh = o.stoneH || [1, 2];
    for (let i = 0; i < (o.stones || 0); i++) stone(g, ri(r, 1, 26), ri(r, 1, 27), ri(r, sw[0], sw[1]), ri(r, sh[0], sh[1]), P);
    for (let i = 0; i < (o.pebbles || 0); i++) { const x = ri(r, 0, 30), y = ri(r, 0, 30); dot(g, x, y, P.stoneL); dot(g, x + 1, y, P.stoneD); }
    if (o.ripples) for (let i = 0; i < o.ripples; i++) { const x = ri(r, 0, 24), y = ri(r, 0, 31), w = ri(r, 3, 6); px(g, x, y, w, 1, P.lighter); px(g, x + 1, y + 1, w - 1, 1, P.dark); }
    if (o.shell) { const x = ri(r, 4, 24), y = ri(r, 4, 24); px(g, x, y, 3, 2, "#f7dcd0"); dot(g, x, y, "#fff4ef"); dot(g, x + 2, y + 1, "#e0a898"); px(g, x + 1, y + 2, 2, 1, P.darker); }
    if (o.weed) { const side = ri(r, 0, 3), x = side < 2 ? ri(r, 2, 25) : side === 2 ? ri(r, 0, 2) : ri(r, 25, 27), y = side === 0 ? ri(r, 1, 3) : side === 1 ? ri(r, 25, 27) : ri(r, 2, 25); weed(g, x, y, "#6a8f34", "#98bf52"); }
  });
}
const GROUND = {
  "d": { base: FIELD.base, edge: FIELD.darker, tile: (h) => { const k = ((h % 5) + 5) % 5; return dirtTile("field" + k, FIELD, 31 + k * 7, { cracks: 1 + (k & 1), stones: k === 4 ? 2 : 1, weed: k === 1 || k === 3 }); } },
  ":": { base: PATH.base, edge: PATH.darker, tile: (h) => { const k = ((h % 4) + 4) % 4; return dirtTile("path" + k, PATH, 11 + k * 5, { cracks: k === 2 ? 1 : 0, stones: 1 + (k & 1), stoneW: [3, 4], stoneH: [2, 2], pebbles: 1, weed: k === 3 }); } },
  ",": { base: SAND.base, edge: SAND.darker, tile: (h) => { const k = ((h % 4) + 4) % 4; return dirtTile("sand" + k, SAND, 21 + k * 3, { patches: 2, fine: 34, ripples: 3 + (k & 1), pebbles: 2, shell: k === 2 }); } },
};

// ------------------------------------------------------------ tilled soil
const SOIL_PAL = {
  dry: { base: "#9d6a3a", dark: "#7a4f2b", darker: "#5e3b1f", light: "#b57d49", hi: "#c98f5a" },
  wet: { base: "#6b4629", dark: "#52341e", darker: "#3f2816", light: "#7f5634", hi: "#8f6340" },
  fert: { base: "#9d6a3a", dark: "#7a4f2b", darker: "#5e3b1f", light: "#b57d49", hi: "#c98f5a" },
};
function soilTile(kind, v) {
  const P = SOIL_PAL[kind] || SOIL_PAL.dry;
  v = ((v | 0) % 4 + 4) % 4;   // optional layout variant so a big plot does not repeat one stamp
  return cached("soil:" + kind + ":" + v, A, A, (g) => {
    const r = rng((kind === "wet" ? 313 : kind === "fert" ? 717 : 515) + v * 1013);
    const above = mixh(P.base, P.dark, 0.4), gapT = mixh(P.base, P.dark, 0.3);
    const ridgeT = [P.light, mixh(P.light, P.hi, 0.5), P.hi, mixh(P.light, P.base, 0.45)];   // the crest catches the light unevenly
    px(g, 0, 0, A, A, P.base);
    // loose crumbs between the rows
    for (let i = 0; i < 22; i++) px(g, ri(r, 0, A - 1), ri(r, 0, A - 1), ri(r, 1, 2), 1, pick(r, [P.dark, P.light, P.dark, P.hi]));
    // furrows every 8px: a shadowed trench, a shaded wall, a lit ridge crest -- broken into short dashes so the rows read as raked earth, not planks
    for (let row = 0; row < 4; row++) {
      const y = 3 + row * 8;
      let x = ri(r, -4, -1);                                    // each row starts at its own offset so the gaps stagger
      while (x < A) {
        const seg = ri(r, 3, 7), gap = ri(r, 1, 2), t = pick(r, ridgeT), y1 = y + (x > 0 && x + seg < A - 1 && r() < 0.22 ? 1 : 0);   // the odd dash sits a pixel low
        px(g, x, y1, seg, 1, P.darker); px(g, x, y1 + 1, seg, 1, P.dark);
        px(g, x + (seg > 4 ? 1 : 0), y1 + 2, seg - (seg > 4 ? 1 : 0), 1, t);
        if (r() < 0.55) px(g, x + 1, y1 + 3, Math.max(1, seg - 3), 1, t === P.hi ? P.light : P.hi);
        if (r() < 0.6) px(g, x, y1 - 1, seg, 1, above);
        dot(g, x + seg, y1, gapT);                              // the gap: a crumb of lighter earth rather than a hole
        x += seg + gap;
      }
    }
    // clod lumps sitting across the furrows, breaking the lines
    for (let i = 0; i < 8; i++) {
      const x = ri(r, 0, 29), y = i < 5 ? 2 + 8 * ri(r, 0, 3) + ri(r, 0, 3) : ri(r, 1, 29), big = r() < 0.5;
      if (big) { px(g, x, y, 3, 2, P.light); dot(g, x, y, P.hi); px(g, x + 1, y + 1, 2, 1, P.dark); px(g, x + 1, y + 2, 2, 1, P.darker); }
      else { px(g, x, y, 2, 1, P.light); dot(g, x + 1, y, P.dark); px(g, x + 1, y + 1, 1, 1, P.darker); }
    }
    if (kind === "wet") for (let i = 0; i < 9; i++) { const x = ri(r, 0, 29), y = 3 + 8 * ri(r, 0, 3) + ri(r, 0, 1); px(g, x, y, ri(r, 2, 3), 1, "#5d6f8a"); dot(g, x + 1, y, "#7a8ea8"); }
    if (kind === "fert") for (let i = 0; i < 16; i++) { const x = ri(r, 0, 31), y = 3 + 8 * ri(r, 0, 3) + ri(r, 0, 1); dot(g, x, y, pick(r, ["#aab493", "#c4cbad", "#93a084", "#b9bfa5"])); }   // pale, dusty fertiliser lying in the trenches
  });
}
const SOIL_EDGE = { dry: "#6b4629", wet: "#3f2816", fert: "#6b4629" };

// ------------------------------------------------------------ scattered floor decorations (transparent 32x32, drawn over grass)
const DECOR_KINDS = ["pebbles", "wildflowers", "tallgrass", "clover", "leaves", "twig", "log", "dandelions", "mushrooms", "puddle",
  "tallgrass", "pebbles", "wildflowers", "clover", "tallgrass", "leaves"];
function tallGrass(g, x, y, C, r) {
  /* a fan of tall blades rooted at (x, y): shadow blades behind, lit blades in front */
  const n = ri(r, 5, 7);
  px(g, x - 3, y + 1, n + 1, 1, C.deep);
  for (let i = 0; i < n; i++) {
    const bx = x - 3 + i, h = ri(r, 4, 9), lean = i < n / 2 ? -1 : 1, col = i % 3 === 1 ? C.dark : C.deep;
    for (let k = 0; k <= h; k++) dot(g, bx + (k > h * 0.55 ? lean : 0), y - k, col);
    dot(g, bx + lean, y - h, C.light); if (h > 6) dot(g, bx + (h > 8 ? lean : 0), y - h + 2, C.light);
  }
}
const DRY = { deep: "#7f7350", dark: "#a89a6a", light: "#e8e0c0" };
const DECOR = {
  pebbles(g, c, season, s, v, r) {
    const q = blank(A, A), sg = q.getContext("2d"), n = ri(r, 2, 3), cx = ri(r, 8, 20), cy = ri(r, 10, 20);
    for (let i = 0; i < n; i++) { const w = ri(r, 3, 6), h = ri(r, 2, 3), brown = r() < 0.4; stone(sg, cx + ri(r, -6, 6), cy + ri(r, -4, 4), w, h, brown ? { stone: "#9c8a74", stoneL: "#c2b39e", stoneD: "#6e5f4d", shadow: "#6e5f4d" } : STONE_GREY); }
    outline(q, OUT); g.drawImage(q, 0, 0);
  },
  wildflowers(g, c, season, s, v, r) {
    if (!s.flowers.length) { tallGrass(g, ri(r, 10, 20), ri(r, 14, 24), DRY, r); return; }
    const q = blank(A, A), sg = q.getContext("2d"), n = ri(r, 2, 3), cx = ri(r, 8, 20), cy = ri(r, 9, 20);
    for (let i = 0; i < n; i++) {
      const fc = s.flowers[(v + i) % s.flowers.length], x = cx + i * 5 - 4 + ri(r, 0, 2), y = cy + ri(r, -3, 4);
      px(sg, x, y + 2, 1, 4, s.deep); px(sg, x + 1, y + 4, 2, 1, s.dark); dot(sg, x - 1, y + 3, s.dark);
      px(sg, x - 1, y, 3, 1, fc); px(sg, x, y - 1, 1, 3, fc); dot(sg, x, y, fc === "#ffe066" ? "#f28c28" : "#ffe066"); dot(sg, x - 1, y - 1, mixh(fc, "#ffffff", 0.5));
    }
    outline(q, OUT); g.drawImage(q, 0, 0);
  },
  tallgrass(g, c, season, s, v, r) {
    const C = season === "winter" ? DRY : { deep: s.deep, dark: s.dark, light: s.light };
    tallGrass(g, ri(r, 9, 22), ri(r, 14, 25), C, r);
    if (season === "winter") { const x = ri(r, 8, 20); px(g, x, ri(r, 20, 26), 5, 1, "#ffffff"); }
  },
  clover(g, c, season, s, v, r) {
    if (season === "winter") { tallGrass(g, ri(r, 10, 20), ri(r, 14, 24), DRY, r); return; }
    // a tight patch of 5-7 three-lobed leaves in two greens, edged in deep green so it sits on the grass as one clump
    const q = blank(A, A), sg = q.getContext("2d"), cx = ri(r, 6, 14), cy = ri(r, 8, 15), n = ri(r, 5, 7);
    const tones = [s.dark, mixh(s.dark, s.deep, 0.5), mixh(s.dark, s.light, 0.35)], under = mixh(s.deep, OUT, 0.2);
    const SPOTS = [[0, 0], [5, 1], [10, 0], [2, 4], [7, 5], [12, 4], [4, 8], [9, 9]], k0 = ri(r, 0, 7);
    for (let i = 0; i < n; i++) { const sp = SPOTS[(k0 + i) % SPOTS.length]; clover(sg, cx + sp[0] + ri(r, -1, 1), cy + sp[1] + ri(r, -1, 1), tones[(i + v) % 3], s.light, under); }
    if (v % 2 === 0) { const x = cx + 6, y = cy - 1; px(sg, x, y + 2, 1, 3, s.deep); px(sg, x - 1, y, 3, 2, "#ffffff"); px(sg, x, y - 1, 1, 4, "#ffffff"); dot(sg, x, y, "#ffd6e8"); dot(sg, x - 1, y + 1, "#e8e0e8"); }
    outline(q, mixh(s.deep, OUT, 0.45)); g.drawImage(q, 0, 0);
  },
  leaves(g, c, season, s, v, r) {
    // 4-6 fallen leaves, each a pointed oval with a stem and shaded underside, outlined as one scatter
    const cols = season === "fall" ? ["#e0803a", "#d8503a", "#e8b43a", "#c9642a", "#a5744a"] : season === "winter" ? ["#8a6a48", "#a5744a", "#7a5a3a"] : ["#7fb440", "#9cc24a", "#b8c04a", "#6f9a34", "#c9a34a"];
    const q = blank(A, A), sg = q.getContext("2d"), cx = ri(r, 4, 12), cy = ri(r, 4, 11), n = ri(r, 4, 6);
    const SPOTS = [[0, 1], [8, 0], [3, 8], [11, 7], [7, 13], [14, 12]], k0 = ri(r, 0, 5), c0 = ri(r, 0, cols.length - 1);
    for (let i = 0; i < n; i++) {
      const sp = SPOTS[(k0 + i) % SPOTS.length], x = cx + sp[0] + ri(r, -1, 1), y = cy + sp[1] + ri(r, -1, 1), col = cols[(c0 + i) % cols.length];
      leaf(sg, x, y, ri(r, 0, 3), col, mixh(col, "#fff4cc", 0.4), mixh(col, OUT, 0.4), mixh(col, OUT, 0.6));
    }
    outline(q, OUT); g.drawImage(q, 0, 0);
  },
  twig(g, c, season, s, v, r) {
    const q = blank(A, A), sg = q.getContext("2d"), x = ri(r, 6, 14), y = ri(r, 12, 20), L = ri(r, 9, 12);
    px(sg, x, y + 1, L, 1, WOOD.dark); px(sg, x, y, L - 3, 1, WOOD.mid); px(sg, x + 2, y + 2, L - 5, 1, WOOD.deep);
    px(sg, x + L - 3, y, 2, 1, WOOD.dark);
    const fx = x + ri(r, 3, 5); dot(sg, fx, y - 1, WOOD.dark); dot(sg, fx + 1, y - 2, WOOD.mid); dot(sg, fx + 2, y - 3, WOOD.mid);
    dot(sg, x + L - 1, y + 2, WOOD.dark);
    outline(q, OUT); g.drawImage(q, 0, 0);
  },
  log(g, c, season, s, v, r) {
    const q = blank(A, A), sg = q.getContext("2d"), x = ri(r, 6, 12), y = ri(r, 12, 18), L = 14;
    px(g, x + 1, y + 7, L, 1, "rgba(0,0,0,0.18)");
    rrect(sg, x, y, L, 7, WOOD.mid);
    px(sg, x + 1, y + 1, L - 4, 1, WOOD.light); px(sg, x + 1, y + 5, L - 3, 1, WOOD.dark); px(sg, x + 2, y + 6, L - 5, 1, WOOD.deep);
    for (let i = 0; i < 3; i++) px(sg, x + 2 + i * 4, y + 3, 2, 1, WOOD.dark);
    dot(sg, x + 4, y + 2, WOOD.light); dot(sg, x + 9, y + 2, WOOD.light);
    // cut end with growth rings
    px(sg, x + L - 3, y, 3, 7, WOOD.light); px(sg, x + L - 3, y, 1, 1, WOOD.mid); px(sg, x + L - 1, y, 1, 1, WOOD.mid); px(sg, x + L - 3, y + 6, 1, 1, WOOD.mid); px(sg, x + L - 1, y + 6, 1, 1, WOOD.mid);
    px(sg, x + L - 2, y + 1, 1, 5, WOOD.mid); px(sg, x + L - 3, y + 2, 3, 3, WOOD.mid); px(sg, x + L - 2, y + 2, 1, 3, WOOD.light); dot(sg, x + L - 2, y + 3, WOOD.dark);
    // branch stub on top
    px(sg, x + 5, y - 2, 2, 2, WOOD.dark); dot(sg, x + 5, y - 2, WOOD.mid);
    if (season === "winter") px(sg, x + 1, y - 1, L - 4, 1, "#ffffff");
    outline(q, OUT); g.drawImage(q, 0, 0);
    if (season !== "winter") { dot(g, x + 2, y + 8, "#e8b37a"); px(g, x + 1, y + 8, 3, 1, "#c98f5a"); }
  },
  dandelions(g, c, season, s, v, r) {
    if (season === "winter" || season === "fall") { DECOR.twig(g, c, season, s, v, r); return; }
    const q = blank(A, A), sg = q.getContext("2d"), n = ri(r, 2, 3), cx = ri(r, 8, 20), cy = ri(r, 9, 20);
    for (let i = 0; i < n; i++) {
      const x = cx + i * 5 - 4 + ri(r, 0, 2), y = cy + ri(r, -3, 4), seed = i === n - 1;
      px(sg, x, y + 2, 1, 4, s.deep); px(sg, x - 2, y + 4, 2, 1, s.dark); px(sg, x + 1, y + 5, 2, 1, s.dark);
      if (seed) { rrect(sg, x - 1, y - 1, 3, 3, "#f4f1ea"); dot(sg, x, y, "#d8d4c8"); dot(sg, x - 1, y - 1, "#ffffff"); dot(sg, x + 2, y - 2, "#f4f1ea"); }
      else { rrect(sg, x - 1, y - 1, 3, 3, "#ffe066"); dot(sg, x, y, "#f7d23e"); dot(sg, x - 1, y - 1, "#fff2a8"); }
    }
    outline(q, OUT); g.drawImage(q, 0, 0);
  },
  mushrooms(g, c, season, s, v, r) {
    const q = blank(A, A), sg = q.getContext("2d"), n = ri(r, 2, 3), cx = ri(r, 7, 19), cy = ri(r, 12, 22);
    for (let i = 0; i < n; i++) {
      const w = ri(r, 4, 6), h = w > 4 ? 3 : 2, x = cx + i * 6 - 5 + ri(r, 0, 1), y = cy + ri(r, -3, 3), red = (v + i) % 3 === 0;
      const cap = red ? "#e0524f" : "#c98f5a", capL = red ? "#ff8a7a" : "#e8b37a", capD = red ? "#a83a38" : "#a06a3a";
      px(sg, x + Math.floor(w / 2) - 1, y + h, 2, 2, "#f7e6c4"); dot(sg, x + Math.floor(w / 2), y + h + 1, "#d9c4a0");
      rrect(sg, x, y, w, h, cap); px(sg, x + 1, y, w - 2, 1, capL); px(sg, x + 1, y + h - 1, w - 1, 1, capD);
      if (red) { dot(sg, x + 1, y + 1, "#ffffff"); if (w > 4) dot(sg, x + w - 2, y + 1, "#ffffff"); } else dot(sg, x + 1, y + 1, "#f2dfba");
      if (season === "winter") px(sg, x + 1, y - 1, w - 2, 1, "#ffffff");
    }
    outline(q, OUT); g.drawImage(q, 0, 0);
  },
  puddle(g, c, season, s, v, r) {
    const ice = season === "winter";
    const rim = ice ? "#a9c4d6" : "#3f7fb4", base = ice ? "#d3e6f0" : "#5da3dc", hi = ice ? "#ffffff" : "#8cc4ec", hi2 = ice ? "#eef7fb" : "#c8e8f8";
    const cx = ri(r, 6, 14), cy = ri(r, 10, 18), w = ri(r, 10, 14), h = ri(r, 5, 7);
    const parts = [[cx, cy, w, h], [cx + ri(r, 3, 6), cy + ri(r, 2, 4), ri(r, 6, 9), ri(r, 4, 5)], [cx - ri(r, 1, 3), cy + ri(r, 1, 3), ri(r, 5, 7), ri(r, 3, 4)]];
    for (const p of parts) rrect(g, p[0], p[1], p[2], p[3], rim);
    for (const p of parts) rrect(g, p[0] + 1, p[1] + 1, p[2] - 2, p[3] - 2, base);
    px(g, cx + 2, cy + 1, w - 6, 1, hi); px(g, cx + 3, cy + 2, 3, 1, hi2); dot(g, cx + w - 4, cy + h - 3, hi);
    if (!ice) { px(g, cx + 4, cy + h - 2, 4, 1, mixh(base, s.grass, 0.4)); }
    else { px(g, cx + 4, cy + 3, 5, 1, "#b8d0e0"); dot(g, cx + 6, cy + 4, "#b8d0e0"); }
  },
};
function strHash(str) {
  /* small deterministic hash of a string's char codes, so every kind / season name gets its own layout */
  let h = 7; for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) >>> 0;
  return h % 65521;
}
function decorSprite(season, kind, v) {
  v = ((v % 8) + 8) % 8;
  const s = SEASON[season] || SEASON.spring, fn = DECOR[kind];
  if (!fn) return null;
  return cached("decor:" + season + ":" + kind + ":" + v, A, A, (g, c) => fn(g, c, season, s, v, rng((hash(strHash(kind) + v * 977, strHash(season) + 3) >>> 1) | 1)));
}

Object.assign(window.ART, { noise2, grassTile, waterTile, specklesTile, GROUND, soilTile, SOIL_EDGE, DECOR_KINDS, decorSprite });
})();
