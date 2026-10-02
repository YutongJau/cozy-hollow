/* Cozy Hollow art - the Valley Revival: how the town looks as it comes back to life.
   A worn town (a dry fountain full of leaves, wilted planters, weeds in the cracks, boarded windows, a shuttered stall),
   the hot spring above the mountain lake with its rim of stones, paper lanterns, and the Bloom monument.
   Same rules as everywhere: px() only, 32px tiles, four tones lit from the top-left, outline(canvas, OUT).
   Render to check:  node tools/render.js out.png 4 "fountainDry()" "wiltedPlanter()" "weedSprite(0)" "stallShut()" */
"use strict";
(function () {
const ART = window.ART;
const { A, px, hash, rng, mix, shade, cached, outline, OUT, WOOD } = ART;
const WHITE = "#ffffff";
const dot = (g, x, y, c) => px(g, x, y, 1, 1, c);
function ell(g, cx, cy, rx, ry, col) { for (let dy = -ry; dy <= ry; dy++) { const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.4) * (ry + 0.4))))); px(g, cx - hw, cy + dy, hw * 2 + 1, 1, col); } }
const S = { deep: "#5f5a52", dark: "#837d73", mid: "#a49d91", light: "#c3bcaf", hi: "#ddd7cb" };
const LEAVES = ["#c8782e", "#a8582a", "#d9a040", "#8a6a2a"];
const PLANK = { light: "#c9a06a", mid: "#a67c4a", dark: "#7a5532", deep: "#563a22" };

// ------------------------------------------------------------------ the fountain before the valley is Bustling
function fountainDry() {
  /* the same stone basin as the running fountain (3 tiles wide), bone dry: cracked stone, a drift of dead leaves, moss */
  return cached("rv:fountaindry", 96, 80, (g, c) => {
    ell(g, 48, 56, 44, 20, S.dark); ell(g, 48, 54, 44, 19, S.mid); ell(g, 48, 53, 42, 17, S.light);
    ell(g, 48, 54, 37, 13, S.deep); ell(g, 48, 55, 36, 12, "#8a8276"); ell(g, 48, 57, 33, 9, "#7a7268");
    for (const [x, y, w] of [[22, 52, 7], [30, 58, 5], [60, 50, 6], [66, 58, 8], [40, 61, 4]]) { px(g, x, y, w, 1, "#5f584e"); px(g, x + w - 1, y + 1, 3, 1, "#5f584e"); }
    const r = rng(41);
    for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = Math.sqrt(r()), x = Math.round(48 + Math.cos(a) * d * 30), y = Math.round(57 + Math.sin(a) * d * 8); const col = LEAVES[i % 4]; px(g, x, y, 2, 1, col); dot(g, x + 1, y - 1, shade(col, 1.2)); }
    for (const [x, y] of [[16, 50], [77, 51], [20, 60], [74, 61]]) { px(g, x, y, 3, 2, "#5f8a3e"); dot(g, x + 1, y - 1, "#7aa84e"); }
    px(g, 44, 26, 8, 28, S.mid); px(g, 44, 26, 2, 28, S.light); px(g, 50, 26, 2, 28, S.dark);
    px(g, 45, 40, 1, 6, "#6f8a4a"); px(g, 50, 33, 1, 8, "#6f8a4a"); dot(g, 46, 39, "#8aa85a");
    ell(g, 48, 30, 14, 5, S.dark); ell(g, 48, 29, 14, 4, S.light); ell(g, 48, 29, 11, 3, "#8a8276"); px(g, 44, 29, 2, 1, LEAVES[0]); px(g, 51, 28, 2, 1, LEAVES[2]);
    px(g, 46, 12, 4, 16, S.light); px(g, 48, 12, 2, 16, S.mid); px(g, 46, 10, 4, 2, S.mid); px(g, 47, 9, 2, 1, S.dark);
    px(g, 47, 20, 1, 4, S.deep);
    outline(c, OUT);
  });
}

// ------------------------------------------------------------------ planters before the valley is Waking
function wiltedPlanter() {
  /* the town's flower beds gone to seed: drooping brown stalks, a couple of faded heads, dry grass */
  return cached("rv:wilted", A, A, (g, c) => {
    [[6, 12], [16, 8], [25, 11], [11, 18], [21, 17]].forEach(([x, y], i) => {
      const lean = i % 2 ? 1 : -1;
      px(g, x, y + 2, 1, 27 - y, "#9a8a4a"); dot(g, x + lean, y + 1, "#9a8a4a"); dot(g, x + 2 * lean, y + 1, "#9a8a4a");
      const head = ["#a86a5a", "#9a8450", "#a87e6a"][i % 3];
      px(g, x + 2 * lean - 1, y + 2, 3, 3, head); dot(g, x + 2 * lean, y + 5, shade(head, 0.75));
      dot(g, x - lean, y + 12, "#a8954e"); dot(g, x - 2 * lean, y + 13, "#a8954e");
    });
    for (const [x, y] of [[4, 29], [15, 30], [26, 29]]) px(g, x, y, 3, 1, "#8a7a3e");
    outline(c, OUT);
  });
}

// ------------------------------------------------------------------ weeds pushing up through a quiet town
function weedSprite(v) {
  /* a small clump in one corner of the tile: spiky dandelion leaves, sometimes a yellow head or a seed clock */
  v = ((v % 6) + 6) % 6;
  return cached("rv:weed" + v, A, A, (g, c) => {
    const r = rng(77 + v * 13), cx = 6 + Math.floor(r() * 20), cy = 14 + Math.floor(r() * 12);
    const dk = "#4a7a2a", md = "#6a9a38", lt = "#8fbf52";
    for (const [dx, len] of [[-5, 5], [-3, 7], [0, 8], [3, 6], [5, 4]]) {
      const x = cx + dx; for (let k = 0; k < len; k++) dot(g, x + Math.round(dx * k / 12), cy - k, k % 3 === 2 ? lt : (k % 2 ? md : dk));
      dot(g, x - 1, cy - Math.floor(len / 2), md); dot(g, x + 1, cy - Math.floor(len / 3), md);
    }
    px(g, cx - 4, cy + 1, 9, 1, "#3e6a24");
    if (v % 3 === 0) { px(g, cx, cy - 13, 1, 5, md); px(g, cx - 1, cy - 15, 3, 3, "#f2c744"); dot(g, cx, cy - 14, "#fff09a"); }
    else if (v % 3 === 1) { px(g, cx + 1, cy - 12, 1, 5, md); for (const [dx, dy] of [[0, -2], [2, 0], [0, 2], [-2, 0], [1, -1], [-1, 1], [1, 1], [-1, -1]]) dot(g, cx + 1 + dx, cy - 14 + dy, "#f4f1ea"); }
    if (v >= 3) { const x2 = (cx + 14) % 26 + 3, y2 = Math.min(28, cy + 6); for (let k = 0; k < 4; k++) { dot(g, x2 - 2 + k, y2 - (k % 2) - 1, md); dot(g, x2 - 1 + k, y2, dk); } }
    outline(c, OUT);
  });
}

// ------------------------------------------------------------------ boards nailed over a window
function boardsSprite() {
  return cached("rv:boards", 20, 18, (g, c) => {
    const plank = (y, tilt) => { for (let x = 0; x < 20; x++) { const yy = y + Math.round((x - 10) * tilt); px(g, x, yy, 1, 4, PLANK.mid); dot(g, x, yy, PLANK.light); dot(g, x, yy + 3, PLANK.dark); } };
    plank(6, 0.45); plank(6, -0.45);
    for (const [x, y] of [[2, 2], [17, 2], [2, 11], [17, 11]]) dot(g, x, y + 1, "#3a3a40");
    outline(c, OUT);
  });
}

// ------------------------------------------------------------------ the market stall before Fennel comes back
function stallShut() {
  /* the striped awning faded and sagging, the counter boarded up, a little "SHUT" sign */
  return cached("rv:stallshut", A, A, (g, c) => {
    px(g, 4, 6, 2, 24, WOOD.dark); px(g, 26, 6, 2, 24, WOOD.dark); px(g, 4, 6, 1, 24, WOOD.mid);
    for (let i = 0; i < 4; i++) { const col = i % 2 ? "#d8d2c2" : "#a87a72", sag = i === 1 || i === 2 ? 1 : 0; px(g, 2 + i * 7, 2 + sag, 7, 7, col); px(g, 2 + i * 7, 8 + sag, 7, 1, shade(col, 0.8)); }
    px(g, 15, 9, 3, 3, "#d8d2c2"); dot(g, 16, 12, "#a87a72");
    px(g, 3, 18, 26, 9, WOOD.dark); for (let y = 18; y < 27; y += 3) { px(g, 3, y, 26, 2, PLANK.mid); px(g, 3, y, 26, 1, PLANK.light); }
    for (const x of [5, 15, 26]) { dot(g, x, 19, "#3a3a40"); dot(g, x, 25, "#3a3a40"); }
    px(g, 8, 11, 17, 7, "#e8dcc0"); px(g, 8, 11, 17, 1, "#f6eedc"); px(g, 8, 17, 17, 1, "#c8b898"); dot(g, 16, 10, WOOD.deep);
    ART.text3x5(g, 9, 12, "SHUT", "#8a3a2a", 1);
    outline(c, OUT);
  });
}

// ------------------------------------------------------------------ the hot spring
function springTile(mask, frame) {
  /* hot water the colour of a mountain lake on a sunny day, ringed with round stones where it meets the ground;
     mask bits say which sides continue the pool: 1 up, 2 right, 4 down, 8 left */
  frame = ((frame % 3) + 3) % 3;
  return cached("rv:spring" + mask + "_" + frame, A, A, (g, c) => {
    const W0 = "#2f9a9a", W1 = "#46b8b2", W2 = "#7ad8cc", W3 = "#c6f2ea";
    px(g, 0, 0, A, A, W1);
    const r = rng(9 + mask * 7);
    for (let i = 0; i < 5; i++) { const x = Math.floor(r() * 26) + 2, y = Math.floor(r() * 26) + 2; px(g, x, y, 4, 1, W2); }
    for (let i = 0; i < 3; i++) { const x = 6 + ((i * 9 + frame * 5 + mask * 3) % 20), y = 8 + ((i * 7 + frame * 3) % 16); px(g, x, y, 2, 2, W3); dot(g, x + 2, y + 1, W2); }
    const stones = (side) => {
      for (let k = 0; k < 4; k++) {
        const along = 4 + k * 8, w = 7, h = 6, col = k % 2 ? "#9c968c" : "#b2aca0";
        let x, y;
        if (side === 1) { x = along - 3; y = 0; } else if (side === 4) { x = along - 3; y = A - h; } else if (side === 8) { x = 0; y = along - 3; } else { x = A - w; y = along - 3; }
        const ww = side & 5 ? w : h, hh = side & 5 ? h : w;
        px(g, x, y, ww, hh, col); px(g, x, y, ww, 1, "#d2ccc0"); px(g, x, y + hh - 1, ww, 1, "#6e6860"); dot(g, x + ww - 1, y + 1, "#6e6860");
      }
      ctx_shadow(side);
    };
    const ctx_shadow = (side) => {
      if (side === 1) px(g, 0, 6, A, 2, W0); else if (side === 8) px(g, 6, 0, 2, A, W0);
      else if (side === 2) px(g, A - 8, 0, 1, A, W2); else px(g, 0, A - 8, A, 1, W2);
    };
    if (!(mask & 1)) stones(1);
    if (!(mask & 4)) stones(4);
    if (!(mask & 8)) stones(8);
    if (!(mask & 2)) stones(2);
    outline(c, OUT, true);
  });
}

function hotSpringSprite(frame) {
  /* the whole spring as one picture (4 tiles by 2, plus room for the rocks): an oval pool of warm teal water ringed with
     round mossy stones of every size, a little cattail clump, bubbles rising (3 frames) */
  frame = ((frame % 3) + 3) % 3;
  return cached("rv:hotspring" + frame, 136, 80, (g, c) => {
    const cx = 68, cy = 40;
    ell(g, cx, cy + 3, 60, 28, "rgba(40,60,30,0.28)");
    ell(g, cx, cy, 56, 25, "#2f8f8c"); ell(g, cx, cy - 1, 54, 23, "#3aa6a0"); ell(g, cx, cy, 46, 18, "#46b8b2"); ell(g, cx + 2, cy + 2, 30, 10, "#3aa6a0");
    const r = rng(23);
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 0.4 + r() * 0.5; px(g, Math.round(cx + Math.cos(a) * d * 44), Math.round(cy + Math.sin(a) * d * 16), 5, 1, "#7ad8cc"); }
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + frame * 0.35, d = 0.2 + ((i * 37 + frame * 11) % 10) / 16; const x = Math.round(cx + Math.cos(a) * d * 40), y = Math.round(cy + Math.sin(a) * d * 14); px(g, x, y, 2, 2, "#c6f2ea"); dot(g, x + 2, y, "#9fe8de"); }
    const N = 22;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 6.283 + (r() - 0.5) * 0.12, sz = 5 + Math.floor(r() * 6) + (i % 5 === 0 ? 3 : 0);
      const x = Math.round(cx + Math.cos(a) * 56), y = Math.round(cy + Math.sin(a) * 25);
      const base = ["#9c968c", "#b2aca0", "#8a857c", "#a8a296"][i % 4];
      ell(g, x, y + 1, sz, Math.max(3, Math.round(sz * 0.7)), "#5f5a52"); ell(g, x, y, sz, Math.max(3, Math.round(sz * 0.7)) - 1, base);
      ell(g, x - Math.round(sz / 3), y - Math.round(sz / 4), Math.max(1, Math.round(sz / 3)), Math.max(1, Math.round(sz / 4)), "#d2ccc0");
      if (i % 3 === 0 && y < cy) px(g, x - 2, y - Math.round(sz * 0.6), 4, 2, "#6f9a48");
    }
    for (const [x, h] of [[118, 16], [121, 20], [124, 14]]) { px(g, x, 46 - h, 1, h, "#5a8a3a"); px(g, x - 1, 46 - h, 3, 5, "#7a4a2a"); }
    for (const [x, y] of [[16, 54], [22, 58]]) { px(g, x, y, 3, 2, "#ff9ccf"); dot(g, x + 1, y - 1, "#ffe0ef"); }
    outline(c, OUT);
  });
}

// ------------------------------------------------------------------ the Bloom monument
function monumentSprite() {
  /* a stepped stone plinth with a bronze plaque, a golden sprout on top (two broad leaves and a bud) and a ring of flowers
     at its foot; 48x72, standing on one tile (the plinth's foot is the bottom 16 rows) */
  return cached("rv:monument", 48, 72, (g, c) => {
    const st = { deep: "#5f5a52", dark: "#837d73", mid: "#a49d91", light: "#c3bcaf", hi: "#ddd7cb" };
    const gold = { dark: "#b08a20", mid: "#f2c744", light: "#fff2a8" };
    ell(g, 24, 66, 21, 5, "rgba(40,50,30,0.3)");
    px(g, 5, 56, 38, 8, st.dark); px(g, 5, 56, 38, 2, st.light); px(g, 5, 62, 38, 2, st.deep);
    px(g, 9, 50, 30, 7, st.mid); px(g, 9, 50, 30, 1, st.hi); px(g, 9, 56, 30, 1, st.dark);
    px(g, 13, 26, 22, 25, st.mid); px(g, 13, 26, 3, 25, st.light); px(g, 32, 26, 3, 25, st.dark); px(g, 11, 24, 26, 3, st.light); px(g, 11, 24, 26, 1, st.hi); px(g, 11, 26, 26, 1, st.dark);
    px(g, 13, 33, 22, 11, "#8a5a2a"); px(g, 14, 34, 20, 9, "#b0763a"); px(g, 14, 34, 20, 1, "#d09a5a");
    ART.text3x5(g, 15, 36, "BLOOM", "#5a3a1a", 1);
    px(g, 23, 11, 3, 14, gold.dark); px(g, 23, 11, 1, 14, gold.mid);
    const leaf = (x0, y0, x1, y1, w) => {          // a pointed leaf from (x0,y0) to (x1,y1), widest in the middle
      for (let k = 0; k <= 24; k++) {
        const t = k / 24, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, hw = Math.sin(Math.PI * t) * w;
        for (let d = -hw; d <= hw; d += 0.5) { const nx = Math.round(x - (y1 - y0) / 14 * d / w * 2), ny = Math.round(y + (x1 - x0) / 14 * d / w * 2); dot(g, nx, ny, d < -hw / 3 ? gold.light : d > hw / 2 ? gold.dark : gold.mid); }
      }
    };
    leaf(23, 19, 11, 11, 3.2); leaf(26, 17, 38, 9, 3.2);
    ell(g, 24, 8, 3, 4, gold.mid); px(g, 23, 5, 1, 3, gold.light); dot(g, 24, 3, gold.light); px(g, 25, 10, 2, 1, gold.dark);
    const fl = ["#ff7eb6", "#ffe066", "#ffffff", "#c58aff", "#ff9c4a"];
    for (let i = 0; i < 11; i++) { const x = 4 + i * 4, y = 64 + (i % 2) * 3; px(g, x, y + 1, 1, 3, "#3f8f3a"); px(g, x - 1, y - 1, 3, 3, fl[i % 5]); dot(g, x, y, "#f2a020"); }
    outline(c, OUT);
  });
}

// ------------------------------------------------------------------ paper lanterns for a Thriving town
function lanternSprite(color, lit) {
  return cached("rv:lantern" + color + (lit ? 1 : 0), 12, 16, (g, c) => {
    const base = { red: "#e0524f", gold: "#f2b544", pink: "#ef7fb0", teal: "#4fb8b0" }[color] || "#e0524f";
    const body = lit ? mix(base, "#fff2b0", 0.35) : base;
    px(g, 5, 0, 2, 2, "#3a2a1a"); px(g, 3, 2, 6, 1, "#5a3a22");
    px(g, 2, 3, 8, 10, body); px(g, 1, 5, 10, 6, body); px(g, 3, 4, 2, 7, mix(body, WHITE, 0.4));
    px(g, 1, 7, 10, 1, shade(base, 0.75)); px(g, 2, 10, 8, 1, shade(base, 0.75));
    px(g, 3, 13, 6, 1, "#5a3a22"); px(g, 5, 14, 2, 2, "#f2c744");
    outline(c, OUT);
  });
}

// ------------------------------------------------------------------ Oakley's furniture (each 32x32, standing on its tile)
const DECOR = {
  flower_planter: (g) => {
    px(g, 4, 20, 24, 10, PLANK.mid); px(g, 4, 20, 24, 2, PLANK.light); px(g, 4, 28, 24, 2, PLANK.dark); for (const x of [10, 16, 22]) px(g, x, 22, 1, 6, PLANK.dark);
    px(g, 6, 18, 20, 3, "#5a3a22");
    [[8, 10, "#ff6b9d"], [13, 7, "#f2c744"], [18, 9, "#ffffff"], [23, 11, "#c58aff"], [11, 13, "#ff9c4a"], [20, 14, "#ff6b9d"]].forEach(([x, y, c]) => {
      px(g, x, y + 2, 1, 18 - y, "#3f8f3a"); px(g, x + 1, y + 6, 2, 2, "#5fb04a"); px(g, x - 1, y - 1, 3, 3, c); dot(g, x, y, "#ffe066");
    });
  },
  garden_gnome: (g) => {
    ell(g, 16, 29, 7, 2, "rgba(0,0,0,0.25)");
    px(g, 11, 22, 10, 7, "#3a7bd5"); px(g, 11, 22, 3, 7, "#5a9be8"); px(g, 10, 27, 5, 2, "#5a3a22"); px(g, 17, 27, 5, 2, "#5a3a22");
    px(g, 12, 15, 8, 8, "#f4f1ea"); px(g, 13, 21, 6, 3, "#f4f1ea"); px(g, 14, 23, 4, 2, "#e8e2d6");
    px(g, 12, 12, 8, 4, "#f2c49a"); dot(g, 14, 13, OUT); dot(g, 17, 13, OUT); px(g, 15, 14, 2, 2, "#e08a7a");
    for (let i = 0; i < 9; i++) px(g, 12 + Math.floor(i / 2.5), 11 - i, 8 - Math.floor(i * 0.8), 1, i % 3 ? "#d9463c" : "#e0605a");
    px(g, 7, 22, 4, 3, "#f2c49a"); px(g, 21, 21, 3, 4, "#f2c49a"); px(g, 23, 15, 1, 8, "#8a5a34"); px(g, 22, 13, 3, 3, "#c94a3a");
  },
  bird_bath: (g) => {
    ell(g, 16, 29, 8, 2, "rgba(0,0,0,0.25)");
    px(g, 11, 26, 10, 4, S.dark); px(g, 11, 26, 10, 1, S.light); px(g, 14, 14, 4, 12, S.mid); px(g, 14, 14, 1, 12, S.light); px(g, 17, 14, 1, 12, S.dark);
    ell(g, 16, 12, 12, 4, S.dark); ell(g, 16, 11, 12, 3, S.light); ell(g, 16, 11, 10, 2, "#5aa6e0"); px(g, 10, 10, 4, 1, "#a9dcf7");
    px(g, 22, 6, 5, 4, "#a8744a"); px(g, 21, 7, 2, 2, "#a8744a"); px(g, 26, 7, 2, 1, "#f2a33a"); dot(g, 24, 7, OUT); px(g, 22, 9, 4, 1, "#e8d2b0"); px(g, 23, 10, 1, 1, "#e8a030");
  },
  stone_lantern: (g) => {
    ell(g, 16, 29, 8, 2, "rgba(0,0,0,0.25)");
    px(g, 9, 26, 14, 4, S.dark); px(g, 9, 26, 14, 1, S.light); px(g, 13, 19, 6, 7, S.mid); px(g, 13, 19, 2, 7, S.light);
    px(g, 10, 17, 12, 3, S.mid); px(g, 10, 17, 12, 1, S.hi); px(g, 11, 10, 10, 7, S.mid); px(g, 13, 11, 6, 5, "#ffd86a"); px(g, 14, 12, 2, 2, "#fff4c0");
    px(g, 7, 7, 18, 3, S.dark); px(g, 7, 7, 18, 1, S.light); px(g, 10, 5, 12, 2, S.mid); px(g, 14, 2, 4, 3, S.light); dot(g, 15, 1, S.hi);
  },
  scarecrow: (g) => {
    px(g, 15, 10, 2, 20, PLANK.dark); px(g, 5, 13, 22, 2, PLANK.mid);
    px(g, 10, 13, 12, 9, "#c94a3a"); for (const x of [12, 16, 20]) px(g, x, 13, 1, 9, "#8a2c24"); px(g, 10, 17, 12, 1, "#8a2c24");
    px(g, 4, 14, 3, 3, "#e3c478"); px(g, 25, 14, 3, 3, "#e3c478"); px(g, 12, 22, 3, 3, "#e3c478"); px(g, 17, 22, 3, 3, "#e3c478");
    px(g, 12, 5, 8, 8, "#e6d3a0"); dot(g, 14, 8, OUT); dot(g, 17, 8, OUT); px(g, 14, 10, 4, 1, OUT);
    px(g, 8, 4, 16, 2, "#d9b86a"); px(g, 11, 0, 10, 5, "#e3c478"); px(g, 11, 3, 10, 1, "#c94a5a");
  },
  sundial: (g) => {
    ell(g, 16, 29, 8, 2, "rgba(0,0,0,0.25)");
    px(g, 10, 25, 12, 5, S.dark); px(g, 10, 25, 12, 1, S.light); px(g, 12, 15, 8, 10, S.mid); px(g, 12, 15, 2, 10, S.light); px(g, 18, 15, 2, 10, S.dark);
    ell(g, 16, 13, 11, 4, S.dark); ell(g, 16, 12, 11, 3, "#d9b86a"); ell(g, 16, 12, 9, 2, "#e8d08a");
    for (const [x, y] of [[8, 12], [24, 12], [16, 10], [11, 10], [21, 10]]) dot(g, x, y, "#8a6a2a");
    for (let i = 0; i < 6; i++) px(g, 13 + i, 11 - i, 2, 1, "#b08a20");
  },
  topiary: (g) => {
    px(g, 10, 22, 12, 8, "#c96a3a"); px(g, 9, 21, 14, 2, "#e08a5a"); px(g, 10, 28, 12, 2, "#9a4a2a"); px(g, 12, 23, 2, 5, "#e08a5a");
    px(g, 15, 17, 2, 5, "#6a4228");
    ell(g, 16, 11, 9, 9, "#2f7a2a"); ell(g, 15, 10, 8, 8, "#4f9e3b"); ell(g, 13, 8, 4, 4, "#7ccf5a"); dot(g, 12, 6, "#a8e07a");
    for (const [x, y] of [[19, 13], [11, 14], [18, 6], [21, 10]]) dot(g, x, y, "#357a2a");
  },
};
// festival-only decorations
Object.assign(DECOR, {
  maypole: (g) => {
    ell(g, 16, 29, 8, 2, "rgba(0,0,0,0.25)"); px(g, 15, 3, 3, 27, PLANK.light); px(g, 15, 3, 1, 27, "#f0cf9a");
    ell(g, 16, 3, 3, 2, "#f2c744"); for (let i = 0; i < 6; i++) { const c = ["#ff6b9d", "#7fd8e8", "#f2c744", "#a8f07a", "#c58aff", "#ff9c4a"][i]; for (let k = 0; k < 9; k++) dot(g, 16 + Math.round((i - 2.5) * k * 0.9), 5 + k * 2 + (i % 2), c); }
    px(g, 11, 27, 11, 2, "#5fb04a"); dot(g, 12, 26, "#ff6b9d"); dot(g, 20, 26, "#ffe066");
  },
  wagon_wheel: (g) => {
    ell(g, 16, 16, 12, 12, PLANK.dark); ell(g, 16, 16, 10, 10, "rgba(0,0,0,0)");
    for (let a = 0; a < 6.28; a += 0.08) { dot(g, Math.round(16 + Math.cos(a) * 11), Math.round(16 + Math.sin(a) * 11), PLANK.mid); dot(g, Math.round(16 + Math.cos(a) * 12), Math.round(16 + Math.sin(a) * 12), PLANK.dark); }
    for (let i = 0; i < 8; i++) { const a = i * 0.785; for (let r = 3; r < 11; r++) dot(g, Math.round(16 + Math.cos(a) * r), Math.round(16 + Math.sin(a) * r), PLANK.light); }
    ell(g, 16, 16, 3, 3, "#5c5c62"); dot(g, 15, 15, "#9a9aa2"); px(g, 14, 27, 4, 4, PLANK.dark);
  },
  trophy_cup: (g) => {
    ell(g, 16, 29, 7, 2, "rgba(0,0,0,0.25)"); px(g, 10, 26, 12, 4, PLANK.dark); px(g, 10, 26, 12, 1, PLANK.light); px(g, 12, 23, 8, 3, "#b08a20");
    px(g, 15, 18, 2, 5, "#d9a640"); ell(g, 16, 11, 8, 8, "#d9a640"); ell(g, 15, 10, 7, 7, "#f2c744"); px(g, 9, 3, 14, 3, "#f2c744"); px(g, 9, 3, 14, 1, "#fff2a8");
    px(g, 5, 6, 3, 8, "#d9a640"); px(g, 24, 6, 3, 8, "#d9a640"); px(g, 12, 8, 2, 6, "#fff2a8"); dot(g, 16, 12, "#e86a9a");
  },
  jack_o_lantern: (g) => {
    ell(g, 16, 29, 9, 2, "rgba(0,0,0,0.25)"); ell(g, 16, 20, 12, 9, "#c4581e"); ell(g, 16, 19, 11, 8, "#f28c28"); for (const x of [10, 16, 22]) px(g, x, 12, 1, 15, "#d06a20");
    px(g, 15, 8, 3, 5, "#5a7a2a"); px(g, 17, 7, 3, 2, "#5fb04a");
    for (const [x, y] of [[10, 16], [19, 16]]) { px(g, x, y, 4, 3, "#ffd84a"); px(g, x + 1, y - 1, 2, 1, "#ffd84a"); }
    px(g, 10, 23, 13, 2, "#ffd84a"); for (const x of [12, 16, 20]) px(g, x, 22, 2, 1, "#ffd84a");
  },
  ice_swan: (g) => {
    ell(g, 16, 29, 9, 2, "rgba(0,0,0,0.2)"); px(g, 7, 25, 18, 5, "#b8e4f4"); px(g, 7, 25, 18, 1, "#e8f8ff");
    ell(g, 17, 20, 9, 5, "#cdeefa"); ell(g, 15, 19, 6, 3, "#e8f8ff"); for (let i = 0; i < 12; i++) px(g, 9 + Math.round(Math.sin(i * 0.3) * 2), 18 - i, 3, 1, "#cdeefa");
    px(g, 10, 5, 5, 3, "#cdeefa"); px(g, 14, 6, 3, 1, "#9fd0e8"); dot(g, 11, 6, "#5a8aa8"); px(g, 20, 15, 7, 4, "#e8f8ff"); dot(g, 24, 16, "#ffffff");
  },
  festive_tree: (g) => {
    ell(g, 16, 29, 9, 2, "rgba(0,0,0,0.25)"); px(g, 14, 25, 4, 5, PLANK.dark); px(g, 11, 27, 10, 3, "#c94a3a");
    for (let t = 0; t < 3; t++) for (let i = 0; i < 8; i++) { const w = 3 + i + t * 2, y = 4 + t * 7 + i; px(g, 16 - w, y, w * 2, 1, i % 3 === 0 ? "#3f8f3a" : "#2c6628"); }
    for (const [x, y, c] of [[12, 10, "#e0524f"], [19, 13, "#f2c744"], [10, 18, "#7fd8e8"], [21, 20, "#e0524f"], [15, 22, "#f2c744"], [17, 16, "#c58aff"]]) { px(g, x, y, 2, 2, c); dot(g, x, y, "#ffffff"); }
    px(g, 15, 1, 2, 4, "#f2c744"); px(g, 14, 2, 4, 2, "#f2c744"); dot(g, 15, 2, "#fff2a8");
  },
});
const PROP_DECOR = { garden_bench: "b", lamp_post: "l" };
function decorSprite(kind) {
  if (PROP_DECOR[kind]) return ART.propSprite(PROP_DECOR[kind]);
  if (!DECOR[kind]) return null;
  return cached("rv:decor:" + kind, A, A, (g, c) => { DECOR[kind](g); outline(c, OUT); });
}
const prevMachine = ART.machineSprite;
ART.machineSprite = function (kind, working) { return decorSprite(kind) || prevMachine(kind, working); };

// ------------------------------------------------------------------ the minecart and the telescope
function minecartSprite() {
  return cached("rv:minecart", A, A, (g, c) => {
    for (const y of [24, 29]) { px(g, 0, y, 32, 2, "#6c6964"); px(g, 0, y, 32, 1, "#a8a49c"); }
    for (const x of [3, 11, 19, 27]) px(g, x, 23, 3, 9, PLANK.dark);
    px(g, 5, 11, 22, 12, "#5c5c62"); px(g, 4, 10, 24, 3, "#8a8a92"); px(g, 4, 10, 24, 1, "#b0b0b8"); px(g, 5, 20, 22, 3, "#3e3e44");
    for (const x of [8, 15, 22]) px(g, x, 13, 2, 7, "#3e3e44");
    px(g, 7, 6, 6, 5, "#8b8e8c"); px(g, 12, 4, 7, 7, "#666a70"); px(g, 18, 6, 6, 5, "#8b8e8c"); dot(g, 14, 6, "#d0743a"); dot(g, 20, 7, "#f2c744");
    for (const x of [9, 23]) { ell(g, x, 24, 3, 3, "#2d2d30"); dot(g, x, 24, "#9a9aa2"); }
    outline(c, OUT);
  });
}
function telescopeSprite() {
  return cached("rv:telescope", A, A, (g, c) => {
    px(g, 15, 18, 2, 12, PLANK.dark); px(g, 8, 28, 2, 3, PLANK.dark); px(g, 22, 28, 2, 3, PLANK.dark);
    for (let i = 0; i < 10; i++) { dot(g, 15 - i * 0.7, 18 + i, PLANK.mid); dot(g, 16 + i * 0.7, 18 + i, PLANK.mid); }
    for (let i = 0; i < 18; i++) px(g, 6 + i, 16 - Math.round(i * 0.55), 4, 4, i < 4 ? "#b08a20" : i % 5 === 0 ? "#f2e2a0" : "#d9a640");
    px(g, 4, 15, 3, 5, "#8a6a20"); px(g, 24, 4, 4, 5, "#3a3a40"); dot(g, 26, 5, "#a8dcf7");
    px(g, 14, 15, 4, 4, "#5a3a22");
    outline(c, OUT);
  });
}

// ------------------------------------------------------------------ icons for the things the Revival brings
const ICONS = {
  valley_medal: (g) => {   // a gold medal on a pink and green ribbon, a sprout stamped in the middle
    px(g, 9, 2, 6, 12, "#e86a9a"); px(g, 17, 2, 6, 12, "#5fb04a"); px(g, 9, 2, 6, 1, "#ff9cc6"); px(g, 17, 2, 6, 1, "#8ed66a");
    px(g, 13, 10, 6, 4, "#c9a640");
    ell(g, 16, 20, 8, 8, "#b08a20"); ell(g, 16, 20, 7, 7, "#f2c744"); ell(g, 14, 18, 3, 3, "#fff2a8");
    px(g, 16, 18, 1, 6, "#b08a20"); px(g, 13, 19, 3, 1, "#b08a20"); px(g, 17, 18, 3, 1, "#b08a20"); dot(g, 12, 18, "#b08a20"); dot(g, 20, 17, "#b08a20");
  },
};
// the festival hunts: little things hidden around town
Object.assign(ICONS, {
  painted_egg: (g) => { ell(g, 16, 17, 8, 10, "#ff9cc6"); px(g, 9, 14, 15, 3, "#7fd8e8"); px(g, 9, 20, 15, 2, "#f2c744"); for (const x of [11, 15, 19]) dot(g, x, 15, "#ffffff"); ell(g, 13, 11, 2, 3, "#ffd0e8"); },
  lucky_horseshoe: (g) => { for (let a = 0.5; a < 5.8; a += 0.05) { const x = Math.round(16 + Math.cos(a + 1.57) * 9), y = Math.round(15 - Math.sin(a + 1.57) * 10); px(g, x - 1, y - 1, 3, 3, "#9a9aa2"); dot(g, x, y - 1, "#d0d0d8"); } for (const [x, y] of [[9, 12], [23, 12], [8, 18], [24, 18]]) dot(g, x, y, "#3e3e44"); },
  lost_rosette: (g) => { for (let a = 0; a < 6.28; a += 0.45) ell(g, Math.round(16 + Math.cos(a) * 7), Math.round(13 + Math.sin(a) * 7), 3, 3, "#e86a9a"); ell(g, 16, 13, 5, 5, "#f2c744"); ell(g, 16, 13, 3, 3, "#fff2a8"); px(g, 11, 19, 4, 10, "#e86a9a"); px(g, 17, 19, 4, 10, "#c94a7a"); },
  candy_corn: (g) => { for (let y = 6; y < 27; y++) { const hw = Math.round((y - 4) * 0.42); px(g, 16 - hw, y, hw * 2 + 1, 1, y < 12 ? "#f4f1ea" : y < 19 ? "#f28c28" : "#f2c744"); } dot(g, 13, 14, "#ffc080"); },
  lost_mitten: (g) => { px(g, 9, 9, 12, 15, "#d9463c"); ell(g, 15, 9, 6, 3, "#d9463c"); px(g, 21, 13, 3, 7, "#d9463c"); px(g, 22, 12, 2, 2, "#d9463c"); px(g, 9, 24, 13, 4, "#f4f1ea"); for (const x of [11, 15, 19]) px(g, x, 13, 2, 2, "#f4f1ea"); px(g, 10, 9, 11, 1, "#e86a5a"); },
  glass_ornament: (g) => { px(g, 14, 4, 4, 4, "#d9a640"); px(g, 15, 2, 2, 2, "#b08a20"); ell(g, 16, 17, 10, 10, "#3a7bd5"); ell(g, 13, 13, 4, 4, "#8ab8f0"); dot(g, 12, 12, "#ffffff"); px(g, 7, 18, 19, 2, "#f2c744"); for (const x of [10, 16, 22]) dot(g, x, 22, "#ffffff"); },
});
const AGED = {   // aged in the cellar: the plain icon, dressed up (a wax seal, a ribbon, a glow)
  aged_cheese: ["cheese", (g) => { px(g, 3, 25, 26, 2, "#b0761e"); px(g, 9, 15, 3, 3, "#c4891e"); px(g, 18, 19, 4, 2, "#c4891e"); ell(g, 23, 12, 4, 4, "#a8242c"); dot(g, 22, 11, "#e86a6a"); }],
  vintage_jam: ["jam", (g) => { px(g, 9, 9, 14, 2, "#f2c744"); px(g, 14, 9, 4, 6, "#f2c744"); dot(g, 15, 15, "#b08a20"); px(g, 10, 16, 12, 10, "rgba(70,10,40,0.45)"); }],
  aged_pickles: ["pickles", (g) => { px(g, 9, 10, 14, 1, "#c9a66b"); px(g, 9, 13, 14, 1, "#c9a66b"); px(g, 10, 16, 12, 10, "rgba(20,50,10,0.4)"); }],
  golden_honey: ["honey", (g) => { px(g, 9, 6, 14, 3, "#f2c744"); px(g, 9, 6, 14, 1, "#fff2a8"); dot(g, 25, 8, "#fff2a8"); dot(g, 26, 9, "#ffffff"); dot(g, 24, 9, "#fff2a8"); dot(g, 25, 10, "#fff2a8"); }],
};
const prevIconR = ART.iconCanvas;
ART.iconCanvas = function (key, cat) {
  if (ICONS[key]) return cached("rv:icon:" + key, A, A, (g, c) => { ICONS[key](g); outline(c, OUT); });
  if (AGED[key]) return cached("rv:icon:" + key, A, A, (g) => { g.drawImage(prevIconR(AGED[key][0], cat), 0, 0); AGED[key][1](g); });
  const d = decorSprite(key);
  return d || prevIconR(key, cat);
};
ART.REVIVAL_ICONS = ICONS;

Object.assign(ART, { fountainDry, wiltedPlanter, weedSprite, boardsSprite, stallShut, springTile, hotSpringSprite, monumentSprite, lanternSprite, decorSprite, minecartSprite, telescopeSprite });
})();
