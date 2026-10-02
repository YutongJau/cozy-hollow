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
    px(g, hx + 4, hy, 3, 2, "#f2a33a"); px(g, hx + 1, hy + 3, 2, 3, "#e0402f"); px(g, hx + 1, hy - 2, 2, 2, OUT); dot(g, hx + 1, hy - 2, "#ffffff"); dot(g, hx - 1, hy + 1, "#f4a0a8");
    outline(cv, OUT);
  });
}

// ------------------------------------------------------------------ pets: dogs and cats, chibi style (big heads, big shiny eyes),
// four facings and a 4-frame trot; each pet has a coat of its own (picked from its name by the game)
const EYE = "#2a1f1a", SHINE = "#ffffff", BLUSH = "#f4a0a8", NOSE_P = "#f08a9a";
const CATS = {
  gray: { c: "#a4a6b2", d: "#7c7e8c", s: "#6a6c7a", l: "#c8cad4", w: "#f4f2f0" }, ginger: { c: "#f0a050", d: "#c87a34", s: "#d06e2a", l: "#f8c890", w: "#fff4e4" },
  black: { c: "#3e3a46", d: "#2a2732", s: "#2a2732", l: "#5a5664", w: "#f4f2f0" }, cream: { c: "#f2dcb4", d: "#d6b88a", s: "#e0c094", l: "#fbeed8", w: "#ffffff" },
  calico: { c: "#f6f0e6", d: "#d8d0c4", s: "#e8963c", l: "#ffffff", w: "#ffffff", patch: "#4a4450" },
};
const DOGS = {
  golden: { c: "#e0a85a", d: "#b87e3a", l: "#f4cc8e", w: "#fff0d8", ear: "#c88a44" }, brown: { c: "#a8683a", d: "#7e4a26", l: "#c88a5a", w: "#f4e4d0", ear: "#6e4024" },
  shiba: { c: "#e88a40", d: "#bc6428", l: "#f4b07a", w: "#fff4e8", ear: "#d07434" }, spotty: { c: "#f4f0ea", d: "#d4ccc0", l: "#ffffff", w: "#ffffff", ear: "#5a4a40", spot: "#5a4a40" },
  black: { c: "#40384a", d: "#2a2430", l: "#5c5466", w: "#e8d8c0", ear: "#2a2430" },
};
function tri(g, x, y, w, h, col, lean) {      // an ear: a triangle with its point at the top (lean shifts the tip left or right)
  for (let r = 0; r < h; r++) { const ww = Math.max(1, Math.round(w * (r + 1) / h)); px(g, x + Math.round((w - ww) / 2 + (lean || 0) * (h - 1 - r) / h), y + r, ww, 1, col); }
}
function eye(g, x, y, h) { px(g, x, y, 2, h, EYE); dot(g, x, y, SHINE); if (h > 2) dot(g, x + 1, y + h - 1, "#5a4a6a"); }
function petSprite(kind, facing, frame, coat) {
  const cat = kind === "cat", P = cat ? (CATS[coat] || CATS.gray) : (DOGS[coat] || DOGS.golden);
  const key = "pet" + kind + (coat || "") + facing + frame;
  if (facing === "left") return mirrored(key + "L", petSprite(kind, "right", frame, coat));
  return cached(key, A, A, (g, cv) => {
    const walk = frame > 0, a = walk ? frame % 2 : 0, b = walk && frame % 2 ? 1 : 0;   // a: which legs are up, b: the body's bounce
    if (facing === "right") {
      // tail (behind): a cat's curls up, a dog's wags
      if (cat) { for (let i = 0; i < 9; i++) px(g, 5 - Math.round(Math.sin(i / 3) * 2), 17 - i - b, 3, 2, i > 6 ? P.s : P.c); px(g, 5, 7 - b, 3, 2, P.s); }
      else { const wag = frame % 3 - 1; px(g, 4, 13 - b + wag, 3, 6, P.c); px(g, 3, 12 - b + wag, 3, 3, P.l); }
      // legs: two far legs a shade darker, two near legs; feet light
      for (const [x, up, far] of [[8, a, 1], [18, 1 - a, 1], [11, 1 - a, 0], [21, a, 0]]) { px(g, x, 21 - up, 3, 6, far ? P.d : P.c); px(g, x, 26 - up, 3, 1, P.w); }
      body(g, 14, 19 - b, 8, 5, P.c); ell(g, 14, 22 - b, 5, 1, P.l);
      if (P.patch) { px(g, 10, 16 - b, 5, 3, P.patch); px(g, 16, 17 - b, 3, 2, P.s); }
      if (P.spot) { px(g, 9, 17 - b, 3, 2, P.spot); px(g, 15, 15 - b, 2, 2, P.spot); }
      if (cat && !P.patch) for (const x of [10, 13, 16]) px(g, x, 15 - b, 1, 3, P.s);
      // head: big and round, ears, muzzle, a big shiny eye
      const hy = 11 - b;
      if (cat) { tri(g, 15, hy - 9, 5, 6, P.c, -1); tri(g, 21, hy - 9, 5, 6, P.c, 1); tri(g, 16, hy - 6, 3, 3, NOSE_P); tri(g, 22, hy - 6, 3, 3, NOSE_P); }
      body(g, 21, hy, 8, 7, P.c);
      if (cat && !P.patch) { px(g, 19, hy - 6, 1, 3, P.s); px(g, 22, hy - 7, 1, 3, P.s); px(g, 25, hy - 6, 1, 2, P.s); }
      if (P.patch) px(g, 15, hy - 6, 6, 4, P.patch);

      if (!cat) { px(g, 16, hy - 6, 5, 3, P.ear); px(g, 15, hy - 4, 4, 7, P.ear); px(g, 16, hy + 2, 2, 2, P.ear); px(g, 18, hy - 5, 1, 7, dk(P.ear, 0.8)); }   // a floppy ear
      ell(g, 26, hy + 3, 3, 2, P.w); dot(g, 29, hy + 1, cat ? NOSE_P : EYE); px(g, 28, hy + 1, 2, 1, cat ? NOSE_P : EYE);
      eye(g, 23, hy - 2, 3); px(g, 21, hy + 3, 2, 1, BLUSH);
      if (!cat && walk) { px(g, 27, hy + 5, 2, 2, "#e86a7a"); dot(g, 27, hy + 6, "#c84a5a"); }   // a happy tongue on the trot
    } else {
      const back = facing === "up";
      // tail: up behind the back, or peeking round the side in front
      if (back) { if (cat) { px(g, 15, 5 - b, 3, 12, P.c); px(g, 15, 4 - b, 3, 2, P.s); } else px(g, 15 + (frame % 3) - 1, 12 - b, 3, 5, P.c); }
      else if (cat) { px(g, 24, 17 - b, 3, 8, P.c); px(g, 25, 14 - b, 3, 4, P.c); px(g, 25, 13 - b, 3, 2, P.s); }
      // body and paws
      body(g, 16, 22 - b, 7, 5, P.c);
      if (!back) ell(g, 16, 22 - b, 3, 3, P.w);
      for (const [x, up] of [[11, a], [18, 1 - a]]) { px(g, x, 24 - up, 4, 4, P.c); px(g, x, 27 - up, 4, 1, P.w); }
      // head
      const hy = 11 - b;
      if (cat) { tri(g, 8, hy - 10, 6, 7, P.c, -1); tri(g, 18, hy - 10, 6, 7, P.c, 1); if (!back) { tri(g, 9, hy - 7, 4, 4, NOSE_P, -1); tri(g, 19, hy - 7, 4, 4, NOSE_P, 1); } }
      else { px(g, 6, hy - 4, 4, 10, P.ear); px(g, 22, hy - 4, 4, 10, P.ear); }
      body(g, 16, hy, 9, 7, P.c);
      if (back) { if (cat && !P.patch) for (const x of [13, 16, 19]) px(g, x, hy - 6, 1, 4, P.s); }
      else {
        if (cat && !P.patch) for (const x of [14, 16, 18]) px(g, x, hy - 7, 1, 3, P.s);
        if (P.patch) { px(g, 9, hy - 6, 6, 5, P.patch); px(g, 18, hy - 5, 5, 3, P.s); }
        if (P.spot) px(g, 18, hy - 6, 4, 4, P.spot);
        ell(g, 16, hy + 3, 4, 2, P.w);
        eye(g, 11, hy - 2, 3); eye(g, 19, hy - 2, 3);
        px(g, 15, hy + 1, 3, 2, cat ? NOSE_P : EYE); dot(g, 15, hy + 3, OUT); dot(g, 17, hy + 3, OUT); dot(g, 16, hy + 3, cat ? P.w : "#e86a7a");
        px(g, 9, hy + 2, 2, 1, BLUSH); px(g, 21, hy + 2, 2, 1, BLUSH);
      }
    }
    outline(cv, OUT);
  });
}
const PET_COATS = { cat: Object.keys(CATS), dog: Object.keys(DOGS) };

// ------------------------------------------------------------------ horses: 48x48, side view (front and back views for up/down)
const HORSE = { chestnut: ["#b0623a", "#84422a", "#cc8458", "#4a2a1a"], black: ["#3e3640", "#262028", "#5e5662", "#141014"],
  white: ["#f0eae0", "#cec6b8", "#ffffff", "#b8a890"], dapple: ["#acacb6", "#80808c", "#d4d4dc", "#4a4a54"] };
function horseSprite(color, facing, frame) {
  const [c, d, l, mane] = HORSE[color] || HORSE.chestnut;
  if (facing === "left") return mirrored("horse" + color + "L" + frame, horseSprite(color, "right", frame));
  return cached("horse" + color + facing + frame, 48, 48, (g, cv) => {
    const gal = frame % 4, lift = [0, 2, 0, 2][gal], sw = [-2, 0, 2, 0][gal];
    if (facing === "right") {
      // tail, legs (far pair darker), barrel, neck, a big friendly head kept inside the canvas
      px(g, 5, 21 - lift, 4, 4, mane); px(g, 3, 24 - lift, 4, 10, mane); px(g, 4, 33 - lift, 3, 3, mane);
      for (const [x, s, far] of [[11, sw, 1], [28, -sw, 1], [15, -sw, 0], [32, sw, 0]]) { const xx = x + Math.round(s / 2); px(g, xx, 30, 4, 12, far ? d : c); px(g, xx, 39, 4, 2, l); px(g, xx - 1, 41, 6, 3, "#3a2a1e"); }
      body(g, 22, 26 - lift, 13, 8, c); ell(g, 21, 30 - lift, 9, 2, l);
      for (let i = 0; i < 8; i++) px(g, 30 + i, 22 - i - lift, 7, 7, c);                 // the neck
      for (let i = 0; i < 8; i++) px(g, 27 + i, 19 - i - lift, 3, 4, mane);              // the mane along its back edge
      tri(g, 34, 3 - lift, 3, 5, d, -1); tri(g, 37, 3 - lift, 3, 5, c, 0); dot(g, 38, 6 - lift, NOSE_P);
      body(g, 39, 13 - lift, 6, 5, c); ell(g, 43, 16 - lift, 3, 3, l); dot(g, 45, 15 - lift, d); px(g, 43, 18 - lift, 3, 1, d);
      px(g, 35, 7 - lift, 3, 2, mane);                                                    // a forelock between the ears
      eye(g, 39, 10 - lift, 3); px(g, 37, 14 - lift, 2, 1, BLUSH);
      px(g, 17, 18 - lift, 12, 4, "#8a5a2a"); px(g, 17, 18 - lift, 12, 1, "#b8824c"); px(g, 21, 22 - lift, 2, 8, "#c9a640");
    } else {
      const back = facing === "up";
      for (const [x, s] of [[16, lift], [28, 2 - lift]]) { px(g, x, 30 - s, 5, 12 + s, d); px(g, x - 1, 41, 7, 3, "#3a2a1e"); }
      body(g, 24, 26, 10, 10, c);
      if (back) { px(g, 22, 30, 4, 13, mane); body(g, 24, 14, 6, 6, c); px(g, 22, 8, 4, 8, mane); tri(g, 18, 4, 3, 5, c); tri(g, 27, 4, 3, 5, c); }
      else {
        tri(g, 17, 1, 4, 6, c); tri(g, 27, 1, 4, 6, c); body(g, 24, 13, 7, 8, c); ell(g, 24, 19, 5, 3, l); dot(g, 22, 19, d); dot(g, 26, 19, d);
        eye(g, 19, 10, 3); eye(g, 27, 10, 3); px(g, 18, 15, 2, 1, BLUSH); px(g, 28, 15, 2, 1, BLUSH); px(g, 21, 4, 6, 4, mane);
      }
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
      px(g, cx - Math.round(1 * k), ey + Math.round(4 * k), Math.round(3 * k), 1, OUT); dot(g, cx - Math.round(2 * k), ey + Math.round(3 * k), OUT); dot(g, cx + Math.round(2 * k), ey + Math.round(3 * k), OUT);   // a little smile
      px(g, cx - Math.round(8 * k), ey + Math.round(3 * k), 2, 1, "#ff9ab0"); px(g, cx + Math.round(6 * k), ey + Math.round(3 * k), 2, 1, "#ff9ab0");
      if (big) { for (let i = 0; i < 5; i++) px(g, cx - 10 + i * 5, by - 2 * h - 8 + (i % 2 ? 2 : 0), 3, 7 - (i % 2 ? 2 : 0), "#f2c744"); px(g, cx - 11, by - 2 * h - 2, 23, 3, "#f2c744"); dot(g, cx, by - 2 * h - 5, "#e0384f"); }
    } else if (kind === "bat") {
      const y = f ? 12 : 14;
      body(g, 16, y + 2, 5, 5, "#5a3a6a"); px(g, 12, y - 4, 2, 4, "#5a3a6a"); px(g, 19, y - 4, 2, 4, "#5a3a6a");
      px(g, 13, y, 3, 3, "#ffffff"); px(g, 17, y, 3, 3, "#ffffff"); px(g, 14, y + 1, 2, 2, EYE); px(g, 18, y + 1, 2, 2, EYE); dot(g, 14, y + 1, "#ffffff"); dot(g, 18, y + 1, "#ffffff");
      dot(g, 15, y + 5, "#ffffff"); dot(g, 17, y + 5, "#ffffff");
      for (let i = 0; i < 10; i++) { const wy = y + (f ? -i / 2 : i / 3); px(g, 11 - i, Math.round(wy), 2, 4 - (i % 3), "#7a4a9a"); px(g, 20 + i, Math.round(wy), 2, 4 - (i % 3), "#7a4a9a"); }
    } else if (kind === "rock_crab") {
      for (const x of [5, 9, 21, 25]) px(g, x, 21 - f, 2, 6, "#a84a3a");
      ell(g, 16, 18, 12, 8, "#666a70"); ell(g, 15, 17, 11, 7, "#8b8e8c"); ell(g, 12, 14, 5, 3, "#b1aea7"); for (const [x, y] of [[10, 19], [19, 15], [22, 20]]) dot(g, x, y, "#474a52");
      px(g, 2, 15 + f, 5, 4, "#c85a3a"); px(g, 25, 15 + f, 5, 4, "#c85a3a"); px(g, 1, 14 + f, 2, 2, "#e07a5a"); px(g, 29, 14 + f, 2, 2, "#e07a5a");
      px(g, 12, 6 - f, 1, 5, "#a84a3a"); px(g, 19, 6 - f, 1, 5, "#a84a3a"); px(g, 11, 4 - f, 3, 3, "#ffffff"); px(g, 18, 4 - f, 3, 3, "#ffffff"); px(g, 12, 5 - f, 2, 2, EYE); px(g, 19, 5 - f, 2, 2, EYE);
    } else if (kind === "ghost") {
      const y = f ? 4 : 6;
      for (let r = 0; r < 20; r++) { const hw = r < 8 ? Math.round(Math.sqrt(64 - (8 - r) * (8 - r)) * 1.1) : 9; px(g, 16 - hw, y + r, hw * 2, 1, r < 6 ? "#f4fbff" : "#d8eef8"); }
      for (let i = 0; i < 4; i++) px(g, 7 + i * 5, y + 20, 3, 2 + ((i + f) % 2) * 2, "#d8eef8");
      px(g, 11, y + 7, 3, 4, "#2a2a4a"); px(g, 18, y + 7, 3, 4, "#2a2a4a"); dot(g, 11, y + 7, "#ffffff"); dot(g, 18, y + 7, "#ffffff");
      px(g, 14, y + 13, 4, 2, "#2a2a4a"); px(g, 15, y + 14, 2, 1, "#f08aa0"); px(g, 8, y + 11, 3, 1, "#ffb0c8"); px(g, 21, y + 11, 3, 1, "#ffb0c8");
    }
    outline(cv, OUT);
  });
}

// ------------------------------------------------------------------ wild game (facing right; mirrored for left), round and soft
function critterSprite(kind, frame) {
  const S = kind === "deer" ? 48 : A;
  return cached("crit" + kind + frame, S, S, (g, cv) => {
    const f = frame % 2;
    if (kind === "rabbit") {
      const c = "#d8b48c", d = "#b08c66", l = "#f0dcc0", hop = f ? 2 : 0;
      px(g, 4, 17 - hop, 4, 4, "#ffffff"); dot(g, 4, 17 - hop, "#f4f0ea");                                  // cotton tail
      px(g, 7, 25 - hop, 7, 2, d); px(g, 18, 25 - hop, 3, 2, c);                                             // big back foot, front paw
      body(g, 13, 20 - hop, 8, 6, c); ell(g, 13, 23 - hop, 5, 1, l);
      px(g, 17, 1 - hop + 2, 3, 10, c); px(g, 18, 3 - hop + 2, 1, 6, NOSE_P); px(g, 21, 2 - hop + 2, 3, 10, d); px(g, 22, 4 - hop + 2, 1, 6, NOSE_P);   // ears
      body(g, 21, 15 - hop, 6, 5, c); ell(g, 24, 17 - hop, 3, 2, l);
      eye(g, 21, 13 - hop, 3); dot(g, 27, 16 - hop, NOSE_P); px(g, 19, 17 - hop, 2, 1, BLUSH);
    } else if (kind === "quail") {
      const c = "#9a7450", d = "#74543a", l = "#c8a47c", step = f ? 1 : 0;
      px(g, 13, 23, 1, 5 - step, "#e8a030"); px(g, 18, 23, 1, 5 - (1 - step), "#e8a030"); px(g, 12, 27, 3, 1, "#e8a030"); px(g, 17, 27, 3, 1, "#e8a030");
      body(g, 15, 19, 9, 7, c); ell(g, 15, 22, 6, 2, l);
      for (const [x, y] of [[9, 16], [12, 15], [15, 17], [11, 19], [18, 16]]) { dot(g, x, y, "#ffffff"); dot(g, x + 1, y, d); }
      body(g, 22, 11, 5, 5, c); px(g, 20, 13, 7, 1, "#ffffff"); px(g, 24, 14, 3, 2, "#3a2a1e");             // face stripe and throat
      px(g, 22, 3, 2, 4, OUT); px(g, 23, 2, 3, 2, OUT);                                                     // the curly plume
      px(g, 27, 11, 3, 2, "#4a3a2a"); eye(g, 23, 9, 2); px(g, 20, 12, 2, 1, BLUSH);
    } else if (kind === "deer") {
      // a fawn: a big head, big ears and eyes, a dappled back, slender legs, a white powder-puff tail
      const c = "#c08450", d = "#94603a", l = "#ecd2aa", hoof = "#3a2a1e";
      for (const [x, s, far] of [[13, f, 1], [27, -f, 1], [16, -f, 0], [30, f, 0]]) { px(g, x + s, 31, 3, 10, far ? d : c); px(g, x + s, 40, 3, 2, hoof); }
      px(g, 8, 21, 4, 5, "#ffffff"); px(g, 9, 20, 2, 1, "#ffffff");
      body(g, 22, 27, 12, 7, c); ell(g, 22, 31, 8, 2, l);
      for (const [x, y] of [[15, 23], [19, 22], [23, 22], [27, 23], [17, 26], [21, 25], [25, 25]]) px(g, x, y, 2, 1, "#fff4e4");
      for (let i = 0; i < 7; i++) px(g, 29 + i, 24 - i, 6, 6, c);
      tri(g, 30, 4, 5, 8, d, -2); tri(g, 31, 6, 2, 5, l, -2);                                                // back ear
      body(g, 37, 14, 7, 6, c); ell(g, 41, 17, 4, 3, l); px(g, 43, 15, 2, 2, hoof);
      tri(g, 40, 3, 5, 8, c, 2); tri(g, 41, 5, 3, 5, NOSE_P, 2);                                            // front ear
      px(g, 35, 7, 1, 3, "#8a6a4a"); px(g, 39, 6, 1, 3, "#8a6a4a");                                          // little antler nubs
      eye(g, 36, 11, 4); px(g, 34, 16, 2, 1, BLUSH);
    } else if (kind === "boar") {
      // a chubby, bristly boar: piglet face, pink snout, little tusks
      const c = "#7a5848", d = "#5a3e32", l = "#9a7464", step = f;
      for (const [x, s, far] of [[8, step, 1], [19, -step, 1], [11, -step, 0], [22, step, 0]]) { px(g, x + s, 23, 3, 5, far ? d : c); px(g, x + s, 27, 3, 1, OUT); }
      px(g, 3, 15, 2, 2, c); dot(g, 2, 14, c);                                                              // curly tail
      body(g, 14, 19, 10, 7, c); ell(g, 14, 23, 7, 1, l); for (let x = 7; x < 22; x += 2) px(g, x, 11 + (x % 4 === 1 ? 0 : 1), 1, 3, "#3a2a20");
      body(g, 24, 18, 6, 6, c); tri(g, 20, 9, 4, 5, d, -1);
      ell(g, 29, 20, 2, 3, "#e8a0a0"); dot(g, 29, 19, "#a85a5a"); dot(g, 29, 21, "#a85a5a");
      px(g, 26, 23, 1, 2, "#fff4e4"); eye(g, 24, 15, 3); px(g, 22, 20, 2, 1, BLUSH);
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

// ------------------------------------------------------------------ a tree spot in the orchard meadow: a ring of mulch and a stake (32x40,
// the stake pokes above the tile); a locked spot hangs a little sign with the level it opens at
function treeSpotSprite(level, locked) {
  return cached("treespot" + (locked ? level : "open"), A, A + 8, (g, cv) => {
    ell(g, 16, 34, 11, 4, "#5a3c26"); ell(g, 16, 33, 9, 3, "#7a5434");
    for (const [x, y] of [[10, 33], [14, 35], [19, 32], [22, 34], [13, 32]]) dot(g, x, y, "#94683e");
    px(g, 21, 16, 2, 18, "#a5713f"); px(g, 21, 16, 1, 18, "#c88a52"); px(g, 21, 15, 2, 1, "#7a4a24");
    if (!locked) { px(g, 19, 19, 6, 2, "#6cc24a"); px(g, 19, 19, 6, 1, "#9ae07a"); px(g, 23, 21, 2, 3, "#4f9e3b"); }
    else {
      const label = "LV" + level, w = ART.textWidth(label) + 4;
      px(g, 22 - w, 9, w, 9, "#d9b06a"); px(g, 22 - w, 9, w, 1, "#f0d090"); px(g, 22 - w, 17, w, 1, "#a07a3a");
      px(g, 20 - w + 4, 6, 1, 3, "#7a4a24"); px(g, 20, 6, 1, 3, "#7a4a24");
      ART.text3x5(g, 24 - w, 11, label, "#5a3a1a");
    }
    outline(cv, OUT);
  });
}

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

Object.assign(ART, { treeSpotSprite, PET_COATS, bullSprite, chickenSprite, petSprite, horseSprite, monsterSprite, critterSprite, digSprite, treasureSprite, balloonSprite, machineSprite, hatSprite });
})();
