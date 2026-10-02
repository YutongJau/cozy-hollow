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

// ------------------------------------------------------------------ icons for the things the Revival brings
const ICONS = {
  valley_medal: (g) => {   // a gold medal on a pink and green ribbon, a sprout stamped in the middle
    px(g, 9, 2, 6, 12, "#e86a9a"); px(g, 17, 2, 6, 12, "#5fb04a"); px(g, 9, 2, 6, 1, "#ff9cc6"); px(g, 17, 2, 6, 1, "#8ed66a");
    px(g, 13, 10, 6, 4, "#c9a640");
    ell(g, 16, 20, 8, 8, "#b08a20"); ell(g, 16, 20, 7, 7, "#f2c744"); ell(g, 14, 18, 3, 3, "#fff2a8");
    px(g, 16, 18, 1, 6, "#b08a20"); px(g, 13, 19, 3, 1, "#b08a20"); px(g, 17, 18, 3, 1, "#b08a20"); dot(g, 12, 18, "#b08a20"); dot(g, 20, 17, "#b08a20");
  },
};
const prevIconR = ART.iconCanvas;
ART.iconCanvas = function (key, cat) {
  if (!ICONS[key]) return prevIconR(key, cat);
  return cached("rv:icon:" + key, A, A, (g, c) => { ICONS[key](g); outline(c, OUT); });
};
ART.REVIVAL_ICONS = ICONS;

Object.assign(ART, { fountainDry, wiltedPlanter, weedSprite, boardsSprite, stallShut, springTile, hotSpringSprite, monumentSprite, lanternSprite });
})();
