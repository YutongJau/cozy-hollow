/* Render sprites from the art modules to a PNG sheet, headless.
   usage: node tools/render.js out.png [scale] "expr" "expr" ...   (each expr is evaluated against ART, e.g. "grassTile('spring',3,0)")
   Each result canvas is placed left to right, wrapping into rows; a checker background shows transparency. */
"use strict";
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const { MockCanvas } = require("./mockcanvas");
global.window = {}; global.document = { createElement: (t) => new MockCanvas() };
const webDir = path.join(__dirname, "..", "web");
const manifest = fs.existsSync(path.join(webDir, "art-manifest.json")) ? JSON.parse(fs.readFileSync(path.join(webDir, "art-manifest.json"), "utf8")) : ["art.js"];
for (const f of manifest) { new Function("window", "document", fs.readFileSync(path.join(webDir, f), "utf8"))(global.window, global.document); }
const ART = global.window.ART;
const [outFile, maybeScale, ...rest] = process.argv.slice(2);
let scale = 4, exprs = rest;
if (/^\d+$/.test(maybeScale)) scale = parseInt(maybeScale, 10); else exprs = [maybeScale, ...rest];
const canvases = exprs.map((e) => { const c = new Function("ART", "with (ART) { return (" + e + "); }")(ART); if (!c || !c.width) throw new Error("not a canvas: " + e); return c; });
const gap = 4, perRow = Math.max(1, Math.min(canvases.length, Math.floor(1024 / ((Math.max(...canvases.map((c) => c.width)) * scale) + gap))));
const cw = Math.max(...canvases.map((c) => c.width)) * scale + gap, chh = Math.max(...canvases.map((c) => c.height)) * scale + gap;
const rows = Math.ceil(canvases.length / perRow), W = perRow * cw, H = rows * chh;
const out = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, k = ((x >> 3) + (y >> 3)) & 1; out[i] = out[i + 1] = out[i + 2] = k ? 190 : 210; out[i + 3] = 255; }
canvases.forEach((c, n) => {
  const ox = (n % perRow) * cw, oy = Math.floor(n / perRow) * chh;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const si = (y * c.width + x) * 4, a = c._data[si + 3] / 255; if (!a) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) { const di = ((oy + y * scale + dy) * W + (ox + x * scale + dx)) * 4; for (let k = 0; k < 3; k++) out[di + k] = Math.round(c._data[si + k] * a + out[di + k] * (1 - a)); }
  }
});
// minimal PNG writer
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(out.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
const crcTable = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
fs.writeFileSync(outFile, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log("wrote", outFile, W + "x" + H, "(" + canvases.length + " sprites, scale " + scale + ")");
