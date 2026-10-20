"use strict";

const KURTA = ["#e07020", "#8d2433", "#243e86", "#0f7a56"];
const SKIN = "#f0c09a";
const HAIR = "#2a160f";
const WASH = ["#f7e2b8", "#f3c98a", "#f8dcc0", "#e7c4a4", "#e4ecd4", "#d9e0f2", "#f6d3c2", "#efe3b4"];
const CONFETTI = ["#e07020", "#8d2433", "#243e86", "#f3d48a", "#f6e7c1", "#1f7a5a"];
const NAMES = ["Anaya", "Vihaan", "Meera", "Kabir"];

const SNAKES = [
  { head: 16, tail: 6, color: "#2e6b3a", band: "#e6c15a", c1: 0.35, n1: 0.9, c2: 0.7, n2: -0.35 },
  { head: 47, tail: 26, color: "#7a2e4a", band: "#f0d78c", c1: 0.3, n1: -1.15, c2: 0.68, n2: 0.7 },
  { head: 49, tail: 11, color: "#24536e", band: "#e7b15a", c1: 0.28, n1: 1.35, c2: 0.66, n2: -0.85 },
  { head: 56, tail: 53, color: "#3d6b32", band: "#f2d48a", c1: 0.4, n1: 0.85, c2: 0.72, n2: 0.4 },
  { head: 62, tail: 19, color: "#6b3a1f", band: "#efd59a", c1: 0.32, n1: -1.25, c2: 0.64, n2: 0.95 },
  { head: 64, tail: 60, color: "#1f5c4a", band: "#f0c36a", c1: 0.45, n1: -0.7, c2: 0.75, n2: -0.2 },
  { head: 87, tail: 24, color: "#7c2d2d", band: "#f3d78a", c1: 0.3, n1: 1.7, c2: 0.62, n2: -1.35 },
  { head: 93, tail: 73, color: "#3a4a86", band: "#f0d090", c1: 0.4, n1: 0.55, c2: 0.75, n2: -0.4 },
  { head: 95, tail: 75, color: "#2f5d34", band: "#e8c56a", c1: 0.38, n1: -0.7, c2: 0.72, n2: 0.4 },
  { head: 98, tail: 78, color: "#6a2a58", band: "#f2d9a0", c1: 0.4, n1: 0.7, c2: 0.74, n2: -0.35 },
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
  hiss() { this.noise(0.32, 0.07, 1700); },
  slide() { this.noise(0.45, 0.06, 280); },
  climb() {
    [523, 587, 659, 784, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, "triangle", 0.045), i * 160));
  },
  lick() { this.tone(880, 0.07, "square", 0.025); },
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
  const margin = Math.min(w, h) * 0.08;
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

function snakeGeom(snake, L) {
  const a = center(snake.head, L);
  const b = center(snake.tail, L);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  return {
    a,
    b,
    c1: { x: a.x + dx * snake.c1 + px * snake.n1 * L.cell, y: a.y + dy * snake.c1 + py * snake.n1 * L.cell },
    c2: { x: a.x + dx * snake.c2 + px * snake.n2 * L.cell, y: a.y + dy * snake.c2 + py * snake.n2 * L.cell },
  };
}

function bezier(g, t) {
  const u = 1 - t;
  return {
    x: u * u * u * g.a.x + 3 * u * u * t * g.c1.x + 3 * u * t * t * g.c2.x + t * t * t * g.b.x,
    y: u * u * u * g.a.y + 3 * u * u * t * g.c1.y + 3 * u * t * t * g.c2.y + t * t * t * g.b.y,
  };
}

function snakePoints(snake, L) {
  const g = snakeGeom(snake, L);
  const pts = [];
  for (let i = 0; i <= 26; i++) pts.push(bezier(g, i / 26));
  return pts;
}

function normalAt(pts, i) {
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
}

function tangentAt(pts, i) {
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
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
    else if (sn) G.queue.push({ kind: "snake", player: p, from: dest, to: sn.tail, dur: reduceMotion ? 0.5 : 2.2 });
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
  if (near) extra.push({ kind: "near", player: p, head: near.head, dur: 1.15 });
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
    G.msg = next.player.name + " meets a snake!";
    audio.hiss();
  }
  if (next.kind === "bump") {
    G.msg = "A shove on square " + next.player.pos + "!";
    audio.bump();
  }
  if (next.kind === "near") {
    G.msg = "So close. The snake licks its lips.";
    G.lick = { head: next.head, until: G.t + next.dur };
    audio.lick();
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
    if (step.kind === "snake" && !step.slid && step.t > step.dur * 0.46) {
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

function drawPaisley(ctx, x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.fillStyle = "#e6c36a";
  ctx.beginPath();
  ctx.moveTo(0, 0.15);
  ctx.bezierCurveTo(0.55, 0.45, 0.62, -0.25, 0, -1);
  ctx.bezierCurveTo(-0.5, -0.2, -0.4, 0.4, 0, 0.15);
  ctx.fill();
  ctx.fillStyle = "#5c1424";
  ctx.beginPath();
  ctx.arc(0, -0.32, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

function drawBoard(ctx, L) {
  for (let n = 1; n <= 100; n++) {
    const r = cellRect(n, L);
    const inset = Math.max(1, L.cell * 0.03);
    ctx.fillStyle = n === 100 ? "#f8d56a" : WASH[(n * 3 + gridOf(n).row) % WASH.length];
    roundRect(ctx, r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2, L.cell * 0.08);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(r.x + L.cell * 0.1, r.y + L.cell * 0.08, r.w * 0.42, r.h * 0.08);
    const glow = G && G.glow[n];
    if (glow > 0.02) {
      ctx.fillStyle = "rgba(255, 214, 110, " + (0.5 * glow) + ")";
      ctx.fill();
    }
    ctx.save();
    ctx.translate(r.x + r.w * 0.16, r.y + r.h * 0.2);
    ctx.rotate(((n * 17) % 7 - 3) * 0.012);
    ctx.fillStyle = "#4a1c24";
    ctx.font = "600 " + Math.floor(L.cell * 0.26) + "px Georgia, serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
  }
  const pad = L.cell * 0.34;
  ctx.strokeStyle = "#e6c36a";
  ctx.lineWidth = Math.max(2, L.cell * 0.055);
  ctx.strokeRect(L.ox - pad, L.oy - pad, L.size + pad * 2, L.size + pad * 2);
  ctx.lineWidth = Math.max(1, L.cell * 0.016);
  ctx.strokeRect(L.ox - pad + L.cell * 0.14, L.oy - pad + L.cell * 0.14, L.size + pad * 2 - L.cell * 0.28, L.size + pad * 2 - L.cell * 0.28);
  const corners = [
    [L.ox - pad, L.oy - pad, 0.6],
    [L.ox + L.size + pad, L.oy - pad, 2.2],
    [L.ox - pad, L.oy + L.size + pad, -0.6],
    [L.ox + L.size + pad, L.oy + L.size + pad, 3.6],
  ];
  for (const [x, y, rot] of corners) drawPaisley(ctx, x, y, L.cell * 0.34, rot);
}

function drawLadder(ctx, lad, L) {
  const line = ladderLine(lad, L);
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const rail = L.cell * 0.16;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#8a5424";
  ctx.lineWidth = Math.max(2, L.cell * 0.05);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(line.a.x + px * rail * s, line.a.y + py * rail * s);
    ctx.lineTo(line.b.x + px * rail * s, line.b.y + py * rail * s);
    ctx.stroke();
  }
  ctx.strokeStyle = "#f0d090";
  ctx.lineWidth = Math.max(1.5, L.cell * 0.03);
  const steps = Math.max(3, Math.round(len / (L.cell * 0.55)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = line.a.x + dx * t;
    const y = line.a.y + dy * t;
    ctx.beginPath();
    ctx.moveTo(x + px * rail, y + py * rail);
    ctx.lineTo(x - px * rail, y - py * rail);
    ctx.stroke();
  }
  ctx.fillStyle = "#f3d48a";
  for (const p of [line.a, line.b]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, L.cell * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
}

function lickAmount(snake) {
  if (!G || !G.lick || G.lick.head !== snake.head) return 0;
  const dur = 1.15;
  const u = 1 - (G.lick.until - G.t) / dur;
  if (u <= 0 || u >= 1) return 0;
  return Math.sin(u * Math.PI);
}

function drawSnake(ctx, snake, L) {
  const pts = snakePoints(snake, L);
  let lunge = 0;
  let bulge = -1;
  if (G && G.step && G.step.kind === "snake" && G.step.from === snake.head) {
    const u = G.step.t / G.step.dur;
    if (u < 0.32) lunge = Math.sin((u / 0.32) * Math.PI);
    if (u > 0.46 && u < 0.8) bulge = (u - 0.46) / 0.34;
  }
  const tongue = Math.max(lunge, lickAmount(snake));
  const widthAt = (t) => {
    const base = L.cell * 0.18 * (1 - t * 0.5);
    const bump = bulge < 0 ? 0 : Math.exp(-((t - bulge) ** 2) / 0.008) * L.cell * 0.16;
    return base + bump;
  };
  const traceBody = (scale) => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const n = normalAt(pts, i);
      const w = widthAt(i / (pts.length - 1)) * scale;
      const x = pts[i].x + n.x * w;
      const y = pts[i].y + n.y * w;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const n = normalAt(pts, i);
      const w = widthAt(i / (pts.length - 1)) * scale;
      ctx.lineTo(pts[i].x - n.x * w, pts[i].y - n.y * w);
    }
    ctx.closePath();
  };
  traceBody(1);
  ctx.fillStyle = snake.color;
  ctx.fill();
  ctx.strokeStyle = "rgba(40, 12, 16, 0.35)";
  ctx.lineWidth = Math.max(1, L.cell * 0.02);
  ctx.stroke();
  traceBody(0.45);
  ctx.fillStyle = snake.band;
  ctx.globalAlpha = 0.55;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = snake.band;
  ctx.lineWidth = Math.max(1, L.cell * 0.025);
  for (let i = 3; i < pts.length - 1; i += 3) {
    const n = normalAt(pts, i);
    const w = widthAt(i / (pts.length - 1)) * 0.8;
    ctx.beginPath();
    ctx.moveTo(pts[i].x + n.x * w, pts[i].y + n.y * w);
    ctx.lineTo(pts[i].x - n.x * w, pts[i].y - n.y * w);
    ctx.stroke();
  }
  const tang = tangentAt(pts, 1);
  const hx = pts[0].x + tang.x * L.cell * (0.2 - lunge * 0.55);
  const hy = pts[0].y + tang.y * L.cell * (0.2 - lunge * 0.55);
  const hr = L.cell * (0.2 + lunge * 0.06);
  const ang = Math.atan2(tang.y, tang.x);
  ctx.fillStyle = snake.color;
  ctx.beginPath();
  ctx.ellipse(hx + tang.x * hr * 0.15, hy + tang.y * hr * 0.15, hr * 1.35, hr * 0.72, ang + Math.PI / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = snake.color;
  ctx.beginPath();
  ctx.ellipse(hx, hy, hr * 1.2, hr * 0.86, Math.atan2(tang.y, tang.x), 0, Math.PI * 2);
  ctx.fill();
  const side = { x: -tang.y, y: tang.x };
  for (const s of [-1, 1]) {
    const ex = hx + side.x * hr * 0.38 * s - tang.x * hr * 0.15;
    const ey = hy + side.y * hr * 0.38 * s - tang.y * hr * 0.15;
    ctx.fillStyle = "#fff8e4";
    ctx.beginPath();
    ctx.arc(ex, ey, hr * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1b120c";
    ctx.beginPath();
    ctx.arc(ex - tang.x * hr * 0.08, ey - tang.y * hr * 0.08, hr * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  if (lunge > 0.35) {
    ctx.fillStyle = "#9a2434";
    ctx.beginPath();
    ctx.ellipse(hx - tang.x * hr * 0.7, hy - tang.y * hr * 0.7, hr * 0.28 * lunge, hr * 0.18, Math.atan2(tang.y, tang.x), 0, Math.PI * 2);
    ctx.fill();
  }
  if (tongue > 0.05) {
    ctx.strokeStyle = "#d64555";
    ctx.lineWidth = Math.max(1, hr * 0.14);
    ctx.lineCap = "round";
    const len = hr * 1.45 * tongue;
    const tx = hx - tang.x * (hr + len);
    const ty = hy - tang.y * (hr + len);
    ctx.beginPath();
    ctx.moveTo(hx - tang.x * hr * 0.8, hy - tang.y * hr * 0.8);
    ctx.lineTo(tx, ty);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - tang.x * len * 0.28 + side.x * len * 0.22, ty - tang.y * len * 0.28 + side.y * len * 0.22);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - tang.x * len * 0.28 - side.x * len * 0.22, ty - tang.y * len * 0.28 - side.y * len * 0.22);
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
    if (u < 0.34) {
      x = head.x + Math.sin(u * 70) * L.cell * 0.04;
      y = head.y;
      panic = 1;
      arm = 1;
    } else if (u < 0.46) {
      x = head.x;
      y = head.y;
      gulp = 1 - (u - 0.34) / 0.12;
      panic = 1;
    } else if (u < 0.78) {
      gulp = 0;
      x = head.x;
      y = head.y;
    } else {
      const k = (u - 0.78) / 0.22;
      x = tail.x;
      y = tail.y - Math.sin(Math.min(1, k) * Math.PI) * L.cell * 0.22;
      gulp = Math.min(1, k * 1.35);
      dizzy = 1;
      rot = Math.sin(k * 14) * 0.35;
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
    if (p.kind === "dust") {
      ctx.fillStyle = "rgba(120, 84, 48, " + (p.life / p.max) * 0.4 + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, (1 - p.life / p.max) * L.cell * 0.16 + 1, 0, Math.PI * 2);
      ctx.fill();
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
  ctx.fillStyle = "#5c1424";
  ctx.fillRect(0, 0, L.w, L.h);
  ctx.save();
  const zoom = G ? G.cam.zoom : 1;
  const rot = G ? G.cam.rot : 0;
  ctx.translate(L.w / 2, L.h / 2);
  ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.translate(-L.w / 2, -L.h / 2);
  drawBoard(ctx, L);
  for (const lad of LADDERS) drawLadder(ctx, lad, L);
  for (const sn of SNAKES) drawSnake(ctx, sn, L);
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
  ctx.restore();
  const ds = Math.min(L.w, L.h) * 0.035;
  drawDiya(ctx, ds * 1.6, ds * 1.5, ds, t);
  drawDiya(ctx, L.w - ds * 1.6, ds * 1.5, ds, t + 1);
  drawDiya(ctx, ds * 1.6, L.h - ds * 1.2, ds, t + 2);
  drawDiya(ctx, L.w - ds * 1.6, L.h - ds * 1.2, ds, t + 3);
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
  roundRect(ctx, -s / 2, -s / 2, s, s, s * 0.18);
  ctx.fillStyle = "#fbf6ea";
  ctx.fill();
  ctx.strokeStyle = "#6a3a12";
  ctx.lineWidth = s * 0.045;
  ctx.stroke();
  ctx.fillStyle = face === 6 ? "#8d2433" : "#2a1a14";
  for (const [px, py] of PIPS[face]) {
    ctx.beginPath();
    ctx.arc(-s * 0.26 + px * s * 0.26, -s * 0.26 + py * s * 0.26, s * 0.075, 0, Math.PI * 2);
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
