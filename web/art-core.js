/* Cozy Hollow art - core helpers, palettes and the 3x5 pixel font. Every other art module reads from window.ART. */
"use strict";
window.ART = (function () {
const A = 32;                                    // art pixels per tile
const cache = new Map();
function blank(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function px(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
function hash(x, y) { let h = (x * 73856093) ^ (y * 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = Math.imul(s, 1103515245) + 12345 >>> 0; return s / 4294967296; }; }
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgb(r, g, b) { return "rgb(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + ")"; }
function shade(h, f) { const [r, g, b] = hex(h); const c = (v) => Math.max(0, Math.min(255, v * f)); return rgb(c(r), c(g), c(b)); }
function mix(h1, h2, t) { const a = hex(h1), b = hex(h2); return rgb(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); }
function cached(key, w, h, draw) {
  let c = cache.get(key);
  if (c) return c;
  c = blank(w, h); draw(c.getContext("2d"), c); cache.set(key, c); return c;
}
/* dark 1px outline around every opaque pixel of a canvas (the Cattle Country look) */
function outline(c, color, inner) {
  const g = c.getContext("2d"), w = c.width, h = c.height;
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 40 ? 1 : 0;
  const [r, gg, b] = hex(color);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (solid[i]) continue;
    const n = (x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w]);
    if (n) { d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
  return c;
}
function mirrored(key, src) {
  return cached(key, src.width, src.height, (g) => { g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); });
}

const OUT = "#2b1f17";
const COLORS = { white: "#f4f1ea", yellow: "#f2c744", magenta: "#d64fbf", red: "#e0524f", blue: "#4a7fe0",
  green: "#6cc24a", cyan: "#3fc1e6", orange: "#f28c28", pink: "#ff7eb6", black: "#2b2118" };
const ITEM_HEX = { turnip: "#f3e9f7", potato: "#c9a36b", radish: "#e8467c", strawberry: "#e8394a",
  cauliflower: "#f7f3e8", sunflower: "#f7d23e", tomato: "#e8442e", corn: "#f2d15a", blueberry: "#4a63c9",
  melon: "#7cc95a", starfruit: "#ffcf5a", pumpkin: "#f28c28", cranberry: "#c92a3a", snowdrop: "#ffffff",
  winter_root: "#d9b27a", cherry: "#e8394a", apple: "#8fd14f", peach: "#ffb07c", plum: "#8a4fb5",
  wild_berry: "#e8394a", mushroom: "#c98f5a", daffodil: "#f7d23e", dandelion: "#fff2a8", leek: "#8fd14f",
  hazelnut: "#a5744a", snow_yam: "#f0e6d6", holly: "#3f8f3a", wood: "#a5744a" };
const SEASON = {
  spring: { grass: "#5fae3f", dark: "#48912e", light: "#83cc5c", deep: "#356f24", flowers: ["#ffffff", "#ffe066", "#ffa8c8"],
    trees: ["green", "green", "green", "green", "green", "pink", "lime"], petals: "#ffc2dc" },
  summer: { grass: "#56a636", dark: "#418a27", light: "#78c452", deep: "#306b1f", flowers: ["#ffe066", "#ffffff", "#ff8fa3"],
    trees: ["green", "green", "green", "green", "lime", "yellow"], petals: null },
  fall: { grass: "#a3ad4a", dark: "#86903a", light: "#c0ca68", deep: "#6e7830", flowers: ["#ffe066", "#f2a35e"],
    trees: ["orange", "yellow", "red", "green", "orange", "purple"], petals: "#e08a3a" },
  winter: { grass: "#e3ebf0", dark: "#c9d6de", light: "#ffffff", deep: "#b3c2cc", flowers: [],
    trees: ["snow", "snow", "snow", "green"], petals: "#ffffff" },
};
const TREE_PAL = {
  green: { D: "#2a6a2a", M: "#3f9438", L: "#63bd52", X: "#9ae07f" },
  lime: { D: "#4d7a1e", M: "#7bb43a", L: "#a3d45a", X: "#d2f08a" },
  pink: { D: "#a8467d", M: "#dd7fb8", L: "#f2add6", X: "#ffd9ec" },
  yellow: { D: "#9a7a1e", M: "#d6b23c", L: "#efd45f", X: "#fff0a0" },
  orange: { D: "#9a4a1e", M: "#d8783a", L: "#efa060", X: "#ffd0a0" },
  red: { D: "#8a2e2e", M: "#c8463c", L: "#e8735f", X: "#ffb0a0" },
  purple: { D: "#5a3a7a", M: "#8a5aae", L: "#b58ad0", X: "#dcc4ec" },
  snow: { D: "#8fa6b3", M: "#c8d8e0", L: "#eef5f8", X: "#ffffff" },
};
const WOOD = { light: "#d9a86a", mid: "#b8824c", dark: "#8a5a34", deep: "#5a3a22" };

// ------------------------------------------------------------ tiny pixel font (3x5)
const FONT = { A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100",
  G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "101111111111101", O: "010101101101010", P: "110101110100100", Q: "010101101110011", R: "110101110101101",
  S: "011100010001110", T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111", "0": "111101101101111", "1": "010110010010111", "2": "110001010100111", "3": "110001010001110",
  "4": "101101111001001", "5": "111100110001110", "6": "011100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001110",
  " ": "000000000000000", "-": "000000111000000", ".": "000000000000010", "&": "010101010101011", "'": "010010000000000" };
function text3x5(g, x, y, str, col, sc) {
  sc = sc || 1;
  for (const ch of str.toUpperCase()) {
    const bits = FONT[ch] || FONT[" "];
    for (let i = 0; i < 15; i++) if (bits[i] === "1") px(g, x + (i % 3) * sc, y + Math.floor(i / 3) * sc, sc, sc, col);
    x += 4 * sc;
  }
}
function textWidth(str, sc) { return str.length * 4 * (sc || 1) - (sc || 1); }

return { A, cache, blank, px, hash, rng, hex, rgb, shade, mix, cached, outline, mirrored, OUT, COLORS, ITEM_HEX, SEASON, TREE_PAL, WOOD, FONT, text3x5, textWidth };
})();
