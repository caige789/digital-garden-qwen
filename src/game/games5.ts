/* 游戏实现 · 第五辑：数独（保证唯一解）/ 猜诗 */
import { GameCtx, GameHandle, rr } from "./engine";

const FONT = '"Noto Sans SC", sans-serif';
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center", bold = true) {
  ctx.fillStyle = color; ctx.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
}
const GOLD = "#efa32c", BERRY = "#d95d39", LEAF = "#3e8e52";

/* ============ 数独 ============ */
export function createSudoku(g: GameCtx): GameHandle {
  const givens = g.difficulty === "easy" ? 42 : g.difficulty === "hard" ? 28 : 34;
  const { puzzle, solution } = genSudoku(givens);
  let grid = [...puzzle];
  const fixed = puzzle.map((v) => v !== 0);
  let sel = -1, mistakes = 0, startT = Date.now(), won = false, overFlag = false, msg = "";
  if (g.saved && Array.isArray(g.saved.grid) && g.saved.grid.length === 81) {
    grid = g.saved.grid; mistakes = g.saved.mistakes ?? 0; startT = Date.now() - (g.saved.elapsed ?? 0);
  }
  const OX = (g.W - 400) / 2, OY = 96, CELL = 400 / 9;

  function genSudoku(hints: number) {
    const grid9 = Array(81).fill(0);
    const ok = (i: number, v: number) => {
      const r = Math.floor(i / 9), c = i % 9;
      for (let k = 0; k < 9; k++) if (grid9[r * 9 + k] === v || grid9[k * 9 + c] === v) return false;
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (grid9[(br + a) * 9 + bc + b] === v) return false;
      return true;
    };
    const fill = (pos: number): boolean => {
      if (pos === 81) return true;
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      for (let i = nums.length - 1; i > 0; i--) { const j = g.rnd(i + 1); [nums[i], nums[j]] = [nums[j], nums[i]]; }
      for (const v of nums) if (ok(pos, v)) { grid9[pos] = v; if (fill(pos + 1)) return true; grid9[pos] = 0; }
      return false;
    };
    fill(0);
    const puz = [...grid9];
    const cells = Array.from({ length: 81 }, (_, i) => i);
    for (let i = cells.length - 1; i > 0; i--) { const j = g.rnd(i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    let left = 81;
    const countSolutions = (bd: number[], lim: number): number => {
      let n = 0;
      const valid = (pos: number, v: number) => {
        const r = Math.floor(pos / 9), c = pos % 9;
        for (let k = 0; k < 9; k++) if (bd[r * 9 + k] === v || bd[k * 9 + c] === v) return false;
        const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (bd[(br + a) * 9 + bc + b] === v) return false;
        return true;
      };
      const solve = (pos: number) => {
        if (n >= lim) return;
        if (pos === 81) { n++; return; }
        if (bd[pos]) { solve(pos + 1); return; }
        for (let v = 1; v <= 9; v++) if (valid(pos, v)) { bd[pos] = v; solve(pos + 1); bd[pos] = 0; if (n >= lim) return; }
      };
      solve(0);
      return n;
    };
    for (const i of cells) {
      if (left <= hints) break;
      const bak = puz[i]; puz[i] = 0;
      if (countSolutions([...puz], 2) !== 1) puz[i] = bak; else left--;
    }
    return { puzzle: puz, solution: grid9 };
  }
  function conflict(i: number): boolean {
    const v = grid[i];
    if (!v) return false;
    const r = Math.floor(i / 9), c = i % 9;
    for (let k = 0; k < 9; k++) {
      if (k !== c && grid[r * 9 + k] === v) return true;
      if (k !== r && grid[k * 9 + c] === v) return true;
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const j = (br + a) * 9 + bc + b;
      if (j !== i && grid[j] === v) return true;
    }
    return false;
  }
  function place(v: number) {
    if (sel < 0 || fixed[sel] || won) return;
    if (v === 0) { grid[sel] = 0; g.sfx.click(); return; }
    grid[sel] = v;
    if (v !== solution[sel]) { mistakes++; msg = "这一格和答案不一致"; g.sfx.hit(); }
    else { msg = ""; g.sfx.click(); g.juice.burst(OX + (sel % 9) * CELL + CELL / 2, OY + Math.floor(sel / 9) * CELL + CELL / 2, "#9fd878", 5); }
    if (grid.every((x, i) => x === solution[i])) {
      won = true; g.sfx.win(); g.juice.shake(6);
      const sec = (Date.now() - startT) / 1000;
      const score = Math.round(Math.max(1500, 16000 - sec * 10 - mistakes * 300) * (g.difficulty === "hard" ? 1.5 : g.difficulty === "easy" ? 0.6 : 1));
      if (!overFlag) { overFlag = true; setTimeout(() => g.over(score), 1000); }
    }
  }
  return {
    snapshot() { return { grid, mistakes, elapsed: Date.now() - startT }; },
    tick(dt) { g.juice.update(dt); },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, "🔢 数独", 78, 30, 21, "#cfe3c2");
      txt(ctx, `⏱ ${Math.floor((Date.now() - startT) / 1000)}s`, g.W / 2 + 30, 30, 14, "#8fae93");
      txt(ctx, `错 ${mistakes}`, g.W - 60, 30, 14, mistakes ? BERRY : "#8fae93");
      txt(ctx, msg || (won ? "🎉 完成！" : "点格子 → 点数字填入"), g.W / 2, 62, 13, msg ? GOLD : "#5f7a68");
      rr(ctx, OX - 6, OY - 6, 412, 412, 10); ctx.fillStyle = "#16301f"; ctx.fill();
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
        const i = r * 9 + c, px = OX + c * CELL, py = OY + r * CELL;
        if (i === sel) { ctx.fillStyle = "rgba(239,163,44,.3)"; ctx.fillRect(px, py, CELL, CELL); }
        else if (sel >= 0 && (Math.floor(sel / 9) === r || sel % 9 === c)) { ctx.fillStyle = "rgba(233,242,228,.05)"; ctx.fillRect(px, py, CELL, CELL); }
        const v = grid[i];
        if (v) txt(ctx, String(v), px + CELL / 2, py + CELL / 2 + 1, 21, fixed[i] ? "#cfe3c2" : conflict(i) ? BERRY : "#9fd878");
      }
      ctx.strokeStyle = "rgba(233,242,228,.18)";
      for (let k = 1; k < 9; k++) {
        ctx.beginPath(); ctx.moveTo(OX + k * CELL, OY); ctx.lineTo(OX + k * CELL, OY + 400); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(OX, OY + k * CELL); ctx.lineTo(OX + 400, OY + k * CELL); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(233,242,228,.55)"; ctx.lineWidth = 2;
      for (let k = 0; k <= 3; k++) {
        ctx.beginPath(); ctx.moveTo(OX + k * 3 * CELL, OY); ctx.lineTo(OX + k * 3 * CELL, OY + 400); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(OX, OY + k * 3 * CELL); ctx.lineTo(OX + 400, OY + k * 3 * CELL); ctx.stroke();
      }
      ctx.lineWidth = 1;
      const padY = 516, ph = 54, pw = (g.W - 40 - 4 * 8) / 5;
      for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
        const v = row === 0 ? col + 1 : col + 6;
        const label = col === 4 && row === 1 ? "⌫" : String(v);
        const x = 20 + col * (pw + 8), y = padY + row * (ph + 10);
        rr(ctx, x, y, pw, ph, 10);
        ctx.fillStyle = label === "⌫" ? "#5a3a30" : "#223c2a"; ctx.fill();
        txt(ctx, label, x + pw / 2, y + ph / 2, 20, "#e9f2e4");
      }
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t !== "down" || won) return;
      const padY = 516, ph = 54, pw = (g.W - 40 - 4 * 8) / 5;
      for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
        const px = 20 + col * (pw + 8), py = padY + row * (ph + 10);
        if (x >= px && x <= px + pw && y >= py && y <= py + ph) {
          place(row === 0 ? col + 1 : col === 4 ? 0 : col + 6);
          return;
        }
      }
      const c = Math.floor((x - OX) / CELL), r = Math.floor((y - OY) / CELL);
      if (c < 0 || r < 0 || c > 8 || r > 8) { sel = -1; return; }
      sel = r * 9 + c; g.sfx.click();
    },
    onKey(code) {
      if (code.startsWith("Digit")) place(Number(code.slice(5)));
      if (code === "Backspace") place(0);
    },
  };
}

/* ============ 猜诗 ============ */
const POEMS = [
  { line: "床前明月光", blank: "明月", title: "静夜思", author: "李白" },
  { line: "春眠不觉晓", blank: "不觉", title: "春晓", author: "孟浩然" },
  { line: "白日依山尽", blank: "依山", title: "登鹳雀楼", author: "王之涣" },
  { line: "锄禾日当午", blank: "日当", title: "悯农", author: "李绅" },
  { line: "离离原上草", blank: "原上", title: "赋得古原草送别", author: "白居易" },
  { line: "千山鸟飞绝", blank: "鸟飞", title: "江雪", author: "柳宗元" },
  { line: "日照香炉生紫烟", blank: "紫烟", title: "望庐山瀑布", author: "李白" },
  { line: "两个黄鹂鸣翠柳", blank: "翠柳", title: "绝句", author: "杜甫" },
  { line: "欲穷千里目", blank: "千里", title: "登鹳雀楼", author: "王之涣" },
  { line: "红豆生南国", blank: "南国", title: "相思", author: "王维" },
  { line: "海内存知己", blank: "知己", title: "送杜少府之任蜀州", author: "王勃" },
  { line: "春风吹又生", blank: "吹又", title: "赋得古原草送别", author: "白居易" },
  { line: "更上一层楼", blank: "一层", title: "登鹳雀楼", author: "王之涣" },
  { line: "处处闻啼鸟", blank: "啼鸟", title: "春晓", author: "孟浩然" },
  { line: "夜来风雨声", blank: "风雨", title: "春晓", author: "孟浩然" },
  { line: "花落知多少", blank: "多少", title: "春晓", author: "孟浩然" },
  { line: "黄河入海流", blank: "入海", title: "登鹳雀楼", author: "王之涣" },
  { line: "春风又绿江南岸", blank: "江南", title: "泊船瓜洲", author: "王安石" },
  { line: "飞流直下三千尺", blank: "三千", title: "望庐山瀑布", author: "李白" },
  { line: "每逢佳节倍思亲", blank: "思亲", title: "九月九日忆山东兄弟", author: "王维" },
  { line: "轻舟已过万重山", blank: "万重", title: "早发白帝城", author: "李白" },
  { line: "孤帆远影碧空尽", blank: "碧空", title: "黄鹤楼送孟浩然之广陵", author: "李白" },
];
const DISTRACT = "云深不知处雪月花天地山水风春秋江河湖海日星辰松竹兰菊酒剑梦家乡";

export function createGuessPoem(g: GameCtx): GameHandle {
  const ROUNDS = 10;
  const deck = [...POEMS];
  for (let i = deck.length - 1; i > 0; i--) { const j = g.rnd(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const rounds = deck.slice(0, ROUNDS);
  let round = 0, score = 0, combo = 0, filled = 0, wrong = 0, roundT = 30e3, revealT = 0, overFlag = false;
  type Tile = { ch: string; dead: boolean; isAns: boolean; order: number };
  let tiles: Tile[] = [];
  loadRound();
  function loadRound() {
    const p = rounds[round];
    const ans = p.blank.split("");
    const pool: string[] = [...ans];
    while (pool.length < 8) {
      const c = DISTRACT[g.rnd(DISTRACT.length)];
      if (!pool.includes(c)) pool.push(c);
    }
    for (let i = pool.length - 1; i > 0; i--) { const j = g.rnd(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    tiles = pool.map((ch) => ({ ch, dead: false, isAns: ans.includes(ch), order: ans.indexOf(ch) }));
    filled = 0; roundT = 30e3;
  }
  function finishRound(ok: boolean) {
    if (ok) {
      const gain = 300 + Math.floor(roundT / 1000) * 8 + combo * 60;
      score += gain; combo++;
      g.sfx.win();
      g.juice.float(g.W / 2, 200, `+${gain}`, GOLD, 22);
    } else { combo = 0; g.sfx.hit(); }
    revealT = 1600;
  }
  return {
    tick(dt) {
      g.juice.update(dt);
      if (revealT > 0) {
        revealT -= dt;
        if (revealT <= 0) {
          round++;
          if (round >= ROUNDS) {
            if (!overFlag) { overFlag = true; g.sfx.over(); setTimeout(() => g.over(Math.round(score * (g.difficulty === "hard" ? 1.3 : g.difficulty === "easy" ? 0.7 : 1))), 600); }
          } else loadRound();
        }
        return;
      }
      roundT -= dt;
      if (roundT <= 0) finishRound(false);
    },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      const p = rounds[Math.min(round, ROUNDS - 1)];
      txt(ctx, "📜 猜诗", 70, 30, 21, "#cfe3c2");
      txt(ctx, `${round + 1}/${ROUNDS}`, g.W / 2, 30, 14, "#8fae93");
      txt(ctx, `${score} 分`, g.W - 80, 30, 15, GOLD);
      if (combo > 1) txt(ctx, `🔥 连对 ×${combo}`, g.W - 80, 56, 13, BERRY);
      ctx.fillStyle = "rgba(233,242,228,.15)"; rr(ctx, 20, 72, g.W - 40, 7, 3.5); ctx.fill();
      ctx.fillStyle = roundT < 8e3 ? BERRY : LEAF; rr(ctx, 20, 72, (g.W - 40) * Math.max(0, roundT / 30e3), 7, 3.5); ctx.fill();
      // 诗句
      const chars = p.line.split("");
      const blankSet = p.blank.split("");
      const shown = chars.map((c) => (blankSet.includes(c) ? "＿" : c));
      const filledAns = tiles.filter((t) => t.dead && t.isAns).map((t) => t.ch);
      let bi = 0;
      const line = shown.map((c) => (c === "＿" && filledAns[bi] ? filledAns[bi++] : c)).join(" ");
      txt(ctx, line, g.W / 2, 150, chars.length > 6 ? 27 : 31, "#e9f2e4");
      txt(ctx, `—— ${p.author}《${p.title}》`, g.W / 2, 196, 14, "#8fae93");
      // 字块
      const TW = 74, TH = 74, cols = 4;
      tiles.forEach((t, i) => {
        const x = g.W / 2 - (cols * (TW + 12)) / 2 + (i % cols) * (TW + 12) + 6;
        const y = 250 + Math.floor(i / cols) * (TH + 12);
        rr(ctx, x, y, TW, TH, 12);
        ctx.fillStyle = t.dead ? "#152b1d" : t.isAns && revealT > 0 ? LEAF : "#223c2a";
        ctx.fill();
        ctx.strokeStyle = t.dead ? "rgba(233,242,228,.08)" : "rgba(233,242,228,.22)"; ctx.stroke();
        if (!t.dead) txt(ctx, t.ch, x + TW / 2, y + TH / 2 + 2, 30, "#e9f2e4");
      });
      if (revealT > 0) txt(ctx, filled >= p.blank.length ? "🎉 答对了！" : `正确答案：${p.blank}`, g.W / 2, g.H - 50, 18, filled >= p.blank.length ? GOLD : BERRY);
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t !== "down" || revealT > 0) return;
      const p = rounds[round];
      const TW = 74, TH = 74, cols = 4;
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        if (tile.dead) continue;
        const tx = g.W / 2 - (cols * (TW + 12)) / 2 + (i % cols) * (TW + 12) + 6;
        const ty = 250 + Math.floor(i / cols) * (TH + 12);
        if (x >= tx && x <= tx + TW && y >= ty && y <= ty + TH) {
          const expect = p.blank.split("")[filled];
          if (tile.ch === expect) {
            tile.dead = true; filled++;
            g.sfx.score();
            g.juice.burst(tx + TW / 2, ty + TH / 2, "#9fd878", 8);
            if (filled >= p.blank.length) finishRound(true);
          } else {
            wrong++; roundT = Math.max(1000, roundT - 5000);
            g.sfx.hit(); g.juice.shake(5);
            g.juice.float(tx + TW / 2, ty, "-5s", BERRY, 15);
          }
          return;
        }
      }
    },
  };
}
