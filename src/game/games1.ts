/* 游戏实现 · 第一辑：贪吃蛇 / 2048 / 俄罗斯方块 / Flappy / 记忆翻牌 / 扫雷 / 迷宫 / 五子棋 */
import { GameCtx, GameHandle, rr, clamp } from "./engine";
import { getSkinValue } from "../lib/api";

const FONT = '"Noto Sans SC", sans-serif';
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center", bold = true) {
  ctx.fillStyle = color; ctx.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
}
const GOLD = "#efa32c", BERRY = "#d95d39", LEAF = "#3e8e52", INK = "#1e3325";

/* ============ 贪吃蛇（输入队列 + 手感层 + 皮肤） ============ */
export function createSnake(g: GameCtx): GameHandle {
  const N = 20, PAD = 18;
  const CELL = (g.W - PAD * 2) / N;
  const OY = 110;
  const SKIN = getSkinValue("snake");
  let snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
  let dir = { x: 1, y: 0 };
  const queue: { x: number; y: number }[] = []; // 输入队列：快速连转不丢
  let food = spawn(), score = 0, acc = 0, dead = false, grow = 0;
  let downX = 0, downY = 0;
  function spawn() {
    for (let i = 0; i < 400; i++) {
      const f = { x: g.rnd(N), y: g.rnd(N) };
      if (!snake.some((s) => s.x === f.x && s.y === f.y)) return f;
    }
    return { x: 0, y: 0 };
  }
  const interval = () => Math.max(72, 150 - score * 0.8) / g.mult;
  function step() {
    if (queue.length) dir = queue.shift()!;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || snake.some((s) => s.x === head.x && s.y === head.y)) {
      dead = true; g.sfx.hit(); g.juice.shake(10);
      g.juice.burst(PAD + snake[0].x * CELL + CELL / 2, OY + snake[0].y * CELL + CELL / 2, BERRY, 14);
      setTimeout(() => g.over(score), 650);
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10; grow += 1;
      g.sfx.score();
      g.juice.burst(PAD + head.x * CELL + CELL / 2, OY + head.y * CELL + CELL / 2, GOLD, 10);
      g.juice.float(PAD + head.x * CELL + CELL / 2, OY + head.y * CELL, "+10", GOLD, 16);
      food = spawn();
    }
    if (grow > 0) grow--; else snake.pop();
  }
  function setDir(d: { x: number; y: number }) {
    const last = queue.length ? queue[queue.length - 1] : dir;
    if (d.x === -last.x && d.y === -last.y) return; // 禁 180° 掉头
    if (d.x === last.x && d.y === last.y) return;
    if (queue.length < 2) queue.push(d);
  }
  return {
    currentScore() { return score; },
    tick(dt) {
      g.juice.update(dt);
      if (dead) return;
      acc += dt;
      while (acc > interval()) { acc -= interval(); step(); }
    },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      ctx.strokeStyle = "rgba(124,179,86,.1)";
      rr(ctx, PAD - 6, OY - 6, N * CELL + 12, N * CELL + 12, 12); ctx.stroke();
      txt(ctx, "🐍 贪吃蛇", 88, 34, 20, "#cfe3c2");
      txt(ctx, `${score} 分`, 88, 66, 17, GOLD);
      txt(ctx, `长度 ${snake.length}`, g.W - 80, 50, 14, "#8fae93");
      // 食物
      const f = (Math.sin(Date.now() / 200) + 1) * 2.5;
      ctx.fillStyle = BERRY;
      ctx.beginPath(); ctx.arc(PAD + food.x * CELL + CELL / 2, OY + food.y * CELL + CELL / 2, CELL / 3 + f / 2, 0, 7); ctx.fill();
      ctx.fillStyle = "#f0c060";
      ctx.beginPath(); ctx.arc(PAD + food.x * CELL + CELL / 2 - 2, OY + food.y * CELL + CELL / 2 - 3, 2.4, 0, 7); ctx.fill();
      // 蛇
      snake.forEach((s, i) => {
        const t = i / snake.length;
        ctx.globalAlpha = 1 - t * 0.45;
        ctx.fillStyle = SKIN;
        rr(ctx, PAD + s.x * CELL + 1.5, OY + s.y * CELL + 1.5, CELL - 3, CELL - 3, i === 0 ? 8 : 5.5);
        ctx.fill();
        if (i === 0) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#12200f";
          const ex = dir.x !== 0 ? 4 * dir.x : 0, ey = dir.y !== 0 ? 4 * dir.y : 0;
          ctx.beginPath();
          ctx.arc(PAD + s.x * CELL + CELL / 2 - 4 + ex, OY + s.y * CELL + CELL / 2 - 2 + ey, 2.2, 0, 7);
          ctx.arc(PAD + s.x * CELL + CELL / 2 + 4 + ex, OY + s.y * CELL + CELL / 2 - 2 + ey, 2.2, 0, 7);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      if (dead) txt(ctx, "💫 咬到自己了", g.W / 2, OY + (N * CELL) / 2, 28, "#f3f5ea");
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t === "down") { downX = x; downY = y; return; }
      if (t === "up") {
        const dx = x - downX, dy = y - downY;
        if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
        if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
        else setDir(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
      }
    },
    onKey(code) {
      if (code === "ArrowUp" || code === "KeyW") setDir({ x: 0, y: -1 });
      if (code === "ArrowDown" || code === "KeyS") setDir({ x: 0, y: 1 });
      if (code === "ArrowLeft" || code === "KeyA") setDir({ x: -1, y: 0 });
      if (code === "ArrowRight" || code === "KeyD") setDir({ x: 1, y: 0 });
    },
  };
}

/* ============ 2048（种子随机 + 合并爆点 + 主题皮肤） ============ */
const THEME2048: Record<string, { bg: string; cell: string; txtDark: string; txtLight: string; tiles: Record<number, string> }> = {
  moss: { bg: "#0f2015", cell: "rgba(233,242,228,.07)", txtDark: "#1e3325", txtLight: "#f3f5ea", tiles: { 2: "#e4e9d8", 4: "#d5dfc3", 8: "#f0b45c", 16: "#eda14a", 32: "#e88a4a", 64: "#e0703c", 128: "#f0c060", 256: "#efb445", 512: "#eda82e", 1024: "#eca023", 2048: "#e8961c" } },
  night: { bg: "#0c110d", cell: "rgba(228,236,220,.06)", txtDark: "#e4ecdc", txtLight: "#10160f", tiles: { 2: "#39463a", 4: "#465546", 8: "#5d7a4f", 16: "#6f9f5c", 32: "#8fc176", 64: "#b7d98e", 128: "#f0c060", 256: "#efb445", 512: "#eda82e", 1024: "#eca023", 2048: "#e8961c" } },
  sakura: { bg: "#1d1216", cell: "rgba(240,224,226,.07)", txtDark: "#46282f", txtLight: "#fdf8f7", tiles: { 2: "#f0e0e2", 4: "#e8cfd4", 8: "#e0a4b4", 16: "#d98ca0", 32: "#d0748c", 64: "#c25e7a", 128: "#f0c060", 256: "#efb445", 512: "#eda82e", 1024: "#eca023", 2048: "#e8961c" } },
};
export function create2048(g: GameCtx): GameHandle {
  const N = g.difficulty === "easy" ? 5 : 4;
  const TH = THEME2048[getSkinValue("t2048")] ?? THEME2048.moss;
  const PAD = 16, TOP = 120;
  const CELL = (g.W - PAD * 2 - (N - 1) * 10) / N;
  let grid: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  let score = 0, overFlag = false, lock = false;
  let downX = 0, downY = 0;
  const fromSave = g.saved && Array.isArray(g.saved.grid) && g.saved.grid.length === N;
  if (fromSave) { grid = g.saved.grid; score = g.saved.score ?? 0; }
  function addTile() {
    const empty: [number, number][] = [];
    grid.forEach((r, y) => r.forEach((v, x) => { if (!v) empty.push([x, y]); }));
    if (!empty.length) return;
    const [x, y] = empty[g.rnd(empty.length)];
    grid[y][x] = g.rnd(10) === 0 ? 4 : 2;
  }
  function canMove() {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!grid[y][x]) return true;
      if (x + 1 < N && grid[y][x] === grid[y][x + 1]) return true;
      if (y + 1 < N && grid[y][x] === grid[y + 1][x]) return true;
    }
    return false;
  }
  function slideRow(row: number[], py: number, horiz: boolean, reverse: boolean): number[] {
    const arr = row.filter(Boolean);
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2; score += arr[i];
        const px = horiz ? (reverse ? N - 1 - i : i) : py;
        const pyy = horiz ? py : (reverse ? N - 1 - i : i);
        g.juice.float(PAD + px * (CELL + 10) + CELL / 2, TOP + pyy * (CELL + 10), `+${arr[i]}`, GOLD, 15);
        g.juice.burst(PAD + px * (CELL + 10) + CELL / 2, TOP + pyy * (CELL + 10) + CELL / 2, "#f0c060", 5);
        arr.splice(i + 1, 1);
      }
    }
    while (arr.length < N) arr.push(0);
    return reverse ? arr.reverse() : arr;
  }
  function move(dx: number, dy: number) {
    if (lock || overFlag) return;
    const before = JSON.stringify(grid);
    if (dx === -1) grid = grid.map((r, y) => slideRow([...r], y, true, false));
    if (dx === 1) grid = grid.map((r, y) => slideRow([...r], y, true, true));
    if (dy === -1) for (let x = 0; x < N; x++) { const col = grid.map((r) => r[x]); const s = slideRow(col, x, false, false); s.forEach((v, y) => (grid[y][x] = v)); }
    if (dy === 1) for (let x = 0; x < N; x++) { const col = grid.map((r) => r[x]).reverse(); const s = slideRow(col, x, false, true); s.forEach((v, y) => (grid[y][x] = v)); }
    if (JSON.stringify(grid) !== before) {
      g.sfx.place(); g.juice.shake(2);
      addTile();
      if (!canMove()) { overFlag = true; g.sfx.over(); setTimeout(() => g.over(score), 700); }
    } else g.sfx.click();
  }
  if (!fromSave) { addTile(); addTile(); }
  return {
    snapshot() { return { grid, score }; },
    currentScore() { return score; },
    tick(dt) { g.juice.update(dt); },
    draw(ctx) {
      ctx.fillStyle = TH.bg; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, "🔢 2048", 78, 34, 20, "#cfe3c2");
      rr(ctx, g.W - 150, 18, 132, 52, 12); ctx.fillStyle = "rgba(233,242,228,.08)"; ctx.fill();
      txt(ctx, "分数", g.W - 84, 34, 11, "#8fae93");
      txt(ctx, String(score), g.W - 84, 54, 20, GOLD);
      grid.forEach((row, y) => row.forEach((v, x) => {
        const px = PAD + x * (CELL + 10), py = TOP + y * (CELL + 10);
        rr(ctx, px, py, CELL, CELL, 10);
        ctx.fillStyle = v ? TH.tiles[Math.min(v, 2048)] ?? "#e8961c" : TH.cell;
        ctx.fill();
        if (v) {
          const dark = v <= 4 && TH !== THEME2048.night;
          txt(ctx, String(v), px + CELL / 2, py + CELL / 2 + 1, v >= 1024 ? CELL * 0.26 : v >= 128 ? CELL * 0.32 : CELL * 0.4, dark ? TH.txtDark : TH.txtLight);
        }
      }));
      if (overFlag) txt(ctx, "没有可移动的格子了", g.W / 2, g.H - 30, 18, "#f3f5ea");
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t === "down") { downX = x; downY = y; return; }
      if (t === "up") {
        const dx = x - downX, dy = y - downY;
        if (Math.abs(dx) < 26 && Math.abs(dy) < 26) return;
        if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
        else move(0, dy > 0 ? 1 : -1);
      }
    },
    onKey(code) {
      if (code === "ArrowLeft") move(-1, 0);
      if (code === "ArrowRight") move(1, 0);
      if (code === "ArrowUp") move(0, -1);
      if (code === "ArrowDown") move(0, 1);
    },
  };
}

/* ============ 俄罗斯方块（平滑加速 + 消行爆裂 + 触屏按键） ============ */
const TET: Record<string, { m: string[]; c: string }> = {
  I: { m: ["....", "XXXX", "....", "...."], c: "#5cc4b4" },
  O: { m: ["XX", "XX"], c: "#f0c060" },
  T: { m: [".X.", "XXX", "..."], c: "#b78ed9" },
  S: { m: [".XX", "XX.", "..."], c: "#8fc176" },
  Z: { m: ["XX.", ".XX", "..."], c: "#e07a5f" },
  J: { m: ["X..", "XXX", "..."], c: "#6f9fd8" },
  L: { m: ["..X", "XXX", "..."], c: "#eda93a" },
};
function rotM(m: string[]): string[] {
  const n = m.length;
  return m[0].split("").map((_, x) => m.map((row) => row[x]).reverse().join(""));
  void n;
}
export function createTetris(g: GameCtx): GameHandle {
  const COLS = 10, ROWS = 20;
  const CELL = Math.floor(Math.min((g.W - 130) / COLS, (g.H - 70) / ROWS));
  const OX = 10, OY = 46;
  let board: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
  const keysList = Object.keys(TET);
  let bag: string[] = [];
  function nextPiece() {
    if (!bag.length) { bag = [...keysList]; for (let i = bag.length - 1; i > 0; i--) { const j = g.rnd(i + 1); [bag[i], bag[j]] = [bag[j], bag[i]]; } }
    return bag.pop()!;
  }
  let nextK = nextPiece();
  function newPiece() {
    const k = nextK; nextK = nextPiece();
    return { k, m: TET[k].m, x: Math.floor((COLS - TET[k].m[0].length) / 2), y: 0 };
  }
  let cur = newPiece();
  let score = 0, lines = 0, combo = -1, dead = false, overFlag = false, acc = 0, holdL = false, holdR = false, moveAcc = 0;
  const interval = () => Math.max(88, 640 - lines * 7) / g.mult;
  function cellsOf(p: typeof cur, m = p.m, x = p.x, y = p.y): [number, number][] {
    const out: [number, number][] = [];
    m.forEach((row, yy) => row.split("").forEach((ch, xx) => { if (ch === "X") out.push([x + xx, y + yy]); }));
    return out;
  }
  function hit(p: typeof cur, m = p.m, x = p.x, y = p.y) {
    return cellsOf(p, m, x, y).some(([cx, cy]) => cx < 0 || cx >= COLS || cy >= ROWS || (cy >= 0 && board[cy][cx]));
  }
  function lockPiece() {
    cellsOf(cur).forEach(([cx, cy]) => { if (cy >= 0) board[cy][cx] = cur.k; });
    // 消行
    const full: number[] = [];
    board.forEach((row, y) => { if (row.every(Boolean)) full.push(y); });
    if (full.length) {
      combo++;
      full.forEach((y) => {
        for (let cx = 0; cx < COLS; cx++) g.juice.burst(OX + cx * CELL + CELL / 2, OY + y * CELL + CELL / 2, TET[board[y][cx]].c, 3);
      });
      g.juice.shake(4 + full.length * 2);
      const base = [0, 100, 300, 600, 1000][full.length];
      const gain = Math.round(base * (1 + combo * 0.25));
      score += gain; lines += full.length;
      g.juice.float(g.W / 2, OY + full[0] * CELL, full.length === 4 ? `✨ 四连消 +${gain}` : `消 ${full.length} 行 +${gain}`, GOLD, full.length === 4 ? 22 : 17);
      if (combo > 0) g.juice.float(g.W / 2, OY + full[0] * CELL + 26, `连消 ×${combo + 1}`, BERRY, 14);
      g.sfx.score(); if (full.length === 4) g.sfx.win();
      board = board.filter((_, y) => !full.includes(y));
      while (board.length < ROWS) board.unshift(Array(COLS).fill(""));
    } else combo = -1;
    cur = newPiece();
    if (hit(cur)) { dead = true; g.sfx.over(); setTimeout(() => g.over(score), 700); }
  }
  function rotate() {
    const m2 = rotM(cur.m);
    for (const kick of [0, -1, 1, -2, 2]) if (!hit(cur, m2, cur.x + kick, cur.y)) { cur.m = m2; cur.x += kick; g.sfx.click(); return; }
  }
  function hardDrop() {
    let d = 0;
    while (!hit(cur, cur.m, cur.x, cur.y + 1)) { cur.y++; d++; }
    score += d * 2; g.sfx.place(); lockPiece();
  }
  let downX = 0, downY = 0;
  return {
    currentScore() { return score; },
    tick(dt) {
      g.juice.update(dt);
      if (dead) return;
      // 键盘按住连续移动
      if (holdL || holdR) { moveAcc += dt; while (moveAcc > 110) { moveAcc -= 110; if (!hit(cur, cur.m, cur.x + (holdL ? -1 : 1), cur.y)) cur.x += holdL ? -1 : 1; } }
      acc += dt;
      while (acc > interval()) {
        acc -= interval();
        if (!hit(cur, cur.m, cur.x, cur.y + 1)) cur.y++;
        else lockPiece();
      }
    },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      // 场地
      ctx.fillStyle = "#132a1c"; ctx.fillRect(OX, OY, COLS * CELL, ROWS * CELL);
      ctx.strokeStyle = "rgba(124,179,86,.12)";
      for (let i = 1; i < COLS; i++) { ctx.beginPath(); ctx.moveTo(OX + i * CELL, OY); ctx.lineTo(OX + i * CELL, OY + ROWS * CELL); ctx.stroke(); }
      // 已落块
      board.forEach((row, y) => row.forEach((k, x) => {
        if (!k) return;
        ctx.fillStyle = TET[k].c;
        rr(ctx, OX + x * CELL + 1, OY + y * CELL + 1, CELL - 2, CELL - 2, 4); ctx.fill();
      }));
      // 幽灵
      if (!dead) {
        let gy = cur.y;
        while (!hit(cur, cur.m, cur.x, gy + 1)) gy++;
        ctx.globalAlpha = 0.18;
        cellsOf(cur, cur.m, cur.x, gy).forEach(([cx, cy]) => { if (cy >= 0) { ctx.fillStyle = TET[cur.k].c; ctx.fillRect(OX + cx * CELL + 1, OY + cy * CELL + 1, CELL - 2, CELL - 2); } });
        ctx.globalAlpha = 1;
        cellsOf(cur).forEach(([cx, cy]) => {
          if (cy < 0) return;
          ctx.fillStyle = TET[cur.k].c;
          rr(ctx, OX + cx * CELL + 1, OY + cy * CELL + 1, CELL - 2, CELL - 2, 4); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fillRect(OX + cx * CELL + 3, OY + cy * CELL + 3, CELL - 6, 4);
        });
      }
      // 侧栏
      const PX = OX + COLS * CELL + 14;
      txt(ctx, "分数", PX + 48, OY + 14, 12, "#8fae93");
      txt(ctx, String(score), PX + 48, OY + 40, 22, GOLD);
      txt(ctx, `行数 ${lines}`, PX + 48, OY + 74, 13, "#cfe3c2");
      txt(ctx, "下一个", PX + 48, OY + 106, 12, "#8fae93");
      TET[nextK].m.forEach((row, yy) => row.split("").forEach((ch, xx) => {
        if (ch !== "X") return;
        ctx.fillStyle = TET[nextK].c;
        ctx.fillRect(PX + 22 + xx * 14, OY + 124 + yy * 14, 12, 12);
      }));
      txt(ctx, `速度 Lv.${1 + Math.floor(lines / 8)}`, PX + 48, OY + 220, 12, "#8fae93");
      // 触屏按键
      const BY = g.H - 64;
      const btns = ["◀", "⟳", "▶", "⤓"];
      btns.forEach((b, i) => {
        rr(ctx, 12 + i * ((g.W - 24) / 4 + 0), BY, (g.W - 24) / 4 - 8, 54, 12);
        ctx.fillStyle = "rgba(233,242,228,.1)"; ctx.fill();
        txt(ctx, b, 12 + i * ((g.W - 24) / 4) + ((g.W - 24) / 4 - 8) / 2, BY + 28, 22, "#cfe3c2");
      });
      if (dead) txt(ctx, "堆到顶了！", g.W / 2, g.H / 2, 30, "#f3f5ea");
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (dead) return;
      const BY = g.H - 64;
      if (t === "down") {
        if (y > BY) {
          const i = Math.floor((x - 12) / ((g.W - 24) / 4));
          if (i === 0) { if (!hit(cur, cur.m, cur.x - 1, cur.y)) cur.x--; }
          else if (i === 1) rotate();
          else if (i === 2) { if (!hit(cur, cur.m, cur.x + 1, cur.y)) cur.x++; }
          else hardDrop();
          return;
        }
        downX = x; downY = y;
        return;
      }
      if (t === "up" && y <= BY) {
        const dx = x - downX, dy = y - downY;
        if (Math.abs(dx) < 24 && Math.abs(dy) < 24) { rotate(); return; }
        if (dy > 50 && Math.abs(dy) > Math.abs(dx)) { hardDrop(); return; }
        const steps = Math.round(dx / (CELL * 1.4));
        for (let s = 0; s < Math.abs(steps); s++) if (!hit(cur, cur.m, cur.x + Math.sign(steps), cur.y)) cur.x += Math.sign(steps);
      }
    },
    onKey(code, down) {
      if (code === "ArrowLeft") { holdL = down; if (down && !hit(cur, cur.m, cur.x - 1, cur.y)) cur.x--; moveAcc = 0; }
      if (code === "ArrowRight") { holdR = down; if (down && !hit(cur, cur.m, cur.x + 1, cur.y)) cur.x++; moveAcc = 0; }
      if (code === "ArrowUp" && down) rotate();
      if (code === "ArrowDown" && down) { if (!hit(cur, cur.m, cur.x, cur.y + 1)) { cur.y++; score++; } }
      if (code === "Space" && down) hardDrop();
    },
  };
}

/* ============ Flappy Bird（矢量小鸟 + 皮肤） ============ */
export function createFlappy(g: GameCtx): GameHandle {
  const SKIN = getSkinValue("flappy");
  let bird = { x: g.W * 0.3, y: g.H * 0.45, vy: 0, rot: 0 };
  type Pipe = { x: number; gapY: number; passed: boolean };
  let pipes: Pipe[] = [];
  const gap = g.difficulty === "easy" ? 205 : g.difficulty === "hard" ? 150 : 175;
  const spd = 2.7 * g.mult;
  let score = 0, dead = false, started = false, spawnT = 0, wing = 0;
  function flap() {
    if (dead) return;
    if (!started) started = true;
    bird.vy = -7.4; wing = 200;
    g.sfx.jump();
  }
  return {
    currentScore() { return score; },
    tick(dt) {
      g.juice.update(dt);
      wing = Math.max(0, wing - dt);
      if (dead || !started) { bird.y += Math.sin(Date.now() / 300) * 0.3; return; }
      const k = dt / 16.7;
      bird.vy = Math.min(11, bird.vy + 0.42 * k);
      bird.y += bird.vy * k;
      bird.rot = clamp(bird.vy * 0.06, -0.5, 1.1);
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = 1450 / g.mult;
        pipes.push({ x: g.W + 60, gapY: 130 + g.rnd(Math.max(60, g.H - 380)), passed: false });
      }
      pipes.forEach((p) => (p.x -= spd * k));
      pipes = pipes.filter((p) => p.x > -90);
      for (const p of pipes) {
        if (!p.passed && p.x + 34 < bird.x) {
          p.passed = true; score++;
          g.sfx.coin();
          g.juice.float(bird.x, bird.y - 36, "+1", GOLD, 17);
        }
        if (bird.x + 15 > p.x - 32 && bird.x - 15 < p.x + 32 && (bird.y - 13 < p.gapY - gap / 2 || bird.y + 13 > p.gapY + gap / 2)) die();
      }
      if (bird.y > g.H - 60 || bird.y < -40) die();
      function die() {
        if (dead) return;
        dead = true; g.sfx.boom(); g.juice.shake(12);
        g.juice.burst(bird.x, bird.y, SKIN, 16);
        setTimeout(() => g.over(score), 800);
      }
    },
    draw(ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, g.H);
      sky.addColorStop(0, "#12301f"); sky.addColorStop(1, "#0f2015");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      // 管道
      pipes.forEach((p) => {
        ctx.fillStyle = "#3e6b48";
        rr(ctx, p.x - 34, 0, 68, p.gapY - gap / 2, 6); ctx.fill();
        rr(ctx, p.x - 34, p.gapY + gap / 2, 68, g.H, 6); ctx.fill();
        ctx.fillStyle = "#4f8559";
        ctx.fillRect(p.x - 40, p.gapY - gap / 2 - 16, 80, 16);
        ctx.fillRect(p.x - 40, p.gapY + gap / 2, 80, 16);
      });
      // 地面
      ctx.fillStyle = "#2c4a35"; ctx.fillRect(0, g.H - 56, g.W, 56);
      ctx.fillStyle = "#3e6b48"; ctx.fillRect(0, g.H - 56, g.W, 6);
      // 小鸟
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(dead ? 1.2 : bird.rot);
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(0, 0, 17, 13, 0, 0, 7); ctx.fill();
      ctx.fillStyle = wing > 0 ? "#fff" : "rgba(255,255,255,.75)";
      ctx.beginPath(); ctx.ellipse(-4, wing > 0 ? -8 : 3, 8, 5, -0.3, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(7, -4, 5, 0, 7); ctx.fill();
      ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(8.5, -4, 2.3, 0, 7); ctx.fill();
      ctx.fillStyle = "#e07a3f";
      ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(24, 2); ctx.lineTo(15, 6); ctx.fill();
      ctx.restore();
      txt(ctx, String(score), g.W / 2, 64, 44, "#f3f5ea");
      if (!started) {
        txt(ctx, "点一下起飞", g.W / 2, g.H * 0.72, 20, "#cfe3c2");
        txt(ctx, "👆", g.W / 2, g.H * 0.72 + 42, 26, "#cfe3c2");
      }
      if (dead) txt(ctx, "💫 坠落了", g.W / 2, g.H / 2, 30, "#f3f5ea");
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t) { if (t === "down") flap(); },
    onKey(code, down) { if ((code === "Space" || code === "ArrowUp") && down) flap(); },
  };
}

/* ============ 记忆翻牌 ============ */
export function createMemory(g: GameCtx): GameHandle {
  const EMO = ["🌸", "🍄", "🌻", "🐝", "🌈", "⭐", "🍀", "🌙", "🔥", "🎈"];
  const pairs = g.difficulty === "easy" ? 6 : g.difficulty === "hard" ? 10 : 8;
  const cols = pairs <= 6 ? 4 : pairs <= 8 ? 4 : 5;
  const rows = (pairs * 2) / cols;
  const PAD = 16, TOP = 110;
  const CW = (g.W - PAD * 2 - (cols - 1) * 10) / cols;
  const CH = Math.min(CW * 1.15, (g.H - TOP - 90 - (rows - 1) * 10) / rows);
  let deck = EMO.slice(0, pairs);
  deck = [...deck, ...deck].sort(() => g.rnd(2) ? 1 : -1);
  // 用 rnd 洗一遍保证每日模式确定性
  for (let i = deck.length - 1; i > 0; i--) { const j = g.rnd(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  let flipped: number[] = [], matched = new Set<number>(), moves = 0, lockT = 0, startT = Date.now(), done = false, overFlag = false;
  return {
    tick(dt) {
      g.juice.update(dt);
      if (lockT > 0) {
        lockT -= dt;
        if (lockT <= 0) flipped = [];
      }
      if (!done && matched.size === deck.length) {
        done = true; g.sfx.win();
        const sec = (Date.now() - startT) / 1000;
        const score = Math.max(600, Math.round(pairs * 900 - moves * 45 - sec * 12) * (g.difficulty === "hard" ? 1.4 : g.difficulty === "easy" ? 0.7 : 1));
        if (!overFlag) { overFlag = true; setTimeout(() => g.over(score), 900); }
      }
    },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, "🎴 记忆翻牌", 100, 34, 20, "#cfe3c2");
      txt(ctx, `步数 ${moves}`, g.W - 84, 34, 14, "#8fae93");
      txt(ctx, `⏱ ${Math.floor((Date.now() - startT) / 1000)}s`, g.W - 84, 60, 13, "#8fae93");
      deck.forEach((e, i) => {
        const x = PAD + (i % cols) * (CW + 10), y = TOP + Math.floor(i / cols) * (CH + 10);
        const up = flipped.includes(i) || matched.has(i);
        rr(ctx, x, y, CW, CH, 10);
        ctx.fillStyle = matched.has(i) ? "rgba(62,142,82,.25)" : up ? "#e9f2e4" : "#223c2a";
        ctx.fill();
        ctx.strokeStyle = matched.has(i) ? LEAF : "rgba(233,242,228,.2)"; ctx.stroke();
        if (up) txt(ctx, e, x + CW / 2, y + CH / 2 + 2, CH * 0.42, "#000");
        else txt(ctx, "🌿", x + CW / 2, y + CH / 2 + 2, CH * 0.3, "#000");
      });
      if (done) txt(ctx, "🎉 全部配对！", g.W / 2, g.H - 40, 22, GOLD);
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t !== "down" || lockT > 0 || done) return;
      const col = Math.floor((x - PAD) / (CW + 10)), row = Math.floor((y - TOP) / (CH + 10));
      if (col < 0 || row < 0 || col >= cols || row >= rows) return;
      const i = row * cols + col;
      if (flipped.includes(i) || matched.has(i) || flipped.length >= 2) return;
      flipped.push(i); g.sfx.click();
      if (flipped.length === 2) {
        moves++;
        const [a, b] = flipped;
        if (deck[a] === deck[b]) {
          matched.add(a); matched.add(b);
          flipped = [];
          g.sfx.score();
          g.juice.burst(PAD + (a % cols) * (CW + 10) + CW / 2, TOP + Math.floor(a / cols) * (CH + 10) + CH / 2, GOLD, 8);
        } else lockT = 620;
      }
    },
  };
}

/* ============ 扫雷（长按标旗 + 首次安全） ============ */
export function createMinesweeper(g: GameCtx): GameHandle {
  const cfg = g.difficulty === "easy" ? { c: 9, r: 9, m: 10 } : g.difficulty === "hard" ? { c: 12, r: 16, m: 36 } : { c: 10, r: 14, m: 22 };
  const CELL = Math.min((g.W - 20) / cfg.c, (g.H - 150) / cfg.r);
  const OX = (g.W - CELL * cfg.c) / 2, OY = 118;
  let mines = new Set<number>(), opened = new Set<number>(), flags = new Set<number>();
  let placed = false, dead = false, winFlag = false, startT = Date.now(), overFlag = false, flagMode = false;
  let downT = 0, downIdx = -1, longT = 0;
  if (g.saved && Array.isArray(g.saved.mines)) {
    mines = new Set(g.saved.mines); opened = new Set(g.saved.opened); flags = new Set(g.saved.flags);
    placed = true; startT = Date.now() - (g.saved.elapsed ?? 0);
  }
  const idx = (x: number, y: number) => y * cfg.c + x;
  const neighbors = (x: number, y: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < cfg.c && ny < cfg.r) out.push([nx, ny]);
    }
    return out;
  };
  function placeMines(safe: number) {
    const pool: number[] = [];
    for (let i = 0; i < cfg.c * cfg.r; i++) if (i !== safe) pool.push(i);
    for (let i = pool.length - 1; i > 0; i--) { const j = g.rnd(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    mines = new Set(pool.slice(0, cfg.m));
    placed = true;
  }
  const count = (x: number, y: number) => neighbors(x, y).filter(([nx, ny]) => mines.has(idx(nx, ny))).length;
  function open(x: number, y: number) {
    if (dead || winFlag) return;
    const i = idx(x, y);
    if (opened.has(i) || flags.has(i)) return;
    if (!placed) placeMines(i);
    if (mines.has(i)) {
      dead = true; g.sfx.boom(); g.juice.shake(14);
      setTimeout(() => g.over(Math.floor((Date.now() - startT) / 1000)), 900);
      return;
    }
    const stack: [number, number][] = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      const ci = idx(cx, cy);
      if (opened.has(ci) || flags.has(ci) || mines.has(ci)) continue;
      opened.add(ci);
      if (count(cx, cy) === 0) neighbors(cx, cy).forEach((n) => stack.push(n));
    }
    g.sfx.click();
    checkWin();
  }
  function toggleFlag(x: number, y: number) {
    const i = idx(x, y);
    if (opened.has(i) || dead || winFlag) return;
    if (flags.has(i)) flags.delete(i); else { flags.add(i); g.sfx.place(); }
    checkWin();
  }
  function checkWin() {
    if (opened.size === cfg.c * cfg.r - cfg.m && !winFlag && !dead) {
      winFlag = true; g.sfx.win();
      const sec = Math.floor((Date.now() - startT) / 1000);
      const score = Math.max(800, Math.round(cfg.m * 160 - sec * 6) * (g.difficulty === "hard" ? 1.5 : g.difficulty === "easy" ? 0.6 : 1));
      if (!overFlag) { overFlag = true; setTimeout(() => g.over(score), 900); }
    }
  }
  const NUMC = ["", "#6f9fd8", "#3e8e52", "#d95d39", "#7b4b94", "#8a5f14", "#2e8f83", "#555", "#999"];
  return {
    snapshot() { return { mines: [...mines], opened: [...opened], flags: [...flags], elapsed: Date.now() - startT }; },
    tick(dt) {
      g.juice.update(dt);
      if (downIdx >= 0 && Date.now() - downT > 380 && longT === 0) {
        longT = 1;
        const x = downIdx % cfg.c, y = Math.floor(downIdx / cfg.c);
        toggleFlag(x, y);
        try { navigator.vibrate?.(25); } catch { /* noop */ }
      }
    },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, "💣 扫雷", 78, 34, 20, "#cfe3c2");
      txt(ctx, `⏱ ${placed && !dead && !winFlag ? Math.floor((Date.now() - startT) / 1000) : 0}s`, g.W / 2, 34, 14, "#8fae93");
      txt(ctx, `💣 剩 ${cfg.m - flags.size}`, g.W / 2 - 80, 72, 15, "#cfe3c2");
      // 标旗模式按钮（热区 ≥44px）
      rr(ctx, g.W / 2 + 2, 44, 148, 56, 16);
      ctx.fillStyle = flagMode ? GOLD : "#2a4634"; ctx.fill();
      ctx.strokeStyle = flagMode ? "#96660f" : "rgba(233,242,228,.3)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
      txt(ctx, flagMode ? "🚩 标旗中" : "👆 点开", g.W / 2 + 76, 72, 15, flagMode ? "#4a3208" : "#cfe3c2");
      for (let y = 0; y < cfg.r; y++) for (let x = 0; x < cfg.c; x++) {
        const i = idx(x, y), px = OX + x * CELL, py = OY + y * CELL;
        const isOpen = opened.has(i);
        rr(ctx, px + 1, py + 1, CELL - 2, CELL - 2, 5);
        ctx.fillStyle = isOpen ? (mines.has(i) ? "#5a2a20" : "#16301f") : "#2a4634";
        ctx.fill();
        if (!isOpen) { ctx.fillStyle = "rgba(233,242,228,.14)"; ctx.fillRect(px + 3, py + 3, CELL - 6, 4); }
        if (flags.has(i)) txt(ctx, "🚩", px + CELL / 2, py + CELL / 2 + 1, CELL * 0.5, "#000");
        else if (isOpen && mines.has(i)) txt(ctx, "💣", px + CELL / 2, py + CELL / 2 + 1, CELL * 0.5, "#000");
        else if (isOpen) { const n = count(x, y); if (n) txt(ctx, String(n), px + CELL / 2, py + CELL / 2 + 1, CELL * 0.5, NUMC[n]); }
      }
      if (dead) txt(ctx, "💥 踩雷了！", g.W / 2, g.H - 30, 24, "#f3f5ea");
      if (winFlag) txt(ctx, "🎉 排雷成功！", g.W / 2, g.H - 30, 24, GOLD);
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t === "down") {
        // 标旗模式按钮
        if (x >= g.W / 2 + 2 && x <= g.W / 2 + 150 && y >= 38 && y <= 104) { flagMode = !flagMode; g.sfx.click(); return; }
        const cx = Math.floor((x - OX) / CELL), cy = Math.floor((y - OY) / CELL);
        if (cx < 0 || cy < 0 || cx >= cfg.c || cy >= cfg.r) return;
        downIdx = idx(cx, cy); downT = Date.now(); longT = 0;
        return;
      }
      if (t === "up") {
        if (downIdx < 0) return;
        const cx = downIdx % cfg.c, cy = Math.floor(downIdx / cfg.c);
        const px = OX + cx * CELL, py = OY + cy * CELL;
        const inCell = x >= px - 8 && x <= px + CELL + 8 && y >= py - 8 && y <= py + CELL + 8;
        if (inCell && longT === 0 && Date.now() - downT < 380) {
          if (flagMode) toggleFlag(cx, cy); else open(cx, cy);
        }
        downIdx = -1;
      }
    },
  };
}

/* ============ 迷宫（种子生成 + 按住连走） ============ */
export function createMaze(g: GameCtx): GameHandle {
  const cfg = g.difficulty === "easy" ? { c: 11, r: 15 } : g.difficulty === "hard" ? { c: 17, r: 23 } : { c: 13, r: 19 };
  const W2 = cfg.c * 2 + 1, H2 = cfg.r * 2 + 1;
  const wall: boolean[][] = Array.from({ length: H2 }, () => Array(W2).fill(true));
  (function carve(cx: number, cy: number) {
    wall[cy * 2 + 1][cx * 2 + 1] = false;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = dirs.length - 1; i > 0; i--) { const j = g.rnd(i + 1); [dirs[i], dirs[j]] = [dirs[j], dirs[i]]; }
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cfg.c || ny >= cfg.r) continue;
      if (!wall[ny * 2 + 1][nx * 2 + 1]) continue;
      wall[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = false;
      carve(nx, ny);
    }
  })(0, 0);
  const TOP = 70;
  const CELL = Math.min((g.W - 16) / W2, (g.H - TOP - 16) / H2);
  const OX = (g.W - CELL * W2) / 2, OY = TOP + (g.H - TOP - CELL * H2) / 2;
  let px = 1, py = 1, steps = 0, startT = Date.now(), won = false, acc = 0;
  let holdDx = 0, holdDy = 0, holding = false;
  const ex = W2 - 2, ey = H2 - 2;
  wall[ey][ex] = false;
  if (g.saved && Array.isArray(g.saved.wall)) {
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) wall[y][x] = !!g.saved.wall[y][x];
    px = g.saved.px; py = g.saved.py; steps = g.saved.steps ?? 0; startT = Date.now() - (g.saved.elapsed ?? 0);
  }
  function tryMove(dx: number, dy: number) {
    if (won) return;
    if (wall[py + dy][px + dx]) return;
    px += dx * 2; py += dy * 2; steps++; g.sfx.click();
    if (px === ex && py === ey) {
      won = true; g.sfx.win(); g.juice.shake(6);
      const sec = (Date.now() - startT) / 1000;
      const base = cfg.c * cfg.r * 30;
      setTimeout(() => g.over(Math.max(400, Math.round(base * 2 - steps * 8 - sec * 5) * (g.difficulty === "hard" ? 1.6 : g.difficulty === "easy" ? 0.6 : 1))), 800);
    }
  }
  return {
    snapshot() { return { wall, px, py, steps, elapsed: Date.now() - startT }; },
    tick(dt) {
      g.juice.update(dt);
      acc += dt;
      if (holding && acc > 140) {
        acc = 0;
        if (Math.abs(holdDx) > Math.abs(holdDy)) tryMove(Math.sign(holdDx), 0);
        else tryMove(0, Math.sign(holdDy));
      }
    },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, "🌀 迷宫", 78, 30, 20, "#cfe3c2");
      txt(ctx, `步数 ${steps}`, g.W / 2, 30, 15, "#8fae93");
      txt(ctx, "找到 🚪 出口！", g.W - 92, 30, 13, "#8fae93");
      for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
        if (!wall[y][x]) continue;
        ctx.fillStyle = "#2e5540";
        ctx.fillRect(OX + x * CELL, OY + y * CELL, CELL + 0.5, CELL + 0.5);
      }
      txt(ctx, "🚪", OX + ex * CELL + CELL / 2, OY + ey * CELL + CELL / 2, CELL * 0.9, "#000");
      const bob = Math.sin(Date.now() / 200) * 1.5;
      ctx.fillStyle = GOLD;
      ctx.beginPath(); ctx.arc(OX + px * CELL + CELL / 2, OY + py * CELL + CELL / 2 + bob, CELL * 0.34, 0, 7); ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(OX + px * CELL + CELL / 2 + 2, OY + py * CELL + CELL / 2 + bob - 2, 2, 0, 7); ctx.fill();
      if (won) txt(ctx, "🎉 走出来了！", g.W / 2, g.H / 2, 30, GOLD);
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      const cx = OX + px * CELL + CELL / 2, cy = OY + py * CELL + CELL / 2;
      if (t === "down" || t === "move") {
        const dx = x - cx, dy = y - cy;
        if (Math.hypot(dx, dy) > CELL * 0.8) { holding = true; holdDx = dx; holdDy = dy; if (t === "down") acc = 140; return; }
        holding = false;
      }
      if (t === "up") holding = false;
    },
    onKey(code, down) {
      if (!down) return;
      if (code === "ArrowLeft" || code === "KeyA") tryMove(-1, 0);
      if (code === "ArrowRight" || code === "KeyD") tryMove(1, 0);
      if (code === "ArrowUp" || code === "KeyW") tryMove(0, -1);
      if (code === "ArrowDown" || code === "KeyS") tryMove(0, 1);
    },
  };
}

/* ============ 五子棋（双人对弈 + 悔棋） ============ */
export function createGomoku(g: GameCtx): GameHandle {
  const N = 15, PAD = 26, TOP = 96;
  const CELL = (g.W - PAD * 2) / (N - 1);
  let board: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  let turn = 1, winner = 0, moves = 0, hist: [number, number][] = [];
  if (g.saved && Array.isArray(g.saved.board)) { board = g.saved.board; turn = g.saved.turn ?? 1; moves = g.saved.moves ?? 0; hist = g.saved.hist ?? []; }
  function checkWin(x: number, y: number, p: number) {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      let n = 1;
      for (const s of [1, -1]) {
        let nx = x + dx * s, ny = y + dy * s;
        while (nx >= 0 && ny >= 0 && nx < N && ny < N && board[ny][nx] === p) { n++; nx += dx * s; ny += dy * s; }
      }
      if (n >= 5) return true;
    }
    return false;
  }
  return {
    snapshot() { return { board, turn, moves, hist }; },
    tick(dt) { g.juice.update(dt); },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, "⚫ 五子棋", 88, 34, 20, "#cfe3c2");
      txt(ctx, winner ? (winner === 1 ? "⚫ 黑方胜！" : "⚪ 白方胜！") : `轮到 ${turn === 1 ? "⚫ 黑方" : "⚪ 白方"}`, g.W / 2, 66, 15, winner ? GOLD : "#cfe3c2");
      rr(ctx, PAD - 14, TOP - 14, (N - 1) * CELL + 28, (N - 1) * CELL + 28, 10);
      ctx.fillStyle = "#c9a86a"; ctx.fill();
      ctx.strokeStyle = "#6d5430"; ctx.lineWidth = 1.2;
      for (let i = 0; i < N; i++) {
        ctx.beginPath(); ctx.moveTo(PAD, TOP + i * CELL); ctx.lineTo(PAD + (N - 1) * CELL, TOP + i * CELL); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(PAD + i * CELL, TOP); ctx.lineTo(PAD + i * CELL, TOP + (N - 1) * CELL); ctx.stroke();
      }
      [[3, 3], [11, 3], [3, 11], [11, 11], [7, 7]].forEach(([x, y]) => { ctx.fillStyle = "#6d5430"; ctx.beginPath(); ctx.arc(PAD + x * CELL, TOP + y * CELL, 3.5, 0, 7); ctx.fill(); });
      board.forEach((row, y) => row.forEach((v, x) => {
        if (!v) return;
        const cx = PAD + x * CELL, cy = TOP + y * CELL;
        ctx.fillStyle = v === 1 ? "#22201c" : "#f2ecdc";
        ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.42, 0, 7); ctx.fill();
        ctx.fillStyle = v === 1 ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.12)";
        ctx.beginPath(); ctx.arc(cx - CELL * 0.12, cy - CELL * 0.14, CELL * 0.16, 0, 7); ctx.fill();
      }));
      const last = hist[hist.length - 1];
      if (last) { ctx.strokeStyle = BERRY; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(PAD + last[0] * CELL, TOP + last[1] * CELL, CELL * 0.3, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
      // 悔棋
      rr(ctx, g.W / 2 - 52, TOP + (N - 1) * CELL + 30, 104, 44, 22);
      ctx.fillStyle = "#2a4634"; ctx.fill();
      txt(ctx, "⟲ 悔棋", g.W / 2, TOP + (N - 1) * CELL + 52, 15, "#e9f2e4");
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t !== "down" || winner) return;
      const by0 = TOP + (N - 1) * CELL + 30;
      if (!winner && x > g.W / 2 - 52 && x < g.W / 2 + 52 && y > by0 && y < by0 + 44 && hist.length) {
        const [lx, ly] = hist.pop()!;
        board[ly][lx] = 0; turn = turn === 1 ? 2 : 1; moves--;
        g.sfx.click(); return;
      }
      const gx = Math.round((x - PAD) / CELL), gy = Math.round((y - TOP) / CELL);
      if (gx < 0 || gy < 0 || gx >= N || gy >= N || board[gy][gx]) return;
      board[gy][gx] = turn; hist.push([gx, gy]); moves++;
      g.sfx.place();
      g.juice.burst(PAD + gx * CELL, TOP + gy * CELL, turn === 1 ? "#8fae93" : "#f2ecdc", 6);
      if (checkWin(gx, gy, turn)) {
        winner = turn; g.sfx.win();
        const score = Math.max(600, 4200 - moves * 15);
        setTimeout(() => g.over(score), 1000);
      } else turn = turn === 1 ? 2 : 1;
    },
  };
}
