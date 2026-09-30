/* A tiny pixel-exact stand-in for the browser canvas so sprites can be rendered in Node.
   Supports what art.js uses: fillRect, drawImage (scaled, nearest), getImageData/putImageData,
   translate/scale/rotate (multiples of 90 degrees), save/restore, globalAlpha. Path/text calls are no-ops. */
"use strict";
function parseColor(c) {
  if (!c) return [0, 0, 0, 255];
  if (c[0] === "#") {
    const h = c.slice(1);
    if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 255];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255];
  }
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) { const p = m[1].split(",").map((v) => parseFloat(v)); return [p[0], p[1], p[2], p.length > 3 ? Math.round(p[3] * 255) : 255]; }
  return [0, 0, 0, 255];
}
class Ctx {
  constructor(canvas) { this.canvas = canvas; this.fillStyle = "#000"; this.globalAlpha = 1; this.m = [1, 0, 0, 1, 0, 0]; this.stack = []; this.imageSmoothingEnabled = false; }
  save() { this.stack.push({ m: this.m.slice(), fillStyle: this.fillStyle, globalAlpha: this.globalAlpha }); }
  restore() { const s = this.stack.pop(); if (s) { this.m = s.m; this.fillStyle = s.fillStyle; this.globalAlpha = s.globalAlpha; } }
  setTransform(a, b, c, d, e, f) { this.m = [a, b, c, d, e, f]; }
  _mul(a, b, c, d, e, f) { const m = this.m; this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; }
  translate(x, y) { this._mul(1, 0, 0, 1, x, y); }
  scale(x, y) { this._mul(x, 0, 0, y, 0, 0); }
  rotate(a) { const c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a)); this._mul(c, s, -s, c, 0, 0); }
  _pt(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  _blend(x, y, col, alpha) {
    const c = this.canvas; if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
    const i = (y * c.width + x) * 4, d = c._data, a = (col[3] / 255) * alpha;
    if (a >= 0.999) { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; return; }
    const da = d[i + 3] / 255, oa = a + da * (1 - a);
    if (oa <= 0) return;
    d[i] = Math.round((col[0] * a + d[i] * da * (1 - a)) / oa); d[i + 1] = Math.round((col[1] * a + d[i + 1] * da * (1 - a)) / oa); d[i + 2] = Math.round((col[2] * a + d[i + 2] * da * (1 - a)) / oa); d[i + 3] = Math.round(oa * 255);
  }
  fillRect(x, y, w, h) {
    const col = parseColor(this.fillStyle);
    const [x0, y0] = this._pt(x, y), [x1, y1] = this._pt(x + w, y + h);
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
    for (let yy = Math.round(ay); yy < Math.round(by); yy++) for (let xx = Math.round(ax); xx < Math.round(bx); xx++) this._blend(xx, yy, col, this.globalAlpha);
  }
  clearRect(x, y, w, h) { const c = this.canvas; for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { if (xx < 0 || yy < 0 || xx >= c.width || yy >= c.height) continue; const i = (yy * c.width + xx) * 4; c._data[i] = c._data[i + 1] = c._data[i + 2] = c._data[i + 3] = 0; } }
  drawImage(src, a, b, c, d, e, f, g, h) {
    let sx = 0, sy = 0, sw = src.width, sh = src.height, dx, dy, dw, dh;
    if (arguments.length >= 9) { sx = a; sy = b; sw = c; sh = d; dx = e; dy = f; dw = g; dh = h; }
    else { dx = a; dy = b; dw = c == null ? src.width : c; dh = d == null ? src.height : d; }
    const [x0, y0] = this._pt(dx, dy), [x1, y1] = this._pt(dx + dw, dy + dh);
    const ax = Math.round(Math.min(x0, x1)), bx = Math.round(Math.max(x0, x1)), ay = Math.round(Math.min(y0, y1)), by = Math.round(Math.max(y0, y1));
    const flipX = x1 < x0, flipY = y1 < y0;
    const rot = Math.abs(this.m[0]) < 1e-6 && Math.abs(this.m[3]) < 1e-6;   // 90-degree rotation: axes swapped
    const W = bx - ax, H = by - ay;
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      let u = xx / W, v = yy / H;
      if (rot) { const t = u; u = v; v = t; if (this.m[1] < 0) u = 1 - u - 1 / (2 * H); if (this.m[2] < 0) v = 1 - v - 1 / (2 * W); }   // 90-degree rotation (with or without a flip): invert the axis swap
      else { if (flipX) u = 1 - u - 1 / (2 * W); if (flipY) v = 1 - v - 1 / (2 * H); }
      const px_ = sx + Math.min(sw - 1, Math.floor(u * sw)), py_ = sy + Math.min(sh - 1, Math.floor(v * sh));
      const i = (py_ * src.width + px_) * 4, col = [src._data[i], src._data[i + 1], src._data[i + 2], src._data[i + 3]];
      if (col[3] === 0) continue;
      this._blend(ax + xx, ay + yy, col, this.globalAlpha);
    }
  }
  getImageData(x, y, w, h) {
    const out = new Uint8ClampedArray(w * h * 4), c = this.canvas;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const si = ((y + yy) * c.width + (x + xx)) * 4, di = (yy * w + xx) * 4; for (let k = 0; k < 4; k++) out[di + k] = c._data[si + k]; }
    return { data: out, width: w, height: h };
  }
  putImageData(img, x, y) { const c = this.canvas; for (let yy = 0; yy < img.height; yy++) for (let xx = 0; xx < img.width; xx++) { const si = (yy * img.width + xx) * 4, di = ((y + yy) * c.width + (x + xx)) * 4; for (let k = 0; k < 4; k++) c._data[di + k] = img.data[si + k]; } }
  beginPath() {} closePath() {} moveTo() {} lineTo() {} arc() {} arcTo() {} ellipse() {} quadraticCurveTo() {} fill() {} stroke() {} strokeRect() {} fillText() {} strokeText() {}
  measureText(t) { return { width: 6 * String(t).length }; }
  createRadialGradient() { return { addColorStop() {} }; }
}
class MockCanvas {
  constructor() { this._w = 0; this._h = 0; this._data = new Uint8ClampedArray(0); this.style = {}; this.classList = { add() {}, remove() {} }; }
  get width() { return this._w; } set width(v) { this._w = v; this._data = new Uint8ClampedArray(this._w * this._h * 4); }
  get height() { return this._h; } set height(v) { this._h = v; this._data = new Uint8ClampedArray(this._w * this._h * 4); }
  getContext() { return new Ctx(this); }
}
module.exports = { MockCanvas, parseColor };
