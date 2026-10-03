/* Cozy Hollow art - the rare pets: sixteen little friends that turn up, once in a long while, while you fish, mine, chop,
   harvest, forage, catch bugs, dig, fight, hunt, gather eggs, milk, cook, water, sail and wish (the clinic's dogs and cats
   are in art-life.js). Same chibi rules as the dogs and cats: big heads, big shiny eyes, rosy cheeks, four facings (left is
   right mirrored), a 4-frame trot (0 standing, 1-3 on the move), 32px, outline(OUT). ART.petSprite draws them all. */
"use strict";
(function () {
const ART = window.ART;
const { A, px, mix, shade, cached, outline, mirrored, OUT } = ART;
const WHITE = "#ffffff", EYE = "#2a1f1a", SHINE = "#ffffff", BLUSH = "#f4a0a8", PINK = "#f08a9a";
const dot = (g, x, y, c) => px(g, x, y, 1, 1, c);
function hexOf(c) { if (c[0] === "#") return c; const m = /\(([^)]+)\)/.exec(c)[1].split(",").map(Number); return "#" + m.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join(""); }
const lt = (c, t) => hexOf(mix(hexOf(c), WHITE, t)), dk = (c, f) => hexOf(shade(hexOf(c), f));
function ell(g, cx, cy, rx, ry, col) { for (let dy = -ry; dy <= ry; dy++) { const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.4) * (ry + 0.4))))); px(g, cx - hw, cy + dy, hw * 2 + 1, 1, col); } }
function body(g, cx, cy, rx, ry, col) { ell(g, cx, cy, rx, ry, dk(col, 0.74)); ell(g, cx - 1, cy - 1, rx - 1, ry - 1, col); ell(g, cx - Math.ceil(rx / 2.6), cy - Math.ceil(ry / 2.6), Math.max(1, Math.floor(rx / 3)), Math.max(1, Math.floor(ry / 3)), lt(col, 0.35)); }
function tri(g, x, y, w, h, col, lean) { for (let r = 0; r < h; r++) { const ww = Math.max(1, Math.round(w * (r + 1) / h)); px(g, x + Math.round((w - ww) / 2 + (lean || 0) * (h - 1 - r) / h), y + r, ww, 1, col); } }
function eye(g, x, y, h) { px(g, x, y, 2, h, EYE); dot(g, x, y, SHINE); if (h > 2) dot(g, x + 1, y + h - 1, "#5a4a6a"); }
function happy(g, x, y) { dot(g, x, y + 1, EYE); px(g, x + 1, y, 1, 1, EYE); dot(g, x + 2, y + 1, EYE); }     // a closed, smiling eye: ^
function bugEye(g, x, y) { px(g, x, y, 3, 4, WHITE); px(g, x + 1, y + 1, 2, 3, EYE); dot(g, x + 1, y + 1, SHINE); }
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function smile(g, x, y) { dot(g, x, y, OUT); px(g, x + 1, y + 1, 2, 1, OUT); dot(g, x + 3, y, OUT); }
function glow(g, cx, cy, r, col) {     // a soft halo, laid in behind a finished (outlined) sprite
  g.globalCompositeOperation = "destination-over";
  for (let i = 1; i <= r; i += 2) { g.globalAlpha = 0.09; ell(g, cx, cy, i, i, col); }
  g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
}
const HOVER = [0, -1, -2, -1];

// ------------------------------------------------------------------ the four-legged ones share a body plan; each has its own bits
const QUAD = {
  otter: { c: "#8e5c3a", d: "#6c4228", l: "#ae7c54", w: "#f2dcc0", nose: "#3a2620", ears: "round", tail: "otter", low: 1, whisk: 1 },
  beaver: { c: "#a26a3c", d: "#784a2a", l: "#c28c5a", w: "#f4e2c6", nose: "#3a2620", ears: "round", tail: "paddle", chub: 1, teeth: 1 },
  fox: { c: "#f08a3a", d: "#c46426", l: "#f8b474", w: "#fff6ec", nose: EYE, ears: "fox", tail: "bushy", socks: "#3e2a26" },
  calf: { c: "#f6f2ec", d: "#d4ccc2", l: "#ffffff", w: "#f6bcc4", nose: "#c87a8a", ears: "cow", tail: "cow", spots: "#6a4a3a", tall: 1, hooves: "#5a4034", bell: 1 },
  mouse: { c: "#c2bec8", d: "#9894a2", l: "#dedae4", w: "#f6f2f8", nose: PINK, ears: "mouse", tail: "mouse", small: 1, hat: 1 },
};
function quadSprite(kind, facing, frame) {
  const P = QUAD[kind], key = "pet" + kind + facing + frame;
  if (facing === "left") return mirrored(key + "L", quadSprite(kind, "right", frame));
  return cached(key, A, A, (g, cv) => {
    const walk = frame > 0, a = walk ? frame % 2 : 0, b = walk && frame % 2 ? 1 : 0;
    const sm = P.small ? 1 : 0, low = P.low ? 1 : 0, tall = P.tall ? 1 : 0;
    if (facing === "right") {
      const leg = sm ? 3 : low ? 4 : tall ? 7 : 5, top = 27 - leg;
      const by = top - (sm ? 2 : low ? 2 : 3) - b, brx = sm ? 6 : low ? 10 : P.chub ? 8 : 8, bry = sm ? 4 : low ? 4 : P.chub ? 6 : 5;
      const bx = sm ? 14 : low ? 13 : 14;
      // the tail, behind
      if (P.tail === "otter") { for (let i = 0; i < 7; i++) px(g, bx - brx - i + 1, by + 1 + Math.round(i / 2.5), 3, 4 - Math.round(i / 3), i > 4 ? P.d : P.c); }
      else if (P.tail === "paddle") { const wag = frame % 2; ell(g, bx - brx - 1, by + 5 - wag, 4, 2, "#5a3c2c"); for (const x of [-3, -1, 1]) px(g, bx - brx - 1 + x, by + 4 - wag, 1, 3, "#3e2a20"); }
      else if (P.tail === "bushy") { const wag = frame % 3 - 1; body(g, bx - brx - 1, by - 3 + wag, 4, 6, P.c); ell(g, bx - brx - 2, by - 8 + wag, 2, 2, P.w); }
      else if (P.tail === "cow") { px(g, bx - brx - 1, by - 2, 2, 7, P.d); px(g, bx - brx - 2, by + 4, 3, 3, P.spots); }
      else if (P.tail === "mouse") { for (let i = 0; i < 9; i++) dot(g, bx - brx - i, by + 1 - Math.round(Math.sin(i / 2.2 + frame) * 2), "#e89aa8"); }
      // legs: two far a shade darker, two near
      const lx = sm ? [10, 15, 12, 17] : low ? [6, 17, 9, 20] : [bx - 6, bx + 4, bx - 3, bx + 7];
      for (const [i, up, far] of [[0, a, 1], [1, 1 - a, 1], [2, 1 - a, 0], [3, a, 0]]) {
        px(g, lx[i], top - up, sm ? 2 : 3, leg, far ? P.d : P.c);
        if (P.socks) px(g, lx[i], top + leg - 3 - up, 3, 3, far ? dk(P.socks, 0.8) : P.socks);
        if (P.hooves) px(g, lx[i], top + leg - 1 - up, 3, 1, P.hooves); else px(g, lx[i], top + leg - 1 - up, sm ? 2 : 3, 1, P.w);
      }
      body(g, bx, by, brx, bry, P.c); ell(g, bx, by + bry - 2, Math.max(2, brx - 3), 1, P.w);
      if (P.spots) { px(g, bx - 5, by - 3, 4, 3, P.spots); px(g, bx + 1, by - 1, 3, 3, P.spots); px(g, bx - 1, by - 4, 2, 2, P.spots); }
      // head
      const hx = sm ? 21 : low ? 23 : 21, hy = (sm ? 17 : low ? 15 : tall ? 10 : 11) - b, hrx = sm ? 5 : low ? 6 : 7, hry = sm ? 5 : low ? 5 : 6;
      if (P.ears === "fox") { tri(g, hx - 6, hy - hry - 5, 5, 7, P.c, -1); tri(g, hx, hy - hry - 5, 5, 7, P.c, 1); px(g, hx - 5, hy - hry - 5, 2, 2, P.socks); px(g, hx + 2, hy - hry - 5, 2, 2, P.socks); tri(g, hx + 1, hy - hry - 2, 3, 3, P.w); }
      if (P.ears === "mouse") { ell(g, hx - 3, hy - hry - 2, 3, 3, P.c); ell(g, hx - 3, hy - hry - 2, 2, 2, "#f4b0bc"); }
      if (P.ears === "cow") { px(g, hx - hrx - 2, hy - 3, 5, 3, P.c); px(g, hx - hrx - 1, hy - 2, 3, 1, "#f4c0c8"); px(g, hx - 2, hy - hry - 2, 2, 3, "#e8d8b8"); }
      body(g, hx, hy, hrx, hry, P.c);
      if (P.ears === "round") { ell(g, hx - 3, hy - hry + 1, 2, 2, P.d); dot(g, hx - 3, hy - hry + 1, P.l); }
      if (P.spots) px(g, hx - 4, hy - 4, 3, 3, P.spots);
      if (P.ears === "fox") ell(g, hx + 3, hy + 3, 4, 2, P.w);
      // the muzzle: an otter's whiskery one, a beaver's buck teeth, a calf's big pink nose, a fox's pointed snout
      const mx = hx + hrx - 2, my = hy + 2;
      if (P.ears === "cow") { ell(g, mx + 1, my + 1, 3, 3, P.w); dot(g, mx + 2, my, P.nose); dot(g, mx + 2, my + 2, P.nose); }
      else if (P.ears === "fox") { px(g, mx, my, 4, 3, P.w); px(g, mx + 4, my, 1, 2, P.nose); }
      else { ell(g, mx, my, 3, 2, P.w); dot(g, mx + 3, my - 1, P.nose); px(g, mx + 2, my - 1, 2, 1, P.nose); }
      if (P.teeth) { px(g, mx + 1, my + 2, 2, 3, WHITE); dot(g, mx + 1, my + 4, "#d8d0c4"); }
      if (P.whisk) { dot(g, mx + 4, my + 1, P.l); dot(g, mx + 5, my, P.l); }
      eye(g, hx + 1, hy - 3, sm ? 2 : 3); px(g, hx - 1, hy + 2, 2, 1, BLUSH);
      if (P.hat) { px(g, hx - 4, hy - hry - 3, 7, 3, WHITE); ell(g, hx - 1, hy - hry - 5, 4, 2, WHITE); px(g, hx - 4, hy - hry - 1, 7, 1, "#e0dcd4"); }
      if (P.bell) { px(g, hx - 4, hy + hry - 1, 5, 1, "#c84a4a"); px(g, hx - 3, hy + hry, 2, 2, "#f2c744"); }
    } else {
      const back = facing === "up";
      const bry = sm ? 4 : 5, brx = sm ? 5 : P.chub ? 8 : 7, by = (sm ? 23 : 22) - b, hy = (sm ? 15 : tall ? 10 : 11) - b, hrx = sm ? 6 : low ? 8 : 8, hry = sm ? 5 : 7;
      // the tail: up behind the back, or peeking round the side in front
      if (P.tail === "bushy") { if (back) { body(g, 16, by - 4, 3, 6, P.c); ell(g, 16, by - 9, 2, 2, P.w); } else { body(g, 24, by - 2, 3, 5, P.c); ell(g, 25, by - 6, 2, 2, P.w); } }
      else if (P.tail === "paddle") { if (back) { ell(g, 16, by + 2, 4, 3, "#5a3c2c"); for (const x of [14, 16, 18]) px(g, x, by, 1, 4, "#3e2a20"); } else ell(g, 16, 27, 5, 1, "#5a3c2c"); }
      else if (P.tail === "otter") { if (back) px(g, 15, by - 1, 3, 9, P.c); else px(g, 23, by + 2, 4, 3, P.c); }
      else if (P.tail === "cow") { if (back) { px(g, 15, by - 4, 2, 8, P.d); px(g, 14, by + 3, 4, 3, P.spots); } }
      else if (P.tail === "mouse") { for (let i = 0; i < 8; i++) dot(g, back ? 16 + Math.round(Math.sin(i / 2 + frame) * 2) : 21 + i, back ? by - 4 - i : by + 3 - Math.round(Math.sin(i / 2 + frame) * 2), "#e89aa8"); }
      body(g, 16, by, brx, bry, P.c);
      if (!back) ell(g, 16, by, Math.max(2, brx - 4), bry - 2, P.w);
      if (P.spots && back) { px(g, 12, by - 3, 4, 3, P.spots); px(g, 18, by - 1, 3, 3, P.spots); }
      for (const [x, up] of [[sm ? 12 : 11, a], [sm ? 17 : 18, 1 - a]]) {
        px(g, x, by + 2 - up, sm ? 3 : 4, sm ? 3 : tall ? 6 : 4, P.socks || P.c);
        px(g, x, by + (sm ? 4 : tall ? 7 : 5) - up, sm ? 3 : 4, 1, P.hooves || P.w);
      }
      // head and ears
      if (P.ears === "fox") { tri(g, 8, hy - 11, 6, 8, P.c, -1); tri(g, 18, hy - 11, 6, 8, P.c, 1); px(g, 8, hy - 11, 2, 2, P.socks); px(g, 22, hy - 11, 2, 2, P.socks); if (!back) { tri(g, 9, hy - 8, 4, 4, P.w, -1); tri(g, 19, hy - 8, 4, 4, P.w, 1); } }
      if (P.ears === "mouse") { for (const x of [9, 23]) { ell(g, x, hy - hry, 4, 4, P.c); if (!back) ell(g, x, hy - hry, 2, 2, "#f4b0bc"); } }
      if (P.ears === "cow") { px(g, 3, hy - 3, 6, 3, P.c); px(g, 23, hy - 3, 6, 3, P.c); if (!back) { px(g, 4, hy - 2, 4, 1, "#f4c0c8"); px(g, 24, hy - 2, 4, 1, "#f4c0c8"); } px(g, 11, hy - hry - 1, 2, 3, "#e8d8b8"); px(g, 19, hy - hry - 1, 2, 3, "#e8d8b8"); }
      body(g, 16, hy, hrx, hry, P.c);
      if (P.ears === "round") for (const x of [9, 23]) { ell(g, x, hy - hry + 2, 2, 2, P.d); if (!back) dot(g, x, hy - hry + 2, P.l); }
      if (back) { if (P.spots) px(g, 14, hy - 4, 4, 3, P.spots); }
      else {
        if (P.spots) px(g, 9, hy - 5, 4, 3, P.spots);
        if (P.ears === "fox") { ell(g, 12, hy + 2, 3, 3, P.w); ell(g, 20, hy + 2, 3, 3, P.w); }
        if (P.ears === "cow") { ell(g, 16, hy + 4, 5, 3, P.w); dot(g, 14, hy + 4, P.nose); dot(g, 18, hy + 4, P.nose); }
        else { ell(g, 16, hy + 3, P.ears === "fox" ? 3 : P.whisk ? 5 : 4, P.whisk ? 3 : 2, P.w); px(g, 15, hy + 1, 3, 2, P.nose); }
        if (P.teeth) { px(g, 14, hy + 4, 4, 3, WHITE); px(g, 16, hy + 4, 1, 3, "#d8d0c4"); }
        if (P.whisk && !walk) { ell(g, 16, by - 1, 2, 2, "#7e8896"); dot(g, 15, by - 2, "#d0d8e2"); for (const x of [12, 19]) px(g, x, by - 2, 2, 3, P.c); }   // its favourite pebble
        if (P.whisk) { for (const x of [9, 22]) px(g, x, hy + 2, 2, 1, P.l); }
        const eh = sm ? 2 : 3, ey = hy - (sm ? 1 : 2);
        eye(g, sm ? 12 : 11, ey, eh); eye(g, sm ? 19 : 19, ey, eh);
        px(g, sm ? 10 : 9, hy + 2, 2, 1, BLUSH); px(g, sm ? 21 : 21, hy + 2, 2, 1, BLUSH);
        if (P.bell) { px(g, 12, hy + hry - 1, 9, 1, "#c84a4a"); px(g, 15, hy + hry, 3, 2, "#f2c744"); }
      }
      if (P.hat) { px(g, 12, hy - hry - 2, 9, 3, WHITE); ell(g, 16, hy - hry - 5, 5, 3, WHITE); px(g, 12, hy - hry, 9, 1, "#e0dcd4"); }
    }
    outline(cv, OUT);
  });
}

// ------------------------------------------------------------------ the rest have shapes of their own
// each draws facing "right" (mirrored for left), "down" or "up"; frame 0 stands still, 1-3 are on the move
const SHAPES = {
  hedgehog(g, facing, frame) {
    const walk = frame > 0, a = walk ? frame % 2 : 0, b = walk && frame % 2 ? 1 : 0;
    const SP = "#7a5638", SD = "#56381f", TIP = "#d8b07a", FACE = "#f2dcb4";
    if (facing === "right") {
      for (const [x, up] of [[10, a], [18, 1 - a]]) px(g, x, 24 - up, 3, 3, "#c8a47a");
      ell(g, 15, 22 - b, 9, 3, FACE);
      for (let i = 0; i < 9; i++) tri(g, 5 + i * 2, 9 + Math.abs(i - 4) - b, 3, 5, i % 2 ? SD : SP);
      body(g, 14, 18 - b, 9, 7, SP);
      for (const [x, y] of [[8, 14], [12, 12], [16, 13], [10, 18], [15, 17], [19, 16], [7, 20]]) { px(g, x, y - b, 2, 1, TIP); dot(g, x + 1, y + 1 - b, SD); }
      body(g, 23, 19 - b, 5, 5, FACE); px(g, 27, 19 - b, 3, 3, FACE); dot(g, 30, 19 - b, EYE); px(g, 29, 18 - b, 2, 2, EYE);
      eye(g, 23, 16 - b, 3); px(g, 21, 21 - b, 2, 1, BLUSH); ell(g, 20, 13 - b, 2, 2, FACE);
    } else {
      const back = facing === "up";
      for (const [x, up] of [[11, a], [18, 1 - a]]) px(g, x, 25 - up, 3, 3, "#c8a47a");
      for (let i = 0; i < 9; i++) tri(g, 4 + i * 3, 6 + Math.abs(i - 4) - b, 3, 6, i % 2 ? SD : SP);
      body(g, 16, 17 - b, 11, 9, SP);
      if (back) { for (const [x, y] of [[9, 12], [14, 10], [19, 11], [11, 17], [17, 16], [22, 15], [13, 21], [20, 21]]) { px(g, x, y - b, 2, 1, TIP); dot(g, x + 1, y + 1 - b, SD); } }
      else {
        body(g, 16, 20 - b, 7, 6, FACE); ell(g, 16, 23 - b, 2, 2, FACE); px(g, 15, 23 - b, 3, 2, EYE); dot(g, 15, 23 - b, "#6a5a5a");
        eye(g, 12, 18 - b, 3); eye(g, 19, 18 - b, 3); px(g, 10, 22 - b, 2, 1, BLUSH); px(g, 21, 22 - b, 2, 1, BLUSH);
        ell(g, 9, 12 - b, 2, 2, FACE); ell(g, 23, 12 - b, 2, 2, FACE);
      }
    }
  },
  mole(g, facing, frame) {
    const walk = frame > 0, a = walk ? frame % 2 : 0, b = walk && frame % 2 ? 1 : 0;
    const C = "#5c5270", L = "#7c7294", NOSE = "#f49ab0", PAW = "#f4b4c2";
    if (facing === "right") {
      ell(g, 13, 26, 9, 1, "#8a6a4a");                                  // a little dirt where it's been
      for (const [x, up] of [[8, a], [15, 1 - a]]) px(g, x, 24 - up, 4, 2, PAW);
      body(g, 14, 18 - b, 10, 8, C); ell(g, 10, 13 - b, 4, 2, L);
      px(g, 22, 21 - b, 5, 3, PAW); for (const x of [22, 24, 26]) dot(g, x, 24 - b, "#d88a9a");     // a big digging paw
      ell(g, 20, 15 - b, 5, 3, "#a89cbc");
      ell(g, 25, 16 - b, 3, 2, NOSE); dot(g, 27, 15 - b, lt(NOSE, 0.5));
      happy(g, 19, 13 - b); px(g, 17, 16 - b, 2, 1, BLUSH);
    } else {
      const back = facing === "up";
      ell(g, 16, 27, 10, 1, "#8a6a4a");
      body(g, 16, 18 - b, 11, 9, C);
      if (back) { ell(g, 12, 12 - b, 4, 2, L); for (const [x, up] of [[9, a], [20, 1 - a]]) px(g, x, 25 - up, 4, 2, PAW); }
      else {
        ell(g, 12, 11 - b, 3, 2, L);
        for (const [x, up] of [[6, a], [22, 1 - a]]) { px(g, x, 20 - up - b, 5, 4, PAW); for (const k of [0, 2, 4]) dot(g, x + k, 24 - up - b, "#d88a9a"); }
        ell(g, 16, 16 - b, 8, 4, "#a89cbc");
        ell(g, 16, 19 - b, 3, 2, NOSE); dot(g, 15, 18 - b, lt(NOSE, 0.5));
        happy(g, 10, 14 - b); happy(g, 19, 14 - b); px(g, 9, 17 - b, 2, 1, BLUSH); px(g, 22, 17 - b, 2, 1, BLUSH);
      }
    }
  },
  golem(g, facing, frame) {
    const walk = frame > 0, a = walk ? frame % 2 : 0, b = walk && frame % 2 ? 1 : 0;
    const S = "#9c9ca8", D = "#727280", MOSS = "#6cb04a", GEM = "#7fd8f0";
    const side = facing === "right", back = facing === "up";
    for (const [x, up] of side ? [[10, a], [17, 1 - a]] : [[10, a], [18, 1 - a]]) { px(g, x, 23 - up, 5, 4, D); px(g, x, 26 - up, 5, 1, dk(D, 0.8)); }
    body(g, 16, 16 - b, 11, 10, S);
    for (const [x, y, w] of [[9, 20, 4], [19, 9, 3], [21, 19, 3], [12, 11, 2]]) px(g, x, y - b, w, 1, D);         // cracks
    ell(g, 15, 7 - b, 6, 2, MOSS); px(g, 14, 3 - b, 1, 3, "#3f8a3a"); ell(g, 12, 3 - b, 2, 1, MOSS); ell(g, 17, 3 - b, 2, 1, MOSS);   // moss and a sprout
    if (side) {
      px(g, 22, 15 - b + a, 3, 6, D); px(g, 6, 15 - b + 1 - a, 3, 6, D);        // stubby stone arms
      px(g, 8, 10 - b, 3, 4, GEM); dot(g, 8, 10 - b, WHITE);                   // a crystal growing on its back
      eye(g, 19, 13 - b, 3); eye(g, 23, 13 - b, 3); px(g, 21, 18 - b, 2, 1, OUT); px(g, 17, 17 - b, 2, 1, BLUSH);
    } else {
      px(g, 2, 15 - b + a, 4, 6, D); px(g, 26, 15 - b + 1 - a, 4, 6, D);
      if (back) { px(g, 14, 12 - b, 4, 5, GEM); px(g, 14, 12 - b, 2, 2, WHITE); px(g, 19, 15 - b, 2, 3, GEM); }
      else { eye(g, 11, 13 - b, 3); eye(g, 19, 13 - b, 3); smile(g, 14, 18 - b); px(g, 8, 17 - b, 2, 1, BLUSH); px(g, 22, 17 - b, 2, 1, BLUSH); }
    }
  },
  sprout(g, facing, frame) {
    const walk = frame > 0, a = walk ? frame % 2 : 0, b = walk && frame % 2 ? 1 : 0, sway = walk ? (frame % 3) - 1 : 0;
    const BODY = "#f4ecd6", TOP = "#c8e89a", LEAF = "#5fbe4a", LD = "#3f9438", ROOT = "#d8b888";
    const back = facing === "up", side = facing === "right";
    for (const [x, up] of [[12, a], [18, 1 - a]]) { px(g, x, 24 - up, 2, 3, ROOT); dot(g, x - 1, 26 - up, ROOT); }
    body(g, 16, 18 - b, 8, 7, BODY); ell(g, 16, 12 - b, 6, 2, TOP);
    px(g, 15, 5 - b, 2, 6, LD);                                                   // the stem, and two leaves that bob as it walks
    for (const [x, d] of [[10, -1], [18, 1]]) { ell(g, x + 2 + sway * d, 5 - b - (d > 0 ? 1 : 0), 3, 2, LEAF); dot(g, x + 2 + d * 2 + sway * d, 4 - b, LD); }
    if (back) { ell(g, 16, 20 - b, 3, 2, dk(BODY, 0.94)); return; }
    if (side) { px(g, 23, 18 - b, 2, 1, ROOT); eye(g, 19, 15 - b, 3); px(g, 17, 20 - b, 2, 1, BLUSH); dot(g, 22, 20 - b, OUT); return; }
    eye(g, 12, 15 - b, 3); eye(g, 19, 15 - b, 3); smile(g, 14, 20 - b); px(g, 10, 19 - b, 2, 1, BLUSH); px(g, 21, 19 - b, 2, 1, BLUSH);
  },
  glowbug(g, facing, frame) {
    const flap = frame % 2, hov = HOVER[frame % 4];
    const BOD = "#4a3c62", GL = "#ffe45a", CORE = "#fff6b8", WING = "#d8ecff";
    if (facing === "right") {
      ell(g, 9, 19 + hov, 5, 4, GL); ell(g, 8, 18 + hov, 3, 2, CORE);                                   // the glowing tail
      body(g, 15, 16 + hov, 5, 4, BOD);
      ell(g, 13, 10 + hov - flap, 4, 3 + flap, WING); ell(g, 17, 10 + hov - flap, 3, 2 + flap, lt(WING, 0.4));
      body(g, 21, 15 + hov, 5, 5, BOD); px(g, 22, 7 + hov, 1, 4, BOD); px(g, 25, 8 + hov, 1, 3, BOD); dot(g, 22, 6 + hov, GL); dot(g, 25, 7 + hov, GL);
      bugEye(g, 22, 12 + hov); px(g, 20, 17 + hov, 2, 1, BLUSH);
      for (const x of [13, 17]) px(g, x, 20 + hov, 1, 3, BOD);
    } else {
      const back = facing === "up";
      if (back) { ell(g, 16, 22 + hov, 5, 4, GL); ell(g, 16, 21 + hov, 3, 2, CORE); }
      ell(g, 9, 12 + hov - flap, 5, 3 + flap, WING); ell(g, 23, 12 + hov - flap, 5, 3 + flap, WING);
      body(g, 16, 16 + hov, 6, 5, BOD);
      if (!back) { ell(g, 16, 22 + hov, 4, 3, GL); ell(g, 16, 22 + hov, 2, 1, CORE); }
      body(g, 16, 12 + hov, 6, 5, BOD); px(g, 13, 4 + hov, 1, 4, BOD); px(g, 19, 4 + hov, 1, 4, BOD); dot(g, 13, 3 + hov, GL); dot(g, 19, 3 + hov, GL);
      if (!back) { bugEye(g, 11, 9 + hov); bugEye(g, 18, 9 + hov); px(g, 10, 14 + hov, 2, 1, BLUSH); px(g, 21, 14 + hov, 2, 1, BLUSH); }
    }
  },
  slimeling(g, facing, frame) { slime(g, facing, frame, "#72d86a", false); },
  kingling(g, facing, frame) { slime(g, facing, frame, "#b48af0", true); },
  chick(g, facing, frame) {
    const walk = frame > 0, a = walk ? frame % 2 : 0, b = walk && frame % 2 ? 1 : 0;
    const C = "#ffd84a", D = "#eab02c", BEAK = "#f28a2a";
    for (const [x, up] of [[13, a], [17, 1 - a]]) { px(g, x, 23 - up, 1, 3, BEAK); px(g, x - 1, 26 - up, 3, 1, BEAK); }
    body(g, 16, 18 - b, 8, 7, C);
    px(g, 15, 9 - b, 1, 3, D); px(g, 17, 10 - b, 1, 2, D); dot(g, 16, 9 - b, C);       // a fluffy tuft
    if (facing === "right") {
      ell(g, 12, 19 - b + (walk ? -a : 0), 3, 2, D);                                   // a tiny wing
      px(g, 24, 16 - b, 3, 2, BEAK); eye(g, 19, 14 - b, 3); px(g, 17, 18 - b, 2, 1, BLUSH);
    } else if (facing === "down") {
      ell(g, 9, 19 - b - a, 2, 3, D); ell(g, 23, 19 - b - (1 - a), 2, 3, D);
      px(g, 15, 17 - b, 3, 2, BEAK); dot(g, 16, 19 - b, dk(BEAK, 0.8));
      eye(g, 12, 14 - b, 3); eye(g, 19, 14 - b, 3); px(g, 10, 18 - b, 2, 1, BLUSH); px(g, 21, 18 - b, 2, 1, BLUSH);
    } else { ell(g, 16, 21 - b, 4, 3, D); }
  },
  frog(g, facing, frame) {
    const hop = [0, 2, 3, 1][frame % 4], walk = frame > 0;
    const C = "#6cc24a", D = "#4a9a34", BEL = "#eaf6b4";
    const y = -hop;
    if (facing === "right") {
      px(g, 8, 24 + y + (walk ? 1 : 0), 7, 3, D); px(g, 6, 26 + (walk ? 0 : y), 5, 1, D);              // the big back leg
      body(g, 15, 20 + y, 9, 6, C); ell(g, 17, 23 + y, 6, 2, BEL);
      px(g, 21, 24 + y, 3, 3, C); px(g, 21, 26 + y, 4, 1, D);
      ell(g, 20, 13 + y, 4, 4, C); ell(g, 20, 12 + y, 3, 3, WHITE); px(g, 21, 11 + y, 2, 3, EYE); dot(g, 21, 11 + y, SHINE);
      px(g, 20, 20 + y, 5, 1, OUT); dot(g, 24, 19 + y, OUT); px(g, 18, 18 + y, 2, 1, BLUSH);
    } else {
      const back = facing === "up";
      for (const x of [6, 22]) { px(g, x, 23 + y, 5, 4, D); px(g, x - 1, 26 + y, 6, 1, D); }
      body(g, 16, 20 + y, 10, 6, C);
      for (const x of [10, 22]) { ell(g, x, 13 + y, 4, 4, C); if (!back) { ell(g, x, 12 + y, 3, 3, WHITE); px(g, x - 1, 11 + y, 2, 3, EYE); dot(g, x - 1, 11 + y, SHINE); } }
      if (back) { for (const [x, yy] of [[12, 18], [19, 20], [15, 22]]) px(g, x, yy + y, 2, 2, D); }
      else { ell(g, 16, 23 + y, 6, 3, BEL); smile(g, 13, 19 + y); px(g, 14, 20 + y, 4, 1, OUT); px(g, 7, 19 + y, 2, 1, BLUSH); px(g, 23, 19 + y, 2, 1, BLUSH); }
    }
  },
  parrot(g, facing, frame) {
    const walk = frame > 0, flap = walk ? frame % 2 : 0, b = walk && frame % 2 ? 1 : 0;
    const R = "#f0a030", Y = "#ffe066", G = "#4ab85a", B = "#3a8ae0", BEAK = "#3e3a3a", FACE = "#fff4e0";
    if (facing === "right") {
      px(g, 7, 20 - b, 4, 8, B); px(g, 8, 24 - b, 3, 4, G);                               // a long tail
      for (const x of [14, 18]) { px(g, x, 23, 1, 3, "#8a8a92"); px(g, x - 1, 26, 3, 1, "#8a8a92"); }
      body(g, 15, 17 - b, 7, 7, R); ell(g, 16, 20 - b, 4, 3, Y);
      ell(g, 12, 16 - b - flap * 2, 4, 4 - flap, G); px(g, 10, 18 - b - flap * 2, 4, 2, B);   // the wing
      body(g, 19, 9 - b, 6, 6, R); ell(g, 21, 10 - b, 3, 3, FACE);
      px(g, 24, 8 - b, 3, 3, BEAK); px(g, 25, 11 - b, 2, 2, BEAK); dot(g, 24, 8 - b, "#6a6466");
      eye(g, 20, 7 - b, 3); px(g, 15, 3 - b, 2, 3, Y); px(g, 17, 2 - b, 2, 3, R);            // a little crest
    } else {
      const back = facing === "up";
      for (const x of [13, 18]) { px(g, x, 23, 1, 3, "#8a8a92"); px(g, x - 1, 26, 3, 1, "#8a8a92"); }
      if (back) px(g, 14, 18 - b, 4, 10, B);
      ell(g, 8, 17 - b - flap * 2, 3, 5 - flap, G); ell(g, 24, 17 - b - flap * 2, 3, 5 - flap, G);
      body(g, 16, 18 - b, 7, 7, R);
      if (!back) ell(g, 16, 20 - b, 4, 4, Y);
      body(g, 16, 9 - b, 7, 6, R); px(g, 14, 2 - b, 2, 3, Y); px(g, 17, 1 - b, 2, 4, R);
      if (!back) {
        ell(g, 11, 10 - b, 3, 3, FACE); ell(g, 21, 10 - b, 3, 3, FACE);
        eye(g, 11, 8 - b, 3); eye(g, 20, 8 - b, 3); px(g, 15, 10 - b, 3, 3, BEAK); px(g, 15, 13 - b, 2, 1, BEAK); dot(g, 15, 10 - b, "#6a6466");
      } else ell(g, 16, 12 - b, 4, 2, G);
    }
  },
  starling(g, facing, frame) {
    const hov = HOVER[frame % 4], twk = frame % 2;
    const C = "#ffe066", D = "#e8b830", L = "#fff6c4";
    const cx = 16, cy = 15 + hov, pts = [];
    for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 5.5 : 12; pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.95]); }
    const inner = pts.map(([x, y]) => [cx + (x - cx) * 0.78, cy + (y - cy) * 0.78 - 0.4]);
    for (let y = 0; y < A; y++) for (let x = 0; x < A; x++) {               // fill pixel by pixel: crisp, no soft edges
      if (inPoly(x + 0.5, y + 0.5, inner)) dot(g, x, y, C); else if (inPoly(x + 0.5, y + 0.5, pts)) dot(g, x, y, D);
    }
    ell(g, 13, 11 + hov, 2, 1, L);
    if (facing === "up") { ell(g, 16, 16 + hov, 3, 2, D); }
    else if (facing === "right") { eye(g, 17, 13 + hov, 3); eye(g, 21, 13 + hov, 3); smile(g, 18, 17 + hov); px(g, 15, 17 + hov, 2, 1, BLUSH); }
    else { eye(g, 12, 13 + hov, 3); eye(g, 18, 13 + hov, 3); smile(g, 14, 17 + hov); px(g, 10, 17 + hov, 2, 1, BLUSH); px(g, 20, 17 + hov, 2, 1, BLUSH); }
    if (twk) { dot(g, 4, 6 + hov, L); dot(g, 27, 24 + hov, L); } else { dot(g, 27, 5 + hov, L); dot(g, 5, 25 + hov, L); }
  },
};
function slime(g, facing, frame, c, king) {
  const sq = [0, 1, 0, -1][frame % 4], hop = frame ? [0, 1, 3, 1][frame % 4] : 0;
  const w = 9 + sq, h = 7 - sq, cx = 16, by = 27 - hop;
  g.globalAlpha = 0.9;
  ell(g, cx, by - h, w, h, dk(c, 0.62)); ell(g, cx - 1, by - h - 1, w - 1, h - 1, c);
  g.globalAlpha = 1;
  ell(g, cx - Math.round(w / 2.4), by - h - Math.round(h / 2), 2, 1, lt(c, 0.7)); dot(g, cx - Math.round(w / 2.4) + 2, by - h - Math.round(h / 2) + 1, lt(c, 0.7));
  px(g, cx - w + 2, by, w * 2 - 3, 1, dk(c, 0.5));
  const ey = by - h - 1, back = facing === "up", side = facing === "right";
  if (!back) {
    const ex = side ? [cx + 1, cx + 5] : [cx - 5, cx + 3];
    for (const x of ex) eye(g, x, ey, 3);
    if (side) { smile(g, cx + 2, ey + 5); px(g, cx - 1, ey + 4, 2, 1, BLUSH); }
    else { smile(g, cx - 2, ey + 5); px(g, cx - 8, ey + 4, 2, 1, BLUSH); px(g, cx + 6, ey + 4, 2, 1, BLUSH); }
  }
  if (king) {
    const ty = by - 2 * h - 2, GOLD = "#f6c840";
    px(g, cx - 6, ty, 12, 3, GOLD); for (let i = 0; i < 3; i++) px(g, cx - 6 + i * 5, ty - 3 + (i % 2), 2, 3, GOLD);
    dot(g, cx, ty + 1, "#e0384f"); dot(g, cx - 4, ty + 1, "#4ab0f0"); dot(g, cx + 4, ty + 1, "#4ab0f0");
    if (!back) { px(g, cx - w, by - 3, 3, 3, "#c83a5a"); px(g, cx + w - 2, by - 3, 3, 3, "#c83a5a"); }   // a little royal cape peeking out
    else { ell(g, cx, by - h + 1, w - 3, h - 2, "#c83a5a"); px(g, cx - 3, by - h - 3, 7, 1, "#f4f0ea"); }
  }
}
const GLOWS = { glowbug: ["#ffe45a", 12, 19, 11], starling: ["#ffe066", 16, 15, 13] };
function shapeSprite(kind, facing, frame) {
  const key = "pet" + kind + facing + frame;
  if (facing === "left") return mirrored(key + "L", shapeSprite(kind, "right", frame));
  return cached(key, A, A, (g, cv) => {
    SHAPES[kind](g, facing, frame); outline(cv, OUT);
    if (GLOWS[kind]) { const [col, x, y, r] = GLOWS[kind]; glow(g, x, y + HOVER[frame % 4], r, col); }
  });
}

// ------------------------------------------------------------------ one front door for every pet
const basePet = ART.petSprite;
ART.RARE_PETS = Object.keys(QUAD).concat(Object.keys(SHAPES));
ART.petSprite = function (kind, facing, frame, coat) {
  if (QUAD[kind]) return quadSprite(kind, facing, frame);
  if (SHAPES[kind]) return shapeSprite(kind, facing, frame);
  return basePet(kind, facing, frame, coat);
};
// a dark shape for pets still out there (the pet window's mysteries)
ART.petShadow = function (kind) {
  return cached("petshadow" + kind, A, A, (g) => {
    g.drawImage(ART.petSprite(kind, "down", 0, ""), 0, 0);
    const img = g.getImageData(0, 0, A, A), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const on = d[i + 3] > 90; d[i] = 0x4a; d[i + 1] = 0x42; d[i + 2] = 0x58; d[i + 3] = on ? 255 : 0; }
    g.putImageData(img, 0, 0);
  });
};
})();
