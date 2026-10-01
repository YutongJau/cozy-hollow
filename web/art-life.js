/* Cozy Hollow art - the living valley: chickens, dogs, cats, horses, wild game, mine monsters, the machines you set
   down, dig spots, balloon presents, treasure chests, hats to sew and the chicken coop.
   Same rules: px() only, 32px tiles, four tones lit from the top-left, outline(canvas, OUT). */
"use strict";
(function () {
const ART = window.ART;
const { A, px, hash, rng, mix, shade, cached, outline, mirrored, blank, OUT, WOOD } = ART;
const WHITE = "#ffffff";
const dot = (g, x, y, c) => px(g, x, y, 1, 1, c);
function hexOf(c) { if (c[0] === "#") return c; const m = /\(([^)]+)\)/.exec(c)[1].split(",").map(Number); return "#" + m.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join(""); }
const lt = (c, t) => hexOf(mix(hexOf(c), WHITE, t)), dk = (c, f) => hexOf(shade(hexOf(c), f));
function ell(g, cx, cy, rx, ry, col) { for (let dy = -ry; dy <= ry; dy++) { const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.4) * (ry + 0.4))))); px(g, cx - hw, cy + dy, hw * 2 + 1, 1, col); } }
function body(g, cx, cy, rx, ry, col) { ell(g, cx, cy, rx, ry, dk(col, 0.72)); ell(g, cx - 1, cy - 1, rx - 1, ry - 1, col); ell(g, cx - Math.ceil(rx / 2.6), cy - Math.ceil(ry / 2.6), Math.max(1, Math.floor(rx / 3)), Math.max(1, Math.floor(ry / 3)), lt(col, 0.35)); }

// ------------------------------------------------------------------ chickens (side view, facing right; the game mirrors for left)
const HEN = { white: ["#f4f1ea", "#d8d2c6"], brown: ["#c98a4a", "#a5683a"], black: ["#4a4a52", "#2e2e34"] };
function chickenSprite(color, frame) {
  const [c, d] = HEN[color] || HEN.white;
  return cached("chick" + color + frame, A, A, (g, cv) => {
    const peck = frame === 2, step = frame === 1;
    px(g, 13, 24, 2, 5, "#e8a030"); px(g, 18, 24 - (step ? 1 : 0), 2, 5, "#e8a030"); px(g, 12, 28, 4, 1, "#e8a030"); px(g, 17, 28, 4, 1, "#e8a030");
    body(g, 15, 19, 9, 7, c); px(g, 5, 13, 5, 6, c); px(g, 4, 14, 3, 3, d);
    ell(g, 16, 20, 5, 3, d); px(g, 13, 18, 6, 1, lt(c, 0.3));
    const hx = peck ? 23 : 21, hy = peck ? 18 : 10;
    body(g, hx, hy, 4, 4, c); px(g, hx - 1, hy - 6, 4, 3, "#e0402f"); px(g, hx, hy - 7, 2, 1, "#e0402f");
    px(g, hx + 4, hy, 3, 2, "#f2a33a"); px(g, hx + 1, hy + 3, 2, 3, "#e0402f"); dot(g, hx + 1, hy - 1, OUT);
    outline(cv, OUT);
  });
}

// ------------------------------------------------------------------ pets: dog and cat, four facings, a 4-frame trot
const PETS = { dog: { c: "#c98a4a", d: "#8a5a2a", l: "#e8b880", ear: "#7a4a22" }, cat: { c: "#9a9aa4", d: "#6a6a74", l: "#c8c8d0", ear: "#7a7a84" } };
function petSprite(kind, facing, frame) {
  const P = PETS[kind] || PETS.dog;
  if (facing === "left") return mirrored("pet" + kind + "L" + frame, petSprite(kind, "right", frame));
  return cached("pet" + kind + facing + frame, A, A, (g, cv) => {
    const step = frame % 2, b = frame ? (frame % 2) : 0;
    if (facing === "right") {
      for (const [x, lift] of [[9, step], [12, 1 - step], [19, 1 - step], [22, step]]) px(g, x, 23 - lift, 3, 6, P.d);
      body(g, 15, 19 - b, 9, 5, P.c); ell(g, 14, 21 - b, 6, 2, P.l);
      body(g, 23, 13 - b, 5, 5, P.c);
      if (kind === "dog") { px(g, 26, 14 - b, 4, 3, P.l); dot(g, 29, 14 - b, OUT); px(g, 20, 9 - b, 3, 7, P.ear); }
      else { px(g, 21, 6 - b, 2, 4, P.c); px(g, 25, 6 - b, 2, 4, P.c); dot(g, 22, 7 - b, "#e8a0a8"); px(g, 27, 15 - b, 2, 1, "#e8a0a8"); }
      dot(g, 25, 12 - b, OUT);
      if (kind === "dog") { px(g, 4, 13 - b + (frame % 3), 2, 5, P.c); px(g, 5, 12 - b, 2, 2, P.c); } else { px(g, 4, 9 - b, 2, 11, P.c); px(g, 3, 8 - b, 2, 3, P.c); }
    } else {
      const back = facing === "up";
      for (const [x, lift] of [[10, step], [19, 1 - step]]) px(g, x, 23 - lift, 4, 6, P.d);
      body(g, 16, 19 - b, 8, 6, P.c);
      if (!back) ell(g, 16, 21 - b, 4, 3, P.l);
      body(g, 16, back ? 10 - b : 11 - b, 6, 5, P.c);
      if (kind === "dog") { px(g, 9, 8 - b, 3, 8, P.ear); px(g, 21, 8 - b, 3, 8, P.ear); } else { px(g, 11, 4 - b, 3, 4, P.c); px(g, 19, 4 - b, 3, 4, P.c); }
      if (!back) { dot(g, 14, 10 - b, OUT); dot(g, 18, 10 - b, OUT); px(g, 15, 13 - b, 3, 2, kind === "dog" ? OUT : "#e8a0a8"); }
      else if (kind === "cat") { px(g, 16, 22 - b, 2, 8, P.c); } else { px(g, 15, 14 - b, 3, 3, P.c); }
    }
    outline(cv, OUT);
  });
}

// ------------------------------------------------------------------ horses: 48x48, side view (front and back views for up/down)
const HORSE = { chestnut: ["#a8582e", "#7a3a1a", "#c87a4a", "#3a2214"], black: ["#3a3238", "#221c20", "#5a525a", "#141014"],
  white: ["#ece6dc", "#c8c0b2", "#ffffff", "#9a9284"], dapple: ["#a8a8b0", "#7a7a84", "#d0d0d8", "#3a3a40"] };
function horseSprite(color, facing, frame) {
  const [c, d, l, mane] = HORSE[color] || HORSE.chestnut;
  if (facing === "left") return mirrored("horse" + color + "L" + frame, horseSprite(color, "right", frame));
  return cached("horse" + color + facing + frame, 48, 48, (g, cv) => {
    const gal = frame % 4, lift = [0, 2, 0, 2][gal], sw = [-3, 0, 3, 0][gal];
    if (facing === "right") {
      for (const [x, s] of [[12, sw], [17, -sw], [31, -sw], [36, sw]]) { px(g, x + Math.round(s / 2), 30, 4, 13, d); px(g, x + Math.round(s / 2) - 1, 42, 5, 3, "#2b2118"); }
      body(g, 24, 26 - lift, 15, 8, c); ell(g, 22, 29 - lift, 10, 3, d);
      for (let i = 0; i < 9; i++) px(g, 34 + i, 23 - i - lift, 6, 6, c);
      body(g, 42, 12 - lift, 5, 4, c); px(g, 44, 14 - lift, 4, 3, l); dot(g, 42, 10 - lift, OUT); px(g, 39, 5 - lift, 2, 4, c);
      for (let i = 0; i < 9; i++) px(g, 33 + i, 18 - i - lift, 3, 3, mane);
      px(g, 6, 22 - lift, 4, 3, mane); px(g, 4, 24 - lift, 4, 12, mane); px(g, 3, 30 - lift, 3, 6, mane);
      px(g, 18, 18 - lift, 12, 4, "#8a5a2a"); px(g, 18, 18 - lift, 12, 1, "#b8824c"); px(g, 22, 22 - lift, 2, 8, "#c9a640");
    } else {
      const back = facing === "up";
      for (const [x, s] of [[16, lift], [28, 2 - lift]]) { px(g, x, 30 - s, 5, 13 + s, d); px(g, x - 1, 42, 7, 3, "#2b2118"); }
      body(g, 24, 26, 10, 10, c);
      if (back) { px(g, 22, 30, 4, 14, mane); body(g, 24, 14, 6, 6, c); px(g, 22, 8, 4, 8, mane); }
      else { body(g, 24, 13, 6, 8, c); px(g, 21, 16, 7, 5, l); dot(g, 21, 11, OUT); dot(g, 27, 11, OUT); px(g, 19, 5, 3, 5, c); px(g, 27, 5, 3, 5, c); px(g, 22, 5, 5, 4, mane); }
      px(g, 16, 22, 16, 4, "#8a5a2a"); px(g, 16, 22, 16, 1, "#b8824c");
    }
    outline(cv, OUT);
  });
}

// ------------------------------------------------------------------ Old Thunder, the rodeo bull (side view, facing right; frame 1 bucks)
function bullSprite(frame) {
  return cached("bull" + frame, 56, 44, (g, cv) => {
    const c = "#5a3424", d = "#3e2218", l = "#7a4a34", buck = frame % 2;
    const kick = buck ? -4 : 0;
    for (const [x, s] of [[12, kick], [18, kick], [36, 0], [42, 0]]) { px(g, x, 28 + s, 5, 12, d); px(g, x - 1, 38 + s, 6, 3, "#2b2118"); }
    body(g, 27, 24, 18, 10, c); ell(g, 26, 29, 13, 3, d); body(g, 30, 17, 10, 6, l);       // a big shoulder hump
    body(g, 47, 22, 7, 7, c); px(g, 50, 24, 5, 5, "#c88a6a"); dot(g, 52, 25, OUT); dot(g, 52, 27, OUT);
    px(g, 49, 27, 4, 2, "#c9a640");                                                            // brass nose ring
    dot(g, 47, 19, OUT); px(g, 46, 18, 1, 1, WHITE);
    px(g, 41, 13, 6, 3, "#f4ead2"); px(g, 39, 10, 3, 4, "#f4ead2"); px(g, 50, 13, 3, 3, "#f4ead2"); px(g, 52, 10, 2, 4, "#f4ead2");   // horns
    px(g, 6, 18, 3, 3, d); px(g, 4, 20, 3, 10, d); px(g, 3, 29, 5, 3, "#2b2118");              // tail
    px(g, 20, 12, 16, 5, "#b8463a"); px(g, 20, 12, 16, 1, "#e06a5a"); px(g, 26, 16, 3, 10, "#8a5a2a");   // saddle blanket and strap
    outline(cv, OUT);
  });
}

// ------------------------------------------------------------------ mine monsters
function monsterSprite(kind, frame) {
  const big = kind === "slime_king", S = big ? 48 : A;
  return cached("mob" + kind + frame, S, S, (g, cv) => {
    const f = frame % 2;
    if (kind === "slime" || kind === "blue_slime" || kind === "slime_king") {
      const c = kind === "blue_slime" ? "#5ab0f0" : "#6cd85a", k = big ? 1.5 : 1;
      const w = Math.round((f ? 11 : 10) * k), h = Math.round((f ? 7 : 9) * k), cx = S / 2, by = S - 3;
      ell(g, cx, by - h, w, h, dk(c, 0.6)); ell(g, cx - 1, by - h - 1, w - 1, h - 1, c); ell(g, cx - Math.round(w / 2.5), by - h - Math.round(h / 2), Math.round(w / 4), Math.round(h / 4), lt(c, 0.6));
      px(g, cx - w, by, w * 2, 1, dk(c, 0.5));
      const ey = by - h - (f ? 0 : 1);
      px(g, cx - Math.round(5 * k), ey, Math.round(2 * k), Math.round(3 * k), OUT); px(g, cx + Math.round(3 * k), ey, Math.round(2 * k), Math.round(3 * k), OUT);
      dot(g, cx - Math.round(5 * k), ey, WHITE); dot(g, cx + Math.round(3 * k), ey, WHITE);
      if (big) { for (let i = 0; i < 5; i++) px(g, cx - 10 + i * 5, by - 2 * h - 8 + (i % 2 ? 2 : 0), 3, 7 - (i % 2 ? 2 : 0), "#f2c744"); px(g, cx - 11, by - 2 * h - 2, 23, 3, "#f2c744"); dot(g, cx, by - 2 * h - 5, "#e0384f"); }
    } else if (kind === "bat") {
      const y = f ? 12 : 14;
      body(g, 16, y + 2, 4, 5, "#5a3a6a"); dot(g, 15, y + 1, "#ff6060"); dot(g, 18, y + 1, "#ff6060"); px(g, 13, y - 3, 2, 3, "#5a3a6a"); px(g, 18, y - 3, 2, 3, "#5a3a6a");
      for (let i = 0; i < 10; i++) { const wy = y + (f ? -i / 2 : i / 3); px(g, 11 - i, Math.round(wy), 2, 4 - (i % 3), "#7a4a9a"); px(g, 20 + i, Math.round(wy), 2, 4 - (i % 3), "#7a4a9a"); }
    } else if (kind === "rock_crab") {
      for (const x of [5, 9, 21, 25]) px(g, x, 21 - f, 2, 6, "#a84a3a");
      ell(g, 16, 18, 12, 8, "#666a70"); ell(g, 15, 17, 11, 7, "#8b8e8c"); ell(g, 12, 14, 5, 3, "#b1aea7"); for (const [x, y] of [[10, 19], [19, 15], [22, 20]]) dot(g, x, y, "#474a52");
      px(g, 2, 15 + f, 5, 4, "#c85a3a"); px(g, 25, 15 + f, 5, 4, "#c85a3a"); px(g, 11, 24, 2, 3, OUT); px(g, 19, 24, 2, 3, OUT);
    } else if (kind === "ghost") {
      const y = f ? 4 : 6;
      for (let r = 0; r < 20; r++) { const hw = r < 8 ? Math.round(Math.sqrt(64 - (8 - r) * (8 - r)) * 1.1) : 9; px(g, 16 - hw, y + r, hw * 2, 1, r < 6 ? "#f4fbff" : "#d8eef8"); }
      for (let i = 0; i < 4; i++) px(g, 7 + i * 5, y + 20, 3, 2 + ((i + f) % 2) * 2, "#d8eef8");
      px(g, 11, y + 7, 3, 4, "#2a2a4a"); px(g, 18, y + 7, 3, 4, "#2a2a4a"); px(g, 14, y + 13, 4, 2, "#2a2a4a");
    }
    outline(cv, OUT);
  });
}

// ------------------------------------------------------------------ wild game (facing right; mirrored for left)
function critterSprite(kind, frame) {
  const S = kind === "deer" ? 48 : A;
  return cached("crit" + kind + frame, S, S, (g, cv) => {
    const f = frame % 2;
    if (kind === "rabbit") {
      body(g, 14, 22 - f, 8, 5, "#c9a07a"); body(g, 22, 16 - f, 4, 4, "#c9a07a"); px(g, 20, 6 - f, 2, 8, "#c9a07a"); px(g, 23, 5 - f, 2, 9, "#b8906a"); dot(g, 21, 8 - f, "#f0b8b8");
      dot(g, 24, 15 - f, OUT); px(g, 5, 19 - f, 3, 3, "#f4f1ea"); px(g, 9 + f * 2, 26, 4, 2, "#a8805a"); px(g, 18 - f * 2, 26, 3, 2, "#a8805a");
    } else if (kind === "quail") {
      px(g, 14, 24, 1, 4, "#e8a030"); px(g, 18, 24 - f, 1, 4, "#e8a030");
      body(g, 15, 19, 8, 6, "#8a6a4a"); body(g, 22, 13, 4, 4, "#8a6a4a"); px(g, 22, 6, 1, 4, OUT); px(g, 21, 5, 2, 2, OUT);
      px(g, 26, 13, 2, 1, "#4a3a2a"); dot(g, 23, 12, OUT); for (let x = 10; x < 20; x += 3) dot(g, x, 18, WHITE); px(g, 20, 16, 5, 1, WHITE);
    } else if (kind === "deer") {
      for (const [x, s] of [[14, f], [18, -f], [30, -f], [34, f]]) { px(g, x + s, 30, 3, 14, "#8a5a32"); px(g, x + s, 43, 3, 2, OUT); }
      body(g, 24, 27, 13, 7, "#b8784a"); ell(g, 24, 30, 9, 3, "#e8c8a0");
      for (let i = 0; i < 8; i++) px(g, 33 + i, 23 - i, 4, 5, "#b8784a");
      body(g, 40, 13, 4, 4, "#b8784a"); px(g, 43, 14, 3, 2, "#3a2a1a"); dot(g, 40, 11, OUT);
      px(g, 38, 2, 1, 8, "#e8dcc0"); px(g, 35, 3, 4, 1, "#e8dcc0"); px(g, 41, 3, 1, 7, "#e8dcc0"); px(g, 41, 4, 4, 1, "#e8dcc0");
      for (const [x, y] of [[20, 24], [26, 23], [29, 27]]) dot(g, x, y, WHITE); px(g, 9, 24, 3, 3, "#f4f1ea");
    } else if (kind === "boar") {
      for (const [x, s] of [[9, f], [13, -f], [20, -f], [24, f]]) px(g, x + s, 23, 3, 6, "#3a2a22");
      body(g, 16, 18, 11, 7, "#6a4a3a"); for (let x = 8; x < 24; x += 2) px(g, x, 10, 1, 3, "#3a2a1a");
      body(g, 26, 19, 4, 4, "#7a5a4a"); px(g, 29, 20, 3, 3, "#a87a6a"); px(g, 27, 23, 3, 1, "#f4f1ea"); dot(g, 26, 17, "#ff6040"); px(g, 4, 15, 2, 4, "#6a4a3a");
    }
    outline(cv, OUT);
  });
}

// ------------------------------------------------------------------ things on the ground
function digSprite(frame) {
  return cached("dig" + (frame % 3), A, A, (g, cv) => {
    ell(g, 16, 22, 9, 3, "#8a6a42"); ell(g, 16, 21, 8, 2, "#a5844f");
    for (let i = 0; i < 3; i++) { const x = 11 + i * 5, h = 4 + ((i + frame) % 3); px(g, x, 21 - h, 2, h, "#c86a6a"); dot(g, x, 21 - h, "#f0a0a0"); px(g, x + ((i + frame) % 2 ? 1 : -1), 21 - h - 1, 2, 1, "#c86a6a"); }
    outline(cv, OUT);
  });
}
function treasureSprite(open) {
  return cached("treasure" + (open ? 1 : 0), A, A, (g, cv) => {
    px(g, 4, 14, 24, 14, "#6a3a7a"); px(g, 4, 14, 24, 2, "#8a5a9a"); px(g, 4, 25, 24, 3, "#4a2a5a");
    for (const x of [7, 22]) px(g, x, 14, 3, 14, "#c9a640");
    if (open) { px(g, 4, 6, 24, 8, "#4a2a5a"); px(g, 6, 10, 20, 5, "#2a1a32"); for (const [x, c] of [[10, "#f2c744"], [15, "#e0384f"], [20, "#5ab0f0"]]) px(g, x, 11, 3, 3, c); }
    else { px(g, 3, 8, 26, 7, "#7a4a8a"); px(g, 3, 8, 26, 2, "#9a6aaa"); px(g, 14, 12, 4, 6, "#c9a640"); dot(g, 15, 14, OUT); }
    outline(cv, OUT);
  });
}
function balloonSprite(frame) {
  return cached("balloon" + (frame % 2), 32, 64, (g, cv) => {
    ell(g, 16, 13, 10, 12, "#a8282a"); ell(g, 15, 12, 9, 11, "#e0403f"); ell(g, 11, 8, 3, 4, "#f8a0a0"); px(g, 15, 25, 3, 2, "#a8282a");
    for (let y = 27; y < 46; y++) dot(g, 16 + Math.round(Math.sin((y + frame * 3) / 3) * 1.2), y, "#f4f1ea");
    px(g, 8, 46, 16, 14, "#3a7bd5"); px(g, 8, 46, 16, 2, "#7aaaf0"); px(g, 14, 46, 4, 14, "#ffe066"); px(g, 6, 44, 20, 3, "#2a5aa5"); px(g, 11, 40, 4, 4, "#ffe066"); px(g, 17, 40, 4, 4, "#ffe066");
    outline(cv, OUT);
  });
}

// ------------------------------------------------------------------ machines you set down (the game floats a bubble over a finished one)
function machineSprite(kind, working) {
  return cached("mach" + kind + (working ? 1 : 0), A, A, (g, cv) => {
    const w = working ? 1 : 0;
    if (kind === "cheese_press") {
      px(g, 6, 24, 20, 5, WOOD.dark); px(g, 8, 8, 3, 17, WOOD.mid); px(g, 21, 8, 3, 17, WOOD.mid); px(g, 6, 6, 20, 4, WOOD.light);
      px(g, 14, 2, 4, 6, "#7a7a84"); px(g, 10, 16 - w * 2, 12, 8 + w * 2, "#f7d35a"); px(g, 10, 16 - w * 2, 12, 2, "#ffe680"); px(g, 9, 14 - w * 2, 14, 2, WOOD.mid);
    } else if (kind === "preserves_jar") {
      px(g, 7, 8, 18, 4, "#c8a050"); px(g, 6, 11, 20, 17, "#cfe8f0"); px(g, 8, 14, 16, 12, w ? "#c92a3a" : "#e8e2d6"); px(g, 8, 14, 4, 12, w ? "#e85a6a" : WHITE); px(g, 11, 17, 10, 5, "#f4ead2");
    } else if (kind === "mayo_machine") {
      px(g, 6, 10, 20, 18, "#e8e2d6"); px(g, 6, 10, 20, 3, "#f8f4ee"); px(g, 22, 10, 4, 18, "#b8b0a2"); px(g, 10, 15, 12, 8, "#f4ecd0"); px(g, 13, 4, 6, 6, "#9aa4b0"); dot(g, 15, 18, w ? "#f2c744" : "#c8c2b5");
    } else if (kind === "bee_house") {
      px(g, 6, 10, 20, 18, "#e8c070"); for (let y = 13; y < 28; y += 5) px(g, 6, y, 20, 1, "#a8803a"); px(g, 4, 6, 24, 5, "#a5713f"); px(g, 4, 6, 24, 1, "#dcae74"); px(g, 13, 22, 6, 3, OUT);
      for (const [x, y] of [[24, 4], [27, 12], [3, 14]]) { px(g, x, y + w, 3, 2, "#f2c744"); dot(g, x + 1, y + w, OUT); }
    } else if (kind === "rock_tumbler") {
      px(g, 5, 20, 22, 8, "#666a70"); px(g, 5, 20, 22, 2, "#8b8e8c"); ell(g, 16, 14, 9, 7, "#4b4b4e"); ell(g, 15, 13, 8, 6, "#7b7e87"); px(g, 10, 12, 12, 2, w ? "#a86ee0" : "#9aa4b0"); dot(g, 23, 23, w ? "#5ae070" : "#c85a3a");
    } else if (kind === "animal_trap") {
      px(g, 5, 14, 22, 14, WOOD.mid); px(g, 5, 14, 22, 2, WOOD.light); for (let x = 7; x < 26; x += 4) px(g, x, 16, 1, 12, WOOD.dark); px(g, 4, 10 + w * 3, 24, 4, WOOD.dark); px(g, 14, 20, 4, 4, "#c9a640");
    } else if (kind === "craft_table") {
      px(g, 3, 12, 26, 7, WOOD.mid); px(g, 3, 12, 26, 2, WOOD.light); px(g, 5, 19, 4, 10, WOOD.dark); px(g, 23, 19, 4, 10, WOOD.dark); px(g, 7, 8, 8, 4, "#9aa4b0"); px(g, 19, 6, 2, 6, WOOD.mid); px(g, 17, 5, 6, 3, "#4b4b4e");
    } else if (kind === "tailor_table") {
      px(g, 3, 12, 26, 7, WOOD.mid); px(g, 3, 12, 26, 2, WOOD.light); px(g, 5, 19, 4, 10, WOOD.dark); px(g, 23, 19, 4, 10, WOOD.dark); px(g, 7, 8, 9, 4, "#d64fbf"); px(g, 18, 6, 6, 6, "#4b4b4e"); px(g, 20, 4, 2, 3, "#9aa4b0");
    } else return;
    outline(cv, OUT);
  });
}

// ------------------------------------------------------------------ hats (overlays for the top 16 rows of the 32x48 farmer sprite)
const HATS = {
  straw: (g, back) => { px(g, 4, 9, 24, 2, "#d9b86a"); px(g, 4, 9, 24, 1, "#eacf88"); px(g, 9, 3, 14, 7, "#e3c478"); px(g, 9, 3, 14, 2, "#f2dc98"); px(g, 9, 7, 14, 2, back ? "#d9b86a" : "#c94a5a"); },
  flower: (g, back) => { px(g, 9, 4, 14, 2, "#4f9e3b"); for (let i = 0; i < 5; i++) { const x = 9 + i * 3; px(g, x, 2 + (i % 2), 3, 3, ["#ff7eb6", "#ffe066", "#ffffff", "#ff8f5a", "#c86ee0"][i]); dot(g, x + 1, 3 + (i % 2), "#f2c744"); } },
  beanie: (g, back) => { px(g, 9, 2, 14, 8, "#3a7bd5"); px(g, 10, 1, 12, 1, "#3a7bd5"); for (let x = 10; x < 22; x += 2) px(g, x, 3, 1, 5, "#5a9be8"); px(g, 9, 8, 14, 2, "#2a5aa5"); px(g, 14, -1 + 1, 4, 2, "#f4f1ea"); },
  tophat: (g, back) => { px(g, 11, 0, 10, 8, "#2b2a33"); px(g, 11, 0, 3, 8, "#4a4a56"); px(g, 11, 6, 10, 2, "#c94a5a"); px(g, 7, 8, 18, 2, "#2b2a33"); px(g, 7, 8, 18, 1, "#4a4a56"); },
  bandana: (g, back) => { px(g, 9, 4, 14, 4, "#d9463c"); for (let x = 10; x < 22; x += 3) dot(g, x, 5, WHITE); px(g, back ? 14 : 22, 5, 4, 3, "#d9463c"); px(g, back ? 15 : 24, 7, 2, 3, "#a9342c"); },
  champion: (g, back) => { px(g, 3, 9, 26, 2, "#f4ead2"); px(g, 9, 2, 14, 8, "#f4ead2"); px(g, 9, 2, 14, 2, "#ffffff"); px(g, 9, 7, 14, 2, "#c9a640"); if (!back) { px(g, 15, 3, 3, 3, "#f2c744"); dot(g, 16, 4, "#fff2a8"); } },
  witch: (g, back) => { for (let i = 0; i < 8; i++) px(g, 15 - Math.round(i * 0.8), i, 2 + Math.round(i * 1.6), 1, "#5a3a7a"); px(g, 5, 8, 22, 2, "#4a2a6a"); px(g, 9, 6, 14, 2, "#f28c28"); },
  santa: (g, back) => { px(g, 9, 3, 14, 5, "#d9463c"); px(g, 11, 1, 10, 2, "#d9463c"); px(g, 20, 0, 5, 3, "#d9463c"); px(g, 24, 2, 3, 3, "#f4f1ea"); px(g, 8, 7, 16, 3, "#f4f1ea"); },
  crown: (g, back) => { px(g, 10, 4, 12, 4, "#f2c744"); for (let i = 0; i < 4; i++) px(g, 10 + i * 4, 1 + (i % 2), 2, 3, "#f2c744"); px(g, 10, 4, 12, 1, "#fff2a8"); for (const [x, c] of [[12, "#e0384f"], [15, "#5ab0f0"], [19, "#3cc070"]]) dot(g, x, 6, c); },
};
function hatSprite(kind, facing) {
  if (!HATS[kind]) return null;
  const back = facing === "up";
  return cached("hat" + kind + (back ? "b" : "f") + (facing === "left" ? "L" : ""), 32, 16, (g, cv) => {
    HATS[kind](g, back);
    outline(cv, OUT);
  });
}

// ------------------------------------------------------------------ the chicken coop (a little red barn with a ramp and a weathervane)
const prevBuilding = ART.areaBuilding;
ART.areaBuilding = function (kind, w, h, night, label, season) {
  if (kind !== "coop") return prevBuilding(kind, w, h, night, label, season);
  const W = w * A + 2 * ART.OV, H = h * A + ART.TOPPAD;
  return cached("coop" + w + h + (night ? 1 : 0), W, H, (g, cv) => {
    const BH = ART.BH, c = { roof: "#7a5a4a", roofL: "#94705e", roofD: "#54392c", roofX: "#b08a74", fascia: "#f4ecd8", fasciaD: "#cbc0a4",
      wall: "#d0583a", wallD: "#a8402a", wallL: "#e2745a", wallX: "#f09a80", wallDD: "#7a2c1c", trim: "#f4ecd8" };
    const wallTop = ART.TOPPAD + 2 * A, wallX = ART.OV, wallW = w * A, base = H - 8;
    BH.roofFace(g, c, 1, W - 1, 10, wallTop - 2, (t) => Math.round(14 * (1 - t)), 431, { moss: "#6d8544" });
    BH.roofEdges(g, c, 1, W - 1, 10, wallTop - 2, (t) => Math.round(14 * (1 - t)));
    BH.ridgeCap(g, c, 15, W - 15, 6);
    BH.boardWall(g, wallX, wallTop, wallW, base - wallTop, c, 433);
    BH.stones(g, wallX, base, wallW, 8, 434);
    BH.eaveBoard(g, c, 1, W - 1, wallTop - 2);
    const cx = Math.floor(W / 2);
    px(g, cx - 12, base - 30, 24, 30, c.trim); px(g, cx - 10, base - 28, 20, 28, "#3a2214");
    for (let i = 0; i < 6; i++) px(g, cx - 9, base - 26 + i * 5, 18, 2, "#7a5432");
    [wallX + 14, wallX + wallW - 34].forEach((x) => BH.frameWindow(g, x, wallTop + 10, 20, 16, night, c.trim, c.fasciaD));
    BH.plaque(g, cx, wallTop + 2, "COOP", 1);
    BH.weatherVane(g, cx, 0);
    px(g, wallX + wallW - 26, H - 12, 18, 10, "#d9b64a"); px(g, wallX + wallW - 26, H - 12, 18, 2, "#efd270");
    px(g, ART.OV, H - 1, w * A, 1, OUT);
    outline(cv, OUT);
  });
};

// bag and menu icons for the things you set down: the same sprite you see on the farm, shrunk to fit
const MACHINE_KEYS = ["cheese_press", "preserves_jar", "mayo_machine", "bee_house", "rock_tumbler", "animal_trap", "craft_table", "tailor_table"];
function toolbeltIcon(g) {
  px(g, 3, 13, 26, 7, "#8a5a2a"); px(g, 3, 13, 26, 2, "#b8844a"); px(g, 13, 12, 6, 9, "#c9a640"); px(g, 15, 14, 2, 5, "#8a5a2a");
  px(g, 6, 5, 2, 9, "#a5713f"); px(g, 4, 4, 6, 3, "#9aa4b0");            // a hammer in its loop
  px(g, 22, 3, 2, 11, "#9aa4b0"); px(g, 21, 3, 4, 2, "#dfe4ea");          // a screwdriver
  px(g, 5, 20, 6, 6, "#a5642a"); px(g, 21, 20, 6, 6, "#a5642a"); px(g, 5, 20, 6, 1, "#c88a4a"); px(g, 21, 20, 6, 1, "#c88a4a");
}
const prevIconL = ART.iconCanvas;
ART.iconCanvas = function (key, cat) {
  if (MACHINE_KEYS.includes(key)) return cached("mi:" + key, A, A, (g) => { g.imageSmoothingEnabled = false; g.drawImage(machineSprite(key, false), 2, 1, 28, 28); });
  if (key === "chest_item" && ART.chestSprite) return cached("mi:chest", A, A, (g) => { g.imageSmoothingEnabled = false; g.drawImage(ART.chestSprite(false), 2, 2, 28, 28); });
  if (key === "toolbelt") return cached("mi:belt", A, A, (g, c) => { toolbeltIcon(g); outline(c, OUT); });
  return prevIconL(key, cat);
};

Object.assign(ART, { bullSprite, chickenSprite, petSprite, horseSprite, monsterSprite, critterSprite, digSprite, treasureSprite, balloonSprite, machineSprite, hatSprite });
})();
