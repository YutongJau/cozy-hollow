/* Cozy Hollow - browser client. Same JSON protocol as the terminal client,
   over a WebSocket. All pixel art lives in art.js (32px tiles). */
"use strict";
(function () {
const $ = (s) => document.querySelector(s);
const Art = window.ART;
const A = Art.A;
const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
let zoom = 2, SCALE = Math.round(zoom * dpr), T = A * SCALE;
const WALK_SPEED = 4.6;
const COLORS = Art.COLORS, ITEM_HEX = Art.ITEM_HEX, SEASON = Art.SEASON, WOOD = Art.WOOD, OUT = Art.OUT;
const blank = Art.blank, hash = Art.hash;
const TOOLS = new Set(["hoe", "watering_can", "scythe", "axe", "pickaxe", "fishing_rod"]);
function charSprite(kind, facing, frame, shirt, hat, armsUp) { return Art.farmerSprite(kind, facing, frame, shirt, hat || "cowboy", armsUp); }
function plantable(key) { const it = key && catalog && catalog.items[key]; return !!(it && (it.kind === "seed" || it.kind === "sapling")); }
function itemIcon(key, cat) { return Art.iconCanvas(key, cat); }
function treeKind(season, x, y) { const list = SEASON[season].trees; return list[hash(x * 3 + 1, y * 7 + 2) % list.length]; }

// ------------------------------------------------------------------ state
let ws = null, me = null, state = null, tiles = {}, map = [], catalog = null, farmName = "Cozy Hollow", noChest = new Set(), portals = new Set();
let RM = [], RG = [], areaBanner = null;   // RM: the map being drawn this frame; RG: the ground under it (props sit on their surroundings)
const _ground = new Map();
function groundOf(M) {
  /* the ground under every tile: ground tiles are themselves; a bench, lamp or fountain on a street takes the street's ground */
  let G = _ground.get(M);
  if (G) return G;
  const GROUNDS = ".:,=Hrvz~d", PAVED = ":=,rzv";
  G = M.map((row, y) => Array.from(row, (c, x) => {
    if (GROUNDS.includes(c)) return c;
    const n = {}; let best = ".", bestN = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (M[y + dy] || "")[x + dx]; if (k && PAVED.includes(k)) n[k] = (n[k] || 0) + 1; }
    for (const k in n) if (n[k] > bestN) { best = k; bestN = n[k]; }
    return bestN >= 2 || (bestN >= 1 && "FJlbg!".includes(c)) ? best : ".";
  }));
  _ground.set(M, G);
  return G;
}
let mode = "login";
let menu = null, fishing = null;
const viz = {};
const my = { ready: false, x: 0, y: 0, tx: 0, ty: 0, stepping: false, dir: "down", dist: 0, lastSend: 0, lastTurn: 0, loc: "farm", queued: null };
function curLoc() { return my.loc || "farm"; }
function isArea(loc) { return !!(catalog && catalog.areas && catalog.areas[loc]); }
function isOutdoor(loc) { return loc === "farm" || isArea(loc); }
function curMap() { const l = curLoc(); return l === "farm" ? map : isArea(l) ? catalog.areas[l] : (catalog.interiors[l] || map); }
function areaTiles(loc) { return loc === "farm" ? tiles : ((state && state.areas && state.areas[loc]) || {}); }
const AREA_WALK = ".:,=Hrvz";
const AREA_BASE = { mine1: "v", mine2: "v", mine3: "v", frontier: "z" };   // ground under everything (grass elsewhere)
const cam = { x: 35, y: 15, snap: true };
let logLines = [], toastTimer = null, buildings = [];
let drops = [], fireflies = [], petals = [], smoke = [], butterflies = [], hearts = [];
const swings = {};            // name -> {tool, start, x, y}
let audio = null, music = null;
const held = new Set();
let lastDir = null;
const prefs = { name: localStorage.getItem("cozy.name") || "", sprite: localStorage.getItem("cozy.sprite") || "girl",
  color: localStorage.getItem("cozy.color") || "pink", hat: localStorage.getItem("cozy.hat") || "cowboy" };
const cowViz = {};            // cow id -> {x, y, tx, ty, f}
const fxs = [];               // objects in flight: lifted off a tile into someone's hands, or dropped onto one
let lastXp = null, slotSig = null;
const canvas = $("#map"), ctx = canvas.getContext("2d");

// ------------------------------------------------------------------ audio
function sfx(kind) {
  if (!audio) return;
  const t = audio.currentTime;
  const note = (f, start, dur, type, vol) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type || "triangle"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + start); g.gain.exponentialRampToValueAtTime(vol || 0.08, t + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
    o.connect(g).connect(audio.destination); o.start(t + start); o.stop(t + start + dur + 0.05);
  };
  if (kind === "harvest") { note(523, 0, .12); note(784, .1, .18); }
  else if (kind === "coin") { note(988, 0, .08, "square", .05); note(1319, .07, .14, "square", .05); }
  else if (kind === "water") { note(220, 0, .1, "sine", .06); note(180, .05, .12, "sine", .05); }
  else if (kind === "pop") { note(330, 0, .07, "triangle", .06); }
  else if (kind === "ping") { note(660, 0, .15); note(880, .15, .15); note(660, .3, .25); }
  else if (kind === "fail") { note(300, 0, .15, "sawtooth", .04); note(220, .12, .25, "sawtooth", .04); }
}
function toggleMusic() {
  if (!audio) return;
  if (music) { clearInterval(music.timer); music.pad.stop(); music = null; toast("Music off", "info"); return; }
  const pad = audio.createOscillator(), padG = audio.createGain(), pad2 = audio.createOscillator();
  pad.type = "sine"; pad.frequency.value = 130.8; pad2.type = "sine"; pad2.frequency.value = 196;
  padG.gain.value = 0.025; pad.connect(padG); pad2.connect(padG); padG.connect(audio.destination); pad.start(); pad2.start();
  const scale = [523, 587, 659, 784, 880, 1047, 1175, 1319];
  let last = 3;
  const timer = setInterval(() => {
    if (Math.random() < 0.25) return;
    last = Math.max(0, Math.min(scale.length - 1, last + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? 1 : 2)));
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
    o.type = "triangle"; o.frequency.value = scale[last];
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 1);
  }, 520);
  music = { timer, pad: { stop: () => { pad.stop(); pad2.stop(); } } };
  toast("Music on (M to stop)", "info");
}

// ------------------------------------------------------------------ login screen
function setupLogin() {
  $("#name").value = prefs.name;
  const picks = Array.from(document.querySelectorAll(".pick"));
  picks.forEach((p) => {
    p.classList.toggle("selected", p.dataset.sprite === prefs.sprite);
    p.onclick = () => { prefs.sprite = p.dataset.sprite; picks.forEach((q) => q.classList.toggle("selected", q === p)); };
  });
  const hatBox = document.createElement("label"); hatBox.className = "hatpick";
  const hatIn = document.createElement("input"); hatIn.type = "checkbox"; hatIn.checked = prefs.hat !== "none";
  hatIn.onchange = () => { prefs.hat = hatIn.checked ? "cowboy" : "none"; };
  hatBox.appendChild(hatIn); hatBox.appendChild(document.createTextNode(" Cowboy hat"));
  $("#swatches").parentNode.insertBefore(hatBox, $("#swatches"));
  const sw = $("#swatches");
  ["red", "blue", "yellow", "pink", "green", "cyan", "orange", "white", "magenta"].forEach((c) => {
    const d = document.createElement("div");
    d.className = "swatch" + (c === prefs.color ? " selected" : ""); d.style.background = COLORS[c]; d.title = c;
    d.onclick = () => { prefs.color = c; Array.from(sw.children).forEach((e) => e.classList.toggle("selected", e === d)); };
    sw.appendChild(d);
  });
  let f = 0;
  const dirs = ["down", "right", "up", "left"];
  setInterval(() => {
    f++;
    picks.forEach((p) => {
      const c = p.querySelector("canvas"), g = c.getContext("2d");
      g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = "#5aae45"; g.fillRect(0, 80, 64, 16);
      g.drawImage(charSprite(p.dataset.sprite, dirs[Math.floor(f / 16) % 4], f % 8, COLORS[prefs.color], prefs.hat), 0, 0, 64, 96);
    });
  }, 90);
  $("#play").onclick = start;
  $("#name").onkeydown = (e) => { if (e.key === "Enter") start(); };
}
function start() {
  if (ws && ws.readyState <= 1) return;   // already connecting or connected (double click / Enter)
  const name = $("#name").value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 12);
  if (!name) { $("#name").focus(); $("#name").style.borderColor = "#e0524f"; return; }
  prefs.name = name;
  localStorage.setItem("cozy.name", name); localStorage.setItem("cozy.sprite", prefs.sprite); localStorage.setItem("cozy.color", prefs.color); localStorage.setItem("cozy.hat", prefs.hat);
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
  connect();
}

// ------------------------------------------------------------------ network
let reconnectTries = 0, kicked = false;
function connect() {
  kicked = false;
  ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws");
  ws.onopen = () => { reconnectTries = 0; send({ t: "hello", name: prefs.name, sprite: prefs.sprite, color: prefs.color, hat: prefs.hat }); };
  ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } handle(m); };
  ws.onclose = () => {
    if (mode === "login") return;
    my.ready = false; my.queued = null; held.clear();   // stop predicting steps that nobody will receive
    if (kicked) { toast("You connected from another window. Reload here to take over again.", "warn"); return; }
    // the server restarts now and then (updates); come back on our own instead of asking for a reload
    if (reconnectTries < 60) { reconnectTries++; toast("Lost the farm for a moment. Reconnecting\u2026", "warn"); setTimeout(() => { cam.snap = true; connect(); }, 3000); }
    else toast("Lost the connection to the farm. Reload to come back.", "warn");
  };
  ws.onerror = () => { if (reconnectTries === 0) toast("Could not reach the farm server.", "warn"); };
}
function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
function handle(m) {
  if (m.t === "welcome") {
    if (window.__build && m.build && m.build !== window.__build) { location.reload(); return; }   // the farm was updated: fetch the new game
    window.__build = m.build;
    farmName = m.farm; map = m.map; catalog = m.catalog; buildings = findBuildings(map);
    portals = new Set((catalog.portals || []).map(([l, x, y]) => l + "," + x + "," + y));
    noChest = new Set((catalog.no_chest || []).map(([x, y]) => x + "," + y));
    logLines = m.log.slice(-6).map((e) => ({ text: stamp(e.ts) + " " + e.text, style: "log", at: Date.now() }));
    $("#login").classList.add("hidden"); $("#game").classList.remove("hidden");
    fishing = null; if (menu) closeMenu(); if (mode === "chat") closeChat(); my.queued = null;   // a reconnect must not leave a menu, chat box or fish UI stranded
    mode = "play"; renderLog();
    try { document.activeElement && document.activeElement.blur(); canvas.focus(); } catch (e) {}
    toast("Welcome to " + farmName + ", " + m.name + "! H for help, M for music.", "good");
  } else if (m.t === "state") {
    state = m; me = m.me; farmName = m.farm || farmName;
    tiles = {};
    for (const k in m.tiles) tiles[k] = m.tiles[k];
    const now = performance.now();
    for (const p of m.players) {
      if (p.name === prefs.name) { reconcile(p, now); continue; }
      const v = viz[p.name] || (viz[p.name] = { x: p.x, y: p.y, tx: p.x, ty: p.y, dist: 0, facing: "down", moving: false, loc: p.loc });
      if (v.loc !== (p.loc || "farm")) { v.loc = p.loc || "farm"; v.x = v.tx = p.x; v.y = v.ty = p.y; }
      if (v.tx !== p.x || v.ty !== p.y) { v.tx = p.x; v.ty = p.y; }
      v.facing = facingName(p.facing);
    }
    for (const cw of m.cows || []) {
      const v = cowViz[cw.id] || (cowViz[cw.id] = { x: cw.x, y: cw.y, tx: cw.x, ty: cw.y, f: cw.f });
      v.tx = cw.x; v.ty = cw.y; v.f = cw.f;
    }
    updateHud();
    if (menu && !(menu.dragging && performance.now() - menu.dragging < 8000)) {   // redraw only when what the window shows changed, never mid-drag
      const sig = menuSig(menu.kind);
      if (sig != null && sig !== menu.sig) renderMenu();
    }
  } else if (m.t === "msg") {
    addLog(m.text, m.style || "info");
    if (!/^~ .* ~$/.test(m.text)) toast(m.text, m.style || "info");   // arriving somewhere gets the name card on the map instead
    const tx = m.text;
    if (m.style === "ping") sfx("ping");
    else if (/^Harvested|^Picked|^Found|^Caught/.test(tx)) sfx("harvest");
    else if (/^Sold|^Bought|shipped|earned/.test(tx)) sfx("coin");
    else if (/^Watered|^Refilled/.test(tx)) sfx("water");
    else if (/^Planted|^Tilled/.test(tx)) sfx("pop");
    else if (/got away|Not enough|empty/.test(tx)) sfx("fail");
  } else if (m.t === "chat") {
    addLog(m.sender + ": " + m.text, "chat");
    if (m.sender !== prefs.name) toast(m.sender + ": " + m.text, "chat");
  } else if (m.t === "swing") {
    if (m.tool === "plant") return;   // planting is animated by the fx message now
    const cur = swings[m.who];
    if (m.who !== prefs.name || !cur) swings[m.who] = { tool: m.tool, start: performance.now(), x: m.x, y: m.y, item: m.item };
    else { cur.x = m.x; cur.y = m.y; if (m.item) cur.item = m.item; }
  } else if (m.t === "fx") {
    if (!my.ready || curLoc() !== "farm") return;   // only the farm renderer draws (and advances) these
    const from = carrierPos(m.who) || { x: m.x, y: m.y };
    fxs.push({ kind: m.kind, who: m.who, item: m.item, x: m.x, y: m.y, from, start: performance.now(), dur: m.kind === "drop" ? 400 : 360, landed: 0 });
    if (fxs.length > 24) fxs.splice(0, fxs.length - 24);
  } else if (m.t === "open") { if (m.menu === "close") { if (menu && menu.kind === "proposal") closeMenu(); } else openMenu(m.menu, m); }
  else if (m.t === "fish_bite") startFishing(m);
  else if (m.t === "error") { if (/another window/.test(m.text)) kicked = true; toast(m.text, "warn"); addLog(m.text, "warn"); }
}
function reconcile(p, now) {
  if (!my.ready) { my.ready = true; my.loc = p.loc || "farm"; my.x = my.tx = p.x; my.y = my.ty = p.y; my.dir = facingName(p.facing); cam.x = p.x + 0.5; cam.y = p.y + 0.5; cam.snap = true; return; }
  if ((p.loc || "farm") !== my.loc) {
    const from = my.loc; my.loc = p.loc || "farm"; my.x = my.tx = p.x; my.y = my.ty = p.y; my.stepping = false; my.dir = facingName(p.facing); cam.snap = true; held.clear();
    if (isOutdoor(my.loc) && isOutdoor(from) && catalog.area_names) areaBanner = { text: catalog.area_names[my.loc].replace(/^the /, "The "), at: performance.now() };
    return;
  }
  const stale = now - my.lastSend < 350;          // our latest step may not be in this snapshot yet
  if ((p.x !== my.tx || p.y !== my.ty) && !stale) { my.x = my.tx = p.x; my.y = my.ty = p.y; my.stepping = false; }
  if (!held.size && !my.stepping) my.dir = facingName(p.facing);
}
function facingName(f) { if (f[1] > 0) return "down"; if (f[1] < 0) return "up"; return f[0] < 0 ? "left" : "right"; }
function stamp(ts) { const d = new Date(ts * 1000); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
function findBuildings(rows) {
  const seen = new Set(), out = [];
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x];
    if (!"WS+N".includes(ch) || seen.has(x + "," + y)) continue;
    const kind = ch === "S" ? "S" : (ch === "N" ? "N" : "W");
    const same = (c) => c === kind || (kind === "W" && c === "+");
    let x1 = x; while (x1 + 1 < rows[y].length && same(rows[y][x1 + 1])) x1++;
    let y1 = y; while (y1 + 1 < rows.length && same(rows[y1 + 1][x])) y1++;
    for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) seen.add(xx + "," + yy);
    out.push({ kind, x0: x, y0: y, x1, y1, label: kind === "S" ? "SEED SHOP" : (kind === "N" ? "BARN" : "FARMHOUSE") });
  }
  return out;
}
function buildingAt(x, y) { for (const b of buildings) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return b; return null; }
function walkable(x, y) {
  const rows = curMap(), loc = curLoc();
  if (y < 0 || y >= rows.length || x < 0 || x >= rows[0].length) return false;
  if (isArea(loc)) { const t = areaTiles(loc)[x + "," + y]; return AREA_WALK.includes(rows[y][x]) && !(t && t.o); }
  if (loc !== "farm") { const ch = rows[y][x]; return ch === "." || ch === "r" || ch === "x"; }
  if (!".:,fGd".includes(rows[y][x])) return false;
  if (state && state.cows && state.cows.some((cw) => cw.x === x && cw.y === y)) return false;
  if (chestAt(x, y)) return false;
  const d = tiles[x + "," + y];
  return !(d && d.t);
}

// ------------------------------------------------------------------ HUD
function myPlayer() { return state ? state.players.find((p) => p.name === prefs.name) : null; }
function chestAt(x, y) { return !!(state && state.chests && state.chests.some((c) => c.x === x && c.y === y)); }
function carrierPos(name) { if (name === prefs.name) return my.ready ? { x: my.x, y: my.y } : null; const v = viz[name]; return v ? { x: v.x, y: v.y } : null; }
// fx timelines run on the clock alone, so they end (and get pruned) whichever renderer is running
function fxEnd(f) { return f.dur + (f.kind === "drop" ? 300 : f.item === "chest" ? 0 : 220); }
function pruneFx(now) { for (let i = fxs.length - 1; i >= 0; i--) if (now - fxs[i].start >= fxEnd(fxs[i])) fxs.splice(i, 1); }
function inFlight(x, y, now) { return fxs.some((f) => f.kind === "drop" && f.x === x && f.y === y && now - f.start < f.dur + 150); }
function fxBusy(kind, who, now, item) { return fxs.some((f) => f.kind === kind && f.who === who && (!item || f.item === item) && now - f.start < f.dur); }
function chestLifting(x, y, now) { return fxs.some((f) => f.kind === "lift" && f.item === "chest" && f.x === x && f.y === y && now - f.start < f.dur); }
function chestOk(x, y) {
  /* mirrors World.chest_ok: bare ground or path off the NO_CHEST tiles, nothing growing or placed there,
     no cow, chest or farmer on it (any farmer outdoors, online or not) */
  const d = tiles[x + "," + y] || {};
  return ".:,d".includes((map[y] || "")[x] || "#") && !noChest.has(x + "," + y) && !(d.s || d.c || d.t || d.g || d.k)
    && !(state.cows || []).some((cw) => cw.x === x && cw.y === y) && !chestAt(x, y)
    && !state.players.some((q) => q.x === x && q.y === y && (q.loc || "farm") === "farm");
}
function countItem(key) { if (!me) return 0; for (const [k, n] of me.inventory) if (k === key) return n; return 0; }
function fmt(sec) {
  sec = Math.max(0, Math.floor(sec));
  if (sec < 60) return sec + "s"; if (sec < 3600) return Math.floor(sec / 60) + "m";
  if (sec < 86400) { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return m ? h + "h" + ("0" + m).slice(-2) + "m" : h + "h"; }
  return Math.floor(sec / 86400) + "d" + Math.floor((sec % 86400) / 3600) + "h";
}
function hourNow() { if (window.cozy && window.cozy.forceHour != null) return window.cozy.forceHour; return state ? state.sky : 12; }
function isNight() { const h = hourNow(); return h >= 20.5 || h < 5.5; }
const SKY_KEYS = [[0, [18, 24, 96, .6]], [4.5, [18, 24, 96, .6]], [5.5, [90, 60, 130, .45]], [6.3, [255, 140, 90, .32]], [7.3, [255, 205, 140, .14]], [8.5, [0, 0, 0, 0]],
  [16.5, [0, 0, 0, 0]], [17.3, [255, 170, 80, .16]], [18.2, [255, 120, 60, .3]], [19.2, [150, 60, 110, .4]], [20.3, [40, 30, 110, .55]], [21, [18, 24, 96, .6]], [24, [18, 24, 96, .6]]];
function skyTint(h) {
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    const [h0, c0] = SKY_KEYS[i], [h1, c1] = SKY_KEYS[i + 1];
    if (h >= h0 && h <= h1) { const u = (h1 === h0) ? 0 : (h - h0) / (h1 - h0); return c0.map((v, k) => v + (c1[k] - v) * u); }
  }
  return [0, 0, 0, 0];
}
function nightAlpha() { const h = hourNow(); if (window.cozy && window.cozy.forceNight != null) return window.cozy.forceNight; if (h >= 7.5 && h < 17.3) return 0; const a = skyTint(h)[3]; return Math.max(0, Math.min(0.62, (a - 0.12) * 1.25)); }
function skyLabel(h) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ampm = hh >= 12 ? "pm" : "am", h12 = ((hh + 11) % 12) + 1;
  const phase = h < 5.5 ? "night" : h < 7.5 ? "sunrise" : h < 17 ? "day" : h < 19.5 ? "sunset" : h < 20.5 ? "dusk" : "night";
  const icon = { night: "\u263e", sunrise: "\u2600", day: "\u2600", sunset: "\u2600", dusk: "\u263e" }[phase];
  return icon + " " + h12 + ":" + ("0" + mm).slice(-2) + ampm + " " + phase;
}
function updateHud() {
  if (!state) return;
  const st = state;
  $("#farm-name").textContent = farmName;
  $("#season").textContent = st.season[0].toUpperCase() + st.season.slice(1) + ", day " + st.day + " (year " + st.year + ")";
  $("#clock").textContent = skyLabel(hourNow());
  $("#weather").textContent = { sun: "Sunny", rain: "Raining", snow: "Snowing" }[st.weather];
  $("#coins").textContent = st.coins + "g";
  $("#online").textContent = st.players.filter((p) => p.online).length + " online";
  if (me) {   // the little green farming xp bar under the tool bar
    const lo = 60 * me.level * me.level, hi = me.next_xp;
    const max = me.level >= (catalog.titles ? catalog.titles.length - 1 : Infinity) || hi == null || hi <= lo || me.xp >= hi;   // top title: nothing left to fill
    const pct = max ? 1 : Math.max(0, Math.min(1, (me.xp - lo) / (hi - lo)));
    const bar = $("#xpbar");
    bar.querySelector(".fill").style.width = (pct * 100).toFixed(1) + "%";
    bar.querySelector(".label").textContent = "Lv" + me.level + " " + me.title + " · " + (max ? "MAX" : Math.max(0, me.xp - lo) + " / " + (hi - lo) + " xp");
    if (lastXp != null && me.xp > lastXp) { bar.classList.add("gain"); setTimeout(() => bar.classList.remove("gain"), 700); }
    lastXp = me.xp;
  }
  const ul = $("#farmers ul"); ul.innerHTML = "";
  st.players.filter((p) => p.online).sort((a, b) => a.name.localeCompare(b.name)).forEach((p) => {
    const li = document.createElement("li");
    const c = blank(32, 48);
    c.getContext("2d").drawImage(charSprite(p.sprite || "boy", "down", 0, COLORS[catalog.player_colors[p.color % catalog.player_colors.length]], p.hat), 0, 0);
    li.appendChild(c);
    const span = document.createElement("span");
    span.textContent = p.name + (p.name === prefs.name ? " (you)" : "") + " · Lv" + p.level + " " + p.title + (p.spouse ? " \u2665 " + p.spouse : "");
    li.appendChild(span); ul.appendChild(li);
  });
  const slots = $("#toolbar .slots"), inv = me ? me.inventory : [], sig = JSON.stringify([inv, me && me.selected]);
  if (sig !== slotSig) {   // rebuild only on change: a slot replaced between mousedown and mouseup never gets its click
    slotSig = sig; slots.innerHTML = "";
    const shown = 12, first = me && me.selected >= shown ? me.selected - shown + 1 : 0;
    for (let j = 0; j < shown; j++) {
      const i = first + j;
      const d = document.createElement("div"); d.className = "slot" + (me && i === me.selected ? " selected" : "");
      const key = document.createElement("span"); key.className = "key"; key.textContent = i < 9 ? String(i + 1) : ""; d.appendChild(key);
      if (i < inv.length) {
        const [k, n] = inv[i]; const it = catalog.items[k];
        const c = blank(32, 32); c.getContext("2d").drawImage(itemIcon(k, catalog), 0, 0); d.appendChild(c);
        if (n > 1 || !TOOLS.has(k)) { const num = document.createElement("span"); num.className = "n"; num.textContent = n; d.appendChild(num); }
        d.title = (it ? it.name : k) + (it && it.verb ? " - " + it.verb : "");
        d.onclick = () => send({ t: "select", i });
      }
      slots.appendChild(d);
    }
  }
  if (me) $("#can-top").textContent = "Can " + me.water + "/" + catalog.can + " · Lv" + me.level;
  const q = st.quest;
  $("#quest p").textContent = q ? q.who + " needs " + q.n + " " + catalog.items[q.item].name + " for " + q.reason + ". Reward " + q.reward + "g. (you have " + countItem(q.item) + ")" : "Nothing on the board right now.";
  $("#here").textContent = describeHere();
}
function addLog(text, style) { logLines.push({ text: new Date().toTimeString().slice(0, 5) + " " + text, style, at: Date.now() }); if (logLines.length > 80) logLines.shift(); renderLog(); }
setInterval(() => { const cut = Date.now() - 30000; const before = logLines.length; logLines = logLines.filter((l) => !l.at || l.at > cut); if (logLines.length !== before) renderLog(); }, 1000);
function renderLog() {
  const ul = $("#log ul"); ul.innerHTML = "";
  logLines.forEach((l) => { const li = document.createElement("li"); li.className = l.style; li.textContent = l.text; ul.appendChild(li); });
  ul.scrollTop = ul.scrollHeight;
}
function toast(text, style) {
  const t = $("#toast"); t.textContent = text; t.className = style || ""; t.classList.remove("hidden");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add("hidden"), style === "good" || style === "ping" ? 5000 : 3500);
}
function describeArea(p) {
  /* the "Here / Ahead" line out in the valley */
  const loc = p.loc, rows = catalog.areas[loc], at = areaTiles(loc), sel = heldItem();
  const name = (c) => ((catalog.area_terrain || {})[c] || catalog.terrain_names[c] || "").replace(/^./, (m) => m.toUpperCase());
  const here = catalog.area_names[loc].replace(/^the /, "The ") + " - " + name(rows[p.y][p.x]);
  const fx = p.x + p.facing[0], fy = p.y + p.facing[1], ft = (rows[fy] || "")[fx] || "#", fd = at[fx + "," + fy] || {}, hd = at[p.x + "," + p.y] || {};
  let ahead = "";
  const portal = portals.has(loc + "," + fx + "," + fy);
  if (fd.g || hd.g) ahead = catalog.items[fd.g || hd.g].name + " - E to pick.";
  else if (fd.o) ahead = (fd.o === "stone" ? "A rock" : "Rock with " + catalog.items[fd.o].name) + (sel === "pickaxe" ? " - E to break it." : " - hold the pickaxe (5) and press E.");
  else if (portal && ft === "@") { const b = areaBuildings(loc).find((q) => fx >= q.x0 && fx <= q.x1 && fy >= q.y0 && fy <= q.y1); ahead = (b && b.label ? b.label.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase()) : "A door") + " - walk in."; }
  else if (ft === "U" || ft === "D") ahead = "Ladder " + (ft === "U" ? "up" : "down") + " - walk onto it.";
  else if (portal) ahead = "The path goes on - keep walking.";
  else if (ft === "~") ahead = "Water - E refills the can, F fishes.";
  else if (ft === "V") ahead = loc === "beach" ? "The boat to Palm Isle - E to sail." : "The boat home - E to sail back.";
  else if (ft === "Q") ahead = loc === "town" ? "Stagecoach to Dusty Gulch - E to ride." : "Stagecoach to Hollow Town - E to ride.";
  else if (ft === "!") ahead = "Notice board - E to read the request.";
  else if (ft === "w" || ft === "I") ahead = name(ft) + " - E refills the can.";
  else if (ft === "@") ahead = "A building. The door is at the front.";
  else if ("FELJOgbBchlmKCTPAs".includes(ft)) ahead = name(ft) + " - E to have a look.";
  return "Here: " + here + (ahead ? "     Ahead: " + ahead : "");
}
function heldItem() { if (!me || !me.inventory.length) return null; return me.inventory[Math.min(me.selected, me.inventory.length - 1)][0]; }
function describeHere() {
  const p = myPlayer(); if (!p || !catalog) return "";
  if (isArea(p.loc || "farm")) return describeArea(p);
  if ((p.loc || "farm") !== "farm") {
    const rows = catalog.interiors[p.loc], fx = p.x + p.facing[0], fy = p.y + p.facing[1], ch = (rows[fy] || "")[fx] || "#";
    const keeper = (catalog.keepers || {})[p.loc];
    if (keeper) {
      const what = ch === "n" || ch === "S" ? keeper + " - E to talk" + (p.loc === "store" ? " and shop." : ".") : ch === "x" ? "The door - walk onto it to go outside." : (catalog.interior_names[ch] || "").replace(/^./, (c) => c.toUpperCase());
      return "Inside: " + keeper + "'s place. Ahead: " + what;
    }
    const nm = catalog.interior_names[ch] || "";
    const hint = { c: " - E opens the shared chest.", S: " - E to shop.", q: " - E to shop.", k: " - E for the journal.", x: " - walk onto it to go outside." }[ch] || "";
    return "Inside the " + p.loc + ". Ahead: " + nm.replace(/^./, (c) => c.toUpperCase()) + hint;
  }
  const d = tiles[p.x + "," + p.y] || {}, terr = map[p.y][p.x];
  const sel = heldItem(), kind = sel ? catalog.items[sel].kind : null;
  let here;
  if (d.c) { const [ck, stage, ripe, pct, eta] = d.c; const c = catalog.crops[ck];
    here = ripe ? c.name + " is RIPE! E to harvest." : c.name + " " + pct + "%, ready in ~" + fmt(eta) + (d.w ? " (wet, growing fast)" : ". Water it with the can (2)."); }
  else if (d.t) here = catalog.trees[d.t[0]].name + " tree " + d.t[3] + "%";
  else if (d.g) here = catalog.items[d.g].name + " - press E to pick.";
  else if (d.k) here = "Sprinkler (waters the 8 tiles around it). X picks it up.";
  else if (d.s) { const wet = d.w ? " (wet)" : "";
    if (kind === "seed" || kind === "sapling") here = "Tilled soil" + wet + " - E plants " + catalog.items[sel].name + ".";
    else if (sel === "watering_can") here = d.w ? "Tilled soil (wet) - already watered." : "Tilled soil - E to water.";
    else here = "Tilled soil" + wet + " - hold seeds to plant, or the can to water."; }
  else if (terr === "d") here = sel === "hoe" ? "Farmland - E to till." : "Farmland - hold the hoe (1) and press E to till.";
  else if (terr === ".") here = "Grass. Farming happens on the sandy farmland.";
  else here = (catalog.terrain_names[terr] || "").replace(/^./, (c) => c.toUpperCase());
  const fx = p.x + p.facing[0], fy = p.y + p.facing[1];
  const ft = (map[fy] || "")[fx] || "#", fd = tiles[fx + "," + fy] || {};
  let ahead = "";
  if (ft === "S") ahead = "Shop - E to browse seeds."; else if (ft === "$") ahead = "Shipping bin - E to sell.";
  else if (ft === "!") ahead = "Notice board - E to read the request."; else if (ft === "+") ahead = "Farmhouse - E for the farm journal.";
  else if (ft === "~") ahead = "Pond - E refills the can, F goes fishing."; else if (ft === "w") ahead = "Well - E refills the can.";
  else if (ft === "m") ahead = "Mailbox - E to read your letters."; else if (ft === "N") ahead = "Barn - E to open the shared storage.";
  else if (chestAt(fx, fy)) ahead = "Storage chest - E to open it, X to pick it up. Everyone on the farm shares what is inside.";
  else if (ft === "Y") ahead = "Father TongTong - E to say hello.";
  else if (state.cows && state.cows.some((cw) => cw.x === fx && cw.y === fy)) { const cw = state.cows.find((c) => c.x === fx && c.y === fy); ahead = cw.name + " the cow - " + (cw.milk ? "E to milk her!" : "milk " + cw.pct + "% ready."); }
  else if ("Bchblspg".includes(ft)) ahead = catalog.terrain_names[ft].replace(/^./, (c) => c.toUpperCase()) + " - E to have a look.";
  else if (fd.t) { const [tk, stage, fruit, pct, eta] = fd.t, tr = catalog.trees[tk];
    if (tr.rare) ahead = stage < 2 ? "Legendary " + tr.name + " seedling " + pct + "%, grown in ~" + fmt(eta) + "." : "A legendary " + tr.name + ". Everyone stops to admire it.";
    else ahead = stage < 2 ? tr.name + " sapling " + pct + "%, mature in ~" + fmt(eta) + "." : fruit ? tr.name + " tree with " + fruit + " fruit - E to pick!" : tr.name + " tree - next fruit in ~" + fmt(eta) + "."; }
  else if (fd.g) ahead = catalog.items[fd.g].name + " - E to pick.";
  if (p.carry === "chest") return "Carrying the chest.     Ahead: " + (noChest.has(fx + "," + fy) ? "not there - folks need that spot clear to get by."
    : chestOk(fx, fy) ? "E sets it down here." : "no room to set it down - find clear ground.");   // the same checks, in the same order, as act_place
  return "Here: " + here + (ahead ? "     Ahead: " + ahead : "");
}

// ------------------------------------------------------------------ menus
function openMenu(kind, data) {
  const same = menu && menu.kind === kind;
  // the server re-sends the window after every deposit or withdrawal: refresh it in place, keeping the chosen quantity and scroll
  if (same) menu.data = data || {}; else menu = { kind, data: data || {}, qty: 1, cursor: 0 };
  mode = "menu"; held.clear(); $("#menu").classList.remove("hidden"); renderMenu(!same);
}
function menuSig(k) {
  /* what a window shows from the live state; a state update redraws it only when this changes (null: nothing live) */
  const inv = me ? me.inventory : [];
  if (k === "shop") return String(state.coins);
  if (k === "sell") return JSON.stringify([state.coins, inv]);
  if (k === "board") return JSON.stringify([state.quest, inv]);
  if (k === "bag") return JSON.stringify([inv, me && me.selected]);
  if (k === "barn") { const mp = myPlayer(); return JSON.stringify([state.storage, inv, !!(mp && (mp.loc || "farm") === "farm" && chestAt(mp.x + mp.facing[0], mp.y + mp.facing[1]))]); }
  return null;
}
function closeMenu() { menu = null; if (mode === "menu") mode = "play"; $("#menu").classList.add("hidden"); canvas.focus(); }
function iconEl(key) { const c = document.createElement("canvas"); c.width = 32; c.height = 32; const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(itemIcon(key, catalog), 0, 0); return c; }
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function blurb(key) {
  const it = catalog.items[key];
  if (it.kind === "seed") { const c = catalog.crops[it.crop]; return "Grows in " + fmt(c.grow) + " (" + fmt(c.grow / catalog.water_mult) + " watered), sells " + c.sell + "g" + (c.regrow ? ", regrows every " + fmt(c.regrow) : "") + ". Seasons: " + c.seasons.join(", ") + "."; }
  if (it.kind === "sapling") { const t = catalog.trees[it.tree];
    if (t.rare) return "A legendary seed - one crop in a million drops one. Grows into a " + t.name + " in " + fmt(t.mature) + ". Plant on tilled soil, leave a gap.";
    return "Matures in " + fmt(t.mature) + ", then a " + t.name + " (" + t.fruit_sell + "g) every " + fmt(t.fruit_every) + ". Plant on tilled soil, leave a gap."; }
  if (key === "fertilizer") return "Use on tilled soil: +50% growth until the crop is harvested.";
  if (key === "sprinkler") return "Place on a tile: keeps the 8 tiles around it watered forever.";
  if (key === "cow") return "A cow for the pasture by the barn. Gives milk (45g) every 4 hours. Up to " + catalog.max_cows + " cows.";
  return "Sells for " + it.sell + "g.";
}
function itemRow(key, right, onclick, extra) {
  const row = el("div", "item"); row.appendChild(iconEl(key));
  row.appendChild(el("span", "name", catalog.items[key].name + (extra || "")));
  if (right) row.appendChild(right);
  if (onclick) row.onclick = onclick;
  return row;
}
function renderMenu(fresh) {
  if (!menu) return;
  const box = $("#menu"), h2 = box.querySelector("h2"), body = box.querySelector(".body"), foot = box.querySelector(".foot");
  const bank0 = body.querySelector(".rs-bank"), keep = fresh ? 0 : body.scrollTop, keepBank = fresh || !bank0 ? 0 : bank0.scrollTop;
  box.querySelector(".box").classList.toggle("rs", menu.kind === "barn");   // the chest window wears the old-school bank look
  body.innerHTML = ""; foot.textContent = "Esc closes";
  const k = menu.kind, d = menu.data;
  if (k === "shop") {
    h2.textContent = "Seed Shop  (" + d.season + " stock)  ·  " + state.coins + "g shared";
    d.stock.forEach(([key, price], i) => {
      const row = itemRow(key, el("span", "price", price + "g"), () => { menu.cursor = i; renderMenu(); });
      if (i === menu.cursor) {
        row.classList.add("selected");
        if (key === "cow") menu.qty = 1;
        const q = el("div", "qty");
        const minus = el("button", "small", "-"); minus.onclick = (e) => { e.stopPropagation(); menu.qty = Math.max(1, menu.qty - 1); renderMenu(); };
        const plus = el("button", "small", "+"); plus.onclick = (e) => { e.stopPropagation(); menu.qty = Math.min(99, menu.qty + 1); renderMenu(); };
        const buy = el("button", "small", "Buy " + menu.qty + " for " + price * menu.qty + "g");
        buy.disabled = price * menu.qty > state.coins; buy.onclick = (e) => { e.stopPropagation(); send({ t: "buy", item: key, n: menu.qty }); };
        q.appendChild(minus); q.appendChild(el("span", null, "x" + menu.qty)); q.appendChild(plus); q.appendChild(buy);
        row.appendChild(q); row.appendChild(el("div", "blurb", blurb(key))); row.style.flexWrap = "wrap";
      }
      body.appendChild(row);
    });
    foot.textContent = "Click an item, choose an amount, Buy. Esc closes.";
  } else if (k === "sell") {
    const items = (me ? me.inventory : []).filter(([key]) => catalog.items[key].sell > 0);
    let total = 0; items.forEach(([key, n]) => total += n * catalog.items[key].sell);
    h2.textContent = "Shipping Bin  ·  " + state.coins + "g shared";
    if (!items.length) body.appendChild(el("p", null, "Nothing to sell yet. Grow, forage or fish something first!"));
    items.forEach(([key, n]) => {
      const right = el("span", "qty");
      const one = el("button", "small", "Sell 1 (" + catalog.items[key].sell + "g)"); one.onclick = () => send({ t: "sell", item: key, n: 1 });
      const all = el("button", "small", "Sell " + n + " (" + n * catalog.items[key].sell + "g)"); all.onclick = () => send({ t: "sell", item: key, n });
      right.appendChild(one); if (n > 1) right.appendChild(all);
      body.appendChild(itemRow(key, right, null, "  x" + n));
    });
    if (items.length) { const b = el("button", null, "Ship everything for " + total + "g"); b.onclick = () => send({ t: "sell_all" }); body.appendChild(b); }
  } else if (k === "board") {
    const q = d.quest || state.quest;
    h2.textContent = "Notice Board";
    if (!q) body.appendChild(el("p", null, "The board is empty. Check back later."));
    else {
      const it = catalog.items[q.item];
      body.appendChild(el("p", null, "“" + q.who + " needs " + q.n + " " + it.name + " for " + q.reason + ". Can anyone help? Reward: " + q.reward + "g.”"));
      const have = countItem(q.item);
      body.appendChild(el("p", null, "You carry " + have + "/" + q.n + " " + it.name + "."));
      const b = el("button", null, "Deliver"); b.disabled = have < q.n; b.onclick = () => send({ t: "deliver" }); body.appendChild(b);
    }
  } else if (k === "journal") {
    h2.textContent = "Farm Journal - " + d.farm;
    body.appendChild(el("p", null, "Founded " + fmt(Date.now() / 1000 - d.created) + " ago. " + d.milestones.length + " milestones of " + d.all_milestones.length + "."));
    const grid = el("div", "stats");
    [["planted", "planted"], ["harvested", "harvested"], ["watered", "waterings"], ["fish", "fish caught"], ["foraged", "foraged"], ["fruit", "fruit picked"], ["trees", "trees planted"], ["quests", "requests filled"], ["earned", "coins earned"]].forEach(([key, label]) => {
      const cell = el("div"); cell.appendChild(el("b", null, String(d.stats[key] || 0))); cell.appendChild(document.createTextNode(label)); grid.appendChild(cell);
    });
    body.appendChild(grid);
    body.appendChild(el("h3", null, "Farmers"));
    d.players.forEach((p) => body.appendChild(el("p", null, p.name + " · Lv" + p.level + " " + p.title + " · harvested " + (p.stats.harvested || 0) + ", fished " + (p.stats.fish || 0) + (p.online ? " · online" : ""))));
    body.appendChild(el("h3", null, "Milestones"));
    const ms = el("div", "milestones");
    d.all_milestones.forEach((m) => ms.appendChild(el("div", d.milestones.includes(m) ? "got" : "todo", (d.milestones.includes(m) ? "★ " : "☆ ") + m)));
    body.appendChild(ms);
  } else if (k === "proposal") {
    h2.textContent = "Father TongTong";
    body.appendChild(el("p", null, "\u201cWell now. Shall I marry you and " + d.partner + "?\u201d"));
    const row = el("div", "row");
    const yes = el("button", null, "Yes!"); yes.onclick = () => { send({ t: "propose_answer", yes: true }); body.innerHTML = ""; body.appendChild(el("p", null, "You said yes. Waiting for " + d.partner + "...")); };
    const no = el("button", null, "Not today"); no.style.background = "#8a7a6a"; no.onclick = () => { send({ t: "propose_answer", yes: false }); closeMenu(); };
    row.appendChild(yes); row.appendChild(no); body.appendChild(row);
    foot.textContent = "An easter egg: a boy and a girl farmer standing side by side next to the priest.";
  } else if (k === "barn") {
    // an old-school bank: dark stone panel, bare icons with yellow counts, a Quantity row, the inventory down the right
    const stored = Object.entries((state && state.storage) || d.storage || {}).sort();   // live: other farmers' changes show up too
    const bag = (me ? me.inventory : []).filter(([key]) => !TOOLS.has(key));
    const total = stored.reduce((a, [, n]) => a + n, 0);
    h2.innerHTML = ""; h2.appendChild(el("span", "rs-t", "Storage Chest")); h2.appendChild(el("span", "rs-sub", " \u00b7 " + total + " item" + (total === 1 ? "" : "s") + " shared"));
    if (menu.qty == null || menu.qty === 0) menu.qty = 1;
    const qtyOf = (n) => menu.qty === "all" ? n : Math.min(n, menu.qty);
    const makeItem = (side, key, n) => {
      const it = el("div", "rs-item"); it.title = catalog.items[key].name + " x" + n + "  (click moves " + (menu.qty === "all" ? "all" : menu.qty) + ", drag moves the stack)";
      it.appendChild(iconEl(key)); it.appendChild(el("span", "rs-n", String(n)));
      it.draggable = true;
      it.ondragstart = (e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ side, key, n })); e.dataTransfer.effectAllowed = "move"; it.classList.add("dragging"); menu.dragging = performance.now(); };
      it.ondragend = () => { it.classList.remove("dragging"); if (menu) menu.dragging = 0; };
      it.onclick = (e) => send({ t: side === "chest" ? "withdraw" : "store", item: key, n: e.shiftKey ? n : qtyOf(n) });
      return it;
    };
    const dropZone = (gd, side) => {
      gd.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; gd.classList.add("over"); };
      gd.ondragleave = () => gd.classList.remove("over");
      gd.ondrop = (e) => {
        e.preventDefault(); gd.classList.remove("over"); if (menu) menu.dragging = 0;
        let dt; try { dt = JSON.parse(e.dataTransfer.getData("text/plain")); } catch (err) { return; }
        if (!dt || dt.side === side) return;
        send({ t: side === "chest" ? "store" : "withdraw", item: dt.key, n: dt.n });
      };
    };
    const wrap = el("div", "rs-body");
    const bank = el("div", "rs-bank");
    stored.forEach(([key, n]) => bank.appendChild(makeItem("chest", key, n)));
    for (let i = stored.length; i < 40; i++) bank.appendChild(el("div", "rs-item rs-empty"));
    if (!stored.length) bank.appendChild(el("div", "rs-hint", "The chest is empty. Drag things here, or click them in your inventory."));
    dropZone(bank, "chest");
    const side = el("div", "rs-side");
    side.appendChild(el("div", "rs-h", "Inventory"));
    const inv = el("div", "rs-inv");
    bag.forEach(([key, n]) => inv.appendChild(makeItem("bag", key, n)));
    for (let i = bag.length; i < 28; i++) inv.appendChild(el("div", "rs-item rs-empty"));
    dropZone(inv, "bag");
    side.appendChild(inv);
    wrap.appendChild(bank); wrap.appendChild(side); body.appendChild(wrap);
    // the foot: quantity picker, deposit-all, pick up the chest
    foot.innerHTML = "";
    foot.appendChild(el("span", "rs-label", "Quantity:"));
    const custom = typeof menu.qty === "number" && ![1, 5, 10].includes(menu.qty);
    [["1", 1], ["5", 5], ["10", 10], ["X", "x"], ["All", "all"]].forEach(([label, q]) => {
      const on = q === menu.qty || (q === "x" && custom);
      const b = el("button", "rs-btn" + (on ? " sel" : ""), q === "x" && custom ? "X (" + menu.qty + ")" : label);
      b.onclick = () => { if (q === "x") { const v = parseInt(prompt("How many?", "20"), 10); if (v > 0) menu.qty = v; } else menu.qty = q; renderMenu(); };
      foot.appendChild(b);
    });
    const dep = el("button", "rs-btn rs-act", "Deposit all"); dep.disabled = !bag.length;
    dep.onclick = () => bag.forEach(([key, n]) => send({ t: "store", item: key, n })); foot.appendChild(dep);
    const mp = myPlayer();
    if (mp && (mp.loc || "farm") === "farm" && chestAt(mp.x + mp.facing[0], mp.y + mp.facing[1])) { const pick = el("button", "rs-btn rs-act", "Pick up chest"); pick.onclick = () => { send({ t: "pickup" }); closeMenu(); }; foot.appendChild(pick); }
    foot.appendChild(el("span", "rs-tip", "Click an item to move that many (shift-click: the whole stack). Drag between the chest and your inventory. Esc or \u00d7 closes."));
  } else if (k === "bag") {
    h2.textContent = "Your Bag";
    const inv = me ? me.inventory : [];
    if (!inv.length) body.appendChild(el("p", null, "Your bag is empty."));
    inv.forEach(([key, n], i) => {
      const row = itemRow(key, el("span", "price", "x" + n), () => { send({ t: "select", i }); closeMenu(); }, i === me.selected ? "  (in hand)" : "");
      row.appendChild(el("div", "blurb", blurb(key))); row.style.flexWrap = "wrap"; body.appendChild(row);
    });
    foot.textContent = "Click something to hold it. Esc closes.";
  } else if (k === "help") {
    h2.textContent = "How to farm";
    body.innerHTML = "<p><kbd>WASD</kbd> or arrows to walk. You act on the tile you stand on; the pond, shop, bin, board, well, mailbox and trees are used by facing them (they glow).</p>" +
      "<p><kbd>E</kbd> or <kbd>Space</kbd> does the natural thing: till grass, plant the seed in hand, water, harvest, pick forage, refill the can at the pond or well, open the shop / bin / board.</p>" +
      "<p><kbd>F</kbd> fishes when facing the pond: keep the fish inside your net with <kbd>&larr;</kbd> <kbd>&rarr;</kbd> or the mouse.</p>" +
      "<p><kbd>X</kbd> clears the tile you stand on, or picks up the storage chest you face (carry it and press <kbd>E</kbd> to set it down). <kbd>1</kbd>-<kbd>9</kbd> pick what you hold, <kbd>I</kbd> opens the bag, <kbd>J</kbd> the journal, <kbd>T</kbd> chats, <kbd>M</kbd> music, <kbd>+</kbd>/<kbd>-</kbd> zoom.</p>" +
      "<p>Explore the valley: walk off the farm's paths west to <b>Hollow Town</b> (shops, saloon, museum, folks to talk to), north to <b>Summit Ridge</b> and its <b>mine</b> (break ore and gems with the pickaxe, ladders go deeper), south to the <b>Whisperwood</b>. From town go south to <b>Driftwood Beach</b>, where a boat at the pier sails to <b>Palm Isle</b>; the stagecoach in town rides to <b>Dusty Gulch</b>. Fish in rivers, lakes and the sea, and forage what each place grows.</p>" +
      "<p>Crops grow in real time even when nobody is here. Wet soil grows 3x faster for 4 hours; rain waters everything; sprinklers keep their 8 neighbours wet. Coins are shared.</p>" +
      "<p>Chat commands: <code>/ping@all [msg]</code> says hi on every terminal of this account, <code>/look boy|girl</code>, <code>/color pink</code>, <code>/farm name</code>, <code>/give player item n</code>, <code>/me action</code>.</p>" +
      "<p>Friends can join from a browser at this address, or the host runs <code>python3 farm.py share</code> to invite other computers.</p>";
  } else if (k === "fish") renderFishing();
  body.scrollTop = keep; const bank = body.querySelector(".rs-bank"); if (bank) bank.scrollTop = keepBank;
  menu.sig = state ? menuSig(k) : null;
}

// ------------------------------------------------------------------ fishing
function startFishing(m) {
  fishing = { fish: m.fish, name: m.name, diff: m.difficulty, phase: "wait", until: performance.now() + m.wait * 1000,
    pos: Math.random(), vel: (0.25 + 0.12 * m.difficulty) * (Math.random() < 0.5 ? -1 : 1), zone: 0.4,
    zoneW: Math.max(0.16, Math.min(0.34, 0.2 + 0.02 * (m.level || 0))), progress: 0.4, start: 0 };
  openMenu("fish", {}); mode = "fish";
}
function renderFishing() {
  const box = $("#menu"), h2 = box.querySelector("h2"), body = box.querySelector(".body"), foot = box.querySelector(".foot");
  h2.textContent = "Fishing";
  body.innerHTML = '<div id="fish"><p class="status"></p><div class="water"><div class="zone"></div><div class="fishy">🐟</div></div><div class="progress"><div></div></div></div>';
  foot.textContent = "Esc reels in and gives up";
  body.querySelector(".water").onmousemove = (e) => { if (fishing && fishing.phase === "play") { const r = e.currentTarget.getBoundingClientRect(); fishing.zone = Math.max(0, Math.min(1 - fishing.zoneW, (e.clientX - r.left) / r.width - fishing.zoneW / 2)); } };
}
function endFishing(ok) { send({ t: "fish_result", ok }); fishing = null; closeMenu(); mode = "play"; }
function updateFishing(dt) {
  const f = fishing; if (!f) return;
  const root = $("#fish"); if (!root) return;
  const now = performance.now();
  if (f.phase === "wait") {
    root.querySelector(".status").textContent = "Waiting for a bite" + ".".repeat(1 + Math.floor(now / 500) % 3);
    root.querySelector(".fishy").style.display = "none";
    if (now >= f.until) { f.phase = "play"; f.start = now; sfx("pop"); }
    return;
  }
  root.querySelector(".fishy").style.display = "";
  root.querySelector(".status").textContent = "Something's on the line! Keep it inside the net.";
  if (Math.random() < (0.5 + 0.4 * f.diff) * dt) f.vel = (0.25 + 0.12 * f.diff) * (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.7);
  f.pos += f.vel * dt;
  if (f.pos < 0) { f.pos = 0; f.vel = Math.abs(f.vel); } if (f.pos > 1) { f.pos = 1; f.vel = -Math.abs(f.vel); }
  if (held.has("left")) f.zone = Math.max(0, f.zone - 0.9 * dt);
  if (held.has("right")) f.zone = Math.min(1 - f.zoneW, f.zone + 0.9 * dt);
  const inside = f.pos >= f.zone && f.pos <= f.zone + f.zoneW;
  f.progress += (inside ? 0.32 : -(0.10 + 0.05 * f.diff)) * dt;
  root.querySelector(".zone").style.left = (f.zone * 100) + "%"; root.querySelector(".zone").style.width = (f.zoneW * 100) + "%";
  root.querySelector(".fishy").style.left = (f.pos * 100) + "%";
  root.querySelector(".progress div").style.width = (Math.max(0, Math.min(1, f.progress)) * 100) + "%";
  if (f.progress >= 1 || now - f.start > 30000) endFishing(f.progress >= 1);
  else if (f.progress <= 0) endFishing(false);
}

// ------------------------------------------------------------------ input
const DIRS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };
const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
window.addEventListener("keydown", (e) => {
  if (mode === "login") return;
  if (mode === "chat") {
    if (e.key === "Escape") { closeChat(); e.preventDefault(); }
    else if (e.key === "Enter") { submitChat(); e.preventDefault(); }
    return;
  }
  if (mode === "fish") {
    if (e.key === "Escape") endFishing(false);
    if (DIRS[e.key]) { held.add(DIRS[e.key]); e.preventDefault(); }
    return;
  }
  if (mode === "menu") {
    if (e.key === "Escape" || e.key === "i" || e.key === "I" || (menu && menu.kind === "help" && (e.key === "?" || e.key === "h" || e.key === "H")) || (menu && menu.kind === "journal" && (e.key === "j" || e.key === "J"))) { if (menu && menu.kind === "proposal") send({ t: "propose_answer", yes: false }); closeMenu(); }
    if (menu && menu.kind === "shop") {
      if (e.key === "ArrowDown") { menu.cursor = (menu.cursor + 1) % menu.data.stock.length; renderMenu(); e.preventDefault(); }
      if (e.key === "ArrowUp") { menu.cursor = (menu.cursor - 1 + menu.data.stock.length) % menu.data.stock.length; renderMenu(); e.preventDefault(); }
      if (e.key === "ArrowRight" || e.key === "+" || e.key === "=") { menu.qty = Math.min(99, menu.qty + 1); renderMenu(); }
      if (e.key === "ArrowLeft" || e.key === "-") { menu.qty = Math.max(1, menu.qty - 1); renderMenu(); }
      if (e.key === "Enter") { const [key] = menu.data.stock[menu.cursor]; send({ t: "buy", item: key, n: menu.qty }); }
    }
    if (menu && menu.kind === "board" && e.key === "Enter") send({ t: "deliver" });
    return;
  }
  if (DIRS[e.key]) { const dir = DIRS[e.key]; held.add(dir); lastDir = dir; if (!e.repeat && !tryStep(dir, performance.now())) my.queued = dir; e.preventDefault(); }
  else if (e.key === "e" || e.key === "E" || e.key === " " || e.key === "Enter") {
    const tool = heldItem(), mp = myPlayer();
    if (tool && TOOLS.has(tool) && tool !== "fishing_rod") swings[prefs.name] = { tool, start: performance.now() };
    send({ t: "interact" }); e.preventDefault();
  }
  else if (e.key === "f" || e.key === "F") send({ t: "fish_start" });
  else if (e.key === "x" || e.key === "X") send({ t: "clear" });
  else if (/^[1-9]$/.test(e.key)) send({ t: "select", i: parseInt(e.key, 10) - 1 });
  else if (e.key === "Tab") { if (me && me.inventory.length) send({ t: "select", i: (me.selected + 1) % me.inventory.length }); e.preventDefault(); }
  else if (e.key === "t" || e.key === "T") { openChat(""); e.preventDefault(); }
  else if (e.key === "/") { openChat(""); e.preventDefault(); }
  else if (e.key === "i" || e.key === "I") openMenu("bag", {});
  else if (e.key === "j" || e.key === "J") send({ t: "journal" });
  else if (e.key === "?" || e.key === "h" || e.key === "H") openMenu("help", {});
  else if (e.key === "m" || e.key === "M") toggleMusic();
  else if (e.key === "+" || e.key === "=" || e.code === "Equal" || e.code === "NumpadAdd") setZoom(zoom + 1);
  else if (e.key === "-" || e.key === "_" || e.code === "Minus" || e.code === "NumpadSubtract") setZoom(zoom - 1);
});
window.addEventListener("keyup", (e) => { if (DIRS[e.key]) held.delete(DIRS[e.key]); });
window.addEventListener("blur", () => held.clear());
document.addEventListener("visibilitychange", () => { if (!document.hidden) { cam.snap = true; lastFrame = performance.now(); } });
function setZoom(z) { zoom = Math.max(1, Math.min(4, z)); SCALE = Math.round(zoom * dpr); T = A * SCALE; cam.snap = true; }
function openChat(prefill) { mode = "chat"; held.clear(); $("#chatbox").classList.remove("hidden"); $("#hint").classList.add("hidden"); const i = $("#chat"); i.value = prefill; i.focus(); }
function closeChat() { mode = "play"; $("#chatbox").classList.add("hidden"); $("#hint").classList.remove("hidden"); $("#chat").blur(); canvas.focus(); }
function submitChat() {
  const text = $("#chat").value.trim(); closeChat(); if (!text) return;
  if (text.toLowerCase().startsWith("/ping")) { const parts = text.split(/\s+/); send({ t: "ping", text: parts.slice(1).join(" ") || "hi" }); return; }
  send({ t: "chat", text });
}
canvas.addEventListener("click", (e) => {
  if (mode === "chat") closeChat();
  canvas.focus();
  if (mode !== "play" || !my.ready) return;
  const r = canvas.getBoundingClientRect(), mx = (e.clientX - r.left) * dpr, my_ = (e.clientY - r.top) * dpr;
  const tx = Math.floor((mx - _ox) / T), ty = Math.floor((my_ - _oy) / T);
  const dx = tx - my.tx, dy = ty - my.ty;
  if (dx === 0 && dy === 0) { send({ t: "interact" }); return; }
  const fdx = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0, fdy = Math.abs(dx) >= Math.abs(dy) ? 0 : Math.sign(dy);
  const dir = fdx < 0 ? "left" : fdx > 0 ? "right" : fdy < 0 ? "up" : "down";
  my.dir = dir; send({ t: "face", dx: fdx, dy: fdy });
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1) {
    const tool = heldItem();
    if (tool && TOOLS.has(tool) && tool !== "fishing_rod") swings[prefs.name] = { tool, start: performance.now() };
    setTimeout(() => send({ t: "interact" }), 40);
  }
});

// movement with client-side prediction: we walk immediately, the server confirms
function updateSelf(dt, now) {
  if (!my.ready) return;
  if (state && state.wedding) { my.stepping = false; return; }
  if (my.stepping) {
    const sp = WALK_SPEED * dt, dx = my.tx - my.x, dy = my.ty - my.y, dist = Math.hypot(dx, dy);
    if (dist <= sp) { my.x = my.tx; my.y = my.ty; my.stepping = false; my.dist += dist; }
    else { my.x += dx / dist * sp; my.y += dy / dist * sp; my.dist += sp; }
  }
  if (!my.stepping && mode === "play") {
    if (held.size) { my.queued = null; tryStep((lastDir && held.has(lastDir)) ? lastDir : Array.from(held).pop(), now); }
    else if (my.queued) { const d = my.queued; my.queued = null; tryStep(d, now); }
  }
}
function tryStep(dir, now = performance.now()) {
  // One tile of predicted movement in `dir`; returns true when a step (or a door/turn request) was issued.
  if (!my.ready || my.stepping || mode !== "play" || (state && state.wedding)) return false;
  const [ddx, ddy] = DELTA[dir];
  my.dir = dir;
  const nx = my.tx + ddx, ny = my.ty + ddy;
  const rows = curMap(), ch = (rows[ny] || "")[nx];
  const teleport = portals.has(curLoc() + "," + nx + "," + ny);
  if (teleport) { if (now - my.lastTurn > 400) { my.lastTurn = now; my.lastSend = now; send({ t: "move", dx: ddx, dy: ddy }); } return true; }
  if (walkable(nx, ny)) { my.tx = nx; my.ty = ny; my.stepping = true; my.lastSend = now; send({ t: "move", dx: ddx, dy: ddy }); return true; }
  if (now - my.lastTurn > 250) { my.lastTurn = now; my.lastSend = now; send({ t: "move", dx: ddx, dy: ddy }); }
  return true;
}

// ------------------------------------------------------------------ rendering
let lastFrame = performance.now(), waterFrame = 0, waterAcc = 0, smokeAcc = 0;
function isType(x, y, ch) { return y >= 0 && y < RG.length && x >= 0 && x < RG[0].length && RG[y][x] === ch; }
function isSoil(x, y) { const d = tiles[x + "," + y]; return !!(d && d.s); }
function blob(sx, sy, same, under, fill, edge, bumpy) {
  /* rounded corners where two orthogonal neighbours differ, plus a soft edge line on open sides */
  const r = 7 * SCALE, e = SCALE;
  const corners = [[-1, -1, sx, sy], [1, -1, sx + T - r, sy], [-1, 1, sx, sy + T - r], [1, 1, sx + T - r, sy + T - r]];
  const rounded = [];
  for (const [dx, dy, cx, cy] of corners) {
    const isR = !same(dx, 0) && !same(0, dy);
    rounded.push(isR);
    if (!isR) continue;
    ctx.fillStyle = under; ctx.fillRect(cx, cy, r, r);
    const ccx = dx < 0 ? cx + r : cx, ccy = dy < 0 ? cy + r : cy;
    ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(ccx, ccy, r, 0, 6.3); ctx.fill();
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(ccx, ccy, r - e, 0, 6.3); ctx.fill();
  }
  ctx.fillStyle = edge;
  if (!same(0, -1)) ctx.fillRect(sx + (rounded[0] ? r : 0), sy, T - (rounded[0] ? r : 0) - (rounded[1] ? r : 0), e);
  if (!same(0, 1)) ctx.fillRect(sx + (rounded[2] ? r : 0), sy + T - e, T - (rounded[2] ? r : 0) - (rounded[3] ? r : 0), e);
  if (!same(-1, 0)) ctx.fillRect(sx, sy + (rounded[0] ? r : 0), e, T - (rounded[0] ? r : 0) - (rounded[2] ? r : 0));
  if (!same(1, 0)) ctx.fillRect(sx + T - e, sy + (rounded[1] ? r : 0), e, T - (rounded[1] ? r : 0) - (rounded[3] ? r : 0));
  // organic bumps: little lobes of ground pushing into the grass along each open side
  const bump = (bx, by, br) => { ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(bx, by, br, 0, 6.3); ctx.fill(); ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(bx, by, br - e, 0, 6.3); ctx.fill(); };
  const h = hash(Math.round(sx / T) + 7, Math.round(sy / T) + 3);
  const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  if (!bumpy) return;
  sides.forEach(([dx, dy], i) => {
    if (same(dx, dy) || ((h >> (i * 4)) & 3) === 0) return;          // roughly 3 in 4 open sides get one lobe
    const t = 0.2 + 0.6 * (((h >> (i * 5 + 1)) & 7) / 7), br = (2.5 + ((h >> (i * 2)) & 1)) * SCALE;
    const bx = dx === 0 ? sx + t * T : (dx < 0 ? sx : sx + T), by = dy === 0 ? sy + t * T : (dy < 0 ? sy : sy + T);
    bump(bx, by, br);
  });
}
function render(now) {
  requestAnimationFrame(render);
  try { renderFrame(now); } catch (e) { ctx.globalCompositeOperation = "source-over"; ctx.restore(); if (!window.__renderErr) { window.__renderErr = String(e && e.stack || e); console.error(e); } }
}
function renderFrame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
  pruneFx(now);
  if (mode === "fish") updateFishing(dt);
  if (!state || !map.length) return;
  updateSelf(dt, now);
  for (const name in viz) {
    const v = viz[name], sp = WALK_SPEED * dt, dx = v.tx - v.x, dy = v.ty - v.y, dist = Math.hypot(dx, dy);
    if (dist > 2.5) { v.x = v.tx; v.y = v.ty; }
    else if (dist <= sp) { v.x = v.tx; v.y = v.ty; v.dist += dist; }
    else { v.x += dx / dist * sp; v.y += dy / dist * sp; v.dist += sp; }
    v.moving = dist > 0.001;
  }
  const loc = curLoc();
  if (!isOutdoor(loc)) { renderInterior(now, dt); return; }
  const M = curMap(), farm = loc === "farm", ATL = areaTiles(loc), cave = /^mine/.test(loc), base = AREA_BASE[loc];
  RM = M; RG = groundOf(M);
  const cell = (x, y) => (M[y] || "")[x] || "#", gcell = (x, y) => (RG[y] || [])[x] || "#";
  const cw = Math.floor(canvas.clientWidth * dpr), ch = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  ctx.imageSmoothingEnabled = false;
  waterAcc += dt; if (waterAcc > 0.45) { waterAcc = 0; waterFrame = (waterFrame + 1) % 3; }
  const mapW = M[0].length, mapH = M.length;
  if (my.ready) {
    const focus = (window.cozy && window.cozy.look && isFinite(window.cozy.look.x) && isFinite(window.cozy.look.y)) ? window.cozy.look : farm && state.wedding ? { x: state.wedding.altar[0][0] + 1, y: state.wedding.altar[0][1] + 2 } : { x: my.x + 0.5, y: my.y + 0.5 };
    const [tx, ty] = camTarget(mapW, mapH, cw, ch, focus.x, focus.y);
    if (cam.snap || Math.abs(tx - cam.x) > 8 || Math.abs(ty - cam.y) > 8) { cam.x = tx; cam.y = ty; cam.snap = false; }
    const k = 1 - Math.exp(-7 * dt);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  }
  const ox = Math.round(cw / 2 - cam.x * T), oy = Math.round(ch / 2 - cam.y * T);
  _ox = ox; _oy = oy;
  const x0 = Math.max(0, Math.floor(-ox / T) - 1), y0 = Math.max(0, Math.floor(-oy / T) - 1);
  const x1 = Math.min(mapW - 1, Math.ceil((cw - ox) / T) + 1), y1 = Math.min(mapH - 1, Math.ceil((ch - oy) / T) + 2);
  const season = loc === "island" ? "summer" : state.season, s = SEASON[season], night = cave ? 0.85 : nightAlpha();
  const weather = cave ? "sun" : (loc === "island" && state.weather === "snow") ? "rain" : state.weather;
  const under = base ? Art.GROUND2[base].base : s.grass;
  const rockKind = (c) => c === "R" ? "cave" : loc === "frontier" ? "frontier" : "mountain";
  ctx.fillStyle = cave ? "#120e0b" : "#1e2a1e"; ctx.fillRect(0, 0, cw, ch);
  // 1. ground: the area's base everywhere first (grass, desert or cave floor), then the blobby ground types on top
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const img = base ? Art.GROUND2[base].tile(hash(x, y)) : Art.grassTile(season, hash(x, y) % 24, Math.round((Art.noise2(x, y) - 0.5) * 5));
    ctx.drawImage(img, ox + x * T, oy + y * T, T, T);
  }
  if (!base && Art.decorSprite && Art.DECOR_KINDS) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (M[y][x] !== "." || (farm ? tiles : ATL)[x + "," + y]) continue;
    const h = hash(x * 5 + 2, y * 3 + 1), n = Art.noise2(x, y);
    if ((h % 100) / 100 > 0.10 + n * 0.12) continue;
    const kind = Art.DECOR_KINDS[(h >> 8) % Art.DECOR_KINDS.length];
    const d = Art.decorSprite(season, kind, (h >> 4) % 8); if (d) ctx.drawImage(d, ox + x * T, oy + y * T, T, T);
  }
  const faces = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const sx = ox + x * T, sy = oy + y * T, h = hash(x, y), ch_ = RG[y][x];
    if (ch_ === ",") {
      ctx.drawImage(Art.GROUND[","].tile(h), sx, sy, T, T); blob(sx, sy, (dx, dy) => isType(x + dx, y + dy, ",") || isType(x + dx, y + dy, "~") || isType(x + dx, y + dy, "H"), under, Art.GROUND[","].base, Art.GROUND[","].edge, true);
      ctx.fillStyle = "rgba(120,90,50,.16)";
      if (isType(x, y - 1, "~")) ctx.fillRect(sx, sy, T, 6 * SCALE); if (isType(x, y + 1, "~")) ctx.fillRect(sx, sy + T - 6 * SCALE, T, 6 * SCALE);
      if (isType(x - 1, y, "~")) ctx.fillRect(sx, sy, 6 * SCALE, T); if (isType(x + 1, y, "~")) ctx.fillRect(sx + T - 6 * SCALE, sy, 6 * SCALE, T);
    }
    if (ch_ === ":") { ctx.drawImage(Art.GROUND[":"].tile(h), sx, sy, T, T); blob(sx, sy, (dx, dy) => isType(x + dx, y + dy, ":") || isType(x + dx, y + dy, "=") || isType(x + dx, y + dy, "H"), under, Art.GROUND[":"].base, Art.GROUND[":"].edge, true); }
    if (ch_ === "d") { ctx.drawImage(Art.GROUND["d"].tile(h), sx, sy, T, T); blob(sx, sy, (dx, dy) => isType(x + dx, y + dy, "d") || isType(x + dx, y + dy, ":"), under, Art.GROUND["d"].base, Art.GROUND["d"].edge, true); }
    if (ch_ === "=") { const G = Art.GROUND2["="]; ctx.drawImage(G.tile(h), sx, sy, T, T); blob(sx, sy, (dx, dy) => "=:H".includes(gcell(x + dx, y + dy)), under, G.base, G.edge, false); }
    if (ch_ === "r" || (ch_ === "z" && base !== "z") || (ch_ === "v" && base !== "v")) { const G = Art.GROUND2[ch_]; ctx.drawImage(G.tile(h), sx, sy, T, T); blob(sx, sy, (dx, dy) => isType(x + dx, y + dy, ch_) || isType(x + dx, y + dy, ":"), under, G.base, G.edge, true); }
    if (ch_ === "~") {
      ctx.drawImage(Art.waterTile((waterFrame + ((x + y) % 3)) % 3, hash(x + 11, y + 7) % 4), sx, sy, T, T);
      const wUnder = isType(x - 1, y, ",") || isType(x + 1, y, ",") || isType(x, y - 1, ",") || isType(x, y + 1, ",") ? Art.GROUND[","].base : under;
      blob(sx, sy, (dx, dy) => "~HV".includes(cell(x + dx, y + dy)) || (x + dx < 0 || y + dy < 0 || x + dx >= mapW || y + dy >= mapH), wUnder, "#3d8dd4", "#5aa6e0");
      const shallow = "rgba(150,215,245,.45)", foam = "rgba(240,250,255," + (0.35 + 0.25 * Math.sin(now / 500 + x + y)) + ")";
      const side = (open, rx, ry, rw, rh, fx, fy, fw, fh) => { if (!open) return; ctx.fillStyle = shallow; ctx.fillRect(rx, ry, rw, rh); ctx.fillStyle = foam; for (let i = 0; i < 3; i++) ctx.fillRect(fx + (fw ? i * 9 * SCALE : 0), fy + (fh ? i * 9 * SCALE : 0), fw ? 4 * SCALE : SCALE, fh ? 4 * SCALE : SCALE); };
      const wet = (dx, dy) => "~HV".includes(cell(x + dx, y + dy)) || x + dx < 0 || y + dy < 0 || x + dx >= mapW || y + dy >= mapH;
      side(!wet(0, -1), sx, sy, T, 5 * SCALE, sx + 4 * SCALE, sy + 2 * SCALE, 1, 0);
      side(!wet(0, 1), sx, sy + T - 5 * SCALE, T, 5 * SCALE, sx + 6 * SCALE, sy + T - 3 * SCALE, 1, 0);
      side(!wet(-1, 0), sx, sy, 5 * SCALE, T, sx + 2 * SCALE, sy + 4 * SCALE, 0, 1);
      side(!wet(1, 0), sx + T - 5 * SCALE, sy, 5 * SCALE, T, sx + T - 3 * SCALE, sy + 6 * SCALE, 0, 1);
    }
    if (ch_ === "H") {
      const vert = "HV".includes(cell(x, y - 1)) || "HV".includes(cell(x, y + 1));
      ctx.drawImage(Art.plankTile(vert, h % 4), sx, sy, T, T);
      ctx.fillStyle = "#5a3a22";
      if (vert) { if (isType(x - 1, y, "~")) { ctx.fillRect(sx, sy, 2 * SCALE, T); if (y % 2 === 0) ctx.fillRect(sx - SCALE, sy + 4 * SCALE, 4 * SCALE, 5 * SCALE); } if (isType(x + 1, y, "~")) { ctx.fillRect(sx + T - 2 * SCALE, sy, 2 * SCALE, T); if (y % 2 === 0) ctx.fillRect(sx + T - 3 * SCALE, sy + 4 * SCALE, 4 * SCALE, 5 * SCALE); } }
      else { if (isType(x, y - 1, "~")) ctx.fillRect(sx, sy, T, 2 * SCALE); if (isType(x, y + 1, "~")) ctx.fillRect(sx, sy + T - 2 * SCALE, T, 2 * SCALE); }
    }
    if (M[y][x] === "C" || M[y][x] === "R") {
      const rc = M[y][x], same = (c) => c === rc || (c === "@" && rc === "C");
      const part = !same(cell(x, y + 1)) ? "face" : !same(cell(x, y + 2)) ? "lip" : "top";
      const v = part === "top" ? h % 4 : ((x % 4) + 4) % 4;
      ctx.drawImage(Art.cliffTile(rockKind(rc), part, v, season, part !== "top" && !same(cell(x - 1, y)), part !== "top" && !same(cell(x + 1, y))), sx, sy, T, T);
      if (part === "face" && !same(cell(x, y + 1))) faces.push([sx, sy + T]);
    }
  }
  ctx.fillStyle = cave ? "rgba(0,0,0,.35)" : "rgba(30,20,10,.22)";
  for (const [fx, fy] of faces) { ctx.fillRect(fx, fy, T, 5 * SCALE); ctx.fillRect(fx, fy + 5 * SCALE, T, 3 * SCALE); }
  // 2. soil, props, crops, forage and ore, trees as depth-sorted entities
  const ents = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const sx = ox + x * T, sy = oy + y * T, h = hash(x, y), ch_ = M[y][x], d = farm ? tiles[x + "," + y] : null;
    if (d && d.s) {
      const kind = d.f ? "fert" : d.w ? "wet" : "dry";
      ctx.drawImage(Art.soilTile(kind, hash(x + 5, y + 9) % 4), sx, sy, T, T);
      blob(sx, sy, (dx, dy) => isSoil(x + dx, y + dy), s.grass, kind === "wet" ? "#6b4629" : "#9d6a3a", Art.SOIL_EDGE[kind]);
    }
    if ("WS+N@".includes(ch_)) continue;
    if (ch_ === "#" || ch_ === "G") {
      const conn = (dx, dy) => { const r = M[y + dy]; return !!r && (r[x + dx] === "#" || r[x + dx] === "G"); };
      const mask = (conn(0, -1) ? 1 : 0) | (conn(1, 0) ? 2 : 0) | (conn(0, 1) ? 4 : 0) | (conn(-1, 0) ? 8 : 0);
      ctx.drawImage(ch_ === "#" ? Art.fenceSprite(mask) : Art.gateSprite(!!(mask & 5)), sx, sy, T, T);
    }
    else if ("o$!fBchmlbwspg".includes(ch_)) { if (ch_ === "o" || ch_ === "l" || ch_ === "!" || ch_ === "g") ents.push({ y: y + 0.4, draw: () => ctx.drawImage(Art.propSprite(ch_), sx, sy, T, T) }); else ctx.drawImage(Art.propSprite(ch_), sx, sy, T, T); }
    else if ("ELIJOUD".includes(ch_)) { const spr = Art.areaProp(ch_, h); ents.push({ y: y + 0.4, draw: () => ctx.drawImage(spr, sx, sy, T, T) }); }
    else if (ch_ === "u") ents.push({ y: y + 0.4, draw: () => { ctx.fillStyle = "rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T - 3 * SCALE, 12 * SCALE, 4 * SCALE, 0, 0, 6.3); ctx.fill(); ctx.drawImage(Art.propSprite("u"), sx, sy - 4 * SCALE, T, T); } });
    else if (ch_ === "Y") ents.push({ y: y + 0.9, draw: () => { ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T - 2 * SCALE, 11 * SCALE, 4 * SCALE, 0, 0, 6.3); ctx.fill(); ctx.drawImage(Art.priestSprite(Math.floor(now / 700) % 2), sx, sy - 16 * SCALE, T, 48 * SCALE); } });
    else if (ch_ === "~" && h % 9 === 0 && cell(x, y - 1) === "~" && cell(x, y + 1) === "~" && cell(x - 1, y) === "~" && cell(x + 1, y) === "~" && isType(x, y - 1, "~") && isType(x, y + 1, "~") && isType(x - 1, y, "~") && isType(x + 1, y, "~") && !(loc === "beach" || loc === "island")) ctx.drawImage(Art.lilyPad(h % 4), sx, sy, T, T);
    else if (ch_ === "T") {
      const dEdge = Math.min(x - 1, mapW - 2 - x, y - 1, mapH - 2 - y);
      if (dEdge === 1 && h % 5 < 2) ctx.drawImage(Art.bushSprite(treeKind(season, x, y), h % 4), sx, sy, T, T);
      else ents.push({ y: y + 0.5, tree: true, sx, sy, kind: treeKind(season, x, y), variant: h % 16 });
    }
    else if (ch_ === "P") ents.push({ y: y + 0.5, big: Art.pineSprite(season, h % 8), sx, sy });
    else if (ch_ === "A") ents.push({ y: y + 0.5, palm: Art.palmSprite(h % 6), sx, sy });
    else if (ch_ === "K") ents.push({ y: y + 0.5, draw: () => { ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T - 3 * SCALE, 10 * SCALE, 3 * SCALE, 0, 0, 6.3); ctx.fill(); ctx.drawImage(Art.cactusSprite(h % 6), sx, sy - 16 * SCALE, T, 48 * SCALE); } });
    else if (ch_ === "F" && cell(x - 1, y) !== "F" && cell(x, y - 1) !== "F") ents.push({ y: y + 1.5, draw: () => ctx.drawImage(Art.fountainSprite(Math.floor(now / 220) % 3), sx, sy - 16 * SCALE, 3 * T, 80 * SCALE / 1) });
    else if (ch_ === "Q" && cell(x - 1, y) !== "Q" && cell(x, y - 1) !== "Q") ents.push({ y: y + 1.6, draw: () => ctx.drawImage(Art.coachSprite(), sx, sy - 16 * SCALE, 3 * T, 80 * SCALE) });
    else if (ch_ === "V" && cell(x - 1, y) !== "V") ctx.drawImage(Art.boatSprite(), sx, sy + Math.round(Math.sin(now / 600) * SCALE), 2 * T, T);
    if (d) {
      const flying = inFlight(x, y, now);   // something is still falling onto this tile: show it when it lands
      if (d.c && !flying) ctx.drawImage(Art.cropSprite(d.c[0], d.c[1], d.c[2]), sx, sy, T, T);
      if (d.g) ctx.drawImage(Art.forageSprite(d.g), sx, sy, T, T);
      if (d.k && !flying) ctx.drawImage(Art.propSprite("k"), sx, sy, T, T);
      const rareTree = d.t && catalog.trees[d.t[0]] && catalog.trees[d.t[0]].rare && Art.rareTreeSprite ? d.t[0] : null;
      if (rareTree) { if (d.t[1] < 2) { if (!flying) ctx.drawImage(Art.rareTreeSprite(rareTree, d.t[1], season), sx, sy, T, T); } else ents.push({ y: y + 0.5, rareTree, sx, sy, season }); }
      else if (d.t) { if (d.t[1] < 2) { if (!flying) ctx.drawImage(Art.youngTree(d.t[1], season), sx, sy, T, T); } else ents.push({ y: y + 0.5, tree: true, sx, sy, kind: season === "winter" ? "snow" : "green", variant: h % 16, fruitColor: ITEM_HEX[d.t[0]] || "#e8394a", fruit: d.t[2] }); }
    }
    if (!farm) {
      const ad = ATL[x + "," + y];
      if (ad && ad.g && !inFlight(x, y, now)) ctx.drawImage(Art.forageSprite(ad.g), sx, sy, T, T);
      if (ad && ad.o) ents.push({ y: y + 0.3, draw: () => ctx.drawImage(Art.oreSprite(ad.o, cave, h), sx, sy, T, T) });
    }
  }
  // 3. buildings: shadows, the farmhouse porch and smoke, then the sprites as depth-sorted entities
  const blds = farm ? buildings : areaBuildings(loc);
  for (const b of blds) {
    if (b.x1 < x0 - 2 || b.x0 > x1 + 2 || b.y1 < y0 - 3 || b.y0 > y1 + 1) continue;
    if (b.kind !== "mine" && b.kind !== "volcano") {
      ctx.fillStyle = "rgba(0,0,0,.16)";
      ctx.fillRect(ox + (b.x1 + 1) * T + Art.OV * SCALE, oy + (b.y0 + 2) * T, 6 * SCALE, (b.y1 - b.y0 - 1) * T + 6 * SCALE);
      ctx.fillRect(ox + b.x0 * T + 6 * SCALE, oy + (b.y1 + 1) * T, (b.x1 - b.x0 + 1) * T + Art.OV * SCALE, 6 * SCALE);
    }
    if (farm && b.kind === "W") {
      const dx = Math.floor((b.x0 + b.x1) / 2), py = b.y1 + 1;
      ["L", "M", "R"].forEach((part, i) => ctx.drawImage(Art.porchTile(part), ox + (dx - 1 + i) * T, oy + py * T, T, T));
      smokeAcc += dt; if (smokeAcc > 0.45) { smokeAcc = 0; smoke.push({ x: b.x1 - 2.2, y: b.y0 - 0.55, a: 0.55, r: 2.5, vx: 0.15 + Math.random() * 0.2 }); }
    }
    const w = b.x1 - b.x0 + 1, hh = b.y1 - b.y0 + 1;
    const spr = farm ? Art.buildingSprite(b.kind, w, hh, night > 0.2) : Art.areaBuilding(b.kind, w, hh, night > 0.2, b.label, season);
    ents.push({ y: b.y1 + 0.6, draw: () => ctx.drawImage(spr, ox + b.x0 * T - Art.OV * SCALE, oy + b.y0 * T - Art.TOPPAD * SCALE, w * T + 2 * Art.OV * SCALE, hh * T + Art.TOPPAD * SCALE) });
  }
  for (const sm of smoke) { sm.y -= 0.35 * dt; sm.x += sm.vx * dt; sm.a -= 0.1 * dt; sm.r += 1.4 * dt; }
  smoke = smoke.filter((sm) => sm.a > 0);
  if (farm) for (const sm of smoke) { ctx.fillStyle = "rgba(240,240,244," + sm.a + ")"; ctx.beginPath(); ctx.arc(ox + sm.x * T, oy + sm.y * T, sm.r * SCALE, 0, 6.3); ctx.fill(); }
  // 4. facing highlight
  const meP = myPlayer();
  if (meP) {
    const fx = meP.x + meP.facing[0], fy = meP.y + meP.facing[1], ft = cell(fx, fy), fd = (farm ? tiles : ATL)[fx + "," + fy] || {};
    const hot = farm ? ("S$!+~wmBchblNspg.:".includes(ft) || fd.t || fd.g || chestAt(fx, fy)) : ("~!wmIEFJLOgVQUDBchbl".includes(ft) || fd.g || fd.o || portals.has(loc + "," + fx + "," + fy));
    if (hot) {
      ctx.strokeStyle = "rgba(255,250,200," + (0.35 + 0.3 * Math.sin(now / 200)) + ")"; ctx.lineWidth = SCALE;
      ctx.strokeRect(ox + fx * T + 2 * SCALE, oy + fy * T + 2 * SCALE, T - 4 * SCALE, T - 4 * SCALE);
    }
  }
  // 5. entities sorted by row: the chest, cows, wedding guests, farmers
  if (farm) for (const chs of state.chests || []) {
    if (chs.x < x0 - 1 || chs.x > x1 + 1 || chs.y < y0 - 1 || chs.y > y1 + 1 || inFlight(chs.x, chs.y, now) || chestLifting(chs.x, chs.y, now)) continue;
    const cx = chs.x, cy = chs.y, sx = ox + cx * T, sy = oy + cy * T;
    ents.push({ y: cy + 0.6, draw: () => {
      const mp = myPlayer(), opened = !!(menu && menu.kind === "barn" && mp && mp.x + mp.facing[0] === cx && mp.y + mp.facing[1] === cy);
      ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T - 3 * SCALE, 12 * SCALE, 4 * SCALE, 0, 0, 6.3); ctx.fill();
      ctx.drawImage(Art.chestSprite(opened), sx, sy - 2 * SCALE, T, T);
    } });
  }
  if (farm) for (const cw of state.cows || []) {
    const v = cowViz[cw.id]; if (!v) continue;
    // the server moves a walking cow one tile per second, so glide at just over a tile a second and she never jumps
    const sp = 1.12 * dt, dx = v.tx - v.x, dy = v.ty - v.y, dist = Math.hypot(dx, dy);
    if (dist > 2.5) { v.x = v.tx; v.y = v.ty; } else if (dist <= sp) { v.x = v.tx; v.y = v.ty; } else { v.x += dx / dist * sp; v.y += dy / dist * sp; }
    const moving = dist > 0.02 || !!cw.w;
    if (v.x + 1 < x0 || v.x > x1 + 1 || v.y + 1 < y0 || v.y > y1 + 1) continue;
    ents.push({ y: v.y + 0.9, draw: () => {
      const sx = Math.round(ox + v.x * T), sy = Math.round(oy + v.y * T);
      const spr = moving ? Art.cowSprite(0, cw.milk, 1 + Math.floor(now / 170 + cw.id) % 4) : Art.cowSprite(Math.floor(now / 650 + cw.id % 7) % 2, cw.milk);
      ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T - 3 * SCALE, 12 * SCALE, 4 * SCALE, 0, 0, 6.3); ctx.fill();
      if (v.f < 0) { ctx.save(); ctx.translate(sx + T, sy - 6 * SCALE); ctx.scale(-1, 1); ctx.drawImage(spr, 0, 0, T, T); ctx.restore(); }
      else ctx.drawImage(spr, sx, sy - 6 * SCALE, T, T);
    } });
  }
  if (loc === "frontier") for (const [cx_, cy_, f] of [[12, 25, 1], [18, 27, -1], [22, 24, 1], [15, 23, -1]]) {
    if (cx_ < x0 - 1 || cx_ > x1 + 1 || cy_ < y0 - 1 || cy_ > y1 + 1) continue;
    ents.push({ y: cy_ + 0.9, draw: () => {
      const sx = ox + cx_ * T, sy = oy + cy_ * T, face = Math.floor(now / 7000 + cx_) % 2 ? f : -f, spr = Art.cowSprite(Math.floor(now / 650 + cx_) % 2, false);
      ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T - 3 * SCALE, 12 * SCALE, 4 * SCALE, 0, 0, 6.3); ctx.fill();
      if (face < 0) { ctx.save(); ctx.translate(sx + T, sy - 6 * SCALE); ctx.scale(-1, 1); ctx.drawImage(spr, 0, 0, T, T); ctx.restore(); } else ctx.drawImage(spr, sx, sy - 6 * SCALE, T, T);
    } });
  }
  const wd = farm ? state.wedding : null;
  if (wd) {
    const ax = ox + (wd.altar[0][0] + 1) * T, ay = oy + wd.altar[0][1] * T;
    ents.push({ y: wd.altar[0][1] + 0.2, draw: () => ctx.drawImage(Art.archSprite(), ax - 48 * SCALE, ay - 58 * SCALE, 96 * SCALE, 80 * SCALE) });
    for (const gst of wd.guests) {
      ents.push({ y: gst.y + 0.9, draw: () => drawFarmer({ name: gst.name, color: gst.color, sprite: gst.sprite, hat: gst.hat, facing: [0, -1] }, gst.x, gst.y, "up", 0, ox, oy, now, null) });
    }
  }
  for (const p of state.players) {
    if (!p.online || (p.loc || "farm") !== loc) continue;
    if (p.name === prefs.name) { if (my.ready) ents.push({ y: my.y + 0.9, draw: () => drawFarmer(p, my.x, my.y, my.dir, my.stepping ? 1 + Math.floor(my.dist * 4) % 7 : 0, ox, oy, now, heldItem()) }); continue; }
    const v = viz[p.name]; if (!v) continue;
    ents.push({ y: v.y + 0.9, draw: () => drawFarmer(p, v.x, v.y, v.facing, v.moving ? 1 + Math.floor(v.dist * 4) % 7 : 0, ox, oy, now, p.held) });
  }
  ents.sort((a, b) => a.y - b.y).forEach((e) => {
    if (e.tree) {
      ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(e.sx + T / 2, e.sy + T - 2 * SCALE, 18 * SCALE, 6 * SCALE, 0, 0, 6.3); ctx.fill();
      ctx.drawImage(Art.treeSprite(e.kind, e.variant, e.fruitColor, e.fruit), e.sx - 8 * SCALE, e.sy + T - 62 * SCALE, 48 * SCALE, 64 * SCALE);
    } else if (e.big) {
      ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(e.sx + T / 2, e.sy + T - 2 * SCALE, 16 * SCALE, 5 * SCALE, 0, 0, 6.3); ctx.fill();
      ctx.drawImage(e.big, e.sx - 8 * SCALE, e.sy + T - 62 * SCALE, 48 * SCALE, 64 * SCALE);
    } else if (e.palm) {
      ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(e.sx + T / 2, e.sy + T - 2 * SCALE, 14 * SCALE, 4 * SCALE, 0, 0, 6.3); ctx.fill();
      ctx.drawImage(e.palm, e.sx - 16 * SCALE, e.sy + T - 79 * SCALE, 64 * SCALE, 80 * SCALE);
    } else if (e.rareTree) {
      ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(e.sx + T / 2, e.sy + T - 2 * SCALE, 18 * SCALE, 6 * SCALE, 0, 0, 6.3); ctx.fill();
      ctx.drawImage(Art.rareTreeSprite(e.rareTree, 2, e.season), e.sx - 8 * SCALE, e.sy + T - 62 * SCALE, 48 * SCALE, 64 * SCALE);
    } else e.draw();
  });
  drawFx(now, ox, oy);
  // 6. ambient life
  if (!cave && night < 0.1 && hourNow() > 7 && hourNow() < 18.5 && weather === "sun" && season !== "winter") {
    while (butterflies.length < 5) butterflies.push({ x: Math.random() * mapW, y: Math.random() * mapH, p: Math.random() * 6.3, c: ["#fff8d0", "#ffd0e8", "#d8f0ff"][butterflies.length % 3] });
    for (const bf of butterflies) {
      bf.x += Math.sin(now / 900 + bf.p) * dt * 1.2 + 0.2 * dt; bf.y += Math.cos(now / 700 + bf.p) * dt * 0.8;
      if (bf.x > mapW) bf.x = 0;
      const bx = ox + bf.x * T, by = oy + bf.y * T + Math.sin(now / 150 + bf.p) * SCALE, open = Math.sin(now / 90 + bf.p) > 0;
      ctx.fillStyle = bf.c; ctx.fillRect(bx - (open ? 4 : 2) * SCALE, by, 3 * SCALE, 3 * SCALE); ctx.fillRect(bx + SCALE, by, 3 * SCALE, 3 * SCALE);
      ctx.fillStyle = OUT; ctx.fillRect(bx, by + SCALE, SCALE, 2 * SCALE);
    }
  } else butterflies = [];
  if (!cave && s.petals && weather === "sun") {
    while (petals.length < 30) petals.push({ x: Math.random() * cw, y: Math.random() * ch, p: Math.random() * 6.3, v: 40 + Math.random() * 40 });
    ctx.fillStyle = loc === "frontier" ? "#d8b07a" : s.petals;
    for (const pt of petals) {
      pt.y += pt.v * dt * SCALE / 3; pt.x += (Math.sin(now / 800 + pt.p) * 40 + 15) * dt * SCALE / 3;
      if (pt.y > ch) { pt.y = -10; pt.x = Math.random() * cw; }
      ctx.fillRect(pt.x, pt.y, 2 * SCALE, 2 * SCALE);
    }
  } else petals = [];
  if (!wd) hearts = [];
  // 7. weather
  if (weather !== "sun") {
    const rain = weather === "rain";
    while (drops.length < (rain ? 160 : 90)) drops.push({ x: Math.random() * (cw + 300), y: Math.random() * ch, v: rain ? 900 + Math.random() * 500 : 60 + Math.random() * 60, dx: rain ? -120 : (Math.random() - .5) * 40 });
    ctx.strokeStyle = "rgba(200,230,255,.65)"; ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = SCALE / 2;
    for (const dr of drops) {
      dr.y += dr.v * dt * SCALE / 3; dr.x += dr.dx * dt * SCALE / 3;
      if (dr.y > ch || dr.x < -20) { dr.y = -20; dr.x = Math.random() * (cw + 300); }
      if (rain) { ctx.beginPath(); ctx.moveTo(dr.x, dr.y); ctx.lineTo(dr.x - 1.5 * SCALE, dr.y + 5 * SCALE); ctx.stroke(); }
      else ctx.fillRect(dr.x, dr.y, SCALE, SCALE);
    }
    ctx.fillStyle = rain ? "rgba(40,60,90,.2)" : "rgba(220,230,240,.1)"; ctx.fillRect(0, 0, cw, ch);
  } else drops = [];
  // 8. sky: sunrise, sunset, dusk and night tints (caves are always dark); warm glows from lamps, windows and farmers
  if (cave) { ctx.fillStyle = "rgba(8,6,10,.56)"; ctx.fillRect(0, 0, cw, ch); }
  else { const tint = skyTint(hourNow()); if (tint[3] > 0.005) { ctx.fillStyle = "rgba(" + Math.round(tint[0]) + "," + Math.round(tint[1]) + "," + Math.round(tint[2]) + "," + tint[3].toFixed(3) + ")"; ctx.fillRect(0, 0, cw, ch); } }
  if (night > 0) {
    ctx.globalCompositeOperation = "lighter";
    // festival string lights: from the shop awning to the lamp posts, and along the porch
    const strings = farm ? [[[20, 9.2], [40, 9.2]], [[40, 9.2], [49, 16.2]], [[48, 6.2], [59, 6.2]], [[4, 7.2], [13, 7.2]], [[70, 15.3], [74, 9]]] : loc === "town" ? [[[27, 14.2], [45, 14.2]], [[27, 30.2], [45, 30.2]], [[12, 21.2], [24, 21.2]], [[52, 21.2], [64, 21.2]]] : [];
    for (const [[ax, ay], [bx, by]] of strings) {
      const p0 = { x: ox + ax * T + T / 2, y: oy + ay * T }, p1 = { x: ox + bx * T + T / 2, y: oy + by * T };
      const midx = (p0.x + p1.x) / 2, midy = (p0.y + p1.y) / 2 + 22 * SCALE;
      ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = "rgba(40,30,20,.9)"; ctx.lineWidth = SCALE; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(midx, midy, p1.x, p1.y); ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      const n = Math.max(3, Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y) / (1.15 * T)));
      for (let i = 0; i <= n; i++) {
        const u = i / n, qx = (1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * midx + u * u * p1.x, qy = (1 - u) * (1 - u) * p0.y + 2 * (1 - u) * u * midy + u * u * p1.y;
        const tw = 0.8 + 0.2 * Math.sin(now / 350 + i * 1.7 + ax);
        const col = ["255,236,170", "255,200,230", "200,230,255", "255,220,150"][i % 4];
        const g = ctx.createRadialGradient(qx, qy, 0, qx, qy, 9 * SCALE); g.addColorStop(0, "rgba(" + col + "," + 0.9 * tw * night + ")"); g.addColorStop(0.3, "rgba(" + col + "," + 0.35 * tw * night + ")"); g.addColorStop(1, "rgba(" + col + ",0)");
        ctx.fillStyle = g; ctx.fillRect(qx - 9 * SCALE, qy - 9 * SCALE, 18 * SCALE, 18 * SCALE);
        ctx.fillStyle = "rgba(255,255,240," + Math.min(1, 0.9 * tw + 0.2) + ")"; ctx.fillRect(qx - SCALE, qy - SCALE, 2 * SCALE, 2 * SCALE);
      }
    }
    const glow = (gx, gy, r, a, inner) => {
      if (!isFinite(gx) || !isFinite(gy) || !isFinite(r) || r <= 0) return;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, "rgba(255,236,170," + a * (inner || 1) + ")"); g.addColorStop(0.35, "rgba(255,200,110," + a * 0.55 + ")"); g.addColorStop(1, "rgba(255,170,80,0)");
      ctx.fillStyle = g; ctx.fillRect(gx - r, gy - r, 2 * r, 2 * r);
    };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const ch_ = M[y][x];
      if (ch_ === "l") {
        const flick = 0.85 + 0.15 * Math.sin(now / 90 + x * 3 + y);
        glow(ox + x * T + T / 2, oy + y * T + 8 * SCALE, 3.6 * T, 0.55 * night * flick);
        ctx.fillStyle = "rgba(255,220,140," + 0.16 * night + ")"; ctx.beginPath(); ctx.ellipse(ox + x * T + T / 2, oy + y * T + T - 2 * SCALE, 1.6 * T, 0.7 * T, 0, 0, 6.3); ctx.fill();
      }
    }
    for (const b of blds) {
      if (farm) {
        const rr = Art.roofRowsFor(b.y1 - b.y0 + 1), wy = b.y0 + rr;
        const cols = b.kind === "W" ? [1, 3, 7, 9] : (b.kind === "S" ? [2, 3, 7, 8] : [4]);
        for (const cx of cols) {
          const gx = ox + (b.x0 + cx) * T + T / 2, gy = oy + wy * T + 14 * SCALE;
          glow(gx, gy, 1.5 * T, 0.35 * night);
          ctx.fillStyle = "rgba(255,215,130," + 0.12 * night + ")";
          ctx.beginPath(); ctx.moveTo(gx - 10 * SCALE, oy + (b.y1 + 1) * T); ctx.lineTo(gx + 10 * SCALE, oy + (b.y1 + 1) * T); ctx.lineTo(gx + 22 * SCALE, oy + (b.y1 + 1) * T + 26 * SCALE); ctx.lineTo(gx - 22 * SCALE, oy + (b.y1 + 1) * T + 26 * SCALE); ctx.closePath(); ctx.fill();
        }
      } else for (const [wx, wy] of Art.windowSpots(b.kind, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1)) glow(ox + (b.x0 + wx) * T, oy + (b.y0 + wy) * T, 1.5 * T, 0.35 * night);
    }
    for (const p of state.players) { if (!p.online || (p.loc || "farm") !== loc) continue; const v = p.name === prefs.name ? my : viz[p.name]; if (v) glow(ox + v.x * T + T / 2, oy + v.y * T + T / 2, (cave ? 5.2 : 2.4) * T, (cave ? 0.6 : 0.22) * night); }
    if (cave) for (const k in ATL) { const t = ATL[k]; if (!t.o || !/amethyst|emerald|ruby|diamond|prismatic|quartz/.test(t.o)) continue; const [gx, gy] = k.split(",").map(Number); glow(ox + gx * T + T / 2, oy + gy * T + T / 2, 1.2 * T, 0.25 + 0.1 * Math.sin(now / 300 + gx)); }
    if (!cave && weather === "sun" && season !== "winter") {
      while (fireflies.length < 18) fireflies.push({ x: Math.random() * mapW, y: Math.random() * mapH, p: Math.random() * 6.3 });
      for (const f of fireflies) {
        f.x += (Math.random() - .5) * dt * 1.5; f.y += (Math.random() - .5) * dt * 1.5;
        const a = Math.max(0, Math.sin(now / 600 + f.p));
        if (a < 0.05) continue;
        const fx = ox + f.x * T, fy = oy + f.y * T;
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 5 * SCALE); g.addColorStop(0, "rgba(220,255,140," + 0.7 * a + ")"); g.addColorStop(1, "rgba(220,255,140,0)");
        ctx.fillStyle = g; ctx.fillRect(fx - 5 * SCALE, fy - 5 * SCALE, 10 * SCALE, 10 * SCALE);
        ctx.fillStyle = "rgba(245,255,200," + a + ")"; ctx.fillRect(fx - SCALE / 2, fy - SCALE / 2, SCALE, SCALE);
      }
    }
    ctx.globalCompositeOperation = "source-over";
  } else fireflies = [];
  // 9. priest bubble, wedding banner and confetti, names and bubbles
  if (farm && state.priest && state.priest.bubble) drawBubble(ox + state.priest.x * T + T / 2, oy + state.priest.y * T - 20 * SCALE, state.priest.bubble);
  if (wd) {
    if (wd.phase === "married") {
      const bx = ox + (wd.altar[0][0] + 1) * T, by = oy + (wd.altar[0][1] - 4) * T + Math.sin(now / 400) * 3 * SCALE;
      const tw = Art.textWidth("MARRIED", 5) * SCALE;
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(bx - tw / 2 - 8 * SCALE, by - 4 * SCALE, tw + 16 * SCALE, 30 * SCALE);
      const bc = blank(Art.textWidth("MARRIED", 5) + 2, 27); Art.text3x5(bc.getContext("2d"), 1, 1, "MARRIED", "#ff7ec8", 5);
      ctx.drawImage(bc, bx - tw / 2, by, tw + 2 * SCALE, 27 * SCALE);
      while (hearts.length < 60) hearts.push({ x: Math.random() * cw, y: Math.random() * ch, p: Math.random() * 6.3, v: 40 + Math.random() * 40 });
    }
    if (wd.phase === "married" || wd.phase === "ido") for (const pt of hearts) { ctx.fillStyle = ["#ff7ec8", "#ffd0e8", "#ffe066"][Math.floor(pt.p * 3) % 3]; ctx.fillRect(pt.x, pt.y, 3 * SCALE, 3 * SCALE); ctx.fillRect(pt.x - SCALE, pt.y - SCALE, SCALE, SCALE); ctx.fillRect(pt.x + 3 * SCALE, pt.y - SCALE, SCALE, SCALE); pt.y += pt.v * dt * SCALE / 3; pt.x += Math.sin(now / 500 + pt.p) * 30 * dt; if (pt.y > ch) { pt.y = -10; pt.x = Math.random() * cw; } }
  }
  for (const p of state.players) {
    if (!p.online || (p.loc || "farm") !== loc) continue;
    const v = p.name === prefs.name ? my : viz[p.name]; if (!v) continue;
    const px_ = ox + v.x * T + T / 2, py_ = oy + v.y * T - 16 * SCALE;
    const shirt = COLORS[catalog.player_colors[p.color % catalog.player_colors.length]] || "#f4f1ea";
    if (p.bubble) drawSpeech(px_, py_ - 3 * SCALE, p.bubble, shirt);
    else if (p.name !== prefs.name) drawTag(px_, py_ - 2 * SCALE, p.name);
  }
  drawBanner(now, cw);
  if (Math.floor(now / 1000) !== Math.floor((now - dt * 1000) / 1000)) $("#clock").textContent = skyLabel(hourNow());
}
const _areaBld = {};
function areaBuildings(loc) {
  if (!_areaBld[loc]) _areaBld[loc] = ((catalog.buildings || {})[loc] || []).map((b) => ({ kind: b.kind, label: b.label, x0: b.x, y0: b.y, x1: b.x + b.w - 1, y1: b.y + b.h - 1 }));
  return _areaBld[loc];
}
function drawBanner(now, cw) {
  /* the name of a place, in a little wooden card at the top of the screen, when you walk into it */
  if (!areaBanner) return;
  const t = (now - areaBanner.at) / 1000;
  if (t > 3) { areaBanner = null; return; }
  const a = t < 0.3 ? t / 0.3 : t > 2.4 ? Math.max(0, (3 - t) / 0.6) : 1;
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = "600 " + 9 * SCALE + "px 'Pixelify Sans', 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(areaBanner.text).width + 24 * SCALE, h = 16 * SCALE, x = cw / 2 - w / 2, y = 34 * SCALE + (t < 0.3 ? (1 - t / 0.3) * -10 * SCALE : 0);
  ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x - SCALE, y - SCALE, w + 2 * SCALE, h + 2 * SCALE);
  ctx.fillStyle = "#f2e3bf"; ctx.fillRect(x, y, w, h); ctx.fillStyle = "#c9b283"; ctx.fillRect(x, y + h - SCALE, w, SCALE);
  ctx.fillStyle = "#3a2a1a"; ctx.fillText(areaBanner.text, cw / 2, y + h / 2 + SCALE / 2);
  ctx.restore();
}
function hudPads() {
  // Screen-space bands (device px) covered by the HUD, so the camera keeps the farmer in the uncovered part of the canvas.
  const r = canvas.getBoundingClientRect();
  const side = $("#side").getBoundingClientRect(), here = $("#here").getBoundingClientRect(), top = $("#topbar").getBoundingClientRect();
  const sideCovers = side.width > 0 && side.left < r.right;
  return { l: 0, r: sideCovers ? Math.max(0, r.right - side.left + 8) * dpr : 0, t: Math.max(0, top.bottom - r.top) * dpr, b: here.width > 0 ? Math.max(0, r.bottom - here.top + 6) * dpr : 0 };
}
function camTarget(mapW, mapH, cw, ch, fx, fy) {
  const p = hudPads();
  if (cw - p.l - p.r < 2 * T) p.r = p.l = 0;   // tiny window: the side panel covers nearly everything, fall back to plain centring
  if (ch - p.t - p.b < 2 * T) p.t = p.b = 0;
  const visW = cw - p.l - p.r, visH = ch - p.t - p.b;
  const cxo = (p.l - p.r) / 2, cyo = (p.t - p.b) / 2;
  const tx = mapW * T <= visW ? mapW / 2 - cxo / T : Math.max((cw / 2 - p.l) / T, Math.min(mapW - (cw / 2 - p.r) / T, fx - cxo / T));
  const ty = mapH * T <= visH ? mapH / 2 - cyo / T : Math.max((ch / 2 - p.t) / T, Math.min(mapH - (ch / 2 - p.b) / T, fy - cyo / T));
  return [tx, ty];
}
function renderInterior(now, dt) {
  const rows = curMap(), loc = curLoc();
  const cw = Math.floor(canvas.clientWidth * dpr), ch = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  ctx.imageSmoothingEnabled = false;
  const mapW = rows[0].length, mapH = rows.length;
  const [tx, ty] = camTarget(mapW, mapH, cw, ch, my.x + 0.5, my.y + 0.5);
  if (cam.snap || Math.abs(tx - cam.x) > 8 || Math.abs(ty - cam.y) > 8) { cam.x = tx; cam.y = ty; cam.snap = false; }
  const k = 1 - Math.exp(-7 * dt); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  const ox = Math.round(cw / 2 - cam.x * T), oy = Math.round(ch / 2 - cam.y * T); _ox = ox; _oy = oy;
  ctx.fillStyle = "#12100e"; ctx.fillRect(0, 0, cw, ch);
  const fr = Math.floor(now / 350) % 2;
  for (let y = 0; y < mapH; y++) for (let x = 0; x < mapW; x++) {
    const c = rows[y][x], sx = ox + x * T, sy = oy + y * T;
    if (c === "#" || c === "W") { const side = (y > 0 && y < mapH - 1) ? (x === 0 ? "left" : x === mapW - 1 ? "right" : undefined) : undefined; ctx.drawImage(Art.interiorWall(c, hash(x, y) % 4, loc, side), sx, sy, T, T); }
    else { ctx.drawImage(Art.interiorFloor(loc, hash(x, y) % 6), sx, sy, T, T); if (c === "r") ctx.drawImage(Art.interiorRug(hash(x, y) % 3), sx, sy, T, T); }
  }
  const ents = [];
  for (let y = 0; y < mapH; y++) for (let x = 0; x < mapW; x++) {
    const c = rows[y][x];
    if ("btcfFkpSqhox".includes(c)) { const spr = Art.interiorObj(c, fr, hash(x + 3, y + 5) % 6); if (spr) ents.push({ y: y + (c === "x" || c === "r" ? 0 : 0.5), draw: () => ctx.drawImage(spr, ox + x * T, oy + y * T, T, T) }); }
    else if ("dai".includes(c)) { const spr = Art.interiorExtra(c, hash(x, y)); ents.push({ y: y + 0.5, draw: () => ctx.drawImage(spr, ox + x * T, oy + y * T, T, T) }); }
    else if (c === "n") {
      // the person who works here, standing behind their own stretch of counter when there is one
      const who = (catalog.keepers || {})[loc], look = (catalog.npcs || {})[who] || ["boy", "white", "none"], counter = rows[y][x - 1] === "S" || rows[y][x + 1] === "S";
      ents.push({ y: y + 0.5, draw: () => {
        const sx = ox + x * T, sy = oy + y * T, bob = Math.floor(now / 900 + x) % 2;
        ctx.drawImage(charSprite(look[0], "down", 0, COLORS[look[1]], look[2]), sx, sy - (16 + bob) * SCALE, T, 48 * SCALE);
        if (counter) { const cs = Art.interiorObj("S", fr, hash(x + 3, y + 5) % 6); if (cs) ctx.drawImage(cs, sx, sy, T, T); }
      } });
    }
  }
  for (const p of state.players) {
    if (!p.online || (p.loc || "farm") !== loc) continue;
    if (p.name === prefs.name) { ents.push({ y: my.y + 0.9, draw: () => drawFarmer(p, my.x, my.y, my.dir, my.stepping ? 1 + Math.floor(my.dist * 4) % 7 : 0, ox, oy, now, heldItem()) }); continue; }
    const v = viz[p.name]; if (!v) continue;
    ents.push({ y: v.y + 0.9, draw: () => drawFarmer(p, v.x, v.y, v.facing, v.moving ? 1 + Math.floor(v.dist * 4) % 7 : 0, ox, oy, now, p.held) });
  }
  ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
  const meP = myPlayer();
  if (meP) { const fx = meP.x + meP.facing[0], fy = meP.y + meP.facing[1], c = (rows[fy] || "")[fx]; if (c && "btcfFkpSqhoxWndai".includes(c)) { ctx.strokeStyle = "rgba(255,250,200," + (0.35 + 0.3 * Math.sin(now / 200)) + ")"; ctx.lineWidth = SCALE; ctx.strokeRect(ox + fx * T + 2 * SCALE, oy + fy * T + 2 * SCALE, T - 4 * SCALE, T - 4 * SCALE); } }
  // warm lamp light and a soft vignette
  const g = ctx.createRadialGradient(ox + mapW * T / 2, oy + mapH * T / 2, T, ox + mapW * T / 2, oy + mapH * T / 2, Math.max(mapW, mapH) * T);
  g.addColorStop(0, "rgba(255,200,120,0)"); g.addColorStop(1, "rgba(20,10,0,.45)"); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
  for (const p of state.players) {
    if (!p.online || (p.loc || "farm") !== loc) continue;
    const v = p.name === prefs.name ? my : viz[p.name]; if (!v) continue;
    const shirt = COLORS[catalog.player_colors[p.color % catalog.player_colors.length]] || "#f4f1ea";
    if (p.bubble) drawSpeech(ox + v.x * T + T / 2, oy + v.y * T - 19 * SCALE, p.bubble, shirt); else if (p.name !== prefs.name) drawTag(ox + v.x * T + T / 2, oy + v.y * T - 18 * SCALE, p.name);
  }
}
function drawFarmer(p, x, y, facing, frame, ox, oy, now, held) {
  const shirt = COLORS[catalog.player_colors[p.color % catalog.player_colors.length]] || "#3fc1e6";
  const sw0 = swings[p.name], carrying = p.carry === "chest";
  const dropping = fxBusy("drop", p.name, now);   // arms stay up while what they just let go is still falling
  const c = charSprite(p.sprite || "boy", facing, frame, shirt, p.hat, carrying || dropping || (plantable(held) && !sw0));
  const sx = Math.round(ox + x * T), sy = Math.round(oy + y * T);
  ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T - 2 * SCALE, 11 * SCALE, 4 * SCALE, 0, 0, 6.3); ctx.fill();
  const sw = swings[p.name];
  const swinging = sw && now - sw.start < 380;
  if (sw && !swinging) delete swings[p.name];
  const showHeld = held && !swinging && !p.fishing && !carrying && !dropping;
  const overhead = carrying || (showHeld && plantable(held));
  if (facing === "up" && !overhead) { if (swinging) drawTool(sw, sx, sy, facing, now); else if (showHeld) drawHeld(held, sx, sy, facing, frame); }
  ctx.drawImage(c, sx, sy - 16 * SCALE, T, 48 * SCALE);
  if (carrying) { if (!fxBusy("lift", p.name, now, "chest") && !dropping) drawCarry(sx, sy, frame); }   // the fx sprite has the chest until it lands
  else if (facing !== "up" || overhead) { if (swinging) drawTool(sw, sx, sy, facing, now); else if (showHeld) drawHeld(held, sx, sy, facing, frame); }
  if (p.fishing) {
    const bx = ox + (p.x + p.facing[0]) * T + T / 2, by = oy + (p.y + p.facing[1]) * T + T / 2 + Math.sin(now / 300) * SCALE;
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = SCALE / 2; ctx.beginPath(); ctx.moveTo(sx + T / 2 + p.facing[0] * 8 * SCALE, sy - 4 * SCALE); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = "#e0524f"; ctx.beginPath(); ctx.arc(bx, by, 3 * SCALE, 0, 6.3); ctx.fill();
  }
}
function drawHeld(key, sx, sy, facing, frame) {
  /* the selected tool or item, gripped in the farmer's near hand; the hand follows the arm swing and body bob of the walk cycle */
  const icon = itemIcon(key, catalog);
  const t = (frame % 8) / 8, sn = Math.sin(t * Math.PI * 2);
  const swing = Math.round(sn * 2), bob = frame % 8 === 0 ? 0 : Math.round(Math.abs(sn) * 2);   // the same maths as farmerSprite
  if (plantable(key)) { const hx = sx + T / 2, hy = sy - 4 * SCALE - bob * SCALE; ctx.drawImage(icon, hx - 11 * SCALE, hy - 24 * SCALE, 22 * SCALE, 22 * SCALE); return; }
  // where the near hand is this frame, in sprite pixels (the 48px sprite is drawn 16px above sy)
  let hx, hy, flip = false, ang = 0;
  if (facing === "down") { hx = 24.5; hy = 31 - swing - bob; ang = 0.22 + 0.10 * sn; }
  else if (facing === "right") { hx = 19 + swing; hy = 31 - bob; ang = 0.32 + 0.14 * sn; }
  else if (facing === "left") { hx = 13 - swing; hy = 31 - bob; flip = true; ang = 0.32 + 0.14 * sn; }
  else { hx = 7.5; hy = 31 + swing - bob; flip = true; ang = 0.15 - 0.08 * sn; }
  hx = sx + hx * SCALE; hy = sy + (hy - 16) * SCALE;
  if (TOOLS.has(key)) {
    // the quarter-turned tool has its grip at the top-left; the fist closes round the handle a little way down from its end
    const size = 28 * SCALE, k = 28 / 32;
    ctx.save(); ctx.translate(hx, hy); if (flip) ctx.scale(-1, 1); ctx.rotate(ang);
    ctx.drawImage(Art.heldTool(key, false), -9.5 * k * SCALE, -9.5 * k * SCALE, size, size);
    ctx.restore();
  } else ctx.drawImage(icon, hx - 8 * SCALE, hy - 9 * SCALE, 16 * SCALE, 16 * SCALE);   // produce rests in the palm
  if (facing !== "up") drawHand(hx, hy);
}
function drawCarry(sx, sy, frame) {
  /* the chest rides overhead in both hands, bobbing with the walk */
  const t = (frame % 8) / 8, sn = Math.sin(t * Math.PI * 2), bob = frame % 8 === 0 ? 0 : Math.round(Math.abs(sn) * 2);
  ctx.drawImage(Art.chestSprite(false), sx + T / 2 - 12 * SCALE, sy - (30 + bob) * SCALE, 24 * SCALE, 24 * SCALE);
}
function fxIcon(item) { return item === "chest" ? Art.chestSprite(false) : item === "sprinkler" ? Art.propSprite("k") : itemIcon(item, catalog); }
function dust(x, y, u) {
  /* a little ring of dust puffing out and fading */
  ctx.fillStyle = "rgba(222,204,166," + (0.6 * (1 - u)).toFixed(3) + ")";
  for (let k = 0; k < 5; k++) {
    const a = k * 1.26 + 0.4, r = (3 + 10 * u) * SCALE;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y - Math.abs(Math.sin(a)) * r * 0.35, (2.6 - 1.8 * u) * SCALE, 0, 6.3); ctx.fill();
  }
}
function drawFx(now, ox, oy) {
  /* objects in flight: a drop falls from the carrier's hands onto its tile and lands with a squash and a puff of dust;
     a lift hops up off the ground into the carrier's hands and (unless it is the chest) shrinks away into the bag */
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i], t = Math.min(1, (now - f.start) / f.dur), icon = fxIcon(f.item), big = f.item === "chest";
    const size = (big ? 24 : 18) * SCALE, tileX = ox + f.x * T + T / 2, tileY = oy + f.y * T + T / 2;
    if (f.kind === "drop") {
      const sx = ox + f.from.x * T + T / 2, sy = oy + f.from.y * T - 30 * SCALE, e = t * t;
      const x = sx + (tileX - sx) * e, y = sy + (tileY - sy) * e - Math.sin(t * Math.PI) * 10 * SCALE;
      if (t < 1) { ctx.drawImage(icon, x - size / 2, y - size / 2, size, size); continue; }
      if (!f.landed) { f.landed = now; sfx("pop"); }
      const u = (now - f.start - f.dur) / 300;
      if (u >= 1) { fxs.splice(i, 1); continue; }
      const seed = !big && f.item !== "sprinkler";
      const squash = u < 0.4 ? 1 - 0.35 * Math.sin(u / 0.4 * Math.PI) : 1, wide = 2 - squash;   // 1 -> 0.65 -> 1
      const alpha = seed ? Math.max(0, 1 - u * 1.8) : (u < 0.5 ? 1 : 0);              // seeds sink into the soil; solid objects hand over to the real sprite
      if (alpha > 0) { ctx.globalAlpha = alpha; ctx.drawImage(icon, tileX - size * wide / 2, tileY + size / 2 - size * squash, size * wide, size * squash); ctx.globalAlpha = 1; }
      dust(tileX, tileY + size / 2, u);
    } else {
      const c = carrierPos(f.who) || { x: f.x, y: f.y }, hx = ox + c.x * T + T / 2, hy = oy + c.y * T - 30 * SCALE;
      const e = 1 - (1 - t) * (1 - t), x = tileX + (hx - tileX) * e, y = tileY + (hy - tileY) * e - Math.sin(t * Math.PI) * 6 * SCALE;
      if (t < 0.45) dust(tileX, tileY + size / 2, t / 0.45);
      if (t < 1) { ctx.drawImage(icon, x - size / 2, y - size / 2, size, size); continue; }
      if (big) { fxs.splice(i, 1); continue; }   // the carry pose takes over
      const u = (now - f.start - f.dur) / 220;
      if (u >= 1) { fxs.splice(i, 1); continue; }
      const s = size * (1 - u); ctx.globalAlpha = 1 - u; ctx.drawImage(icon, hx - s / 2, hy - s / 2, s, s); ctx.globalAlpha = 1;
    }
  }
}
function drawHand(hx, hy) {
  /* a closed fist drawn over the grip so the tool reads as held, not stuck to the sleeve */
  const s = SCALE; hx = Math.round(hx); hy = Math.round(hy);
  ctx.fillStyle = "#2b1f17"; ctx.fillRect(hx - 3 * s, hy - 3 * s, 6 * s, 6 * s);
  ctx.fillStyle = "#f4c9a0"; ctx.fillRect(hx - 2 * s, hy - 2 * s, 4 * s, 4 * s);
  ctx.fillStyle = "#d9a678"; ctx.fillRect(hx - 2 * s, hy + s, 4 * s, s); ctx.fillRect(hx + s, hy - 2 * s, s, 3 * s);
  ctx.fillStyle = "#fbe0c4"; ctx.fillRect(hx - 2 * s, hy - 2 * s, 2 * s, s);
}
function drawTool(sw, sx, sy, facing, now) {
  if (sw.tool === "hand") return;
  const t = Math.min(1, (now - sw.start) / 380);
  const icon = Art.toolSprite(sw.tool);
  const dir = facing === "left" ? -1 : 1;
  const angle = (facing === "left" ? -1 : 1) * (-1.1 + 1.9 * Math.sin(t * Math.PI)) * (facing === "up" ? 0.5 : 1);
  const hx = sx + T / 2 + (facing === "left" ? -10 : facing === "right" ? 10 : 0) * SCALE, hy = sy + 6 * SCALE;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(angle); if (dir < 0) ctx.scale(-1, 1);
  ctx.drawImage(icon, -4 * SCALE, -22 * SCALE, 26 * SCALE, 26 * SCALE);
  ctx.restore();
}
let _ox = 0, _oy = 0;
function drawBubble(x, y, text) {
  ctx.font = "bold " + 4.5 * SCALE + "px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 6 * SCALE, h = 8 * SCALE, r = 3 * SCALE;
  const left = Math.max(2, Math.min(canvas.width - w - 2, x - w / 2)), top = Math.max(2, y - h);
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = SCALE / 2;
  ctx.beginPath(); ctx.moveTo(left + r, top); ctx.arcTo(left + w, top, left + w, top + h, r); ctx.arcTo(left + w, top + h, left, top + h, r);
  ctx.arcTo(left, top + h, left, top, r); ctx.arcTo(left, top, left + w, top, r); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 2 * SCALE, top + h); ctx.lineTo(x, top + h + 3 * SCALE); ctx.lineTo(x + 2 * SCALE, top + h); ctx.fillStyle = "#fff"; ctx.fill();
  ctx.fillStyle = "#3a2a1a"; ctx.fillText(text, left + w / 2, top + h / 2);
}
function drawSpeech(x, y, text, color) {
  /* Stardew-style floating words: the farmer's own colour, dark outline, right above the hat */
  ctx.font = "bold " + 6 * SCALE + "px 'Pixelify Sans', 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  const w = ctx.measureText(text).width;
  const cx = Math.max(w / 2 + 2, Math.min(canvas.width - w / 2 - 2, x));
  ctx.lineJoin = "round"; ctx.lineWidth = 3 * SCALE; ctx.strokeStyle = "rgba(20,14,10,.9)"; ctx.strokeText(text, cx, y);
  ctx.fillStyle = color; ctx.fillText(text, cx, y);
}
function drawTag(x, y, text) {
  ctx.font = "bold " + 4 * SCALE + "px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 4 * SCALE, h = 6 * SCALE;
  ctx.fillStyle = "rgba(40,30,20,.7)"; ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = "#fff4dc"; ctx.fillText(text, x, y - h / 2);
}

$("#menu .xbtn").onclick = () => { if (mode === "fish") endFishing(false); else if (menu && menu.kind === "proposal") { send({ t: "propose_answer", yes: false }); closeMenu(); } else closeMenu(); };
setupLogin();
requestAnimationFrame(render);
window.cozy = { send, openMenu, state: () => state, me: () => me, mode: () => mode, my, setZoom, map: () => curMap(), walkable, catalog: () => catalog, tryStep, fxs,
  dbg: () => ({ my: Object.assign({}, my), cam: Object.assign({}, cam), T, SCALE, zoom, cw: canvas.width, ch: canvas.height, err: window.__renderErr || null }) };
})();
