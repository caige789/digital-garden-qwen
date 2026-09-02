/* 游戏实现 · 第三辑：消消乐 / 宝石迷阵 / 植物大战僵尸 / 保卫萝卜 / 中国象棋 */
import { GameCtx, GameHandle, rr } from "./engine";

const FONT = '"Noto Sans SC", sans-serif';
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center", bold = true) {
  ctx.fillStyle = color; ctx.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
}
const GOLD = "#efa32c", BERRY = "#d95d39", LEAF = "#3e8e52";

/* ============ 三消核心（消消乐 & 宝石迷阵，含死局洗牌） ============ */
function createMatch3(g: GameCtx, theme: "fruit" | "gem"): GameHandle {
  const N = 8, PAD = 14, TOP = 106;
  const CELL = (g.W - PAD * 2) / N;
  const TYPES = ["🍓", "🍋", "🍇", "🍉", "🫐", "🍑"];
  const GEMS = ["#d95d39", "#f0c060", "#8fc176", "#5cc4b4", "#6f9fd8", "#b78ed9"];
  let grid: number[][] = genBoard();
  let sel: [number, number] | null = null, lock = false;
  let score = 0, moves = theme === "fruit" ? 25 : 30, chain = 0, done = false, shuffleNote = 0;
  let downX = 0, downY = 0;
  const pops: { x: number; y: number; t: number }[] = [];
  function genBoard() {
    const b: number[][] = [];
    for (let y = 0; y < N; y++) {
      b.push([]);
      for (let x = 0; x < N; x++) {
        let v: number;
        do { v = g.rnd(6); } while ((x >= 2 && b[y][x - 1] === v && b[y][x - 2] === v) || (y >= 2 && b[y - 1][x] === v && b[y - 2][x] === v));
        b[y].push(v);
      }
    }
    return b;
  }
  function findMatches(): Set<string> {
    const m = new Set<string>();
    for (let y = 0; y < N; y++) for (let x = 0; x < N - 2; x++) { const v = grid[y][x]; if (v >= 0 && v === grid[y][x + 1] && v === grid[y][x + 2]) { m.add(`${x},${y}`); m.add(`${x + 1},${y}`); m.add(`${x + 2},${y}`); } }
    for (let x = 0; x < N; x++) for (let y = 0; y < N - 2; y++) { const v = grid[y][x]; if (v >= 0 && v === grid[y + 1][x] && v === grid[y + 2][x]) { m.add(`${x},${y}`); m.add(`${x},${y + 1}`); m.add(`${x},${y + 2}`); } }
    return m;
  }
  function hasValidMove(): boolean {
    const swap = (x1: number, y1: number, x2: number, y2: number) => { [grid[y1][x1], grid[y2][x2]] = [grid[y2][x2], grid[y1][x1]]; };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= N || ny >= N) continue;
        swap(x, y, nx, ny);
        const ok = findMatches().size > 0;
        swap(x, y, nx, ny);
        if (ok) return true;
      }
    }
    return false;
  }
  function collapse() {
    const m = findMatches();
    if (!m.size) {
      chain = 0; lock = false;
      if (moves <= 0 && !done) { done = true; g.sfx.over(); setTimeout(() => g.over(Math.floor(score)), 700); return; }
      if (!done && !hasValidMove()) {
        for (let i = 0; i < 60 && !hasValidMove(); i++) grid = genBoard();
        shuffleNote = 1800; g.sfx.tone(400, 0.2, "triangle", 0.1, 300);
      }
      return;
    }
    chain++;
    score += m.size * 30 * chain * (theme === "gem" ? 1.2 : 1);
    g.sfx.score(); g.juice.shake(Math.min(8, chain * 2));
    m.forEach((k) => { const [x, y] = k.split(",").map(Number); pops.push({ x, y, t: 300 }); grid[y][x] = -1; });
    setTimeout(() => {
      for (let x = 0; x < N; x++) {
        const col = grid.map((r) => r[x]).filter((v) => v >= 0);
        while (col.length < N) col.unshift(g.rnd(6));
        col.forEach((v, y) => (grid[y][x] = v));
      }
      setTimeout(collapse, 160);
    }, 200);
  }
  function trySwap(a: [number, number], b: [number, number]) {
    if (lock || done) return;
    const [ax, ay] = a, [bx, by] = b;
    if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) return;
    lock = true;
    [grid[ay][ax], grid[by][bx]] = [grid[by][bx], grid[ay][ax]];
    if (findMatches().size) { moves--; collapse(); }
    else { [grid[ay][ax], grid[by][bx]] = [grid[by][bx], grid[ay][ax]]; lock = false; g.sfx.hit(); }
    sel = null;
  }
  const cellAt = (x: number, y: number): [number, number] | null => {
    const cx = Math.floor((x - PAD) / CELL), cy = Math.floor((y - TOP) / CELL);
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) return null;
    return [cx, cy];
  };
  function drawGem(ctx: CanvasRenderingContext2D, v: number, cx: number, cy: number, s: number) {
    ctx.fillStyle = GEMS[v];
    ctx.save(); ctx.translate(cx, cy);
    if (v === 0) { ctx.beginPath(); ctx.arc(0, 0, s, 0, 7); ctx.fill(); }
    else if (v === 1) { rr(ctx, -s * 0.85, -s * 0.85, s * 1.7, s * 1.7, 5); ctx.fill(); }
    else if (v === 2) { ctx.rotate(Math.PI / 4); rr(ctx, -s * 0.8, -s * 0.8, s * 1.6, s * 1.6, 6); ctx.fill(); }
    else if (v === 3) { ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, s * 0.75); ctx.lineTo(-s, s * 0.75); ctx.closePath(); ctx.fill(); }
    else if (v === 4) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 6; ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * s, Math.sin(a) * s); } ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = (Math.PI / 5) * i - Math.PI / 2, r = i % 2 ? s * 0.5 : s; ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.beginPath(); ctx.arc(cx - s * 0.3, cy - s * 0.35, s * 0.22, 0, 7); ctx.fill();
  }
  return {
    currentScore() { return Math.floor(score); },
    tick(dt) { shuffleNote = Math.max(0, shuffleNote - dt); g.juice.update(dt); for (let i = pops.length - 1; i >= 0; i--) { pops[i].t -= dt; if (pops[i].t <= 0) pops.splice(i, 1); } },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, theme === "fruit" ? "🍓 消消乐" : "💎 宝石迷阵", g.W / 2, 30, 21, "#cfe3c2");
      txt(ctx, `分数 ${Math.floor(score)}`, g.W / 2 - 90, 68, 16, GOLD);
      txt(ctx, `剩余 ${moves} 步`, g.W / 2 + 90, 68, 16, moves <= 5 ? BERRY : "#8fae93");
      if (chain > 1) txt(ctx, `连锁 ×${chain}!`, g.W / 2, 68, 16, BERRY);
      rr(ctx, PAD - 6, TOP - 6, N * CELL + 12, N * CELL + 12, 14); ctx.fillStyle = "#16301f"; ctx.fill();
      grid.forEach((row, y) => row.forEach((v, x) => {
        if (v < 0) return;
        const px = PAD + x * CELL, py = TOP + y * CELL;
        rr(ctx, px + 3, py + 3, CELL - 6, CELL - 6, 10);
        ctx.fillStyle = "rgba(233,242,228,.06)"; ctx.fill();
        if (theme === "gem") drawGem(ctx, v, px + CELL / 2, py + CELL / 2, CELL * 0.27);
        else txt(ctx, TYPES[v], px + CELL / 2, py + CELL / 2 + 2, CELL * 0.52, "#000");
        if (sel && sel[0] === x && sel[1] === y) { ctx.strokeStyle = GOLD; ctx.lineWidth = 3; rr(ctx, px + 3, py + 3, CELL - 6, CELL - 6, 10); ctx.stroke(); ctx.lineWidth = 1; }
      }));
      pops.forEach((p) => { ctx.globalAlpha = p.t / 300; txt(ctx, theme === "fruit" ? "💥" : "✨", PAD + p.x * CELL + CELL / 2, TOP + p.y * CELL + CELL / 2, CELL * 0.5, "#fff"); });
      ctx.globalAlpha = 1;
      if (shuffleNote > 0) { ctx.globalAlpha = Math.min(1, shuffleNote / 500); txt(ctx, "🔄 无可消除，已重新洗牌", g.W / 2, g.H - 20, 16, GOLD); ctx.globalAlpha = 1; }
      if (done) txt(ctx, "步数用完！", g.W / 2, g.H - 20, 22, "#f3f5ea");
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t === "down") { downX = x; downY = y; }
      if (t !== "up") return;
      const a = cellAt(downX, downY), b = cellAt(x, y);
      if (!a || !b) { sel = null; return; }
      if (a[0] === b[0] && a[1] === b[1]) { sel = sel && sel[0] === a[0] && sel[1] === a[1] ? null : a; return; }
      if (sel && Math.abs(sel[0] - b[0]) + Math.abs(sel[1] - b[1]) === 1) { trySwap(sel, b); return; }
      if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1) trySwap(a, b);
      else sel = b;
    },
  };
}
export const createFruitMatch = (g: GameCtx) => createMatch3(g, "fruit");
export const createGemMatch = (g: GameCtx) => createMatch3(g, "gem");

/* ============ 植物大战僵尸（矢量美术） ============ */
function pvzPlant(ctx: CanvasRenderingContext2D, pi: number, x: number, y: number, s: number, t: number, hpR: number) {
  const bob = Math.sin(t / 300) * 2;
  ctx.save(); ctx.translate(x, y + bob);
  const u = s / 30;
  // 茎
  ctx.strokeStyle = "#3e6b48"; ctx.lineWidth = 5 * u;
  ctx.beginPath(); ctx.moveTo(0, 26 * u); ctx.quadraticCurveTo(3 * u, 10 * u, 0, 0); ctx.stroke(); ctx.lineWidth = 1;
  if (pi === 0) { // 向日葵
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10 + Math.sin(t / 500) * 0.06;
      ctx.fillStyle = "#f0c060";
      ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, -17 * u, 6 * u, 11 * u, 0, 0, 7); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = "#7a5c3a"; ctx.beginPath(); ctx.arc(0, 0, 11 * u, 0, 7); ctx.fill();
    ctx.fillStyle = "#22262e";
    ctx.beginPath(); ctx.arc(-4 * u, -2 * u, 1.8 * u, 0, 7); ctx.arc(4 * u, -2 * u, 1.8 * u, 0, 7); ctx.fill();
    ctx.strokeStyle = "#22262e"; ctx.lineWidth = 1.6 * u;
    ctx.beginPath(); ctx.arc(0, 2 * u, 5 * u, 0.3, Math.PI - 0.3); ctx.stroke(); ctx.lineWidth = 1;
  } else if (pi === 1 || pi === 2 || pi === 3) { // 豌豆系
    ctx.fillStyle = pi === 2 ? "#6fb8c8" : "#5cb85c";
    ctx.beginPath(); ctx.arc(0, -6 * u, 14 * u, 0, 7); ctx.fill();
    ctx.fillStyle = pi === 2 ? "#8fd8e8" : "#8fc176";
    ctx.beginPath(); ctx.arc(10 * u, -8 * u, 8 * u, 0, 7); ctx.fill(); // 炮口
    ctx.fillStyle = "#22301f";
    ctx.beginPath(); ctx.arc(-4 * u, -10 * u, 2.4 * u, 0, 7); ctx.fill();
    if (pi === 3) { ctx.fillStyle = "#3e8e52"; ctx.beginPath(); ctx.arc(0, -22 * u, 7 * u, 0, 7); ctx.fill(); }
    if (pi === 2) { ctx.fillStyle = "#cfeef8"; ctx.fillRect(-2 * u, -24 * u, 3 * u, 6 * u); ctx.fillRect(3 * u, -26 * u, 3 * u, 8 * u); }
  } else if (pi === 4) { // 坚果
    ctx.fillStyle = "#b08850";
    ctx.beginPath(); ctx.ellipse(0, 2 * u, 14 * u, 18 * u, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#8a6a3c";
    ctx.beginPath(); ctx.ellipse(0, 8 * u, 12 * u, 10 * u, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#22262e";
    ctx.beginPath(); ctx.arc(-5 * u, -4 * u, 2.2 * u, 0, 7); ctx.arc(5 * u, -4 * u, 2.2 * u, 0, 7); ctx.fill();
    if (hpR < 0.5) { ctx.strokeStyle = "#5a4020"; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(-6 * u, 4 * u); ctx.lineTo(0, 10 * u); ctx.lineTo(6 * u, 6 * u); ctx.stroke(); ctx.lineWidth = 1; }
  } else if (pi === 5) { // 樱桃
    ctx.fillStyle = "#c94f4f";
    ctx.beginPath(); ctx.arc(-8 * u, 0, 11 * u, 0, 7); ctx.arc(8 * u, -2 * u, 10 * u, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.4)";
    ctx.beginPath(); ctx.arc(-11 * u, -4 * u, 3 * u, 0, 7); ctx.fill();
    ctx.strokeStyle = "#3e6b48"; ctx.lineWidth = 2.5 * u;
    ctx.beginPath(); ctx.moveTo(-8 * u, -10 * u); ctx.quadraticCurveTo(0, -22 * u, 8 * u, -12 * u); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = "#22262e";
    ctx.beginPath(); ctx.arc(-10 * u, -2 * u, 1.6 * u, 0, 7); ctx.arc(-5 * u, -2 * u, 1.6 * u, 0, 7); ctx.fill();
  } else { // 土豆雷
    ctx.fillStyle = "#9a7a4a";
    ctx.beginPath(); ctx.ellipse(0, 6 * u, 15 * u, 12 * u, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#7a5c3a";
    ctx.beginPath(); ctx.arc(-6 * u, 2 * u, 2.5 * u, 0, 7); ctx.arc(7 * u, 6 * u, 2 * u, 0, 7); ctx.fill();
    ctx.fillStyle = "#22262e";
    ctx.beginPath(); ctx.arc(-4 * u, 0, 1.8 * u, 0, 7); ctx.arc(4 * u, 0, 1.8 * u, 0, 7); ctx.fill();
  }
  ctx.restore();
  if (hpR < 1 && pi !== 5) {
    ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(x - 20, y + 30, 40, 5);
    ctx.fillStyle = LEAF; ctx.fillRect(x - 20, y + 30, 40 * Math.max(0, hpR), 5);
  }
}
function pvzZombie(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, s: number, t: number, slow: boolean) {
  const u = s / 30;
  const wob = Math.sin(t / 180) * 2.5 * u;
  const stepA = Math.sin(t / 180) * 0.12;
  ctx.save(); ctx.translate(x, y);
  // 腿
  ctx.strokeStyle = "#4a5a4a"; ctx.lineWidth = 6 * u;
  ctx.save(); ctx.rotate(stepA); ctx.beginPath(); ctx.moveTo(-5 * u, 14 * u); ctx.lineTo(-6 * u, 30 * u); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.rotate(-stepA); ctx.beginPath(); ctx.moveTo(5 * u, 14 * u); ctx.lineTo(6 * u, 30 * u); ctx.stroke(); ctx.restore();
  ctx.lineWidth = 1;
  // 身体
  ctx.fillStyle = slow ? "#5f8fae" : "#6a7a5f";
  rr(ctx, -11 * u, -8 * u + wob, 22 * u, 26 * u, 6 * u); ctx.fill();
  // 手臂前伸
  ctx.strokeStyle = slow ? "#7fa8c0" : "#8a9a7f"; ctx.lineWidth = 5 * u;
  ctx.beginPath(); ctx.moveTo(-8 * u, -2 * u + wob); ctx.lineTo(-20 * u, 2 * u + wob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8 * u, -2 * u + wob); ctx.lineTo(20 * u, 0 + wob); ctx.stroke(); ctx.lineWidth = 1;
  // 头
  const hy = -20 * u + wob;
  ctx.fillStyle = slow ? "#8fb8c8" : "#9aa88a";
  ctx.beginPath(); ctx.arc(0, hy, 12 * u, 0, 7); ctx.fill();
  ctx.fillStyle = "#22301f";
  ctx.beginPath(); ctx.arc(-4 * u, hy - 2 * u, 2.2 * u, 0, 7); ctx.arc(4 * u, hy - 2 * u, 2.2 * u, 0, 7); ctx.fill();
  ctx.strokeStyle = "#22301f"; ctx.lineWidth = 1.6 * u;
  ctx.beginPath(); ctx.moveTo(-4 * u, hy + 5 * u); ctx.lineTo(4 * u, hy + 5 * u); ctx.stroke(); ctx.lineWidth = 1;
  // 头饰
  if (kind === 1) { ctx.fillStyle = "#e07a3f"; ctx.beginPath(); ctx.moveTo(-9 * u, hy - 8 * u); ctx.lineTo(0, hy - 22 * u); ctx.lineTo(9 * u, hy - 8 * u); ctx.closePath(); ctx.fill(); }
  if (kind === 2) { ctx.fillStyle = "#8a8f98"; rr(ctx, -11 * u, hy - 16 * u, 22 * u, 12 * u, 4 * u); ctx.fill(); ctx.fillStyle = "#6a6f78"; ctx.fillRect(-11 * u, hy - 8 * u, 22 * u, 3 * u); }
  if (kind === 3) { ctx.fillStyle = "#c94f4f"; ctx.fillRect(-10 * u, hy - 12 * u, 20 * u, 4 * u); }
  if (kind === 4) { // 巨人放大
    ctx.fillStyle = "#c94f4f";
    ctx.beginPath(); ctx.arc(-4 * u, hy - 2 * u, 3 * u, 0, 7); ctx.arc(4 * u, hy - 2 * u, 3 * u, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function pvzSun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t / 1400);
  ctx.fillStyle = "rgba(240,192,96,.3)";
  ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, 7); ctx.fill();
  ctx.fillStyle = "#f0c060";
  for (let i = 0; i < 8; i++) { ctx.save(); ctx.rotate((Math.PI / 4) * i); ctx.beginPath(); ctx.moveTo(-4, -r * 0.7); ctx.lineTo(0, -r * 1.25); ctx.lineTo(4, -r * 0.7); ctx.fill(); ctx.restore(); }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, 7); ctx.fill();
  ctx.fillStyle = "#ffd76f"; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, 7); ctx.fill();
  ctx.restore();
}
function pvzMower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const u = s / 15;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "#c94f4f"; rr(ctx, -14 * u, -10 * u, 28 * u, 16 * u, 4 * u); ctx.fill();
  ctx.fillStyle = "#8a8f98"; ctx.beginPath(); ctx.arc(-8 * u, 8 * u, 6 * u, 0, 7); ctx.arc(8 * u, 8 * u, 6 * u, 0, 7); ctx.fill();
  ctx.fillStyle = "#f0c060"; ctx.fillRect(-4 * u, -14 * u, 8 * u, 5 * u);
  ctx.restore();
}
export function createPvZ(g: GameCtx): GameHandle {
  const COLS = 9, ROWS = 5, TOP = 96, OX = 10, OY = TOP;
  const CW = (g.W - OX * 2) / COLS, CH = (g.H - OY - 8) / ROWS;
  const PLANTS = [
    { name: "向日葵", cost: 50, hp: 100, cd: 5000 },
    { name: "豌豆", cost: 100, hp: 100, cd: 5000 },
    { name: "冰豌豆", cost: 150, hp: 100, cd: 8000 },
    { name: "双发", cost: 200, hp: 100, cd: 8000 },
    { name: "坚果", cost: 50, hp: 800, cd: 18000 },
    { name: "樱桃", cost: 150, hp: 100, cd: 24000 },
    { name: "土豆雷", cost: 25, hp: 100, cd: 20000 },
  ];
  let sun = g.difficulty === "easy" ? 250 : g.difficulty === "hard" ? 100 : 150;
  let sunTotal = 0;
  type Plant = { pi: number; c: number; r: number; hp: number; maxHp: number; t: number; armed?: boolean };
  type Zom = { kind: number; x: number; r: number; hp: number; maxHp: number; slow: number; eatT: number };
  type Pea = { x: number; r: number; ice: boolean; dmg: number };
  type SunDrop = { x: number; y: number; ty: number; t: number };
  let plants: Plant[] = [], zoms: Zom[] = [], peas: Pea[] = [], suns: SunDrop[] = [];
  let mowers = Array.from({ length: ROWS }, (_, r) => ({ r, used: false }));
  let cds = PLANTS.map(() => 0);
  let selCard = -1, t = 0, dead = false, won = false, overSent = false;
  let wave = 0, spawnQueue: { kind: number; at: number }[] = [];
  const WAVES = 5;
  const ZDEF = [
    { hp: 110, spd: 0.0115 }, { hp: 230, spd: 0.0115 }, { hp: 380, spd: 0.01 }, { hp: 90, spd: 0.021 }, { hp: 900, spd: 0.006 },
  ];
  (function schedule() {
    for (let w = 1; w <= WAVES; w++) {
      const base = (w - 1) * 26000 + 12000;
      const n = 3 + w * 2;
      for (let i = 0; i < n; i++) {
        let kind = 0;
        const r = Math.random();
        if (w >= 2 && r < 0.3) kind = 1;
        if (w >= 3 && r < 0.2) kind = 2;
        if (w >= 3 && r > 0.8) kind = 3;
        spawnQueue.push({ kind, at: (base + i * (1400 / g.mult)) / g.mult });
      }
      if (w === WAVES) for (let i = 0; i < 2; i++) spawnQueue.push({ kind: 4, at: (base + 4000 + i * 5000) / g.mult });
    }
    spawnQueue.sort((a, b) => a.at - b.at);
  })();
  const cardRect = (i: number) => ({ x: 118 + i * 96, y: 8, w: 88, h: 80 });
  function finish() {
    if (overSent) return; overSent = true;
    const score = Math.round((sunTotal + plants.length * 40 + wave * 600 + (won ? 3000 : 0)) * (g.difficulty === "hard" ? 1.4 : g.difficulty === "easy" ? 0.7 : 1));
    setTimeout(() => g.over(score), 900);
  }
  return {
    tick(dt) {
      g.juice.update(dt);
      if (dead || won) return;
      t += dt;
      cds = cds.map((c) => Math.max(0, c - dt));
      while (spawnQueue.length && spawnQueue[0].at <= t) {
        const s = spawnQueue.shift()!;
        const z = ZDEF[s.kind];
        zoms.push({ kind: s.kind, x: g.W - OX + 20 + Math.random() * 40, r: g.rnd(ROWS), hp: z.hp * (0.85 + 0.3 * g.mult), maxHp: z.hp, slow: 0, eatT: 0 });
        const newWave = Math.min(WAVES, Math.floor(t / (26000 / g.mult)) + 1);
        if (newWave > wave) { wave = newWave; g.sfx.tone(220, 0.3, "sawtooth", 0.12, -60); g.juice.shake(5); }
      }
      if (Math.random() < dt / 8000) suns.push({ x: OX + 40 + Math.random() * (g.W - 120), y: OY, ty: OY + 40 + Math.random() * (g.H - OY - 120), t: 12000 });
      suns.forEach((s) => { s.y = Math.min(s.ty, s.y + 0.03 * dt); s.t -= dt; });
      suns = suns.filter((s) => s.t > 0);
      plants.forEach((p) => {
        p.t += dt;
        if (p.pi === 0 && p.t > 11000) { p.t = 0; suns.push({ x: OX + p.c * CW + CW / 2 + (Math.random() - 0.5) * 40, y: OY + p.r * CH + 10, ty: OY + p.r * CH + CH - 14, t: 10000 }); g.sfx.tone(1200, 0.08, "triangle", 0.06); }
        if (p.pi === 6 && !p.armed && p.t > 14000) p.armed = true;
        const shoot = p.pi === 1 || p.pi === 2 || p.pi === 3;
        if (shoot && p.t > (p.pi === 3 ? 700 : 1100)) {
          const hasTarget = zoms.some((z) => z.r === p.r && z.x > OX + p.c * CW && z.x < g.W + 30);
          if (hasTarget) {
            p.t = 0;
            peas.push({ x: OX + p.c * CW + CW - 16, r: p.r, ice: p.pi === 2, dmg: 22 });
            if (p.pi === 3) setTimeout(() => { if (!dead && !won) peas.push({ x: OX + p.c * CW + CW - 16, r: p.r, ice: false, dmg: 22 }); }, 180);
            g.sfx.tone(600, 0.05, "square", 0.05, 200);
          }
        }
      });
      peas.forEach((pe) => {
        pe.x += 0.34 * dt;
        for (const z of zoms) {
          if (z.r === pe.r && z.hp > 0 && Math.abs(z.x - pe.x) < 24) {
            z.hp -= pe.dmg; if (pe.ice) z.slow = 3000;
            pe.x = 99999; g.sfx.tone(300, 0.04, "square", 0.05);
            break;
          }
        }
      });
      peas = peas.filter((p) => p.x < g.W + 40);
      zoms.forEach((z) => {
        z.slow = Math.max(0, z.slow - dt);
        const spd = ZDEF[z.kind].spd * (z.slow > 0 ? 0.45 : 1) * g.mult;
        const col = Math.floor((z.x - 20 - OX) / CW);
        const target = plants.find((p) => p.r === z.r && p.c === col && Math.abs(OX + p.c * CW + CW / 2 - z.x) < CW * 0.55);
        if (target) {
          z.eatT += dt;
          if (z.eatT > 400) { z.eatT = 0; target.hp -= 12 * g.mult; g.sfx.tone(150, 0.06, "sawtooth", 0.05); }
        } else z.x -= spd * dt;
        const mine = plants.find((p) => p.pi === 6 && p.armed && p.r === z.r && Math.abs(OX + p.c * CW + CW / 2 - z.x) < CW * 0.5);
        if (mine) { mine.hp = 0; zoms.forEach((zz) => { if (zz.r === z.r && Math.abs(zz.x - z.x) < CW) zz.hp -= 900; }); g.sfx.boom(); g.juice.shake(10); g.juice.burst(mine.hp >= 0 ? OX + mine.c * CW + CW / 2 : z.x, OY + z.r * CH + CH / 2, "#e07a3f", 20); }
        if (z.x < OX + 12 && z.hp > 0) {
          const mower = mowers.find((m) => m.r === z.r && !m.used);
          if (mower) { mower.used = true; zoms.forEach((zz) => { if (zz.r === z.r) zz.hp = 0; }); g.sfx.boom(); g.juice.shake(8); }
          else { dead = true; g.sfx.over(); finish(); }
        }
      });
      plants.forEach((p) => {
        if (p.pi === 5 && p.t > 900) {
          p.hp = 0; g.sfx.boom(); g.juice.shake(12);
          g.juice.burst(OX + p.c * CW + CW / 2, OY + p.r * CH + CH / 2, "#c94f4f", 26);
          zoms.forEach((z) => { if (Math.abs(z.r - p.r) <= 1 && Math.abs(z.x - (OX + p.c * CW + CW / 2)) < CW * 1.7) z.hp -= 900; });
        }
      });
      plants = plants.filter((p) => p.hp > 0);
      zoms = zoms.filter((z) => {
        if (z.hp <= 0) { sunTotal += 5; g.sfx.tone(500, 0.06, "triangle", 0.06); g.juice.burst(z.x, OY + z.r * CH + CH / 2, "#8a9a7f", 8); return false; }
        return true;
      });
      if (!spawnQueue.length && !zoms.length && t > 20000 && !won && !dead) { won = true; g.sfx.win(); finish(); }
    },
    draw(ctx) {
      ctx.fillStyle = "#102416"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = (r + c) % 2 ? "#1d4a2a" : "#1a4125";
        ctx.fillRect(OX + c * CW, OY + r * CH, CW, CH);
      }
      // 顶栏
      ctx.fillStyle = "#0e1f13"; ctx.fillRect(0, 0, g.W, TOP - 6);
      ctx.fillStyle = "#f0c060"; rr(ctx, 10, 10, 96, 72, 10); ctx.fill();
      pvzSun(ctx, 58, 40, 17, t);
      txt(ctx, String(Math.floor(sun)), 58, 68, 16, "#4a3208");
      PLANTS.forEach((p, i) => {
        const rc = cardRect(i), ready = cds[i] <= 0 && sun >= p.cost;
        rr(ctx, rc.x, rc.y, rc.w, rc.h, 9);
        ctx.fillStyle = selCard === i ? "#f0c060" : ready ? "#2a4634" : "#1a2f21";
        ctx.fill();
        if (selCard === i) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.stroke(); ctx.lineWidth = 1; }
        ctx.globalAlpha = ready ? 1 : 0.45;
        pvzPlant(ctx, i, rc.x + rc.w / 2, rc.y + 36, 13, t, 1);
        txt(ctx, String(p.cost), rc.x + rc.w / 2, rc.y + 68, 13, ready ? "#f0c060" : "#8fae93");
        ctx.globalAlpha = 1;
        if (cds[i] > 0) { ctx.fillStyle = "rgba(0,0,0,.55)"; const h = (cds[i] / p.cd) * rc.h; ctx.fillRect(rc.x, rc.y + rc.h - h, rc.w, h); }
      });
      txt(ctx, `第 ${wave}/${WAVES} 波`, g.W - 66, 30, 14, "#cfe3c2");
      txt(ctx, `余 ${spawnQueue.length + zoms.length}`, g.W - 66, 54, 12, "#8fae93");
      mowers.forEach((m) => { if (!m.used) pvzMower(ctx, OX + 16, OY + m.r * CH + CH / 2 + 6, 15); });
      plants.forEach((p) => pvzPlant(ctx, p.pi, OX + p.c * CW + CW / 2, OY + p.r * CH + CH / 2, Math.min(CW, CH) * 0.42, t + p.c * 300 + p.r * 170, p.hp / p.maxHp));
      peas.forEach((p) => { ctx.fillStyle = p.ice ? "#8fd8e8" : "#9fd878"; ctx.beginPath(); ctx.arc(p.x, OY + p.r * CH + CH * 0.42, 8, 0, 7); ctx.fill(); });
      zoms.forEach((z) => {
        const cy = OY + z.r * CH + CH / 2;
        const size = z.kind === 4 ? Math.min(CW, CH) * 0.6 : Math.min(CW, CH) * 0.42;
        pvzZombie(ctx, z.kind, z.x, cy, size, t + z.x, z.slow > 0);
        ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(z.x - 20, cy - size * 1.25, 40, 5);
        ctx.fillStyle = z.slow > 0 ? "#8fd8e8" : BERRY; ctx.fillRect(z.x - 20, cy - size * 1.25, 40 * Math.max(0, z.hp / z.maxHp), 5);
      });
      suns.forEach((s) => pvzSun(ctx, s.x, s.y, 20, t));
      if (dead) { ctx.fillStyle = "rgba(10,20,13,.8)"; ctx.fillRect(0, 0, g.W, g.H); txt(ctx, "🧟 僵尸吃掉了你的脑子！", g.W / 2, g.H / 2, 26, "#f3f5ea"); }
      if (won) { ctx.fillStyle = "rgba(10,20,13,.7)"; ctx.fillRect(0, 0, g.W, g.H); txt(ctx, "🌻 草坪守住了！", g.W / 2, g.H / 2, 28, GOLD); }
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(tp, x, y) {
      if (tp !== "down" || dead || won) return;
      for (let i = suns.length - 1; i >= 0; i--) {
        if (Math.hypot(suns[i].x - x, suns[i].y - y) < 58) { sun += 25; sunTotal += 25; suns.splice(i, 1); g.sfx.coin(); g.juice.float(x, y, "+25 ☀", GOLD, 16); return; }
      }
      for (let i = 0; i < PLANTS.length; i++) {
        const rc = cardRect(i);
        if (x >= rc.x && x <= rc.x + rc.w && y >= 0 && y <= TOP - 6) {
          selCard = selCard === i ? -1 : cds[i] <= 0 && sun >= PLANTS[i].cost ? i : selCard;
          g.sfx.click(); return;
        }
      }
      if (selCard >= 0) {
        const c = Math.floor((x - OX) / CW), r = Math.floor((y - OY) / CH);
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS && !plants.some((p) => p.c === c && p.r === r)) {
          const def = PLANTS[selCard];
          if (sun >= def.cost) {
            sun -= def.cost; cds[selCard] = def.cd;
            plants.push({ pi: selCard, c, r, hp: def.hp, maxHp: def.hp, t: 0 });
            g.sfx.place();
            g.juice.burst(OX + c * CW + CW / 2, OY + r * CH + CH / 2, "#8fc176", 8);
            selCard = -1;
          }
        }
      }
    },
  };
}

/* ============ 保卫萝卜（矢量美术，960×700） ============ */
function carrotTower(ctx: CanvasRenderingContext2D, ti: number, cx: number, cy: number, lv: number, t: number) {
  const u = 1 + lv * 0.12;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(u, u);
  ctx.fillStyle = "#274b31"; rr(ctx, -22, -22, 44, 44, 10); ctx.fill();
  ctx.strokeStyle = lv === 2 ? "#f0c060" : "rgba(240,192,96,.5)"; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
  if (ti === 0) { // 箭塔
    ctx.fillStyle = "#8a6a3c"; ctx.fillRect(-12, -6, 24, 22);
    ctx.fillStyle = "#c9d2dd";
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(8, -4); ctx.lineTo(-8, -4); ctx.closePath(); ctx.fill();
  } else if (ti === 1) { // 炮塔
    ctx.fillStyle = "#4a4f58"; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
    ctx.fillStyle = "#2f343c"; ctx.fillRect(-4, -22, 8, 18);
    ctx.fillStyle = BERRY; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
  } else if (ti === 2) { // 冰塔
    ctx.fillStyle = "#8fd8e8";
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i + t / 2000; ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * 15, Math.sin(a) * 15); } ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#cfeef8"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
  } else if (ti === 3) { // 星塔
    ctx.fillStyle = "#f0c060";
    ctx.save(); ctx.rotate(t / 900);
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = (Math.PI / 5) * i - Math.PI / 2, r = i % 2 ? 7 : 16; ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    ctx.restore();
  } else { // 月塔
    ctx.fillStyle = "#b78ed9"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill();
    ctx.fillStyle = "#274b31"; ctx.beginPath(); ctx.arc(7, -4, 12, 0, 7); ctx.fill();
  }
  ctx.restore();
  if (lv > 0) txt(ctx, "★".repeat(lv + 1), cx, cy + 27, 10, GOLD);
}
function carrotMob(ctx: CanvasRenderingContext2D, x: number, y: number, boss: boolean, slow: boolean, t: number, hpR: number) {
  const s = boss ? 26 : 15;
  const wob = Math.sin(t / 150) * 2;
  ctx.save(); ctx.translate(x, y + wob * 0.4);
  // 身体
  ctx.fillStyle = slow ? "#5f8fae" : boss ? "#7a3b5d" : "#c9885f";
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.85, 0, 0, 7); ctx.fill();
  // 耳朵
  ctx.beginPath(); ctx.ellipse(-s * 0.5, -s * 0.95, s * 0.28, s * 0.5, -0.25, 0, 7); ctx.ellipse(s * 0.5, -s * 0.95, s * 0.28, s * 0.5, 0.25, 0, 7); ctx.fill();
  ctx.fillStyle = "#e8b0a0";
  ctx.beginPath(); ctx.ellipse(-s * 0.5, -s * 0.9, s * 0.14, s * 0.3, -0.25, 0, 7); ctx.ellipse(s * 0.5, -s * 0.9, s * 0.14, s * 0.3, 0.25, 0, 7); ctx.fill();
  // 脸
  ctx.fillStyle = "#22262e";
  ctx.beginPath(); ctx.arc(-s * 0.32, -s * 0.1, s * 0.12, 0, 7); ctx.arc(s * 0.32, -s * 0.1, s * 0.12, 0, 7); ctx.fill();
  ctx.fillStyle = boss ? "#ffd27a" : "#e88fa0";
  ctx.beginPath(); ctx.arc(0, s * 0.22, s * 0.16, 0, 7); ctx.fill();
  if (boss) { ctx.fillStyle = "#f0c060"; ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 0.8); ctx.lineTo(-s * 0.35, -s * 1.5); ctx.lineTo(0, -s * 0.9); ctx.lineTo(s * 0.35, -s * 1.5); ctx.lineTo(s * 0.7, -s * 0.8); ctx.closePath(); ctx.fill(); }
  // 脚
  ctx.fillStyle = slow ? "#4a7088" : "#a06a45";
  const step = Math.sin(t / 120) * s * 0.2;
  ctx.beginPath(); ctx.ellipse(-s * 0.4, s * 0.75 + step * 0.3, s * 0.25, s * 0.15, 0, 0, 7); ctx.ellipse(s * 0.4, s * 0.75 - step * 0.3, s * 0.25, s * 0.15, 0, 0, 7); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(x - 16, y - s - 16, 32, 4);
  ctx.fillStyle = slow ? "#8fd8e8" : BERRY; ctx.fillRect(x - 16, y - s - 16, 32 * Math.max(0, hpR), 4);
}
function carrotEnd(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const pulse = 1 + Math.sin(t / 300) * 0.05;
  ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
  ctx.fillStyle = "#e8833a";
  ctx.beginPath(); ctx.moveTo(0, 26); ctx.quadraticCurveTo(-16, 6, -12, -10); ctx.quadraticCurveTo(0, -18, 12, -10); ctx.quadraticCurveTo(16, 6, 0, 26); ctx.fill();
  ctx.strokeStyle = "#c96a28"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(4, -2); ctx.moveTo(-4, 8); ctx.lineTo(5, 8); ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = "#5cb85c";
  for (const a of [-0.5, 0, 0.5]) { ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, -20, 4, 11, 0, 0, 7); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = "#22262e";
  ctx.beginPath(); ctx.arc(-5, -6, 1.8, 0, 7); ctx.arc(5, -6, 1.8, 0, 7); ctx.fill();
  ctx.strokeStyle = "#22262e"; ctx.beginPath(); ctx.arc(0, -1, 4, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.restore();
}
export function createCarrot(g: GameCtx): GameHandle {
  const CS = 60, COLS = 16, ROWS = 10;
  const PATH: [number, number][] = [[-1, 2], [3, 2], [3, 6], [8, 6], [8, 2], [12, 2], [12, 7], [15, 7]];
  const WAY = PATH.map(([c, r]) => ({ x: c * CS + CS / 2, y: r * CS + CS / 2 }));
  const pathSet = new Set<string>();
  (function mark() {
    for (let i = 0; i < PATH.length - 1; i++) {
      let [c, r] = PATH[i]; const [tc, tr] = PATH[i + 1];
      while (c !== tc || r !== tr) { if (c >= 0 && c < COLS) pathSet.add(`${c},${r}`); c += Math.sign(tc - c); r += Math.sign(tr - r); }
      if (tc >= 0 && tc < COLS) pathSet.add(`${tc},${tr}`);
    }
  })();
  const TOWERS = [
    { name: "箭塔", cost: 80, dmg: 14, rate: 500, range: 150 },
    { name: "炮塔", cost: 130, dmg: 34, rate: 1100, range: 140 },
    { name: "冰塔", cost: 110, dmg: 8, rate: 700, range: 130, slow: true },
    { name: "星塔", cost: 160, dmg: 12, rate: 600, range: 160, multi: 3 },
    { name: "月塔", cost: 220, dmg: 50, rate: 1400, range: 170 },
  ];
  let money = g.difficulty === "easy" ? 320 : g.difficulty === "hard" ? 180 : 240;
  let carrotHp = 10;
  type Tw = { ti: number; c: number; r: number; lv: number; cd: number };
  type Mob = { x: number; y: number; wi: number; hp: number; maxHp: number; spd: number; slow: number; boss: boolean; bounty: number };
  type Shot = { x: number; y: number; t: number; dmg: number; slow?: boolean; target: Mob };
  let towers: Tw[] = [], mobs: Mob[] = [], shots: Shot[] = [];
  let selTower = -1, sellMode = false, wave = 0, dead = false, won = false, overSent = false;
  let spawnLeft = 0, spawnT = 0, waveGap = 2500, t = 0, kills = 0;
  const WAVES = 15;
  const barY = g.H - 92;
  function startWave() {
    wave++;
    spawnLeft = wave % 5 === 0 ? 6 + wave : 6 + wave * 2;
    spawnT = 0;
    g.sfx.tone(330, 0.2, "triangle", 0.1);
    g.juice.float(g.W / 2, 160, `第 ${wave} 波来袭！`, GOLD, 20);
  }
  function spawnMob() {
    const boss = wave % 5 === 0 && spawnLeft <= 2;
    const hp = (26 + wave * 16) * (boss ? 9 : 1) * (0.8 + 0.4 * g.mult);
    mobs.push({ x: WAY[0].x, y: WAY[0].y, wi: 1, hp, maxHp: hp, spd: (boss ? 0.022 : 0.05 - Math.min(0.02, wave * 0.001)) * (0.85 + 0.3 * g.mult), slow: 0, boss, bounty: boss ? 120 : 12 + wave });
  }
  const upgradeCost = (tw: Tw) => Math.round(TOWERS[tw.ti].cost * 0.8 * (tw.lv + 1));
  function finish(win: boolean) {
    if (overSent) return; overSent = true;
    const score = Math.round((kills * 30 + wave * 150 + money * 0.5 + carrotHp * 100 + (win ? 4000 : 0)) * (g.difficulty === "hard" ? 1.4 : g.difficulty === "easy" ? 0.7 : 1));
    setTimeout(() => g.over(score), 900);
  }
  return {
    tick(dt) {
      g.juice.update(dt);
      if (dead || won) return;
      t += dt;
      if (wave === 0) startWave();
      else if (!spawnLeft && !mobs.length) {
        waveGap -= dt;
        if (waveGap <= 0) { waveGap = 2500; if (wave < WAVES) startWave(); else { won = true; g.sfx.win(); finish(true); } }
      }
      if (spawnLeft > 0) { spawnT -= dt; if (spawnT <= 0) { spawnT = Math.max(300, 850 - wave * 25); spawnMob(); spawnLeft--; } }
      mobs.forEach((m) => {
        m.slow = Math.max(0, m.slow - dt);
        const spd = m.spd * (m.slow > 0 ? 0.45 : 1) * dt;
        const target = WAY[m.wi];
        const d = Math.hypot(target.x - m.x, target.y - m.y);
        if (d < spd + 2) {
          m.wi++;
          if (m.wi >= WAY.length) { carrotHp -= m.boss ? 3 : 1; m.hp = 0; g.sfx.hit(); g.juice.shake(8); if (carrotHp <= 0) { dead = true; g.sfx.over(); finish(false); } }
        } else { m.x += ((target.x - m.x) / d) * spd; m.y += ((target.y - m.y) / d) * spd; }
      });
      towers.forEach((tw) => {
        tw.cd -= dt;
        if (tw.cd > 0) return;
        const def = TOWERS[tw.ti];
        const cx = tw.c * CS + CS / 2, cy = tw.r * CS + CS / 2;
        const range = def.range + tw.lv * 18;
        const inRange = mobs.filter((m) => m.hp > 0 && Math.hypot(m.x - cx, m.y - cy) < range);
        if (!inRange.length) return;
        tw.cd = def.rate / (1 + tw.lv * 0.25);
        const targets = inRange.slice(0, (def as any).multi ?? 1);
        const dmg = def.dmg * (1 + tw.lv * 0.6);
        targets.forEach((m) => { shots.push({ x: cx, y: cy, t: 140, dmg, slow: (def as any).slow, target: m }); });
        g.sfx.tone(tw.ti === 1 ? 180 : 800, 0.05, tw.ti === 1 ? "sawtooth" : "square", 0.04, -200);
      });
      shots.forEach((s) => {
        s.t -= dt;
        if (s.t <= 0 && s.target.hp > 0) {
          s.target.hp -= s.dmg;
          if (s.slow) s.target.slow = 1600;
          if (s.dmg >= 30) { mobs.forEach((m) => { if (m !== s.target && Math.hypot(m.x - s.target.x, m.y - s.target.y) < 55) m.hp -= s.dmg * 0.5; }); g.juice.burst(s.target.x, s.target.y, "#e07a3f", 10); g.juice.shake(2); }
        }
      });
      shots = shots.filter((s) => s.t > -1);
      mobs = mobs.filter((m) => {
        if (m.hp <= 0) { if (m.wi < WAY.length) { money += m.bounty; kills++; g.sfx.coin(); g.juice.burst(m.x, m.y, "#c9885f", 8); g.juice.float(m.x, m.y - 20, `+$${m.bounty}`, GOLD, 12); } return false; }
        return true;
      });
    },
    draw(ctx) {
      ctx.fillStyle = "#10241a"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = (r + c) % 2 ? "#173823" : "#15331f";
        if (pathSet.has(`${c},${r}`)) ctx.fillStyle = "#3d5a40";
        ctx.fillRect(c * CS, r * CS, CS, CS);
      }
      ctx.strokeStyle = "rgba(240,192,96,.5)"; ctx.lineWidth = 3; ctx.setLineDash([10, 10]); ctx.lineDashOffset = -t / 40;
      ctx.beginPath(); WAY.forEach((w, i) => (i ? ctx.lineTo(w.x, w.y) : ctx.moveTo(w.x, w.y))); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 1;
      const end = WAY[WAY.length - 1];
      carrotEnd(ctx, end.x, end.y, t);
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(end.x - 26, end.y + 30, 52, 6);
      ctx.fillStyle = LEAF; ctx.fillRect(end.x - 26, end.y + 30, 52 * (carrotHp / 10), 6);
      towers.forEach((tw) => carrotTower(ctx, tw.ti, tw.c * CS + CS / 2, tw.r * CS + CS / 2, tw.lv, t));
      if (sellMode) towers.forEach((tw) => { ctx.strokeStyle = BERRY; ctx.lineWidth = 2; rr(ctx, tw.c * CS + 4, tw.r * CS + 4, CS - 8, CS - 8, 10); ctx.stroke(); ctx.lineWidth = 1; });
      mobs.forEach((m) => carrotMob(ctx, m.x, m.y, m.boss, m.slow > 0, t + m.x, m.hp / m.maxHp));
      shots.forEach((s) => {
        const p = 1 - Math.max(0, s.t) / 140;
        const x = s.x + (s.target.x - s.x) * p, y = s.y + (s.target.y - s.y) * p;
        ctx.fillStyle = s.slow ? "#8fd8e8" : GOLD;
        ctx.beginPath(); ctx.arc(x, y, s.dmg >= 30 ? 6 : 4, 0, 7); ctx.fill();
      });
      // 底栏
      ctx.fillStyle = "#0e1f13"; ctx.fillRect(0, barY, g.W, 92);
      TOWERS.forEach((tw, i) => {
        const bx = 12 + i * 132, by = barY + 8;
        rr(ctx, bx, by, 122, 76, 10);
        ctx.fillStyle = selTower === i ? "#f0c060" : money >= tw.cost ? "#223c2a" : "#182b1e";
        ctx.fill();
        ctx.globalAlpha = money >= tw.cost ? 1 : 0.5;
        carrotTower(ctx, i, bx + 30, by + 38, 0, t);
        txt(ctx, tw.name, bx + 76, by + 26, 13, "#e9f2e4");
        txt(ctx, `$${tw.cost}`, bx + 76, by + 52, 12, money >= tw.cost ? "#f0c060" : "#8fae93");
        ctx.globalAlpha = 1;
      });
      const sx = 12 + 5 * 132;
      rr(ctx, sx, barY + 8, g.W - sx - 12, 76, 10);
      ctx.fillStyle = sellMode ? BERRY : "#223c2a"; ctx.fill();
      txt(ctx, sellMode ? "点击塔出售" : "出售模式", (sx + g.W - 12) / 2, barY + 46, 13, "#e9f2e4");
      // HUD
      ctx.fillStyle = "rgba(14,31,19,.85)"; rr(ctx, 10, 8, 320, 34, 17); ctx.fill();
      txt(ctx, `💰 ${money}`, 70, 25, 14, GOLD);
      txt(ctx, `波次 ${wave}/${WAVES}`, 170, 25, 13, "#cfe3c2");
      txt(ctx, `击杀 ${kills}`, 275, 25, 13, "#cfe3c2");
      if (!spawnLeft && !mobs.length && wave < WAVES && !won && !dead) txt(ctx, `下一波 ${Math.ceil(waveGap / 1000)}s`, g.W / 2, 70, 14, GOLD);
      if (dead) { ctx.fillStyle = "rgba(10,20,13,.8)"; ctx.fillRect(0, 0, g.W, g.H); txt(ctx, "🥕 萝卜被啃光了！", g.W / 2, g.H / 2, 28, "#f3f5ea"); }
      if (won) { ctx.fillStyle = "rgba(10,20,13,.75)"; ctx.fillRect(0, 0, g.W, g.H); txt(ctx, "🏆 15 波全部守住！", g.W / 2, g.H / 2, 28, GOLD); }
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(tp, x, y) {
      if (tp !== "down" || dead || won) return;
      if (y >= barY) {
        for (let i = 0; i < TOWERS.length; i++) {
          const bx = 12 + i * 132;
          if (x >= bx && x <= bx + 122) { selTower = selTower === i ? -1 : i; sellMode = false; g.sfx.click(); return; }
        }
        if (x >= 12 + 5 * 132) { sellMode = !sellMode; selTower = -1; g.sfx.click(); return; }
        return;
      }
      const c = Math.floor(x / CS), r = Math.floor(y / CS);
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
      const exist = towers.find((tw) => tw.c === c && tw.r === r);
      if (exist) {
        if (sellMode) { money += Math.round(TOWERS[exist.ti].cost * 0.7 * (exist.lv + 1)); towers = towers.filter((tw) => tw !== exist); g.sfx.hit(); return; }
        if (exist.lv < 2) {
          const cost = upgradeCost(exist);
          if (money >= cost) { money -= cost; exist.lv++; g.sfx.score(); g.juice.burst(c * CS + CS / 2, r * CS + CS / 2, GOLD, 10); g.juice.float(c * CS + CS / 2, r * CS + 10, `升到 ${exist.lv + 1} 级!`, GOLD, 14); }
          else { g.sfx.hit(); g.juice.float(c * CS + CS / 2, r * CS + 10, "金币不足", BERRY, 13); }
        } else g.juice.float(c * CS + CS / 2, r * CS + 10, "已满级", "#8fae93", 13);
        return;
      }
      if (pathSet.has(`${c},${r}`)) { g.sfx.hit(); return; }
      if (selTower >= 0) {
        const def = TOWERS[selTower];
        if (money >= def.cost) { money -= def.cost; towers.push({ ti: selTower, c, r, lv: 0, cd: 0 }); g.sfx.place(); g.juice.burst(c * CS + CS / 2, r * CS + CS / 2, "#8fc176", 8); }
        else { g.sfx.hit(); g.juice.float(x, y - 20, "金币不足", BERRY, 13); }
      }
    },
  };
}

/* ============ 中国象棋（完整规则） ============ */
export function createXiangqi(g: GameCtx): GameHandle {
  type P = { k: string; red: boolean; x: number; y: number };
  const INIT: P[] = [];
  const back = ["车", "马", "象", "士", "将", "士", "象", "马", "车"];
  back.forEach((k, x) => { INIT.push({ k, red: false, x, y: 0 }); INIT.push({ k, red: true, x, y: 9 }); });
  INIT.push({ k: "炮", red: false, x: 1, y: 2 }, { k: "炮", red: false, x: 7, y: 2 }, { k: "炮", red: true, x: 1, y: 7 }, { k: "炮", red: true, x: 7, y: 7 });
  [0, 2, 4, 6, 8].forEach((x) => { INIT.push({ k: "卒", red: false, x, y: 3 }); INIT.push({ k: "兵", red: true, x, y: 6 }); });
  let pieces = INIT;
  let turnRed = true, sel: P | null = null, legal: [number, number][] = [], lastMsg = "红方先行", moves = 0, winner: "" | "red" | "black" = "", hist: P[][] = [];
  const M = 40, TOP = 56, CELL = (g.W - M * 2) / 8;
  const bx = (x: number) => M + x * CELL, by = (y: number) => TOP + y * CELL;
  const at = (x: number, y: number) => pieces.find((p) => p.x === x && p.y === y);
  const inBoard = (x: number, y: number) => x >= 0 && x <= 8 && y >= 0 && y <= 9;
  const inPalace = (x: number, y: number, red: boolean) => x >= 3 && x <= 5 && (red ? y >= 7 && y <= 9 : y >= 0 && y <= 2);
  function genMoves(p: P, brd: P[]): [number, number][] {
    const out: [number, number][] = [];
    const occ = (x: number, y: number) => brd.some((q) => q.x === x && q.y === y);
    const at2 = (x: number, y: number) => brd.find((q) => q.x === x && q.y === y);
    const canGo = (x: number, y: number) => inBoard(x, y) && !brd.some((q) => q.x === x && q.y === y && q.red === p.red);
    if (p.k === "将") {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = p.x + dx, ny = p.y + dy; if (inPalace(nx, ny, p.red)) out.push([nx, ny]); });
      const foe = brd.find((q) => q.k === "将" && q.red !== p.red);
      if (foe && foe.x === p.x) {
        let blocked = false;
        for (let y = Math.min(foe.y, p.y) + 1; y < Math.max(foe.y, p.y); y++) if (occ(p.x, y)) { blocked = true; break; }
        if (!blocked) out.push([foe.x, foe.y]);
      }
    } else if (p.k === "士") {
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy]) => { const nx = p.x + dx, ny = p.y + dy; if (inPalace(nx, ny, p.red)) out.push([nx, ny]); });
    } else if (p.k === "象") {
      [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([dx, dy]) => {
        const nx = p.x + dx, ny = p.y + dy;
        const crossRiver = p.red ? ny < 5 : ny > 4;
        if (inBoard(nx, ny) && !crossRiver && !occ(p.x + dx / 2, p.y + dy / 2)) out.push([nx, ny]);
      });
    } else if (p.k === "马") {
      const jumps: [number, number, number, number][] = [[1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1], [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0]];
      jumps.forEach(([dx, dy, lx, ly]) => { if (!occ(p.x + lx, p.y + ly) && canGo(p.x + dx, p.y + dy)) out.push([p.x + dx, p.y + dy]); });
    } else if (p.k === "车") {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let nx = p.x + dx, ny = p.y + dy;
        while (inBoard(nx, ny)) {
          if (occ(nx, ny)) { if (at2(nx, ny)!.red !== p.red) out.push([nx, ny]); break; }
          out.push([nx, ny]); nx += dx; ny += dy;
        }
      }
    } else if (p.k === "炮") {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let nx = p.x + dx, ny = p.y + dy, jumped = false;
        while (inBoard(nx, ny)) {
          if (occ(nx, ny)) {
            if (!jumped) jumped = true;
            else { if (at2(nx, ny)!.red !== p.red) out.push([nx, ny]); break; }
          } else if (!jumped) out.push([nx, ny]);
          nx += dx; ny += dy;
        }
      }
    } else {
      const dir = p.red ? -1 : 1;
      const crossed = p.red ? p.y <= 4 : p.y >= 5;
      if (canGo(p.x, p.y + dir)) out.push([p.x, p.y + dir]);
      if (crossed) { if (canGo(p.x + 1, p.y)) out.push([p.x + 1, p.y]); if (canGo(p.x - 1, p.y)) out.push([p.x - 1, p.y]); }
    }
    return out;
  }
  function generalsFace(brd: P[]) {
    const r = brd.find((p) => p.k === "将" && p.red), b = brd.find((p) => p.k === "将" && !p.red);
    if (!r || !b || r.x !== b.x) return false;
    for (let y = Math.min(r.y, b.y) + 1; y < Math.max(r.y, b.y); y++) if (brd.some((q) => q.x === r.x && q.y === y)) return false;
    return true;
  }
  function isLegal(p: P, nx: number, ny: number) {
    const captured = at(nx, ny);
    const backup = { ...p };
    if (captured) { if (captured.k === "将") return true; pieces = pieces.filter((q) => q !== captured); }
    p.x = nx; p.y = ny;
    const myKing = pieces.find((q) => q.k === "将" && q.red === p.red)!;
    let safe = !generalsFace(pieces);
    if (safe) {
      for (const foe of pieces) {
        if (foe.red === p.red || foe.k === "将") continue;
        if (genMoves(foe, pieces).some(([mx, my]) => mx === myKing.x && my === myKing.y)) { safe = false; break; }
      }
    }
    p.x = backup.x; p.y = backup.y;
    if (captured) pieces.push(captured);
    return safe;
  }
  function legalFor(p: P) { return genMoves(p, pieces).filter(([nx, ny]) => isLegal(p, nx, ny)); }
  function move(p: P, nx: number, ny: number) {
    hist.push(pieces.map((q) => ({ ...q })));
    const captured = at(nx, ny);
    if (captured) {
      pieces = pieces.filter((q) => q !== captured);
      g.sfx.hit();
      g.juice.burst(bx(nx), by(ny), captured.red ? "#b03030" : "#333", 10);
      if (captured.k === "将") {
        winner = p.red ? "red" : "black";
        lastMsg = winner === "red" ? "🔴 红方胜！" : "⚫ 黑方胜！";
        g.sfx.win();
        setTimeout(() => g.over(Math.max(500, 3600 - moves * 12)), 1100);
      }
    } else g.sfx.place();
    p.x = nx; p.y = ny; moves++; sel = null; legal = [];
    if (winner) return;
    turnRed = !turnRed;
    const king = pieces.find((q) => q.k === "将" && q.red === turnRed)!;
    let anyMove = false;
    for (const q of pieces) if (q.red === turnRed && legalFor(q).length) { anyMove = true; break; }
    const inCheck = pieces.some((foe) => foe.red !== turnRed && genMoves(foe, pieces).some(([mx, my]) => mx === king.x && my === king.y));
    if (!anyMove) {
      winner = turnRed ? "black" : "red";
      lastMsg = `困毙！${winner === "red" ? "🔴 红方" : "⚫ 黑方"}胜！`;
      g.sfx.win();
      setTimeout(() => g.over(Math.max(500, 3600 - moves * 12)), 1100);
    } else lastMsg = inCheck ? `将军！轮到${turnRed ? "红" : "黑"}方` : `轮到${turnRed ? "🔴 红" : "⚫ 黑"}方`;
    if (inCheck && !winner) g.sfx.tone(500, 0.15, "square", 0.1, -120);
  }
  const CHARS: Record<string, string> = { 将: "将", 士: "士", 象: "象", 马: "馬", 车: "車", 炮: "砲", 卒: "卒", 兵: "兵" };
  return {
    tick(dt) { g.juice.update(dt); },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, "🀄 中国象棋", g.W / 2, 26, 19, "#cfe3c2");
      rr(ctx, M - 22, TOP - 22, g.W - M * 2 + 44, CELL * 9 + 44, 12);
      ctx.fillStyle = "#c9a86a"; ctx.fill();
      ctx.strokeStyle = "#5d4526"; ctx.lineWidth = 2;
      for (let i = 0; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(bx(i), by(0)); ctx.lineTo(bx(i), by(9)); ctx.stroke(); }
      for (let j = 0; j <= 9; j++) { ctx.beginPath(); ctx.moveTo(bx(0), by(j)); ctx.lineTo(bx(8), by(j)); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(bx(3), by(0)); ctx.lineTo(bx(5), by(2)); ctx.moveTo(bx(5), by(0)); ctx.lineTo(bx(3), by(2)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx(3), by(7)); ctx.lineTo(bx(5), by(9)); ctx.moveTo(bx(5), by(7)); ctx.lineTo(bx(3), by(9)); ctx.stroke();
      ctx.lineWidth = 1;
      txt(ctx, "楚 河", bx(2), by(4.5), 24, "#5d4526");
      txt(ctx, "漢 界", bx(6), by(4.5), 24, "#5d4526");
      legal.forEach(([nx, ny]) => {
        ctx.fillStyle = at(nx, ny) ? "rgba(217,93,57,.5)" : "rgba(62,142,82,.55)";
        ctx.beginPath(); ctx.arc(bx(nx), by(ny), at(nx, ny) ? CELL * 0.44 : 8, 0, 7); ctx.fill();
      });
      pieces.forEach((p) => {
        const cx = bx(p.x), cy = by(p.y);
        ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.42, 0, 7);
        ctx.fillStyle = "#f2e8cf"; ctx.fill();
        ctx.strokeStyle = p.red ? "#a33" : "#333"; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.34, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
        txt(ctx, CHARS[p.k], cx, cy + 1, CELL * 0.4, p.red ? "#b03030" : "#2a2a2a");
        if (sel === p) { ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.48, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
      });
      const sy = TOP + CELL * 9 + 40;
      txt(ctx, lastMsg, g.W / 2, sy, 17, winner ? GOLD : "#cfe3c2");
      rr(ctx, g.W / 2 - 52, sy + 16, 104, 44, 22);
      ctx.fillStyle = "#2a4634"; ctx.fill();
      txt(ctx, "⟲ 悔棋", g.W / 2, sy + 38, 15, "#e9f2e4");
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t !== "down") return;
      const sy = TOP + CELL * 9 + 40;
      if (!winner && x > g.W / 2 - 52 && x < g.W / 2 + 52 && y > sy + 16 && y < sy + 60 && hist.length) {
        pieces = hist.pop()!; turnRed = !turnRed; sel = null; legal = []; moves = Math.max(0, moves - 1);
        lastMsg = `轮到${turnRed ? "🔴 红" : "⚫ 黑"}方`; g.sfx.click(); return;
      }
      if (winner) return;
      const gx = Math.round((x - M) / CELL), gy = Math.round((y - TOP) / CELL);
      if (!inBoard(gx, gy)) return;
      const target = at(gx, gy);
      if (sel && legal.some(([nx, ny]) => nx === gx && ny === gy)) { move(sel, gx, gy); return; }
      if (target && target.red === turnRed) { sel = target; legal = legalFor(target); g.sfx.click(); }
      else { sel = null; legal = []; }
    },
  };
}
