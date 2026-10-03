/* Cozy Hollow - browser client. Same JSON protocol as the terminal client,
   over a WebSocket. All pixel art lives in art.js (32px tiles). */
"use strict";
(function () {
const $q = {}, $ = (s) => $q[s] || ($q[s] = document.querySelector(s));   // the page's elements don't change, so look each up once
// only touch the page when something actually changed: every write makes the browser redo style and layout, and the HUD is
// refreshed on every update from the server (several a second while anyone walks)
function setText(e, text) { if (e && e.textContent !== text) e.textContent = text; }
function setStyle(e, prop, v) { if (e && e.style[prop] !== v) e.style[prop] = v; }
function setTitle(e, v) { if (e && e.title !== v) e.title = v; }
const hudSig = {};
function changed(key, sig) { if (hudSig[key] === sig) return false; hudSig[key] = sig; return true; }
const Art = window.ART;
const A = Art.A;
const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
let rdpr = dpr;                       // the resolution we draw at: the screen's own, or 1 in smooth mode (see watchFrames)
let zoom = 2, SCALE = Math.round(zoom * rdpr), T = A * SCALE;
const RUN_MULT = 1.65;                // hold Shift to run
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
const my = { ready: false, x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, stepping: false, dir: "down", sentDir: "down", dist: 0, lastSend: 0, lastTurn: 0, lastFace: 0,
  loc: "farm", queued: null, trail: [], route: null, rested: null, stillFor: 0, portalWait: 0, fix: null };
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
let lastDir = null, running = false, runDust = [], lastDust = 0;
const prefs = { name: localStorage.getItem("cozy.name") || "", sprite: localStorage.getItem("cozy.sprite") || "girl",
  color: localStorage.getItem("cozy.color") || "pink", hat: localStorage.getItem("cozy.hat") || "cowboy" };
let gfxPref = "";                       // "" (decide for me), "smooth" (draw at a lower resolution) or "crisp" (always full resolution)
try { gfxPref = localStorage.getItem("cozy.gfx") || ""; } catch (e) { gfxPref = ""; }
if (gfxPref === "smooth") { rdpr = 1; SCALE = Math.round(zoom * rdpr); T = A * SCALE; }
const cowViz = {};            // cow id -> {x, y, tx, ty, f}
let balloonViz = {};          // the floating present, glided between server ticks
const fxs = [];               // objects in flight: lifted off a tile into someone's hands, or dropped onto one
const npcViz = {}, mobViz = {}, critViz = {}, petViz = {}, compViz = {}, chickViz = {};   // things that glide between tiles
const shots = [], poofs = [], stars = [];
let hurtAt = 0, baseFarm = null, baseAreas = null, worldSig = "", minigame = null, musicIdx = 0, wishStar = null;
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
  else if (kind === "pet") { note(659, 0, .12); note(784, .1, .12); note(988, .2, .12); note(1319, .32, .35); }
  else if (kind === "fail") { note(300, 0, .15, "sawtooth", .04); note(220, .12, .25, "sawtooth", .04); }
  else if (kind === "step") { const f = { grass: 140, snow: 120, wood: 210, stone: 260, path: 170, sand: 130, soil: 120, rug: 180 }[arguments[1]] || 160; note(f * (0.9 + Math.random() * 0.2), 0, .05, "sine", .018); }
  else if (kind === "dig") { note(110, 0, .09, "sine", .06); note(90, .04, .1, "triangle", .04); }
  else if (kind === "tink") { note(1400 + Math.random() * 200, 0, .06, "square", .025); note(900, .02, .08, "triangle", .03); }
  else if (kind === "chop") { note(170, 0, .07, "triangle", .07); note(120, .03, .09, "sine", .05); }
  else if (kind === "click") { note(880, 0, .03, "square", .02); }
  else if (kind === "chirp") { note(2400, 0, .04, "sine", .02); note(2900, .05, .05, "sine", .018); note(2600, .12, .04, "sine", .015); }
}
function toggleMusic() {
  if (!audio) return;
  const songs = (me && me.songs) || [];
  if (music && (music.song || songs.length)) {
    if (music.timer) { clearInterval(music.timer); music.pad.stop(); }
    const nxt = music.song ? songs.indexOf(music.song) + 1 : 0;
    stopSong();
    if (nxt < songs.length) { music = { song: songs[nxt] }; playSong(songs[nxt]); toast("\u266a " + songs[nxt].replace(/_/g, " ") + " (M for the next song)", "info"); return; }
    music = null; toast("Music off", "info"); return;
  }
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
function send(m) {
  if (FACE_SEND.has(m.t) && my.ready && !m.f) m.f = my.dir;           // we move freely, so the server learns which way we face as we act
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
}
if (location.hash === "#debug") window.cozyDebug = { handle: (m) => handle(m), state: () => state, me: () => me, viz: () => viz,
  click: (x, y) => clickTile(x, y), parts: () => parts, birds: () => birds, npcViz: () => npcViz,
  bench: (n) => {   // render n frames back to back and report the average milliseconds spent in each part of the frame
    PROF = {}; const t0 = performance.now(); let t = t0;
    for (let i = 0; i < (n || 60); i++) { t += 16.7; profAt = performance.now(); profName = "setup"; renderFrame(t); profMark("flush"); ctx.getImageData(0, 0, 1, 1); profMark("end"); }
    const out = { total: +((performance.now() - t0) / (n || 60)).toFixed(2) }; for (const k in PROF) out[k] = +(PROF[k] / (n || 60)).toFixed(2); PROF = null; return out;
  } };
let PROF = null, profAt = 0, profName = "";
function profMark(name) { if (!PROF) return; const t = performance.now(); PROF[profName] = (PROF[profName] || 0) + t - profAt; profAt = t; profName = name; }   // for testing: feed the client a message by hand
function handle(m) {
  if (m.t === "welcome") {
    lastInv = null;
    if (window.__build && m.build && m.build !== window.__build) { location.reload(); return; }   // the farm was updated: fetch the new game
    window.__build = m.build;
    farmName = m.farm; map = m.map; catalog = m.catalog; buildings = findBuildings(map);
    portals = new Set((catalog.portals || []).map(([l, x, y]) => l + "," + x + "," + y));
    baseFarm = map.slice(); baseAreas = {}; for (const a in (catalog.areas || {})) baseAreas[a] = catalog.areas[a].slice(); worldSig = "";
    for (const d of m.dyn || []) { catalog.areas[d.name] = d.map; baseAreas[d.name] = d.map.slice(); catalog.area_names[d.name] = d.title; }
    noChest = new Set((catalog.no_chest || []).map(([x, y]) => x + "," + y));
    logLines = m.log.slice(-6).map((e) => ({ text: stamp(e.ts) + " " + e.text, style: "log", at: Date.now() }));
    $("#login").classList.add("hidden"); $("#game").classList.remove("hidden");
    fishing = null; if (menu) closeMenu(); if (mode === "chat") closeChat(); my.queued = null;   // a reconnect must not leave a menu, chat box or fish UI stranded
    mode = "play"; renderLog();
    try { document.activeElement && document.activeElement.blur(); canvas.focus(); } catch (e) {}
    toast("Welcome to " + farmName + ", " + m.name + "! H for help, M for music.", "good");
  } else if (m.t === "state") {
    state = m; me = m.me; farmName = m.farm || farmName;
    noticePickups();
    tiles = {};
    for (const k in m.tiles) tiles[k] = m.tiles[k];
    const now = performance.now();
    for (const p of m.players) {
      if (p.name === prefs.name) { reconcile(p, now); continue; }
      const v = viz[p.name] || (viz[p.name] = { x: p.x, y: p.y, tx: p.x, ty: p.y, dist: 0, facing: "down", moving: false, loc: p.loc, path: [] });
      if (v.loc !== (p.loc || "farm")) { v.loc = p.loc || "farm"; v.x = v.tx = p.x; v.y = v.ty = p.y; v.path = []; }
      queueStep(v, p.x, p.y, now);
      v.sfacing = facingName(p.facing); v.off = p.o || null;
    }
    for (const cw of m.cows || []) {
      const v = cowViz[cw.id] || (cowViz[cw.id] = { x: cw.x, y: cw.y, tx: cw.x, ty: cw.y, f: cw.f });
      aim(v, cw.x, cw.y, now); v.f = cw.f;
    }
    applyWorld(m);
    const glide = (store, key, e, loc) => { const v = store[key] || (store[key] = { x: e.x, y: e.y, tx: e.x, ty: e.y, loc, dist: 0 }); if (v.loc !== loc) { v.loc = loc; v.x = v.tx = e.x; v.y = v.ty = e.y; } aim(v, e.x, e.y, now); v.seen = now; return v; };
    for (const n of m.npcs || []) { const v = glide(npcViz, n.n, n, n.loc); v.f = n.f; v.b = n.b; }
    for (const c of m.chickens || []) { const v = glide(chickViz, c.id, c, "farm"); v.f = c.f; }
    for (const pt of m.pets || []) { const v = glide(petViz, pt.owner, pt, pt.loc); v.f = pt.f; }
    for (const pl of m.players) if (pl.companion && pl.online) { const v = glide(compViz, pl.name, pl.companion, pl.companion.loc); v.kind = pl.companion.kind; }
    for (const loc in m.mobs || {}) for (const mb of m.mobs[loc]) { const v = glide(mobViz, mb.id, mb, loc); v.f = mb.f; }
    for (const loc in m.critters || {}) for (const c of m.critters[loc]) { const v = glide(critViz, c.id, c, loc); v.f = c.f; }
    for (const st of [npcViz, chickViz, petViz, compViz, mobViz, critViz]) for (const k in st) if (st[k].seen !== now) delete st[k];
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
    const cur = swings[m.who], wp = state && state.players.find((q) => q.name === m.who), wloc = m.who === prefs.name ? curLoc() : (wp && wp.loc) || "farm";
    if (m.who !== prefs.name || !cur) swings[m.who] = { tool: m.tool, start: performance.now(), x: m.x, y: m.y, item: m.item, who: m.who, loc: wloc };
    else { cur.x = m.x; cur.y = m.y; cur.who = m.who; cur.loc = wloc; if (m.item) cur.item = m.item; if (performance.now() - cur.start > 140) toolImpact(cur); }
  } else if (m.t === "fx") {
    if (!my.ready || curLoc() !== "farm") return;   // only the farm renderer draws (and advances) these
    const from = carrierPos(m.who) || { x: m.x, y: m.y };
    fxs.push({ kind: m.kind, who: m.who, item: m.item, x: m.x, y: m.y, from, start: performance.now(), dur: m.kind === "drop" ? 400 : 360, landed: 0 });
    if (fxs.length > 24) fxs.splice(0, fxs.length - 24);
  } else if (m.t === "open") { if (m.menu === "close") { if (menu && (menu.kind === "proposal" || menu.kind === "list")) closeMenu(); } else openMenu(m.menu, m); }
  else if (m.t === "area") { catalog.areas[m.name] = m.map; baseAreas[m.name] = m.map.slice(); catalog.area_names[m.name] = m.title || m.name; delete _areaBld[m.name]; worldSig = ""; }
  else if (m.t === "star") { stars.push({ id: m.id, x: m.x, y: m.y, dx: m.dx, t0: performance.now() }); if (isOutdoor(curLoc())) { wishStar = { id: m.id, until: performance.now() + 3200 }; $("#wish").classList.remove("hidden"); } }
  else if (m.t === "shot") { if (m.loc === curLoc()) shots.push({ x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1, kind: m.kind, t0: performance.now() }); sfx("pop"); }
  else if (m.t === "poof" || m.t === "pop") { if (m.loc === curLoc()) poofs.push({ x: m.x, y: m.t === "pop" ? m.y - 1.5 : m.y, t0: performance.now(), big: m.kind === "slime_king", pop: m.t === "pop" }); if (m.t === "pop") sfx("coin"); }
  else if (m.t === "ouch") { hurtAt = performance.now(); sfx("fail"); }
  else if (m.t === "petdrop") {   // a rare pet turned up: sparkles and hearts where it appeared, and a little fanfare for the lucky farmer
    if (m.loc === curLoc()) {
      const x = m.x + 0.5, y = m.y + 0.6;
      spawn({ kind: "ring", x, y, loc: m.loc, layer: "ground", col: "rgba(255,240,160,.95)", life: 900, r: 0.9 });
      burst(14, { kind: "star", x, y, loc: m.loc, col: ["#fff2a0", "#ffffff", "#ffd84a", "#ffb0d0"], life: 1200, size: 1.4, g: 2 }, { up: 3, speed: 1.4, r: 0.6 });
      for (let i = 0; i < 3; i++) spawn({ kind: "heart", x: x + (i - 1) * 0.35, y: y - 0.4, z: 0.5, vz: 1.6 + i * 0.3, g: 1.2, loc: m.loc, col: "#ff6b9d", life: 1300 });
    }
    if (m.who === prefs.name) sfx("pet");
  }
  else if (m.t === "minigame") startMinigame(m.game, m.seed);
  else if (m.t === "song") playSong(m.song);
  else if (m.t === "fish_bite") { startFishing(m); if (my.ready) { const [dx, dy] = DELTA[my.dir], bx = my.tx + dx + 0.5, by = my.ty + dy + 0.5; spawn({ kind: "ring", x: bx, y: by, loc: curLoc(), layer: "ground", col: "rgba(230,248,255,.95)", life: 700, r: 0.6 }); burst(6, { x: bx, y: by, loc: curLoc(), col: ["#bfeaff", "#ffffff"], life: 500, size: 1.2, g: 10 }, { up: 2.4, speed: 1 }); } }
  else if (m.t === "error") { if (/another window/.test(m.text)) kicked = true; toast(m.text, "warn"); addLog(m.text, "warn"); }
}
function placeAt(p) {
  const o = p.o || [0, 0];
  my.loc = p.loc || "farm"; my.tx = p.x; my.ty = p.y; my.x = p.x + o[0]; my.y = p.y + o[1]; my.vx = my.vy = 0; my.fix = null;
  my.dir = my.sentDir = facingName(p.facing); my.trail.length = 0; my.route = null; my.portalWait = 0; my.rested = o[0] + "," + o[1];
}
function reconcile(p, now) {
  if (!my.ready) { my.ready = true; placeAt(p); cam.x = p.x + 0.5; cam.y = p.y + 0.5; cam.snap = true; return; }
  if ((p.loc || "farm") !== my.loc) {
    const from = my.loc; placeAt(p); cam.snap = true; fadeIn();
    if (isOutdoor(my.loc) && isOutdoor(from) && catalog.area_names) areaBanner = { text: catalog.area_names[my.loc].replace(/^the /, "The "), at: performance.now() };
    return;
  }
  if (my.portalWait && now - my.portalWait > 1500) { my.portalWait = 0; fadeIn(); }   // the door didn't open (a locked mine floor...): carry on
  // the server may still be a few steps behind us (over the internet a reply can take a while): if where it has us is a tile
  // we walked through recently, it's just catching up, so keep walking. Only a position off our path (a step it refused, a
  // push, a teleport), or one that hasn't caught up a good while after our last step, puts us back where it says.
  if (p.x === my.tx && p.y === my.ty) { my.trail.length = 0; return; }
  const behind = my.trail.includes(p.x + "," + p.y) && now - my.lastSend < 1500;
  if (behind) return;
  const o = p.o || [0, 0];
  my.tx = p.x; my.ty = p.y; my.trail.length = 0; my.route = null; my.vx = my.vy = 0;
  if (Math.hypot(my.x - p.x, my.y - p.y) > 2.5) { my.x = p.x + o[0]; my.y = p.y + o[1]; my.fix = null; }
  else my.fix = { x: p.x + o[0], y: p.y + o[1] };                   // a small correction: glide there instead of jumping
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
function applyWorld(m) {
  const sig = JSON.stringify([m.edits || {}, m.xb || {}, m.xp || []]);
  if (sig === worldSig || !baseFarm) return;
  worldSig = sig;
  const lay = (rows, ed) => { const g = rows.map((r) => r.split("")); for (const k in ed) { const [x, y] = k.split(",").map(Number); if (g[y] && x < g[y].length) g[y][x] = ed[k]; } return g.map((r) => r.join("")); };
  map = lay(baseFarm, (m.edits || {}).farm || {});
  for (const a in baseAreas) catalog.areas[a] = lay(baseAreas[a], (m.edits || {})[a] || {});
  buildings = findBuildings(map);
  for (const k in _areaBld) delete _areaBld[k];
  portals = new Set((catalog.portals || []).concat(m.xp || []).map(([l, x, y]) => l + "," + x + "," + y));
}
function extraBuildings(loc) { return ((state && state.xb && state.xb[loc]) || []).map((b) => ({ kind: b.kind, label: b.label, x0: b.x, y0: b.y, x1: b.x + b.w - 1, y1: b.y + b.h - 1 })); }
function buildingAt(x, y) { for (const b of buildings) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return b; return null; }
function walkable(x, y) {
  const rows = curMap(), loc = curLoc();
  if (y < 0 || y >= rows.length || x < 0 || x >= rows[0].length) return false;
  for (const k in npcViz) { const v = npcViz[k]; if (v.loc === loc && v.tx === x && v.ty === y) return false; }
  if (isArea(loc)) { const t = areaTiles(loc)[x + "," + y]; return AREA_WALK.includes(rows[y][x]) && !(t && (t.o || t.m)); }
  if (loc !== "farm") { const ch = rows[y][x]; return ch === "." || ch === "r" || ch === "x"; }
  if (!".:,fGdH".includes(rows[y][x])) return false;
  if (state && state.cows && state.cows.some((cw) => cw.x === x && cw.y === y)) return false;
  if (state && state.chickens && state.chickens.some((c) => c.x === x && c.y === y)) return false;
  if (chestAt(x, y)) return false;
  const d = tiles[x + "," + y];
  return !(d && (d.t || d.m));
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
  setText($("#farm-name"), farmName);
  setText($("#season"), st.season[0].toUpperCase() + st.season.slice(1) + ", day " + st.day + " (year " + st.year + ")");
  setText($("#clock"), skyLabel(hourNow()));
  setText($("#weather"), { sun: "Sunny", rain: "Raining", snow: "Snowing" }[st.weather]);
  if (coinTarget !== null && st.coins !== coinTarget) { const c = $("#coins"); c.classList.remove("up", "down"); void c.offsetWidth; c.classList.add(st.coins > coinTarget ? "up" : "down"); }
  coinTarget = st.coins;
  setText($("#online"), st.players.filter((p) => p.online).length + " online");
  if (me) {   // the little green farming xp bar under the tool bar
    const lo = 60 * me.level * me.level, hi = me.next_xp;
    const max = me.level >= (catalog.max_level || 1000) || hi == null || hi <= lo || me.xp >= hi;   // level 1000: nothing left to fill
    const pct = max ? 1 : Math.max(0, Math.min(1, (me.xp - lo) / (hi - lo)));
    const bar = $("#xpbar");
    setStyle($("#xpbar .fill"), "width", (pct * 100).toFixed(1) + "%");
    setText($("#xpbar .label"), "Lv" + me.level + " " + me.title + " · " + (max ? "MAX" : Math.max(0, me.xp - lo) + " / " + (hi - lo) + " xp"));
    setTitle(bar, me.next_unlock ? "Next - " + me.next_unlock : "farming experience");
    if (lastXp != null && me.xp > lastXp) { bar.classList.add("gain"); setTimeout(() => bar.classList.remove("gain"), 700); }
    lastXp = me.xp;
  }
  const ul = $("#farmers ul"), online = st.players.filter((p) => p.online).sort((a, b) => a.name.localeCompare(b.name));
  if (changed("farmers", JSON.stringify(online.map((p) => [p.name, p.level, p.title, p.spouse, p.sprite, p.color, p.hat])))) ul.innerHTML = "";
  if (!ul.firstChild) online.forEach((p) => {
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
        const tier = me.tool_lv && me.tool_lv[k] ? ["", "Copper ", "Iron ", "Golden "][me.tool_lv[k]] : "";
        d.title = tier + (it ? it.name : k) + (it && it.verb ? " - " + it.verb : "");
        d.onclick = () => send({ t: "select", i });
      }
      slots.appendChild(d);
    }
  }
  if (me) setText($("#can-top"), "Can " + me.water + "/" + (me.can_cap || catalog.can) + " · Lv" + me.level);
  if (me) { const bf = $("#buffs"), names = { speed: "\u26a1 Quick feet", luck: "\u2618 Lucky", angler: "\ud83c\udfa3 Steady hands", strength: "\u2694 Strong" }; if (changed("buffs", JSON.stringify(me.buffs || {}))) { bf.innerHTML = ""; for (const k in me.buffs || {}) bf.appendChild(el("span", null, names[k] + " " + fmt(me.buffs[k]))); } }
  const rv = st.revival;
  if (rv && changed("revival", JSON.stringify(rv))) {   // the shared Valley Revival meter
    const fl = $("#revival .flowers"); fl.innerHTML = "";
    for (let i = 1; i <= 4; i++) fl.appendChild(el("i", i <= rv.stage ? "on" : "", "\u2740"));
    $("#revival .stage").textContent = rv.name;
    $("#revival .fill").style.width = (rv.next ? Math.min(1, rv.met / rv.need) * 100 : 100).toFixed(0) + "%";
    $("#revival .next").textContent = rv.next ? Math.min(rv.met, rv.need) + " of " + rv.need + " threads towards " + rv.next : "In Bloom - thank you, everyone!";
  }
  const q = st.quest;
  setText($("#quest p"), q ? q.who + " needs " + q.n + " " + catalog.items[q.item].name + " for " + q.reason + ". Reward " + q.reward + "g. (you have " + countItem(q.item) + ")" : "Nothing on the board right now.");
  setText($("#here"), describeHere());
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
  let ahead = aheadExtra(loc, fx, fy) || "";
  const portal = portals.has(loc + "," + fx + "," + fy);
  if (ahead) {}
  else if (fd.g || hd.g) ahead = catalog.items[fd.g || hd.g].name + " - E to pick.";
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
function meNow() {
  /* our player as the server sees it, but standing on our own tile and facing our own way */
  const p = myPlayer();
  return p && my.ready ? Object.assign({}, p, { x: my.tx, y: my.ty, facing: DELTA[my.dir], loc: my.loc }) : p;
}
function describeHere() {
  const p = meNow(); if (!p || !catalog) return "";
  if (isArea(p.loc || "farm")) return describeArea(p);
  if ((p.loc || "farm") !== "farm") {
    const rows = catalog.interiors[p.loc], fx = p.x + p.facing[0], fy = p.y + p.facing[1], ch = (rows[fy] || "")[fx] || "#";
    const keeper = (catalog.keepers || {})[p.loc];
    const who = aheadExtra(p.loc, fx, fy), room = (catalog.rooms || {})[p.loc] || "the " + p.loc;
    if (who && !(keeper && who.startsWith(keeper))) return "Inside " + room + ". Ahead: " + who;
    if (keeper) {
      const what = ch === "n" || ch === "S" ? keeper + " - E to talk" + (p.loc === "store" ? " and shop." : ".") : ch === "x" ? "The door - walk onto it to go outside." : (catalog.interior_names[ch] || "").replace(/^./, (c) => c.toUpperCase());
      return "Inside " + room + ". Ahead: " + what;
    }
    const nm = catalog.interior_names[ch] || "";
    const hint = { c: " - E opens the shared chest.", S: " - E to shop.", q: " - E to shop.", k: " - E for the journal.", x: " - walk onto it to go outside." }[ch] || "";
    return "Inside " + room + ". Ahead: " + nm.replace(/^./, (c) => c.toUpperCase()) + hint;
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
  let ahead = aheadExtra("farm", fx, fy) || "";
  if (ahead) {}
  else if (ft === "S") ahead = "Shop - E to browse seeds."; else if (ft === "$") ahead = "Shipping bin - E to sell.";
  else if (ft === "!") ahead = "Notice board - E to read the request."; else if (ft === "+") ahead = "Farmhouse - E for the farm journal.";
  else if (ft === "~") ahead = "Pond - E refills the can, F goes fishing."; else if (ft === "w") ahead = "Well - E refills the can.";
  else if (ft === "m") ahead = "Mailbox - E to read your letters."; else if (ft === "N") ahead = "Barn - E to open the shared storage.";
  else if (chestAt(fx, fy)) ahead = "Storage chest - E to open it, X to pick it up. Everyone on the farm shares what is inside.";
  else if (ft === "Y") ahead = "Father TongTong - E to say hello" + (me && !me.inventory.some(([k]) => k === "valley_map") ? " (he has a map for you)." : ".");
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
  if (k === "list" || k === "mg") return null;

  if (k === "barn") { const mp = myPlayer(); return JSON.stringify([state.storage, inv, !!(mp && (mp.loc || "farm") === "farm" && chestAt(mp.x + mp.facing[0], mp.y + mp.facing[1]))]); }
  return null;
}
function closeMenu() { menu = null; if (mode === "menu" || mode === "minigame") mode = "play"; minigame = null; $("#menu").classList.add("hidden"); canvas.focus(); }
function iconEl(key) { const c = document.createElement("canvas"); c.width = 32; c.height = 32; const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(itemIcon(key, catalog), 0, 0); return c; }
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function blurb(key) {
  const it = catalog.items[key];
  if (it.kind === "seed") { const c = catalog.crops[it.crop]; return "Grows in " + fmt(c.grow) + " (" + fmt(c.grow / catalog.water_mult) + " watered), sells " + c.sell + "g" + (c.regrow ? ", regrows every " + fmt(c.regrow) : "") + ". Seasons: " + c.seasons.join(", ") + "."; }
  if (it.kind === "sapling") { const t = catalog.trees[it.tree];
    if (t.rare) return "A legendary seed - one crop in a million drops one. Grows into a " + t.name + " in " + fmt(t.mature) + ". Plant it in a tree spot in the orchard meadow.";
    return "Matures in " + fmt(t.mature) + ", then a " + t.name + " (" + t.fruit_sell + "g) every " + fmt(t.fruit_every) + ". Plant it in a tree spot in the orchard meadow (south of the fields)."; }
  if (key === "fertilizer") return "Use on tilled soil: +50% growth until the crop is harvested.";
  if (key === "sprinkler") return "Place on a tile: keeps the 8 tiles around it watered forever.";
  if (key === "cow") return "A cow for the pasture by the barn. Gives milk (45g) every 4 hours. Up to " + catalog.max_cows + " cows.";
  if (it.info) return it.info;
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
    const myLv = me ? me.level : 0;
    d.stock.forEach(([key, price, need], i) => {
      const locked = (need || 0) > myLv;
      const row = itemRow(key, el("span", "price", locked ? "Lv" + need : price + "g"), () => { menu.cursor = i; renderMenu(); });
      if (locked) { row.classList.add("locked"); row.title = "Opens at level " + need; }
      if (i === menu.cursor && locked) { row.classList.add("selected"); row.appendChild(el("div", "blurb", "Opens at level " + need + " - you're level " + myLv + ". " + blurb(key))); row.style.flexWrap = "wrap"; }
      else if (i === menu.cursor) {
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
    const fb = el("button", null, "Friends in the valley"); fb.onclick = () => send({ t: "friends" }); body.appendChild(fb);
    const sb = el("button", null, "The scrapbook"); sb.style.marginLeft = "8px"; sb.onclick = () => send({ t: "scrapbook" }); body.appendChild(sb);
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
      if (key === "valley_map") { const b = el("button", "small", "Open"); b.onclick = (e) => { e.stopPropagation(); closeMenu(); if (!mapOpen) openMap(); }; row.appendChild(b); }
      if (["food", "fruit", "crop", "forage", "artisan"].includes(catalog.items[key].kind)) { const b = el("button", "small", "Eat"); b.onclick = (e) => { e.stopPropagation(); send({ t: "eat", item: key }); }; row.appendChild(b); }
      row.appendChild(el("div", "blurb", blurb(key))); row.style.flexWrap = "wrap"; body.appendChild(row);
    });
    foot.textContent = "Click something to hold it. Esc closes.";
  } else if (k === "help") {
    h2.textContent = "How to farm";
    body.innerHTML = "<p><kbd>WASD</kbd> or arrows to walk. You act on the tile you stand on; the pond, shop, bin, board, well, mailbox and trees are used by facing them (they glow).</p>" +
      "<p><kbd>E</kbd> or <kbd>Space</kbd> does the natural thing: till grass, plant the seed in hand, water, harvest, pick forage, refill the can at the pond or well, open the shop / bin / board.</p>" +
      "<p><kbd>F</kbd> fishes when facing the pond: keep the fish inside your net with <kbd>&larr;</kbd> <kbd>&rarr;</kbd> or the mouse.</p>" +
      "<p><kbd>X</kbd> clears the tile you stand on, or picks up the storage chest you face (carry it and press <kbd>E</kbd> to set it down). <kbd>1</kbd>-<kbd>9</kbd> pick what you hold, <kbd>I</kbd> opens the bag, <kbd>J</kbd> the journal, <kbd>L</kbd> your quest log, <kbd>K</kbd> the Valley Book, <kbd>P</kbd> your pets (rare ones turn up all by themselves, once in a long while, as you fish, mine, forage, harvest, cook and adventure), <kbd>N</kbd> the valley map (Father TongTong gives you one), <kbd>T</kbd> chats, <kbd>M</kbd> music (and the songs Rowan teaches you), <kbd>+</kbd>/<kbd>-</kbd> zoom, <kbd>G</kbd> smooth or crisp graphics. Hold <kbd>Shift</kbd> while you walk to run. You can walk in any direction (two keys at once for diagonals). Click anywhere to walk there; click something (a crop, a villager, a door, a field while you hold the hoe) to walk over and use it.</p>" +
      "<p>Explore the valley: walk off the farm's paths west to <b>Hollow Town</b> (shops, saloon, museum, folks to talk to), north to <b>Summit Ridge</b> and its <b>mine</b> (break ore and gems with the pickaxe, ladders go deeper), south to the <b>Whisperwood</b>. From town go south to <b>Driftwood Beach</b>, where a boat at the pier sails to <b>Palm Isle</b>; the stagecoach in town rides to <b>Dusty Gulch</b>. Fish in rivers, lakes and the sea, and forage what each place grows.</p>" +
      "<p><b>Folks and festivals.</b> Villagers walk to work, the shops and home on the clock. Face one and press <kbd>E</kbd> to chat; press it again holding something to give it as a gift (everyone has favourites). On festival days the town square fills up: talk to Mayor Hazel for the line dance, the rodeo, the livestock fair, Fallfest, the fishing derby or the winter feast. The <b>Town Hall</b> takes donations for projects that grow the town and bring new neighbours.</p>" +
      "<p><b>Quests and levels.</b> A <b>!</b> over a villager means they have a favor to ask or a story to share; a <b>?</b> means you have what they asked for. <kbd>L</kbd> shows your quest log and what your next level unlocks. Levels open new seeds, saplings, recipes and deeper mine floors, and fruit trees grow only in the marked tree spots in the orchard meadow south of the fields - more spots open as you level.</p>" +
      "<p><b>Things worth saving for.</b> Ingrid upgrades your hoe and watering can (they work a row, then a square); Oakley builds farm expansions, a farmhouse kitchen and cellar, a bigger coop and barn, and sells furniture once the valley is Bustling; the Town Hall has big projects like the Minecart Line and the Observatory. <code>/ledger</code> shows where the farm's coins come from and go.</p>" +
      "<p><b>The Valley Revival.</b> Everyone on the farm brings Cozy Hollow back to life together: town projects, the museum, friendships, festivals, shipping new kinds of crop and exploring all move the meter (side panel, or <kbd>K</kbd>). Each stage changes the town; the last one is the Valley Bloom Festival.</p>" +
      "<p><b>Making things.</b> <kbd>C</kbd> crafts at a crafting table (or anywhere with a toolbelt): machines like the cheese press, preserves jar, bee house and rock tumbler, animal traps, path stones and bridges. Cook at the farmhouse fireplace, and <kbd>U</kbd> eats what you hold for health and a little boost. The tailoring table sews hats.</p>" +
      "<p><b>Animals.</b> Oakley builds a coop once the town project is done; buy chickens at the seed shop and collect eggs. Adopt a dog or cat at the clinic and buy a horse in Dusty Gulch - <kbd>R</kbd> hops on.</p>" +
      "<p><b>Adventure.</b> Monsters live in the mine: hold a sword, slingshot, bow or rifle and press <kbd>E</kbd>. A monster treat may tame a weakened one. The ladder at the bottom of the mine leads to the endless Depths. Hunt game in the wild and take it to Hank the butcher. Catch bugs with a net, dig up fossils with the hoe and donate them to the museum. At night, press <kbd>V</kbd> to wish on a shooting star; shoot down balloon presents with a slingshot; a mystery ticket sails the boat to a new island.</p>" +
      "<p>Crops grow in real time even when nobody is here. Wet soil grows 3x faster for 4 hours; rain waters everything; sprinklers keep their 8 neighbours wet. Coins are shared.</p>" +
      "<p>Chat commands: <code>/ping@all [msg]</code> says hi on every terminal of this account, <code>/look boy|girl</code>, <code>/color pink</code>, <code>/farm name</code>, <code>/give player item n</code>, <code>/me action</code>.</p>" +
      "<p>Friends can join from a browser at this address, or the host runs <code>python3 farm.py share</code> to invite other computers.</p>";
  } else if (k === "fish") renderFishing();
  else if (k === "list") renderList(d, h2, body, foot);
  else if (k === "mg") {
    h2.textContent = { dance: "Line Dance", rodeo: "Bull Ride", apples: "Bob for Apples" }[d.game] || "Festival";
    const box = el("div", "mg"); const cv = document.createElement("canvas"); cv.width = 360; cv.height = 220; box.appendChild(cv); box.appendChild(el("div", "mgs", ""));
    body.appendChild(box); mgKick(); foot.textContent = d.game === "dance" ? "Arrow keys (or WASD) when each arrow reaches the line. Esc stops." : d.game === "rodeo" ? "\u2190 \u2192 to lean against the bull. Esc jumps off." : "Space or E to bob. Esc gives up.";
  }
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
  running = e.shiftKey;
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
  if (mode === "minigame") { mgKey(e); return; }
  if (mode === "menu" && menu && menu.kind === "list" && e.key !== "Escape") { listKeys(e); return; }
  if (mode === "menu") {
    if (e.key === "Escape" || e.key === "i" || e.key === "I" || (menu && menu.kind === "help" && (e.key === "?" || e.key === "h" || e.key === "H")) || (menu && menu.kind === "journal" && (e.key === "j" || e.key === "J"))) { if (menu && menu.kind === "proposal") send({ t: "propose_answer", yes: false }); closeMenu(); }
    if (menu && menu.kind === "shop") {
      if (e.key === "ArrowDown") { menu.cursor = (menu.cursor + 1) % menu.data.stock.length; renderMenu(); e.preventDefault(); }
      if (e.key === "ArrowUp") { menu.cursor = (menu.cursor - 1 + menu.data.stock.length) % menu.data.stock.length; renderMenu(); e.preventDefault(); }
      if (e.key === "ArrowRight" || e.key === "+" || e.key === "=") { menu.qty = Math.min(99, menu.qty + 1); renderMenu(); }
      if (e.key === "ArrowLeft" || e.key === "-") { menu.qty = Math.max(1, menu.qty - 1); renderMenu(); }
      if (e.key === "Enter") { const [key, , need] = menu.data.stock[menu.cursor]; if ((need || 0) <= (me ? me.level : 0)) send({ t: "buy", item: key, n: menu.qty }); }
    }
    if (menu && menu.kind === "board" && e.key === "Enter") send({ t: "deliver" });
    return;
  }
  if (e.key === "Escape" && mapOpen) { closeMap(); return; }
  if (DIRS[e.key]) { const dir = DIRS[e.key]; held.add(dir); lastDir = dir; e.preventDefault(); }
  else if (e.key === "e" || e.key === "E" || e.key === " " || e.key === "Enter") {
    const tool = heldItem(), mp = myPlayer();
    if (tool && TOOLS.has(tool) && tool !== "fishing_rod") swings[prefs.name] = { tool, start: performance.now() };
    send({ t: "interact" }); e.preventDefault();
  }
  else if (e.key === "f" || e.key === "F") send({ t: "fish_start" });
  else if (e.key === "u" || e.key === "U") send({ t: "eat" });
  else if (e.key === "n" || e.key === "N") openMap();
  else if (e.key === "l" || e.key === "L") send({ t: "quests" });
  else if (e.key === "k" || e.key === "K") send({ t: "book" });
  else if (e.key === "p" || e.key === "P") send({ t: "pets" });
  else if (e.key === "r" || e.key === "R") send({ t: "ride" });
  else if (e.key === "c" || e.key === "C") send({ t: "craft_open" });
  else if (e.key === "v" || e.key === "V") wish();
  else if (e.key === "x" || e.key === "X") send({ t: "clear" });
  else if (/^[1-9]$/.test(e.key)) send({ t: "select", i: parseInt(e.key, 10) - 1 });
  else if (e.key === "Tab") { if (me && me.inventory.length) send({ t: "select", i: (me.selected + 1) % me.inventory.length }); e.preventDefault(); }
  else if (e.key === "t" || e.key === "T") { openChat(""); e.preventDefault(); }
  else if (e.key === "/") { openChat(""); e.preventDefault(); }
  else if (e.key === "i" || e.key === "I") openMenu("bag", {});
  else if (e.key === "j" || e.key === "J") send({ t: "journal" });
  else if (e.key === "?" || e.key === "h" || e.key === "H") openMenu("help", {});
  else if (e.key === "m" || e.key === "M") toggleMusic();
  else if (e.key === "g" || e.key === "G") toggleGfx();
  else if (e.key === "+" || e.key === "=" || e.code === "Equal" || e.code === "NumpadAdd") setZoom(zoom + 1);
  else if (e.key === "-" || e.key === "_" || e.code === "Minus" || e.code === "NumpadSubtract") setZoom(zoom - 1);
});
window.addEventListener("keyup", (e) => { running = e.shiftKey; if (DIRS[e.key]) held.delete(DIRS[e.key]); });
window.addEventListener("blur", () => { held.clear(); running = false; });
document.addEventListener("visibilitychange", () => { if (!document.hidden) { cam.snap = true; lastFrame = performance.now(); } });
function setZoom(z) { zoom = Math.max(1, Math.min(4, z)); SCALE = Math.round(zoom * rdpr); T = A * SCALE; cam.snap = true; }
function openChat(prefill) { mode = "chat"; held.clear(); $("#chatbox").classList.remove("hidden"); $("#hint").classList.add("hidden"); const i = $("#chat"); i.value = prefill; i.focus(); }
function closeChat() { mode = "play"; $("#chatbox").classList.add("hidden"); $("#hint").classList.remove("hidden"); $("#chat").blur(); canvas.focus(); }
function submitChat() {
  const text = $("#chat").value.trim(); closeChat(); if (!text) return;
  if (text.toLowerCase().startsWith("/ping")) { const parts = text.split(/\s+/); send({ t: "ping", text: parts.slice(1).join(" ") || "hi" }); return; }
  send({ t: "chat", text });
}
let clickMark = null, hoverTile = null, hoverAt = 0;
canvas.addEventListener("mousemove", (e) => {
  if (!my.ready || mode !== "play") { hoverTile = null; return; }
  const r = canvas.getBoundingClientRect(), tx = Math.floor(((e.clientX - r.left) * rdpr - _ox) / T), ty = Math.floor(((e.clientY - r.top) * rdpr - _oy) / T);
  if (!hoverTile || hoverTile.x !== tx || hoverTile.y !== ty) { hoverTile = { x: tx, y: ty, use: usable(tx, ty) }; canvas.style.cursor = hoverTile.use ? "pointer" : "default"; }
  hoverAt = performance.now();
});
canvas.addEventListener("mouseleave", () => { hoverTile = null; canvas.style.cursor = "default"; });
function drawHover(ox, oy, now) {
  if (!hoverTile || now - hoverAt > 2500) return;
  const a = Math.min(1, (2500 - (now - hoverAt)) / 500) * (hoverTile.use ? 0.55 : 0.28), x = ox + hoverTile.x * T, y = oy + hoverTile.y * T, c = 3 * SCALE;
  ctx.strokeStyle = "rgba(255,250,220," + a.toFixed(3) + ")"; ctx.lineWidth = SCALE;
  for (const [ax, ay, dx, dy] of [[x, y, 1, 1], [x + T, y, -1, 1], [x, y + T, 1, -1], [x + T, y + T, -1, -1]]) { ctx.beginPath(); ctx.moveTo(ax + dx * c * 2, ay); ctx.lineTo(ax, ay); ctx.lineTo(ax, ay + dy * c * 2); ctx.stroke(); }
}
function usable(x, y) {
  /* is there something on this tile to use (rather than a place to walk to)? */
  const loc = curLoc(), d = (isArea(loc) ? areaTiles(loc) : tiles)[x + "," + y] || {};
  if (!walkable(x, y)) return true;
  if (d.c || d.g || d.t || d.m || d.o) return true;
  const sel = heldItem(), it = sel && catalog.items[sel], ch0 = (curMap()[y] || "")[x];
  if (loc === "farm" && ((sel === "hoe" && ch0 === "d" && !d.s) || (sel === "watering_can" && d.s && !d.w) || (it && it.kind === "seed" && d.s && !d.c))) return true;   // click a field with a tool: go and use it
  if ((state.npcs || []).some((n) => n.loc === loc && n.x === x && n.y === y)) return true;
  const ch = (curMap()[y] || "")[x];
  return !!ch && "~!wmIEFJLOgVQUDBchbljMXy$S".includes(ch);
}
canvas.addEventListener("click", (e) => {
  if (mode === "chat") closeChat();
  canvas.focus();
  if (mode !== "play" || !my.ready) return;
  const r = canvas.getBoundingClientRect(), mx = (e.clientX - r.left) * rdpr, my_ = (e.clientY - r.top) * rdpr;
  clickTile(Math.floor((mx - _ox) / T), Math.floor((my_ - _oy) / T));
});
function clickTile(tx, ty) {
  const dx = tx - my.tx, dy = ty - my.ty;
  clickMark = { x: tx, y: ty, t0: performance.now() };
  if (dx === 0 && dy === 0) { send({ t: "interact" }); return; }
  const something = usable(tx, ty);
  if (Math.abs(dx) + Math.abs(dy) === 1 && something) {      // right beside us: turn and use it
    my.dir = dx < 0 ? "left" : dx > 0 ? "right" : dy < 0 ? "up" : "down";
    my.sentDir = my.dir; send({ t: "face", dx, dy }); my.route = null;
    setTimeout(useAhead, 40);
    return;
  }
  if (!routeTo(tx, ty, something)) { clickMark.bad = true; sfx("fail"); }
}

// ------------------------------------------------------------------ moving freely (like Stardew or Animal Crossing)
// The farmer glides anywhere, in eight directions, easing in and out; the feet slide along walls and are nudged round corners and
// into doorways. The server still thinks in tiles: whenever the tile under our feet changes we tell it (with the way we face),
// and when we come to rest inside a tile we tell it where, so everyone else sees us standing just there.
const HIT = { l: 0.2, r: 0.8, t: 0.55, b: 0.95 };          // the feet's box, inside the tile the farmer is drawn on
const ACCEL = 24, DECEL = 30;                              // how quickly we reach full speed and stop (per second, eased)
const FACE_SEND = new Set(["interact", "fish_start", "clear", "eat"]);
function footTile(x, y) { return [Math.floor(x + 0.5), Math.floor(y + 0.75)]; }
function boxSpan(x, y) { return [Math.floor(x + HIT.l), Math.floor(x + HIT.r - 1e-6), Math.floor(y + HIT.t), Math.floor(y + HIT.b - 1e-6)]; }
function overlapped(x, y) { const [x0, x1, y0, y1] = boxSpan(x, y), out = new Set(); for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) out.add(tx + "," + ty); return out; }
function boxFree(x, y, inside) {
  /* can the feet stand here? (tiles we're already overlapping never stop us, so a villager stepping on our toes can't trap us) */
  const [x0, x1, y0, y1] = boxSpan(x, y);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (!inside.has(tx + "," + ty) && !walkable(tx, ty)) return false;
  return true;
}
function slideAxis(axis, amount, inside, assist) {
  /* move along one axis as far as the feet can go; if a wall stops us but a gap is just beside us, ease sideways into it */
  if (!amount) return 0;
  const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.2)), part = amount / steps;
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    const nx = axis === "x" ? my.x + part : my.x, ny = axis === "y" ? my.y + part : my.y;
    if (boxFree(nx, ny, inside)) { my.x = nx; my.y = ny; moved += part; continue; }
    // flush against the wall
    let lo = 0, hi = 1;
    for (let k = 0; k < 6; k++) { const mid = (lo + hi) / 2; if (boxFree(axis === "x" ? my.x + part * mid : my.x, axis === "y" ? my.y + part * mid : my.y, inside)) lo = mid; else hi = mid; }
    if (axis === "x") my.x += part * lo; else my.y += part * lo;
    moved += part * lo;
    if (assist) {
      // corner help: the lane beside us (to the nearest tile line) is open, so slide toward it
      const other = axis === "x" ? "y" : "x", cur = other === "y" ? my.y : my.x, lane = Math.round(cur), gap = lane - cur;
      const tryX = axis === "x" ? my.x + Math.sign(part) * 0.05 : lane, tryY = axis === "y" ? my.y + Math.sign(part) * 0.05 : lane;
      if (Math.abs(gap) > 0.01 && Math.abs(gap) < 0.48 && boxFree(tryX, tryY, inside)) {
        const step = Math.sign(gap) * Math.min(Math.abs(gap), Math.abs(amount) * 0.9);
        if (boxFree(other === "x" ? my.x + step : my.x, other === "y" ? my.y + step : my.y, inside)) { if (other === "x") my.x += step; else my.y += step; }
      }
    }
    return moved;
  }
  return moved;
}
function sendMove(dx, dy, now) {
  my.trail.push(my.tx + "," + my.ty); if (my.trail.length > 24) my.trail.shift();
  my.tx += dx; my.ty += dy; my.lastSend = now; my.sentDir = my.dir; my.rested = null;
  send({ t: "move", dx, dy, f: my.dir });
}
function updateSelf(dt, now) {
  if (!my.ready) return;
  if (state && state.wedding) { my.vx = my.vy = 0; my.stepping = false; return; }
  const loc = curLoc();
  if (my.fix) {
    const dx = my.fix.x - my.x, dy = my.fix.y - my.y, d = Math.hypot(dx, dy), st = 9 * dt;
    if (d <= st) { my.x = my.fix.x; my.y = my.fix.y; my.fix = null; } else { my.x += dx / d * st; my.y += dy / d * st; my.dist += st; my.stepping = true; return; }
  }
  // where we're asked to go: the keys, or a path from a click
  let ix = 0, iy = 0;
  if (mode === "play" && !(my.portalWait && now - my.portalWait < 1500)) {
    if (held.has("left")) ix -= 1; if (held.has("right")) ix += 1; if (held.has("up")) iy -= 1; if (held.has("down")) iy += 1;
    if (ix || iy) my.route = null;
    else if (my.route) [ix, iy] = followRoute(now);
  }
  const len = Math.hypot(ix, iy); if (len) { ix /= len; iy /= len; }
  const mp = myPlayer(), riding = !!(mp && mp.riding), run = running && len > 0 && !riding;
  const speed = WALK_SPEED * (riding ? 1.8 : 1) * (me && me.buffs && me.buffs.speed > 0 ? 1.3 : 1) * (run ? RUN_MULT : 1) * (my.route ? (my.route.run ? RUN_MULT : 1) : 1);
  const k = 1 - Math.exp(-(len ? ACCEL : DECEL) * dt);
  my.vx += (ix * speed - my.vx) * k; my.vy += (iy * speed - my.vy) * k;
  if (!len && Math.hypot(my.vx, my.vy) < 0.08) my.vx = my.vy = 0;
  // which way we face: the way we're pushing (sideways wins on a diagonal, like Stardew)
  if (len) my.dir = Math.abs(ix) > 0.35 ? (ix < 0 ? "left" : "right") : (iy < 0 ? "up" : "down");
  // move, sliding along whatever is in the way
  const inside = new Set([...overlapped(my.x, my.y)].filter((key) => { const [a, b] = key.split(",").map(Number); return !walkable(a, b); }));
  const x0 = my.x, y0 = my.y;
  slideAxis("x", my.vx * dt, inside, len > 0 && Math.abs(iy) < 0.5);
  slideAxis("y", my.vy * dt, inside, len > 0 && Math.abs(ix) < 0.5);
  const moved = Math.hypot(my.x - x0, my.y - y0);
  if (len && moved < Math.hypot(my.vx, my.vy) * dt * 0.25) { my.vx *= 0.5; my.vy *= 0.5; }   // pressing into a wall: don't keep a full head of speed
  my.dist += moved;
  my.stepping = moved / Math.max(dt, 1e-3) > 0.6;
  if (run && my.stepping && now - lastDust > 120 && isOutdoor(loc)) { lastDust = now; kickDust(my.x, my.y, my.vx, my.vy, loc); }
  if (my.stepping) footsteps(now, loc);
  // the tile under our feet changed: tell the server (one step at a time, diagonals included)
  const [tx, ty] = footTile(my.x, my.y);
  let guard = 0;
  while ((tx !== my.tx || ty !== my.ty) && guard++ < 4) { sendMove(Math.sign(tx - my.tx), Math.sign(ty - my.ty), now); brushPast(my.tx, my.ty, now); }
  if (len && !my.stepping) bumpInto(now);
  if (portals.has(loc + "," + my.tx + "," + my.ty) && !my.portalWait) { my.portalWait = now; startFade(); my.vx = my.vy = 0; my.route = null; }
  // leaning on a door, a ladder or a cave exit: ask to go through (the server decides)
  if (len && !my.stepping && now - my.lastTurn > 400) {
    const [fdx, fdy] = DELTA[my.dir], fx = my.tx + fdx, fy = my.ty + fdy, ch = (curMap()[fy] || "")[fx];
    if (portals.has(loc + "," + fx + "," + fy) || ch === "D" || ch === "U") { my.lastTurn = now; my.lastSend = now; startFade(); send({ t: "move", dx: fdx, dy: fdy, f: my.dir }); }
  }
  // turned without stepping, or stopped inside a tile: keep the server in the picture
  if (my.dir !== my.sentDir && now - my.lastFace > 120) { my.lastFace = now; my.sentDir = my.dir; const [fdx, fdy] = DELTA[my.dir]; send({ t: "face", dx: fdx, dy: fdy }); }
  if (!my.stepping && !len) {
    my.stillFor = (my.stillFor || 0) + dt;
    const ox = +(my.x - my.tx).toFixed(2), oy = +(my.y - my.ty).toFixed(2), key = ox + "," + oy;
    if (my.stillFor > 0.15 && my.rested !== key) { my.rested = key; send({ t: "rest", ox: String(ox), oy: String(oy) }); }
  } else my.stillFor = 0;
}
function tryStep(dir, now = performance.now()) {
  /* a nudge in one direction (used by tests and the old click code): walk to the next tile's centre */
  if (!my.ready || mode !== "play") return false;
  const [dx, dy] = DELTA[dir]; my.dir = dir;
  if (!walkable(my.tx + dx, my.ty + dy)) return false;
  my.route = { pts: [[my.tx + dx, my.ty + dy]], i: 0 };
  return true;
}
function followRoute(now) {
  /* steer through the tile centres of a click's path; arrive, face the target, and use it */
  const r = my.route, pt = r.pts[r.i];
  if (!pt) { const done = r; my.route = null; arrive(done); return [0, 0]; }
  const dx = pt[0] - my.x, dy = pt[1] - my.y, d = Math.hypot(dx, dy);
  if (d < 0.12) { r.i++; if (r.i >= r.pts.length) { my.x = pt[0]; my.y = pt[1]; my.vx *= 0.3; my.vy *= 0.3; } return followRoute(now); }
  if (now - (r.t0 || (r.t0 = now)) > 15000) { my.route = null; return [0, 0]; }
  return [dx / d, dy / d];
}
function arrive(r) {
  if (!r || !r.target) return;
  const [ax, ay] = r.target, dx = ax - my.tx, dy = ay - my.ty;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return;
  my.dir = dx < 0 ? "left" : dx > 0 ? "right" : dy < 0 ? "up" : "down";
  my.sentDir = my.dir;
  if (portals.has(curLoc() + "," + ax + "," + ay)) { my.lastTurn = performance.now(); startFade(); send({ t: "move", dx, dy, f: my.dir }); return; }   // a door: go in
  send({ t: "face", dx, dy });
  if (r.use) useAhead();
}
function useAhead() {
  const tool = heldItem();
  if (tool && TOOLS.has(tool) && tool !== "fishing_rod") swings[prefs.name] = { tool, start: performance.now() };
  send({ t: "interact" });
}
function routeTo(gx, gy, use) {
  /* breadth-first search over the tiles we can walk, to the clicked tile (or next to it, if it's something to use) */
  const W_ = curMap()[0].length, H_ = curMap().length, start = my.tx + "," + my.ty;
  const goals = new Set(), standable = walkable(gx, gy);
  if (standable && !use) goals.add(gx + "," + gy);
  else for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (walkable(gx + dx, gy + dy) || (gx + dx === my.tx && gy + dy === my.ty)) goals.add((gx + dx) + "," + (gy + dy));
  if (!goals.size) return false;
  const prev = new Map([[start, null]]), q = [[my.tx, my.ty]];
  let found = goals.has(start) ? start : null;
  for (let qi = 0; qi < q.length && !found && qi < 6000; qi++) {
    const [x, y] = q[qi];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, key = nx + "," + ny;
      if (nx < 0 || ny < 0 || nx >= W_ || ny >= H_ || prev.has(key) || !walkable(nx, ny) || portals.has(curLoc() + "," + key)) continue;
      prev.set(key, x + "," + y); q.push([nx, ny]);
      if (goals.has(key)) { found = key; break; }
    }
  }
  if (!found) return false;
  const pts = []; for (let key = found; key && key !== start; key = prev.get(key)) pts.unshift(key.split(",").map(Number));
  my.route = { pts, i: 0, target: [gx, gy], use, run: running };
  return true;
}
// ------------------------------------------------------------------ rendering
let lastFrame = performance.now(), waterFrame = 0, waterAcc = 0, smokeAcc = 0, volcAcc = 0;
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
// ------------------------------------------------------------------ keeping it smooth
// If the browser can't keep up at the screen's full resolution (a big window on a high-density screen with a modest graphics
// chip), draw at a lower resolution instead: the pixel art looks just the same scaled up, and every frame costs a quarter as much.
const frameWatch = { last: 0, n: 0, sum: 0, slow: 0 };
function watchFrames(now) {
  const dt = now - frameWatch.last; frameWatch.last = now;
  if (dt <= 0 || dt > 100 || document.hidden || mode === "login") return;      // a hidden or throttled tab doesn't count
  frameWatch.n++; frameWatch.sum += dt;
  if (frameWatch.n < 90) return;
  const avg = frameWatch.sum / frameWatch.n; frameWatch.n = 0; frameWatch.sum = 0;
  frameWatch.slow = avg > 21 ? frameWatch.slow + 1 : 0;                        // slower than ~48 frames a second
  if (frameWatch.slow >= 2 && !gfxPref && rdpr > 1) setSmooth(true, "The game was struggling to keep up, so it's drawing at a lower resolution now (G switches back).");
}
function setSmooth(on, why) {
  rdpr = on ? 1 : dpr; setZoom(zoom); padsAt = 0; frameWatch.slow = 0;
  if (why) { toast(why); addLog(why, "event"); }
}
function toggleGfx() {
  const smooth = rdpr > 1;
  gfxPref = smooth ? "smooth" : "crisp";
  try { localStorage.setItem("cozy.gfx", gfxPref); } catch (e) { /* private window: just for now then */ }
  setSmooth(smooth, smooth ? "Smooth mode: drawing at a lower resolution for the best frame rate. (G for crisp)" : "Crisp mode: drawing at your screen's full resolution. (G for smooth)");
}
// Sprites are painted the first time they're needed; painting a villager's whole walk cycle takes a few milliseconds, which
// would stutter the frame they first appear in. So when the browser is idle we paint everyone's frames ahead of time.
const warmQueue = [], warmed = new Set();
function warmFarmer(sprite, color, hat) {
  const key = sprite + "|" + color + "|" + hat;
  if (warmed.has(key)) return;
  warmed.add(key);
  const shirt = COLORS[catalog.player_colors[color % catalog.player_colors.length]] || "#3fc1e6";
  const hatArg = hat && hat !== "cowboy" && hat !== "none" && Art.hatSprite && Art.hatSprite(hat, "down") ? "none" : hat;
  for (const f of ["down", "left", "right", "up"]) for (let fr = 0; fr <= 8; fr++) warmQueue.push(() => charSprite(sprite, f, fr, shirt, hatArg, false));
}
function warmAll() {
  if (!catalog || !state) return;
  for (const p of state.players) if (p.online) warmFarmer(p.sprite || "boy", p.color, p.hat);
  for (const n of state.npcs || []) {
    const look = (catalog.npcs || {})[n.n] || ["boy", "white", "none"], own = Art.LOOKS && Art.LOOKS[n.n];
    warmFarmer(own ? n.n : look[0], Math.max(0, (catalog.player_colors || []).indexOf(look[1])), own ? "none" : look[2]);
  }
}
const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 50));
function warmStep(deadline) {
  while (warmQueue.length && deadline.timeRemaining() > 2) warmQueue.shift()();
  idle(warmStep, { timeout: 1000 });
}
idle(warmStep, { timeout: 1000 });
setInterval(warmAll, 3000);
function render(now) {
  requestAnimationFrame(render);
  watchFrames(now);
  try { renderFrame(now); } catch (e) { ctx.globalCompositeOperation = "source-over"; ctx.restore(); if (!window.__renderErr) { window.__renderErr = String(e && e.stack || e); console.error(e); } }
}
function renderFrame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - lastFrame) / 1000)); lastFrame = Math.max(lastFrame, now);
  pruneFx(now);
  if (mode === "fish") updateFishing(dt);
  if (!state || !map.length) return;
  updateSelf(dt, now);
  for (const k in viz) walkPath(viz[k], dt); glideAll(npcViz, 1.6, dt); glideAll(chickViz, 2.2, dt); glideAll(petViz, WALK_SPEED, dt); glideAll(compViz, WALK_SPEED, dt);
  glideAll(mobViz, 1.8, dt); glideAll(critViz, 2.5, dt); glideAll(cowViz, 0.9, dt);
  if (state.balloon) { const b = state.balloon, v = balloonViz.id === b.id ? balloonViz : (balloonViz = { id: b.id, x: b.x, y: b.y, tx: b.x, ty: b.y }); aim(v, b.x, b.y, now); glide1(v, 0.2, dt); }
  updateHudLive(now);
  const loc = curLoc();
  if (!isOutdoor(loc)) { renderInterior(now, dt); return; }
  const M = curMap(), farm = loc === "farm", ATL = areaTiles(loc), cave = /^mine/.test(loc), base = AREA_BASE[loc];
  const rvs = (state.revival || {}).stage || 0, town = loc === "town";   // the Valley Revival stage: the town looks worn until it wakes
  RM = M; RG = groundOf(M);
  const cell = (x, y) => (M[y] || "")[x] || "#", gcell = (x, y) => (RG[y] || [])[x] || "#";
  const cw = Math.floor(canvas.clientWidth * rdpr), ch = Math.floor(canvas.clientHeight * rdpr);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  ctx.imageSmoothingEnabled = false;
  waterAcc += dt; if (waterAcc > 0.45) { waterAcc = 0; waterFrame = (waterFrame + 1) % 3; }
  const mapW = M[0].length, mapH = M.length;
  if (my.ready) {
    leanCam(dt);
    const focus = (window.cozy && window.cozy.look && isFinite(window.cozy.look.x) && isFinite(window.cozy.look.y)) ? window.cozy.look : farm && state.wedding ? { x: state.wedding.altar[0][0] + 1, y: state.wedding.altar[0][1] + 2 } : { x: my.x + 0.5 + camLead.x, y: my.y + 0.5 + camLead.y };
    const [tx, ty] = camTarget(mapW, mapH, cw, ch, focus.x, focus.y);
    if (cam.snap || Math.abs(tx - cam.x) > 8 || Math.abs(ty - cam.y) > 8) { cam.x = tx; cam.y = ty; cam.snap = false; }
    const k = 1 - Math.exp(-7 * dt);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  }
  const [shx, shy] = shakeOffset(now);
  const ox = Math.round(cw / 2 - cam.x * T) + shx, oy = Math.round(ch / 2 - cam.y * T) + shy;
  _ox = ox; _oy = oy;
  const x0 = Math.max(0, Math.floor(-ox / T) - 1), y0 = Math.max(0, Math.floor(-oy / T) - 1);
  const x1 = Math.min(mapW - 1, Math.ceil((cw - ox) / T) + 1), y1 = Math.min(mapH - 1, Math.ceil((ch - oy) / T) + 2);
  const season = loc === "island" ? "summer" : state.season, s = SEASON[season], night = cave ? 0.85 : nightAlpha();
  const weather = cave ? "sun" : (loc === "island" && state.weather === "snow") ? "rain" : state.weather;
  const under = base ? Art.GROUND2[base].base : s.grass;
  const rockKind = (c) => c === "R" ? "cave" : loc === "frontier" ? "frontier" : "mountain";
  ctx.fillStyle = cave ? "#120e0b" : "#1e2a1e"; ctx.fillRect(0, 0, cw, ch);
  profMark("ground");
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
    const d = Art.decorSprite(season, kind, (h >> 4) % 8); if (d) swayDraw(d, ox + x * T, oy + y * T, T, T, rustleAmt(x, y, now));
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
  profMark("props");
  // 2. soil, props, crops, forage and ore, trees as depth-sorted entities
  const ents = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const sx = ox + x * T, sy = oy + y * T, h = hash(x, y), ch_ = M[y][x], d = farm ? tiles[x + "," + y] : null;
    if (d && d.s) {
      const kind = d.f ? "fert" : d.w ? "wet" : "dry";
      ctx.drawImage(Art.soilTile(kind, hash(x + 5, y + 9) % 4), sx, sy, T, T);
      blob(sx, sy, (dx, dy) => isSoil(x + dx, y + dy), s.grass, kind === "wet" ? "#6b4629" : "#9d6a3a", Art.SOIL_EDGE[kind]);
    }
    const spot = farm ? spotLevel(x, y) : null;
    if (spot != null && !(d && d.t)) { const lk = !me || me.level < spot; ents.push({ y: y + 0.35, draw: () => ctx.drawImage(Art.treeSpotSprite(spot, lk), sx, sy - 8 * SCALE, T, T + 8 * SCALE) }); }
    if ("WS+N@".includes(ch_)) continue;
    if (ch_ === "#" || ch_ === "G") {
      const conn = (dx, dy) => { const r = M[y + dy]; return !!r && (r[x + dx] === "#" || r[x + dx] === "G"); };
      const mask = (conn(0, -1) ? 1 : 0) | (conn(1, 0) ? 2 : 0) | (conn(0, 1) ? 4 : 0) | (conn(-1, 0) ? 8 : 0);
      ctx.drawImage(ch_ === "#" ? Art.fenceSprite(mask) : Art.gateSprite(!!(mask & 5)), sx, sy, T, T);
    }
    else if (ch_ === "f" && town && rvs < 1) ctx.drawImage(Art.wiltedPlanter(), sx, sy, T, T);
    else if ("o$!fBchmlbwspg".includes(ch_)) { if (ch_ === "o" || ch_ === "l" || ch_ === "!" || ch_ === "g") ents.push({ y: y + 0.4, draw: () => ctx.drawImage(Art.propSprite(ch_), sx, sy, T, T) }); else if (ch_ === "f") swayDraw(Art.propSprite("f"), sx, sy, T, T, rustleAmt(x, y, now)); else ctx.drawImage(Art.propSprite(ch_), sx, sy, T, T); }
    else if (ch_ === "J" && town && rvs < 1) { const spr = Art.stallShut(); ents.push({ y: y + 0.4, draw: () => ctx.drawImage(spr, sx, sy, T, T) }); }
    else if ("ELIJOUD".includes(ch_)) { const spr = Art.areaProp(ch_, h); ents.push({ y: y + 0.4, draw: () => ctx.drawImage(spr, sx, sy, T, T) }); }
    else if (ch_ === "X") ents.push({ y: y + 0.5, draw: () => ctx.drawImage(Art.minecartSprite(), sx, sy, T, T) });
    else if (ch_ === "y") ents.push({ y: y + 0.5, draw: () => ctx.drawImage(Art.telescopeSprite(), sx, sy - 4 * SCALE, T, T) });
    else if (ch_ === "M") ents.push({ y: y + 0.7, draw: () => { ctx.drawImage(Art.monumentSprite(), sx - 8 * SCALE, sy - 52 * SCALE, 48 * SCALE, 72 * SCALE); } });
    else if (ch_ === "j") {
      if (cell(x - 1, y) !== "j" && cell(x, y - 1) !== "j") ctx.drawImage(Art.hotSpringSprite(waterFrame), sx - 4 * SCALE, sy - 8 * SCALE, 136 * SCALE, 80 * SCALE);   // the whole pool, from its top-left tile
      ents.push({ y: y + 0.1, draw: () => steam(sx, sy, now, h) });
    }
    else if (town && rvs < 1 && (ch_ === "." || ch_ === "=") && hash(x * 3 + 1, y * 7 + 2) % 11 === 0 && !(state.npcs || []).some((n) => n.loc === loc && n.x === x && n.y === y)) ctx.drawImage(Art.weedSprite(h % 6), sx, sy, T, T);
    else if (ch_ === "u") ents.push({ y: y + 0.4, draw: () => { ctx.fillStyle = "rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T - 3 * SCALE, 12 * SCALE, 4 * SCALE, 0, 0, 6.3); ctx.fill(); swayDraw(Art.propSprite("u"), sx, sy - 4 * SCALE, T, T, rustleAmt(x, y, now) * 0.6); } });
    else if (ch_ === "Y") ents.push({ y: y + 0.9, draw: () => { ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T - 2 * SCALE, 11 * SCALE, 4 * SCALE, 0, 0, 6.3); ctx.fill(); ctx.drawImage(Art.priestSprite(Math.floor(now / 700) % 2), sx, sy - 16 * SCALE, T, 48 * SCALE); } });
    else if (ch_ === "~" && h % 9 === 0 && cell(x, y - 1) === "~" && cell(x, y + 1) === "~" && cell(x - 1, y) === "~" && cell(x + 1, y) === "~" && isType(x, y - 1, "~") && isType(x, y + 1, "~") && isType(x - 1, y, "~") && isType(x + 1, y, "~") && !(loc === "beach" || loc === "island")) ctx.drawImage(Art.lilyPad(h % 4), sx, sy, T, T);
    else if (ch_ === "T") {
      const dEdge = Math.min(x - 1, mapW - 2 - x, y - 1, mapH - 2 - y);
      if (dEdge === 1 && h % 5 < 2) ctx.drawImage(Art.bushSprite(treeKind(season, x, y), h % 4), sx, sy, T, T);
      else ents.push({ y: y + 0.5, tree: true, sx, sy, tx: x, ty: y, kind: treeKind(season, x, y), variant: h % 16 });
    }
    else if (ch_ === "P") ents.push({ y: y + 0.5, big: Art.pineSprite(season, h % 8), sx, sy });
    else if (ch_ === "A") ents.push({ y: y + 0.5, palm: Art.palmSprite(h % 6), sx, sy });
    else if (ch_ === "K") ents.push({ y: y + 0.5, draw: () => { ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T - 3 * SCALE, 10 * SCALE, 3 * SCALE, 0, 0, 6.3); ctx.fill(); ctx.drawImage(Art.cactusSprite(h % 6), sx, sy - 16 * SCALE, T, 48 * SCALE); } });
    else if (ch_ === "F" && cell(x - 1, y) !== "F" && cell(x, y - 1) !== "F") ents.push({ y: y + 1.5, draw: () => ctx.drawImage(town && rvs < 2 ? Art.fountainDry() : Art.fountainSprite(Math.floor(now / 220) % 3), sx, sy - 16 * SCALE, 3 * T, 80 * SCALE / 1) });
    else if (ch_ === "Q" && cell(x - 1, y) !== "Q" && cell(x, y - 1) !== "Q") ents.push({ y: y + 1.6, draw: () => ctx.drawImage(Art.coachSprite(), sx, sy - 16 * SCALE, 3 * T, 80 * SCALE) });
    else if (ch_ === "V" && cell(x - 1, y) !== "V") ctx.drawImage(Art.boatSprite(), sx, sy + Math.round(Math.sin(now / 600) * SCALE), 2 * T, T);
    if (d) {
      const flying = inFlight(x, y, now);   // something is still falling onto this tile: show it when it lands
      if (d.c && !flying) { ctx.drawImage(Art.cropSprite(d.c[0], d.c[1], d.c[2]), sx, sy, T, T); if (d.c[2] && Math.random() < dt * 0.5) spawn({ kind: "star", x: x + 0.2 + Math.random() * 0.6, y: y + 0.5, z: 0.3 + Math.random() * 0.3, vz: 0.4, g: 0, loc, col: "#fff6c0", life: 650, size: 1.2 }); }
      if (d.g) ctx.drawImage(Art.forageSprite(d.g), sx, sy, T, T);
      if (d.k && !flying) ctx.drawImage(Art.propSprite("k"), sx, sy, T, T);
      const rareTree = d.t && catalog.trees[d.t[0]] && catalog.trees[d.t[0]].rare && Art.rareTreeSprite ? d.t[0] : null;
      if (rareTree) { if (d.t[1] < 2) { if (!flying) ctx.drawImage(Art.rareTreeSprite(rareTree, d.t[1], season), sx, sy, T, T); } else ents.push({ y: y + 0.5, rareTree, sx, sy, season }); }
      else if (d.t) { if (d.t[1] < 2) { if (!flying) ctx.drawImage(Art.youngTree(d.t[1], season), sx, sy, T, T); } else ents.push({ y: y + 0.5, tree: true, sx, sy, tx: x, ty: y, kind: season === "winter" ? "snow" : "green", variant: h % 16, fruitColor: ITEM_HEX[d.t[0]] || "#e8394a", fruit: d.t[2] }); }
    }
    if (!farm) {
      const ad = ATL[x + "," + y];
      if (ad && ad.g && !inFlight(x, y, now)) ctx.drawImage(Art.forageSprite(ad.g), sx, sy, T, T);
      if (ad && ad.o) ents.push({ y: y + 0.3, draw: () => ctx.drawImage(Art.oreSprite(ad.o, cave, h), sx, sy, T, T) });
    }
  }
  profMark("life");
  // 2b. life in the valley: machines, chests, bugs, dig spots, villagers, animals, monsters, game, festivals
  const inView = (x, y) => x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 3 && y <= y1 + 3;
  const tl = farm ? tiles : ATL;
  for (const k in tl) {
    const d = tl[k]; if (!d.m) continue;
    const [tx, ty] = k.split(",").map(Number); if (!inView(tx, ty)) continue;
    const sx = ox + tx * T, sy = oy + ty * T;
    ents.push({ y: ty + 0.45, draw: () => { ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.fillRect(sx + 4 * SCALE, sy + T - 4 * SCALE, T - 8 * SCALE, 3 * SCALE); ctx.drawImage(Art.machineSprite(d.m[0], d.m[1] === 1), sx, sy - 2 * SCALE, T, T); if (d.m[1] === 2 && d.m[2]) readyBubble(sx, sy - 4 * SCALE, d.m[2], now); } });
  }
  if (/^deep/.test(loc)) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (M[y][x] === "Z") { const sx = ox + x * T, sy = oy + y * T, opened = !!(ATL[x + "," + y] && ATL[x + "," + y].x); ents.push({ y: y + 0.4, draw: () => ctx.drawImage(Art.treasureSprite(opened), sx, sy, T, T) }); }
  const bl = (state.bugs || {})[loc] || {};
  for (const k in bl) { const [bx, by] = k.split(",").map(Number); if (inView(bx, by)) ents.push({ y: by + 0.7, draw: () => drawBug(bl[k], ox + bx * T, oy + by * T, now, night) }); }
  for (const k of ((state.digs || {})[loc] || [])) { const [gx, gy] = k.split(",").map(Number); if (inView(gx, gy)) ctx.drawImage(Art.digSprite(Math.floor(now / 250 + gx) % 3), ox + gx * T, oy + gy * T, T, T); }
  for (const name in npcViz) { const v = npcViz[name]; if (v.loc === loc && inView(v.x, v.y)) ents.push({ y: v.y + 0.9, draw: () => drawNpc(name, v, ox, oy, now) }); }
  if (farm) for (const c of state.chickens || []) {
    const v = chickViz[c.id]; if (!v || !inView(v.x, v.y)) continue;
    const fr = v.moving ? 1 : (Math.floor(now / 700 + c.id) % 6 === 0 ? 2 : 0);
    const spook = my.ready && my.stepping && Math.hypot(my.x - v.x, my.y - v.y) < 1.4;     // hurry past a hen and she flaps
    if (spook && !v.flapT) v.flapT = now; else if (!spook && v.flapT && now - v.flapT > 500) v.flapT = 0;
    const hop = v.flapT && now - v.flapT < 500 ? -Math.abs(Math.sin((now - v.flapT) / 500 * Math.PI * 2)) * 0.22 : 0;
    ents.push({ y: v.y + 0.8, draw: () => { drawSide(Art.chickenSprite(c.c, hop ? 2 : fr), v.x, v.y + hop, c.f, ox, oy, T, 1); if (c.egg) readyBubble(ox + v.x * T, oy + v.y * T - 8 * SCALE, "egg", now); } });
  }
  for (const pt of state.pets || []) { const v = petViz[pt.owner]; if (v && v.loc === loc && inView(v.x, v.y)) ents.push({ y: v.y + 0.85, draw: () => drawPet(pt, v, ox, oy, now) }); }
  for (const owner in compViz) { const v = compViz[owner]; if (v.loc === loc && inView(v.x, v.y)) ents.push({ y: v.y + 0.85, draw: () => drawMob(v.kind, v, ox, oy, now, 1, true, 0) }); }
  for (const mb of (state.mobs || {})[loc] || []) { const v = mobViz[mb.id]; if (v && inView(v.x, v.y)) ents.push({ y: v.y + 0.9, draw: () => drawMob(mb.k, v, ox, oy, now, mb.hp, false, mb.h) }); }
  for (const c of (state.critters || {})[loc] || []) {
    const v = critViz[c.id]; if (!v || !inView(v.x, v.y)) continue;
    const big = c.k === "deer";
    ents.push({ y: v.y + 0.85, draw: () => drawSide(Art.critterSprite(c.k, v.moving ? Math.floor(now / 140) % 2 : 0), v.x, v.y, c.f, ox, oy, big ? 48 * SCALE : T, big ? -12 : c.k === "rabbit" ? 3 : 2, big ? -8 : 0) });
  }
  if (loc === "town" && state.festival) festivalDecor(state.festival, ents, ox, oy, now);
  if (loc === "town" && state.hunt) for (const [hx, hy] of state.hunt.at) {   // the festival hunt: things hidden around town, with a twinkle
    if (!inView(hx, hy)) continue;
    const sx = ox + hx * T, sy = oy + hy * T, bob = Math.round(Math.sin(now / 300 + hx) * SCALE);
    ents.push({ y: hy + 0.3, draw: () => { ctx.drawImage(Art.iconCanvas(state.hunt.kind, catalog), sx + 7 * SCALE, sy + 9 * SCALE + bob, 18 * SCALE, 18 * SCALE); if (Math.floor(now / 400 + hx + hy) % 4 === 0) { ctx.fillStyle = "#ffffff"; ctx.fillRect(sx + 22 * SCALE, sy + 8 * SCALE, 2 * SCALE, 2 * SCALE); } } });
  }
  else if (town && rvs >= 2) revivalDecor(rvs, ents, ox, oy, now, nightAlpha());
  profMark("buildings");
  // 3. buildings: shadows, the farmhouse porch and smoke, then the sprites as depth-sorted entities
  const blds = farm ? buildings.concat(extraBuildings("farm")) : areaBuildings(loc);
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
      smokeAcc += dt; if (smokeAcc > 0.45) { smokeAcc = 0; smoke.push({ x: b.x1 - 2.2, y: b.y0 - 0.55, a: 0.55, r: 2.5, vx: 0.15 + Math.random() * 0.2, loc }); }
    }
    if (b.kind === "volcano") {                                  // the volcano breathes out slow, drifting puffs of smoke
      volcAcc += dt;
      if (volcAcc > 0.6) { volcAcc = 0; smoke.push({ x: b.x0 + 6.6 + (Math.random() - 0.5) * 0.5, y: b.y0 + 0.1, a: 0.5, r: 4 + Math.random() * 2, vx: 0.18 + Math.random() * 0.15, rise: 0.45, grow: 2.6, col: Math.random() < 0.5 ? "214,208,200" : "190,184,176", loc }); }
    }
    const w = b.x1 - b.x0 + 1, hh = b.y1 - b.y0 + 1;
    const spr = farm && "WSN".includes(b.kind) ? Art.buildingSprite(b.kind, w, hh, night > 0.2) : Art.areaBuilding(b.kind, w, hh, night > 0.2, b.label, season);
    const boarded = town && rvs < 2 ? boardedWindows(b) : [];
    ents.push({ y: b.y1 + 0.6, draw: () => {
      ctx.drawImage(spr, ox + b.x0 * T - Art.OV * SCALE, oy + b.y0 * T - Art.TOPPAD * SCALE, w * T + 2 * Art.OV * SCALE, hh * T + Art.TOPPAD * SCALE);
      for (const [wx, wy] of boarded) ctx.drawImage(Art.boardsSprite(), ox + (b.x0 + wx) * T - 10 * SCALE, oy + (b.y0 + wy) * T - 9 * SCALE, 20 * SCALE, 18 * SCALE);
    } });
  }
  for (const sm of smoke) { sm.y -= (sm.rise || 0.35) * dt; sm.x += sm.vx * dt; sm.a -= 0.1 * dt; sm.r += (sm.grow || 1.4) * dt; }
  smoke = smoke.filter((sm) => sm.a > 0 && (sm.loc || "farm") === loc);
  for (const sm of smoke) {
    const sx = ox + sm.x * T, sy = oy + sm.y * T, rr = sm.r * SCALE;
    ctx.fillStyle = "rgba(" + (sm.col || "240,240,244") + "," + sm.a.toFixed(3) + ")"; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 6.3); ctx.fill();
    if (sm.col) { ctx.fillStyle = "rgba(255,255,255," + (sm.a * 0.45).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(sx - rr * 0.3, sy - rr * 0.3, rr * 0.45, 0, 6.3); ctx.fill(); }   // a soft lit top on each billow
  }
  profMark("highlight");
  // 4. facing highlight
  const meP = meNow();
  if (meP) {
    const fx = meP.x + meP.facing[0], fy = meP.y + meP.facing[1], ft = cell(fx, fy), fd = (farm ? tiles : ATL)[fx + "," + fy] || {};
    const hot = farm ? ("S$!+~wmBchblNspg.:".includes(ft) || fd.t || fd.g || chestAt(fx, fy)) : ("~!wmIEFJLOgVQUDBchbljMXy".includes(ft) || fd.g || fd.o || portals.has(loc + "," + fx + "," + fy));
    if (hot) {
      ctx.strokeStyle = "rgba(255,250,200," + (0.35 + 0.3 * Math.sin(now / 200)) + ")"; ctx.lineWidth = SCALE;
      ctx.strokeRect(ox + fx * T + 2 * SCALE, oy + fy * T + 2 * SCALE, T - 4 * SCALE, T - 4 * SCALE);
    }
  }
  profMark("entities");
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
    const dist = Math.hypot(v.tx - v.x, v.ty - v.y);                       // cows glide in renderFrame like everything else
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
    if (p.name === prefs.name) { if (my.ready) ents.push({ y: my.y + 0.9, draw: () => drawFarmer(p, my.x, my.y, my.dir, my.stepping ? 1 + Math.floor(my.dist * 4) % 8 : 0, ox, oy, now, heldItem()) }); continue; }
    const v = viz[p.name]; if (!v) continue;
    ents.push({ y: v.y + 0.9, draw: () => drawFarmer(p, v.x, v.y, v.facing, v.moving ? 1 + Math.floor(v.dist * 4) % 8 : 0, ox, oy, now, p.held) });
  }
  for (const name in swings) { const sw = swings[name]; if (!sw.done && sw.x !== undefined && now - sw.start > 140) toolImpact(sw); }
  drawParts("ground", ox, oy, now, dt, loc);
  drawClickMark(ox, oy, now);
  drawHover(ox, oy, now);
  for (const name in viz) { const v = viz[name]; if (v.fast && v.loc === loc && now - (v.lastDust || 0) > 130) { v.lastDust = now; kickDust(v.x, v.y, 0, 0, loc); } }
  ents.sort((a, b) => a.y - b.y).forEach((e) => {
    if (e.tree) {
      ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(e.sx + T / 2, e.sy + T - 2 * SCALE, 18 * SCALE, 6 * SCALE, 0, 0, 6.3); ctx.fill();
      const wob = e.tx !== undefined ? Math.round(rustleAmt(e.tx, e.ty, now) * 6) * SCALE : 0;    // a tree you bump (or chop) shivers
      ctx.drawImage(Art.treeSprite(e.kind, e.variant, e.fruitColor, e.fruit), e.sx - 8 * SCALE + wob, e.sy + T - 62 * SCALE, 48 * SCALE, 64 * SCALE);
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
  drawFlying(loc, ox, oy, now);
  if (!cave) { updateBirds(now, dt, loc, M, x0, y0, x1, y1, night); drawBirds(ox, oy, now, loc); fishJumps(now, dt, loc, M, x0, y0, x1, y1); }
  drawParts("air", ox, oy, now, dt, loc);
  drawPrompt(ox, oy, now);
  profMark("ambient");
  // 6. ambient life
  if (!cave && night < 0.1 && hourNow() > 7 && hourNow() < 18.5 && weather === "sun" && season !== "winter") {
    while (butterflies.length < 5) butterflies.push({ x: Math.random() * mapW, y: Math.random() * mapH, p: Math.random() * 6.3, c: ["#fff8d0", "#ffd0e8", "#d8f0ff"][butterflies.length % 3] });
    for (const bf of butterflies) {
      bf.x += Math.sin(now / 900 + bf.p) * dt * 1.2 + 0.2 * dt; bf.y += Math.cos(now / 700 + bf.p) * dt * 0.8;
      const fdx = bf.x - (my.x + 0.5), fdy = bf.y - (my.y + 0.2), fd = Math.hypot(fdx, fdy);
      if (my.ready && fd < 2.3 && fd > 0.01) { bf.x += fdx / fd * dt * 3.8; bf.y += fdy / fd * dt * 2.6 - dt * 0.6; }     // too close: away it flutters
      if (bf.x > mapW) bf.x = 0; if (bf.x < 0) bf.x = mapW; if (bf.y < 0) bf.y = mapH; if (bf.y > mapH) bf.y = 0;
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
  profMark("weather");
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
    if (rain && Math.random() < dt * 14) spawn({ kind: "ring", x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0), loc, layer: "ground", col: "rgba(210,235,255,.55)", life: 380, r: 0.22 });
    ctx.fillStyle = rain ? "rgba(40,60,90,.2)" : "rgba(220,230,240,.1)"; ctx.fillRect(0, 0, cw, ch);
  } else drops = [];
  profMark("sky");
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
        drawGlow(glowTex("bulb" + col, [[0, col, 0.9], [0.3, col, 0.35], [1, col, 0]]), qx, qy, 9 * SCALE, tw * night);
        ctx.fillStyle = "rgba(255,255,240," + Math.min(1, 0.9 * tw + 0.2) + ")"; ctx.fillRect(qx - SCALE, qy - SCALE, 2 * SCALE, 2 * SCALE);
      }
    }
    const glow = (gx, gy, r, a, inner) => {
      if (!isFinite(gx) || !isFinite(gy) || !isFinite(r) || r <= 0 || a <= 0) return;
      const k = Math.min(1, inner || 1);
      drawGlow(glowTex("lamp" + k, [[0, "255,236,170", k], [0.35, "255,200,110", 0.55], [1, "255,170,80", 0]]), gx, gy, r, a);
    };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const ch_ = M[y][x];
      if (ch_ === "l") {
        const quiet = town && rvs < 1, h2 = hash(x, y);
        if (quiet && h2 % 3 === 0) continue;                       // a few lamps have gone out
        const flick = quiet ? 0.55 + 0.45 * Math.max(0, Math.sin(now / 70 + x * 5) * Math.sin(now / 230 + y)) : 0.85 + 0.15 * Math.sin(now / 90 + x * 3 + y);
        glow(ox + x * T + T / 2, oy + y * T + 8 * SCALE, (quiet ? 2.4 : 3.6) * T, (quiet ? 0.35 : 0.55) * night * flick);
        ctx.fillStyle = "rgba(255,220,140," + 0.16 * night + ")"; ctx.beginPath(); ctx.ellipse(ox + x * T + T / 2, oy + y * T + T - 2 * SCALE, 1.6 * T, 0.7 * T, 0, 0, 6.3); ctx.fill();
      }
    }
    if (farm) for (const k in tiles) {   // lamp posts and stone lanterns from Oakley's catalogue light up the farm at night
      const d = tiles[k]; if (!d.m || !["lamp_post", "stone_lantern", "jack_o_lantern", "festive_tree"].includes(d.m[0])) continue;
      const [lx, ly] = k.split(",").map(Number); if (lx < x0 - 3 || lx > x1 + 3 || ly < y0 - 3 || ly > y1 + 3) continue;
      glow(ox + lx * T + T / 2, oy + ly * T + (d.m[0] === "lamp_post" ? 8 : 14) * SCALE, (d.m[0] === "lamp_post" ? 3.2 : 2) * T, 0.5 * night);
    }
    if (loc === "beach" && state.chapters && state.chapters.lighthouse) for (const b of blds) {   // Year Two: the lighthouse shines again
      if (b.kind !== "lighthouse") continue;
      const lx = ox + (b.x0 + (b.x1 - b.x0 + 1) / 2) * T, ly = oy + b.y0 * T - Art.TOPPAD * SCALE + 18 * SCALE, a = now / 1400;
      glow(lx, ly, 2.4 * T, 0.8 * night, 1.2);
      for (const sgn of [1, -1]) {
        const ang = a + (sgn < 0 ? Math.PI : 0), len = 14 * T, spread = 0.16;
        const gr = ctx.createLinearGradient(lx, ly, lx + Math.cos(ang) * len, ly + Math.sin(ang) * len * 0.45);
        gr.addColorStop(0, "rgba(255,244,190," + (0.55 * night).toFixed(3) + ")"); gr.addColorStop(1, "rgba(255,240,180,0)");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(lx, ly);
        ctx.lineTo(lx + Math.cos(ang - spread) * len, ly + Math.sin(ang - spread) * len * 0.45); ctx.lineTo(lx + Math.cos(ang + spread) * len, ly + Math.sin(ang + spread) * len * 0.45); ctx.closePath(); ctx.fill();
      }
    }
    if (town && rvs >= 3 && !state.festival) for (const [lx, ly, col] of lanternSpots(ox, oy, now)) {   // the paper lanterns light up after dark
      glow(lx, ly + 8 * SCALE, 1.5 * T, 0.5 * night);
      const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = Math.min(1, night * 1.5);
      ctx.drawImage(Art.lanternSprite(col, true), lx - 6 * SCALE, ly, 12 * SCALE, 16 * SCALE); ctx.globalAlpha = 1; ctx.globalCompositeOperation = op;
    }
    for (const b of blds) {
      if (farm && "WSN".includes(b.kind)) {
        const rr = Art.roofRowsFor(b.y1 - b.y0 + 1), wy = b.y0 + rr;
        const cols = b.kind === "W" ? [1, 3, 7, 9] : (b.kind === "S" ? [2, 3, 7, 8] : [4]);
        for (const cx of cols) {
          const gx = ox + (b.x0 + cx) * T + T / 2, gy = oy + wy * T + 14 * SCALE;
          glow(gx, gy, 1.5 * T, 0.35 * night);
          ctx.fillStyle = "rgba(255,215,130," + 0.12 * night + ")";
          ctx.beginPath(); ctx.moveTo(gx - 10 * SCALE, oy + (b.y1 + 1) * T); ctx.lineTo(gx + 10 * SCALE, oy + (b.y1 + 1) * T); ctx.lineTo(gx + 22 * SCALE, oy + (b.y1 + 1) * T + 26 * SCALE); ctx.lineTo(gx - 22 * SCALE, oy + (b.y1 + 1) * T + 26 * SCALE); ctx.closePath(); ctx.fill();
        }
      } else { const bw = town && rvs < 2 ? boardedWindows(b).map(String) : []; for (const [wx, wy] of Art.windowSpots(b.kind, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1)) if (!bw.includes(String([wx, wy]))) glow(ox + (b.x0 + wx) * T, oy + (b.y0 + wy) * T, 1.5 * T, 0.35 * night); }
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
  profMark("labels");
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
  if (cave || loc === "farm" || isArea(loc)) drawStars(cw, ch, now);
  if (now - hurtAt < 350) { ctx.fillStyle = "rgba(220,40,40," + (0.28 * (1 - (now - hurtAt) / 350)).toFixed(3) + ")"; ctx.fillRect(0, 0, cw, ch); }
  drawBanner(now, cw);
  drawCeremony(now, cw, ch, dt);
  if (state.bloom && state.bloom.on && !cave && (night > 0.25 || (state.ceremony && state.ceremony.stage === 4))) fireworks(now, cw, ch, dt);
  drawFade(now, cw, ch);
  if (Math.floor(now / 1000) !== Math.floor((now - dt * 1000) / 1000)) $("#clock").textContent = skyLabel(hourNow());
}
const _areaBld = {};
function areaBuildings(loc) {
  if (!_areaBld[loc]) _areaBld[loc] = ((catalog.buildings || {})[loc] || []).map((b) => ({ kind: b.kind, label: b.label, x0: b.x, y0: b.y, x1: b.x + b.w - 1, y1: b.y + b.h - 1 })).concat(extraBuildings(loc));
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
let padsAt = 0, padsFor = 0, padsCache = null;
window.addEventListener("resize", () => { padsAt = 0; });
function hudPads() {
  // Screen-space bands (device px) covered by the HUD, so the camera keeps the farmer in the uncovered part of the canvas.
  // Reading where things are on the page is slow if anything changed since, so it's remembered for half a second.
  const t = performance.now();
  if (padsCache && t - padsAt < 500 && padsFor === rdpr) return Object.assign({}, padsCache);
  padsAt = t; padsFor = rdpr;
  padsCache = measurePads();
  return Object.assign({}, padsCache);
}
function measurePads() {
  const r = canvas.getBoundingClientRect();
  const side = $("#side").getBoundingClientRect(), here = $("#here").getBoundingClientRect(), top = $("#topbar").getBoundingClientRect();
  const sideCovers = side.width > 0 && side.left < r.right;
  return { l: 0, r: sideCovers ? Math.max(0, r.right - side.left + 8) * rdpr : 0, t: Math.max(0, top.bottom - r.top) * rdpr, b: here.width > 0 ? Math.max(0, r.bottom - here.top + 6) * rdpr : 0 };
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
// lights at night: a soft glow painted once into a small picture, then stretched and faded for every lamp, window and bulb
// (working out a gradient for every pixel of every glow, every frame, is the slowest thing a frame can do)
const _glows = {};
function glowTex(key, stops) {
  if (_glows[key]) return _glows[key];
  const c = blank(64, 64), g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [at, col, a] of stops) gr.addColorStop(at, "rgba(" + col + "," + a + ")");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (_glows[key] = c);
}
function drawGlow(tex, x, y, r, a) {
  const was = ctx.globalAlpha;
  ctx.globalAlpha = Math.min(1, was * a); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tex, x - r, y - r, 2 * r, 2 * r);
  ctx.imageSmoothingEnabled = false; ctx.globalAlpha = was;
}
const _vignettes = {};
function vignette(w, h) {
  /* the warm-centred, dark-edged glow over a room, painted once per room size at 8 pixels a tile */
  const key = w + "x" + h;
  if (_vignettes[key]) return _vignettes[key];
  const c = blank(w * 8, h * 8), g = c.getContext("2d");
  const gr = g.createRadialGradient(w * 4, h * 4, 8, w * 4, h * 4, Math.max(w, h) * 8);
  gr.addColorStop(0, "rgba(255,200,120,0)"); gr.addColorStop(1, "rgba(20,10,0,.45)"); g.fillStyle = gr; g.fillRect(0, 0, w * 8, h * 8);
  return (_vignettes[key] = c);
}
function renderInterior(now, dt) {
  const rows = curMap(), loc = curLoc();
  const cw = Math.floor(canvas.clientWidth * rdpr), ch = Math.floor(canvas.clientHeight * rdpr);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  ctx.imageSmoothingEnabled = false;
  const mapW = rows[0].length, mapH = rows.length;
  leanCam(dt);
  const [tx, ty] = camTarget(mapW, mapH, cw, ch, my.x + 0.5 + camLead.x, my.y + 0.5 + camLead.y);
  if (cam.snap || Math.abs(tx - cam.x) > 8 || Math.abs(ty - cam.y) > 8) { cam.x = tx; cam.y = ty; cam.snap = false; }
  const k = 1 - Math.exp(-7 * dt); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  const [shx, shy] = shakeOffset(now);
  const ox = Math.round(cw / 2 - cam.x * T) + shx, oy = Math.round(ch / 2 - cam.y * T) + shy; _ox = ox; _oy = oy;
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
      // the keeper's own stretch of counter; the keeper stands here when they are in (see npcViz below)
      const counter = rows[y][x - 1] === "S" || rows[y][x + 1] === "S";
      if (counter) { const cs = Art.interiorObj("S", fr, hash(x + 3, y + 5) % 6); if (cs) ents.push({ y: y + 0.95, draw: () => ctx.drawImage(cs, ox + x * T, oy + y * T, T, T) }); }
    }
  }
  for (const name in npcViz) { const v = npcViz[name]; if (v.loc === loc) ents.push({ y: v.y + 0.5, draw: () => drawNpc(name, v, ox, oy, now) }); }
  for (const pt of state.pets || []) { const v = petViz[pt.owner]; if (v && v.loc === loc) ents.push({ y: v.y + 0.85, draw: () => drawPet(pt, v, ox, oy, now) }); }
  for (const owner in compViz) { const v = compViz[owner]; if (v.loc === loc) ents.push({ y: v.y + 0.85, draw: () => drawMob(v.kind, v, ox, oy, now, 1, true, 0) }); }
  if (loc === "museum") {      // donated pieces sit in the display cases
    const cases = []; for (let yy = 0; yy < mapH; yy++) for (let xx = 0; xx < mapW; xx++) if (rows[yy][xx] === "d") cases.push([xx, yy]);
    (state.museum || []).slice(0, cases.length).forEach((key, i) => { const [cx, cy] = cases[i]; ents.push({ y: cy + 0.6, draw: () => ctx.drawImage(itemIcon(key, catalog), ox + cx * T + 8 * SCALE, oy + cy * T + 5 * SCALE, 16 * SCALE, 16 * SCALE) }); });
  }
  for (const p of state.players) {
    if (!p.online || (p.loc || "farm") !== loc) continue;
    if (p.name === prefs.name) { ents.push({ y: my.y + 0.9, draw: () => drawFarmer(p, my.x, my.y, my.dir, my.stepping ? 1 + Math.floor(my.dist * 4) % 8 : 0, ox, oy, now, heldItem()) }); continue; }
    const v = viz[p.name]; if (!v) continue;
    ents.push({ y: v.y + 0.9, draw: () => drawFarmer(p, v.x, v.y, v.facing, v.moving ? 1 + Math.floor(v.dist * 4) % 8 : 0, ox, oy, now, p.held) });
  }
  for (const name in swings) { const sw = swings[name]; if (!sw.done && sw.x !== undefined && now - sw.start > 140) toolImpact(sw); }
  drawParts("ground", ox, oy, now, dt, loc);
  drawClickMark(ox, oy, now);
  ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
  drawParts("air", ox, oy, now, dt, loc);
  drawPrompt(ox, oy, now);
  const meP = meNow();
  if (meP) { const fx = meP.x + meP.facing[0], fy = meP.y + meP.facing[1], c = (rows[fy] || "")[fx]; if (c && "btcfFkpSqhoxWndai".includes(c)) { ctx.strokeStyle = "rgba(255,250,200," + (0.35 + 0.3 * Math.sin(now / 200)) + ")"; ctx.lineWidth = SCALE; ctx.strokeRect(ox + fx * T + 2 * SCALE, oy + fy * T + 2 * SCALE, T - 4 * SCALE, T - 4 * SCALE); } }
  // warm lamp light and a soft vignette
  ctx.imageSmoothingEnabled = true;      // the vignette is soft, so a small one stretched over the room looks the same and costs far less
  ctx.drawImage(vignette(mapW, mapH), ox, oy, mapW * T, mapH * T);
  ctx.imageSmoothingEnabled = false;
  for (const p of state.players) {
    if (!p.online || (p.loc || "farm") !== loc) continue;
    const v = p.name === prefs.name ? my : viz[p.name]; if (!v) continue;
    const shirt = COLORS[catalog.player_colors[p.color % catalog.player_colors.length]] || "#f4f1ea";
    if (p.bubble) drawSpeech(ox + v.x * T + T / 2, oy + v.y * T - 19 * SCALE, p.bubble, shirt); else if (p.name !== prefs.name) drawTag(ox + v.x * T + T / 2, oy + v.y * T - 18 * SCALE, p.name);
  }
  drawFade(now, cw, ch);
}
function drawFarmer(p, x, y, facing, frame, ox, oy, now, held) {
  const shirt = COLORS[catalog.player_colors[p.color % catalog.player_colors.length]] || "#3fc1e6";
  const sw0 = swings[p.name], carrying = p.carry === "chest";
  const dropping = fxBusy("drop", p.name, now);   // arms stay up while what they just let go is still falling
  const customHat = p.hat && p.hat !== "cowboy" && p.hat !== "none" && Art.hatSprite && Art.hatSprite(p.hat, facing) ? p.hat : null;
  const c = charSprite(p.sprite || "boy", facing, frame, shirt, customHat ? "none" : p.hat, carrying || dropping || (plantable(held) && !sw0));
  const riding = !!(p.riding && p.horse), sx = Math.round(ox + x * T), sy0 = Math.round(oy + y * T), sy = sy0 - (riding ? 13 * SCALE : 0);
  ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy0 + T - 2 * SCALE, (riding ? 18 : 11) * SCALE, 4 * SCALE, 0, 0, 6.3); ctx.fill();
  if (riding) ctx.drawImage(Art.horseSprite(p.horse, facing, frame ? Math.floor(now / 110) % 4 : 0), sx - 8 * SCALE, sy0 - 18 * SCALE, 48 * SCALE, 48 * SCALE);
  const sw = swings[p.name];
  const swinging = sw && now - sw.start < 380;
  if (sw && !swinging) delete swings[p.name];
  const showHeld = held && !swinging && !p.fishing && !carrying && !dropping;
  const overhead = carrying || (showHeld && plantable(held));
  if (facing === "up" && !overhead) { if (swinging) drawTool(sw, sx, sy, facing, now); else if (showHeld) drawHeld(held, sx, sy, facing, frame); }
  if (riding) ctx.drawImage(c, 0, 0, 32, 33, sx, sy - 16 * SCALE, T, 33 * SCALE); else ctx.drawImage(c, sx, sy - 16 * SCALE, T, 48 * SCALE);
  if (customHat) { const bob = frame % 8 === 0 ? 0 : Math.round(Math.abs(Math.sin((frame % 8) / 8 * Math.PI * 2)) * 2); ctx.drawImage(Art.hatSprite(customHat, facing), sx, sy - (16 + bob) * SCALE, T, 16 * SCALE); }
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
// ------------------------------------------------------------------ life in the valley: drawing helpers
function aim(v, tx, ty, now) {
  /* a new position from the server: remember how often they come, so the glide can arrive just as the next one does
     (a villager stepping every 0.55s walks one smooth tile per 0.55s instead of dashing and waiting) */
  if (v.tx === tx && v.ty === ty) return;
  if (v.lastAim) { const iv = Math.min(1.2, Math.max(0.08, (now - v.lastAim) / 1000)); v.iv = v.iv ? v.iv * 0.7 + iv * 0.3 : iv; }
  v.lastAim = now; v.tx = tx; v.ty = ty;
}
function glide1(v, minSpeed, dt) {
  const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy);
  if (d > 3) { v.x = v.tx; v.y = v.ty; v.moving = false; return; }            // teleported (a door, a respawn): no slide across the map
  const sp = Math.max(minSpeed, d / Math.max(0.12, v.iv || 0.3) * 1.04) * dt;
  if (d <= sp) { v.x = v.tx; v.y = v.ty; v.dist = (v.dist || 0) + d; } else { v.x += dx / d * sp; v.y += dy / d * sp; v.dist = (v.dist || 0) + sp; }
  v.still = d > 0.01 ? 0 : (v.still || 0) + dt;
  v.moving = v.still < 0.15;                         // keep walking through the blink between two steps (no flicker to the standing pose)
}
function glideAll(store, minSpeed, dt) { for (const k in store) glide1(store[k], minSpeed, dt); }
function queueStep(v, x, y, now) {
  /* another farmer's new tile: queue it, so we walk the same path they did (round corners, not across them) */
  const last = v.path.length ? v.path[v.path.length - 1] : [v.tx, v.ty];
  if (last[0] === x && last[1] === y) return;
  if (Math.max(Math.abs(last[0] - x), Math.abs(last[1] - y)) !== 1 || v.path.length > 8) { v.path = []; v.x = v.tx = x; v.y = v.ty = y; return; }   // a door, a ride, a big lag: just be there
  if (v.lastStep) { const iv = (now - v.lastStep) / 1000; if (iv < 0.45) v.iv = v.iv ? v.iv * 0.7 + Math.max(0.07, iv) * 0.3 : Math.max(0.07, iv); }   // a pause isn't their pace
  v.lastStep = now;
  v.path.push([x, y]);
}
function walkPath(v, dt) {
  /* walk the queued tiles at the pace they arrive (a walker, a runner, a rider), hurrying a little if we fall behind */
  if (!v.path) { glide1(v, WALK_SPEED, dt); return; }
  const pace = Math.max(2.5, Math.min(10, 1 / (v.iv || 1 / WALK_SPEED)));
  let budget = pace * (1 + 0.3 * Math.max(0, v.path.length - 1)) * dt, moved = false;
  while (v.path.length && budget > 0) {
    const [px, py] = v.path[0], dx = px - v.x, dy = py - v.y, d = Math.hypot(dx, dy);
    if (d > 0.001) v.facing = Math.abs(dx) >= Math.abs(dy) * 0.9 ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
    if (d <= budget) { v.x = px; v.y = py; v.tx = px; v.ty = py; v.path.shift(); budget -= d; v.dist += d; }
    else { v.x += dx / d * budget; v.y += dy / d * budget; v.dist += budget; budget = 0; }
    moved = true;
  }
  if (!v.path.length && budget > 0) {                          // at rest: settle exactly where they stopped inside the tile
    const gx = v.tx + (v.off ? v.off[0] : 0), gy = v.ty + (v.off ? v.off[1] : 0), dx = gx - v.x, dy = gy - v.y, d = Math.hypot(dx, dy);
    if (d > 0.002) { const st = Math.min(d, Math.max(budget, 2.5 * dt)); v.x += dx / d * st; v.y += dy / d * st; v.dist += st; moved = d > 0.05; }
  }
  v.still = moved ? 0 : (v.still || 0) + dt;
  v.moving = v.still < 0.12;
  v.fast = moved && pace > WALK_SPEED * 1.35;
  if (moved && v.dist - (v.stepAt || 0) > 1 && v.loc === curLoc() && isOutdoor(v.loc)) {   // their footsteps puff too
    v.stepAt = v.dist;
    const g = groundAt(v.loc, Math.floor(v.x + 0.5), Math.floor(v.y + 0.75)), cols = STEP_LOOK[g] || STEP_LOOK.path;
    if (g !== "grass" && g !== "wood") burst(2, { x: v.x + 0.5, y: v.y + 0.93, loc: v.loc, layer: "ground", col: cols, life: 340, size: 1.5, g: 2 }, { up: 0.6, speed: 0.7, r: 0.3, flat: true });
  }
  if (!v.moving && v.sfacing) v.facing = v.sfacing;            // standing: face wherever they turned
}
function readyBubble(sx, sy, key, now) {
  /* a little thought bubble with the finished thing in it, bobbing over a machine or a hen */
  const b = Math.round(Math.sin(now / 280) * 2) * SCALE, x = sx + T / 2, y = sy - 10 * SCALE + b, r = 9 * SCALE;
  ctx.fillStyle = "#2b1f17"; ctx.beginPath(); ctx.arc(x, y, r + SCALE, 0, 6.3); ctx.fill();
  ctx.fillStyle = "#fffaf0"; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
  ctx.fillRect(x - 2 * SCALE, y + r - SCALE, 4 * SCALE, 3 * SCALE);
  ctx.drawImage(itemIcon(key, catalog), x - 7 * SCALE, y - 7 * SCALE, 14 * SCALE, 14 * SCALE);
}
function drawBug(kind, sx, sy, now, night) {
  const t = now / 1000 + sx * 0.013, hx = sx + T / 2 + Math.sin(t * 2.1) * 7 * SCALE, hy = sy + T / 2 - 5 * SCALE + Math.cos(t * 3.3) * 4 * SCALE;
  if (kind === "firefly" || (night > 0.3 && /moth|beetle/.test(kind))) {
    const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 10 * SCALE); g.addColorStop(0, "rgba(230,255,150,.55)"); g.addColorStop(1, "rgba(230,255,150,0)");
    ctx.fillStyle = g; ctx.fillRect(hx - 10 * SCALE, hy - 10 * SCALE, 20 * SCALE, 20 * SCALE);
  }
  const flap = Math.sin(now / 70 + sx) > 0 ? 12 : 10;
  ctx.drawImage(itemIcon(kind, catalog), hx - flap / 2 * SCALE, hy - 6 * SCALE, flap * SCALE, 12 * SCALE);
}
function drawSide(spr, x, y, f, ox, oy, size, yoff, xoff) {
  /* a side-on sprite (chicken, game) facing f: 1 right, -1 left; with a soft shadow under its feet */
  const sx = Math.round(ox + x * T + (xoff || 0) * SCALE), sy = Math.round(oy + y * T + (yoff || 0) * SCALE);
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(ox + x * T + T / 2, oy + y * T + T - 3 * SCALE, 10 * SCALE, 3 * SCALE, 0, 0, 6.3); ctx.fill();
  if (f < 0) { ctx.save(); ctx.translate(sx + size, sy); ctx.scale(-1, 1); ctx.drawImage(spr, 0, 0, size, size); ctx.restore(); }
  else ctx.drawImage(spr, sx, sy, size, size);
}
function petCoat(kind, name) {   // every dog and cat its own coat, picked from its name
  const coats = (Art.PET_COATS || {})[kind] || [""]; let h = 0; for (const ch of name || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return coats[h % coats.length];
}
const FLOATY_PETS = new Set(["glowbug", "starling"]);   // these hover and flutter even standing still
function drawPet(pt, v, ox, oy, now) {
  const f = pt.f || [0, 1], facing = facingName(f), floaty = FLOATY_PETS.has(pt.kind);
  const fr = floaty ? Math.floor(now / 150) % 4 : v.moving ? 1 + Math.floor(now / 120) % 3 : 0;
  const sx = Math.round(ox + v.x * T), sy = Math.round(oy + v.y * T);
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T - 3 * SCALE, (floaty ? 6 : 10) * SCALE, (floaty ? 2 : 3) * SCALE, 0, 0, 6.3); ctx.fill();
  ctx.drawImage(Art.petSprite(pt.kind, facing, fr, petCoat(pt.kind, pt.name)), sx, sy + (facing === "left" || facing === "right" ? 3 : 2) * SCALE, T, T);
}
function drawMob(kind, v, ox, oy, now, hp, tame, hurt) {
  const big = kind === "slime_king", size = big ? 48 * SCALE : T, flying = kind === "bat" || kind === "ghost";
  const sx = Math.round(ox + v.x * T - (big ? 8 * SCALE : 0)), hover = flying ? Math.round(Math.sin(now / 180 + v.x) * 2 - 6) * SCALE : 0;
  const sy = Math.round(oy + v.y * T - (big ? 16 * SCALE : 0)) + hover;
  ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(ox + v.x * T + T / 2, oy + v.y * T + T - 3 * SCALE, (big ? 20 : 10) * SCALE, (big ? 5 : 3) * SCALE, 0, 0, 6.3); ctx.fill();
  const spr = Art.monsterSprite(kind, Math.floor(now / (flying ? 120 : 380) + v.x) % 2);
  if (tame) { ctx.save(); ctx.globalAlpha = 0.95; }
  if ((v.f || 1) < 0 && !big) { ctx.save(); ctx.translate(sx + size, sy); ctx.scale(-1, 1); ctx.drawImage(spr, 0, 0, size, size); ctx.restore(); } else ctx.drawImage(spr, sx, sy, size, size);
  if (hurt) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5; ctx.drawImage(spr, sx, sy, size, size); ctx.restore(); }
  if (tame) { ctx.restore(); ctx.fillStyle = "#ff7eb6"; ctx.fillRect(sx + T / 2 - 2 * SCALE, sy - 2 * SCALE, 4 * SCALE, 3 * SCALE); }
  if (hp < 1 && !tame) {
    const w = (big ? 40 : 22) * SCALE, x = ox + v.x * T + T / 2 - w / 2, y = sy - 4 * SCALE;
    ctx.fillStyle = "#2b1f17"; ctx.fillRect(x - SCALE, y - SCALE, w + 2 * SCALE, 4 * SCALE);
    ctx.fillStyle = "#e0402f"; ctx.fillRect(x, y, Math.max(0, w * hp), 2 * SCALE);
  }
}
function drawNpc(name, v, ox, oy, now) {
  const look = (catalog.npcs || {})[name] || ["boy", "white", "none"];
  let f = v.f || [0, 1];
  const near = my.ready && v.loc === my.loc && Math.abs(my.x - v.x) <= 1.6 && Math.abs(my.y - v.y) <= 1.6;
  if (near && !v.moving) {                                   // standing near you: they turn to look at you
    const dx = my.x - v.x, dy = my.y - v.y;
    f = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy) || 1];
    if (now - (v.greeted || -1e9) > 120000 && now - lastGreet > 3500 && !v.b) { v.greeted = now; lastGreet = now; v.hi = { text: GREETS[(hash(name.length, Math.floor(now / 1000)) >>> 0) % GREETS.length], until: now + 1700 }; }
  }
  if (v.b && v.b !== v.lastB && /<3|!/.test(v.b)) { v.hop = now; for (let i = 0; i < 3; i++) spawn({ kind: "heart", x: v.x + 0.5 + (i - 1) * 0.3, y: v.y + 0.2, z: 0.4, vz: 1.5 + i * 0.25, g: 1.2, loc: v.loc, col: "#ff6b9d", life: 1000 }); }
  v.lastB = v.b;
  const hopY = v.hop && now - v.hop < 520 ? -Math.abs(Math.sin((now - v.hop) / 520 * Math.PI * 2)) * 0.18 : 0;
  v = hopY ? Object.assign({}, v, { y: v.y + hopY }) : v;
  const ci = Math.max(0, (catalog.player_colors || []).indexOf(look[1])), own = Art.LOOKS && Art.LOOKS[name];   // everyone has a look of their own
  drawFarmer({ name, color: ci, sprite: own ? name : look[0], hat: own ? "none" : look[2], facing: f }, v.x, v.y, facingName(f), v.moving ? 1 + Math.floor(v.dist * 4) % 8 : 0, ox, oy, now, null);
  const px_ = ox + v.x * T + T / 2, py_ = oy + v.y * T - 18 * SCALE;
  const mark = me && me.quest_marks && me.quest_marks[name];
  if (mark) drawQuestMark(px_, py_ - 4 * SCALE, mark, now);
  else if (v.b) drawBubble(px_, py_ - 2 * SCALE, v.b);
  else if (v.hi && now < v.hi.until) drawBubble(px_, py_ - 2 * SCALE, v.hi.text);
  if (!mark && !v.b && my.ready && Math.abs(my.x - v.x) + Math.abs(my.y - v.y) < 3.5) drawTag(px_, py_, name);
  else if (mark && my.ready && Math.abs(my.x - v.x) + Math.abs(my.y - v.y) < 3.5) drawTag(px_, py_ + 12 * SCALE, name);
}
function drawQuestMark(x, y, mark, now) {
  /* a bobbing "!" (they have something for you) or "?" (you have what they asked for) */
  const b = Math.round(Math.sin(now / 260) * 2) * SCALE, w = 11 * SCALE, h = 13 * SCALE, X = Math.round(x - w / 2), Y = Math.round(y - h + b);
  ctx.fillStyle = "#2b1f17"; ctx.fillRect(X - SCALE, Y - SCALE, w + 2 * SCALE, h + 2 * SCALE);
  ctx.fillStyle = mark === "?" ? "#7fd36a" : "#ffd84a"; ctx.fillRect(X, Y, w, h);
  ctx.fillStyle = mark === "?" ? "#b8f0a0" : "#fff2a8"; ctx.fillRect(X, Y, w, 2 * SCALE);
  ctx.fillStyle = "#2b1f17"; ctx.font = "bold " + (11 * SCALE) + "px 'Pixelify Sans', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(mark, x, Y + h / 2 + SCALE); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
const BOARD_KINDS = { post: 1, bakery: 0, museum: 2, saloon: 1, clinic: 0, cottage: 0, cottage3: 1 };
function boardedWindows(b) {
  /* a quiet town: one window boarded up on some of the buildings (mended when the valley is Bustling) */
  if (!(b.kind in BOARD_KINDS)) return [];
  const spots = Art.windowSpots(b.kind, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
  return spots.length ? [spots[BOARD_KINDS[b.kind] % spots.length]] : [];
}
function steam(sx, sy, now, h) {
  /* wisps rising off the hot spring */
  for (let i = 0; i < 2; i++) {
    const t = ((now / 2600 + i * 0.5 + (h % 7) / 7) % 1), x = sx + T / 2 + Math.sin(t * 6 + h + i) * 5 * SCALE, y = sy + T / 2 - t * 26 * SCALE;
    ctx.fillStyle = "rgba(255,255,255," + (0.45 * (1 - t)).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(x, y, (3 + t * 5) * SCALE, 0, 6.3); ctx.fill();
  }
}
function bunting(lines, cols, ents, ox, oy, now) {
  for (const [[ax, ay], [bx, by]] of lines) {
    const p0 = { x: ox + ax * T + T / 2, y: oy + ay * T - 6 * SCALE }, p1 = { x: ox + bx * T + T / 2, y: oy + by * T - 6 * SCALE };
    const n = Math.max(4, Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y) / (0.8 * T))), sag = ax === bx ? 0 : 16 * SCALE;
    ents.push({ y: Math.min(ay, by) - 0.2, draw: () => {
      ctx.strokeStyle = "rgba(60,40,20,.9)"; ctx.lineWidth = SCALE; ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2 + sag, p1.x, p1.y); ctx.stroke();
      for (let i = 1; i < n; i++) {
        const u = i / n, x = (1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * (p0.x + p1.x) / 2 + u * u * p1.x, y = (1 - u) * (1 - u) * p0.y + 2 * (1 - u) * u * ((p0.y + p1.y) / 2 + sag) + u * u * p1.y;
        const sway = Math.sin(now / 400 + i) * SCALE;
        ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.moveTo(x - 4 * SCALE, y); ctx.lineTo(x + 4 * SCALE, y); ctx.lineTo(x + sway, y + 8 * SCALE); ctx.closePath(); ctx.fill();
      }
    } });
  }
}
function revivalDecor(stage, ents, ox, oy, now, night) {
  /* Bustling: pastel bunting round the square. Thriving: paper lanterns across it that glow after dark. In Bloom: gold. */
  const cols = stage >= 4 ? ["#f2c744", "#fff2a0", "#f29ac0"] : ["#f29ac0", "#fff2a0", "#9fe0c8", "#a8c8f0"];
  bunting([[[27, 14], [45, 14]], [[27, 30], [45, 30]]], cols, ents, ox, oy, now);
  if (stage < 3) return;
  for (const [[ax, ay], [bx, by]] of LANTERN_LINES) {
    const p0 = { x: ox + ax * T + T / 2, y: oy + ay * T - 10 * SCALE }, p1 = { x: ox + bx * T + T / 2, y: oy + by * T - 10 * SCALE }, sag = 12 * SCALE;
    ents.push({ y: ay - 0.1, draw: () => {
      ctx.strokeStyle = "rgba(60,40,20,.85)"; ctx.lineWidth = SCALE; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo((p0.x + p1.x) / 2, p0.y + sag, p1.x, p1.y); ctx.stroke();
      for (const [lx, ly, col] of lanternSpots(ox, oy, now).filter((l) => l[3] === ay)) ctx.drawImage(Art.lanternSprite(col, false), lx - 6 * SCALE, ly, 12 * SCALE, 16 * SCALE);
    } });
  }
}
const LANTERN_LINES = [[[27, 22], [45, 22]], [[30, 18], [42, 18]]];
function lanternSpots(ox, oy, now) {
  /* where each paper lantern hangs on its string (screen x, y, colour, the string's row) */
  const out = [];
  for (const [[ax, ay], [bx, by]] of LANTERN_LINES) {
    const p0 = { x: ox + ax * T + T / 2, y: oy + ay * T - 10 * SCALE }, p1 = { x: ox + bx * T + T / 2, y: oy + by * T - 10 * SCALE }, sag = 12 * SCALE, n = Math.round((bx - ax) / 2);
    for (let i = 1; i < n; i++) {
      const u = i / n, x = (1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * (p0.x + p1.x) / 2 + u * u * p1.x, y = (1 - u) * (1 - u) * p0.y + 2 * (1 - u) * u * (p0.y + sag) + u * u * p1.y;
      out.push([x, y + Math.sin(now / 700 + i) * SCALE, ["red", "gold", "pink", "teal"][i % 4], ay]);
    }
  }
  return out;
}
// ------------------------------------------------------------------ the little things that make it feel alive
// Particles live in the world (tile units): dust from footsteps, soil from the hoe, chips from the axe and pickaxe, drops from the
// can, sparkles from a harvest, hearts for a happy animal. Some sit on the ground, some fly; all are tiny squares, like the art.
const parts = [];
function spawn(p) { p.t0 = p.t0 || performance.now(); if (parts.length > 320) parts.splice(0, parts.length - 320); parts.push(p); }
function burst(n, base, spread) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, sp = (spread.speed || 1.5) * (0.5 + Math.random());
    spawn(Object.assign({}, base, { x: base.x + (Math.random() - 0.5) * (spread.r || 0.3), y: base.y + (Math.random() - 0.5) * (spread.r || 0.3) * 0.6,
      vx: Math.cos(a) * sp * (spread.flat ? 1 : 0.7), vy: Math.sin(a) * sp * 0.35, vz: (spread.up || 2) * (0.6 + Math.random() * 0.6), z: base.z || 0.2,
      col: Array.isArray(base.col) ? base.col[i % base.col.length] : base.col, life: (base.life || 500) * (0.75 + Math.random() * 0.5) }));
  }
}
function drawParts(layer, ox, oy, now, dt, loc) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i], age = now - p.t0;
    if (age > p.life) { parts.splice(i, 1); continue; }
    if ((p.layer || "air") !== layer || p.loc !== loc) continue;
    const u = age / p.life;
    if (p.kind !== "ring") {                                     // a little physics: drift, fall, bounce once, settle
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
      if (p.vz !== undefined) { p.vz -= (p.g === undefined ? 9 : p.g) * dt; p.z = (p.z || 0) + p.vz * dt; if (p.z < 0) { p.z = 0; p.vz = Math.abs(p.vz) > 1 ? -p.vz * 0.35 : 0; p.vx *= 0.5; p.vy *= 0.5; } }
    }
    const sx = ox + p.x * T, sy = oy + (p.y - (p.z || 0)) * T, a = p.fade === false ? 1 : Math.min(1, (1 - u) * 1.6);
    ctx.globalAlpha = a;
    if (p.kind === "ring") {
      const r = (0.12 + u * (p.r || 0.45)) * T;
      ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(1, SCALE * 0.75); ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.45, 0, 0, 6.3); ctx.stroke();
    } else if (p.kind === "heart") {
      const z = SCALE, hx = Math.round(sx - 3 * z), hy = Math.round(sy - 3 * z);
      ctx.fillStyle = OUTLINE; ctx.fillRect(hx - z, hy, 8 * z, 4 * z); ctx.fillRect(hx, hy - z, 6 * z, 6 * z); ctx.fillRect(hx + z, hy + 5 * z, 4 * z, z); ctx.fillRect(hx + 2 * z, hy + 6 * z, 2 * z, z);
      ctx.fillStyle = p.col; ctx.fillRect(hx, hy, 2 * z, 4 * z); ctx.fillRect(hx + 4 * z, hy, 2 * z, 4 * z); ctx.fillRect(hx + z, hy + z, 4 * z, 4 * z); ctx.fillRect(hx + 2 * z, hy + 5 * z, 2 * z, z);
      ctx.fillStyle = "#ffd6e6"; ctx.fillRect(hx + z, hy + z, z, z);
    } else if (p.kind === "print") {
      const z = SCALE; ctx.fillStyle = p.col;
      if (p.vert) { ctx.fillRect(Math.round(sx - z), Math.round(sy - 3 * z), 2 * z, 3 * z); ctx.fillRect(Math.round(sx - z), Math.round(sy + z), 2 * z, 2 * z); }   // toe and heel
      else { ctx.fillRect(Math.round(sx - 3 * z), Math.round(sy - z), 3 * z, 2 * z); ctx.fillRect(Math.round(sx + z), Math.round(sy - z), 2 * z, 2 * z); }
    } else if (p.kind === "fish") {
      if (p.z <= 0 && age > 100) { p.life = 0; continue; }
      const z = SCALE, up = p.vz > 0;
      ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); if (p.vx < 0) ctx.scale(-1, 1); ctx.rotate(up ? -0.5 : 0.5);
      ctx.fillStyle = OUTLINE; ctx.fillRect(-4 * z, -2 * z, 8 * z, 4 * z); ctx.fillStyle = "#4a86c8"; ctx.fillRect(-3 * z, -z, 6 * z, 2 * z); ctx.fillStyle = "#a8d8f0"; ctx.fillRect(-2 * z, 0, 4 * z, z);
      ctx.fillStyle = OUTLINE; ctx.fillRect(-6 * z, -2 * z, 2 * z, 4 * z); ctx.fillStyle = "#1a1210"; ctx.fillRect(2 * z, -z, z, z);
      ctx.restore();
    } else if (p.kind === "icon") {
      const s2 = 16 * SCALE * (u < 0.15 ? 0.6 + u / 0.15 * 0.4 : 1);
      ctx.drawImage(itemIcon(p.key, catalog), Math.round(sx - s2 / 2), Math.round(sy - s2 / 2), s2, s2);
    } else if (p.kind === "star") {
      const z = SCALE, s2 = Math.max(1, Math.round((1 - u * 0.6) * (p.size || 1.5))) * z;
      ctx.fillStyle = p.col; ctx.fillRect(Math.round(sx - s2 / 2), Math.round(sy - s2 * 1.5), s2, s2 * 3); ctx.fillRect(Math.round(sx - s2 * 1.5), Math.round(sy - s2 / 2), s2 * 3, s2);
    } else {
      const sz = Math.max(1, Math.round((p.size || 1.5) * (p.shrink === false ? 1 : 1 - u * 0.5))) * SCALE;
      ctx.fillStyle = p.col; ctx.fillRect(Math.round(sx - sz / 2), Math.round(sy - sz / 2), sz, sz);
    }
  }
  ctx.globalAlpha = 1;
}
const OUTLINE = "#2b1f17";
const camLead = { x: 0, y: 0 };
function leanCam(dt) {
  /* the camera looks a little ahead of where we're walking, and settles back when we stop */
  const k = 1 - Math.exp(-3.5 * dt);
  camLead.x += (my.vx * 0.28 - camLead.x) * k; camLead.y += (my.vy * 0.22 - camLead.y) * k;
}
let shake = null;
const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function shakeCam(mag, ms) { if (!calm) shake = { mag: mag * SCALE, until: performance.now() + ms, ms }; }
function shakeOffset(now) {
  if (!shake || now > shake.until) return [0, 0];
  const k = (shake.until - now) / shake.ms * shake.mag;
  return [Math.round((Math.random() - 0.5) * 2 * k), Math.round((Math.random() - 0.5) * 2 * k)];
}
function groundAt(loc, x, y) {
  /* what's underfoot: "path", "grass", "soil", "snow", "sand", "wood" or "stone" */
  const rows = curMap(), ch = (rows[y] || "")[x];
  if (!isOutdoor(loc)) return ch === "r" ? "rug" : "wood";
  if (/^(mine|deep)/.test(loc)) return "stone";
  const winter = state && state.season === "winter" && loc !== "island";
  if (loc === "farm") { const d = tiles[x + "," + y]; if (d && d.s) return "soil"; }
  const g = (RG[y] || [])[x] || ch;
  if (g === "H") return "wood";
  if (g === "," || g === "z") return winter && g === "," ? "snow" : "sand";
  if (g === ":" || g === "d" || g === "=" || g === "r" || g === "v") return winter ? "snow" : g === "=" ? "stone" : "path";
  return winter ? "snow" : "grass";
}
const STEP_LOOK = { path: ["#d9c29a", "#c9ae82"], sand: ["#f0dfb4", "#e2cc98"], soil: ["#8a5a34", "#a8744a"], grass: ["#7cc25a", "#5fa046", "#a8d86a"],
  snow: ["#ffffff", "#e8f2ff"], stone: ["#b8b2a8", "#9a948a"], wood: ["#c9a06a", "#a67c4a"], rug: ["#c9a06a"] };
function kickDust(x, y, vx, vy, loc) {
  /* a runner (or a horse) kicks up little square puffs behind them, in the colour of the ground */
  const [fx, fy] = footTile(x, y), g = groundAt(loc, fx, fy);
  if (g === "wood" || g === "rug") return;
  const cols = STEP_LOOK[g] || STEP_LOOK.path, sp = Math.hypot(vx, vy) || 1;
  for (let i = 0; i < 3; i++) spawn({ x: x + 0.5 + (Math.random() - 0.5) * 0.3, y: y + 0.92, z: 0.05, vx: -vx / sp * (0.6 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.6, vy: -vy / sp * 0.3,
    vz: 0.8 + Math.random() * 0.8, g: g === "grass" ? 6 : 2.5, loc, layer: "ground", col: cols[i % cols.length], life: 380 + Math.random() * 160, size: g === "grass" ? 1 : 1.7 });
}
function footsteps(now, loc) {
  /* a puff (or a few grass bits, or snow) at each footfall, and the softest step sound */
  if (my.dist - (my.lastStepDist || 0) < 0.95) return;
  my.lastStepDist = my.dist;
  const [fx, fy] = footTile(my.x, my.y), g = groundAt(loc, fx, fy), cols = STEP_LOOK[g] || STEP_LOOK.path;
  const base = { x: my.x + 0.5, y: my.y + 0.93, loc, layer: "ground", col: cols, life: g === "grass" ? 420 : 360, size: g === "grass" ? 1 : 1.6, g: g === "grass" ? 7 : 2 };
  if (g === "snow" || g === "sand") { my.foot = !my.foot; const [dx, dy] = DELTA[my.dir], side = my.foot ? 0.12 : -0.12; spawn({ kind: "print", x: my.x + 0.5 + (dy ? side : 0), y: my.y + 0.9 + (dx ? side * 0.6 : 0), vert: !!dy, loc, layer: "ground", col: g === "snow" ? "rgba(140,160,195,.65)" : "rgba(140,105,60,.5)", life: 5000, fade: true }); }
  if (g === "grass") { if (Math.random() < 0.55) burst(2, base, { up: 1.4, speed: 0.9, r: 0.25 }); }
  else if (g !== "rug" && g !== "wood") burst(g === "snow" ? 4 : 3, base, { up: 0.7, speed: 0.8, r: 0.3, flat: true });
  sfx("step", g);
}
function toolImpact(sw) {
  /* the moment a swing lands: soil flies from the hoe, water splashes from the can, chips fly from the axe and pickaxe */
  if (sw.x === undefined || sw.done) return;
  sw.done = true;
  const loc = sw.loc || curLoc(), x = sw.x + 0.5, y = sw.y + 0.7, mine = sw.who === prefs.name;
  if (sw.tool === "hoe") { burst(8, { x, y, loc, col: ["#8a5a34", "#a8744a", "#6b4629"], life: 520, size: 1.6 }, { up: 2.6, speed: 1.6 }); if (mine) sfx("dig"); }
  else if (sw.tool === "watering_can") { burst(9, { x, y: y - 0.1, loc, col: ["#7fd0f4", "#bfeaff", "#4aa3df"], life: 480, size: 1.2, g: 11 }, { up: 1.2, speed: 1.4 }); spawn({ kind: "ring", x, y: y + 0.1, loc, layer: "ground", col: "rgba(190,235,255,.9)", life: 520, r: 0.5 }); }
  else if (sw.tool === "pickaxe") { burst(9, { x, y: y - 0.2, loc, col: ["#9a948a", "#c7c1b5", "#6c6964", "#fff2a0"], life: 520, size: 1.5 }, { up: 3, speed: 2 }); if (mine) { shakeCam(1.6, 140); sfx("tink"); } }
  else if (sw.tool === "axe") { burst(9, { x, y: y - 0.3, loc, col: ["#c9a06a", "#e6c48a", "#8a5a34", "#5fa046"], life: 560, size: 1.6 }, { up: 3, speed: 2 }); if (mine) { shakeCam(1.4, 140); sfx("chop"); } }
  else if (sw.tool === "scythe") burst(8, { x, y: y - 0.1, loc, col: ["#7cc25a", "#a8d86a", "#5fa046"], life: 520, size: 1.2, g: 6 }, { up: 2, speed: 2.2 });
  else if (sw.tool === "sword") burst(6, { x, y: y - 0.4, loc, col: ["#ffffff", "#fff2a0"], life: 300, size: 1.2, g: 0 }, { up: 0, speed: 3 });
  else if (sw.tool === "hand") {
    for (let i = 0; i < 5; i++) spawn({ kind: "star", x: x + (Math.random() - 0.5) * 0.6, y: y - 0.3, z: 0.2 + Math.random() * 0.4, vz: 1.2 + Math.random(), g: 1.5, loc, col: ["#fff2a0", "#ffffff", "#ffd84a"][i % 3], life: 600, size: 1.4 });
    const animal = (state.cows || []).some((c) => c.x === sw.x && c.y === sw.y) || (state.chickens || []).some((c) => c.x === sw.x && c.y === sw.y);
    if (animal) for (let i = 0; i < 3; i++) spawn({ kind: "heart", x: x + (i - 1) * 0.3, y: y - 0.6, z: 0.3, vz: 1.4 + i * 0.3, g: 1.2, loc, col: "#ff6b9d", life: 900 });
  }
}
// rustling: grass and flowers sway when you walk through them, bushes and trees shiver when you bump them
const rustle = new Map();
function rustleAmt(x, y, now) {
  const t0 = rustle.get(x + "," + y); if (t0 === undefined) return 0;
  const t = (now - t0) / 1000; if (t > 0.75) { rustle.delete(x + "," + y); return 0; }
  return Math.sin(t * 26) * 0.32 * (1 - t / 0.75);
}
function swayDraw(img, x, y, w, h, amt) {
  if (!amt) { ctx.drawImage(img, x, y, w, h); return; }
  ctx.save(); ctx.translate(x + w / 2, y + h); ctx.transform(1, 0, -amt, 1, 0, 0); ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore();
}
function hasDecor(x, y) {
  const M = curMap(), loc = curLoc();
  if (!isOutdoor(loc) || AREA_BASE[loc] || (M[y] || "")[x] !== "." || (loc === "farm" ? tiles : areaTiles(loc))[x + "," + y]) return false;
  const h = hash(x * 5 + 2, y * 3 + 1), n = Art.noise2(x, y);
  return (h % 100) / 100 <= 0.10 + n * 0.12;
}
function leaves(x, y, loc, cols, n) { burst(n, { x: x + 0.5, y: y + 0.6, z: 0.5, loc, col: cols, life: 900, size: 1.2, g: 1.6 }, { up: 1.2, speed: 0.9, r: 0.5 }); }
function brushPast(x, y, now) {
  const loc = curLoc(), ch = (curMap()[y] || "")[x];
  if (hasDecor(x, y) || ch === "f") { rustle.set(x + "," + y, now); leaves(x, y, loc, ch === "f" ? ["#ff9cc6", "#ffe066", "#7cc25a"] : ["#7cc25a", "#a8d86a"], 2); }
}
function bumpInto(now) {
  /* leaning on a bush or a tree gives it a shake (and shakes a few leaves loose), like nudging one in Stardew */
  const [dx, dy] = DELTA[my.dir], x = my.tx + dx, y = my.ty + dy, key = x + "," + y, ch = (curMap()[y] || "")[x];
  const d = (curLoc() === "farm" ? tiles : areaTiles(curLoc()))[key] || {};
  if (!("uTPA".includes(ch) || d.t) || now - (bumped.get(key) || 0) < 650) return;
  bumped.set(key, now); rustle.set(key, now);
  leaves(x, y - (ch === "u" ? 0 : 0.6), curLoc(), ch === "u" ? ["#ff9ccf", "#5fb04a", "#8ed66a"] : state && state.season === "fall" ? ["#e0802a", "#c8582a", "#f2c744"] : state && state.season === "winter" ? ["#ffffff", "#e8f2ff"] : ["#5fb04a", "#8ed66a", "#3f8f3a"], ch === "u" ? 3 : 4);
}
const bumped = new Map();
const GREETS = ["Hi!", "Hey!", "Oh, hi!", "♪", "Hello!", "Howdy!"];
let lastGreet = 0;

// the prompt: what E does to whatever's in front of you, in a little bubble over it (like Animal Crossing's button prompts)
let promptKey = "", promptVerb = "", promptAt = 0;
function promptFor() {
  const [dx, dy] = DELTA[my.dir], fx = my.tx + dx, fy = my.ty + dy, loc = curLoc(), sel = heldItem(), it = sel && catalog.items[sel], kind = it ? it.kind : null;
  if ((state.npcs || []).some((n) => n.loc === loc && n.x === fx && n.y === fy)) return "Chat";
  if (isOutdoor(loc)) {
    const d = (loc === "farm" ? tiles : areaTiles(loc))[fx + "," + fy] || {}, ch = (curMap()[fy] || "")[fx];
    if (d.c) return d.c[2] ? "Harvest" : sel === "watering_can" && !d.w ? "Water" : "";
    if (d.g) return "Pick up";
    if (d.o) return sel === "pickaxe" ? "Mine" : "";
    if (d.t) return d.t[2] ? "Pick fruit" : sel === "axe" ? "Chop" : "";
    if (d.m) return d.m[1] === 2 ? "Collect" : "Use";
    if (d.s) return (kind === "seed" || kind === "sapling") ? "Plant" : sel === "watering_can" && !d.w ? "Water" : "";
    if (loc === "farm" && ch === "d" && sel === "hoe") return "Till";
    if (ch === "~") return sel === "fishing_rod" ? "Cast" : sel === "watering_can" ? "Refill" : "";
  }
  const text = describeHere(), i = text.indexOf("Ahead:");
  if (i < 0) return "";
  const m = /\bE (?:to|for) (?:the )?([^,.!;(]+)/.exec(text.slice(i));
  if (!m) return "";
  let v = m[1].trim().replace(/^your /, "").replace(/ it$/, "");
  if (v.length > 18) v = v.slice(0, 17).replace(/\s+\S*$/, "") + "…";
  return v.charAt(0).toUpperCase() + v.slice(1);
}
function drawPrompt(ox, oy, now) {
  if (!my.ready || mode !== "play" || my.stepping || my.route) { promptKey = ""; return; }
  const [dx, dy] = DELTA[my.dir], fx = my.tx + dx, fy = my.ty + dy;
  const key = curLoc() + fx + "," + fy + heldItem() + (state && state.now);
  if (key !== promptKey) { const v = promptFor(); if (v !== promptVerb) promptAt = now; promptVerb = v; promptKey = key; }
  if (!promptVerb) return;
  const npc = (state.npcs || []).find((n) => n.loc === curLoc() && n.x === fx && n.y === fy);
  const t = Math.min(1, (now - promptAt) / 160), pop = t < 1 ? 0.6 + 0.4 * Math.sin(t * Math.PI / 2) + 0.12 * Math.sin(t * Math.PI) : 1;
  const nv = npc && npcViz[npc.n], talking = nv && (nv.b || (nv.hi && now < nv.hi.until) || (me && me.quest_marks && me.quest_marks[npc.n]));
  const bx = ox + (fx + 0.5) * T, by = oy + (fy - (npc ? (talking ? 1.85 : 1.25) : 0.35)) * T + Math.sin(now / 260) * 1.5 * SCALE;
  ctx.save(); ctx.translate(bx, by); ctx.scale(pop, pop);
  ctx.font = "600 " + 7 * SCALE + "px 'Pixelify Sans', 'Trebuchet MS', sans-serif"; ctx.textBaseline = "middle";
  const tw = ctx.measureText(promptVerb).width, kw = 9 * SCALE, w = kw + tw + 7 * SCALE, h = 11 * SCALE;
  ctx.fillStyle = "rgba(43,31,23,.92)"; ctx.fillRect(-w / 2, -h, w, h); ctx.fillRect(-w / 2 + SCALE, -h - SCALE, w - 2 * SCALE, h + 2 * SCALE);
  ctx.fillRect(-2 * SCALE, 0, 4 * SCALE, SCALE); ctx.fillRect(-SCALE, SCALE, 2 * SCALE, SCALE);
  ctx.fillStyle = "#fbeec8"; ctx.fillRect(-w / 2 + 2 * SCALE, -h + 2 * SCALE, kw - SCALE, h - 4 * SCALE);
  ctx.fillStyle = "#3a2a1a"; ctx.textAlign = "center"; ctx.fillText("E", -w / 2 + 2 * SCALE + (kw - SCALE) / 2, -h / 2 + SCALE / 2);
  ctx.fillStyle = "#fbeec8"; ctx.textAlign = "left"; ctx.fillText(promptVerb, -w / 2 + kw + 3 * SCALE, -h / 2 + SCALE / 2);
  ctx.restore();
}

// birds: a few sparrows hop and peck about on the grass, and take off in a flurry if you come too close
const birds = [];
const BIRD_COLS = [["#8a5a34", "#c9a06a", "#5a3a22"], ["#4a7fd0", "#a8c8f0", "#2e4a8a"], ["#7a5a4a", "#e0603a", "#4a3428"]];
let birdNext = 0;
function updateBirds(now, dt, loc, M, x0, y0, x1, y1, night) {
  for (let i = birds.length - 1; i >= 0; i--) if (birds[i].loc !== loc || birds[i].z > 7 || birds[i].x < x0 - 6 || birds[i].x > x1 + 6) birds.splice(i, 1);
  if (night < 0.3 && birds.length < 4 && now > birdNext && my.ready && !AREA_BASE[loc]) {
    birdNext = now + 2500 + Math.random() * 3000;
    for (let tries = 0; tries < 12; tries++) {
      const x = x0 + 1 + Math.floor(Math.random() * Math.max(1, x1 - x0 - 2)), y = y0 + 1 + Math.floor(Math.random() * Math.max(1, y1 - y0 - 2));
      if ((M[y] || "")[x] !== "." || Math.hypot(x - my.x, y - my.y) < 5 || !walkable(x, y)) continue;
      const n = 1 + Math.floor(Math.random() * 2);
      for (let k = 0; k < n; k++) birds.push({ loc, x: x + 0.3 + Math.random() * 0.4 + k * 0.5, y: y + 0.5 + Math.random() * 0.3, z: 0, vx: 0, vy: 0, vz: 0, fly: false, next: now + Math.random() * 800, f: Math.random() < 0.5 ? -1 : 1, col: BIRD_COLS[(x + y) % BIRD_COLS.length], peck: 0 });
      break;
    }
  }
  const fast = Math.hypot(my.vx, my.vy) > WALK_SPEED * 1.2;
  for (const b of birds) {
    if (!b.fly) {
      const d = Math.hypot(b.x - (my.x + 0.5), b.y - (my.y + 0.8));
      if (my.ready && d < (fast ? 3.6 : 2.4)) {                        // startled: up and away
        b.fly = true; const a = Math.atan2(b.y - my.y - 0.8, b.x - my.x - 0.5);
        b.vx = Math.cos(a) * 4.5 + (Math.random() - 0.5); b.vy = Math.sin(a) * 2; b.vz = 3.2 + Math.random(); b.f = b.vx < 0 ? -1 : 1;
        if (b === birds.find((o) => o.fly)) sfx("chirp");
        continue;
      }
      if (now > b.next) {                                               // hop, or peck at the ground
        b.next = now + 500 + Math.random() * 1300;
        if (Math.random() < 0.55) { b.f = Math.random() < 0.5 ? -1 : 1; const nx = b.x + b.f * (0.25 + Math.random() * 0.35); if (walkable(Math.floor(nx), Math.floor(b.y))) { b.hopFrom = b.x; b.hopTo = nx; b.hopT = now; } }
        else b.peck = now;
      }
      if (b.hopT) { const u = (now - b.hopT) / 220; if (u >= 1) { b.x = b.hopTo; b.hopT = 0; b.z = 0; } else { b.x = b.hopFrom + (b.hopTo - b.hopFrom) * u; b.z = Math.sin(u * Math.PI) * 0.18; } }
    } else { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz += 0.8 * dt; }
  }
}
function drawBirds(ox, oy, now, loc) {
  const z = SCALE;
  for (const b of birds) {
    if (b.loc !== loc) continue;
    const sx = Math.round(ox + b.x * T), sy = Math.round(oy + b.y * T), by = Math.round(sy - b.z * T);
    ctx.fillStyle = "rgba(0,0,0," + (0.18 * Math.max(0, 1 - b.z / 3)).toFixed(3) + ")"; ctx.fillRect(sx - 3 * z, sy - z, 6 * z, 2 * z);
    const [body, belly, dark] = b.col, flap = b.fly ? Math.floor(now / 70) % 2 : 0, pk = !b.fly && b.peck && now - b.peck < 260 ? 2 : 0;
    ctx.save(); ctx.translate(sx, by); if (b.f < 0) ctx.scale(-1, 1);
    ctx.fillStyle = OUTLINE; ctx.fillRect(-4 * z, -5 * z, 8 * z, 4 * z); ctx.fillRect(1 * z, (-7 + pk) * z, 4 * z, 4 * z);
    ctx.fillStyle = body; ctx.fillRect(-3 * z, -4 * z, 6 * z, 2 * z); ctx.fillStyle = belly; ctx.fillRect(-2 * z, -3 * z, 4 * z, z);
    ctx.fillStyle = dark; ctx.fillRect(2 * z, (-6 + pk) * z, 2 * z, 2 * z); ctx.fillStyle = "#f2a33a"; ctx.fillRect(4 * z, (-5 + pk) * z, z, z);
    ctx.fillStyle = "#1a1210"; ctx.fillRect(3 * z, (-6 + pk) * z, z, z); ctx.fillStyle = dark; ctx.fillRect(-5 * z, -5 * z, 2 * z, z);
    if (b.fly) { ctx.fillStyle = body; if (flap) ctx.fillRect(-2 * z, -8 * z, 3 * z, 3 * z); else ctx.fillRect(-2 * z, -3 * z, 3 * z, 2 * z); }
    else { ctx.fillStyle = "#f2a33a"; ctx.fillRect(-z, -z, z, z); ctx.fillRect(z, -z, z, z); }
    ctx.restore();
  }
}
// now and then a fish jumps in a pond, the river or the sea
let fishNext = 0;
function fishJumps(now, dt, loc, M, x0, y0, x1, y1) {
  if (now < fishNext) return;
  fishNext = now + 2500 + Math.random() * 4500;
  for (let tries = 0; tries < 10; tries++) {
    const x = x0 + Math.floor(Math.random() * (x1 - x0 + 1)), y = y0 + Math.floor(Math.random() * (y1 - y0 + 1));
    if ((M[y] || "")[x] !== "~" || (M[y] || "")[x + 1] !== "~" || (M[y - 1] || "")[x] !== "~") continue;
    const dir = Math.random() < 0.5 ? -1 : 1, fx = x + 0.5, fy = y + 0.5;
    spawn({ kind: "ring", x: fx, y: fy, loc, layer: "ground", col: "rgba(220,245,255,.85)", life: 600, r: 0.45 });
    spawn({ kind: "fish", x: fx, y: fy, vx: dir * 1.1, z: 0, vz: 3.1, g: 9, loc, col: "#2e5a8a", life: 720, fade: false, shrink: false, size: 2 });
    setTimeout(() => spawn({ kind: "ring", x: fx + dir * 0.8, y: fy, loc, layer: "ground", col: "rgba(220,245,255,.85)", life: 600, r: 0.4 }), 680);
    break;
  }
}
// picking things up: a little card slides in at the bottom left (merging repeats, like Stardew's), and the item pops over your head
let lastInv = null;
function noticePickups() {
  const inv = {}; for (const [k, n] of (me && me.inventory) || []) inv[k] = (inv[k] || 0) + n;
  if (lastInv) for (const k in inv) { const d = inv[k] - (lastInv[k] || 0); if (d > 0 && !TOOLS.has(k)) gotItem(k, d); }
  lastInv = inv;
}
function gotItem(key, n) {
  const box = $("#pickups"); if (!box || !catalog || !catalog.items[key]) return;
  const now = performance.now(), it = catalog.items[key];
  let row = box.lastElementChild;
  if (row && row.dataset.key === key && now - +row.dataset.at < 2500) { row.dataset.n = +row.dataset.n + n; row.querySelector(".n").textContent = "×" + row.dataset.n; row.classList.remove("bump"); void row.offsetWidth; row.classList.add("bump"); }
  else {
    row = el("div", "pick"); row.dataset.key = key; row.dataset.n = n;
    const c = blank(32, 32); c.getContext("2d").drawImage(itemIcon(key, catalog), 0, 0); row.appendChild(c);
    row.appendChild(el("span", "name", it.name)); row.appendChild(el("b", "n", "×" + n));
    box.appendChild(row); while (box.children.length > 5) box.firstElementChild.remove();
  }
  row.dataset.at = now;
  clearTimeout(row._t); row._t = setTimeout(() => { row.classList.add("out"); setTimeout(() => row.remove(), 400); }, 2800);
  if (my.ready) spawn({ kind: "icon", key, x: my.x + 0.5, y: my.y + 0.1, z: 0.5, vz: 1.6, g: 2.2, loc: curLoc(), life: 760, fade: true });
}
// the coin counter rolls up (or down) to the new total instead of jumping, with a little flash
let coinShown = null, coinTarget = null, coinAt = 0;
function rollCoins(now) {
  if (coinTarget === null) return;
  if (coinShown === null) coinShown = coinTarget;
  const dt = Math.min(0.1, (now - (coinAt || now)) / 1000); coinAt = now;
  if (coinShown !== coinTarget) {
    const diff = coinTarget - coinShown, step = Math.sign(diff) * Math.max(1, Math.abs(diff) * Math.min(1, dt * 7));
    coinShown = Math.abs(step) >= Math.abs(diff) ? coinTarget : Math.round(coinShown + step);
  }
  setText($("#coins"), coinShown + "g");
}
let fade = null;
function startFade() { fade = { dir: "out", t0: performance.now() }; }
function fadeIn() { if (fade) fade = { dir: "in", t0: performance.now() }; }
function drawFade(now, cw, ch) {
  /* doors and map edges dip to black and back, like walking into another room */
  if (!fade) return;
  const t = now - fade.t0;
  let a;
  if (fade.dir === "out") { a = Math.min(1, t / 140); if (t > 1600) fadeIn(); }
  else { a = 1 - t / 300; if (a <= 0) { fade = null; return; } }
  ctx.fillStyle = "rgba(12,10,8," + a.toFixed(3) + ")"; ctx.fillRect(0, 0, cw, ch);
}
function drawClickMark(ox, oy, now) {
  if (!clickMark) return;
  const t = (now - clickMark.t0) / 450; if (t > 1) { clickMark = null; return; }
  const cx = ox + (clickMark.x + 0.5) * T, cy = oy + (clickMark.y + 0.8) * T, r = (0.2 + t * 0.25) * T;
  ctx.strokeStyle = clickMark.bad ? "rgba(255,120,110," + (1 - t) + ")" : "rgba(255,250,210," + (1 - t) + ")"; ctx.lineWidth = SCALE;
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.45, 0, 0, 6.3); ctx.stroke();
}
let rockets = [], sparks = [], nextRocket = 0;
function fireworks(now, cw, ch, dt) {
  /* the Bloom Festival's fireworks: rockets climb from below, burst into rings of sparks that drift down and fade */
  if (now > nextRocket) {
    nextRocket = now + 350 + Math.random() * 900;
    rockets.push({ x: cw * (0.15 + Math.random() * 0.7), y: ch, vy: -(ch * (0.55 + Math.random() * 0.25)), top: ch * (0.12 + Math.random() * 0.25), col: ["#ff7eb6", "#ffe066", "#7fd8e8", "#a8f07a", "#ffffff", "#ff9c4a"][Math.floor(Math.random() * 6)] });
  }
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  rockets = rockets.filter((r) => {
    r.y += r.vy * dt; ctx.fillStyle = "#fff2c0"; ctx.fillRect(r.x - SCALE, r.y, 2 * SCALE, 4 * SCALE);
    if (r.y > r.top) return true;
    const n = 30 + Math.floor(Math.random() * 14), sp = (70 + Math.random() * 60) * SCALE / 2, col2 = ["#ff7eb6", "#ffe066", "#7fd8e8", "#a8f07a", "#ff9c4a"][Math.floor(Math.random() * 5)];
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, col: r.col }); }
    for (let i = 0; i < n / 2; i++) { const a = (i / (n / 2)) * 6.283 + 0.1; sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp * 0.5, vy: Math.sin(a) * sp * 0.5, life: 0.8, col: col2 }); }
    return false;
  });
  sparks = sparks.filter((s) => {
    s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 40 * SCALE * dt; s.vx *= 0.985; s.life -= dt * 0.7;
    if (s.life <= 0) return false;
    const sz = (s.life > 0.6 ? 3 : 2) * SCALE;
    ctx.globalAlpha = Math.max(0, s.life); ctx.fillStyle = s.col; ctx.fillRect(s.x, s.y, sz, sz);
    ctx.globalAlpha = Math.max(0, s.life * 0.35); ctx.fillRect(s.x - s.vx * 0.04, s.y - s.vy * 0.04, SCALE, SCALE);
    return true;
  });
  ctx.restore();
}
let cerPetals = [];
function drawCeremony(now, cw, ch, dt) {
  /* a stage-up: a banner for everyone and cerPetals drifting down for a few seconds */
  const c = state.ceremony;
  if (!c || c.t > 14) { cerPetals = []; return; }
  const a = c.t < 0.6 ? c.t / 0.6 : c.t > 11 ? Math.max(0, (14 - c.t) / 3) : 1;
  while (cerPetals.length < 70) cerPetals.push({ x: Math.random() * cw, y: -Math.random() * ch, p: Math.random() * 6.3, v: 30 + Math.random() * 40 });
  ctx.save(); ctx.globalAlpha = a;
  for (const pt of cerPetals) { ctx.fillStyle = ["#ff9cc6", "#ffd0e8", "#fff2a0", "#ffffff"][Math.floor(pt.p * 4) % 4]; ctx.fillRect(pt.x, pt.y, 3 * SCALE, 2 * SCALE); ctx.fillRect(pt.x + SCALE, pt.y - SCALE, SCALE, SCALE); pt.y += pt.v * dt * SCALE / 2; pt.x += Math.sin(now / 600 + pt.p) * 25 * dt; if (pt.y > ch) { pt.y = -10; pt.x = Math.random() * cw; } }
  const text = "\u2740 The valley is " + c.name + "! \u2740";
  ctx.font = "600 " + 13 * SCALE + "px 'Pixelify Sans', 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 30 * SCALE, h = 24 * SCALE, x = cw / 2 - w / 2, y = ch * 0.22;
  ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x - 2 * SCALE, y - 2 * SCALE, w + 4 * SCALE, h + 4 * SCALE);
  ctx.fillStyle = "#fbeec8"; ctx.fillRect(x, y, w, h); ctx.fillStyle = "#e9a0c8"; ctx.fillRect(x, y + h - 2 * SCALE, w, 2 * SCALE);
  ctx.fillStyle = "#6a2c48"; ctx.fillText(text, cw / 2, y + h / 2);
  ctx.restore();
}
function festivalDecor(kind, ents, ox, oy, now) {
  /* the square dressed for the day: bunting between the corner lamps, a banner over the fountain, seasonal props */
  const flagCols = { hoedown: ["#ff7eb6", "#ffe066", "#7fd8e8"], rodeo: ["#d9463c", "#f4f1ea", "#3a7bd5"], fair: ["#6cc24a", "#ffe066", "#f28c28"],
    fallfest: ["#f28c28", "#a8463a", "#ffe066"], derby: ["#7fd8e8", "#f4f1ea", "#3a7bd5"], feast: ["#d9463c", "#3fa66a", "#ffe066"] }[kind];
  const lines = [[[27, 14], [45, 14]], [[27, 30], [45, 30]], [[27, 14], [27, 30]], [[45, 14], [45, 30]], [[30, 18], [42, 18]]];
  for (const [[ax, ay], [bx, by]] of lines) {
    const p0 = { x: ox + ax * T + T / 2, y: oy + ay * T - 6 * SCALE }, p1 = { x: ox + bx * T + T / 2, y: oy + by * T - 6 * SCALE };
    const n = Math.max(4, Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y) / (0.8 * T))), sag = ax === bx ? 0 : 16 * SCALE;
    ents.push({ y: Math.min(ay, by) - 0.2, draw: () => {
      ctx.strokeStyle = "rgba(60,40,20,.9)"; ctx.lineWidth = SCALE; ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2 + sag, p1.x, p1.y); ctx.stroke();
      for (let i = 1; i < n; i++) {
        const u = i / n, x = (1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * (p0.x + p1.x) / 2 + u * u * p1.x, y = (1 - u) * (1 - u) * p0.y + 2 * (1 - u) * u * ((p0.y + p1.y) / 2 + sag) + u * u * p1.y;
        const sway = Math.sin(now / 400 + i) * SCALE;
        ctx.fillStyle = flagCols[i % 3]; ctx.beginPath(); ctx.moveTo(x - 4 * SCALE, y); ctx.lineTo(x + 4 * SCALE, y); ctx.lineTo(x + sway, y + 8 * SCALE); ctx.closePath(); ctx.fill();
      }
    } });
  }
  const title = { hoedown: "SPRING HOEDOWN", rodeo: "RODEO ROUNDUP", fair: "LIVESTOCK FAIR", fallfest: "FALLFEST", derby: "FROST FISHING DERBY", feast: "WINTER FEAST" }[kind];
  const bx = ox + 36.5 * T, by = oy + 15.2 * T;
  ents.push({ y: 15.6, draw: () => {
    const tw = Art.textWidth(title, 2) * SCALE, w = tw + 16 * SCALE, h = 16 * SCALE;
    ctx.fillStyle = "#5a3a22"; ctx.fillRect(bx - w / 2 - 2 * SCALE, by - h, 3 * SCALE, h * 2.2); ctx.fillRect(bx + w / 2 - SCALE, by - h, 3 * SCALE, h * 2.2);
    ctx.fillStyle = "#2b1f17"; ctx.fillRect(bx - w / 2 - SCALE, by - h - SCALE, w + 2 * SCALE, h + 2 * SCALE);
    ctx.fillStyle = flagCols[0]; ctx.fillRect(bx - w / 2, by - h, w, h);
    const c = blank(Art.textWidth(title, 2) + 2, 12); Art.text3x5(c.getContext("2d"), 1, 1, title, "#2b1f17", 2);
    ctx.drawImage(c, bx - tw / 2, by - h + 3 * SCALE, tw + 2 * SCALE, 12 * SCALE);
  } });
  const props = { fallfest: ["pumpkin", "h", "pumpkin", "h"], fair: ["h", "h", "B", "h"], rodeo: ["h", "B", "h", "c"], hoedown: ["f", "B", "f", "h"], derby: ["B", "c", "B", "c"], feast: ["c", "B", "c", "B"] }[kind];
  [[29, 20], [43, 20], [29, 24], [43, 24]].forEach(([x, y], i) => {
    const what = props[i], sx = ox + x * T, sy = oy + y * T;
    ents.push({ y: y + 0.4, draw: () => { if (what === "pumpkin") ctx.drawImage(Art.cropSprite("pumpkin", 3, 1), sx, sy, T, T); else ctx.drawImage(Art.propSprite(what), sx, sy, T, T); } });
  });
}
function drawFlying(loc, ox, oy, now) {
  // a present floating by on a balloon
  const b0 = state.balloon, b = b0 && balloonViz.id === b0.id ? { loc: b0.loc, x: balloonViz.x, y: balloonViz.y + Math.sin(now / 700) * 0.08 } : b0;
  if (b && b.loc === loc) {
    const sx = ox + b.x * T, sy = oy + (b.y - 3) * T;
    ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.beginPath(); ctx.ellipse(sx + T / 2, oy + b.y * T + T - 2 * SCALE, 9 * SCALE, 3 * SCALE, 0, 0, 6.3); ctx.fill();
    ctx.drawImage(Art.balloonSprite(Math.floor(now / 300) % 2), sx, sy, T, 64 * SCALE);
  }
  // arrows, bullets and stones in flight
  for (let i = shots.length - 1; i >= 0; i--) {
    const sh = shots[i], u = (now - sh.t0) / 220;
    if (u >= 1) { shots.splice(i, 1); continue; }
    const x = ox + (sh.x0 + (sh.x1 - sh.x0) * u) * T + T / 2, y = oy + (sh.y0 + (sh.y1 - sh.y0) * u) * T + T / 2 - 6 * SCALE;
    ctx.fillStyle = sh.kind === "arrow" ? "#a5713f" : sh.kind === "bullet" ? "#fff2a8" : "#9a9aa4";
    if (sh.kind === "arrow") ctx.fillRect(x - (sh.x1 !== sh.x0 ? 6 : 1) * SCALE, y - (sh.y1 !== sh.y0 ? 6 : 1) * SCALE, (sh.x1 !== sh.x0 ? 12 : 2) * SCALE, (sh.y1 !== sh.y0 ? 12 : 2) * SCALE);
    else { ctx.beginPath(); ctx.arc(x, y, 2 * SCALE, 0, 6.3); ctx.fill(); }
  }
  // puffs where something vanished (and confetti where a balloon popped)
  for (let i = poofs.length - 1; i >= 0; i--) {
    const pf = poofs[i], u = (now - pf.t0) / 500;
    if (u >= 1) { poofs.splice(i, 1); continue; }
    const cx = ox + pf.x * T + T / 2, cy = oy + pf.y * T + T / 2;
    for (let k = 0; k < (pf.pop ? 12 : 7); k++) {
      const a = k * 0.9, r = (4 + u * (pf.big ? 30 : 16)) * SCALE;
      ctx.fillStyle = pf.pop ? ["#e0403f", "#ffe066", "#3a7bd5", "#6cc24a"][k % 4] : "rgba(240,236,228," + (0.8 * (1 - u)).toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, (pf.pop ? 2 : 4 - 3 * u) * SCALE, 0, 6.3); ctx.fill();
    }
  }
}
function drawStars(cw, ch, now) {
  for (let i = stars.length - 1; i >= 0; i--) {
    const s0 = stars[i], u = (now - s0.t0) / 1400;
    if (u >= 1) { stars.splice(i, 1); continue; }
    const x = (s0.x + s0.dx * u * 0.45) * cw, y = (s0.y + u * 0.18) * ch;
    const g = ctx.createLinearGradient(x, y, x - s0.dx * 120 * SCALE, y - 50 * SCALE);
    g.addColorStop(0, "rgba(255,250,210," + (1 - u).toFixed(2) + ")"); g.addColorStop(1, "rgba(255,250,210,0)");
    ctx.strokeStyle = g; ctx.lineWidth = 2 * SCALE; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s0.dx * 120 * SCALE, y - 50 * SCALE); ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x, y, 2.5 * SCALE, 0, 6.3); ctx.fill();
  }
  if (wishStar && now > wishStar.until) { wishStar = null; $("#wish").classList.add("hidden"); }
}
function updateHudLive(now) {
  rollCoins(now);
  if (!me) return;
  const hpb = $("#hpbar"), loc = curLoc(), show = me.hp < me.max_hp || /^(mine|deep)/.test(loc);
  hpb.classList.toggle("hidden", !show);
  if (show) { setStyle($("#hpbar .fill"), "width", (100 * me.hp / me.max_hp).toFixed(0) + "%"); setText($("#hpbar .label"), "♥ " + me.hp + " / " + me.max_hp); hpb.classList.toggle("hurt", now - hurtAt < 150); }
  const d = state && state.derby && state.derby[prefs.name];
  $("#derby").classList.toggle("hidden", !d);
  if (d) setText($("#derby"), "🎣 Derby  " + Math.max(0, d[0]) + "s  ·  " + d[1] + " fish");
}
function wish() { if (wishStar) { send({ t: "wish", id: wishStar.id }); wishStar = null; $("#wish").classList.add("hidden"); } }
// ------------------------------------------------------------------ generic windows: the server sends rows, we draw them
function hatIcon(k) {
  const c = document.createElement("canvas"); c.width = 32; c.height = 32; const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  const custom = k !== "cowboy" && k !== "none";
  g.drawImage(charSprite("girl", "down", 0, "#e8dcc0", custom ? "none" : k), 0, 0, 32, 32, 0, 2, 32, 32);
  if (custom && Art.hatSprite(k, "down")) g.drawImage(Art.hatSprite(k, "down"), 0, 2);
  return c;
}
function npcIcon(name) {
  const look = (catalog.npcs || {})[name] || ["boy", "white", "none"];
  const c = document.createElement("canvas"); c.width = 32; c.height = 32; const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  const own = Art.LOOKS && Art.LOOKS[name];
  g.drawImage(charSprite(own ? name : look[0], "down", 0, COLORS[look[1]] || "#ccc", own ? "none" : look[2]), 0, 0, 32, 32, 0, 2, 32, 32);
  return c;
}
function sprIcon(spr) { const c = document.createElement("canvas"); c.width = 32; c.height = 32; const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(spr, 0, 0, 32, 32); return c; }
function renderList(d, h2, body, foot) {
  h2.textContent = d.title || "";
  if (d.sub) body.appendChild(el("p", "lsub", d.sub));
  (d.rows || []).forEach((r, i) => {
    if (r.section) { body.appendChild(el("div", "lsec", r.section)); return; }
    const row = el("div", "lrow" + (r.ok && r.act ? " ok" : "") + (r.dim ? " dim" : "") + (menu.cursor === i ? " cur" : ""));
    let ic = null;
    if (r.key && catalog.items[r.key]) ic = iconEl(r.key);
    else if (r.hat) ic = hatIcon(r.hat);
    else if (r.npc) ic = npcIcon(r.npc);
    else if (r.horse) ic = sprIcon(Art.horseSprite(r.horse, "right", 0));
    else if (r.pet) ic = sprIcon(r.shadow && Art.petShadow ? Art.petShadow(r.pet) : Art.petSprite(r.pet, "down", 0, petCoat(r.pet, r.petname)));
    else if (r.swatch) { ic = el("div", "sw"); ic.style.background = COLORS[r.swatch]; }
    else if (r.song) { ic = el("div", "sw", "♪"); ic.style.cssText = "background:#2a3a6a;color:#ffe066;text-align:center;line-height:28px;font-size:18px"; }
    else ic = el("div", "sw"), ic.style.border = "0";
    row.appendChild(ic);
    const tx = el("div", "tx"); tx.appendChild(el("div", "lb", r.label || "")); if (r.info) tx.appendChild(el("div", "in", r.info)); row.appendChild(tx);
    if (r.right) row.appendChild(el("span", "rt", r.right));
    if (r.ok && r.act) row.onclick = () => { menu.cursor = i; send(r.act); if (!d.keep) closeMenu(); };
    body.appendChild(row);
  });
  foot.textContent = d.foot || "Click a row (or arrows and Enter). Esc closes.";
}
function listKeys(e) {
  const rows = (menu.data.rows || []), ok = rows.map((r, i) => r.ok && r.act ? i : -1).filter((i) => i >= 0);
  if (!ok.length) return;
  const at = Math.max(0, ok.indexOf(menu.cursor));
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { menu.cursor = ok[(at + 1) % ok.length]; renderMenu(); e.preventDefault(); }
  else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { menu.cursor = ok[(at - 1 + ok.length) % ok.length]; renderMenu(); e.preventDefault(); }
  else if (e.key === "Enter" || e.key === " ") { const r = rows[ok.includes(menu.cursor) ? menu.cursor : ok[0]]; send(r.act); if (!menu.data.keep) closeMenu(); e.preventDefault(); }
}

// ------------------------------------------------------------------ festival minigames
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function startMinigame(game, seed) {
  const r = mulberry(seed || 1), t0 = performance.now() + 1200;
  minigame = { game, t0, score: 0, done: false, hits: 0, msg: "" };
  if (game === "dance") { minigame.notes = []; let t = t0 + 800; for (let i = 0; i < 26; i++) { minigame.notes.push({ lane: Math.floor(r() * 4), t, hit: 0 }); t += 520 + Math.floor(r() * 3) * 180; } minigame.end = t + 900; }
  if (game === "rodeo") { minigame.pos = 0; minigame.vel = 0; minigame.push = 0; minigame.end = t0 + 15000; minigame.r = r; }
  if (game === "apples") { minigame.tries = 5; minigame.phase = r() * 6; minigame.end = Infinity; }
  openMenu("mg", { game }); mode = "minigame";
  mgKick();
}
let mgRaf = 0;
function mgKick() { if (!mgRaf) mgRaf = requestAnimationFrame(mgFrame); }   // exactly one animation loop, however often the window redraws
function mgFinish(score) {
  if (!minigame || minigame.done) return;
  minigame.done = true; minigame.score = Math.max(0, Math.min(100, Math.round(score)));
  send({ t: "minigame_done", game: minigame.game, score: minigame.score });
  setTimeout(() => { if (mode === "minigame") { mode = "menu"; } }, 1200);
}
function mgFrame(now) {
  mgRaf = 0;
  const mg = minigame; if (!mg || !menu || menu.kind !== "mg") return;
  const cv = document.querySelector("#menu .mg canvas"); if (!cv) return;
  const dt = Math.min(0.05, (now - (mg.last || now)) / 1000); mg.last = now;
  const g = cv.getContext("2d"), W = cv.width, H = cv.height;
  g.fillStyle = "#3a2a1a"; g.fillRect(0, 0, W, H);
  const status = document.querySelector("#menu .mgs");
  if (mg.game === "dance") {
    const lanes = ["←", "↑", "↓", "→"], hitY = H - 40;
    for (let l = 0; l < 4; l++) { g.fillStyle = l % 2 ? "#4a3626" : "#523c2a"; g.fillRect(30 + l * 80, 0, 70, H); }
    g.fillStyle = "#f2e3bf"; g.fillRect(20, hitY - 2, W - 40, 4);
    g.font = "bold 28px 'Pixelify Sans', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    for (const n of mg.notes) {
      const y = hitY - (n.t - now) * 0.32; if (y < -30 || y > H + 30) continue;
      g.fillStyle = n.hit === 2 ? "#6cc24a" : n.hit === 1 ? "#ffe066" : n.hit < 0 ? "#8a6a5a" : "#ff7eb6"; g.fillText(lanes[n.lane], 65 + n.lane * 80, y);
      if (!n.hit && now - n.t > 200) n.hit = -1;
    }
    for (let l = 0; l < 4; l++) { g.fillStyle = "rgba(242,227,191,.35)"; g.fillText(lanes[l], 65 + l * 80, hitY); }
    const total = mg.notes.length, got = mg.notes.reduce((a, n) => a + (n.hit === 2 ? 1 : n.hit === 1 ? 0.6 : 0), 0);
    status.textContent = now < mg.t0 ? "Get ready... the fiddle's starting!" : "Hit the arrows on the line!  " + Math.round(100 * got / total) + "%";
    if (now > mg.end) mgFinish(100 * got / total);
  } else if (mg.game === "rodeo") {
    if (now > mg.t0 && !mg.done) {
      if (Math.random() < 2.1 * dt) mg.kick = (mg.r() - 0.5) * 3.2;
      mg.vel += ((mg.kick || 0) + mg.pos * 1.4 - mg.push * 2.6) * dt; mg.vel *= Math.pow(0.985, dt * 60); mg.pos += mg.vel * dt;
      if (Math.abs(mg.pos) > 1) mgFinish(100 * Math.min(1, (now - mg.t0) / 15000));
      if (now > mg.end) mgFinish(100);
    }
    // the arena: sky, the back fence, churned dirt, and the balance bar up top
    g.fillStyle = "#8ec8e8"; g.fillRect(0, 0, W, 96); g.fillStyle = "#c9a66b"; g.fillRect(0, 96, W, H - 96);
    for (let x = 6; x < W; x += 9) { g.fillStyle = (x * 7) % 3 ? "#b8925a" : "#d8b880"; g.fillRect(x, 110 + (x * 13) % 90, 3, 2); }
    g.fillStyle = "#8a5a2a"; for (let x = 0; x < W; x += 36) g.fillRect(x + 4, 66, 6, 34); g.fillStyle = "#a5713f"; g.fillRect(0, 72, W, 6); g.fillRect(0, 88, W, 6);
    g.fillStyle = "rgba(43,33,24,.55)"; g.fillRect(16, 12, W - 32, 26);
    g.fillStyle = "#b8463a"; g.fillRect(20, 16, W - 40, 18); g.fillStyle = "#6cc24a"; g.fillRect(W / 2 - 60, 16, 120, 18);
    const nx = W / 2 + Math.max(-1, Math.min(1, mg.pos)) * (W / 2 - 24); g.fillStyle = "#f4ead2"; g.fillRect(nx - 3, 10, 6, 30); g.fillStyle = "#2b2118"; g.fillRect(nx - 1, 12, 2, 26);
    const lean = Math.max(-1, Math.min(1, mg.pos)) * 0.5, buck = !mg.done && now > mg.t0 && Math.floor(now / 180) % 2, cx = W / 2, cy = 150;
    g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(cx - 70, cy + 58, 140, 7);
    g.save(); g.translate(cx, cy); g.rotate(lean + (buck ? -0.05 : 0.04)); g.imageSmoothingEnabled = false;
    g.drawImage(Art.bullSprite(buck), -84, -66 + (buck ? -5 : 0), 168, 132);
    g.drawImage(charSprite(prefs.sprite, "right", 0, COLORS[prefs.color], prefs.hat), 0, 0, 32, 48, -22 + (buck ? 3 : 0), -96 + (buck ? -9 : 0), 48, 72);
    g.restore();
    status.textContent = now < mg.t0 ? "Hold on tight! Lean with ← → to stay in the green." : mg.done ? "Ride over!" : "Hang on! " + ((now - mg.t0) / 1000).toFixed(1) + "s / 15s";
  } else if (mg.game === "apples") {
    const ringY = 120, ay = ringY + Math.sin(now / 260 + mg.phase) * 70;
    g.fillStyle = "#3a6ab0"; g.fillRect(40, 60, W - 80, H - 70); g.fillStyle = "#5a8ad0"; g.fillRect(40, 60, W - 80, 8);
    g.strokeStyle = "#ffe066"; g.lineWidth = 4; g.strokeRect(W / 2 - 34, ringY - 18, 68, 36);
    g.fillStyle = "#d0283a"; g.beginPath(); g.arc(W / 2, ay, 14, 0, 6.3); g.fill(); g.fillStyle = "#8a5a2a"; g.fillRect(W / 2 - 1, ay - 20, 3, 8);
    mg.ay = ay; mg.ring = ringY;
    status.textContent = "Space (or E) to bob when the apple is in the ring!  Tries left: " + mg.tries + "  ·  apples: " + mg.hits + (mg.msg ? "  ·  " + mg.msg : "");
  }
  mgKick();
}
function mgKey(e) {
  const mg = minigame; if (!mg || mg.done) { if (e.key === "Escape") { closeMenu(); mode = "play"; } return; }
  const now = performance.now();
  if (e.key === "Escape") { mgFinish(mg.game === "rodeo" ? 100 * Math.min(1, (now - mg.t0) / 15000) : 0); return; }
  if (mg.game === "dance") {
    const lane = { ArrowLeft: 0, a: 0, A: 0, ArrowUp: 1, w: 1, W: 1, ArrowDown: 2, s: 2, S: 2, ArrowRight: 3, d: 3, D: 3 }[e.key];
    if (lane == null) return; e.preventDefault();
    let best = null; for (const n of mg.notes) if (!n.hit && n.lane === lane && Math.abs(n.t - now) < 220 && (!best || Math.abs(n.t - now) < Math.abs(best.t - now))) best = n;
    if (best) { best.hit = Math.abs(best.t - now) < 90 ? 2 : 1; sfx("pop"); }
  } else if (mg.game === "rodeo") {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { mg.push = -1; e.preventDefault(); }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { mg.push = 1; e.preventDefault(); }
  } else if (mg.game === "apples" && (e.key === " " || e.key === "e" || e.key === "E" || e.key === "Enter")) {
    e.preventDefault(); if (mg.tries <= 0) return;
    mg.tries--; if (Math.abs(mg.ay - mg.ring) < 16) { mg.hits++; mg.msg = "Got one!"; sfx("harvest"); } else { mg.msg = "Splash!"; sfx("water"); }
    if (mg.tries === 0) mgFinish(mg.hits * 20);
  }
}
window.addEventListener("keyup", (e) => { if (minigame && minigame.game === "rodeo" && /^(ArrowLeft|ArrowRight|a|A|d|D)$/.test(e.key)) minigame.push = 0; });

// ------------------------------------------------------------------ the bard's songs (each one its own little tune)
let songTimer = null;
function songNotes(id) {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = mulberry(h), scales = [[0, 2, 4, 7, 9, 12, 14, 16], [0, 2, 3, 5, 7, 8, 10, 12], [0, 2, 4, 5, 7, 9, 11, 12], [0, 3, 5, 7, 10, 12, 15, 17]];
  const scale = scales[h % 4], root = 220 * Math.pow(2, (h % 7) / 12), beat = 0.24 + (h % 3) * 0.06, out = [];
  let deg = 2;
  for (let i = 0; i < 32; i++) { deg = Math.max(0, Math.min(scale.length - 1, deg + Math.floor(r() * 5) - 2)); out.push([root * Math.pow(2, scale[deg] / 12) * 2, i * beat, beat * (r() < 0.2 ? 2 : 1)]); }
  return { notes: out, beat, root };
}
function stopSong() { if (songTimer) { clearTimeout(songTimer); songTimer = null; } }
function playSong(id) {
  if (!audio) return; stopSong();
  const { notes, beat, root } = songNotes(id), t0 = audio.currentTime + 0.05;
  for (const [f, at, dur] of notes) {
    const o = audio.createOscillator(), g = audio.createGain(); o.type = "triangle"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(0.06, t0 + at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur * 0.95);
    o.connect(g).connect(audio.destination); o.start(t0 + at); o.stop(t0 + at + dur);
  }
  for (let i = 0; i < 8; i++) { const o = audio.createOscillator(), g = audio.createGain(); o.type = "sine"; o.frequency.value = root * (i % 2 ? 0.75 : 0.5); g.gain.setValueAtTime(0.04, t0 + i * beat * 4); g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i + 1) * beat * 4); o.connect(g).connect(audio.destination); o.start(t0 + i * beat * 4); o.stop(t0 + (i + 1) * beat * 4); }
  songTimer = setTimeout(() => { songTimer = null; if (music && music.song === id) playSong(id); }, notes.length * beat * 1000 + 600);
}
let _spots = null;
function spotLevel(x, y) {
  if (!_spots) { _spots = {}; for (const [sx, sy, lv] of catalog.tree_spots || []) _spots[sx + "," + sy] = lv; }
  const v = _spots[x + "," + y]; return v == null ? null : v;
}
function aheadExtra(loc, fx, fy) {
  /* what a villager, animal, machine, bug or monster ahead of you is (or null) */
  for (const name in npcViz) { const v = npcViz[name]; if (v.loc === loc && Math.round(v.x) === fx && Math.round(v.y) === fy) {
    const hold = heldItem(), giftable = hold && catalog.items[hold] && !["gear", "weapon", "machine", "key", "ammo", "treat"].includes(catalog.items[hold].kind);
    if (name === "Mayor Hazel" && state.festival && loc === "town") return name + " - E for the " + ({ hoedown: "Spring Hoedown", rodeo: "Rodeo Roundup", fair: "Livestock Fair", fallfest: "Fallfest", derby: "Frost Fishing Derby", feast: "Winter Feast" }[state.festival] || "festival") + "!";
    if (name === "Rowan" && state.concert) return name + " the bard - E to request a song.";
    const mark = me && me.quest_marks && me.quest_marks[name];
    if (mark === "?") return name + " - E to hand over what they asked for!";
    if (mark === "!") return name + " has something to ask you - E to talk.";
    return name + (giftable ? " - E to chat, E again to give your " + catalog.items[hold].name + "." : " - E to talk."); } }
  for (const pt of state.pets || []) if (pt.loc === loc && pt.x === fx && pt.y === fy) return pt.name + " the " + (pt.sp || pt.kind).toLowerCase() + " - E to pet.";
  if (loc === "farm") for (const c of state.chickens || []) if (c.x === fx && c.y === fy) return c.name + " the chicken - " + (c.egg ? "E to collect an egg!" : "no egg yet.");
  const spot = loc === "farm" ? spotLevel(fx, fy) : null;
  if (spot != null && !(tiles[fx + "," + fy] || {}).t) return me && me.level >= spot ? "A tree spot - hold a sapling and press E to plant." : "A tree spot - it opens at level " + spot + ".";
  const d = (loc === "farm" ? tiles : areaTiles(loc))[fx + "," + fy];
  if (d && d.m) { const it = catalog.items[d.m[0]]; return it.name + " - " + (d.m[1] === 2 ? "E to collect " + catalog.items[d.m[2]].name + "!" : d.m[1] === 1 ? "working..." : d.m[0] === "craft_table" ? "E to craft." : d.m[0] === "tailor_table" ? "E to sew and dye." : "hold an ingredient and press E."); }
  const bug = ((state.bugs || {})[loc] || {})[fx + "," + fy]; if (bug) return catalog.items[bug].name + " - " + (heldItem() === "bug_net" ? "E to swing the net!" : "hold a bug net to catch it.");
  if (((state.digs || {})[loc] || []).includes(fx + "," + fy)) return "Something wriggles in the ground - dig it with the hoe.";
  for (const mb of (state.mobs || {})[loc] || []) if (mb.x === fx && mb.y === fy) return "A monster! Hold a weapon and press E (a monster treat might tame a weakened one).";
  for (const c of (state.critters || {})[loc] || []) if (c.x === fx && c.y === fy) return "Wild game - a bow, rifle or slingshot can bag it.";
  if (/^deep/.test(loc) && (curMap()[fy] || "")[fx] === "Z") return "A treasure chest - E to open it.";
  return null;
}
// ------------------------------------------------------------------ the Valley Map (Father TongTong's gift): every place, laid out the way
// the paths join them, drawn small from its real tiles, with a dot for everyone who's out and about
const MAP_LAYOUT = { frontier: [0, 50], town: [68, 46], farm: [144, 60], mountain: [153, 18], forest: [156, 94], beach: [74, 94],
  island: [74, 128], mine1: [240, 4], mine2: [240, 33], mine3: [240, 62] };
const MAP_PX = 2, MAP_W = 282, MAP_H = 164, _mapArea = {};
function mapTileColor(ch, loc) {
  if (ch === "~" || ch === "I") return "#4a90d0";
  if ("TPAKu".includes(ch)) return "#2f6a3a";
  if (ch === "@" || ch === "W" || ch === "+") return "#b5654a";
  if (ch === "S" || ch === "N") return "#9a5aa0";
  if (ch === ":" || ch === "=") return "#c9a66b";
  if (ch === "," || ch === "H") return "#e6d39a";
  if (ch === "d") return "#a87a4a";
  if (ch === "#" || ch === "G") return "#8a6a4a";
  if (ch === "R" || ch === "C") return /^mine/.test(loc) ? "#3a3236" : "#7a6a62";
  if (ch === "v" || ch === "U" || ch === "D") return "#6a5e56";
  if (ch === "z") return "#d9a066";
  if (ch === "r") return "#a8a4a0";
  if (ch === "o" || ch === "B") return "#9a9890";
  return loc === "frontier" ? "#d9a066" : state && state.season === "winter" ? "#e8eef2" : state && state.season === "fall" ? "#a0a050" : "#6cb04a";
}
function mapRows(loc) { return loc === "farm" ? map : (catalog.areas || {})[loc] || []; }
function mapAreaImage(loc) {
  const rows = mapRows(loc), key = loc + worldSig + (state ? state.season : "");
  if (_mapArea[loc] && _mapArea[loc].key === key) return _mapArea[loc].img;
  const c = document.createElement("canvas"); c.width = rows[0].length * MAP_PX; c.height = rows.length * MAP_PX;
  const g = c.getContext("2d");
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) { g.fillStyle = mapTileColor(rows[y][x], loc); g.fillRect(x * MAP_PX, y * MAP_PX, MAP_PX, MAP_PX); }
  _mapArea[loc] = { key, img: c };
  return c;
}
function mapSpot(loc, x, y) {
  /* where on the map someone is: outdoors at their tile; indoors at their building's door; deep down in the mine, in the mine */
  if (MAP_LAYOUT[loc]) return [loc, x, y];
  if (catalog.doors && catalog.doors[loc]) return ["farm", catalog.doors[loc][0], catalog.doors[loc][1]];
  for (const a in catalog.buildings || {}) for (const b of catalog.buildings[a]) if (b.to === loc && b.door) return [a, b.door[0], b.door[1]];
  for (const a in (state && state.xb) || {}) for (const b of state.xb[a]) if (b.to === loc) return [a, b.door ? b.door[0] : b.x + (b.w >> 1), b.door ? b.door[1] : b.y + b.h - 1];
  if (/^deep/.test(loc)) return ["mine3", 20, 13];
  if (loc === "mystery") return ["island", 30, 30];
  return null;
}
function placeName(loc) {
  if (loc === "farm") return farmName;
  if ((catalog.area_names || {})[loc]) return catalog.area_names[loc];
  if (/^deep/.test(loc)) return "the Depths, floor " + loc.slice(4);
  if (loc === "mystery") return "a mystery island";
  const room = (catalog.rooms || {})[loc] || "a building", spot = mapSpot(loc, 0, 0);
  return room + (spot && spot[0] !== "farm" ? ", " + ((catalog.area_names || {})[spot[0]] || spot[0]) : spot ? ", the farm" : "");
}
function drawValleyMap(cv, now) {
  const dpr = window.devicePixelRatio || 1, cssW = cv.clientWidth || 400, P = cssW * dpr / MAP_W, k = dpr;
  const W = Math.round(MAP_W * P), H = Math.round(MAP_H * P);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext("2d");
  g.fillStyle = "#2e4a5a"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 200; i++) { g.fillStyle = "rgba(255,255,255,.05)"; g.fillRect((i * 97) % W, (i * 53) % H, 5 * k, k); }   // a sea of little waves
  g.imageSmoothingEnabled = false; g.textBaseline = "bottom";
  for (const loc in MAP_LAYOUT) {
    const rows = mapRows(loc); if (!rows.length) continue;
    const [lx, ly] = MAP_LAYOUT[loc], x0 = Math.round(lx * P), y0 = Math.round(ly * P), w = Math.round(rows[0].length * P), h = Math.round(rows.length * P);
    g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(x0 + 2 * k, y0 + 2 * k, w, h);
    g.drawImage(mapAreaImage(loc), x0, y0, w, h);
    g.strokeStyle = "#2b1f17"; g.lineWidth = 1.5 * k; g.strokeRect(x0, y0, w, h);
    g.font = "bold " + Math.round(9 * k) + "px 'Pixelify Sans', sans-serif";
    const label = loc === "farm" ? farmName : (catalog.area_names[loc] || loc).replace(/^the /, "").replace(/^./, (c) => c.toUpperCase());
    const tw = g.measureText(label).width;
    g.fillStyle = "rgba(43,31,23,.78)"; g.fillRect(x0 + 2 * k, y0 + 2 * k, tw + 6 * k, 11 * k);
    g.fillStyle = "#f6ead0"; g.fillText(label, x0 + 5 * k, y0 + 12 * k);
  }
  // everyone online: a dot in their shirt colour and a name tag (gliding with them); you get a gently pulsing ring
  for (const p of state.players) {
    if (!p.online) continue;
    const loc = p.loc || "farm", s = mapSpot(loc, p.x, p.y); if (!s || !MAP_LAYOUT[s[0]]) continue;
    const L = MAP_LAYOUT[s[0]], mine = p.name === prefs.name, outside = s[0] === loc;
    const v = mine && my.ready && loc === my.loc ? my : viz[p.name] && viz[p.name].loc === loc ? viz[p.name] : null;
    const bx = outside && v ? v.x : s[1], by = outside && v ? v.y : s[2];
    const x = (L[0] + bx + 0.5) * P, y = (L[1] + by + 0.5) * P;
    const col = COLORS[catalog.player_colors[p.color % catalog.player_colors.length]] || "#fff";
    if (mine) { const r = (7 + Math.sin(now / 250) * 1.5) * k; g.strokeStyle = "#fffaf0"; g.lineWidth = 1.5 * k; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.stroke(); }
    g.fillStyle = "#2b1f17"; g.beginPath(); g.arc(x, y, 4.5 * k, 0, 6.3); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x, y, 3.3 * k, 0, 6.3); g.fill();
    g.font = "bold " + Math.round(9 * k) + "px 'Pixelify Sans', sans-serif";
    const name = mine ? "You" : p.name, tw = g.measureText(name).width;
    g.fillStyle = "rgba(43,31,23,.85)"; g.fillRect(x - tw / 2 - 3 * k, y - 18 * k, tw + 6 * k, 11 * k);
    g.fillStyle = mine ? "#ffe066" : "#fffaf0"; g.textAlign = "center"; g.fillText(name, x, y - 8 * k); g.textAlign = "left";
  }
}
let mapRaf = 0, mapOpen = false, mapListSig = "", mapDrawn = 0;
function mapKick() { if (!mapRaf) mapRaf = requestAnimationFrame(mapFrame); }
function mapFrame(now) {
  mapRaf = 0;
  if (!mapOpen || !state) return;
  if (now - mapDrawn > 60) {                                   // ~15 times a second is plenty for a map
    mapDrawn = now;
    drawValleyMap($("#mapPanel canvas"), now);
    const sig = JSON.stringify(state.players.filter((q) => q.online).map((q) => [q.name, q.loc]));
    if (sig !== mapListSig) { mapListSig = sig; fillMapList($("#mapPanel .map-list")); }
  }
  mapKick();
}
function fillMapList(list) {
  list.innerHTML = "";
  for (const p of state.players.filter((q) => q.online).sort((a, b) => (a.name === prefs.name ? -1 : b.name === prefs.name ? 1 : a.name.localeCompare(b.name)))) {
    const row = el("div", "map-who"); const sw = el("span", "sw"); sw.style.background = COLORS[catalog.player_colors[p.color % catalog.player_colors.length]];
    row.appendChild(sw); row.appendChild(el("b", null, p.name === prefs.name ? p.name + " (you)" : p.name)); row.appendChild(el("span", null, " - " + placeName(p.loc || "farm")));
    list.appendChild(row);
  }
}
function openMap() {
  /* N: the map docks in the corner and stays up while you walk; N again (or its x) puts it away */
  if (mapOpen) { closeMap(); return; }
  if (!(me && me.inventory.some(([k]) => k === "valley_map"))) { toast("You don't have a map yet - Father TongTong (by the chapel on the farm) has one for you.", "info"); return; }
  mapOpen = true; mapListSig = ""; mapDrawn = 0; $("#mapPanel").classList.remove("hidden"); mapKick();
  if (mode === "menu") closeMenu();             // opened from the bag: back to play, map up
  canvas.focus();
}
function closeMap() { mapOpen = false; $("#mapPanel").classList.add("hidden"); canvas.focus(); }
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

$("#wish").onclick = () => { wish(); canvas.focus(); };
$("#mapPanel .xbtn").onclick = () => closeMap();
$("#revival").onclick = () => send({ t: "book" });
$("#menu .xbtn").onclick = () => { if (mode === "fish") endFishing(false); else if (menu && menu.kind === "proposal") { send({ t: "propose_answer", yes: false }); closeMenu(); } else closeMenu(); };
setupLogin();
requestAnimationFrame(render);
window.cozy = { send, openMenu, state: () => state, me: () => me, mode: () => mode, my, setZoom, map: () => curMap(), walkable, catalog: () => catalog, tryStep, fxs,
  dbg: () => ({ my: Object.assign({}, my), cam: Object.assign({}, cam), T, SCALE, zoom, cw: canvas.width, ch: canvas.height, err: window.__renderErr || null }) };
})();
