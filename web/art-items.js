/* Cozy Hollow art - icons for everything made, caught, dug up, won or bought out in the valley (32x32, outlined).
   Same rules as the other modules: px() only, four tones lit from the top-left, outline(canvas, OUT) to finish.
   Hooks into ART.iconCanvas (and ART.forageSprite for things that lie on the ground). */
"use strict";
(function () {
const ART = window.ART;
const { A, px, hash, rng, mix, shade, cached, outline, OUT, WOOD } = ART;
const WHITE = "#ffffff";
const dot = (g, x, y, c) => px(g, x, y, 1, 1, c);
function hexOf(c) { if (c[0] === "#") return c; const m = /\(([^)]+)\)/.exec(c)[1].split(",").map(Number); return "#" + m.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join(""); }
const lt = (c, t) => hexOf(mix(hexOf(c), WHITE, t)), dk = (c, f) => hexOf(shade(hexOf(c), f));
function ell(g, cx, cy, rx, ry, col) { for (let dy = -ry; dy <= ry; dy++) { const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.4) * (ry + 0.4))))); px(g, cx - hw, cy + dy, hw * 2 + 1, 1, col); } }
function blob(g, cx, cy, rx, ry, col) { ell(g, cx, cy, rx, ry, dk(col, 0.7)); ell(g, cx - 1, cy - 1, rx - 1, ry - 1, col); ell(g, cx - Math.ceil(rx / 3), cy - Math.ceil(ry / 3), Math.max(1, Math.floor(rx / 3)), Math.max(1, Math.floor(ry / 3)), lt(col, 0.45)); }

// ------------------------------------------------------------------ dishes: how each looks (vessel, main, accent, garnish)
const DISH = {
  turnip_soup: ["bowl", "#f1e6c6", "#c98fd2", "#6cc24a"], tomato_soup: ["bowl", "#e2462f", "#f7d9c4", "#6cc24a"], fried_egg: ["plate", "#ffffff", "#f7c43a", null],
  omelette: ["plate", "#f7d35a", "#e8a838", "#6cc24a"], pancakes: ["stack", "#d9a35a", "#7a4520", "#f2e3bf"], baked_potato: ["plate", "#c9a36b", "#f7d35a", "#6cc24a"],
  corn_chowder: ["bowl", "#f6df8a", "#f2c744", "#6cc24a"], grilled_fish: ["fishplate", "#a8c0d0", "#5a6a7a", "#f7d35a"], sushi_roll: ["sushi", "#f4f1ea", "#e8784a", "#2f4f3a"],
  chowder: ["bowl", "#f3ead8", "#e8a07a", "#6cc24a"], risotto: ["bowl", "#efe2c0", "#8a6a4a", "#6cc24a"], fruit_salad: ["bowl", "#e8394a", "#8fd14f", "#ffb07c"],
  berry_tart: ["pie", "#d9a35a", "#8a2a5a", "#e8394a"], shortcake: ["cake", "#fbf3e4", "#e8394a", "#6cc24a"], pumpkin_pie: ["pie", "#d9a35a", "#e88a2e", "#fbf3e4"],
  honey_cake: ["cake", "#e8c070", "#f2b030", "#fbf3e4"], cheese_toast: ["toast", "#d9a35a", "#f7d35a", null], cactus_candy: ["candy", "#d84a86", "#78bc6a", "#fff2c0"],
  coconut_curry: ["bowl", "#f2c744", "#e88a2e", "#6cc24a"], hunters_stew: ["bowl", "#8a4a2a", "#c98a4a", "#6cc24a"], rabbit_pie: ["pie", "#d9a35a", "#a5744a", "#6cc24a"],
  roast_quail: ["roast", "#c98a4a", "#8a5a2a", "#6cc24a"], boar_roast: ["roast", "#a5543a", "#6e3420", "#c92a3a"], trail_mix: ["bowl", "#a5744a", "#e8394a", "#f2c744"],
  apple_candy: ["candyapple", "#d0283a", "#f2a0a8", "#8a5a2a"],
};
function vessel(g, kind, main, acc, gar) {
  if (kind === "bowl") {
    ell(g, 16, 17, 12, 4, dk(main, 0.75)); ell(g, 16, 16, 11, 3, main); for (let i = 0; i < 5; i++) dot(g, 9 + i * 3 + (i % 2), 15 + (i % 2), acc);
    if (gar) { px(g, 18, 14, 2, 1, gar); dot(g, 12, 16, gar); }
    for (let y = 18; y < 27; y++) { const hw = Math.round(12 - (y - 18) * 0.9); px(g, 16 - hw, y, hw * 2, 1, y < 20 ? "#f4f1ea" : y < 24 ? "#d8d2c6" : "#b8b0a2"); }
    px(g, 10, 19, 3, 1, WHITE); px(g, 11, 27, 10, 1, "#9a9284");
  } else if (kind === "plate" || kind === "fishplate" || kind === "toast" || kind === "roast" || kind === "sushi") {
    ell(g, 16, 22, 14, 5, "#b8b0a2"); ell(g, 16, 21, 13, 4, "#f4f1ea"); ell(g, 16, 21, 9, 2, "#e8e2d6");
    if (kind === "plate") { blob(g, 16, 18, 8, 4, main); blob(g, 14, 17, 3, 2, acc); if (gar) { dot(g, 20, 16, gar); dot(g, 21, 17, gar); } }
    if (kind === "fishplate") { blob(g, 15, 18, 9, 3, main); px(g, 23, 15, 4, 6, dk(main, 0.8)); for (let x = 9; x < 22; x += 3) px(g, x, 17, 1, 3, acc); dot(g, 9, 17, OUT); px(g, 6, 20, 3, 2, gar); }
    if (kind === "toast") { px(g, 8, 11, 16, 11, main); px(g, 8, 11, 16, 2, dk(main, 0.7)); px(g, 10, 13, 12, 7, acc); px(g, 10, 13, 5, 2, lt(acc, 0.5)); dot(g, 19, 18, dk(acc, 0.7)); }
    if (kind === "roast") { blob(g, 16, 16, 9, 6, main); px(g, 22, 10, 3, 6, "#f4ead2"); px(g, 23, 9, 3, 2, "#f4ead2"); for (let x = 10; x < 22; x += 4) px(g, x, 13, 2, 6, acc); if (gar) { dot(g, 8, 20, gar); dot(g, 24, 20, gar); } }
    if (kind === "sushi") { for (const x of [8, 16, 24]) { ell(g, x, 17, 4, 4, gar); ell(g, x, 17, 3, 3, main); ell(g, x, 17, 1, 1, acc); } }
  } else if (kind === "pie") {
    ell(g, 16, 20, 13, 6, dk(main, 0.75)); ell(g, 16, 19, 12, 5, main); ell(g, 16, 18, 9, 3, acc); px(g, 9, 16, 14, 1, lt(main, 0.3));
    for (let x = 8; x < 25; x += 4) px(g, x, 22, 2, 2, dk(main, 0.8)); if (gar) { blob(g, 16, 16, 3, 2, gar); }
  } else if (kind === "cake") {
    px(g, 7, 13, 18, 12, main); px(g, 7, 13, 18, 3, lt(main, 0.4)); px(g, 23, 13, 2, 12, dk(main, 0.8)); px(g, 7, 18, 18, 2, acc); px(g, 7, 24, 18, 1, dk(main, 0.7));
    for (let x = 8; x < 24; x += 4) { px(g, x, 12, 3, 2, gar || WHITE); } blob(g, 16, 10, 2, 2, acc); dot(g, 17, 7, "#3f8f3a");
  } else if (kind === "stack") {
    for (let i = 0; i < 4; i++) { ell(g, 16, 24 - i * 4, 11, 3, dk(main, 0.75)); ell(g, 16, 23 - i * 4, 10, 2, main); }
    px(g, 13, 8, 6, 3, gar); px(g, 14, 7, 4, 1, lt(gar, 0.5)); for (let y = 11; y < 22; y += 3) px(g, 23 - (y % 2), y, 2, 3, acc);
  } else if (kind === "candy") {
    for (const [x, y] of [[9, 12], [19, 10], [14, 20]]) { px(g, x, y, 8, 8, main); px(g, x, y, 8, 2, lt(main, 0.4)); px(g, x + 6, y, 2, 8, dk(main, 0.75)); dot(g, x + 2, y + 3, gar); dot(g, x + 5, y + 5, gar); }
  } else if (kind === "candyapple") {
    px(g, 15, 3, 2, 9, gar); blob(g, 16, 18, 9, 9, main); px(g, 10, 13, 3, 4, lt(main, 0.6)); px(g, 9, 25, 14, 2, dk(main, 0.6));
  }
}

// ------------------------------------------------------------------ bugs: (body type, colours)
const BUGS = {
  cabbage_white: ["fly", "#f4f1ea", "#cfcab8", "#3a3a3a"], monarch: ["fly", "#f28c28", "#2b2118", "#ffffff"], swallowtail: ["fly", "#f7d35a", "#2b2118", "#4a7fe0"],
  bumblebee: ["bee", "#f2c744", "#2b2118", "#dcf2fc"], ladybug: ["beetle", "#e0302f", "#2b2118", "#2b2118"], dragonfly: ["dragon", "#3fa6c8", "#a8e0f0", "#2b5a7a"],
  firefly: ["beetle", "#5a4a3a", "#f7f070", "#2b2118"], cicada: ["bee", "#6a8a4a", "#cfe8f0", "#3a4a2a"], stag_beetle: ["stag", "#4a2a1a", "#8a5a3a", "#2b2118"],
  cricket: ["hopper", "#5a3a2a", "#8a6a4a", "#2b2118"], grasshopper: ["hopper", "#6cc24a", "#a8e07a", "#2f6a2a"], luna_moth: ["fly", "#bff0b0", "#8ad08a", "#e8a8c8"],
  snow_flea: ["hopper", "#c8d8e8", "#ffffff", "#5a6a7a"], scorpion: ["scorp", "#c87a3a", "#8a4a1a", "#2b2118"], tarantula: ["spider", "#5a3a2a", "#c8783a", "#2b2118"],
  hermit_crab: ["crab", "#e0783a", "#f4d8b8", "#8a4a2a"], rainbow_beetle: ["beetle", "#3cc070", "#7a5ae0", "#ff7eb6"], cave_cricket: ["hopper", "#8a7a6a", "#c8b8a8", "#3a3028"],
};
function bug(g, kind, a, b, c) {
  if (kind === "fly") {   // butterfly / moth: four wings, a slim body
    for (const [x, y, r] of [[9, 11, 6], [23, 11, 6], [11, 21, 4], [21, 21, 4]]) { ell(g, x, y, r, r, a); ell(g, x, y, r - 2, r - 2, lt(a, 0.15)); }
    for (const [x, y] of [[7, 9], [25, 9], [9, 13], [23, 13]]) px(g, x, y, 2, 2, b); px(g, 5, 11, 1, 3, b); px(g, 26, 11, 1, 3, b);
    px(g, 15, 9, 2, 15, c); px(g, 14, 7, 1, 3, c); px(g, 17, 7, 1, 3, c);
  } else if (kind === "bee") {
    ell(g, 16, 18, 8, 6, a); for (const x of [12, 17]) px(g, x, 13, 3, 11, b); ell(g, 10, 11, 4, 3, c); ell(g, 21, 11, 4, 3, c); ell(g, 8, 18, 3, 3, b); dot(g, 7, 17, WHITE);
  } else if (kind === "beetle" || kind === "stag") {
    ell(g, 16, 19, 9, 8, a); px(g, 16, 12, 1, 15, dk(a, 0.6)); ell(g, 16, 10, 5, 3, b === "#f7f070" ? "#3a3028" : c);
    if (kind === "beetle") for (const [x, y] of [[12, 17], [20, 17], [13, 22], [19, 22]]) px(g, x, y, 2, 2, b);
    if (b === "#f7f070") ell(g, 16, 24, 5, 3, b);
    if (kind === "stag") { px(g, 11, 3, 2, 6, b); px(g, 19, 3, 2, 6, b); px(g, 12, 3, 2, 1, b); px(g, 18, 3, 2, 1, b); }
    for (const y of [15, 19, 23]) { px(g, 5, y, 3, 1, c); px(g, 24, y, 3, 1, c); }
    ell(g, 13, 16, 2, 3, lt(a, 0.4));
  } else if (kind === "dragon") {
    px(g, 15, 6, 3, 22, a); px(g, 15, 6, 1, 22, lt(a, 0.4)); ell(g, 16, 6, 3, 2, c);
    for (const [y, l] of [[10, 12], [14, 11]]) { px(g, 16 - l, y, l - 1, 3, b); px(g, 18, y, l - 1, 3, b); px(g, 16 - l, y, l - 1, 1, WHITE); }
  } else if (kind === "hopper") {
    ell(g, 15, 18, 10, 4, a); ell(g, 14, 17, 7, 2, lt(a, 0.3)); ell(g, 6, 17, 3, 3, b); dot(g, 5, 16, OUT);
    px(g, 18, 20, 2, 6, c); px(g, 20, 13, 7, 2, c); px(g, 25, 14, 2, 10, c); px(g, 2, 13, 4, 1, c); px(g, 1, 11, 1, 3, c);
  } else if (kind === "scorp") {
    ell(g, 14, 20, 7, 4, a); for (let i = 0; i < 6; i++) px(g, 20 + i, 18 - i * 2, 3, 3, a); px(g, 24, 6, 3, 3, b); dot(g, 23, 6, OUT);
    px(g, 4, 16, 4, 3, b); px(g, 4, 23, 4, 3, b); for (const x of [10, 13, 16]) { px(g, x, 24, 1, 4, c); px(g, x, 13, 1, 4, c); }
  } else if (kind === "spider") {
    ell(g, 16, 19, 7, 6, a); ell(g, 16, 11, 4, 3, a); for (let i = 0; i < 4; i++) { const y = 12 + i * 4; px(g, 4, y, 8, 2, c); px(g, 20, y, 8, 2, c); px(g, 4, y, 2, 4, c); px(g, 26, y, 2, 4, c); }
    ell(g, 16, 20, 3, 2, b); dot(g, 15, 10, "#ff4040"); dot(g, 17, 10, "#ff4040");
  } else if (kind === "crab") {
    ell(g, 18, 15, 8, 7, a); for (let r = 2; r < 7; r += 2) ell(g, 18, 15, r, r, dk(a, 0.8)); ell(g, 18, 15, 1, 1, b);
    ell(g, 10, 22, 6, 3, b); px(g, 3, 17, 4, 3, c); px(g, 2, 15, 2, 3, c); px(g, 6, 18, 2, 1, OUT); dot(g, 8, 19, OUT);
  }
}

// ------------------------------------------------------------------ fossils and artifacts
function slab(g) { ell(g, 16, 17, 13, 10, "#8f8c86"); ell(g, 15, 16, 12, 9, "#b1aea7"); ell(g, 12, 12, 5, 3, "#c7c4bd"); for (const [x, y] of [[8, 22], [24, 12], [20, 25]]) dot(g, x, y, "#6c6964"); }
const DIG = {
  ammonite: (g) => { slab(g); for (let r = 9; r > 0; r -= 2) { ell(g, 16, 17, r, r, r % 4 === 1 ? "#8a7a62" : "#d8c8a8"); } ell(g, 16, 17, 1, 1, "#5a4a3a"); },
  trilobite: (g) => { slab(g); ell(g, 16, 17, 6, 9, "#8a7a62"); px(g, 15, 9, 2, 17, "#5a4a3a"); for (let y = 11; y < 25; y += 3) { px(g, 10, y, 5, 1, "#5a4a3a"); px(g, 17, y, 5, 1, "#5a4a3a"); } },
  fern_fossil: (g) => { slab(g); px(g, 15, 8, 1, 18, "#6a5a42"); for (let y = 9; y < 24; y += 2) { px(g, 16 - (24 - y) / 2, y, (24 - y) / 2, 1, "#8a7a62"); px(g, 16, y, (24 - y) / 2, 1, "#8a7a62"); } },
  amber: (g) => { blob(g, 16, 17, 10, 9, "#e89a2a"); ell(g, 16, 17, 7, 6, "#f2b84a"); px(g, 14, 15, 4, 3, "#5a3a1a"); px(g, 12, 14, 2, 1, "#5a3a1a"); px(g, 18, 14, 2, 1, "#5a3a1a"); px(g, 10, 11, 3, 2, "#fff0c0"); },
  dino_tooth: (g) => { for (let y = 4; y < 27; y++) { const hw = Math.max(1, Math.round((y - 3) / 3)); px(g, 16 - hw, y, hw * 2, 1, y < 22 ? "#efe6d0" : "#c8b890"); } px(g, 14, 8, 1, 14, WHITE); px(g, 18, 12, 1, 12, "#b8a880"); },
  fossil_fish: (g) => { slab(g); ell(g, 15, 17, 8, 4, "#8a7a62"); px(g, 22, 14, 4, 7, "#8a7a62"); for (let x = 10; x < 21; x += 2) px(g, x, 14, 1, 7, "#5a4a3a"); dot(g, 9, 16, "#3a2a1a"); },
  dino_skull: (g) => { ell(g, 15, 15, 11, 8, "#e6dcc4"); px(g, 14, 20, 15, 5, "#e6dcc4"); ell(g, 10, 13, 3, 3, "#3a3028"); for (let x = 16; x < 28; x += 3) px(g, x, 24, 2, 3, WHITE); px(g, 4, 13, 2, 4, "#c8b890"); ell(g, 13, 10, 4, 2, WHITE); },
  mammoth_tusk: (g) => { for (let i = 0; i < 22; i++) { const x = 5 + i, y = Math.round(24 - Math.sin(i / 7) * 14), w = Math.max(2, 5 - Math.floor(i / 6)); px(g, x, y - Math.floor(w / 2), 1, w, i % 5 === 0 ? "#d8cbb0" : "#efe6d0"); dot(g, x, y - Math.floor(w / 2), WHITE); } },
  arrowhead: (g) => { for (let y = 4; y < 22; y++) { const hw = Math.round((y - 3) / 2.2); px(g, 16 - hw, y, hw * 2 + 1, 1, y % 3 ? "#7a7a82" : "#9a9aa4"); } px(g, 13, 22, 7, 6, "#6a5a42"); dot(g, 14, 9, WHITE); },
  old_coin: (g) => { blob(g, 16, 16, 10, 10, "#c9a640"); ell(g, 16, 16, 7, 7, "#a8862a"); ell(g, 16, 16, 6, 6, "#d8b84a"); px(g, 14, 12, 5, 8, "#a8862a"); px(g, 11, 10, 3, 2, "#fff2a8"); },
  clay_pot: (g) => { for (let y = 8; y < 28; y++) { const hw = Math.round(5 + 6 * Math.sin((y - 6) / 22 * Math.PI)); px(g, 16 - hw, y, hw * 2, 1, y % 6 === 0 ? "#8a4a2a" : "#c86a3a"); } px(g, 11, 6, 10, 3, "#a8542a"); px(g, 11, 13, 3, 8, "#e88a5a"); px(g, 9, 17, 14, 1, "#2b2118"); },
  rusty_spur: (g) => { px(g, 4, 15, 16, 4, "#8a5a3a"); px(g, 4, 15, 16, 1, "#b87a4a"); blob(g, 23, 17, 6, 6, "#a87a5a"); for (let a = 0; a < 8; a++) dot(g, 23 + Math.round(Math.cos(a * 0.785) * 7), 17 + Math.round(Math.sin(a * 0.785) * 7), "#6a4a2a"); },
  ships_compass: (g) => { blob(g, 16, 16, 11, 11, "#c9a640"); ell(g, 16, 16, 8, 8, "#f4f1ea"); px(g, 15, 9, 2, 8, "#d9463c"); px(g, 15, 16, 2, 7, "#3a3a40"); px(g, 9, 15, 14, 2, "#c8c2b5"); dot(g, 16, 16, OUT); },
  tin_soldier: (g) => { px(g, 13, 3, 6, 6, "#2b2118"); px(g, 13, 9, 6, 5, "#f4c9a0"); px(g, 12, 14, 8, 8, "#d9463c"); px(g, 12, 18, 8, 1, "#f2c744"); px(g, 13, 22, 3, 7, "#3a5a9a"); px(g, 17, 22, 3, 7, "#3a5a9a"); px(g, 20, 8, 2, 14, "#9a9aa4"); },
  golden_idol: (g) => { px(g, 9, 6, 14, 22, "#c9a640"); px(g, 11, 4, 10, 4, "#c9a640"); px(g, 9, 6, 3, 22, "#f2d870"); px(g, 20, 6, 3, 22, "#a8862a"); px(g, 12, 11, 3, 3, "#2b2118"); px(g, 18, 11, 3, 3, "#2b2118"); px(g, 13, 19, 7, 2, "#7a5a1a"); dot(g, 13, 12, "#5ae0a0"); dot(g, 19, 12, "#5ae0a0"); },
};
// ------------------------------------------------------------------ paintings: a frame and a little scene; forgeries get one detail wrong
const PAINT = {
  meadow_dawn: (g, f) => { px(g, 6, 6, 20, 9, "#f2a86a"); px(g, 6, 6, 20, 3, "#e87a6a"); ell(g, 18, 15, 4, 3, f ? "#f2f2f2" : "#ffe066"); px(g, 6, 15, 20, 11, "#6cc24a"); for (let x = 7; x < 25; x += 3) dot(g, x, 18 + (x % 2) * 3, "#ffe066"); },
  moonlit_pond: (g, f) => { px(g, 6, 6, 20, 20, "#2a3a6a"); ell(g, 20, 10, 3, 3, f ? "#f2c744" : "#f4f1ea"); px(g, 6, 17, 20, 9, "#3a5a9a"); px(g, 18, 20, 5, 1, "#c8d8f0"); for (const [x, y] of [[9, 8], [13, 12], [24, 14]]) dot(g, x, y, WHITE); },
  lighthouse_storm: (g, f) => { px(g, 6, 6, 20, 20, "#4a5a6a"); px(g, 6, 20, 20, 6, "#2a4a6a"); px(g, 18, 9, 4, 12, "#f4f1ea"); px(g, 18, 12, 4, 2, f ? "#3a7bd5" : "#d9463c"); px(g, 17, 7, 6, 2, "#ffe066"); for (let x = 6; x < 26; x += 4) px(g, x, 20, 3, 1, WHITE); },
  prize_cow: (g, f) => { px(g, 6, 6, 20, 20, "#c8d8a8"); ell(g, 16, 17, 7, 5, "#f4f1ea"); px(g, 12, 15, 4, 3, "#2b2118"); px(g, 18, 18, 3, 2, "#2b2118"); px(g, 9, 13, 4, 4, "#f4f1ea"); dot(g, 10, 14, OUT); px(g, 20, 9, 4, 4, f ? "#3a7bd5" : "#d9463c"); },
  starry_valley: (g, f) => { px(g, 6, 6, 20, 20, "#1e2a5a"); for (let i = 0; i < 4; i++) ell(g, 9 + i * 5, 10 + (i % 2) * 3, 2, 2, "#ffe066"); ell(g, 22, 9, 2, 2, f ? "#e0524f" : "#f4f1ea"); px(g, 6, 20, 20, 6, "#2a3a2a"); px(g, 9, 14, 2, 12, "#1a2a1a"); px(g, 8, 12, 4, 3, "#1a2a1a"); },
  still_turnips: (g, f) => { px(g, 6, 6, 20, 20, "#8a6a4a"); px(g, 6, 20, 20, 6, "#a5744a"); for (const x of [10, 16, 21]) { ell(g, x, 18, 3, 3, "#f3e9f7"); px(g, x - 2, 15, 4, 1, "#c98fd2"); px(g, x, 12, 1, 3, f ? "#e0524f" : "#6cc24a"); } },
  mesa_dusk: (g, f) => { px(g, 6, 6, 20, 10, "#f28c5a"); px(g, 6, 6, 20, 4, "#c8507a"); px(g, 8, 13, 8, 7, "#b8613f"); px(g, 18, 15, 7, 5, "#a8513a"); px(g, 6, 20, 20, 6, "#e3b47c"); ell(g, 21, 10, 2, 2, f ? "#ffffff" : "#ffe066"); },
  watering_girl: (g, f) => { px(g, 6, 6, 20, 20, "#a8d8a8"); px(g, 13, 9, 6, 5, "#2b2118"); px(g, 14, 11, 4, 3, "#f4c9a0"); px(g, 12, 14, 8, 9, f ? "#3a7bd5" : "#ff7eb6"); px(g, 20, 17, 5, 4, "#4f7fa8"); px(g, 6, 23, 20, 3, "#6cc24a"); },
  pumpkin_patch: (g, f) => { px(g, 6, 6, 20, 10, "#f2c890"); px(g, 6, 16, 20, 10, "#8a6a3a"); for (const [x, y] of [[10, 19], [17, 21], [22, 18]]) { ell(g, x, y, 3, 2, "#f28c28"); dot(g, x, y - 3, f ? "#2b2118" : "#3f8f3a"); } },
  winter_town: (g, f) => { px(g, 6, 6, 20, 20, "#c8d8e8"); px(g, 9, 13, 6, 8, "#b85a44"); px(g, 9, 11, 6, 3, WHITE); px(g, 17, 14, 6, 7, "#7fa6cf"); px(g, 17, 12, 6, 3, WHITE); px(g, 6, 21, 20, 5, WHITE); dot(g, 11, 16, f ? "#3a3a40" : "#ffd27a"); },
};
function painting(g, k, fake) {
  px(g, 3, 3, 26, 26, "#8a5a1a"); px(g, 3, 3, 26, 2, "#c9a640"); px(g, 3, 3, 2, 26, "#c9a640"); px(g, 27, 3, 2, 26, "#6a4a12"); px(g, 3, 27, 26, 2, "#6a4a12");
  px(g, 5, 5, 22, 22, "#f4ead2"); (PAINT[k] || PAINT.meadow_dawn)(g, fake);
}

// ------------------------------------------------------------------ everything else, one by one
const SIMPLE = {
  fiber: (g) => { for (let i = 0; i < 6; i++) px(g, 9 + i * 3, 6 + (i % 3) * 2, 2, 20, i % 2 ? "#6cc24a" : "#4f9e3b"); px(g, 8, 18, 18, 3, "#c9a66b"); },
  fabric: (g) => { px(g, 4, 17, 22, 8, "#b8389f"); px(g, 4, 17, 22, 2, "#d64fbf"); ell(g, 25, 21, 3, 4, "#a8308f"); px(g, 7, 9, 20, 8, "#d64fbf"); px(g, 7, 9, 20, 2, "#ee7ad8"); ell(g, 26, 13, 3, 4, "#c04aa8"); ell(g, 26, 13, 1, 2, "#8a2a78"); for (let x = 9; x < 24; x += 4) { dot(g, x, 13, "#ffd0f0"); dot(g, x - 2, 21, "#e888d0"); } },
  flour: (g) => { px(g, 8, 8, 16, 19, "#f4ead2"); px(g, 9, 5, 14, 4, "#e6d8b8"); px(g, 10, 4, 12, 2, "#c9b283"); px(g, 21, 8, 3, 19, "#d8c8a8"); px(g, 11, 14, 10, 6, "#c9a66b"); px(g, 13, 16, 6, 2, "#f4ead2"); },
  coal: (g) => { blob(g, 15, 18, 9, 7, "#3a3a40"); blob(g, 19, 13, 5, 4, "#2b2b30"); dot(g, 12, 15, "#8a8a92"); dot(g, 17, 11, "#8a8a92"); },
  feather: (g) => { for (let i = 0; i < 20; i++) { const x = 8 + i, y = 25 - i; px(g, x - 3, y, 7, 1, i < 3 ? "#c8c2b5" : "#f4f1ea"); dot(g, x, y, "#c8c2b5"); } },
  fur: (g) => { blob(g, 16, 17, 11, 8, "#c9975f"); for (let i = 0; i < 12; i++) px(g, 7 + i * 2, 11 + (i % 3), 1, 4, "#a5744a"); },
  leather: (g) => { blob(g, 16, 16, 11, 9, "#a5642a"); for (let x = 7; x < 26; x += 3) dot(g, x, 9, "#6a3a1a"); for (let x = 7; x < 26; x += 3) dot(g, x, 23, "#6a3a1a"); },
  egg: (g) => { for (let y = 7; y < 27; y++) { const t = (y - 7) / 20, hw = Math.round(8 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1))); px(g, 16 - hw, y, hw * 2, 1, y < 12 ? "#ffffff" : y < 22 ? "#f4f1ea" : "#d8d2c6"); } px(g, 12, 11, 3, 4, WHITE); },
  cheese: (g) => { for (let y = 10; y < 26; y++) { const w = Math.round((y - 10) * 1.3) + 6; px(g, 6, y, w, 1, y < 13 ? "#ffe680" : "#f7d35a"); } px(g, 6, 25, 26, 1, "#c9a640"); for (const [x, y] of [[9, 20], [14, 22], [12, 16]]) ell(g, x, y, 1, 1, "#d8b040"); },
  jam: (g) => jar(g, "#c92a3a", "#e85a6a"), pickles: (g) => jar(g, "#6a9a3a", "#9aca5a"), honey: (g) => jar(g, "#f2b030", "#ffd870"), mayonnaise: (g) => jar(g, "#f4ecd0", "#ffffff"),
  wild_rabbit: (g) => { blob(g, 15, 19, 9, 6, "#c9a07a"); blob(g, 8, 14, 4, 4, "#c9a07a"); px(g, 6, 6, 2, 7, "#c9a07a"); px(g, 9, 5, 2, 8, "#b8906a"); dot(g, 7, 14, OUT); px(g, 23, 18, 3, 3, "#f4f1ea"); },
  quail: (g) => { blob(g, 16, 18, 9, 7, "#8a6a4a"); blob(g, 9, 13, 4, 4, "#8a6a4a"); px(g, 9, 6, 1, 4, OUT); px(g, 4, 13, 3, 1, "#c9a640"); dot(g, 8, 12, OUT); for (let x = 12; x < 24; x += 3) dot(g, x, 17, WHITE); },
  deer: (g) => { blob(g, 17, 18, 10, 6, "#b8784a"); blob(g, 7, 12, 4, 4, "#b8784a"); px(g, 4, 3, 1, 7, "#e8dcc0"); px(g, 9, 3, 1, 7, "#e8dcc0"); px(g, 3, 4, 3, 1, "#e8dcc0"); px(g, 8, 4, 3, 1, "#e8dcc0"); for (const [x, y] of [[15, 16], [20, 18]]) dot(g, x, y, WHITE); },
  boar: (g) => { blob(g, 17, 18, 11, 7, "#6a4a3a"); blob(g, 6, 18, 4, 4, "#8a6a5a"); px(g, 4, 20, 3, 1, "#f4f1ea"); for (let x = 12; x < 26; x += 2) px(g, x, 11, 1, 2, "#3a2a1a"); },
  rabbit_meat: (g) => meat(g, "#e88a7a"), quail_meat: (g) => meat(g, "#f0a090"), venison: (g) => meat(g, "#b8483a"), boar_meat: (g) => meat(g, "#c8584a"),
  sword_rusty: (g) => sword(g, "#b8784a", "#8a5a3a"), sword_copper: (g) => sword(g, "#e0905a", "#b8683a"), sword_iron: (g) => sword(g, "#dfe4ea", "#9aa4b0"), sword_gold: (g) => sword(g, "#ffe066", "#d8a828"),
  bow: (g) => { for (let i = 0; i < 24; i++) { const y = 4 + i, x = 9 + Math.round(Math.sin(i / 23 * Math.PI) * 9); px(g, x, y, 3, 1, i % 7 === 0 ? "#5a3a22" : "#a5713f"); } px(g, 9, 4, 1, 24, "#f4f1ea"); },
  rifle: (g) => { for (let i = 0; i < 26; i++) px(g, 3 + i, 26 - i, 3, 2, i < 9 ? "#8a5a3a" : "#4b4b4e"); px(g, 9, 19, 4, 4, "#8a5a3a"); px(g, 26, 2, 2, 3, "#2d2d30"); },
  slingshot: (g) => { px(g, 15, 15, 3, 13, "#a5713f"); for (let i = 0; i < 9; i++) { px(g, 15 - i, 15 - i, 2, 1, "#a5713f"); px(g, 17 + i, 15 - i, 2, 1, "#a5713f"); } px(g, 8, 7, 18, 1, "#c8a080"); px(g, 15, 7, 3, 3, "#8a6a4a"); },
  arrow: (g) => { for (let i = 0; i < 22; i++) px(g, 5 + i, 26 - i, 2, 1, "#a5713f"); px(g, 24, 3, 5, 2, "#9aa4b0"); px(g, 26, 3, 2, 5, "#9aa4b0"); px(g, 4, 23, 4, 2, "#f4f1ea"); px(g, 6, 25, 2, 4, "#f4f1ea"); },
  bullet: (g) => { for (const x of [8, 15, 22]) { px(g, x, 12, 5, 14, "#c9a640"); px(g, x, 12, 1, 14, "#fff2a8"); px(g, x, 8, 5, 4, "#9a9aa4"); px(g, x + 1, 6, 3, 2, "#9a9aa4"); } },
  slime_jelly: (g) => { blob(g, 16, 18, 10, 8, "#6cd85a"); px(g, 11, 13, 3, 3, "#c8f8b0"); },
  bat_wing: (g) => { for (let i = 0; i < 5; i++) px(g, 4 + i * 5, 8 + Math.abs(2 - i) * 3, 5, 12 - Math.abs(2 - i) * 3, "#7a4a9a"); px(g, 4, 20, 24, 2, "#5a2a7a"); },
  crab_shell: (g) => { blob(g, 16, 17, 11, 8, "#e0604a"); for (let x = 8; x < 25; x += 4) dot(g, x, 14, "#f8a090"); },
  ectoplasm: (g) => { blob(g, 16, 17, 9, 10, "#8af0e0"); px(g, 12, 12, 3, 3, WHITE); px(g, 10, 24, 3, 3, "#8af0e0"); px(g, 19, 25, 3, 3, "#8af0e0"); },
  treasure_key: (g) => { ell(g, 10, 11, 5, 5, "#c9a640"); ell(g, 10, 11, 2, 2, "#2b2118"); px(g, 13, 13, 14, 3, "#c9a640"); px(g, 22, 16, 2, 4, "#c9a640"); px(g, 26, 16, 2, 6, "#c9a640"); },
  monster_treat: (g) => { ell(g, 16, 17, 11, 7, "#e88ac8"); ell(g, 16, 16, 9, 5, "#f8b8e0"); for (const [x, y] of [[11, 15], [16, 13], [21, 16]]) px(g, x, y, 2, 2, "#ffe066"); },
  bug_net: (g) => { px(g, 4, 25, 2, 2, "#a5713f"); for (let i = 0; i < 14; i++) px(g, 5 + i, 24 - i, 2, 1, "#a5713f"); ell(g, 22, 9, 7, 7, "#e8e2d6"); ell(g, 22, 9, 6, 6, "#f8f4ee"); for (let x = 17; x < 28; x += 3) px(g, x, 4, 1, 11, "#c8c2b5"); },
  shovel: (g) => { for (let i = 0; i < 16; i++) px(g, 6 + i, 26 - i, 2, 1, "#a5713f"); px(g, 18, 3, 10, 12, "#9aa4b0"); px(g, 18, 3, 10, 2, "#dfe4ea"); px(g, 4, 25, 4, 3, "#5a3a22"); },
  path_stone: (g) => { for (const [x, y, w] of [[6, 8, 9], [17, 9, 9], [10, 18, 11]]) { px(g, x, y, w, 7, "#b7ae9e"); px(g, x, y, w, 2, "#e2dccf"); px(g, x + w - 2, y, 2, 7, "#8a8174"); } },
  bridge_kit: (g) => { for (let i = 0; i < 4; i++) { px(g, 5, 7 + i * 5, 22, 4, "#a5713f"); px(g, 5, 7 + i * 5, 22, 1, "#dcae74"); } px(g, 9, 6, 2, 20, "#5a3a22"); px(g, 21, 6, 2, 20, "#5a3a22"); },
  mystery_ticket: (g) => { px(g, 4, 9, 24, 14, "#7fd8e8"); px(g, 4, 9, 24, 2, "#c8f4fc"); for (let y = 11; y < 23; y += 3) dot(g, 21, y, WHITE); px(g, 7, 14, 10, 1, "#2b5a7a"); px(g, 7, 17, 7, 1, "#2b5a7a"); ell(g, 25, 16, 2, 3, "#ffe066"); },
  star_fragment: (g) => { const pts = [[16, 3], [19, 12], [28, 12], [21, 18], [24, 28], [16, 22], [8, 28], [11, 18], [4, 12], [13, 12]]; for (let y = 3; y < 29; y++) for (let x = 3; x < 29; x++) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } if (c) px(g, x, y, 1, 1, y < 14 ? "#fff2a8" : "#f2c744"); } dot(g, 14, 10, WHITE); },
  present: (g) => { px(g, 6, 12, 20, 15, "#e0524f"); px(g, 6, 12, 20, 2, "#f07a72"); px(g, 4, 9, 24, 4, "#c8383a"); px(g, 14, 9, 4, 18, "#ffe066"); px(g, 9, 4, 6, 5, "#ffe066"); px(g, 17, 4, 6, 5, "#ffe066"); },
  feast_gift: (g) => { px(g, 6, 12, 20, 15, "#3fa66a"); px(g, 4, 9, 24, 4, "#2a8a50"); px(g, 14, 9, 4, 18, "#f4f1ea"); px(g, 9, 4, 6, 5, "#f4f1ea"); px(g, 17, 4, 6, 5, "#f4f1ea"); },
  blue_ribbon: (g) => ribbon(g, "#3a7bd5"), red_ribbon: (g) => ribbon(g, "#d9463c"),
  derby_trophy: (g) => { px(g, 9, 5, 14, 12, "#f2c744"); px(g, 9, 5, 4, 12, "#fff2a8"); px(g, 5, 7, 4, 6, "#d8a828"); px(g, 23, 7, 4, 6, "#d8a828"); px(g, 14, 17, 4, 5, "#d8a828"); px(g, 9, 22, 14, 5, "#8a5a3a"); },
  clay: (g) => { blob(g, 16, 18, 10, 7, "#c86a3a"); dot(g, 12, 15, "#e88a5a"); },
  craft_table: (g) => { px(g, 3, 11, 26, 6, "#a5713f"); px(g, 3, 11, 26, 2, "#dcae74"); px(g, 5, 17, 3, 11, "#7f5432"); px(g, 24, 17, 3, 11, "#7f5432"); px(g, 8, 6, 8, 5, "#9aa4b0"); px(g, 19, 4, 2, 7, "#a5713f"); px(g, 17, 3, 6, 3, "#4b4b4e"); },
  adopt_dog: (g) => { blob(g, 16, 19, 9, 7, "#c98a4a"); blob(g, 11, 12, 6, 5, "#c98a4a"); px(g, 6, 9, 3, 7, "#8a5a2a"); px(g, 15, 9, 3, 7, "#8a5a2a"); dot(g, 9, 12, OUT); dot(g, 13, 12, OUT); px(g, 10, 15, 3, 2, OUT); },
  adopt_cat: (g) => { blob(g, 16, 19, 9, 7, "#9a9aa4"); blob(g, 12, 12, 6, 5, "#9a9aa4"); px(g, 7, 6, 3, 5, "#9a9aa4"); px(g, 15, 6, 3, 5, "#9a9aa4"); dot(g, 10, 12, "#3fa66a"); dot(g, 14, 12, "#3fa66a"); px(g, 25, 10, 2, 10, "#9a9aa4"); },
  chicken: (g) => { blob(g, 16, 19, 9, 7, "#f4f1ea"); blob(g, 10, 12, 5, 5, "#f4f1ea"); px(g, 8, 6, 4, 3, "#e0524f"); px(g, 4, 12, 3, 2, "#f2a33a"); dot(g, 9, 11, OUT); px(g, 13, 26, 2, 3, "#f2a33a"); px(g, 18, 26, 2, 3, "#f2a33a"); },
};
function jar(g, c, l) { px(g, 9, 6, 14, 4, "#c8a050"); px(g, 9, 6, 14, 1, "#f2d890"); px(g, 8, 10, 16, 18, "#cfe8f0"); px(g, 9, 12, 14, 15, c); px(g, 9, 12, 4, 15, l); px(g, 11, 15, 10, 7, "#f4ead2"); px(g, 12, 17, 8, 1, c); }
function meat(g, c) { blob(g, 15, 17, 10, 7, c); ell(g, 15, 17, 6, 4, lt(c, 0.3)); px(g, 23, 12, 6, 3, "#f4ead2"); px(g, 27, 10, 3, 3, "#f4ead2"); px(g, 27, 14, 3, 3, "#f4ead2"); }
function sword(g, c, d) { for (let i = 0; i < 18; i++) { px(g, 10 + i, 21 - i, 3, 2, i < 1 ? d : c); dot(g, 10 + i, 21 - i, lt(c, 0.5)); } px(g, 6, 20, 8, 3, "#5a3a22"); px(g, 9, 17, 3, 9, "#c9a640"); px(g, 4, 24, 4, 4, "#5a3a22"); }
function ribbon(g, c) { ell(g, 16, 12, 8, 8, c); ell(g, 16, 12, 5, 5, lt(c, 0.4)); ell(g, 16, 12, 3, 3, "#f2c744"); px(g, 10, 18, 5, 10, c); px(g, 17, 18, 5, 10, c); }

function itemDrawer(key) {
  if (DISH[key]) return (g) => vessel(g, ...DISH[key]);
  if (BUGS[key]) return (g) => bug(g, ...BUGS[key]);
  if (DIG[key]) return DIG[key];
  if (SIMPLE[key]) return SIMPLE[key];
  const m = /^(art|fake)_(.+)$/.exec(key);
  if (m && PAINT[m[2]]) return (g) => painting(g, m[2], m[1] === "fake");
  return null;
}
const prevIcon = ART.iconCanvas, prevForage = ART.forageSprite;
ART.iconCanvas = function (key, cat) {
  const draw = itemDrawer(key);
  if (!draw) return prevIcon(key, cat);
  return cached("li:" + key, A, A, (g, c) => { draw(g); outline(c, OUT); });
};
ART.forageSprite = function (key) {
  if (!itemDrawer(key)) return prevForage(key);
  return cached("lf:" + key, A, A, (g) => { g.imageSmoothingEnabled = false; g.drawImage(ART.iconCanvas(key), 6, 8, 20, 20); });
};
Object.assign(ART, { itemDrawer, BUG_LOOK: BUGS, bugDraw: bug });
})();
