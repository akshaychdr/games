"use strict";

const KURTA = ["#d4783a", "#b84a4a", "#4f6d62", "#7a5a86"];
const LOOK = [
  { kind: "boy", cloth: "#d4783a", accent: "#f0d7a4" },
  { kind: "girl", cloth: "#b84a4a", accent: "#f3d2c4" },
  { kind: "boy", cloth: "#4f6d62", accent: "#ead9b4" },
  { kind: "girl", cloth: "#7a5a86", accent: "#f0d5c8" },
];
const WASH = ["#f4ecdc", "#d9b59c", "#c9d4c2", "#e6d3b2"];
const CONFETTI = ["#d4783a", "#b84a4a", "#4f6d62", "#e6d3a4", "#f4ecdc", "#7a5a86"];
const NAMES = ["Anaya", "Vihaan", "Meera", "Kabir"];

const SNAKES = [
  { head: 16, tail: 6, color: "#6e8f74", scale: "#d9d4bc", c1: 0.35, n1: 0.9, c2: 0.7, n2: -0.35 },
  { head: 47, tail: 26, color: "#8d6d88", scale: "#e4d8c8", c1: 0.3, n1: -1.15, c2: 0.68, n2: 0.7 },
  { head: 49, tail: 11, color: "#6d8796", scale: "#ddd6c4", c1: 0.28, n1: 1.35, c2: 0.66, n2: -0.85 },
  { head: 56, tail: 53, color: "#a06d68", scale: "#eadcc8", c1: 0.4, n1: 0.85, c2: 0.72, n2: 0.4 },
  { head: 62, tail: 19, color: "#5f866c", scale: "#d7d2b8", c1: 0.32, n1: -1.25, c2: 0.64, n2: 0.95 },
  { head: 64, tail: 60, color: "#7d6a96", scale: "#e6dcc8", c1: 0.45, n1: -0.7, c2: 0.75, n2: -0.2 },
  { head: 87, tail: 24, color: "#9a6a72", scale: "#ead8c6", c1: 0.3, n1: 1.7, c2: 0.62, n2: -1.35 },
  { head: 93, tail: 73, color: "#6a8498", scale: "#ddd4c2", c1: 0.4, n1: 0.55, c2: 0.75, n2: -0.4 },
  { head: 95, tail: 75, color: "#6a8a6e", scale: "#d8d3b8", c1: 0.38, n1: -0.7, c2: 0.72, n2: 0.4 },
  { head: 98, tail: 78, color: "#946878", scale: "#ead9c8", c1: 0.4, n1: 0.7, c2: 0.74, n2: -0.35 },
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

const SPRITE_NAMES = ["idle", "hop", "scared", "cheer", "climb", "run"];
const SPRITES = { boy: {}, girl: {} };
const RUN_SEC_PER_CELL = 0.17;

const board = document.getElementById("board");
const dieCanvas = document.getElementById("die");
let artLoaded = false;
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
  const margin = Math.min(w, h) * 0.045;
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
      y: s1.y + L.cell * 0.55,
    };
  }
  const r = cellRect(square, L);
  const group = G.players.filter((p) => p.pos === square || (pretend && p === player));
  group.sort((a, b) => a.id - b.id);
  const idx = Math.max(0, group.findIndex((p) => p === player));
  const spread = L.cell * 0.3;
  return { x: r.x + r.w * 0.5 + (idx - (group.length - 1) / 2) * spread, y: r.y + r.h * 0.96 };
}

function buildRunPath(step, L) {
  const pts = [foot(step.player, step.from, L, false)];
  for (let s = step.from + 1; s <= step.to; s++) pts.push(foot(step.player, s, L, true));
  return pts;
}

function pathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

function pointAtDist(pts, dist) {
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, dirX: 1, dirY: 0 };
  let left = dist;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const seg = Math.hypot(dx, dy) || 0.0001;
    if (left <= seg) {
      const t = left / seg;
      return { x: lerp(pts[i - 1].x, pts[i].x, t), y: lerp(pts[i - 1].y, pts[i].y, t), dirX: dx / seg, dirY: dy / seg };
    }
    left -= seg;
  }
  const last = pts.length - 1;
  const dx = pts[last].x - pts[last - 1].x;
  const dy = pts[last].y - pts[last - 1].y;
  const seg = Math.hypot(dx, dy) || 1;
  return { x: pts[last].x, y: pts[last].y, dirX: dx / seg, dirY: dy / seg };
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
  if (!artLoaded) return;
  if (!G || G.phase !== "roll") return;
  const value = G.rolls.length ? G.rolls.shift() : 1 + Math.floor(Math.random() * 6);
  G.lastRoll = value;
  G.phase = "play";
  G.step = { kind: "dice", value, t: 0, dur: 0.68 };
  G.msg = current().name + " is rolling…";
  audio.rattle();
}

function moveDur(base, cpu) {
  const k = reduceMotion ? 0.35 : 1;
  const cpuK = cpu ? 0.62 : 1;
  return base * k * cpuK;
}

function planMove(roll) {
  const p = current();
  const dest = p.pos + roll;
  G.msg = p.name + " rolled " + roll;
  if (dest > 100) {
    G.queue.push({ kind: "overshoot", player: p, dur: moveDur(0.62, p.cpu) });
    G.queue.push({ kind: "end", bonus: roll === 6 });
  } else {
    const from = p.pos;
    const steps = dest - from;
    if (steps > 1) {
      const cells = steps - 1;
      G.queue.push({
        kind: "run",
        player: p,
        from,
        to: dest - 1,
        dur: moveDur(cells * RUN_SEC_PER_CELL + 0.08, p.cpu),
      });
    }
    G.queue.push({
      kind: "hop",
      player: p,
      from: dest - 1,
      to: dest,
      landing: true,
      dur: moveDur(0.34, p.cpu),
    });
    const lad = LADDERS.find((l) => l.from === dest);
    const sn = SNAKES.find((s) => s.head === dest);
    if (lad) {
      G.queue.push({
        kind: "ladder",
        player: p,
        from: dest,
        to: lad.to,
        dur: moveDur(1.75, p.cpu),
      });
      G.queue.push({
        kind: "hop",
        player: p,
        from: lad.to,
        to: lad.to,
        dismount: true,
        dur: moveDur(0.36, p.cpu),
      });
    } else if (sn) {
      G.queue.push({
        kind: "snake",
        player: p,
        from: dest,
        to: sn.tail,
        dur: moveDur(2.2, p.cpu),
      });
      G.queue.push({
        kind: "hop",
        player: p,
        from: sn.tail,
        to: sn.tail,
        dismount: true,
        dur: moveDur(0.36, p.cpu),
      });
    }
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
  if (next.kind === "hop" && next.landing) G.glow[next.to] = 1;
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
  if (step.kind === "run" || step.kind === "hop") step.player.pos = step.to;
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
      spawnDust(step.to || step.player.pos);
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

function clothSpeck(n, i) {
  const x = Math.imul(n * 17 + i * 131, 0x9e3779b1) >>> 0;
  return x / 4294967296;
}

function drawBoard(ctx, L) {
  const frame = Math.max(4, L.cell * 0.07);
  ctx.fillStyle = "#5a3e2b";
  ctx.fillRect(L.ox - frame, L.oy - frame, L.size + frame * 2, L.size + frame * 2);
  ctx.fillStyle = "#3e2b1e";
  ctx.fillRect(L.ox - frame, L.oy - frame, L.size + frame * 2, frame * 0.4);
  ctx.fillStyle = "#6b4e38";
  ctx.fillRect(L.ox - frame, L.oy + L.size + frame * 0.6, L.size + frame * 2, frame * 0.4);
  for (let n = 1; n <= 100; n++) {
    const r = cellRect(n, L);
    const g = gridOf(n);
    ctx.fillStyle = WASH[(g.row % 2) * 2 + (g.col % 2)];
    ctx.fillRect(r.x, r.y, r.w + 0.5, r.h + 0.5);
    ctx.fillStyle = "rgba(90, 62, 40, 0.045)";
    ctx.fillRect(r.x, r.y, r.w, r.h * 0.12);
    for (let i = 0; i < 5; i++) {
      const px = r.x + clothSpeck(n, i) * r.w;
      const py = r.y + clothSpeck(n, i + 5) * r.h;
      ctx.fillStyle = i % 2 ? "rgba(255,250,240,0.16)" : "rgba(80, 52, 32, 0.07)";
      ctx.fillRect(px, py, 1.4, 1.4);
    }
    const glow = G && G.glow[n];
    if (glow > 0.02) {
      ctx.fillStyle = "rgba(120, 86, 48, " + (0.16 * glow) + ")";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  }
}

function drawNumbers(ctx, L) {
  ctx.fillStyle = "#2a2118";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (let n = 1; n <= 100; n++) {
    const r = cellRect(n, L);
    ctx.font = "600 " + Math.floor(L.cell * (n === 100 ? 0.2 : 0.23)) + "px Georgia, 'Iowan Old Style', Palatino, serif";
    ctx.fillText(String(n), r.x + L.cell * 0.07, r.y + L.cell * 0.05);
  }
}

function drawLadder(ctx, lad, L) {
  const line = ladderLine(lad, L);
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const rail = L.cell * 0.2;
  const thick = Math.max(4, L.cell * 0.13);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const rails = (ox, oy, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(line.a.x + px * rail * s + ox, line.a.y + py * rail * s + oy);
      ctx.lineTo(line.b.x + px * rail * s + ox, line.b.y + py * rail * s + oy);
      ctx.stroke();
    }
  };
  rails(L.cell * 0.045, L.cell * 0.055, "rgba(60, 40, 20, 0.22)", thick);
  rails(0, 0, "#d4a24a", thick);
  rails(-px * L.cell * 0.03, -py * L.cell * 0.03, "#f0d7a0", thick * 0.34);
  const nodes = Math.max(4, Math.round(len / (L.cell * 0.42)));
  ctx.strokeStyle = "#7a5424";
  ctx.lineWidth = Math.max(2, L.cell * 0.05);
  for (let i = 0; i <= nodes; i++) {
    const t = i / nodes;
    const x = lerp(line.a.x, line.b.x, t);
    const y = lerp(line.a.y, line.b.y, t);
    for (const s of [-1, 1]) {
      const cx = x + px * rail * s;
      const cy = y + py * rail * s;
      ctx.beginPath();
      ctx.moveTo(cx - px * L.cell * 0.09, cy - py * L.cell * 0.09);
      ctx.lineTo(cx + px * L.cell * 0.09, cy + py * L.cell * 0.09);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "#a87838";
  ctx.lineWidth = Math.max(3, L.cell * 0.07);
  const steps = Math.max(3, Math.round(len / (L.cell * 0.5)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = lerp(line.a.x, line.b.x, t);
    const y = lerp(line.a.y, line.b.y, t);
    ctx.beginPath();
    ctx.moveTo(x + px * rail * 0.92, y + py * rail * 0.92);
    ctx.lineTo(x - px * rail * 0.92, y - py * rail * 0.92);
    ctx.stroke();
    ctx.strokeStyle = "#f3e2b4";
    ctx.lineWidth = Math.max(1.5, L.cell * 0.028);
    ctx.beginPath();
    ctx.moveTo(x + px * rail * 0.7, y + py * rail * 0.7);
    ctx.lineTo(x - px * rail * 0.7, y - py * rail * 0.7);
    ctx.stroke();
    ctx.strokeStyle = "#a87838";
    ctx.lineWidth = Math.max(3, L.cell * 0.07);
  }
  ctx.fillStyle = "#e2b15c";
  for (const p of [line.a, line.b]) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(p.x + px * rail * s, p.y + py * rail * s, L.cell * 0.05, L.cell * 0.04, Math.atan2(py, px), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function lickAmount(snake) {
  if (!G || !G.lick || G.lick.head !== snake.head) return 0;
  const dur = 1.15;
  const u = 1 - (G.lick.until - G.t) / dur;
  if (u <= 0 || u >= 1) return 0;
  return Math.sin(u * Math.PI);
}

function drawSnake(ctx, snake, L, which) {
  const pts = snakePoints(snake, L);
  const now = G ? G.t : performance.now() / 1000;
  let lunge = 0;
  let bulge = -1;
  if (G && G.step && G.step.kind === "snake" && G.step.from === snake.head) {
    const u = G.step.t / G.step.dur;
    if (u < 0.5) {
      if (u < 0.12) lunge = u / 0.12;
      else if (u < 0.42) lunge = 1;
      else lunge = 1 - (u - 0.42) / 0.08;
    }
    if (u > 0.4 && u < 0.82) bulge = (u - 0.4) / 0.42;
  }
  const flickWave = Math.sin(now * 3.4 + snake.head);
  const flick = flickWave > 0.72 ? (flickWave - 0.72) / 0.28 : 0;
  const tongue = Math.max(0.28 + flick * 0.72, lunge * 0.9, lickAmount(snake));
  const widthAt = (t) => {
    const base = L.cell * (0.23 - t * 0.12);
    const bump = bulge < 0 ? 0 : Math.exp(-((t - bulge) ** 2) / 0.012) * L.cell * 0.07;
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
  if (which !== "head") {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.translate(L.cell * 0.03, L.cell * 0.045);
    traceBody(1);
    ctx.fillStyle = "rgba(50, 36, 24, 0.16)";
    ctx.fill();
    ctx.restore();
    traceBody(1);
    ctx.fillStyle = snake.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(42, 32, 24, 0.28)";
    ctx.lineWidth = Math.max(1, L.cell * 0.012);
    ctx.stroke();
    ctx.save();
    traceBody(1);
    ctx.clip();
    for (let i = 2; i < pts.length - 2; i += 2) {
      const t = i / (pts.length - 1);
      const n = normalAt(pts, i);
      const tang = tangentAt(pts, i);
      const w = widthAt(t);
      const ang = Math.atan2(tang.y, tang.x);
      const side = i % 4 === 0 ? 0.42 : -0.42;
      ctx.save();
      ctx.translate(pts[i].x + n.x * w * side, pts[i].y + n.y * w * side);
      ctx.rotate(ang);
      ctx.fillStyle = snake.scale;
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.moveTo(w * 0.62, 0);
      ctx.lineTo(0, w * 0.34);
      ctx.lineTo(-w * 0.62, 0);
      ctx.lineTo(0, -w * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.save();
    traceBody(0.28);
    ctx.fillStyle = "rgba(255, 250, 240, 0.14)";
    ctx.fill();
    ctx.restore();
  }
  if (which === "body") return;
  const tang = tangentAt(pts, 2);
  const hx = pts[0].x - tang.x * L.cell * (0.02 + lunge * 0.08);
  const hy = pts[0].y - tang.y * L.cell * (0.02 + lunge * 0.08);
  const hr = L.cell * (0.19 + lunge * 0.03);
  const ang = Math.atan2(tang.y, tang.x);
  const side = { x: -tang.y, y: tang.x };
  ctx.fillStyle = "rgba(50, 36, 24, 0.16)";
  ctx.beginPath();
  ctx.ellipse(hx + L.cell * 0.03, hy + L.cell * 0.04, hr * 1.05, hr * 0.78, ang, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = snake.color;
  ctx.beginPath();
  ctx.ellipse(hx + tang.x * hr * 0.35, hy + tang.y * hr * 0.35, hr * 0.85, hr * 0.7, ang, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hx, hy, hr * 1.15, hr * 0.92, ang, 0, Math.PI * 2);
  ctx.fill();
  const blink = Math.sin(now * 2.1 + snake.head * 0.7) > 0.94;
  for (const s of [-1, 1]) {
    const ex = hx + side.x * hr * 0.4 * s - tang.x * hr * 0.28;
    const ey = hy + side.y * hr * 0.4 * s - tang.y * hr * 0.28;
    ctx.fillStyle = "#f7f3ea";
    ctx.beginPath();
    ctx.ellipse(ex, ey, hr * 0.46, hr * (blink ? 0.08 : 0.52), ang, 0, Math.PI * 2);
    ctx.fill();
    if (!blink) {
      ctx.fillStyle = "#2a241c";
      ctx.beginPath();
      ctx.arc(ex - tang.x * hr * 0.06, ey - tang.y * hr * 0.06, hr * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fffaf2";
      ctx.beginPath();
      ctx.arc(ex - tang.x * hr * 0.16 + side.x * hr * 0.08 * s, ey - tang.y * hr * 0.16 + side.y * hr * 0.08 * s, hr * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const mx = hx - tang.x * hr * 0.78;
  const my = hy - tang.y * hr * 0.78;
  if (lunge > 0.25) {
    ctx.fillStyle = "#6e3a3a";
    ctx.beginPath();
    ctx.ellipse(mx, my, hr * (0.16 + lunge * 0.28), hr * (0.1 + lunge * 0.16), ang, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = "#4a3a32";
    ctx.lineWidth = Math.max(1, hr * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(mx, my, hr * 0.16, ang + 0.35, ang + Math.PI - 0.35);
    ctx.stroke();
  }
  if (tongue > 0.05) {
    ctx.strokeStyle = "#b85a58";
    ctx.lineWidth = Math.max(1, hr * 0.09);
    ctx.lineCap = "round";
    const len = hr * (0.7 + tongue * 0.85);
    const tx = mx - tang.x * len;
    const ty = my - tang.y * len;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(tx, ty);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - tang.x * len * 0.28 + side.x * len * 0.24, ty - tang.y * len * 0.28 + side.y * len * 0.24);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - tang.x * len * 0.28 - side.x * len * 0.24, ty - tang.y * len * 0.28 - side.y * len * 0.24);
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

function loadSpriteSheet(gender, name) {
  return fetch(`sprites/${gender}/${name}.json`)
    .then((r) => r.json())
    .then((meta) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        SPRITES[gender][name] = { ...meta, img };
        resolve();
      };
      img.onerror = reject;
      img.src = `sprites/${gender}/${name}.png`;
    }));
}

const spritesReady = Promise.all(
  ["boy", "girl"].flatMap((g) => SPRITE_NAMES.map((n) => loadSpriteSheet(g, n))),
).then(() => {
  artLoaded = true;
  syncHud();
}).catch((err) => {
  console.error("sprite load failed", err);
});

function spriteAnimFor(player, pose) {
  const step = G && G.step;
  if (pose.gulp < 0.04) return null;
  if (step && step.kind === "snake" && step.player === player) {
    const u = step.t / step.dur;
    if (u >= 0.28 && u < 0.8) return null;
    if (u < 0.28) return { name: "scared", phase: step.t, loop: false };
    if (u >= 0.78 && pose.gulp < 0.92) return { name: "scared", phase: step.t - step.dur * 0.78, loop: false };
  }
  if (G && G.winner === player) return { name: "cheer", phase: G.t, loop: true };
  if (step && step.kind === "ladder" && step.player === player) {
    if (pose.arm === 2) return { name: "cheer", phase: G.t, loop: true };
    return { name: "climb", phase: G.t, loop: true };
  }
  if (step && step.kind === "run" && step.player === player) {
    return { name: "run", phase: G.t, loop: true };
  }
  if (step && step.kind === "hop" && step.player === player) {
    const u = Math.min(1, step.t / step.dur);
    const air = pose.airborne > 0.35;
    return { name: air && u < 0.72 ? "cheer" : "hop", phase: u, loop: false, hop: true };
  }
  return { name: "idle", phase: G.t + player.id * 0.37, loop: true };
}

function spriteBodyScale(sheet, gender, L, gulp) {
  const idle = SPRITES[gender].idle;
  const ref = idle.bodyHeightPx || idle.frameHeight;
  const bh = sheet.bodyHeightPx || sheet.frameHeight;
  const norm = ref / bh;
  return (L.cell * 1.1 * gulp) / ref * norm;
}

function spriteFrame(meta, anim) {
  if (anim.hop) {
    return Math.min(meta.frames - 1, Math.floor(anim.phase * meta.frames));
  }
  const f = anim.phase * meta.fps;
  if (anim.loop) return Math.floor(f) % meta.frames;
  return Math.min(meta.frames - 1, Math.floor(f));
}

function drawFeetShadow(ctx, player, pose, drawW, L) {
  const air = pose.airborne || 0;
  const alpha = 0.25 * (1 - air * 0.88);
  const sx = drawW * 0.24 * (1 - air * 0.42);
  const sy = L.cell * 0.06 * (1 - air * 0.42);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(sx, sy));
  g.addColorStop(0, `rgba(18, 10, 6, ${alpha})`);
  g.addColorStop(0.5, `rgba(18, 10, 6, ${alpha * 0.4})`);
  g.addColorStop(1, "rgba(18, 10, 6, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, L.cell * 0.012, sx, sy, 0, 0, Math.PI * 2);
  ctx.fill();
  const active = G && G.players[G.turn] === player && G.phase !== "win";
  if (active) {
    const warm = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(sx * 1.5, sy * 1.5));
    warm.addColorStop(0, `rgba(255, 196, 120, ${0.14 * (1 - air)})`);
    warm.addColorStop(0.55, `rgba(255, 170, 90, ${0.06 * (1 - air)})`);
    warm.addColorStop(1, "rgba(255, 160, 80, 0)");
    ctx.fillStyle = warm;
    ctx.beginPath();
    ctx.ellipse(0, L.cell * 0.01, sx * 1.35, sy * 1.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawKid(ctx, player, L) {
  const pose = poseFor(player, L);
  if (!pose) return;
  const anim = spriteAnimFor(player, pose);
  if (!anim) return;
  const gender = LOOK[player.kurta].kind;
  const sheet = SPRITES[gender][anim.name];
  if (!sheet || !sheet.img) return;
  const fi = spriteFrame(sheet, anim);
  const fw = sheet.frameWidth;
  const fh = sheet.frameHeight;
  const bodyScale = spriteBodyScale(sheet, gender, L, pose.gulp);
  let drawH = fh * bodyScale;
  let drawW = fw * bodyScale;
  if (pose.sx !== 1 || pose.sy !== 1) {
    drawW *= pose.sx;
    drawH *= pose.sy;
  }

  ctx.save();
  ctx.translate(pose.x, pose.y);
  if (pose.rot) ctx.rotate(pose.rot);
  if (pose.facingRight === false) ctx.scale(-1, 1);

  drawFeetShadow(ctx, player, pose, drawW, L);

  const drawX = -drawW / 2;
  const drawY = -drawH;
  ctx.drawImage(sheet.img, fi * fw, 0, fw, fh, drawX, drawY, drawW, drawH);
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
  let facingRight = true;
  let dirX = 0;
  let dirY = 0;
  let airborne = 0;
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
      y = f.y + Math.sin(G.t * 2.4 + player.id) * L.cell * 0.018;
    }
  }
  if (step && step.kind === "run" && step.player === player) {
    const pts = step._pts || (step._pts = buildRunPath(step, L));
    const total = step._totalLen || (step._totalLen = pathLength(pts));
    const dist = Math.min(total, (step.t / step.dur) * total);
    const pos = pointAtDist(pts, dist);
    x = pos.x;
    y = pos.y;
    dirX = pos.dirX;
    dirY = pos.dirY;
    facingRight = Math.abs(pos.dirX) > 0.08 ? pos.dirX >= 0 : center(step.to, L).x >= center(step.from, L).x;
    airborne = 0;
  } else if (step && step.kind === "hop" && step.player === player) {
    const u = step.t / step.dur;
    const arc = step.dismount ? 0.35 : 0.4;
    const a = foot(player, step.from, L, false);
    const b = foot(player, step.to, L, true);
    if (step.dismount) {
      x = b.x;
      y = b.y - Math.sin(Math.min(1, u) * Math.PI) * L.cell * arc;
      facingRight = center(step.to, L).x >= center(Math.max(1, step.to - 1), L).x;
    } else {
      const eu = ease(Math.min(1, u));
      x = lerp(a.x, b.x, eu);
      y = lerp(a.y, b.y, eu) - Math.sin(Math.min(1, u) * Math.PI) * L.cell * arc;
      facingRight = b.x >= a.x;
      dirX = b.x - a.x;
      dirY = b.y - a.y;
    }
    airborne = Math.sin(Math.min(1, u) * Math.PI);
    const stretch = Math.sin(Math.min(1, u) * Math.PI);
    if (u > 0.86) {
      sx = 1.08;
      sy = 0.9;
    } else {
      sx = 1 - stretch * 0.05;
      sy = 1 + stretch * 0.05;
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
    const pts = sn ? snakePoints(sn, L) : [head, tail];
    if (u < 0.28) {
      x = head.x + Math.sin(u * 70) * L.cell * 0.03;
      y = head.y;
      panic = 1;
      arm = 1;
    } else if (u < 0.42) {
      const k = (u - 0.28) / 0.14;
      x = head.x;
      y = head.y - L.cell * 0.38 * k;
      gulp = 1 - k * 0.55;
      panic = 1;
    } else if (u < 0.8) {
      const k = (u - 0.42) / 0.38;
      const f = k * (pts.length - 1);
      const i = Math.min(pts.length - 2, Math.floor(f));
      const p = {
        x: lerp(pts[i].x, pts[i + 1].x, f - i),
        y: lerp(pts[i].y, pts[i + 1].y, f - i),
      };
      x = p.x;
      y = p.y + L.cell * 0.12;
      gulp = 0.5;
      panic = 1;
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
    arm = 2;
    y -= Math.abs(Math.sin(G.t * 6)) * L.cell * 0.04;
  }
  return {
    x,
    y,
    sx,
    sy,
    rot,
    gulp,
    arm,
    panic,
    dizzy,
    sweat,
    climb,
    climbSide,
    spin: G.t * 7,
    facingRight,
    dirX,
    dirY,
    airborne,
  };
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
  ctx.clearRect(0, 0, L.w, L.h);
  ctx.fillStyle = "#3c342e";
  ctx.fillRect(0, 0, L.w, L.h);
  drawBoard(ctx, L);
  for (const lad of LADDERS) drawLadder(ctx, lad, L);
  for (const sn of SNAKES) drawSnake(ctx, sn, L, "body");
  for (const sn of SNAKES) drawSnake(ctx, sn, L, "head");
  drawNumbers(ctx, L);
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
  const s = Math.min(w, h) * 0.78;
  roundRect(ctx, -s / 2, -s / 2, s, s, s * 0.16);
  const wood = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
  wood.addColorStop(0, "#f0e2c4");
  wood.addColorStop(0.55, "#d7b07a");
  wood.addColorStop(1, "#b8894a");
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.strokeStyle = "#6b4a28";
  ctx.lineWidth = s * 0.045;
  ctx.stroke();
  ctx.fillStyle = "#3a2a1c";
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
  const ready = artLoaded && G.phase === "roll" && !current().cpu;
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
  artReady: spritesReady,
};
