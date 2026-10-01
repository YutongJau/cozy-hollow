/* Cozy Hollow art - the valley beyond the farm.
   Town and frontier buildings, the lighthouse, mine mouth, tiki hut and volcano; cobbles, planks, gravel, desert and cave
   floors; cliffs, mesas and cave walls; pines, palms and cacti; valley props, ore rocks and the icons of everything new.
   Everything is built from the farm's own kit (ART.BH: boards, shingles, windows, doors; ART.PH: trunks, rocks, lamps),
   with the same 32px tiles, four-tone materials lit from the top-left and the dark OUT outline, so it all belongs together.
   Draw only with px() (fillRect) and drawImage at integer coordinates.
   Render to check:  node tools/render.js out.png 3 "areaBuilding('store',10,6,false,'MERCANTILE')" */
"use strict";
(function () {
const ART = window.ART;
const { A, px, hash, rng, mix, shade, cached, outline, mirrored, blank, OUT, WOOD, SEASON, TREE_PAL, COLORS, ITEM_HEX, text3x5, textWidth } = ART;
const BH = ART.BH, PH = ART.PH;
const { mixc, shadec, STONE, IRON, FLOWERS, LEAF } = BH;
const WHITE = "#ffffff";
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const dot = (g, x, y, c) => px(g, x, y, 1, 1, c);
function hexOf(c) { if (c[0] === "#") return c; const m = /\(([^)]+)\)/.exec(c)[1].split(",").map(Number); return "#" + m.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join(""); }
const mixh = (a, b, t) => hexOf(mixc(a, b, t));
function rrect(g, x, y, w, h, col) {
  if (w < 3 || h < 3) { px(g, x, y, w, h, col); return; }
  px(g, x + 1, y, w - 2, h, col); px(g, x, y + 1, w, h - 2, col);
}
function disc(g, cx, cy, r, col) { for (let dy = -r; dy <= r; dy++) { const hw = Math.floor(Math.sqrt((r + 0.4) * (r + 0.4) - dy * dy)); px(g, cx - hw, cy + dy, hw * 2 + 1, 1, col); } }
function ellipse(g, cx, cy, rx, ry, col) { for (let dy = -ry; dy <= ry; dy++) { const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.4) * (ry + 0.4))))); px(g, cx - hw, cy + dy, hw * 2 + 1, 1, col); } }

// =========================================================================== ground
const COB = { mortar: "#958470", deep: "#7c6c5a", dark: "#ad9d87", base: "#c2b39c", light: "#d2c5ae", hi: "#e3d8c4" };   // warm, like the farm's paths
const GRAVEL = { base: "#a99f8e", dark: "#958b7b", darker: "#7d7467", light: "#bcb3a3", lighter: "#d1c9ba", stone: "#8f877a", stoneL: "#c7bfb0", stoneD: "#6f685d" };
const DESERT = { base: "#e3b47c", dark: "#d29f66", darker: "#bb8752", light: "#efc792", lighter: "#f7dbae", stone: "#c99a6a", stoneL: "#e8c49a", stoneD: "#9a6c44" };
const CAVEF = { base: "#5e544b", dark: "#4f463e", darker: "#3f3831", light: "#71665b", lighter: "#857869", stone: "#6c6157", stoneL: "#8c7f70", stoneD: "#3a332d" };
const PLANK = { deep: "#5a3a22", dark: "#7f5432", mid: "#a5713f", light: "#c48d55", hi: "#dcae74" };
function cobbleTile(v) {
  /* rounded setts in staggered courses: mortar lines, a lit top-left on each stone and a shaded bottom-right */
  v = ((v % 6) + 6) % 6;
  return cached("w:cob" + v, A, A, (g) => {
    const r = rng(4401 + v * 97);
    px(g, 0, 0, A, A, COB.mortar);
    for (let row = 0; row < 4; row++) {
      const y = row * 8, off = (row % 2) ? -ri(r, 3, 6) : -ri(r, 0, 2);
      for (let x = off; x < A; ) {
        const w = ri(r, 7, 10), t = r(), base = t < 0.2 ? COB.dark : t > 0.82 ? COB.light : COB.base;
        const x0 = Math.max(0, x + 1), x1 = Math.min(A, x + w - 1);
        if (x1 - x0 >= 2) {
          px(g, x0, y + 1, x1 - x0, 6, base);
          px(g, x0, y + 1, x1 - x0, 1, mixh(base, COB.hi, 0.6)); px(g, x0, y + 1, 1, 5, mixh(base, COB.hi, 0.4));
          px(g, x0, y + 6, x1 - x0, 1, mixh(base, COB.deep, 0.55)); px(g, x1 - 1, y + 2, 1, 5, mixh(base, COB.deep, 0.4));
          if (x0 === x + 1) dot(g, x0, y + 1, COB.mortar); if (x1 === x + w - 1) dot(g, x1 - 1, y + 6, COB.mortar);
          if (r() < 0.25) dot(g, x0 + ri(r, 1, Math.max(1, x1 - x0 - 2)), y + ri(r, 2, 4), mixh(base, COB.deep, 0.3));
        }
        x += w;
      }
    }
    for (let i = 0; i < 3; i++) dot(g, ri(r, 0, 31), ri(r, 0, 31), "#7da35a");   // a little moss in the joints
  });
}
function plankTile(vertical, v, over) {
  /* deck boards: across the walkway (so a pier running north-south has boards side to side); nail heads at the joists */
  v = ((v % 4) + 4) % 4;
  return cached("w:plank" + (vertical ? 1 : 0) + v + (over || ""), A, A, (g, c) => {
    const r = rng(5501 + v * 31 + (vertical ? 7 : 0));
    for (let i = 0; i < 6; i++) {
      const t = r(), base = t < 0.25 ? mixh(PLANK.mid, PLANK.dark, 0.3) : t > 0.75 ? mixh(PLANK.mid, PLANK.light, 0.45) : PLANK.mid;
      const a = i * 6 - 2, b = Math.min(A, a + 6), a0 = Math.max(0, a);
      if (b <= a0) continue;
      if (vertical) { px(g, 0, a0, A, b - a0, base); px(g, 0, a0, A, 1, mixh(base, PLANK.hi, 0.5)); px(g, 0, b - 1, A, 1, PLANK.deep); }
      else { px(g, a0, 0, b - a0, A, base); px(g, a0, 0, 1, A, mixh(base, PLANK.hi, 0.5)); px(g, b - 1, 0, 1, A, PLANK.deep); }
      for (let k = 0; k < 2; k++) { const p = ri(r, 2, 28), q = a0 + ri(r, 1, Math.max(1, b - a0 - 2)), L = ri(r, 3, 7); if (vertical) px(g, p, q, L, 1, mixh(base, PLANK.dark, 0.55)); else px(g, q, p, 1, L, mixh(base, PLANK.dark, 0.55)); }
    }
    for (const j of [4, 27]) for (let i = 0; i < 6; i++) { const q = i * 6 + 1; if (vertical) dot(g, j, q, PLANK.deep); else dot(g, q, j, PLANK.deep); }
  });
}
function speckGround(key, P, seed, o) {
  return cached(key, A, A, (g) => {
    const r = rng(seed);
    px(g, 0, 0, A, A, P.base);
    for (let i = 0; i < (o.patches || 3); i++) rrect(g, ri(r, -3, 24), ri(r, -3, 26), ri(r, 6, 12), ri(r, 3, 6), mixh(P.base, P.dark, 0.45));
    for (let i = 0; i < 2; i++) rrect(g, ri(r, -2, 24), ri(r, -2, 26), ri(r, 5, 10), ri(r, 2, 4), mixh(P.base, P.light, 0.4));
    for (let i = 0; i < (o.fine || 40); i++) px(g, ri(r, 0, 31), ri(r, 0, 31), ri(r, 1, 2), 1, [P.dark, P.light, P.darker, P.lighter][ri(r, 0, 3)]);
    for (let i = 0; i < (o.stones || 0); i++) {
      const x = ri(r, 1, 27), y = ri(r, 1, 28), w = ri(r, 2, 4), h = ri(r, 1, 2);
      px(g, x, y, w, h, P.stone); px(g, x, y, w, 1, P.stoneL); px(g, x + w, y + 1, 1, h, P.stoneD); px(g, x, y + h, w + 1, 1, mixh(P.base, P.darker, 0.6));
    }
    for (let i = 0; i < (o.cracks || 0); i++) { let x = ri(r, 4, 26), y = ri(r, 4, 26); for (let k = 0; k < 6; k++) { dot(g, x, y, P.darker); x += ri(r, -1, 1); y += 1; } }
    if (o.tuft) for (let i = 0; i < o.tuft; i++) { const x = ri(r, 3, 27), y = ri(r, 5, 27); px(g, x, y, 1, 2, "#9a9a4a"); dot(g, x - 1, y - 1, "#b8b25a"); dot(g, x + 1, y - 1, "#b8b25a"); dot(g, x, y + 2, P.darker); }
  });
}
const GROUND2 = {
  "=": { base: COB.base, edge: COB.deep, tile: (h) => cobbleTile(h) },
  "r": { base: GRAVEL.base, edge: GRAVEL.darker, tile: (h) => speckGround("w:gravel" + (h % 4), GRAVEL, 6101 + (h % 4) * 13, { stones: 5, fine: 50, patches: 2 }) },
  "z": { base: DESERT.base, edge: DESERT.darker, tile: (h) => speckGround("w:desert" + (h % 5), DESERT, 6201 + (h % 5) * 17, { stones: (h % 5) === 2 ? 2 : 0, fine: 38, patches: 3, cracks: (h % 5) === 3 ? 1 : 0, tuft: (h % 5) === 1 ? 2 : 0 }) },
  "v": { base: CAVEF.base, edge: CAVEF.darker, tile: (h) => speckGround("w:cave" + (h % 5), CAVEF, 6301 + (h % 5) * 19, { stones: 3, fine: 46, patches: 3, cracks: (h % 5) === 1 ? 2 : 0 }) },
};

// =========================================================================== cliffs, mesas and cave walls
const ROCKS = {
  mountain: { deep: "#4b4540", dark: "#675f57", mid: "#837a6f", light: "#a0978a", hi: "#bdb4a6", top: null },
  frontier: { deep: "#6a3424", dark: "#94472f", mid: "#b8613f", light: "#d48159", hi: "#e9a57a", top: "#c98a55" },
  cave: { deep: "#1d1916", dark: "#2f2823", mid: "#433a33", light: "#5b5047", hi: "#776a5e", top: "#2a2420" },
};
const ROCK_COLS = {}, ROCK_BANDS = {};
function rockCols(kind) {
  if (ROCK_COLS[kind]) return ROCK_COLS[kind];
  const r = rng(7777 + kind.length * 13), out = [];
  for (let x = 0; x < 4 * A; ) { const w = Math.min(4 * A - x, ri(r, 5, 11)); out.push([x, x + w, r()]); x += w; }
  return (ROCK_COLS[kind] = out);
}
function rockBands(kind) {
  if (ROCK_BANDS[kind]) return ROCK_BANDS[kind];
  const r = rng(7878 + kind.length * 17), out = [];
  for (let k = 0; k < 9; k++) out.push([ri(r, 3, 6), [0, 1, 2, 1, 4][k % 5]]);
  return (ROCK_BANDS[kind] = out);
}
function cliffTile(kind, part, v, season, sideL, sideR) {
  /* part: "top" (the plateau above the edge), "lip" (upper rock face under the plateau's edge), "face" (lower face meeting
     the ground, with a shadow and rubble); sideL / sideR draw the rounded end of the cliff where it stops */
  const P = ROCKS[kind] || ROCKS.mountain;
  v = ((v % 4) + 4) % 4;
  return cached("w:cliff" + kind + part + v + season + (sideL ? "L" : "") + (sideR ? "R" : ""), A, A, (g) => {
    const r = rng(7001 + v * 41 + part.length * 7 + kind.length);
    if (part === "top") {
      const s = SEASON[season] || SEASON.summer;
      const top = P.top || s.deep, topL = P.top ? mixh(P.top, P.hi, 0.3) : s.dark, topD = P.top ? mixh(P.top, P.deep, 0.35) : mixh(s.deep, "#203018", 0.35);
      px(g, 0, 0, A, A, top);
      for (let i = 0; i < 14; i++) px(g, ri(r, 0, 30), ri(r, 0, 31), ri(r, 1, 3), 1, r() < 0.5 ? topL : topD);
      if (kind === "frontier") for (let y = 3; y < A; y += 9) px(g, 0, y + ri(r, 0, 2), A, 1, mixh(P.top, P.dark, 0.25));
      if (kind === "mountain") for (let i = 0; i < 2; i++) { const x = ri(r, 3, 24), y = ri(r, 3, 24); px(g, x, y, 4, 3, P.mid); px(g, x, y, 4, 1, P.light); px(g, x + 3, y + 1, 1, 2, P.dark); }
      if (kind === "cave") for (let i = 0; i < 6; i++) dot(g, ri(r, 0, 31), ri(r, 0, 31), P.mid);
    } else {
      // natural rock: vertical fractured columns on the mountain and in the caves, wavy sandstone strata on the mesas.
      // The pattern runs on through a 4-tile cycle (v = x % 4), so a long cliff reads as one face, not a row of tiles.
      px(g, 0, 0, A, A, P.mid);
      const gx = v * A;
      if (kind === "frontier") {
        const bands = rockBands(kind);
        for (let x = 0; x < A; x++) {
          let y = -3;
          for (let k = 0; y < A; k++) { const [h, tone] = bands[k % bands.length], off = Math.round(Math.sin((gx + x) / 6 + k * 1.7) * 1.4); px(g, x, y + off, 1, h + 1, [P.light, P.mid, P.dark, P.mid, P.hi][tone]); y += h; }
        }
        for (let x = 0; x < A; x++) for (let y = 0; y < A; y++) if (hash(gx + x, y * 7 + part.length) % 37 === 0) dot(g, x, y, P.deep);
        for (let i = 0; i < 2; i++) { let x = ri(r, 3, 28); for (let y = ri(r, 0, 10); y < A; y++) { dot(g, x, y, P.deep); if (r() < 0.2) x += ri(r, -1, 1); if (r() < 0.06) break; } }
      } else {
        for (const [a, b, t] of rockCols(kind)) {
          const x0 = Math.max(0, a - gx), x1 = Math.min(A, b - gx);
          if (x1 <= x0) continue;
          const base = t < 0.3 ? P.dark : t > 0.72 ? P.light : P.mid;
          for (let y = 0; y < A; y++) px(g, x0, y, x1 - x0, 1, mixh(base, P.dark, (part === "face" ? 0.18 + y / A * 0.3 : y / A * 0.18)));
          if (a - gx >= 0) px(g, x0, 0, 1, A, mixh(base, P.hi, 0.45));
          if (b - gx <= A) px(g, x1 - 1, 0, 1, A, P.deep);
          for (let k = 0; k < 2; k++) { const yy = 2 + (hash(a, k * 5 + part.length) % 26); px(g, x0, yy, x1 - x0, 1, mixh(base, P.deep, 0.6)); px(g, x0, yy + 1, x1 - x0, 1, mixh(base, P.hi, 0.3)); }
        }
        for (let i = 0; i < 4; i++) dot(g, ri(r, 1, 30), ri(r, 1, 30), kind === "cave" ? "#8a7a6a" : "#7da35a");
      }
      if (part === "lip") {
        // the plateau's edge overhangs the face: grass (or mesa top / dark rock) with a ragged fringe
        const s = SEASON[season] || SEASON.summer, top = P.top || s.deep, fringe = P.top ? mixh(P.top, P.deep, 0.4) : s.dark;
        px(g, 0, 0, A, 4, top);
        for (let x = 0; x < A; x += 2) px(g, x, 4, 2, ri(r, 0, 2), fringe);
        px(g, 0, 4, A, 1, mixh(fringe, P.deep, 0.5));
        for (let x = 0; x < A; x += 3) if (r() < 0.4) dot(g, x, 5 + ri(r, 0, 1), P.deep);
      }
      if (part === "face") {
        for (let i = 0; i < 3; i++) { const x = ri(r, 1, 26), w = ri(r, 3, 6); px(g, x, A - 4, w, 3, P.dark); px(g, x, A - 4, w, 1, P.light); }   // rubble at the foot
        px(g, 0, A - 1, A, 1, P.deep);
      }
      if (sideL) { px(g, 0, 0, 3, A, P.deep); px(g, 3, 0, 1, A, P.dark); }
      if (sideR) { px(g, A - 3, 0, 3, A, P.deep); px(g, A - 4, 0, 1, A, P.light); }
    }
  });
}

// =========================================================================== trees of the valley
const PINE = { D: "#1e4a30", M: "#2d6a40", L: "#468a52", X: "#78b46c" };
function pineSprite(season, variant) {
  /* a conifer: overlapping needle skirts stacked into one cone (each upper tier's hem hangs over the one below), lit on the left,
     shaded on the right, a short trunk at the foot; snow on the tiers in winter */
  variant = ((variant % 8) + 8) % 8;
  return cached("w:pine" + season + variant, 48, 64, (g, c) => {
    const r = rng(8101 + variant * 37), cx = 24 + ri(r, -1, 1);
    PH.trunk(g, cx - 4, 47, 8, 15, variant + 3);
    const tiers = [[24, 50, 20], [16, 40, 16], [9, 30, 12], [3, 20, 8]];   // [top, hem, half-width at the hem], drawn bottom tier first
    tiers.forEach(([y0, y1, hw], i) => {
      for (let y = y0; y <= y1; y++) {
        const t = (y - y0) / (y1 - y0), w = Math.max(1, Math.round(1 + t * hw));
        px(g, cx - w, y, w * 2 + 1, 1, PINE.M);
        px(g, cx - w, y, Math.max(1, Math.round(w * 0.55)), 1, PINE.L);
        px(g, cx + Math.round(w * 0.35), y, w - Math.round(w * 0.35) + 1, 1, PINE.D);
        dot(g, cx - w, y, PINE.D);
      }
      // the hem: a row of drooping needle points, and a shadow line under the tier above
      for (let x = cx - hw; x <= cx + hw; x += 3) { px(g, x, y1 + 1, 2, 1, x < cx ? PINE.M : PINE.D); dot(g, x + 1, y1 + 2, PINE.D); }
      px(g, cx - hw + 2, y1, hw * 2 - 3, 1, PINE.D);
      for (let k = 0; k < 4 + i; k++) { const yy = ri(r, y0 + 3, y1 - 1), ww = Math.round(1 + ((yy - y0) / (y1 - y0)) * hw); dot(g, cx - ww + ri(r, 1, 3), yy, PINE.X); }
      if (season === "winter") for (let y = y0; y < y0 + 3 + i; y++) { const w = Math.round(1 + ((y - y0) / (y1 - y0)) * hw); px(g, cx - w, y, w + 2, 1, y === y0 ? WHITE : "#eef4f8"); }
    });
    px(g, cx, 1, 1, 3, PINE.M); dot(g, cx, 0, PINE.L);
    if (season === "winter") px(g, cx - 1, 1, 2, 2, WHITE);
    outline(c, OUT);
  });
}
const PALM = { trunk: "#b48a5a", trunkL: "#d2ab78", trunkD: "#8a6640", ring: "#6e5032", D: "#2a6e32", M: "#3f9a3e", L: "#6cc24a", X: "#a8e07a" };
function palmSprite(variant) {
  /* a tall palm, 64x80: a ringed trunk curving up to a full crown of drooping fronds (spine plus leaflets either side),
     lit on top, darker underneath, with a cluster of coconuts under the crown */
  variant = ((variant % 6) + 6) % 6;
  return cached("w:palm" + variant, 64, 80, (g, c) => {
    const r = rng(8201 + variant * 29), lean = (variant % 2 ? 1 : -1) * ri(r, 3, 7);
    let topX = 32, topY = 24;
    for (let y = 78; y >= 24; y--) {
      const t = (78 - y) / 54, x = Math.round(32 + lean * t * t), w = y > 72 ? 8 : y > 50 ? 7 : 6;
      px(g, x - Math.floor(w / 2), y, w, 1, PALM.trunk); px(g, x - Math.floor(w / 2), y, 2, 1, PALM.trunkL); px(g, x + Math.ceil(w / 2) - 2, y, 2, 1, PALM.trunkD);
      if (y % 5 === 0) { px(g, x - Math.floor(w / 2), y, w, 1, PALM.ring); dot(g, x - Math.floor(w / 2) + 1, y - 1, PALM.trunkL); }
      topX = x; topY = y;
    }
    px(g, 26, 78, 13, 1, PALM.trunkD);
    const frond = (ang, len, droop, under) => {
      const dx = Math.cos(ang), dy = Math.sin(ang);
      for (let i = 0; i < len; i++) {
        const t = i / len, x = Math.round(topX + dx * i), y = Math.round(topY + dy * i + droop * t * t * len);
        const leaf = Math.max(1, Math.round(5 * Math.sin(Math.PI * Math.min(1, t * 1.15))));
        px(g, x, y, 2, 2, under ? PALM.D : PALM.M);
        for (let k = 1; k <= leaf; k++) {
          dot(g, x - Math.round(dy * k) + (i % 2), y + Math.round(Math.abs(dx) * k * 0.6) + k, under ? PALM.D : (k === 1 ? PALM.L : PALM.M));
          dot(g, x + Math.round(dy * k), y + Math.round(Math.abs(dx) * k * 0.6) + k - 1, under ? PALM.D : PALM.D);
        }
        if (!under && i % 3 === 0) dot(g, x, y, PALM.X);
      }
    };
    [[Math.PI * 0.97, 24, 0.5], [Math.PI * 0.03, 24, 0.5]].forEach(([a, l, d]) => frond(a, l, d, true));
    for (const [x, y] of [[-3, 3], [2, 4], [-1, 6], [3, 1]]) { disc(g, topX + x, topY + y, 2, "#6e4a2a"); dot(g, topX + x - 1, topY + y - 1, "#b8885a"); }
    [[Math.PI * 1.08, 22, 0.55], [Math.PI * -0.08, 22, 0.55], [Math.PI * 1.3, 17, 0.4], [Math.PI * -0.3, 17, 0.4], [Math.PI * 0.85, 19, 0.7], [Math.PI * 0.15, 19, 0.7], [Math.PI * 1.5, 10, 0.25]]
      .forEach(([a, l, d]) => frond(a, l, d, false));
    outline(c, OUT);
  });
}
const CACT = { D: "#2f6a3a", M: "#4c9450", L: "#78bc6a", X: "#a8dc8c", spine: "#f4f0d8" };
function cactusSprite(variant) {
  /* a saguaro: a ribbed column with one or two upturned arms, pale spines, sometimes a pink bloom */
  variant = ((variant % 6) + 6) % 6;
  return cached("w:cactus" + variant, 32, 48, (g, c) => {
    const r = rng(8301 + variant * 23);
    const col = (x, y0, y1, w) => {
      for (let y = y0; y <= y1; y++) { px(g, x, y, w, 1, CACT.M); dot(g, x, y, CACT.L); dot(g, x + 1, y, CACT.X); px(g, x + w - 2, y, 2, 1, CACT.D); }
      px(g, x + 1, y0 - 1, w - 2, 1, CACT.M); dot(g, x + 1, y0 - 1, CACT.X);
      for (let y = y0 + 1; y < y1; y += 3) { dot(g, x + Math.floor(w / 2) - 1, y, CACT.D); dot(g, x, y + 1, CACT.spine); dot(g, x + w - 1, y, CACT.spine); }
    };
    col(12, 6, 45, 8);
    const armL = ri(r, 0, 1) || variant < 3, armR = variant % 2 === 0 || !armL;
    if (armL) { const y = ri(r, 18, 26); px(g, 6, y, 7, 4, CACT.M); px(g, 6, y, 7, 1, CACT.L); col(5, y - ri(r, 6, 10), y + 3, 5); }
    if (armR) { const y = ri(r, 14, 24); px(g, 19, y, 7, 4, CACT.M); px(g, 19, y + 3, 7, 1, CACT.D); col(22, y - ri(r, 6, 10), y + 3, 5); }
    if (variant % 3 === 0) { px(g, 14, 3, 4, 3, "#f08ab8"); dot(g, 15, 3, "#ffd0e4"); dot(g, 16, 5, "#f7d23e"); }
    px(g, 10, 46, 12, 1, "#b8854f");
    outline(c, OUT);
  });
}

// =========================================================================== props
function gravestone(g, v) {
  const S = { deep: "#4f5357", dark: "#6c7176", mid: "#8d9297", light: "#adb2b6", hi: "#cdd1d4" };
  const x = 9, y = 6, w = 14, h = 20;
  px(g, x + 1, y, w - 2, h, S.mid); px(g, x, y + 2, w, h - 2, S.mid); px(g, x + 2, y - 1, w - 4, 1, S.mid);
  px(g, x + 1, y, 3, h, S.light); px(g, x + 2, y - 1, 4, 1, S.hi); px(g, x + w - 3, y + 2, 3, h - 2, S.dark); px(g, x, y + h - 1, w, 1, S.deep);
  if (v % 2) { px(g, x + 6, y + 4, 2, 9, S.deep); px(g, x + 3, y + 7, 8, 2, S.deep); px(g, x + 6, y + 4, 1, 9, S.dark); }
  else for (let k = 0; k < 4; k++) px(g, x + 3, y + 5 + k * 3, w - 6 - (k % 2) * 2, 1, S.dark);
  px(g, x - 2, y + h, w + 4, 3, "#6f8f4a"); px(g, x - 1, y + h, 4, 1, "#9ac25e");
  px(g, x + w - 2, y + h - 4, 4, 3, "#5f8f3a"); dot(g, x + w - 1, y + h - 5, "#ff7eb6"); dot(g, x + w + 1, y + h - 4, "#ffe066");
  for (let i = 0; i < 4; i++) dot(g, x + 2 + i * 3, y + 3 + (i % 2), "#7da35a");
}
function fallenLog(g, v) {
  const y = 12, x0 = 2, x1 = 29;
  px(g, x0 + 3, y, x1 - x0 - 3, 12, WOOD.mid); px(g, x0 + 3, y, x1 - x0 - 3, 2, WOOD.light); px(g, x0 + 3, y + 9, x1 - x0 - 3, 3, WOOD.dark);
  for (let x = x0 + 6; x < x1; x += 5) px(g, x, y + 3 + (x % 3), 3, 1, WOOD.dark);
  ellipse(g, x0 + 4, y + 6, 3, 6, "#c9a36b"); ellipse(g, x0 + 4, y + 6, 2, 4, "#e2c48a"); px(g, x0 + 4, y + 5, 1, 2, "#9c7440"); dot(g, x0 + 3, y + 3, "#f3dfb0");
  for (let x = x0 + 8; x < x1 - 2; x += 2) if (hash(x, v) % 3) dot(g, x, y - 1 + (hash(x, 7) % 2), "#6aa04a");
  px(g, x0 + 10, y - 1, 8, 2, "#5f9a3e"); px(g, x0 + 11, y - 2, 5, 1, "#8ed66a");
  if (v % 2) { px(g, x1 - 6, y + 10, 3, 3, "#f3e6cc"); px(g, x1 - 7, y + 8, 5, 2, "#d9463c"); dot(g, x1 - 6, y + 8, "#fff"); }
}
function trough(g) {
  px(g, 3, 13, 26, 12, WOOD.mid); px(g, 3, 13, 26, 2, WOOD.light); px(g, 3, 22, 26, 3, WOOD.dark);
  px(g, 5, 15, 22, 5, "#3d8dd4"); px(g, 6, 15, 8, 1, "#a9dcf7"); px(g, 18, 17, 6, 1, "#7fc6f0"); px(g, 5, 19, 22, 1, "#2f6fb0");
  px(g, 4, 25, 3, 4, WOOD.dark); px(g, 25, 25, 3, 4, WOOD.dark); for (let x = 9; x < 25; x += 6) px(g, x, 14, 1, 10, WOOD.dark);
}
function stall(g) {
  /* a little market stall: a striped awning on two posts over a counter of produce crates */
  px(g, 4, 6, 2, 24, WOOD.dark); px(g, 26, 6, 2, 24, WOOD.dark); px(g, 4, 6, 1, 24, WOOD.mid);
  for (let i = 0; i < 4; i++) { const col = i % 2 ? "#f7efdc" : "#e0524f"; px(g, 2 + i * 7, 2, 7, 7, col); px(g, 2 + i * 7, 2, 7, 1, mixh(col, WHITE, 0.4)); px(g, 2 + i * 7, 8, 7, 1, mixh(col, "#000000", 0.25)); px(g, 3 + i * 7, 9, 5, 1, col); }
  px(g, 3, 18, 26, 9, WOOD.mid); px(g, 3, 18, 26, 1, WOOD.light); px(g, 3, 26, 26, 1, WOOD.deep);
  BH.veg(g, 6, 18, "pumpkin"); BH.veg(g, 14, 18, "melon"); BH.veg(g, 22, 18, "tomato"); BH.veg(g, 11, 18, "turnip");
}
function cart(g) {
  px(g, 3, 9, 24, 12, WOOD.mid); px(g, 3, 9, 24, 2, WOOD.light); px(g, 3, 18, 24, 3, WOOD.dark); for (let x = 8; x < 27; x += 6) px(g, x, 11, 1, 7, WOOD.dark);
  px(g, 26, 14, 5, 2, WOOD.dark); px(g, 4, 6, 6, 4, "#e6d3a0"); px(g, 12, 5, 8, 5, "#c9a66b"); px(g, 21, 7, 5, 3, "#e6d3a0");
  BH.wagonWheel(g, 9, 23, 6); BH.wagonWheel(g, 22, 23, 6);
}
function ladder(g, down) {
  if (down) {
    ellipse(g, 16, 18, 11, 7, "#1a1512"); ellipse(g, 16, 17, 10, 5, "#0d0a08"); px(g, 6, 13, 20, 1, "#433a33");
    px(g, 11, 6, 2, 14, WOOD.mid); px(g, 19, 6, 2, 14, WOOD.mid); px(g, 11, 6, 1, 14, WOOD.light);
    for (let y = 8; y < 20; y += 4) px(g, 11, y, 10, 2, WOOD.light);
  } else {
    px(g, 9, 1, 3, 30, WOOD.mid); px(g, 20, 1, 3, 30, WOOD.mid); px(g, 9, 1, 1, 30, WOOD.light); px(g, 22, 1, 1, 30, WOOD.dark);
    for (let y = 4; y < 30; y += 5) { px(g, 12, y, 8, 2, WOOD.light); px(g, 12, y + 1, 8, 1, WOOD.dark); }
    px(g, 10, 0, 12, 2, "#fff2b0");
  }
}
function areaProp(ch, v) {
  return cached("w:prop" + ch + (v % 4), A, A, (g, c) => {
    if (ch === "E") gravestone(g, v);
    else if (ch === "L") fallenLog(g, v);
    else if (ch === "I") trough(g);
    else if (ch === "J") stall(g);
    else if (ch === "O") cart(g);
    else if (ch === "U") ladder(g, false);
    else if (ch === "D") ladder(g, true);
    else return;
    outline(c, OUT);
  });
}
function fountainSprite(frame) {
  /* a round stone basin with a two-tier spout, 3 tiles wide and 2 tall (plus room above for the jet) */
  frame = ((frame % 3) + 3) % 3;
  return cached("w:fountain" + frame, 96, 80, (g, c) => {
    const S = { deep: "#5f5a52", dark: "#837d73", mid: "#a49d91", light: "#c3bcaf", hi: "#ddd7cb" };
    ellipse(g, 48, 56, 44, 20, S.dark); ellipse(g, 48, 54, 44, 19, S.mid); ellipse(g, 48, 53, 42, 17, S.light);
    ellipse(g, 48, 54, 37, 13, S.deep); ellipse(g, 48, 55, 36, 12, "#3d8dd4");
    for (let i = 0; i < 6; i++) { const x = 20 + ((i * 11 + frame * 4) % 56), y = 50 + (i * 5 % 9); px(g, x, y, 5, 1, "#a9dcf7"); }
    ellipse(g, 48, 55, 9, 4, "#2f6fb0");
    px(g, 44, 26, 8, 28, S.mid); px(g, 44, 26, 2, 28, S.light); px(g, 50, 26, 2, 28, S.dark);
    ellipse(g, 48, 30, 14, 5, S.dark); ellipse(g, 48, 29, 14, 4, S.light); ellipse(g, 48, 29, 11, 3, "#3d8dd4");
    px(g, 46, 12, 4, 16, S.light); px(g, 48, 12, 2, 16, S.mid);
    for (let i = 0; i < 5; i++) { const t = (i + frame / 3) / 5, x = 47 + Math.round(Math.sin(i * 1.7) * (4 + t * 14)), y = 6 + Math.round(t * t * 26); px(g, x, y, 2, 3, i % 2 ? "#a9dcf7" : "#dcf2fc"); }
    px(g, 45, 4, 6, 4, "#dcf2fc"); px(g, 46, 2, 4, 2, WHITE);
    for (const sx of [12, 84]) { const y = 56 + (frame + sx) % 3; px(g, sx, y, 2, 2, WHITE); }
    outline(c, OUT);
  });
}
function boatSprite() {
  return cached("w:boat", 64, 32, (g, c) => {
    px(g, 6, 14, 52, 10, WOOD.mid); px(g, 3, 12, 58, 3, WOOD.light); px(g, 8, 24, 48, 3, WOOD.dark); px(g, 12, 27, 40, 2, WOOD.deep);
    px(g, 1, 10, 4, 4, WOOD.light); px(g, 59, 10, 4, 4, WOOD.light);
    px(g, 9, 15, 46, 6, "#6e4a2a"); for (const x of [20, 32, 44]) px(g, x, 15, 3, 6, WOOD.light);
    px(g, 6, 17, 52, 1, "#d9463c"); px(g, 6, 18, 52, 1, "#a9342c");
    px(g, 26, 2, 2, 14, WOOD.dark); px(g, 18, 4, 9, 9, "#f4f1ea"); px(g, 18, 4, 9, 1, WHITE); px(g, 18, 12, 9, 1, "#c8c2b5");
    px(g, 14, 28, 36, 2, "#7fc6f0");
    outline(c, OUT);
  });
}
function coachSprite() {
  /* the Dusty Gulch stagecoach: a red coach box with a cream trim, big spoked wheels, a roof rack of luggage */
  return cached("w:coach", 96, 80, (g, c) => {
    const R = { deep: "#5c1f1a", dark: "#8a2c24", mid: "#b8423a", light: "#d4634f", trim: "#f2dfae" };
    px(g, 18, 22, 60, 36, R.mid); px(g, 18, 22, 60, 3, R.light); px(g, 18, 54, 60, 4, R.dark); px(g, 74, 25, 4, 29, R.dark);
    px(g, 14, 18, 68, 5, R.dark); px(g, 14, 18, 68, 1, R.light); px(g, 20, 12, 18, 7, "#8a6a3c"); px(g, 40, 10, 14, 9, "#5a7a9a"); px(g, 56, 13, 16, 6, "#c9a66b");
    for (const x of [24, 52]) { px(g, x, 28, 20, 14, R.trim); px(g, x + 2, 30, 16, 10, "#2b2a33"); px(g, x + 2, 30, 6, 4, "#5b5a68"); }
    px(g, 18, 44, 60, 2, R.trim); text3x5(g, 30, 47, "GULCH LINE", R.trim, 1);
    BH.wagonWheel(g, 26, 64, 12); BH.wagonWheel(g, 70, 66, 10);
    px(g, 78, 40, 14, 3, WOOD.dark); px(g, 86, 30, 3, 12, WOOD.dark);
    outline(c, OUT);
  });
}

// =========================================================================== ore rocks
const ORE_COL = { copper_ore: ["#d0743a", "#f2a060", "#8a4420"], iron_ore: ["#c9c4bc", "#eeeae2", "#8f7a6a"], gold_ore: ["#f2c744", "#fff2a8", "#b08a20"],
  quartz: ["#e8eef2", "#ffffff", "#a8b4bc"], amethyst: ["#a86ee0", "#dcb8ff", "#6a3aa0"], emerald: ["#3cc070", "#a8f0c0", "#1f7a44"],
  ruby: ["#e0384f", "#ffa8b4", "#901c2c"], diamond: ["#bff0ff", "#ffffff", "#6ab8d0"], prismatic_shard: ["#ff7eb6", "#ffffff", "#7a5ae0"] };
const GEMS = new Set(["quartz", "amethyst", "emerald", "ruby", "diamond", "prismatic_shard"]);
function crystal(g, x, y, h, cols) {
  px(g, x, y + 2, 4, h - 2, cols[0]); px(g, x + 1, y, 2, 2, cols[0]); px(g, x, y + 2, 1, h - 2, cols[1]); dot(g, x + 1, y, cols[1]); px(g, x + 3, y + 2, 1, h - 2, cols[2]);
}
function oreSprite(kind, cave, v) {
  return cached("w:ore" + kind + (cave ? 1 : 0) + (v % 3), A, A, (g, c) => {
    const S = cave ? { deep: "#2f2a26", dark: "#4a423b", mid: "#655b52", light: "#82766a", hi: "#9c8f81" } : { deep: "#474a52", dark: "#666a70", mid: "#8b8e8c", light: "#b1b3ae", hi: "#d8d9d2" };
    const r = rng(9100 + (v % 3) * 7 + kind.length);
    ellipse(g, 16, 19, 12, 9, S.dark); ellipse(g, 15, 18, 11, 8, S.mid); ellipse(g, 13, 15, 7, 5, S.light); px(g, 10, 12, 5, 2, S.hi);
    ellipse(g, 19, 23, 8, 3, S.dark); px(g, 5, 25, 22, 1, S.deep);
    for (let i = 0; i < 6; i++) dot(g, ri(r, 7, 25), ri(r, 13, 25), S.deep);
    const col = ORE_COL[kind];
    if (col && GEMS.has(kind)) {
      if (kind === "prismatic_shard") { crystal(g, 11, 6, 13, ["#ff7eb6", WHITE, "#c050a0"]); crystal(g, 16, 4, 15, ["#7ec8ff", WHITE, "#4a7ad0"]); crystal(g, 21, 8, 11, ["#a8f07a", WHITE, "#5aa040"]); }
      else { crystal(g, 11, 8, 11, col); crystal(g, 16, 5, 14, col); crystal(g, 21, 10, 9, col); }
    } else if (col) {
      for (let i = 0; i < 7; i++) { const x = ri(r, 7, 23), y = ri(r, 12, 23); px(g, x, y, 2, 2, col[0]); dot(g, x, y, col[1]); dot(g, x + 1, y + 1, col[2]); }
    }
    outline(c, OUT);
  });
}

// =========================================================================== buildings
const PAL = {
  store: { roof: "#4a7a52", roofL: "#62935f", roofD: "#2f5236", roofX: "#86b47c", fascia: "#efe2c0", fasciaD: "#c4b28a", wall: "#e8d2a8", wallD: "#c9b083", wallL: "#f4e4c2", wallX: "#fff3da", wallDD: "#a68c62", trim: "#5a3a22" },
  saloon: { roof: "#5e4a40", roofL: "#7a6357", roofD: "#3c2d26", roofX: "#977d6f", fascia: "#d9b77e", fasciaD: "#a88650", wall: "#a8683f", wallD: "#8a5232", wallL: "#c07d50", wallX: "#d69a68", wallDD: "#6a3c22", trim: "#4a2c1a" },
  hall: { roof: "#4f5f7a", roofL: "#687a96", roofD: "#33405a", roofX: "#8a9cb8", fascia: "#f0e6d0", fasciaD: "#c8bca0", wall: "#b85a44", wallD: "#94442f", wallL: "#cd7058", wallX: "#e08f76", wallDD: "#6e2f22", trim: "#f0e6d0" },
  museum: { roof: "#5a5f66", roofL: "#747a82", roofD: "#3c4046", roofX: "#949aa2", fascia: "#efe9dc", fasciaD: "#c9c0ad", wall: "#d8d2c4", wallD: "#b8b0a0", wallL: "#e8e3d8", wallX: "#f6f2ea", wallDD: "#958c7c", trim: "#7a6f60" },
  clinic: { roof: "#3f8a86", roofL: "#58a8a2", roofD: "#285e5b", roofX: "#80c8c0", fascia: "#f6f2ea", fasciaD: "#cfc8b8", wall: "#f2efe6", wallD: "#d4cfc2", wallL: "#fbf9f3", wallX: "#ffffff", wallDD: "#aaa596", trim: "#5a6a70" },
  smith: { roof: "#4a4644", roofL: "#625e5a", roofD: "#2e2b29", roofX: "#7e7a75", fascia: "#a89a86", fasciaD: "#7a6e5e", wall: "#8f8c86", wallD: "#6c6964", wallL: "#b1aea7", wallX: "#c7c4bd", wallDD: "#54524e", trim: "#3a2a1a" },
  bakery: { roof: "#7a4a3a", roofL: "#94604c", roofD: "#55302a", roofX: "#b07a62", fascia: "#fff0e6", fasciaD: "#e0c8b8", wall: "#f2c4c8", wallD: "#dca4aa", wallL: "#f8d8da", wallX: "#fde8ea", wallDD: "#b8808a", trim: "#7a4a3a" },
  post: { roof: "#5a6070", roofL: "#737a8a", roofD: "#3c414e", roofX: "#9098a8", fascia: "#efe8d8", fasciaD: "#c8bea6", wall: "#7fa6cf", wallD: "#6189b3", wallL: "#9ab9db", wallX: "#b8cfe8", wallDD: "#456e98", trim: "#efe8d8" },
  carpenter: { roof: "#5f7a3a", roofL: "#78944f", roofD: "#3f5426", roofX: "#9ab46c", fascia: "#e6cf9e", fasciaD: "#b9a06a", wall: "#d0a468", wallD: "#b2864e", wallL: "#e0bb80", wallX: "#efd3a0", wallDD: "#8a6236", trim: "#6a4426" },
  cottage: { roof: "#a84c3c", roofL: "#c46450", roofD: "#743026", roofX: "#dc8a72", fascia: "#f4ead2", fasciaD: "#cfbe98", wall: "#f2d982", wallD: "#d8bc62", wallL: "#f8e8a8", wallX: "#fff4cc", wallDD: "#b0964a", trim: "#6a4a2a" },
  cottage2: { roof: "#4a6a9a", roofL: "#6284b4", roofD: "#30486e", roofX: "#86a6d0", fascia: "#f4ead2", fasciaD: "#cfbe98", wall: "#a8dcc0", wallD: "#86c0a2", wallL: "#c4ead6", wallX: "#e0f6ea", wallDD: "#5e9a7c", trim: "#4a5a4a" },
  cottage3: { roof: "#6a4a7a", roofL: "#846294", roofD: "#4a3058", roofX: "#a888b6", fascia: "#f4ead2", fasciaD: "#cfbe98", wall: "#e2d0ee", wallD: "#c6b0d6", wallL: "#efe2f6", wallX: "#faf4fd", wallDD: "#9a84ae", trim: "#5a4a6a" },
  fishshop: { roof: "#3f7a8a", roofL: "#5896a6", roofD: "#285460", roofX: "#80b8c6", fascia: "#efe6d4", fasciaD: "#c6baa0", wall: "#8aa4b0", wallD: "#6c8794", wallL: "#a6bec8", wallX: "#c4d6de", wallDD: "#4e6874", trim: "#3a4a52" },
  cabin: { roof: "#5e6a3a", roofL: "#78844e", roofD: "#3e4626", roofX: "#98a46a", fascia: "#d8b880", fasciaD: "#a88a52", wall: "#b8854f", wallD: "#9a6a3c", wallL: "#cc9a62", wallX: "#e2b47c", wallDD: "#6e4626", trim: "#5a3a22" },
  guild: { roof: "#7a3a3a", roofL: "#985050", roofD: "#522424", roofX: "#b87070", fascia: "#d8cfbe", fasciaD: "#aa9f8a", wall: "#8f8c86", wallD: "#6c6964", wallL: "#b1aea7", wallX: "#c7c4bd", wallDD: "#54524e", trim: "#3a2a1a" },
  stable: { roof: "#6f6b68", roofL: "#8c8885", roofD: "#4a4744", roofX: "#a9a5a0", fascia: "#e8dcc0", fasciaD: "#bfb090", wall: "#a8683f", wallD: "#8a5232", wallL: "#c07d50", wallX: "#d69a68", wallDD: "#6a3c22", trim: "#e8dcc0" },
};
// western false fronts: tall painted facades with a boardwalk porch
const WEST = {
  assay: { face: "#c9a66b", faceD: "#a8844a", faceL: "#dfc08a", sign: "#3a5a7a", text: "#f4e6c4", trim: "#6a4a2a", roof: "#7a5a3a" },
  wsaloon: { face: "#a8463a", faceD: "#86342a", faceL: "#c4604e", sign: "#2b1f17", text: "#f2c744", trim: "#f2dfae", roof: "#5e3a2a" },
  bank: { face: "#d8d0bc", faceD: "#b6ad96", faceL: "#ece6d6", sign: "#3a6a4a", text: "#f4e6c4", trim: "#5a5a5a", roof: "#4f5a62" },
  sheriff: { face: "#9a7a52", faceD: "#7a5c38", faceL: "#b4946a", sign: "#2b1f17", text: "#f4e6c4", trim: "#4a3220", roof: "#5e4a3a" },
};

function brickWall(g, x, y, w, h, c, seed) {
  const r = rng(seed);
  px(g, x, y, w, h, mixh(c.wallDD, c.wallD, 0.4));
  for (let yy = y, row = 0; yy < y + h; yy += 4, row++) {
    for (let xx = x - (row % 2 ? 4 : 0); xx < x + w; xx += 8) {
      const a = Math.max(x, xx), b = Math.min(x + w, xx + 7), t = r(), base = t < 0.25 ? c.wallD : t > 0.8 ? c.wallL : c.wall;
      if (b <= a) continue;
      px(g, a, yy, b - a, Math.min(3, y + h - yy), base); px(g, a, yy, b - a, 1, mixh(base, c.wallX, 0.45));
    }
  }
}
function stoneWall(g, x, y, w, h, c, seed) {
  /* dressed stone blocks (lighter than the farm's rubble footings) */
  const r = rng(seed);
  px(g, x, y, w, h, c.wallDD);
  for (let yy = y, row = 0; yy < y + h; yy += 8, row++) {
    for (let xx = x - (row % 2 ? 8 : 0); xx < x + w; xx += 16) {
      const a = Math.max(x, xx + 1), b = Math.min(x + w, xx + 15), t = r(), base = t < 0.25 ? c.wallD : t > 0.8 ? c.wallL : c.wall;
      if (b <= a) continue;
      const hh = Math.min(7, y + h - yy - 1);
      if (hh <= 0) continue;
      px(g, a, yy + 1, b - a, hh, base); px(g, a, yy + 1, b - a, 1, mixh(base, c.wallX, 0.55)); px(g, a, yy + 1, 1, hh, mixh(base, c.wallX, 0.3));
      px(g, b - 1, yy + 2, 1, hh - 1, mixh(base, c.wallDD, 0.45));
      if (r() < 0.3) dot(g, a + ri(r, 2, Math.max(2, b - a - 3)), yy + ri(r, 2, 5), mixh(base, c.wallDD, 0.3));
    }
  }
}
function plasterWall(g, x, y, w, h, c, seed) {
  const r = rng(seed);
  px(g, x, y, w, h, c.wall);
  for (let i = 0; i < w * h / 40; i++) dot(g, x + ri(r, 0, w - 1), y + ri(r, 0, h - 1), r() < 0.5 ? c.wallL : c.wallD);
  for (let i = 0; i < 4; i++) { const xx = x + ri(r, 4, w - 12), yy = y + ri(r, 4, h - 8); px(g, xx, yy, ri(r, 4, 9), 1, mixh(c.wall, c.wallD, 0.5)); }
  px(g, x, y + h - 5, w, 5, mixh(c.wall, c.wallD, 0.4)); px(g, x, y + h - 5, w, 1, c.wallL);
}
function stripedAwning(g, x, y, w, colA, colB) {
  const SD = [mixh(colA, "#000000", 0.25), mixh(colB, "#000000", 0.18)], SL = [mixh(colA, WHITE, 0.3), mixh(colB, WHITE, 0.4)], S = [colA, colB];
  px(g, x - 1, y - 2, w + 2, 2, mixh(colA, "#000000", 0.5));
  for (let i = 0, xx = x; xx < x + w; i++, xx += 8) {
    const k = i % 2, sw = Math.min(8, x + w - xx);
    px(g, xx, y, sw, 10, S[k]); px(g, xx, y, sw, 1, SL[k]); px(g, xx, y + 8, sw, 2, SD[k]);
    if (sw === 8) { px(g, xx + 1, y + 10, 6, 1, S[k]); px(g, xx + 2, y + 11, 4, 1, SD[k]); }
    px(g, xx + sw - 1, y, 1, 10, SD[k]);
  }
}
function hangingSign(g, x, y, label, bg, fg) {
  /* an iron bracket out from the wall with a painted board hanging on two chains */
  const w = textWidth(label, 1) + 8;
  px(g, x, y, w + 4, 2, IRON.dark); px(g, x, y, 2, 5, IRON.dark);
  px(g, x + 3, y + 2, 1, 3, IRON.base); px(g, x + w, y + 2, 1, 3, IRON.base);
  px(g, x + 1, y + 5, w + 2, 11, OUT); px(g, x + 2, y + 6, w, 9, bg); px(g, x + 2, y + 6, w, 1, mixh(bg, WHITE, 0.35));
  text3x5(g, x + 6, y + 8, label, fg, 1);
}
function arched(g, x, y, w, h, night, frame, frameD) {
  BH.frameWindow(g, x, y + 4, w, h - 4, night, frame, frameD);
  for (let i = 0; i < 4; i++) { const hw = Math.round(Math.sqrt(16 - (4 - i) * (4 - i)) * w / 8); px(g, x + Math.floor(w / 2) - hw, y + i, hw * 2, 1, frame); }
  BH.glass(g, x + Math.floor(w / 2) - 3, y + 2, 6, 3, night);
}
function bricksBand(g, x, y, w, c) { px(g, x, y, w, 3, c.trim); px(g, x, y, w, 1, mixh(c.trim, WHITE, 0.3)); px(g, x, y + 2, w, 1, mixh(c.trim, "#000000", 0.3)); }

/* the layout every town building shares: roof rows on top, windows on the tiles either side of the middle door */
function layout(kind, w, h) {
  const roofRows = kind === "hall" ? 3 : kind === "lighthouse" ? 0 : h >= 8 ? 3 : 2;
  const mid = Math.floor(w / 2);
  let cols = [];
  for (let t = 1; t < w - 1; t++) if (t !== mid && !(w >= 9 && Math.abs(t - mid) === 1)) cols.push(t);
  if (w >= 12) cols = cols.filter((t) => t % 2 === 1 && Math.abs(t - mid) >= 2);
  if (cols.length > 4) cols = [cols[0], cols[1], cols[cols.length - 2], cols[cols.length - 1]];
  const wallTop = ART.TOPPAD + roofRows * A, wh = h * A + ART.TOPPAD - 8 - wallTop;
  return { roofRows, mid, cols, stories: wh >= 110 ? 2 : 1, wh };
}
function townBuilding(g, kind, W, H, w, h, night, label, seed) {
  const c = PAL[kind] || PAL.cottage, L = layout(kind, w, h), OVX = ART.OV, TOP = ART.TOPPAD;
  const wallX = OVX, wallW = w * A, wallTop = TOP + L.roofRows * A, found = 8, wallBot = H - found, wh = wallBot - wallTop, cx = Math.floor(W / 2);
  const wall = { store: "clap", saloon: "board", hall: "brick", museum: "stone", clinic: "clap", smith: "stone", bakery: "plaster", post: "clap",
    carpenter: "log", cottage: "clap", cottage2: "clap", cottage3: "plaster", fishshop: "board", cabin: "log", guild: "stone", stable: "board" }[kind] || "clap";
  const civic = kind === "hall" || kind === "museum";
  // 1. the roof (everything that sits on it is drawn afterwards)
  const rTop = 10, rBot = wallTop - 2, ins = civic ? 12 : 16, inset = (t) => Math.round(ins * (1 - t));
  BH.roofFace(g, c, 1, W - 1, rTop, rBot, inset, seed + 3, /cabin|guild|stable|smith/.test(kind) ? { moss: "#6d8544" } : (civic ? { rowH: 5, shingle: 12 } : undefined));
  BH.roofEdges(g, c, 1, W - 1, rTop, rBot, inset);
  BH.ridgeCap(g, c, 1 + ins, W - 1 - ins, rTop - 4);
  // 2. walls on a stone footing
  if (wall === "clap") BH.clapboard(g, wallX, wallTop, wallW, wh, c, seed + 1);
  else if (wall === "board") BH.boardWall(g, wallX, wallTop, wallW, wh, c, seed + 1);
  else if (wall === "log") BH.logWall(g, wallX, wallTop, wallW, wh, c, seed + 1);
  else if (wall === "brick") brickWall(g, wallX, wallTop, wallW, wh, c, seed + 1);
  else if (wall === "stone") stoneWall(g, wallX, wallTop, wallW, wh, c, seed + 1);
  else plasterWall(g, wallX, wallTop, wallW, wh, c, seed + 1);
  BH.stones(g, wallX, wallBot, wallW, found, seed + 2);
  BH.eaveShadow(g, wallX, wallTop + 3, wallW, c);
  if (wall === "log") { BH.logEnds(g, wallX - 2, wallTop, wh, c); BH.logEnds(g, wallX + wallW - 5, wallTop, wh, c); }
  else [wallX, wallX + wallW - 5].forEach((x) => { px(g, x, wallTop + 3, 5, wh - 3, c.trim); px(g, x, wallTop + 3, 1, wh - 3, mixh(c.trim, WHITE, 0.25)); px(g, x + 4, wallTop + 3, 1, wh - 3, mixh(c.trim, "#000000", 0.3)); });
  if (L.stories === 2) bricksBand(g, wallX, wallTop + Math.floor(wh / 2) - 4, wallW, { trim: wall === "brick" || wall === "stone" ? c.fascia : c.trim });
  BH.eaveBoard(g, c, 1, W - 1, rBot);
  // 3. windows: one per window column on each storey
  const brickish = wall === "brick" || wall === "stone", frame = brickish ? c.fascia : "#f4e6c4", frameD = brickish ? c.fasciaD : "#c8b68e";
  const storeyY = L.stories === 2 ? [wallTop + 12, wallTop + Math.floor(wh / 2) + 6] : [wallTop + 14];
  storeyY.forEach((wy, s) => {
    const ground = s === storeyY.length - 1;
    L.cols.forEach((t, n) => {
      const x = wallX + t * A + 5, ww = 22, whh = ground && L.stories === 2 ? 26 : 22;
      if (civic) arched(g, x, wy - 4, ww, whh + 6, night, frame, frameD);
      else if (ground && (kind === "bakery" || kind === "store")) { BH.frameWindow(g, x - 3, wy, ww + 6, whh, night, frame, frameD); if (kind === "bakery") bread(g, x - 1, wy + whh - 4, ww + 2); else BH.veg(g, x + 4, wy + whh - 3, ["pumpkin", "melon", "turnip", "tomato"][n % 4]); }
      else BH.frameWindow(g, x, wy, ww, whh, night, frame, frameD);
      if (/cottage|cabin/.test(kind)) { BH.shutter(g, x - 5, wy + 1, whh - 2); BH.shutter(g, x + ww, wy + 1, whh - 2); }
      BH.sill(g, x, wy + whh, ww, c.trim, mixc(c.trim, "#000000", 0.35));
      if (/cottage|bakery|clinic|post|store|hall/.test(kind) && (!ground || L.stories === 1)) BH.flowerBox(g, x, wy + whh + 5, ww, seed + 10 + n + s * 5);
    });
  });
  // 4. the door: a pair for the big buildings, a portico of columns for the civic ones
  const wide = /hall|museum|store|saloon|smith|carpenter|guild|stable/.test(kind), doorW = wide ? 26 : 22;
  const doorX = wallX + L.mid * A + Math.floor((A - doorW) / 2), doorH = Math.min(34, wh - 8), doorY = wallBot - doorH;
  if (kind === "stable") barnDoors(g, doorX - 6, doorY - 4, doorW + 12, doorH + 4, c);
  else BH.panelDoor(g, doorX, doorY, doorW, doorH, c, night, { winH: doorW > 22 ? 12 : 9 });
  if (kind === "saloon") swingDoors(g, doorX + 2, doorY + 8, doorW - 4);
  if (civic) portico(g, c, doorX + Math.floor(doorW / 2), doorY - 16, wallBot, doorW + 36);
  const awn = { store: ["#3f8a4a", "#f7efdc"], bakery: ["#f07aa0", "#fff4f6"], fishshop: ["#3a7bd5", "#f7efdc"], saloon: ["#7a2f27", "#e9d29c"] }[kind];
  if (awn) stripedAwning(g, wallX + 8, doorY - 15, wallW - 16, awn[0], awn[1]);
  else if (!civic && kind !== "stable") BH.doorHood(g, c, doorX - 9, doorY - 11, doorW + 18);
  const signRight = /saloon|smith/.test(kind);
  BH.lantern(g, signRight ? doorX - 14 : doorX + doorW + 4, doorY + 4, night);
  // 5. signs and roof furniture
  if (label && /clinic|post|guild|cabin/.test(kind)) BH.plaque(g, cx, wallTop + (L.stories === 2 ? Math.floor(wh / 2) - 14 : 4), label, 1);
  if (label && kind === "hall") BH.plaque(g, cx, wallTop + 6, label, 2);
  if (label && /store|bakery|carpenter|fishshop/.test(kind)) roofSign(g, cx, rBot - 34, label, kind === "bakery" ? "#f07aa0" : kind === "fishshop" ? "#3a7bd5" : kind === "store" ? "#3f8a4a" : "#6a4426");
  if (label && signRight) hangingSign(g, doorX + doorW + 4, doorY - 6, label, kind === "smith" ? "#3a3a40" : "#5a2a1e", kind === "smith" ? "#f2a33a" : "#f2c744");
  if (label === "MUSEUM") BH.plaque(g, cx, doorY - 30, label, 1);
  if (kind === "clinic") { const y = rBot - 40; px(g, cx - 6, y, 12, 28, OUT); px(g, cx - 14, y + 8, 28, 12, OUT); px(g, cx - 5, y + 1, 10, 26, "#e0524f"); px(g, cx - 13, y + 9, 26, 10, "#e0524f"); px(g, cx - 4, y + 2, 3, 24, "#f07a72"); }
  if (/cottage|clinic|post/.test(kind)) BH.gableDormer(g, c, cx + (kind === "clinic" ? -48 : 0), 30, night);
  if (/saloon|carpenter|smith|guild|stable/.test(kind) || (civic && w >= 10)) [cx - Math.floor(wallW / 4), cx + Math.floor(wallW / 4)].forEach((dx) => BH.gableDormer(g, c, dx, 30, night));
  if (kind === "hall") clockTower(g, c, cx, 0, night);
  if (/cottage|cabin|bakery|carpenter/.test(kind)) { const chx = wallX + wallW - 54; px(g, chx - 1, 40, 16, 2, c.roofD); BH.stoneChimney(g, chx, 0, 40, seed + 4); }
  if (kind === "smith") { const chx = wallX + 20; px(g, chx - 1, 40, 16, 2, c.roofD); BH.stoneChimney(g, chx, 0, 40, seed + 4); }
  if (/store|fishshop|saloon|guild/.test(kind)) BH.stovePipe(g, c, W - 50, 3, 36);
  if (kind === "stable") BH.weatherVane(g, cx, 0);
  // 6. a little yard clutter so they look lived in
  if (kind === "smith") { anvil(g, wallX + wallW - 44, H - 3); BH.rainBarrel(g, wallX + 10, H - 20); }
  if (kind === "carpenter") { BH.logStack(g, wallX + 8, H - 1, 30, 18, seed + 6); BH.logStack(g, wallX + wallW - 40, H - 1, 26, 13, seed + 7); }
  if (kind === "store") { BH.crate(g, wallX + 8, H - 12, 24, 12, "pumpkin"); BH.crate(g, wallX + 11, H - 21, 20, 9, "turnip"); BH.sack(g, wallX + wallW - 36, H - 1, ITEM_HEX.corn); BH.sack(g, wallX + wallW - 22, H - 1, ITEM_HEX.tomato); }
  if (kind === "fishshop") { net(g, wallX + 8, wallTop + 10, 30, 26); barrelFish(g, wallX + wallW - 26, H - 2); }
  if (kind === "bakery") BH.chalkboard(g, doorX + doorW + 14, wallBot - 16, 22, 16, "PIE");
  if (/cottage/.test(kind)) { BH.pottedPlant(g, doorX - 14, wallBot); BH.rainBarrel(g, wallX + wallW - 22, H - 20); }
  if (kind === "cabin") { BH.logStack(g, wallX + 6, H - 1, 26, 15, seed + 6); antlers(g, cx - 8, doorY - 24); }
  if (kind === "guild") { banner(g, wallX + 14, wallTop + 10); banner(g, wallX + wallW - 26, wallTop + 10); }
  if (kind === "post") postBox(g, wallX + wallW - 24, H - 2);
  if (kind === "stable") { BH.roundBale(g, wallX + 18, H - 10, 9); BH.roundBale(g, wallX + wallW - 20, H - 9, 8); }
  if (kind === "saloon") { BH.rainBarrel(g, wallX + 8, H - 20); BH.rainBarrel(g, wallX + 24, H - 20); }
}
function portico(g, c, cx, top, bot, w) {
  /* two fluted columns carrying a beam and a little triangular pediment over the door */
  const half = Math.floor(w / 2);
  [cx - half, cx + half - 8].forEach((x) => { px(g, x, top + 12, 8, bot - top - 12, c.wallL); px(g, x, top + 12, 2, bot - top - 12, c.wallX); px(g, x + 6, top + 12, 2, bot - top - 12, c.wallD); for (let yy = top + 16; yy < bot - 4; yy += 3) dot(g, x + 4, yy, c.wallD); px(g, x - 2, bot - 4, 12, 4, c.wallD); px(g, x - 2, bot - 4, 12, 1, c.wallX); });
  px(g, cx - half - 4, top + 6, w + 8, 6, c.wallL); px(g, cx - half - 4, top + 6, w + 8, 1, c.wallX); px(g, cx - half - 4, top + 11, w + 8, 1, c.wallD);
  for (let i = 0; i < 12; i++) { const hw = Math.round((half + 4) * i / 12); px(g, cx - hw, top - 6 + i, hw * 2 + 1, 1, i < 1 ? c.wallX : c.wallL); dot(g, cx + hw, top - 6 + i, c.wallD); dot(g, cx - hw, top - 6 + i, c.wallX); }
  px(g, cx - 3, top, 6, 4, c.wallD);
}
function roofSign(g, cx, y, label, band) {
  const tw = textWidth(label, 2), bw = tw + 18, bx = cx - Math.floor(bw / 2);
  [bx + 3, bx + bw - 6].forEach((x) => { px(g, x, y - 4, 3, 30, WOOD.dark); px(g, x, y - 4, 1, 30, WOOD.mid); });
  px(g, bx - 1, y - 1, bw + 2, 22, OUT); px(g, bx, y, bw, 20, "#f2e3bf"); px(g, bx, y, bw, 1, "#fff6dc"); px(g, bx, y + 19, bw, 1, "#c9b283"); px(g, bx + bw - 1, y, 1, 20, "#c9b283");
  px(g, bx, y + 2, bw, 2, band); px(g, bx, y + 16, bw, 2, band);
  text3x5(g, bx + 9, y + 5, label, "#3a2a1a", 2);
}
function clockTower(g, c, cx, y, night) {
  /* a square brick tower on the ridge with a big clock face, a pyramid cap and a little flag */
  const tw = 40, top = y + 18, bot = y + 74;
  brickWall(g, cx - tw / 2, top, tw, bot - top, c, 77); px(g, cx - tw / 2, top, 2, bot - top, c.wallL); px(g, cx + tw / 2 - 3, top, 3, bot - top, c.wallDD);
  px(g, cx - tw / 2 - 2, top - 2, tw + 4, 4, c.fascia); px(g, cx - tw / 2 - 2, top - 2, tw + 4, 1, WHITE);
  disc(g, cx, top + 20, 12, OUT); disc(g, cx, top + 20, 11, c.fasciaD); disc(g, cx, top + 20, 10, "#fbf6e8");
  for (let k = 0; k < 12; k++) dot(g, cx + Math.round(Math.cos(k * 0.5236) * 8), top + 20 + Math.round(Math.sin(k * 0.5236) * 8), "#5a4a3a");
  px(g, cx, top + 13, 1, 8, OUT); px(g, cx, top + 20, 6, 1, OUT); dot(g, cx, top + 20, "#d9463c");
  for (let i = 0; i < 16; i++) { const hw = Math.round((tw / 2 + 4) * i / 16); px(g, cx - hw, top - 18 + i, hw * 2 + 1, 1, i < 2 ? c.roofX : c.roof); dot(g, cx + hw, top - 18 + i, c.roofD); dot(g, cx - hw, top - 18 + i, c.roofL); }
  px(g, cx, y - 2, 1, 6, IRON.dark); px(g, cx + 1, y - 2, 6, 3, "#e0524f");
  if (night) px(g, cx - 8, bot - 14, 16, 8, "#ffd27a");
}
function swingDoors(g, x, y, w) {
  const half = Math.floor(w / 2) - 1;
  [x, x + half + 2].forEach((xx) => { px(g, xx, y, half, 14, WOOD.light); px(g, xx, y, half, 2, "#e8c48a"); for (let i = 2; i < half; i += 3) px(g, xx + i, y + 3, 1, 10, WOOD.dark); px(g, xx, y + 13, half, 1, WOOD.deep); });
}
function barnDoors(g, x, y, w, h, c) {
  px(g, x, y, w, h, c.trim); px(g, x + 2, y + 2, w - 4, h - 2, c.wallD);
  const half = Math.floor((w - 4) / 2);
  for (let i = 0; i < h - 4; i++) { const t = Math.round(i * (half - 4) / (h - 4)); px(g, x + 2 + t, y + 2 + i, 2, 1, c.trim); px(g, x + 2 + half - 4 - t, y + 2 + i, 2, 1, c.trim); px(g, x + 2 + half + t, y + 2 + i, 2, 1, c.trim); px(g, x + w - 4 - t, y + 2 + i, 2, 1, c.trim); }
  px(g, x + 1 + half, y + 2, 2, h - 2, OUT);
}
function bread(g, x, y, w) {
  for (let i = 0, xx = x + 1; xx < x + w - 6; i++, xx += 7) { ellipse(g, xx + 3, y + 1, 3, 2, i % 2 ? "#c98a4a" : "#e0a860"); px(g, xx + 1, y, 4, 1, "#f2c888"); }
}
function anvil(g, x, y) { px(g, x, y - 12, 18, 4, IRON.base); px(g, x - 3, y - 12, 4, 2, IRON.base); px(g, x, y - 12, 18, 1, IRON.light); px(g, x + 5, y - 8, 8, 5, IRON.dark); px(g, x + 2, y - 3, 14, 3, IRON.base); px(g, x + 2, y - 3, 14, 1, IRON.light); }
function net(g, x, y, w, h) { for (let i = 0; i <= w; i += 5) px(g, x + i, y, 1, h, "#d8cfb2"); for (let j = 0; j <= h; j += 5) px(g, x, y + j, w, 1, "#d8cfb2"); px(g, x + 8, y + 9, 6, 3, "#5fa8e0"); px(g, x + 14, y + 10, 2, 1, "#3f7fb8"); px(g, x + 18, y + 16, 5, 3, "#e0a050"); }
function barrelFish(g, x, y) { px(g, x, y - 16, 16, 16, WOOD.mid); px(g, x, y - 16, 16, 2, WOOD.light); px(g, x, y - 10, 16, 2, IRON.base); px(g, x + 3, y - 20, 4, 4, "#5fa8e0"); px(g, x + 8, y - 21, 5, 5, "#a8b8c8"); dot(g, x + 4, y - 19, WHITE); }
function antlers(g, x, y) { px(g, x + 6, y + 6, 4, 4, WOOD.dark); px(g, x + 2, y, 2, 7, "#e8dcc0"); px(g, x + 12, y, 2, 7, "#e8dcc0"); px(g, x, y + 2, 2, 2, "#e8dcc0"); px(g, x + 14, y + 2, 2, 2, "#e8dcc0"); px(g, x + 3, y + 6, 10, 2, "#e8dcc0"); }
function banner(g, x, y) { px(g, x, y, 12, 22, "#7a2a2a"); px(g, x, y, 12, 2, "#a84040"); px(g, x + 1, y + 22, 4, 3, "#7a2a2a"); px(g, x + 7, y + 22, 4, 3, "#7a2a2a"); px(g, x + 5, y + 5, 2, 12, "#e8dcc0"); px(g, x + 2, y + 8, 8, 2, "#e8dcc0"); px(g, x - 1, y - 1, 14, 2, WOOD.dark); }
function postBox(g, x, y) { px(g, x + 2, y - 4, 4, 4, IRON.dark); px(g, x, y - 18, 14, 14, "#d9463c"); px(g, x, y - 18, 14, 2, "#f07a72"); px(g, x + 3, y - 13, 8, 2, OUT); px(g, x + 12, y - 16, 2, 12, "#a9342c"); }

function falseFront(g, kind, W, H, w, h, night, label, seed) {
  /* a frontier storefront: a tall square facade with a painted sign hiding a gabled hall, a shingled porch roof on stout posts
     over a boardwalk, a hitching rail out front; the saloon gets a balcony */
  const c = WEST[kind] || WEST.assay, OVX = ART.OV, TOP = ART.TOPPAD;
  const fx = OVX, fw = w * A, faceTop = TOP + 8, baseY = H - 7, cx = Math.floor(W / 2);
  const P = { wall: c.face, wallD: c.faceD, wallL: c.faceL, wallDD: mixh(c.faceD, "#000000", 0.35), wallX: mixh(c.faceL, WHITE, 0.3) };
  const roofC = { roof: c.roof, roofL: mixh(c.roof, WHITE, 0.2), roofD: mixh(c.roof, "#000000", 0.35), roofX: mixh(c.roof, WHITE, 0.35), fascia: c.trim, fasciaD: mixh(c.trim, "#000000", 0.3) };
  BH.roofFace(g, roofC, 2, W - 2, faceTop + 6, faceTop + 40, (t) => Math.round(6 * (1 - t)), seed + 3);            // the hall roof peeking out at the sides
  const stepped = kind === "wsaloon" || kind === "bank";
  if (stepped) { BH.boardWall(g, cx - 34, faceTop - 12, 68, 12, P, seed + 7); BH.boardWall(g, cx - 20, faceTop - 22, 40, 10, P, seed + 8); px(g, cx - 36, faceTop - 14, 72, 3, c.trim); px(g, cx - 22, faceTop - 24, 44, 3, c.trim); }
  BH.boardWall(g, fx, faceTop, fw, baseY - faceTop, P, seed + 1);
  px(g, fx - 3, faceTop - 3, fw + 6, 4, c.trim); px(g, fx - 3, faceTop - 3, fw + 6, 1, mixh(c.trim, WHITE, 0.4)); px(g, fx - 3, faceTop, fw + 6, 1, mixh(c.trim, "#000000", 0.4));
  [fx, fx + fw - 5].forEach((x) => { px(g, x, faceTop, 5, baseY - faceTop, c.trim); px(g, x, faceTop, 1, baseY - faceTop, mixh(c.trim, WHITE, 0.3)); });
  // the painted sign
  const tw = textWidth(label || "", 2), sw = Math.min(fw - 14, tw + 22), sx = cx - Math.floor(sw / 2), sy = faceTop + 6;
  px(g, sx - 1, sy - 1, sw + 2, 22, OUT); px(g, sx, sy, sw, 20, c.sign); px(g, sx, sy, sw, 1, mixh(c.sign, WHITE, 0.3)); px(g, sx + 2, sy + 2, sw - 4, 1, c.text); px(g, sx + 2, sy + 17, sw - 4, 1, c.text);
  if (label) text3x5(g, cx - Math.floor(tw / 2), sy + 5, label, c.text, 2);
  // upper storey windows (a balcony with a rail on the saloon)
  const upY = sy + 28;
  [fx + 12, fx + fw - 36].forEach((x) => { BH.frameWindow(g, x, upY, 24, 22, night, c.trim, mixh(c.trim, "#000000", 0.3)); BH.sill(g, x, upY + 22, 24, c.trim, mixh(c.trim, "#000000", 0.35)); });
  const porchY = upY + 30;
  if (kind === "wsaloon") { px(g, fx - 4, porchY - 12, fw + 8, 2, WOOD.light); for (let x = fx - 2; x < fx + fw + 4; x += 5) px(g, x, porchY - 10, 2, 10, WOOD.mid); }
  // porch roof on posts, deep shade underneath
  BH.roofFace(g, roofC, fx - 8, fx + fw + 8, porchY, porchY + 12, () => 0, seed + 4, { rowH: 4, shingle: 8 });
  px(g, fx - 8, porchY + 12, fw + 16, 3, c.trim); px(g, fx - 8, porchY + 12, fw + 16, 1, mixh(c.trim, WHITE, 0.4)); px(g, fx - 8, porchY + 14, fw + 16, 1, mixh(c.trim, "#000000", 0.4));
  px(g, fx, porchY + 15, fw, 5, mixh(c.face, "#000000", 0.45)); px(g, fx, porchY + 20, fw, 2, mixh(c.face, "#000000", 0.25));
  const mid = Math.floor(w / 2), doorX = fx + mid * A + 3, doorY = baseY - 32;
  [fx + 8, fx + fw - 40].forEach((x) => BH.frameWindow(g, x, doorY + 4, 32, 20, night, c.trim, mixh(c.trim, "#000000", 0.3)));
  BH.panelDoor(g, doorX, doorY, 26, 32, { trim: c.trim }, night, { noStep: true, winH: 11 });
  if (kind === "wsaloon") swingDoors(g, doorX + 2, doorY + 12, 22);
  for (const x of [fx - 6, fx + Math.floor(fw / 3), fx + Math.floor(2 * fw / 3) - 4, fx + fw + 1]) { px(g, x, porchY + 15, 5, baseY - porchY - 15, WOOD.mid); px(g, x, porchY + 15, 1, baseY - porchY - 15, WOOD.light); px(g, x + 4, porchY + 15, 1, baseY - porchY - 15, WOOD.dark); }
  // boardwalk and a hitching rail
  BH.deckBoards(g, fx - 8, baseY, fw + 16, 7, baseY, seed + 5); px(g, fx - 8, H - 1, fw + 16, 1, OUT);
  if (kind === "sheriff") { px(g, cx - 9, faceTop - 12, 18, 11, "#f2c744"); px(g, cx - 4, faceTop - 15, 8, 3, "#f2c744"); px(g, cx - 3, faceTop - 8, 6, 4, "#b08a20"); }
  if (kind === "bank") { px(g, doorX - 10, doorY - 6, 46, 3, "#c9a640"); px(g, doorX - 10, doorY - 6, 46, 1, "#f2dc8a"); }
  if (kind === "assay") { BH.sack(g, fx + fw - 20, H - 8, "#c9a640"); BH.crate(g, fx + 2, H - 19, 18, 12, "potato"); }
  if (kind === "wsaloon") { BH.lantern(g, fx + 2, porchY + 18, night); BH.lantern(g, fx + fw - 12, porchY + 18, night); BH.rainBarrel(g, fx + fw - 22, H - 27); }
  if (kind !== "assay") { px(g, fx + 4, H - 16, 26, 2, WOOD.mid); px(g, fx + 4, H - 16, 26, 1, WOOD.light); px(g, fx + 5, H - 14, 3, 7, WOOD.dark); px(g, fx + 26, H - 14, 3, 7, WOOD.dark); }
}
function lighthouse(g, W, H, w, h, night, seed) {
  /* a white tower with red bands on a stone base, a glazed lantern room with a gallery rail, a keeper's door */
  const cx = Math.floor(W / 2), base = H - 8, top = 34, r = rng(seed);
  BH.stones(g, cx - 34, base - 14, 68, 22, seed + 2);
  for (let y = top + 26; y < base - 14; y++) {
    const t = (y - top) / (base - top), hw = Math.round(16 + 12 * t), band = Math.floor((y - top) / 18) % 2;
    const col = band ? "#d9463c" : "#f4f1ea", colL = band ? "#ea6a5c" : WHITE, colD = band ? "#a9342c" : "#d2cdc2";
    px(g, cx - hw, y, hw * 2, 1, col); px(g, cx - hw, y, 4, 1, colL); px(g, cx + hw - 6, y, 6, 1, colD);
  }
  px(g, cx - 22, top + 18, 44, 8, "#3a3a40"); px(g, cx - 22, top + 18, 44, 2, "#5a5a62");
  for (let x = cx - 22; x <= cx + 22; x += 5) px(g, x, top + 12, 1, 7, "#3a3a40"); px(g, cx - 22, top + 12, 45, 1, "#3a3a40");
  px(g, cx - 13, top, 26, 14, night ? "#ffe9a8" : "#bfe6f7"); px(g, cx - 13, top, 26, 2, night ? "#fff7dc" : "#e6f6fd");
  for (let x = cx - 13; x <= cx + 13; x += 6) px(g, x, top, 1, 14, "#3a3a40");
  if (night) { px(g, cx - 6, top + 3, 12, 8, "#fff4c8"); }
  for (let i = 0; i < 10; i++) { const half = Math.round(16 * (10 - i) / 10); px(g, cx - half, top - 2 - i, half * 2, 1, i < 2 ? "#a9342c" : "#d9463c"); dot(g, cx - half, top - 2 - i, "#ea6a5c"); }
  px(g, cx - 1, top - 16, 2, 5, "#3a3a40");
  [[cx - 4, top + 70], [cx - 4, top + 120]].forEach(([x, y]) => { if (y < base - 30) BH.frameWindow(g, x, y, 10, 14, night); });
  BH.panelDoor(g, cx - 11, base - 30, 22, 30, { trim: "#5a3a22" }, night, { noStep: false });
}
function mineMouth(g, W, H, w, h, night, seed, season) {
  /* a timber-framed tunnel cut into the very cliff tiles the map draws around it: dark opening, rails running in, a lantern */
  const ox = ART.OV, oy0 = ART.TOPPAD;
  for (let ty = -1; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const part = ty >= h - 1 ? "face" : ty === h - 2 ? "lip" : "top";
    g.drawImage(cliffTile("mountain", part, hash(tx + 3, ty + 9), season || "summer"), ox + tx * A, oy0 + ty * A);
  }
  const cx = Math.floor(W / 2), ow = 56, oy = H - 64;
  ellipse(g, cx, oy + 6, ow / 2 + 2, 10, "#140f0c"); px(g, cx - ow / 2, oy + 6, ow, 58, "#140f0c"); px(g, cx - ow / 2 + 5, oy + 10, ow - 10, 54, "#0a0806");
  for (let y = H - 26; y < H; y += 6) px(g, cx - 18, y, 36, 2, WOOD.dark);
  px(g, cx - 14, H - 30, 2, 30, IRON.light); px(g, cx + 12, H - 30, 2, 30, IRON.light);
  px(g, cx - ow / 2 - 6, oy - 4, ow + 12, 10, WOOD.mid); px(g, cx - ow / 2 - 6, oy - 4, ow + 12, 2, WOOD.light); px(g, cx - ow / 2 - 6, oy + 5, ow + 12, 1, WOOD.deep);
  for (let x = cx - ow / 2; x < cx + ow / 2; x += 9) dot(g, x, oy, WOOD.deep);
  [cx - ow / 2 - 6, cx + ow / 2 - 2].forEach((x) => { px(g, x, oy + 6, 8, H - oy - 6, WOOD.mid); px(g, x, oy + 6, 2, H - oy - 6, WOOD.light); px(g, x + 6, oy + 6, 2, H - oy - 6, WOOD.dark); });
  BH.lantern(g, cx + ow / 2 + 4, oy + 10, true);
  const lw = textWidth("MINE", 2) + 12; px(g, cx - lw / 2 - 1, oy - 22, lw + 2, 16, OUT); px(g, cx - lw / 2, oy - 21, lw, 14, "#c9a66b"); px(g, cx - lw / 2, oy - 21, lw, 1, "#e8cf9a"); text3x5(g, cx - lw / 2 + 6, oy - 18, "MINE", "#3a2a1a", 2);
  px(g, cx - 36, H - 16, 14, 12, "#7a5432"); px(g, cx - 36, H - 16, 14, 2, "#a5744a"); px(g, cx - 34, H - 20, 10, 4, "#6c6964"); px(g, cx - 33, H - 20, 4, 1, "#9c9890");
  BH.wagonWheel(g, cx - 34, H - 3, 3); BH.wagonWheel(g, cx - 25, H - 3, 3);
}
function tikiHut(g, W, H, w, h, night, seed) {
  /* bamboo walls on stilts under a shaggy thatched roof, a carved sign and torches */
  const r = rng(seed), wallTop = ART.TOPPAD + 2 * A, base = H - 6, wallX = ART.OV, wallW = w * A;
  for (let x = wallX; x < wallX + wallW; x += 5) { px(g, x, wallTop, 5, base - wallTop, "#c9a050"); px(g, x, wallTop, 1, base - wallTop, "#e8c470"); px(g, x + 4, wallTop, 1, base - wallTop, "#8a6a2a"); for (let y = wallTop + 8; y < base; y += 12) px(g, x, y, 5, 1, "#8a6a2a"); }
  px(g, wallX, base, wallW, 6, "#8a6a2a"); for (let x = wallX + 4; x < wallX + wallW; x += 20) px(g, x, base, 4, 6, "#6a4a1a");
  const mid = Math.floor(w / 2), dx = wallX + mid * A + 4;
  px(g, dx, base - 30, 24, 30, "#3a2614"); for (let i = 0; i < 6; i++) px(g, dx + 1, base - 30 + i * 5, 22, 3, i % 2 ? "#e0524f" : "#f2c744");
  BH.frameWindow(g, wallX + 12, wallTop + 14, 20, 16, night, "#8a6a2a", "#5a3a12"); BH.frameWindow(g, wallX + wallW - 32, wallTop + 14, 20, 16, night, "#8a6a2a", "#5a3a12");
  for (let y = 8; y < wallTop + 6; y++) {
    const t = (y - 8) / (wallTop - 2), hw = Math.round(12 + (W / 2 + 2) * t);
    for (let x = Math.floor(W / 2) - hw; x < Math.floor(W / 2) + hw; x++) { if (x < 0 || x >= W) continue; const k = hash(x, y >> 1) % 9; px(g, x, y, 1, 1, k < 2 ? "#a8843a" : k < 6 ? "#d2ae5a" : "#e8c878"); }
  }
  for (let x = 0; x < W; x += 3) px(g, x, wallTop + 4 + (hash(x, 3) % 4), 2, 3, "#a8843a");
  const lw = textWidth("TIKI", 1) + 8; px(g, Math.floor(W / 2) - lw / 2, wallTop + 2, lw, 9, "#6a4a1a"); text3x5(g, Math.floor(W / 2) - lw / 2 + 4, wallTop + 4, "TIKI", "#f2c744", 1);
  [wallX - 6, wallX + wallW + 2].forEach((x) => { px(g, x, base - 34, 3, 34, "#6a4a1a"); px(g, x - 2, base - 40, 7, 6, "#f28c28"); px(g, x - 1, base - 43, 5, 3, "#ffe066"); });
}
function volcano(g, W, H, w, h, night, seed) {
  /* a cone of dark rock rising out of the jungle: lit left flank, shaded right flank, ledges, lava trickles from the glowing crater,
     a curl of smoke and green jungle puffs round its foot */
  const r = rng(seed), cx = Math.floor(W / 2), base = H - 4, peak = 50;
  const R = { deep: "#2e2622", dark: "#463a34", mid: "#5f5049", light: "#7a6a60", hi: "#94837a" };
  for (let y = peak; y < base; y++) {
    const t = (y - peak) / (base - peak), hw = Math.round(24 + (W / 2 - 26) * Math.pow(t, 0.8));
    for (let x = cx - hw; x < cx + hw; x++) {
      const side = (x - cx) / hw;
      let col = side < -0.45 ? R.light : side < 0.05 ? R.mid : side < 0.5 ? R.dark : R.deep;
      if ((hash(x >> 2, y >> 1) % 23) === 0) col = side < 0 ? R.hi : R.deep;
      px(g, x, y, 1, 1, col);
    }
    if (y % 14 === 6) { const lx = cx - hw + ri(r, 4, 12), lw = ri(r, 10, 20); px(g, lx, y, lw, 1, R.hi); px(g, lx, y + 1, lw, 1, R.deep); }
  }
  for (let i = 0; i < 3; i++) { let x = cx + [-9, 2, 10][i], y = peak + 3; for (let k = 0; k < 60 && y < base - 50; k++) { px(g, x, y, 2, 2, k < 10 ? "#ffcf5e" : k < 30 ? "#f28c28" : "#c8402a"); if (k % 3 === 0) x += ri(r, -1, 1); y += 2; } }
  ellipse(g, cx, peak, 25, 6, R.deep); ellipse(g, cx, peak + 1, 19, 3, "#f2602a"); ellipse(g, cx, peak, 13, 2, "#ffcf5e"); px(g, cx - 5, peak - 1, 10, 1, "#fff2a8");
  for (let i = 0; i < 6; i++) { disc(g, cx + 6 + i * 4, peak - 10 - i * 7, 5 + (i % 2), i % 2 ? "#b8b4ae" : "#d8d4ce"); dot(g, cx + 4 + i * 4, peak - 12 - i * 7, "#ffffff"); }
  const pal = TREE_PAL.green;
  for (let x = 14; x < W - 14; x += 13) { const y = base - 10 - (hash(x, 5) % 10); ART.puff(g, x, y, 9 + (hash(x, 9) % 4), pal, x); }
}
function areaBuilding(kind, w, h, night, label, season) {
  const W = w * A + 2 * ART.OV, H = h * A + ART.TOPPAD;
  if (kind !== "mine") season = "";
  return cached("w:bld:" + kind + w + "x" + h + (night ? 1 : 0) + (label || "") + (season || ""), W, H, (g, cv) => {
    const seed = 2000 + hash(w, h) % 1000 + kind.charCodeAt(0) * 7 + kind.length;
    if (WEST[kind]) falseFront(g, kind, W, H, w, h, !!night, label, seed);
    else if (kind === "lighthouse") lighthouse(g, W, H, w, h, !!night, seed);
    else if (kind === "mine") mineMouth(g, W, H, w, h, !!night, seed, season);
    else if (kind === "tiki") tikiHut(g, W, H, w, h, !!night, seed);
    else if (kind === "volcano") volcano(g, W, H, w, h, !!night, seed);
    else { townBuilding(g, kind, W, H, w, h, !!night, label, seed); px(g, ART.OV, H - 1, w * A, 1, OUT); }
    if (kind !== "mine") outline(cv, OUT);   // the mine mouth is cut into cliff tiles, which carry no outline of their own
  });
}
/* where a building's windows glow at night, in tiles from its top-left */
function windowSpots(kind, w, h) {
  if (WEST[kind]) return [[0.8, h - 1.6], [w - 0.8, h - 1.6], [w / 2, h - 0.6]];
  if (kind === "lighthouse") return [[w / 2, 0.6]];
  if (kind === "mine") return [[w / 2 + 1.2, h - 1.8]];
  if (kind === "volcano") return [];
  if (kind === "tiki") return [[0.9, 2.8], [w - 0.9, 2.8]];
  const L = layout(kind, w, h), wy = L.roofRows + 0.9;
  return L.cols.map((t) => [t + 0.5, wy]);
}

// =========================================================================== icons and forage for the new things
const NEW_ICON = {};
function gemIcon(g, cols) { px(g, 10, 8, 12, 4, cols[1]); px(g, 7, 12, 18, 4, cols[0]); px(g, 9, 16, 14, 4, cols[0]); px(g, 12, 20, 8, 4, cols[2]); px(g, 14, 24, 4, 2, cols[2]); px(g, 10, 12, 4, 6, cols[1]); dot(g, 12, 9, WHITE); px(g, 19, 13, 4, 6, cols[2]); }
function oreIcon(g, cols) { ellipse(g, 16, 17, 10, 8, "#666a70"); ellipse(g, 15, 16, 9, 7, "#8b8e8c"); px(g, 10, 11, 5, 2, "#b1b3ae"); if (cols) for (const [x, y] of [[11, 15], [17, 13], [19, 19], [13, 20]]) { px(g, x, y, 3, 3, cols[0]); dot(g, x, y, cols[1]); } }
const ICON_DRAW = {
  stone: (g) => oreIcon(g, null),
  copper_ore: (g) => oreIcon(g, ORE_COL.copper_ore), iron_ore: (g) => oreIcon(g, ORE_COL.iron_ore), gold_ore: (g) => oreIcon(g, ORE_COL.gold_ore),
  quartz: (g) => { crystal(g, 9, 8, 16, ORE_COL.quartz); crystal(g, 14, 4, 20, ORE_COL.quartz); crystal(g, 19, 10, 14, ORE_COL.quartz); px(g, 8, 24, 16, 2, "#a8b4bc"); },
  amethyst: (g) => gemIcon(g, ORE_COL.amethyst), emerald: (g) => gemIcon(g, ORE_COL.emerald), ruby: (g) => gemIcon(g, ORE_COL.ruby), diamond: (g) => gemIcon(g, ORE_COL.diamond),
  prismatic_shard: (g) => { crystal(g, 9, 8, 16, ["#ff7eb6", WHITE, "#c050a0"]); crystal(g, 14, 4, 20, ["#7ec8ff", WHITE, "#4a7ad0"]); crystal(g, 19, 10, 14, ["#a8f07a", WHITE, "#5aa040"]); },
  gold_nugget: (g) => { ellipse(g, 16, 17, 8, 6, "#b08a20"); ellipse(g, 15, 16, 7, 5, "#f2c744"); px(g, 11, 13, 4, 2, "#fff2a8"); dot(g, 18, 18, "#b08a20"); },
  seashell: (g) => {
    /* a scallop: a ribbed fan, rounded on top and pinched to a winged hinge */
    const B = "#f7dcd0", D = "#e0a898", L = "#fff4ef";
    for (let y = 5; y <= 22; y++) { const hw = y < 10 ? Math.round(11 * Math.sqrt(Math.max(0, 1 - ((10 - y) / 5.5) ** 2))) : Math.round(11 - (y - 10) * 0.65); px(g, 16 - hw, y, hw * 2 + 1, 1, B); dot(g, 16 + hw, y, D); }
    for (let k = -4; k <= 4; k++) for (let y = 7; y <= 21; y++) { const x = Math.round(16 + k * 2.4 * (22 - y) / 15); if ((y + k) % 2 === 0) dot(g, x, y, D); }
    px(g, 11, 21, 11, 3, D); px(g, 12, 21, 9, 1, B); px(g, 9, 9, 3, 2, L); dot(g, 13, 7, L);
  },
  clam: (g) => { ellipse(g, 16, 16, 11, 8, "#cbbca8"); ellipse(g, 16, 15, 10, 6, "#e6dccd"); for (let i = -2; i <= 2; i++) px(g, 16 + i * 4, 10, 1, 11, "#b0a08a"); px(g, 6, 18, 20, 2, "#8f7f6a"); },
  coral: (g) => { const C = ["#ff6b6b", "#ffb0a0", "#c83a40"]; px(g, 15, 10, 3, 16, C[0]); px(g, 9, 6, 3, 12, C[0]); px(g, 21, 8, 3, 10, C[0]); px(g, 11, 15, 5, 3, C[0]); px(g, 17, 14, 5, 3, C[0]); dot(g, 9, 6, C[1]); dot(g, 21, 8, C[1]); dot(g, 15, 10, C[1]); px(g, 12, 24, 9, 3, C[2]); },
  sea_urchin: (g) => { disc(g, 16, 17, 7, "#5a2a6a"); disc(g, 15, 16, 5, "#8a4aa0"); for (let i = 0; i < 12; i++) { const a = i * 0.52; dot(g, 16 + Math.round(Math.cos(a) * 10), 17 + Math.round(Math.sin(a) * 10), "#3a1a4a"); dot(g, 16 + Math.round(Math.cos(a) * 9), 17 + Math.round(Math.sin(a) * 9), "#5a2a6a"); } dot(g, 13, 13, "#c890e0"); },
  coconut: (g) => { disc(g, 16, 17, 9, "#6e4a2a"); disc(g, 15, 16, 7, "#8a5f36"); for (let i = 0; i < 8; i++) dot(g, 10 + i * 2, 12 + (i % 3) * 4, "#5a3a1e"); px(g, 13, 11, 2, 2, "#3a2414"); px(g, 17, 11, 2, 2, "#3a2414"); px(g, 15, 14, 2, 2, "#3a2414"); },
  ginger: (g) => { px(g, 8, 16, 16, 6, "#d9b27a"); px(g, 6, 18, 4, 4, "#d9b27a"); px(g, 20, 12, 5, 6, "#d9b27a"); px(g, 12, 13, 4, 4, "#d9b27a"); px(g, 8, 16, 16, 1, "#f0d4a4"); px(g, 8, 21, 16, 1, "#a8844a"); px(g, 22, 8, 2, 5, "#6cc24a"); px(g, 13, 9, 2, 5, "#6cc24a"); },
  cactus_fruit: (g) => { ellipse(g, 16, 18, 7, 8, "#a8285a"); ellipse(g, 15, 17, 5, 6, "#d84a86"); px(g, 13, 12, 3, 2, "#f2a0c4"); for (const [x, y] of [[12, 16], [18, 15], [16, 21], [19, 20]]) dot(g, x, y, "#f4f0d8"); px(g, 14, 8, 4, 3, "#4c9450"); },
  desert_sage: (g) => { for (let i = 0; i < 5; i++) { const x = 8 + i * 4; px(g, x, 10 + (i % 2) * 3, 3, 14, "#8aa87a"); px(g, x, 10 + (i % 2) * 3, 1, 14, "#b8d0a8"); } px(g, 9, 22, 14, 3, "#6a7a5a"); px(g, 12, 8, 2, 2, "#c8a8e0"); px(g, 20, 9, 2, 2, "#c8a8e0"); },
  morel: (g) => { px(g, 13, 20, 6, 6, "#f3e6cc"); ellipse(g, 16, 13, 6, 9, "#8a6a4a"); for (let y = 6; y < 21; y += 3) for (let x = 11; x < 22; x += 3) dot(g, x + (y % 2), y, "#5a3e26"); px(g, 12, 7, 3, 3, "#b08a64"); },
  fiddlehead: (g) => { px(g, 15, 14, 3, 13, "#4f9e3b"); for (let i = 0; i < 10; i++) { const a = i * 0.65; dot(g, 16 + Math.round(Math.cos(a) * (6 - i * 0.5)), 10 + Math.round(Math.sin(a) * (6 - i * 0.5)), "#6cc24a"); dot(g, 17 + Math.round(Math.cos(a) * (6 - i * 0.5)), 10 + Math.round(Math.sin(a) * (6 - i * 0.5)), "#357a2a"); } },
  salmonberry: (g) => { for (const [x, y] of [[11, 14], [18, 12], [15, 19]]) { disc(g, x, y, 4, "#d8623a"); disc(g, x - 1, y - 1, 2, "#f28c5a"); dot(g, x - 1, y - 2, "#ffd0b0"); } px(g, 13, 6, 6, 3, "#4f9e3b"); },
};
const FISH_LOOK = {
  chub: ["#8a9a6a", "#b8c89a", "#5a6a42"], bream: ["#b8a46a", "#dccb94", "#7a6a3a"], pike: ["#6a8a4a", "#a8c87a", "#3e5a2a"],
  lake_trout: ["#7a8aa0", "#b8c8dc", "#4a5a70"], bullhead: ["#6a5a4a", "#9a8a72", "#3e3226"], tuna: ["#3a5a9a", "#8ab0e0", "#22386a"],
  red_snapper: ["#e05a4a", "#ffa898", "#a02a22"], pufferfish: ["#e8c858", "#fff0a8", "#a88a22"], octopus: ["#d86a9a", "#f8b0d0", "#9a3a62"],
  blue_tang: ["#3a6ae0", "#8ab4ff", "#1a3aa0"], lionfish: ["#e8784a", "#ffd0b0", "#9a3a1a"], pupfish: ["#7ab0d8", "#c0e0f4", "#4a7aa0"],
};
function newIcon(key) {
  if (FISH_LOOK[key]) return cached("w:icon:" + key, A, A, (g, c) => {
    const [B, L, D] = FISH_LOOK[key];
    if (key === "octopus") { disc(g, 16, 12, 8, D); disc(g, 15, 11, 7, B); px(g, 11, 8, 4, 2, L); for (let i = 0; i < 5; i++) { px(g, 8 + i * 4, 18, 3, 8 + (i % 2) * 3, B); dot(g, 9 + i * 4, 26 + (i % 2) * 3, D); } px(g, 12, 12, 2, 2, WHITE); px(g, 18, 12, 2, 2, WHITE); dot(g, 13, 13, OUT); dot(g, 19, 13, OUT); }
    else if (key === "pufferfish") { disc(g, 15, 16, 10, D); disc(g, 14, 15, 9, B); disc(g, 12, 12, 4, L); for (let i = 0; i < 10; i++) { const a = i * 0.63; dot(g, 15 + Math.round(Math.cos(a) * 11), 16 + Math.round(Math.sin(a) * 11), D); } px(g, 8, 13, 3, 3, WHITE); dot(g, 9, 14, OUT); px(g, 25, 13, 4, 6, D); }
    else {
      px(g, 24, 9, 4, 4, D); px(g, 24, 19, 4, 4, D); px(g, 22, 11, 6, 10, D); px(g, 23, 12, 4, 8, B);
      ellipse(g, 13, 16, 11, 7, D); ellipse(g, 13, 15, 10, 6, B); ellipse(g, 10, 13, 5, 2, L); ellipse(g, 13, 19, 7, 2, mixh(B, WHITE, 0.35));
      px(g, 11, 7, 8, 3, D); px(g, 12, 8, 6, 2, B); px(g, 9, 10, 1, 11, D); px(g, 5, 12, 3, 3, WHITE); dot(g, 6, 13, OUT);
      if (key === "lionfish") for (let x = 9; x < 22; x += 3) { px(g, x, 4, 1, 6, "#ffd0b0"); px(g, x, 10, 2, 9, "#fff4ea"); }
      if (key === "pike") for (let x = 11; x < 22; x += 3) dot(g, x, 14, L);
      if (key === "tuna") px(g, 4, 16, 18, 1, "#c0d4ee");
      if (key === "blue_tang") { px(g, 22, 11, 5, 10, "#f2c744"); px(g, 9, 13, 10, 2, "#1a2a6a"); }
      if (key === "red_snapper") px(g, 5, 18, 14, 1, "#ffd0c8");
    }
    outline(c, OUT);
  });
  if (!ICON_DRAW[key]) return null;
  return cached("w:icon:" + key, A, A, (g, c) => { ICON_DRAW[key](g); outline(c, OUT); });
}
const baseIcon = ART.iconCanvas, baseForage = ART.forageSprite;
ART.iconCanvas = function (key, cat) { return newIcon(key) || baseIcon(key, cat); };
ART.forageSprite = function (key) {
  if (!ICON_DRAW[key]) return baseForage(key);
  return cached("w:forage:" + key, A, A, (g) => { g.imageSmoothingEnabled = false; g.drawImage(newIcon(key), 5, 7, 22, 22); });
};

// =========================================================================== indoor furniture for the valley's buildings
function interiorExtra(ch, v) {
  return cached("w:iobj" + ch + (v % 3), A, A, (g, c) => {
    if (ch === "d") {
      /* a glass display case on a wooden stand, with curiosities inside */
      px(g, 3, 20, 26, 9, WOOD.mid); px(g, 3, 20, 26, 2, WOOD.light); px(g, 3, 27, 26, 2, WOOD.deep); px(g, 5, 29, 3, 2, WOOD.dark); px(g, 24, 29, 3, 2, WOOD.dark);
      px(g, 4, 6, 24, 14, "#bfe6f7"); px(g, 4, 6, 24, 1, "#e6f6fd"); px(g, 4, 6, 1, 14, "#e6f6fd"); px(g, 27, 6, 1, 14, "#8fb8cc");
      const items = [["#a86ee0", "#dcb8ff"], ["#f2c744", "#fff2a8"], ["#e0384f", "#ffa8b4"], ["#c9a66b", "#e8cf9a"], ["#3cc070", "#a8f0c0"]];
      for (let i = 0; i < 3; i++) { const [a, b] = items[(v + i) % items.length], x = 7 + i * 7; px(g, x, 13, 5, 6, a); px(g, x + 1, 12, 3, 1, a); dot(g, x + 1, 13, b); px(g, x - 1, 19, 7, 1, "#d8cfb2"); }
      px(g, 9, 8, 3, 1, WHITE); px(g, 20, 9, 2, 1, WHITE);
    } else if (ch === "a") {
      px(g, 6, 14, 20, 5, IRON.base); px(g, 2, 14, 5, 3, IRON.base); px(g, 6, 14, 20, 1, IRON.light); px(g, 24, 15, 2, 4, IRON.dark);
      px(g, 11, 19, 10, 5, IRON.dark); px(g, 8, 24, 16, 4, IRON.base); px(g, 8, 24, 16, 1, IRON.light);
      px(g, 7, 28, 18, 2, WOOD.dark); px(g, 18, 9, 2, 6, WOOD.mid); px(g, 15, 8, 8, 3, IRON.dark);
    } else if (ch === "i") {
      ellipse(g, 16, 18, 12, 9, WOOD.mid); ellipse(g, 15, 16, 10, 6, WOOD.light); for (const x of [8, 16, 24]) px(g, x, 10, 2, 17, IRON.base);
      ellipse(g, 6, 18, 3, 7, WOOD.dark); ellipse(g, 6, 18, 2, 5, "#c9a36b"); dot(g, 6, 18, WOOD.deep); px(g, 3, 26, 26, 2, WOOD.deep);
    } else return;
    outline(c, OUT);
  });
}

Object.assign(ART, { interiorExtra, GROUND2, cobbleTile, plankTile, cliffTile, ROCKS, pineSprite, palmSprite, cactusSprite, areaProp, fountainSprite, boatSprite, coachSprite,
  oreSprite, areaBuilding, windowSpots });
})();
