"use strict";

const KURTA = ["#e07020", "#8d2433", "#243e86", "#0f7a56"];
const SKIN = "#f0c09a";
const HAIR = "#2a160f";
const WASH = ["#e7d3b0", "#dcc6a0", "#f0e0c4", "#d8c09a", "#e9d6b6", "#d4bc96"];
const CONFETTI = ["#e07020", "#8d2433", "#243e86", "#f3d48a", "#f6e7c1", "#1f7a5a"];
const NAMES = ["Anaya", "Vihaan", "Meera", "Kabir"];

const SNAKES = [
  { head: 16, tail: 6 },
  { head: 47, tail: 26 },
  { head: 49, tail: 11 },
  { head: 56, tail: 53 },
  { head: 62, tail: 19 },
  { head: 64, tail: 60 },
  { head: 87, tail: 24 },
  { head: 93, tail: 73 },
  { head: 95, tail: 75 },
  { head: 98, tail: 78 },
];

const LADDERS = [
  { from: 1, to: 38, n: 0.22 },
  { from: 4, to: 14, n: -0.22 },
  { from: 9, to: 31, n: 0.26 },
  { from: 21, to: 42, n: -0.2 },
  { from: 28, to: 84, n: 0.3 },
  { from: 36, to: 44, n: -0.22 },
  { from: 51, to: 67, n: 0.22 },
  { from: 71, to: 91, n: -0.24 },
  { from: 80, to: 100, n: 0.22 },
];

const PIPS = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

const board = document.getElementById("board");
const dieCanvas = document.getElementById("die");
const diceBtn = document.getElementById("dice");
const muteBtn = document.getElementById("mute");
const menu = document.getElementById("menu");
const winEl = document.getElementById("win");

let G = null;
let queued = [];
let speed = 1;
let cpuTimer = 0;
let reduceMotion = false;

try {
  reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) speed = 2.5;
} catch (err) {
  reduceMotion = false;
}

const audio = {
  ctx: null,
  muted: false,
  unlock() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this.ctx) this.ctx = new AC();
      if (this.ctx.state === "suspended") this.ctx.resume();
    } catch (err) {
      this.ctx = null;
    }
  },
  gain(t, dur, peak) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  },
  tone(freq, dur, type, peak) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = this.gain(t, dur, peak);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  noise(dur, peak, freq) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    const g = this.gain(t, dur, peak);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.ctx.destination);
    src.start(t);
  },
  rattle() {
    for (let i = 0; i < 7; i++) setTimeout(() => this.noise(0.045, 0.1, 380 + i * 80), i * 55);
  },
  hop() { this.tone(520, 0.07, "triangle", 0.05); },
  hiss() { this.noise(0.45, 0.09, 1400); },
  slide() { this.noise(0.4, 0.06, 240); },
  pungi() {
    [494, 466, 440, 415, 392, 440].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, "sawtooth", 0.035), i * 120));
  },
  heartbeat() {
    this.drum(58, 0.22);
    setTimeout(() => this.drum(46, 0.16), 160);
    setTimeout(() => this.drum(58, 0.18), 620);
  },
  climb() {
    [523, 587, 659, 784, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, "triangle", 0.045), i * 160));
  },
  bump() { this.tone(150, 0.1, "square", 0.05); },
  sparkle() {
    [988, 1318, 1568].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, "sine", 0.045), i * 60));
  },
  overshoot() { this.tone(196, 0.14, "sine", 0.04); },
  drum(freq, peak) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * 2.1, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.28);
    this.noise(0.04, peak * 0.35, 180);
  },
  dhol() {
    [0, 200, 360, 560, 740, 940, 1160, 1380].forEach((ms, i) => {
      setTimeout(() => this.drum(i % 2 ? 96 : 70, i % 3 === 0 ? 0.26 : 0.14), ms);
    });
  },
};

function audioSetMuted(on) {
  audio.muted = on;
  muteBtn.textContent = on ? "Sound off" : "Sound on";
  muteBtn.setAttribute("aria-pressed", on ? "true" : "false");
}

try {
  if (localStorage.getItem("saanp-mute") === "1") audioSetMuted(true);
} catch (err) {}

function current() {
  return G.players[G.turn];
}

function gridOf(n) {
  const row = Math.floor((n - 1) / 10);
  let col = (n - 1) % 10;
  if (row % 2 === 1) col = 9 - col;
  return { col, row };
}

function layout() {
  const w = board.width;
  const h = board.height;
  const margin = Math.min(w, h) * 0.11;
  const size = Math.min(w, h) - margin * 2;
  return { w, h, ox: (w - size) / 2, oy: (h - size) / 2, size, cell: size / 10 };
}

function cellRect(n, L) {
  const g = gridOf(n);
  return {
    x: L.ox + g.col * L.cell,
    y: L.oy + (9 - g.row) * L.cell,
    w: L.cell,
    h: L.cell,
  };
}

function center(n, L) {
  const r = cellRect(n, L);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function ease(t) {
  return t * t * (3 - 2 * t);
}

function foot(player, square, L, pretend) {
  if (square <= 0) {
    const s1 = center(1, L);
    const n = G.players.length;
    return {
      x: s1.x + (player.id - (n - 1) / 2) * L.cell * 0.22,
      y: s1.y + L.cell * 0.72,
    };
  }
  const c = center(square, L);
  const group = G.players.filter((p) => p.pos === square || (pretend && p === player));
  group.sort((a, b) => a.id - b.id);
  const idx = Math.max(0, group.findIndex((p) => p === player));
  const spread = L.cell * 0.18;
  return { x: c.x + (idx - (group.length - 1) / 2) * spread, y: c.y + L.cell * 0.1 };
}

function snakeRoute(snake, L) {
  const a = gridOf(snake.head);
  const b = gridOf(snake.tail);
  const along = 0.86 + (snake.head % 3) * 0.02;
  const pts = [];
  const push = (col, row) => {
    const p = {
      x: L.ox + (col + along) * L.cell,
      y: L.oy + (9 - row + along) * L.cell,
    };
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.4) pts.push(p);
  };
  let c = a.col;
  let r = a.row;
  push(c, r);
  let guard = 0;
  while ((c !== b.col || r !== b.row) && guard++ < 40) {
    const preferCol = (c + r + snake.head) % 2 === 0;
    if (c !== b.col && (r === b.row || preferCol)) c += Math.sign(b.col - c);
    else r += Math.sign(b.row - r);
    push(c, r);
  }
  return pts;
}

function pointAlong(pts, t) {
  if (!pts.length) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];
  let total = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segs.push(len);
    total += len;
  }
  let d = Math.max(0, Math.min(1, t)) * (total || 1);
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? Math.max(0, Math.min(1, d / segs[i])) : 0;
      return { x: lerp(pts[i].x, pts[i + 1].x, k), y: lerp(pts[i].y, pts[i + 1].y, k) };
    }
    d -= segs[i];
  }
  return pts[pts.length - 1];
}

function ladderLine(lad, L) {
  const a0 = center(lad.from, L);
  const b0 = center(lad.to, L);
  const dx = b0.x - a0.x;
  const dy = b0.y - a0.y;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * lad.n * L.cell;
  const oy = (dx / len) * lad.n * L.cell;
  return {
    a: { x: a0.x + ox, y: a0.y + oy },
    b: { x: b0.x + ox, y: b0.y + oy },
  };
}

function begin(players) {
  clearTimeout(cpuTimer);
  G = {
    spec: players.map((p) => ({ name: p.name, cpu: !!p.cpu })),
    players: players.map((p, i) => ({
      id: i,
      name: (p.name || "Player " + (i + 1)).slice(0, 12),
      cpu: !!p.cpu,
      kurta: i,
      pos: 0,
    })),
    turn: 0,
    phase: "roll",
    lastRoll: 1,
    rolls: queued.splice(0, queued.length),
    queue: [],
    step: null,
    fx: [],
    dieFx: [],
    glow: {},
    cam: { zoom: 1, rot: 0 },
    msg: "",
    winner: null,
    t: 0,
    lick: null,
    winT: 0,
    seen: [],
  };
  G.msg = current().name + "'s turn";
  menu.hidden = true;
  winEl.hidden = true;
  scheduleCpu();
}

function scheduleCpu() {
  clearTimeout(cpuTimer);
  if (!G || G.phase !== "roll" || !current().cpu) return;
  cpuTimer = setTimeout(() => {
    if (G && G.phase === "roll" && current().cpu) performRoll();
  }, 700 / speed);
}

function performRoll() {
  if (!G || G.phase !== "roll") return;
  const value = G.rolls.length ? G.rolls.shift() : 1 + Math.floor(Math.random() * 6);
  G.lastRoll = value;
  G.phase = "play";
  G.step = { kind: "dice", value, t: 0, dur: 0.68 };
  G.msg = current().name + " is rolling…";
  audio.rattle();
}

function planMove(roll) {
  const p = current();
  const dest = p.pos + roll;
  G.msg = p.name + " rolled " + roll;
  if (dest > 100) {
    G.queue.push({ kind: "overshoot", player: p, dur: 0.62 });
    G.queue.push({ kind: "end", bonus: roll === 6 });
  } else {
    for (let s = p.pos + 1; s <= dest; s++) {
      G.queue.push({ kind: "hop", player: p, from: s - 1, to: s, dur: reduceMotion ? 0.08 : 0.2 });
    }
    const lad = LADDERS.find((l) => l.from === dest);
    const sn = SNAKES.find((s) => s.head === dest);
    if (lad) G.queue.push({ kind: "ladder", player: p, from: dest, to: lad.to, dur: reduceMotion ? 0.45 : 1.75 });
    else if (sn) G.queue.push({ kind: "snake", player: p, from: dest, to: sn.tail, dur: reduceMotion ? 0.55 : 3.4 });
    G.queue.push({ kind: "arrive" });
  }
  advance();
}

function resolveArrival() {
  const p = current();
  if (p.pos >= 100) {
    celebrate(p);
    return;
  }
  const extra = [];
  const other = G.players.find((o) => o !== p && o.pos === p.pos && p.pos > 0);
  if (other) extra.push({ kind: "bump", player: p, other, dur: 0.72 });
  const near = SNAKES.find((s) => s.head === p.pos + 1);
  if (near) extra.push({ kind: "near", player: p, head: near.head, dur: 1.45 });
  extra.push({ kind: "end", bonus: G.lastRoll === 6 });
  G.queue = extra.concat(G.queue);
  advance();
}

function celebrate(p) {
  G.phase = "win";
  G.winner = p;
  G.step = null;
  G.queue = [];
  G.winT = G.t;
  G.msg = p.name + " reaches 100!";
  audio.dhol();
  for (let i = 0; i < 80; i++) {
    G.fx.push({
      kind: "confetti",
      x: 0.5 + (Math.random() - 0.5) * 0.15,
      y: 0.35,
      vx: (Math.random() - 0.5) * 0.45,
      vy: -0.05 - Math.random() * 0.35,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 6,
      w: 6 + Math.random() * 7,
      h: 8 + Math.random() * 8,
      color: CONFETTI[i % CONFETTI.length],
      life: 3.4,
    });
  }
  document.getElementById("win-name").textContent = p.name;
  winEl.hidden = false;
}

function advance() {
  const next = G.queue.shift();
  if (!next) return;
  if (next.kind === "arrive") {
    resolveArrival();
    return;
  }
  if (next.kind === "end") {
    endTurn(next.bonus);
    return;
  }
  G.step = Object.assign({ t: 0 }, next);
  G.seen.push(next.kind);
  G.phase = "play";
  if (next.kind === "hop") G.glow[next.to] = 1;
  if (next.kind === "ladder") {
    G.msg = next.player.name + " climbs a ladder!";
    audio.climb();
  }
  if (next.kind === "snake") {
    G.msg = "A cobra rises from the stone!";
    audio.hiss();
    audio.pungi();
    spawnChips(next.from);
  }
  if (next.kind === "bump") {
    G.msg = "A shove on square " + next.player.pos + "!";
    audio.bump();
  }
  if (next.kind === "near") {
    G.msg = "The cobra stirs.";
    G.lick = { head: next.head, until: G.t + next.dur };
    audio.heartbeat();
  }
  if (next.kind === "overshoot") {
    G.msg = "Too far. " + next.player.name + " needs an exact roll.";
    audio.overshoot();
  }
}

function endTurn(bonus) {
  if (!G || G.phase === "win") return;
  G.step = null;
  if (bonus) {
    G.phase = "roll";
    G.msg = "A six! " + current().name + " rolls again.";
    scheduleCpu();
    return;
  }
  G.turn = (G.turn + 1) % G.players.length;
  G.phase = "roll";
  G.msg = current().name + "'s turn";
  scheduleCpu();
}

function finishStep() {
  const step = G.step;
  G.step = null;
  if (step.kind === "dice") {
    planMove(step.value);
    return;
  }
  if (step.kind === "hop") step.player.pos = step.to;
  if (step.kind === "ladder" || step.kind === "snake") step.player.pos = step.to;
  advance();
}

function spawnChips(square) {
  const L = layout();
  const p = center(square, L);
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = L.cell * (0.5 + Math.random() * 1.1);
    G.fx.push({
      kind: "chip",
      x: p.x,
      y: p.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - L.cell * 0.4,
      life: 0.75,
      max: 0.75,
      w: 2 + Math.random() * 4,
      h: 2 + Math.random() * 3,
    });
  }
}

function spawnDust(square) {
  const L = layout();
  const p = center(square, L);
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    G.fx.push({
      kind: "dust",
      x: p.x,
      y: p.y + L.cell * 0.12,
      vx: Math.cos(a) * L.cell * 0.9,
      vy: Math.sin(a) * L.cell * 0.4 - L.cell * 0.15,
      life: 0.36,
      max: 0.36,
    });
  }
}

function tick(dt) {
  if (!G) return;
  G.t += dt;
  const step = G.step;
  if (step && step.kind !== "win") {
    step.t += dt;
    if (step.kind === "hop" && !step.dusted && step.t > step.dur * 0.86) {
      step.dusted = true;
      spawnDust(step.to);
      audio.hop();
    }
    if (step.kind === "dice" && step.value === 6 && !step.sparked && step.t > step.dur * 0.7) {
      step.sparked = true;
      audio.sparkle();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        G.dieFx.push({ x: 0.5, y: 0.5, vx: Math.cos(a) * 0.9, vy: Math.sin(a) * 0.9, life: 0.55, max: 0.55 });
      }
    }
    if (step.kind === "snake" && !step.slid && step.t > step.dur * 0.7) {
      step.slid = true;
      audio.slide();
    }
    if (step.t >= step.dur) finishStep();
  }
  const wantZ = G.step && G.step.kind === "ladder" ? 1 + 0.075 * Math.sin(Math.min(1, G.step.t / G.step.dur) * Math.PI) : 1;
  const wantR = G.step && G.step.kind === "ladder" ? 0.04 * Math.sin(Math.min(1, G.step.t / G.step.dur) * Math.PI) : 0;
  G.cam.zoom += (wantZ - G.cam.zoom) * Math.min(1, dt * 5);
  G.cam.rot += (wantR - G.cam.rot) * Math.min(1, dt * 5);
  for (const k of Object.keys(G.glow)) {
    G.glow[k] -= dt * 0.85;
    if (G.glow[k] <= 0) delete G.glow[k];
  }
  G.fx = G.fx.filter((p) => {
    p.life -= dt;
    if (p.kind === "confetti") {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.55 * dt;
      p.rot += p.vr * dt;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "chip") p.vy += 700 * dt;
    }
    return p.life > 0;
  });
  G.dieFx = G.dieFx.filter((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    return p.life > 0;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawLotus(ctx, x, y, s) {
  ctx.fillStyle = "#b08960";
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((i / 8) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.42, s * 0.14, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#f3e6cc";
  ctx.beginPath();
  ctx.arc(x, y, s * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

function drawPillar(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, "#7d6248");
  g.addColorStop(0.35, "#f0e2c8");
  g.addColorStop(0.7, "#c9ae8c");
  g.addColorStop(1, "#6e5340");
  ctx.fillStyle = g;
  ctx.fillRect(x - w * 0.25, y, w * 1.5, w * 0.45);
  ctx.fillRect(x, y + w * 0.4, w, h - w * 0.8);
  ctx.fillRect(x - w * 0.2, y + h - w * 0.4, w * 1.4, w * 0.4);
  ctx.fillStyle = "rgba(90, 60, 30, 0.35)";
  for (let i = 1; i <= 3; i++) {
    const gy = y + w * 0.55 + ((h - w) * i) / 4;
    ctx.fillRect(x, gy, w, Math.max(1, w * 0.06));
  }
}

function drawDiya(ctx, x, y, s, t) {
  ctx.fillStyle = "#c9893a";
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.7, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6a3a12";
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.02, s * 0.42, s * 0.1, 0, Math.PI, 0, true);
  ctx.fill();
  const flick = 0.86 + Math.sin(t * 10 + x) * 0.12;
  const g = ctx.createRadialGradient(x, y - s * 0.55, 1, x, y - s * 0.35, s * 0.55);
  g.addColorStop(0, "#fff6d0");
  g.addColorStop(0.45, "#ffb03a");
  g.addColorStop(1, "rgba(255, 90, 20, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.5 * flick, s * 0.16, s * 0.36 * flick, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoard(ctx, L, t, flick) {
  const pw = L.cell * 0.42;
  drawPillar(ctx, L.ox - pw * 1.15, L.oy, pw * 0.7, L.size);
  drawPillar(ctx, L.ox + L.size + pw * 0.45, L.oy, pw * 0.7, L.size);
  for (let i = 0; i < 8; i++) {
    const x = L.ox + (i + 0.5) * (L.size / 8);
    drawLotus(ctx, x, L.oy - L.cell * 0.42, L.cell * 0.16);
    drawLotus(ctx, x, L.oy + L.size + L.cell * 0.42, L.cell * 0.16);
  }
  for (let n = 1; n <= 100; n++) {
    const r = cellRect(n, L);
    ctx.fillStyle = n === 100 ? "#efd7a6" : WASH[(n * 3 + gridOf(n).row) % WASH.length];
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "rgba(255, 244, 220, 0.55)";
    ctx.fillRect(r.x, r.y, r.w, Math.max(1, r.h * 0.07));
    ctx.fillRect(r.x, r.y, Math.max(1, r.w * 0.07), r.h);
    ctx.fillStyle = "rgba(70, 46, 24, 0.28)";
    ctx.fillRect(r.x, r.y + r.h * 0.93, r.w, r.h * 0.07);
    ctx.fillRect(r.x + r.w * 0.93, r.y, r.w * 0.07, r.h);
    const glow = G && G.glow[n];
    if (glow > 0.02) {
      ctx.fillStyle = "rgba(255, 196, 90, " + (0.35 * glow) + ")";
      ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    }
    ctx.fillStyle = "#3a2918";
    ctx.font = "600 " + Math.floor(L.cell * 0.2) + "px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), r.x + r.w * 0.46, r.y + r.h * 0.46);
  }
  const spots = [
    [L.ox, L.oy],
    [L.ox + L.size, L.oy],
    [L.ox, L.oy + L.size],
    [L.ox + L.size, L.oy + L.size],
  ];
  spots.forEach((p, i) => {
    const pulse = 0.7 + Math.sin(t * (7 + flick * 18) + i) * 0.3;
    const g = ctx.createRadialGradient(p[0], p[1], 2, p[0], p[1], L.cell * 2.4);
    g.addColorStop(0, "rgba(255, 170, 60, " + (0.16 * pulse) + ")");
    g.addColorStop(1, "rgba(255, 140, 40, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(L.ox - L.cell, L.oy - L.cell, L.size + L.cell * 2, L.size + L.cell * 2);
  });
}

function drawLadder(ctx, lad, L) {
  const line = ladderLine(lad, L);
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const rail = L.cell * 0.13;
  ctx.lineCap = "butt";
  ctx.strokeStyle = "#6e5340";
  ctx.lineWidth = Math.max(3, L.cell * 0.075);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(line.a.x + px * rail * s, line.a.y + py * rail * s);
    ctx.lineTo(line.b.x + px * rail * s, line.b.y + py * rail * s);
    ctx.stroke();
  }
  ctx.strokeStyle = "#f3e6cc";
  ctx.lineWidth = Math.max(1, L.cell * 0.02);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(line.a.x + px * (rail * s - L.cell * 0.02), line.a.y + py * (rail * s - L.cell * 0.02));
    ctx.lineTo(line.b.x + px * (rail * s - L.cell * 0.02), line.b.y + py * (rail * s - L.cell * 0.02));
    ctx.stroke();
  }
  ctx.strokeStyle = "#cbb892";
  ctx.lineWidth = Math.max(2, L.cell * 0.045);
  const steps = Math.max(4, Math.round(len / (L.cell * 0.48)));
  for (let i = 1; i < steps; i++) {
    const u = i / steps;
    const x = line.a.x + dx * u;
    const y = line.a.y + dy * u;
    ctx.beginPath();
    ctx.moveTo(x + px * rail, y + py * rail);
    ctx.lineTo(x - px * rail, y - py * rail);
    ctx.stroke();
  }
}

function lickAmount(snake) {
  if (!G || !G.lick || G.lick.head !== snake.head) return 0;
  const dur = 1.45;
  const u = 1 - (G.lick.until - G.t) / dur;
  if (u <= 0 || u >= 1) return 0;
  return Math.sin(u * Math.PI);
}

function strikeOf(snake) {
  const near = lickAmount(snake);
  const out = { rise: near * 0.45, mouth: near * 0.8, flare: 0.35 + near * 0.4, shake: 0, dim: near * 0.08, live: false, crack: 0 };
  if (G && G.step && G.step.kind === "snake" && G.step.from === snake.head) {
    const u = G.step.t / G.step.dur;
    out.live = true;
    if (u < 0.18) {
      out.rise = ease(u / 0.18) * 0.28;
      out.dim = (u / 0.18) * 0.28;
      out.crack = u / 0.18;
    } else if (u < 0.5) {
      const k = (u - 0.18) / 0.32;
      out.rise = 0.28 + ease(k) * 0.72;
      out.flare = 0.45 + k * 0.55;
      out.dim = 0.28 + k * 0.22;
      out.crack = 1;
      out.mouth = k * 0.25;
    } else if (u < 0.62) {
      const k = (u - 0.5) / 0.12;
      out.rise = 1;
      out.flare = 1;
      out.mouth = 0.35 + k * 0.65;
      out.shake = Math.sin(k * Math.PI);
      out.dim = 0.5;
      out.crack = 1;
    } else if (u < 0.9) {
      out.rise = 1;
      out.flare = 0.85;
      out.mouth = 0.7;
      out.dim = 0.38;
      out.crack = 0.6;
    } else {
      const k = (u - 0.9) / 0.1;
      out.rise = 1 - ease(k);
      out.flare = 0.4 * (1 - k);
      out.dim = 0.2 * (1 - k);
      out.crack = 0.3 * (1 - k);
    }
  }
  return out;
}

function activeAim(from, L) {
  if (!G) return 0;
  const kid = current();
  const p = kid.pos > 0 ? foot(kid, kid.pos, L, false) : foot(kid, 0, L, false);
  return Math.atan2(p.y - from.y, p.x - from.x);
}

function drawCarvedSnake(ctx, snake, L, t) {
  const pts = snakeRoute(snake, L);
  const phase = strikeOf(snake);
  const breath = 1 + Math.sin(t * 1.5 + snake.head) * 0.16;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = "rgba(60, 40, 24, 0.55)";
  ctx.lineWidth = Math.max(1, L.cell * 0.03 * breath);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 236, 200, 0.35)";
  ctx.lineWidth = Math.max(1, L.cell * 0.012);
  ctx.stroke();
  const head = pts[0];
  const nxt = pts[Math.min(1, pts.length - 1)];
  const track = activeAim(head, L);
  const base = Math.atan2(nxt.y - head.y, nxt.x - head.x);
  const ang = base * 0.35 + track * 0.65 + Math.sin(t * 0.6 + snake.head) * 0.15;
  const hr = L.cell * 0.055;
  if (phase.rise < 0.4) {
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(ang);
    ctx.fillStyle = "#5c4632";
    ctx.beginPath();
    ctx.ellipse(0, 0, hr * 1.3, hr * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffbf3a";
    ctx.globalAlpha = 0.45 + Math.sin(t * 3 + snake.head) * 0.25;
    ctx.beginPath();
    ctx.arc(hr * 0.35, -hr * 0.15, hr * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const flick = Math.sin(t * 5 + snake.head) > 0.86 ? 1 : 0;
    if (flick) {
      ctx.strokeStyle = "#a33b3b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hr, 0);
      ctx.lineTo(hr * 2.1, -hr * 0.25);
      ctx.moveTo(hr * 1.7, -hr * 0.05);
      ctx.lineTo(hr * 2.3, hr * 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }
  return { pts, phase, head };
}

function drawRisingCobra(ctx, head, cell, phase) {
  if (phase.rise < 0.05) return;
  const s = cell * (0.9 + phase.rise * 2.3);
  ctx.save();
  ctx.translate(head.x, head.y - phase.rise * cell * 0.15);
  ctx.scale(1, 0.35 + phase.rise * 0.65);
  const body = ctx.createLinearGradient(-s, 0, s, 0);
  body.addColorStop(0, "#142016");
  body.addColorStop(0.4, "#3f6b34");
  body.addColorStop(0.52, "#e4efb8");
  body.addColorStop(0.66, "#2d4e28");
  body.addColorStop(1, "#10160f");
  ctx.fillStyle = body;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.sin(i) * s * 0.05, s * (0.22 - i * 0.1), s * (0.34 - i * 0.05), s * 0.13, i * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, s * 0.08);
  ctx.quadraticCurveTo(-s * 0.02, -s * 0.35, 0, -s * 0.62);
  ctx.quadraticCurveTo(s * 0.04, -s * 0.35, s * 0.12, s * 0.08);
  ctx.fill();
  const hood = ctx.createLinearGradient(-s, -s, s, 0);
  hood.addColorStop(0, "#152016");
  hood.addColorStop(0.5, "#5a8a42");
  hood.addColorStop(1, "#1a2818");
  ctx.fillStyle = hood;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.58, s * (0.22 + phase.flare * 0.42), s * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(20, 30, 16, 0.45)";
  ctx.lineWidth = Math.max(1, s * 0.015);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(0, -s * 0.5, s * (0.08 + Math.abs(i) * 0.06), -0.8 + i * 0.15, 0.8 + i * 0.1);
    ctx.stroke();
  }
  ctx.strokeStyle = "#f4ecd0";
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath();
  ctx.arc(-s * 0.1, -s * 0.55, s * 0.055, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.1, -s * 0.55, s * 0.055, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.05, -s * 0.5);
  ctx.quadraticCurveTo(0, -s * 0.42, s * 0.05, -s * 0.5);
  ctx.stroke();
  ctx.fillStyle = "#24381e";
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.9, s * 0.14, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = "#ffbf3a";
  ctx.shadowBlur = s * 0.12;
  ctx.fillStyle = "#ffc24a";
  for (const dx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dx * s * 0.055, -s * 0.93, s * 0.03, s * 0.01, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (phase.mouth > 0.15) {
    ctx.fillStyle = "#f7f3e8";
    ctx.beginPath();
    ctx.moveTo(-s * 0.035, -s * 0.78);
    ctx.lineTo(-s * 0.02, -s * 0.66);
    ctx.lineTo(-s * 0.005, -s * 0.78);
    ctx.moveTo(s * 0.035, -s * 0.78);
    ctx.lineTo(s * 0.02, -s * 0.66);
    ctx.lineTo(s * 0.005, -s * 0.78);
    ctx.fill();
    ctx.strokeStyle = "#c23b48";
    ctx.lineWidth = Math.max(1, s * 0.018);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.76);
    ctx.lineTo(s * 0.02, -s * 0.76 + s * 0.16 * phase.mouth);
    ctx.moveTo(0, -s * 0.7);
    ctx.lineTo(-s * 0.03, -s * 0.7 + s * 0.1 * phase.mouth);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCracks(ctx, x, y, cell, k) {
  if (k <= 0.02) return;
  ctx.strokeStyle = "rgba(50, 32, 18, " + (0.25 + k * 0.45) + ")";
  ctx.lineWidth = Math.max(1, cell * 0.018);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * cell * 0.55 * k, y + Math.sin(a) * cell * 0.4 * k);
    ctx.lineTo(x + Math.cos(a + 0.4) * cell * 0.85 * k, y + Math.sin(a + 0.5) * cell * 0.7 * k);
    ctx.stroke();
  }
}

function star(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * Math.PI * 2) / 5 - Math.PI / 2;
    const b = a + Math.PI / 5;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(b) * r * 0.42, y + Math.sin(b) * r * 0.42);
  }
  ctx.closePath();
  ctx.fill();
}

function drawKid(ctx, player, L) {
  const pose = poseFor(player, L);
  if (!pose || pose.gulp < 0.04) return;
  const s = L.cell * 0.62 * pose.gulp;
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.rot || 0);
  ctx.scale(pose.sx, pose.sy);
  ctx.fillStyle = "rgba(50, 16, 16, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 2, s * 0.32, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4efe4";
  ctx.fillRect(-s * 0.16, -s * 0.2, s * 0.1, s * 0.18);
  ctx.fillRect(s * 0.06, -s * 0.2, s * 0.1, s * 0.18);
  ctx.fillStyle = KURTA[player.kurta];
  roundRect(ctx, -s * 0.28, -s * 0.62, s * 0.56, s * 0.46, s * 0.12);
  ctx.fill();
  ctx.strokeStyle = "#f3d48a";
  ctx.lineWidth = Math.max(1, s * 0.045);
  ctx.stroke();
  ctx.fillStyle = "#f3d48a";
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.62);
  ctx.lineTo(-s * 0.08, -s * 0.48);
  ctx.lineTo(s * 0.08, -s * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff8e8";
  ctx.font = "700 " + Math.floor(s * 0.22) + "px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.name.slice(0, 1).toUpperCase(), 0, -s * 0.36);
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = s * 0.09;
  ctx.lineCap = "round";
  const left = pose.arm === 1 ? -2.5 : pose.climb ? (pose.climbSide ? -2.2 : -0.5) : -0.35;
  const right = pose.arm === 1 || pose.arm === 2 ? -2.55 : pose.climb ? (pose.climbSide ? -0.45 : -2.25) : 0.35;
  ctx.beginPath();
  ctx.moveTo(-s * 0.24, -s * 0.5);
  ctx.lineTo(-s * 0.24 + Math.cos(left) * s * 0.28, -s * 0.5 + Math.sin(left) * s * 0.28);
  ctx.moveTo(s * 0.24, -s * 0.5);
  ctx.lineTo(s * 0.24 + Math.cos(right) * s * 0.28, -s * 0.5 + Math.sin(right) * s * 0.28);
  ctx.stroke();
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(0, -s * 0.86, s * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.arc(0, -s * 0.9, s * 0.28, Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -s * 1.16, s * 0.09, 0, Math.PI * 2);
  ctx.fill();
  const fy = -s * 0.84;
  if (pose.dizzy) {
    ctx.strokeStyle = "#3a2418";
    ctx.lineWidth = Math.max(1, s * 0.04);
    for (const dx of [-s * 0.09, s * 0.09]) {
      ctx.beginPath();
      ctx.arc(dx, fy, s * 0.055, pose.spin, pose.spin + Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.strokeStyle = "#a85a52";
    ctx.beginPath();
    ctx.arc(0, fy + s * 0.12, s * 0.06, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else if (pose.panic) {
    ctx.fillStyle = "#fff";
    for (const dx of [-s * 0.09, s * 0.09]) {
      ctx.beginPath();
      ctx.ellipse(dx, fy, s * 0.065, s * 0.085, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a1a14";
      ctx.beginPath();
      ctx.arc(dx, fy + s * 0.02, s * 0.028, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
    }
    ctx.fillStyle = "#7a2430";
    ctx.beginPath();
    ctx.ellipse(0, fy + s * 0.15, s * 0.065, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#3a2418";
    ctx.beginPath();
    ctx.arc(-s * 0.085, fy, s * 0.032, 0, Math.PI * 2);
    ctx.arc(s * 0.085, fy, s * 0.032, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c46a62";
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath();
    ctx.arc(0, fy + s * 0.06, s * 0.07, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  if (pose.sweat > 0) {
    const drop = -s * 1.2 + pose.sweat * s * 1.05;
    ctx.fillStyle = "rgba(214, 242, 255, 0.95)";
    ctx.beginPath();
    ctx.ellipse(s * 0.22, drop, s * 0.045, s * 0.07, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (pose.dizzy) {
    ctx.fillStyle = "#f3d48a";
    for (let i = 0; i < 3; i++) {
      const a = pose.spin + (i * Math.PI * 2) / 3;
      star(ctx, Math.cos(a) * s * 0.55, -s * 1.15 + Math.sin(a) * s * 0.22, s * 0.09, a);
    }
  }
  if (G && player === current() && G.phase !== "win") {
    ctx.strokeStyle = "rgba(243, 212, 138, 0.95)";
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.04, s * 0.34, s * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function poseFor(player, L) {
  let x;
  let y;
  let sx = 1;
  let sy = 1;
  let rot = 0;
  let gulp = 1;
  let arm = 0;
  let panic = 0;
  let dizzy = 0;
  let sweat = 0;
  let climb = false;
  let climbSide = false;
  const step = G.step;
  const mine = step && (step.player === player || step.other === player);
  if (!mine) {
    if (player.pos <= 0 && G.phase !== "win") {
      const gate = foot(player, 0, L, false);
      x = gate.x;
      y = gate.y;
    } else if (player.pos <= 0) {
      return null;
    } else {
      const f = foot(player, player.pos, L, false);
      x = f.x;
      y = f.y + Math.sin(G.t * 2.2 + player.id) * L.cell * 0.012;
    }
  }
  if (step && step.kind === "hop" && step.player === player) {
    const u = step.t / step.dur;
    const a = foot(player, step.from, L, false);
    const b = foot(player, step.to, L, true);
    const eu = ease(Math.min(1, u));
    x = lerp(a.x, b.x, eu);
    y = lerp(a.y, b.y, eu) - Math.sin(Math.min(1, u) * Math.PI) * L.cell * 0.42;
    const stretch = Math.sin(Math.min(1, u) * Math.PI);
    sx = 1 - stretch * 0.1;
    sy = 1 + stretch * 0.16;
    if (u > 0.86) {
      sx = 1.18;
      sy = 0.76;
    }
  } else if (step && step.kind === "ladder" && step.player === player) {
    const u = Math.min(1, step.t / step.dur);
    const lad = LADDERS.find((l) => l.from === step.from);
    const line = ladderLine(lad, L);
    const rungs = 6;
    const f = u * rungs;
    const rung = Math.min(rungs - 1, Math.floor(f));
    const ru = f - rung;
    const t0 = rung / rungs;
    const t1 = Math.min(1, (rung + 1) / rungs);
    const hop = ease(Math.min(1, ru));
    x = lerp(line.a.x, line.b.x, lerp(t0, t1, hop));
    y = lerp(line.a.y, line.b.y, lerp(t0, t1, hop)) - Math.sin(Math.min(1, ru) * Math.PI) * L.cell * 0.1;
    climb = true;
    climbSide = rung % 2 === 0;
    if (u > 0.84) arm = 2;
    sx = 1.05;
    sy = 0.96;
  } else if (step && step.kind === "snake" && step.player === player) {
    const u = step.t / step.dur;
    const head = foot(player, step.from, L, false);
    const tail = foot(player, step.to, L, true);
    const sn = SNAKES.find((s) => s.head === step.from);
    const route = sn ? snakeRoute(sn, L) : [head, tail];
    if (u < 0.5) {
      x = head.x + Math.sin(u * 36) * L.cell * 0.03;
      y = head.y;
      panic = 1;
      arm = 1;
    } else if (u < 0.62) {
      const k = (u - 0.5) / 0.12;
      x = head.x;
      y = head.y - k * L.cell * 0.45;
      panic = 1;
      arm = 1;
      gulp = 1 - k * 0.25;
    } else if (u < 0.74) {
      const k = (u - 0.62) / 0.12;
      x = head.x;
      y = head.y - L.cell * 0.4;
      gulp = 0.75 * (1 - k);
      panic = 1;
    } else if (u < 0.9) {
      const k = (u - 0.74) / 0.16;
      const p = pointAlong(route, k);
      x = p.x;
      y = p.y;
      gulp = 0.48;
      panic = 1;
      rot = Math.sin(k * 14) * 0.45;
    } else {
      const k = (u - 0.9) / 0.1;
      x = tail.x;
      y = tail.y - Math.sin(Math.min(1, k) * Math.PI) * L.cell * 0.3;
      gulp = Math.min(1, k * 1.5);
      dizzy = 1;
      rot = Math.sin(k * 16) * 0.45;
    }
  } else if (step && step.kind === "bump" && (step.player === player || step.other === player)) {
    const f = foot(player, player.pos, L, false);
    const u = Math.sin(Math.min(1, step.t / step.dur) * Math.PI);
    const dir = step.player === player ? -1 : 1;
    x = f.x + dir * u * L.cell * 0.34;
    y = f.y - u * L.cell * 0.06;
    rot = dir * u * 0.25;
    sx = 1 + u * 0.08;
    sy = 1 - u * 0.08;
  } else if (step && step.kind === "near" && step.player === player) {
    const f = foot(player, player.pos, L, false);
    x = f.x;
    y = f.y;
    sweat = Math.min(1, step.t / step.dur);
    sx = 1.04;
  } else if (step && step.kind === "overshoot" && step.player === player) {
    const f = foot(player, player.pos, L, false);
    const u = step.t / step.dur;
    x = f.x;
    y = f.y - Math.sin(Math.min(1, u) * Math.PI) * L.cell * 0.12;
    rot = Math.sin(u * Math.PI * 4) * 0.18;
    sx = 1.14;
    sy = 0.84;
  }
  if (G.winner === player) {
    arm = 1;
    y -= Math.abs(Math.sin(G.t * 6)) * L.cell * 0.08;
  }
  return { x, y, sx, sy, rot, gulp, arm, panic, dizzy, sweat, climb, climbSide, spin: G.t * 7 };
}

function drawFog(ctx, L, t) {
  for (const sn of SNAKES) {
    const r = cellRect(sn.head, L);
    const x = r.x + r.w * 0.55;
    const y = r.y + r.h * 0.9 + Math.sin(t * 0.8 + sn.head) * 1.5;
    const g = ctx.createRadialGradient(x, y, 1, x, y, L.cell * 0.42);
    g.addColorStop(0, "rgba(170, 160, 130, 0.2)");
    g.addColorStop(1, "rgba(170, 160, 130, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, L.cell * 0.42, L.cell * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRangoli(ctx, L) {
  if (!G || !G.winner) return;
  const p = Math.max(0, Math.min(1, (G.t - G.winT) / 1.25));
  if (p <= 0) return;
  const c = center(100, L);
  const rings = [8, 12, 16];
  rings.forEach((n, ring) => {
    const rad = L.cell * (0.45 + ring * 0.5) * p;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + G.t * (ring % 2 ? -0.35 : 0.4) + ring;
      ctx.save();
      ctx.translate(c.x + Math.cos(a) * rad, c.y + Math.sin(a) * rad);
      ctx.rotate(a);
      ctx.fillStyle = CONFETTI[(i + ring) % CONFETTI.length];
      ctx.beginPath();
      ctx.ellipse(0, 0, L.cell * 0.07 * p, L.cell * 0.16 * p, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
  ctx.fillStyle = "#fff8e4";
  ctx.beginPath();
  ctx.arc(c.x, c.y, L.cell * 0.16 * p, 0, Math.PI * 2);
  ctx.fill();
}

function drawFx(ctx, L) {
  if (!G) return;
  for (const p of G.fx) {
    if (p.kind === "dust" || p.kind === "chip") {
      ctx.fillStyle = p.kind === "chip"
        ? "rgba(92, 64, 36, " + (p.life / p.max) + ")"
        : "rgba(120, 84, 48, " + (p.life / p.max) * 0.4 + ")";
      if (p.kind === "chip") ctx.fillRect(p.x, p.y, p.w, p.h);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, (1 - p.life / p.max) * L.cell * 0.16 + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.kind === "confetti") {
      ctx.save();
      ctx.translate(p.x * L.w, p.y * L.h);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
  }
}

function fit(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function render() {
  fit(board);
  const ctx = board.getContext("2d");
  const L = layout();
  const t = G ? G.t : performance.now() / 1000;
  ctx.clearRect(0, 0, L.w, L.h);
  ctx.fillStyle = "#4e3d30";
  ctx.fillRect(0, 0, L.w, L.h);
  let flick = 0;
  let dim = 0;
  let shake = 0;
  let risen = null;
  for (const sn of SNAKES) {
    const phase = strikeOf(sn);
    if (phase.rise > (risen ? risen.phase.rise : 0)) {
      risen = { sn, phase, head: snakeRoute(sn, L)[0] };
    }
    flick = Math.max(flick, phase.dim);
    dim = Math.max(dim, phase.dim);
    shake = Math.max(shake, phase.shake);
  }
  ctx.save();
  const zoom = G ? G.cam.zoom : 1;
  const rot = G ? G.cam.rot : 0;
  ctx.translate(L.w / 2, L.h / 2);
  ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.translate(-L.w / 2 + Math.sin(t * 70) * shake * L.cell * 0.07, -L.h / 2 + Math.cos(t * 60) * shake * L.cell * 0.04);
  drawBoard(ctx, L, t, flick);
  for (const lad of LADDERS) drawLadder(ctx, lad, L);
  for (const sn of SNAKES) drawCarvedSnake(ctx, sn, L, t);
  drawFog(ctx, L, t);
  drawRangoli(ctx, L);
  if (G) {
    const moving = G.step && G.step.player;
    const order = G.players.filter((p) => p !== moving);
    if (moving) order.push(moving);
    for (const p of order) {
      if (p.pos > 0 || (G.step && G.step.player === p) || G.phase !== "win") drawKid(ctx, p, L);
    }
  }
  drawFx(ctx, L);
  if (dim > 0.02) {
    ctx.fillStyle = "rgba(18, 10, 4, " + dim + ")";
    ctx.fillRect(0, 0, L.w, L.h);
  }
  if (risen && risen.phase.rise > 0.05) {
    if (risen.phase.crack > 0) drawCracks(ctx, risen.head.x, risen.head.y, L.cell, risen.phase.crack);
    if (risen.phase.live && risen.phase.rise > 0.45) {
      const pts = snakeRoute(risen.sn, L);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = "#1c3218";
      ctx.lineWidth = L.cell * (0.08 + risen.phase.rise * 0.14);
      ctx.stroke();
      ctx.strokeStyle = "#d5e2a4";
      ctx.lineWidth = L.cell * 0.03 * risen.phase.rise;
      ctx.stroke();
    }
    drawRisingCobra(ctx, risen.head, L.cell, risen.phase);
    if (G && G.step && G.step.kind === "snake" && G.step.player) drawKid(ctx, G.step.player, L);
  }
  ctx.restore();
  const ds = Math.min(L.w, L.h) * 0.035;
  const torch = flick > 0.2 ? 2.4 : 1;
  drawDiya(ctx, ds * 1.6, ds * 1.5, ds, t * torch);
  drawDiya(ctx, L.w - ds * 1.6, ds * 1.5, ds, t * torch + 1);
  drawDiya(ctx, ds * 1.6, L.h - ds * 1.2, ds, t * torch + 2);
  drawDiya(ctx, L.w - ds * 1.6, L.h - ds * 1.2, ds, t * torch + 3);
  drawDie();
  syncHud();
}

function drawDie() {
  fit(dieCanvas);
  const ctx = dieCanvas.getContext("2d");
  const w = dieCanvas.width;
  const h = dieCanvas.height;
  ctx.clearRect(0, 0, w, h);
  let face = G ? G.lastRoll : 6;
  let rot = Math.sin(performance.now() / 500) * 0.06;
  let scale = 1;
  if (G && G.step && G.step.kind === "dice") {
    const u = G.step.t / G.step.dur;
    if (u < 0.72) {
      face = 1 + (Math.floor(G.step.t * 18) % 6);
      rot = Math.sin(G.step.t * 32) * 0.45;
      scale = 0.9 + (G.step.t * 13) % 0.12;
    } else {
      face = G.step.value;
      const k = (u - 0.72) / 0.28;
      scale = 1 + Math.sin(k * Math.PI) * 0.1;
      rot = (1 - k) * 0.25;
    }
  }
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  const s = Math.min(w, h) * 0.74;
  roundRect(ctx, -s / 2, -s / 2, s, s, s * 0.12);
  const stone = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
  stone.addColorStop(0, "#f4ead8");
  stone.addColorStop(0.5, "#e2d0b4");
  stone.addColorStop(1, "#b89a74");
  ctx.fillStyle = stone;
  ctx.fill();
  ctx.strokeStyle = "#6e5340";
  ctx.lineWidth = s * 0.045;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 244, 220, 0.7)";
  ctx.lineWidth = s * 0.02;
  roundRect(ctx, -s * 0.42, -s * 0.42, s * 0.84, s * 0.84, s * 0.08);
  ctx.stroke();
  for (const [px, py] of PIPS[face]) {
    const cx = -s * 0.26 + px * s * 0.26;
    const cy = -s * 0.26 + py * s * 0.26;
    ctx.fillStyle = "rgba(60, 40, 24, 0.55)";
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 244, 220, 0.35)";
    ctx.beginPath();
    ctx.arc(cx - s * 0.015, cy - s * 0.015, s * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (G) {
    for (const p of G.dieFx) {
      ctx.fillStyle = "rgba(255, 220, 120, " + p.life / p.max + ")";
      star(ctx, p.x * w, p.y * h, Math.min(w, h) * 0.06, p.life * 8);
    }
  }
}

function syncHud() {
  const status = document.getElementById("status");
  const roster = document.getElementById("roster");
  if (!G) {
    status.textContent = "Choose players, then roll.";
    diceBtn.disabled = true;
    return;
  }
  if (roster.childElementCount !== G.players.length) {
    roster.innerHTML = G.players.map(() => "<li><i></i><span class='nm'></span><b></b></li>").join("");
  }
  [...roster.children].forEach((li, i) => {
    const p = G.players[i];
    li.classList.toggle("on", i === G.turn && G.phase !== "win");
    li.querySelector("i").style.background = KURTA[p.kurta];
    li.querySelector(".nm").textContent = p.name + (p.cpu ? " · cpu" : "");
    li.querySelector("b").textContent = p.pos ? String(p.pos) : "–";
  });
  status.textContent = G.msg;
  const ready = G.phase === "roll" && !current().cpu;
  diceBtn.disabled = !ready;
  diceBtn.setAttribute("aria-label", ready ? "Roll for " + current().name : "Dice");
}

function readPlayers() {
  return [...document.querySelectorAll("#rows .prow")].map((row) => ({
    name: row.querySelector("input").value.trim(),
    cpu: row.querySelector(".cpu").getAttribute("aria-pressed") === "true",
  }));
}

function renderRows(n) {
  const rows = document.getElementById("rows");
  rows.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const row = document.createElement("div");
    row.className = "prow";
    const cpu = i % 2 === 1;
    row.innerHTML =
      "<i style='background:" + KURTA[i] + "'></i>" +
      "<input maxlength='12' value='" + NAMES[i] + "' aria-label='Player " + (i + 1) + " name'>" +
      "<button type='button' class='cpu' aria-pressed='" + cpu + "'>" + (cpu ? "Computer" : "Human") + "</button>";
    row.querySelector(".cpu").addEventListener("click", (e) => {
      const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
      e.currentTarget.setAttribute("aria-pressed", String(on));
      e.currentTarget.textContent = on ? "Computer" : "Human";
    });
    rows.appendChild(row);
  }
}

document.querySelectorAll(".count button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".count button").forEach((b) => b.classList.remove("on"));
    btn.classList.add("on");
    renderRows(Number(btn.dataset.n));
  });
});

document.getElementById("start").addEventListener("click", () => {
  audio.unlock();
  begin(readPlayers());
});

document.getElementById("again").addEventListener("click", () => {
  audio.unlock();
  if (G) begin(G.spec);
});

document.getElementById("menu-back").addEventListener("click", () => {
  winEl.hidden = true;
  menu.hidden = false;
  G = null;
  document.getElementById("roster").innerHTML = "";
});

diceBtn.addEventListener("click", () => {
  audio.unlock();
  if (!G || G.phase !== "roll" || current().cpu) return;
  performRoll();
});

window.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.repeat) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
  e.preventDefault();
  audio.unlock();
  if (!G || G.phase !== "roll" || current().cpu) return;
  performRoll();
});

muteBtn.addEventListener("click", () => {
  audio.unlock();
  audioSetMuted(!audio.muted);
  try { localStorage.setItem("saanp-mute", audio.muted ? "1" : "0"); } catch (err) {}
});

renderRows(2);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * speed;
  last = now;
  tick(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__saanp = {
  queueRolls(list) {
    if (G) G.rolls.push(...list);
    else queued.push(...list);
  },
  setSpeed(n) { speed = n; },
  start(players) { begin(players); },
  roll() {
    if (G && G.phase === "roll") performRoll();
  },
  place(pos) {
    pos.forEach((n, i) => {
      if (G.players[i]) G.players[i].pos = n;
    });
  },
  state() {
    if (!G) return { phase: "menu", pos: [], step: null, turn: 0, cpu: false, msg: "", winner: null, lastRoll: 0 };
    return {
      phase: G.phase,
      pos: G.players.map((p) => p.pos),
      step: G.step ? G.step.kind : null,
      turn: G.turn,
      cpu: current().cpu,
      msg: G.msg,
      winner: G.winner ? G.winner.name : null,
      lastRoll: G.lastRoll,
      seen: G.seen.slice(),
    };
  },
};
