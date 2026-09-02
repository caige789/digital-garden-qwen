/* 游戏实现 · 第四辑：合成大西瓜 / 1A2B 破译 / 灯光谜题 / 24 点（通勤轻游） */
import { GameCtx, GameHandle, rr, clamp } from "./engine";

const FONT = '"Noto Sans SC", sans-serif';
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center", bold = true) {
  ctx.fillStyle = color; ctx.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
}
const GOLD = "#efa32c", BERRY = "#d95d39", LEAF = "#3e8e52";

/* ============ 合成大西瓜 ============ */
export function createWatermelon(g: GameCtx): GameHandle {
  const LV = [
    { r: 15, e: "🍇", c: "#8f6ab8" }, { r: 20, e: "🍒", c: "#c94f4f" }, { r: 26, e: "🍊", c: "#e8933a" },
    { r: 32, e: "🍋", c: "#e8d23a" }, { r: 38, e: "🥝", c: "#8fb84f" }, { r: 44, e: "🍅", c: "#d95d39" },
    { r: 50, e: "🍑", c: "#e8a08a" }, { r: 57, e: "🍍", c: "#d9b23a" }, { r: 64, e: "🥥", c: "#8a6f52" },
    { r: 71, e: "🍈", c: "#9fd878" }, { r: 80, e: "🍉", c: "#5cb85c" },
  ];
  const L = 48, R = g.W - 48, FLOOR = g.H - 42, DANGER = 150;
  type B = { x: number; y: number; vx: number; vy: number; r: number; lv: number; cool: number; born: number };
  let balls: B[] = [];
  let aim = g.W / 2, current = g.rnd(5), next = g.rnd(5);
  let canDrop = true, score = 0, dead = false, overFlag = false, dangerT = 0;
  function drop() {
    if (!canDrop || dead) return;
    const lv = current;
    balls.push({ x: clamp(aim, L + LV[lv].r, R - LV[lv].r), y: 106, vx: 0, vy: 0, r: LV[lv].r, lv, cool: 0, born: Date.now() });
    current = next; next = g.rnd(5);
    canDrop = false; setTimeout(() => (canDrop = true), 420);
    g.sfx.place();
  }
  return {
    currentScore() { return score; },
    tick(dt) {
      g.juice.update(dt);
      if (dead) return;
      const k = dt / 16.7;
      for (const b of balls) { b.vy = Math.min(13, b.vy + 0.5 * k); b.x += b.vx * k; b.y += b.vy * k; b.cool = Math.max(0, b.cool - dt); }
      for (let it = 0; it < 3; it++) {
        for (const b of balls) {
          if (b.x - b.r < L) { b.x = L + b.r; b.vx *= -0.3; }
          if (b.x + b.r > R) { b.x = R - b.r; b.vx *= -0.3; }
          if (b.y + b.r > FLOOR) { b.y = FLOOR - b.r; b.vy *= -0.22; b.vx *= 0.95; if (Math.abs(b.vy) < 1) b.vy = 0; }
          if (b.y - b.r < 60 && b.vy < 0) { b.y = 60 + b.r; b.vy *= -0.3; }
        }
        for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], b2 = balls[j];
          if (a.lv < 0 || b2.lv < 0) continue;
          const dx = b2.x - a.x, dy = b2.y - a.y, dist = Math.hypot(dx, dy), min = a.r + b2.r;
          if (dist < min && dist > 0.01) {
            const nx = dx / dist, ny = dy / dist, push = (min - dist) / 2;
            a.x -= nx * push; a.y -= ny * push; b2.x += nx * push; b2.y += ny * push;
            const rel = (a.vx - b2.vx) * nx + (a.vy - b2.vy) * ny;
            if (rel > 0) { a.vx -= rel * 0.55 * nx; a.vy -= rel * 0.55 * ny; b2.vx += rel * 0.55 * nx; b2.vy += rel * 0.55 * ny; }
            if (a.lv === b2.lv && a.cool <= 0 && b2.cool <= 0) {
              if (a.lv < 10) {
                const nlv = a.lv + 1;
                a.lv = nlv; a.r = LV[nlv].r; a.x = (a.x + b2.x) / 2; a.y = (a.y + b2.y) / 2; a.vx *= 0.2; a.vy = -2.5; a.cool = 220;
                b2.lv = -1;
                const gain = (nlv + 1) * (nlv + 1) * 2;
                score += gain;
                g.sfx.score(); if (nlv >= 8) g.sfx.win();
                g.juice.shake(Math.min(8, nlv));
                g.juice.burst(a.x, a.y, LV[nlv].c, 12);
                g.juice.float(a.x, a.y - a.r, `+${gain} ${LV[nlv].e}`, GOLD, nlv >= 8 ? 20 : 15);
              } else {
                score += 800; a.lv = -1; b2.lv = -1;
                g.sfx.win(); g.juice.shake(10);
                g.juice.float((a.x + b2.x) / 2, a.y - 40, "+800 双瓜合一!", GOLD, 20);
              }
            }
          }
        }
        balls = balls.filter((b) => b.lv >= 0);
      }
      const risky = balls.filter((b) => Date.now() - b.born > 1100 && Math.abs(b.vy) < 1.2);
      const above = risky.some((b) => b.y - b.r < DANGER);
      if (above) { dangerT += dt; if (dangerT > 1500 && !dead) { dead = true; g.sfx.over(); if (!overFlag) { overFlag = true; setTimeout(() => g.over(score), 900); } } }
      else dangerT = 0;
    },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      rr(ctx, L - 10, 70, R - L + 20, FLOOR - 62, 18);
      ctx.strokeStyle = "rgba(233,242,228,.35)"; ctx.lineWidth = 3; ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(233,242,228,.04)"; ctx.fill();
      ctx.strokeStyle = dangerT > 0 ? BERRY : "rgba(217,93,57,.45)"; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(L, DANGER); ctx.lineTo(R, DANGER); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, "危险线", R - 34, DANGER - 14, 11, "rgba(217,93,57,.8)");
      if (!dead && canDrop) {
        ctx.strokeStyle = "rgba(233,242,228,.25)"; ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.moveTo(aim, 120); ctx.lineTo(aim, FLOOR); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 0.85;
        txt(ctx, LV[current].e, aim, 106, LV[current].r * 1.5, "#000");
        ctx.globalAlpha = 1;
      }
      txt(ctx, "下一个", g.W - 58, 30, 12, "#8fae93");
      txt(ctx, LV[next].e, g.W - 58, 56, LV[next].r * 1.2, "#000");
      balls.forEach((b) => {
        ctx.fillStyle = LV[b.lv].c + "55";
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
        txt(ctx, LV[b.lv].e, b.x, b.y + 1, b.r * 1.45, "#000");
      });
      txt(ctx, "🍉 合成大西瓜", 100, 30, 18, "#cfe3c2");
      txt(ctx, `${score}`, 100, 58, 20, GOLD);
      if (dead) txt(ctx, "🍉 堆过头了！", g.W / 2, g.H / 2, 28, "#f3f5ea");
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x) {
      const r = LV[current].r;
      if (t === "down" || t === "move") aim = clamp(x, L + r, R - r);
      if (t === "up") drop();
    },
  };
}

/* ============ 1A2B 数字破译 ============ */
export function createOneATwoB(g: GameCtx): GameHandle {
  let secret = newSecret();
  let input: number[] = [], history: { guess: number[]; a: number; b: number }[] = [];
  let tries = 0, solved = false, failed = false, startT = Date.now(), msg = "猜一个 4 位不重复数字", overFlag = false;
  const MAX = 10;
  function newSecret() {
    const d = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = d.length - 1; i > 0; i--) { const j = g.rnd(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
    return d.slice(0, 4);
  }
  function submit() {
    if (solved || failed) return;
    if (input.length < 4) { msg = "先输满 4 位数字"; g.sfx.hit(); return; }
    let a = 0, b = 0;
    input.forEach((v, i) => { if (v === secret[i]) a++; else if (secret.includes(v)) b++; });
    tries++; history.unshift({ guess: [...input], a, b }); input = [];
    if (a === 4) {
      solved = true; g.sfx.win(); g.juice.shake(6);
      msg = `🎉 ${tries} 次破译成功！`;
      const sec = (Date.now() - startT) / 1000;
      const score = Math.round(Math.max(1200, 6600 - tries * 420 - sec * 4) * (g.difficulty === "hard" ? 1.5 : g.difficulty === "easy" ? 0.6 : 1));
      if (!overFlag) { overFlag = true; setTimeout(() => g.over(score), 1000); }
    } else if (tries >= MAX) {
      failed = true; g.sfx.over(); msg = `💥 机会用完，密码是 ${secret.join("")}`;
      const score = Math.round(history.reduce((s, h) => s + h.a * 120 + h.b * 40, 0));
      if (!overFlag) { overFlag = true; setTimeout(() => g.over(score), 1200); }
    } else {
      msg = `${a}A${b}B · 还剩 ${MAX - tries} 次`;
      g.sfx.click();
      if (a >= 2) g.juice.float(g.W / 2, 300, `${a}A${b}B 接近了!`, GOLD, 18);
    }
  }
  const PADX = 24, KY = 434, KH = 58, GAP = 9;
  const bw = (g.W - PADX * 2 - GAP * 4) / 5;
  function hitKey(x: number, y: number): string | null {
    if (y < KY || y > KY + KH * 3 + GAP * 2) return null;
    const col = Math.floor((x - PADX) / (bw + GAP));
    if (col < 0 || col > 4) return null;
    if (x - PADX - col * (bw + GAP) > bw) return null;
    const row = Math.floor((y - KY) / (KH + GAP));
    if (y - KY - row * (KH + GAP) > KH) return null;
    const labels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];
    return labels[row * 4 + col] ?? null;
  }
  return {
    tick(dt) { g.juice.update(dt); },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, "🔐 1A2B 破译", 106, 30, 19, "#cfe3c2");
      txt(ctx, `第 ${tries}/${MAX} 次`, g.W - 80, 30, 13, "#8fae93");
      // 输入槽
      for (let i = 0; i < 4; i++) {
        const x = g.W / 2 - 118 + i * 62;
        rr(ctx, x, 58, 54, 54, 10);
        ctx.fillStyle = "#1c3626"; ctx.fill();
        ctx.strokeStyle = i === input.length ? GOLD : "rgba(233,242,228,.2)"; ctx.stroke();
        if (input[i] !== undefined) txt(ctx, String(input[i]), x + 27, 86, 26, "#e9f2e4");
      }
      txt(ctx, msg, g.W / 2, 132, 14, solved || msg.includes("接近") ? GOLD : failed ? BERRY : "#cfe3c2");
      // 历史
      history.slice(0, 5).forEach((h, i) => {
        const y = 162 + i * 44;
        ctx.globalAlpha = 1 - i * 0.15;
        rr(ctx, g.W / 2 - 130, y, 180, 38, 9);
        ctx.fillStyle = "#152b1d"; ctx.fill();
        txt(ctx, h.guess.join(" "), g.W / 2 - 40, y + 19, 18, "#e9f2e4");
        txt(ctx, `${h.a}A${h.b}B`, g.W / 2 + 105, y + 19, 16, h.a >= 2 ? GOLD : "#8fae93");
        ctx.globalAlpha = 1;
      });
      // 键盘
      const labels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];
      for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
        const x = PADX + col * (bw + GAP), y = KY + row * (KH + GAP);
        const label = labels[row * 4 + col];
        rr(ctx, x, y, bw, KH, 10);
        ctx.fillStyle = label === "✓" ? LEAF : label === "⌫" ? "#5a3a30" : "#223c2a";
        ctx.fill();
        txt(ctx, label, x + bw / 2, y + KH / 2, 20, "#e9f2e4");
      }
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t !== "down" || solved || failed) return;
      const key = hitKey(x, y);
      if (!key) return;
      if (key === "⌫") { input.pop(); g.sfx.click(); }
      else if (key === "✓") submit();
      else if (input.length < 4) {
        const n = Number(key);
        if (input.includes(n)) { msg = "数字不能重复"; g.sfx.hit(); return; }
        input.push(n); g.sfx.click();
      }
    },
    onKey(code) {
      if (code.startsWith("Digit")) {
        const n = Number(code.slice(5));
        if (!input.includes(n) && input.length < 4) input.push(n);
      }
      if (code === "Backspace") input.pop();
      if (code === "Enter" || code === "Space") submit();
    },
  };
}

/* ============ 灯光谜题 ============ */
export function createLightsOut(g: GameCtx): GameHandle {
  const n = g.difficulty === "easy" ? 4 : g.difficulty === "hard" ? 6 : 5;
  const PAD = 30, TOP = 120;
  const CELL = (g.W - PAD * 2) / n;
  let grid: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  // 从全灭开始随机按若干次，保证可解
  const presses = g.difficulty === "easy" ? 4 : g.difficulty === "hard" ? 9 : 6;
  const fromSave = g.saved && Array.isArray(g.saved.grid) && g.saved.grid.length === n;
  if (!fromSave) for (let i = 0; i < presses; i++) toggleRaw(g.rnd(n), g.rnd(n));
  let moves = 0, won = false, overFlag = false, startT = Date.now();
  if (fromSave) { grid = g.saved.grid.map((r: boolean[]) => r.map(Boolean)); moves = g.saved.moves ?? 0; startT = Date.now() - (g.saved.elapsed ?? 0); }
  function toggleRaw(x: number, y: number) {
    const flip = (xx: number, yy: number) => { if (xx >= 0 && yy >= 0 && xx < n && yy < n) grid[yy][xx] = !grid[yy][xx]; };
    flip(x, y); flip(x + 1, y); flip(x - 1, y); flip(x, y + 1); flip(x, y - 1);
  }
  function toggle(x: number, y: number) {
    if (won) return;
    toggleRaw(x, y); moves++; g.sfx.click();
    g.juice.burst(PAD + x * CELL + CELL / 2, TOP + y * CELL + CELL / 2, "#f0c060", 6);
    if (grid.every((r) => r.every((v) => !v))) {
      won = true; g.sfx.win(); g.juice.shake(6);
      const sec = (Date.now() - startT) / 1000;
      const score = Math.max(500, Math.round(n * n * 220 - moves * 35 - sec * 8) * (g.difficulty === "hard" ? 1.5 : g.difficulty === "easy" ? 0.6 : 1));
      if (!overFlag) { overFlag = true; setTimeout(() => g.over(score), 900); }
    }
  }
  return {
    snapshot() { return { grid, moves, elapsed: Date.now() - startT }; },
    tick(dt) { g.juice.update(dt); },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, "💡 灯光谜题", 106, 34, 20, "#cfe3c2");
      txt(ctx, `步数 ${moves}`, g.W - 80, 34, 14, "#8fae93");
      txt(ctx, "把灯全部熄灭", g.W / 2, 76, 14, "#8fae93");
      grid.forEach((row, y) => row.forEach((on, x) => {
        const px = PAD + x * CELL, py = TOP + y * CELL;
        rr(ctx, px + 4, py + 4, CELL - 8, CELL - 8, 10);
        ctx.fillStyle = on ? "#f0c060" : "#1c3626";
        ctx.fill();
        if (on) { ctx.fillStyle = "rgba(240,192,96,.25)"; ctx.beginPath(); ctx.arc(px + CELL / 2, py + CELL / 2, CELL * 0.62, 0, 7); ctx.fill(); }
        ctx.strokeStyle = on ? "#ffd76f" : "rgba(233,242,228,.18)"; ctx.stroke();
      }));
      if (won) txt(ctx, "🌑 全部熄灭！", g.W / 2, g.H - 40, 24, GOLD);
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t !== "down" || won) return;
      const cx = Math.floor((x - PAD) / CELL), cy = Math.floor((y - TOP) / CELL);
      if (cx < 0 || cy < 0 || cx >= n || cy >= n) return;
      toggle(cx, cy);
    },
  };
}

/* ============ 24 点（生成与判解规则一致：从左到右） ============ */
export function createCalc24(g: GameCtx): GameHandle {
  const OPS = ["+", "−", "×", "÷"];
  let hand = newHand(), seq: (number | string)[] = [], used = [false, false, false, false];
  let score = 0, streak = 0, sessionT = 180e3, handT = 75e3, msg = "用 4 张牌按顺序凑出 24", hintT = 0, lock = false, overFlag = false;
  const apply = (a: number, op: string, b: number) => (op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : b === 0 ? NaN : a / b);
  // 从左到右求解（与玩家输入规则完全一致，保证每副牌有解）
  function solve24(nums: number[]): string | null {
    const perms: number[][] = [];
    const rec = (arr: number[], cur: number[]) => { if (!arr.length) { perms.push(cur); return; } arr.forEach((v, i) => rec(arr.filter((_, j) => j !== i), [...cur, v])); };
    rec([0, 1, 2, 3], []);
    for (const p of perms) for (const o1 of OPS) for (const o2 of OPS) for (const o3 of OPS) {
      const [a, b, c, d] = p.map((i) => nums[i]);
      if (Math.abs(apply(apply(apply(a, o1, b), o2, c), o3, d) - 24) < 1e-9) return `${a} ${o1} ${b} ${o2} ${c} ${o3} ${d} = 24`;
    }
    return null;
  }
  function newHand() {
    for (let i = 0; i < 200; i++) {
      const h = [0, 1, 2, 3].map(() => 1 + g.rnd(13));
      if (solve24(h)) return h;
    }
    return [3, 3, 8, 8];
  }
  function evalSeq(): number {
    let v = seq[0] as number;
    for (let i = 1; i < seq.length; i += 2) v = apply(v, seq[i] as string, seq[i + 1] as number);
    return v;
  }
  function nextRound(gain: number, note: string) {
    score += gain; msg = note; hand = newHand(); seq = []; used = [false, false, false, false]; handT = 75e3; lock = true;
    setTimeout(() => (lock = false), 700);
  }
  const cardW = 104, cardH = 96, cardY = 108;
  const cardX = (i: number) => 18 + i * (cardW + 12);
  const RANK = (v: number) => (v === 1 ? "A" : v === 11 ? "J" : v === 12 ? "Q" : v === 13 ? "K" : String(v));
  return {
    currentScore() { return score; },
    tick(dt) {
      g.juice.update(dt);
      if (overFlag) return;
      sessionT -= dt; handT -= dt; hintT = Math.max(0, hintT - dt);
      if (handT <= 0) { streak = 0; nextRound(0, "⏰ 超时，换一题"); }
      if (sessionT <= 0) { overFlag = true; g.sfx.over(); g.over(Math.max(0, Math.round(score * (g.difficulty === "hard" ? 1.4 : g.difficulty === "easy" ? 0.7 : 1)))); }
    },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, "🧮 24 点", 80, 30, 21, "#cfe3c2");
      txt(ctx, `${score} 分`, g.W / 2 + 20, 30, 17, GOLD);
      txt(ctx, `🔥×${streak}`, g.W - 62, 30, 15, streak ? BERRY : "#5f7a68");
      ctx.fillStyle = "rgba(233,242,228,.15)"; rr(ctx, 20, 56, g.W - 40, 8, 4); ctx.fill();
      ctx.fillStyle = LEAF; rr(ctx, 20, 56, (g.W - 40) * Math.max(0, sessionT / 180e3), 8, 4); ctx.fill();
      txt(ctx, `本局剩 ${Math.ceil(Math.max(0, handT) / 1000)}s · 总时 ${Math.ceil(Math.max(0, sessionT) / 1000)}s`, g.W / 2, 80, 12, "#8fae93");
      hand.forEach((v, i) => {
        rr(ctx, cardX(i), cardY, cardW, cardH, 12);
        ctx.fillStyle = used[i] ? "#182b1e" : "#e9f2e4";
        ctx.fill();
        ctx.strokeStyle = used[i] ? "rgba(233,242,228,.1)" : "rgba(30,51,37,.4)"; ctx.stroke();
        txt(ctx, RANK(v), cardX(i) + cardW / 2, cardY + cardH / 2, 30, used[i] ? "#3d5445" : v > 10 || v === 1 ? "#b03030" : "#1e3325");
      });
      const expr = seq.length ? seq.map((s) => (typeof s === "number" ? RANK(s) : s)).join(" ") : "点上面的牌开始列式";
      txt(ctx, expr, g.W / 2, 250, seq.length ? 27 : 15, seq.length ? "#e9f2e4" : "#5f7a68");
      if (seq.length >= 7) {
        const v = evalSeq();
        const okV = Math.abs(v - 24) < 1e-6;
        txt(ctx, `= ${Math.round(v * 100) / 100}`, g.W / 2 + 110, 250, 22, okV ? LEAF : BERRY);
      }
      txt(ctx, msg, g.W / 2, 292, 14, hintT > 0 ? GOLD : "#cfe3c2");
      OPS.forEach((op, i) => {
        const x = 18 + i * 116, y = 330;
        rr(ctx, x, y, 104, 62, 12); ctx.fillStyle = "#223c2a"; ctx.fill();
        txt(ctx, op, x + 52, y + 31, 26, "#e9f2e4");
      });
      const fns = [["⌫", 0], ["💡 提示", 1], ["换一题", 2]] as [string, number][];
      fns.forEach(([label, i]) => {
        const x = 18 + i * 152, y = 410, w = 140;
        rr(ctx, x, y, w, 56, 12); ctx.fillStyle = i === 0 ? "#5a3a30" : "#223c2a"; ctx.fill();
        txt(ctx, label, x + w / 2, y + 28, 16, "#e9f2e4");
      });
      txt(ctx, "规则：从左到右顺序计算（无优先级），用满 4 张牌凑出 24", g.W / 2, 500, 12, "#5f7a68");
      txt(ctx, "连对加成：+1000 + 连击×150", g.W / 2, 524, 12, "#5f7a68");
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t !== "down" || lock || overFlag) return;
      for (let i = 0; i < 4; i++) {
        if (!used[i] && x >= cardX(i) && x <= cardX(i) + cardW && y >= cardY && y <= cardY + cardH) {
          if (seq.length % 2 === 1) { msg = "先选运算符"; g.sfx.hit(); return; }
          seq.push(hand[i]); used[i] = true; g.sfx.click();
          if (seq.length === 7) {
            const v = evalSeq();
            if (Math.abs(v - 24) < 1e-6) {
              const gain = 1000 + streak * 150;
              g.sfx.win(); g.juice.shake(5); streak++;
              g.juice.float(g.W / 2, 220, `+${gain}`, GOLD, 24);
              nextRound(gain, `🎉 = 24！+${gain}`);
            } else msg = `= ${Math.round(v * 100) / 100}，不是 24，点 ⌫ 调整`;
          }
          return;
        }
      }
      for (let i = 0; i < 4; i++) {
        if (x >= 18 + i * 116 && x <= 122 + i * 116 && y >= 330 && y <= 392) {
          if (seq.length === 0 || seq.length % 2 === 0) { msg = "先选一张牌"; g.sfx.hit(); return; }
          seq.push(OPS[i]); g.sfx.click(); return;
        }
      }
      if (y >= 410 && y <= 466) {
        const i = Math.floor((x - 18) / 152);
        if (x - 18 - i * 152 > 140 || i < 0 || i > 2) return;
        if (i === 0) {
          const last = seq.pop();
          if (last !== undefined && typeof last === "number") { const idx = hand.lastIndexOf(last); if (idx >= 0) used[idx] = false; }
          g.sfx.click();
        } else if (i === 1) {
          const h = solve24(hand);
          if (h) { msg = `💡 ${h}`; hintT = 5000; score = Math.max(0, score - 300); streak = 0; }
          g.sfx.score();
        } else { streak = 0; score = Math.max(0, score - 100); nextRound(0, "换了一题"); g.sfx.click(); }
      }
    },
  };
}
