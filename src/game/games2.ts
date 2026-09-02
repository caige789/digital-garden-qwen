/* 游戏实现 · 第二辑：打砖块 / 冒险勇士 / 跑酷达人 / 赛车 */
import { GameCtx, GameHandle, rr, clamp } from "./engine";

const FONT = '"Noto Sans SC", sans-serif';
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center", bold = true) {
  ctx.fillStyle = color; ctx.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
}
const GOLD = "#efa32c", BERRY = "#d95d39", LEAF = "#3e8e52";

/* ============ 打砖块 ============ */
export function createBreakout(g: GameCtx): GameHandle {
  const PW = 100, PH = 14;
  let px = g.W / 2 - PW / 2, ball = { x: g.W / 2, y: g.H - 80, vx: 3.2 * g.mult, vy: -4.4 * g.mult, stuck: true };
  let lives = g.difficulty === "easy" ? 5 : 3, score = 0, level = 1, dead = false;
  let bricks = buildBricks();
  let keys = { left: false, right: false };
  function buildBricks() {
    const rows = Math.min(4 + level, 8), cols = 8, bw = (g.W - 40) / cols;
    const arr: { x: number; y: number; w: number; h: number; hp: number; color: string }[] = [];
    const colors = ["#d95d39", "#eda93a", "#f0c060", "#8fc176", "#5cc4b4", "#6f9fd8", "#b78ed9", "#e07a5f"];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const hp = level >= 3 && g.rnd(5) === 0 ? 2 : 1;
      arr.push({ x: 20 + c * bw + 3, y: 90 + r * 26, w: bw - 6, h: 20, hp, color: colors[r % colors.length] });
    }
    return arr;
  }
  function resetBall() {
    ball = { x: px + PW / 2, y: g.H - 80, vx: (3.2 + level * 0.25) * g.mult * (g.rnd(2) ? -1 : 1), vy: -(4.4 + level * 0.25) * g.mult, stuck: false };
    g.sfx.click();
  }
  function loseLife() {
    lives--; g.sfx.hit(); g.juice.shake(10);
    g.juice.burst(ball.x, g.H - 30, BERRY, 14);
    if (lives <= 0) { dead = true; g.sfx.over(); setTimeout(() => g.over(score), 700); }
    else ball.stuck = true;
  }
  return {
    currentScore() { return score; },
    tick(dt) {
      g.juice.update(dt);
      if (dead) return;
      const k = dt / 16.7;
      if (keys.left) px -= 7.5 * k; if (keys.right) px += 7.5 * k;
      px = clamp(px, 8, g.W - PW - 8);
      if (ball.stuck) { ball.x = px + PW / 2; ball.y = g.H - 60; return; }
      ball.x += ball.vx * k; ball.y += ball.vy * k;
      if (ball.x < 10 || ball.x > g.W - 10) { ball.vx *= -1; g.sfx.click(); }
      if (ball.y < 56) { ball.vy *= -1; g.sfx.click(); }
      if (ball.y > g.H - 26 && ball.y < g.H - 12 && ball.x > px - 8 && ball.x < px + PW + 8 && ball.vy > 0) {
        ball.vy = -Math.abs(ball.vy);
        ball.vx += ((ball.x - (px + PW / 2)) / (PW / 2)) * 2.2;
        g.sfx.click();
      }
      if (ball.y > g.H + 20) { loseLife(); return; }
      for (const b of bricks) {
        if (b.hp <= 0) continue;
        if (ball.x > b.x - 8 && ball.x < b.x + b.w + 8 && ball.y > b.y - 8 && ball.y < b.y + b.h + 8) {
          b.hp--;
          const gain = b.hp > 0 ? 20 : 50 * level;
          score += gain;
          g.sfx.score();
          g.juice.burst(b.x + b.w / 2, b.y + b.h / 2, b.color, b.hp > 0 ? 4 : 9);
          g.juice.float(b.x + b.w / 2, b.y, `+${gain}`, GOLD, 13);
          if (b.hp <= 0) g.juice.shake(2.5);
          const fromSide = Math.min(Math.abs(ball.x - b.x), Math.abs(ball.x - (b.x + b.w))) < Math.min(Math.abs(ball.y - b.y), Math.abs(ball.y - (b.y + b.h)));
          if (fromSide) ball.vx *= -1; else ball.vy *= -1;
          break;
        }
      }
      if (bricks.every((b) => b.hp <= 0)) {
        level++; score += 500; bricks = buildBricks(); ball.stuck = true;
        g.sfx.win(); g.juice.float(g.W / 2, g.H / 2, `第 ${level} 关！`, GOLD, 24);
      }
    },
    draw(ctx) {
      ctx.fillStyle = "#0f2015"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, `分数 ${score}`, 70, 30, 16, "#cfe3c2");
      txt(ctx, `第 ${level} 关`, g.W / 2, 30, 16, GOLD);
      txt(ctx, "❤".repeat(Math.max(0, lives)), g.W - 60, 30, 15, BERRY);
      for (const b of bricks) {
        if (b.hp <= 0) continue;
        rr(ctx, b.x, b.y, b.w, b.h, 6);
        ctx.fillStyle = b.hp > 1 ? "#8fae93" : b.color; ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, 4);
        if (b.hp > 1) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1; }
      }
      rr(ctx, px, g.H - 40, PW, PH, 7);
      ctx.fillStyle = "#e9f2e4"; ctx.fill();
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(ball.x, ball.y, 9, 0, 7); ctx.fill();
      if (ball.stuck && !dead) txt(ctx, "点击发射", g.W / 2, g.H / 2 + 60, 18, "#8fae93");
      if (dead) txt(ctx, "球用光了！", g.W / 2, g.H / 2, 28, "#f3f5ea");
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x) {
      if (t === "move" || t === "down") px = clamp(x - PW / 2, 8, g.W - PW - 8);
      if (t === "down" && ball.stuck) resetBall();
    },
    onKey(code, down) {
      if (code === "ArrowLeft" || code === "KeyA") keys.left = down;
      if (code === "ArrowRight" || code === "KeyD") keys.right = down;
      if (code === "Space" && down && ball.stuck) resetBall();
    },
  };
}

/* ============ 冒险勇士（土狼时间 + 跳跃缓冲 + 触屏按键） ============ */
export function createAdventure(g: GameCtx): GameHandle {
  const T = 36;
  const ROWS = Math.floor(g.H / T);
  const GROUND = ROWS - 2;
  const platforms: { x: number; y: number; w: number }[] = [];
  const enemies0: { x: number; y: number; w: number; dir: number; hp: number; kind: string }[] = [];
  const coins0: { x: number; y: number; taken: boolean }[] = [];
  const spikes: { x: number; y: number }[] = [];
  const worldW = 90 * T;
  (function build() {
    for (let x = 8; x < 86; x += 6 + g.rnd(4)) platforms.push({ x: x * T, y: (GROUND - 3 - g.rnd(3)) * T, w: (2 + g.rnd(3)) * T });
    for (let i = 0; i < 14; i++) {
      const kind = g.rnd(3) === 0 ? "fly" : "walk";
      enemies0.push({ x: (14 + i * 5.2) * T, y: kind === "fly" ? (GROUND - 2) * T : (GROUND + 1) * T - 30, w: T, dir: i % 2 ? 1 : -1, hp: 1, kind });
    }
    for (const p of platforms) { coins0.push({ x: p.x + p.w / 2, y: p.y - 26, taken: false }); if (g.rnd(2) === 0) coins0.push({ x: p.x + 14, y: p.y - 26, taken: false }); }
    for (let i = 0; i < 8; i++) spikes.push({ x: (18 + i * 9) * T, y: GROUND * T });
  })();
  let hero = { x: 2 * T, y: (GROUND - 1) * T, vx: 0, vy: 0, w: 26, h: 34, jumps: 0, onGround: false, face: 1 };
  let camX = 0, coins = 0, kills = 0, lives = g.difficulty === "easy" ? 5 : 3, dead = false, won = false, startT = Date.now(), overSent = false;
  let coyoteT = 0, jumpBuf = 0;
  let enemies = enemies0.map((e) => ({ ...e }));
  let coinList = coins0.map((c) => ({ ...c }));
  let keys = { left: false, right: false };
  let touchL = false, touchR = false, lId = -1, rId = -1;
  const FLAG_X = 88 * T;
  const btnL = { x: 14, y: g.H - 92, w: 64, h: 64 };
  const btnR = { x: 86, y: g.H - 92, w: 64, h: 64 };
  function respawn() { hero.x = Math.max(2 * T, camX + 60); hero.y = 0; hero.vy = 0; hero.jumps = 0; }
  function die() {
    lives--; g.sfx.hit(); g.juice.shake(10);
    g.juice.burst(hero.x + 13, hero.y + 17, BERRY, 14);
    if (lives <= 0) { dead = true; g.sfx.over(); if (!overSent) { overSent = true; setTimeout(() => g.over(coins * 30 + kills * 80), 800); } }
    else respawn();
  }
  function jump() {
    if (dead || won) return;
    if (hero.onGround || coyoteT > 0) {
      hero.vy = -11.5; hero.jumps = 1; coyoteT = 0; hero.onGround = false; g.sfx.jump();
      g.juice.burst(hero.x + 13, hero.y + 34, "#cfe3c2", 5);
    } else if (hero.jumps < 2) {
      hero.vy = -10; hero.jumps = 2; g.sfx.jump();
      g.juice.burst(hero.x + 13, hero.y + 34, "#8fd8e8", 7);
    } else jumpBuf = 130; // 落地前按跳 → 缓冲触发
  }
  function solidAt(x: number, y: number, w: number, h: number) {
    if (y + h > (GROUND + 1) * T) return true;
    for (const p of platforms) if (x + w > p.x && x < p.x + p.w && y + h > p.y && y < p.y + 12) return true;
    return false;
  }
  return {
    currentScore() { return Math.round(coins * 30 + kills * 80); },
    tick(dt) {
      g.juice.update(dt);
      if (dead || won) return;
      const k = dt / 16.7;
      coyoteT = Math.max(0, coyoteT - dt);
      jumpBuf = Math.max(0, jumpBuf - dt);
      const spd = 4.6 * k;
      if (keys.left || touchL) { hero.vx = -spd; hero.face = -1; }
      else if (keys.right || touchR) { hero.vx = spd; hero.face = 1; }
      else hero.vx = 0;
      hero.vy = Math.min(14, hero.vy + 0.55 * k);
      hero.x += hero.vx * k;
      hero.x = clamp(hero.x, camX - 20, worldW - 40);
      const prevY = hero.y;
      hero.y += hero.vy * k;
      hero.onGround = false;
      if (solidAt(hero.x, hero.y, hero.w, hero.h) && hero.vy >= 0 && prevY + hero.h <= (GROUND + 1) * T + 50) {
        let landY = (GROUND + 1) * T - hero.h;
        for (const p of platforms) if (hero.x + hero.w > p.x && hero.x < p.x + p.w && prevY + hero.h <= p.y + 46 && hero.y + hero.h >= p.y) landY = Math.min(landY, p.y - hero.h);
        hero.y = landY; hero.vy = 0; hero.jumps = 0; hero.onGround = true;
        if (jumpBuf > 0) { jumpBuf = 0; jump(); }
      }
      if (hero.onGround) coyoteT = 100; // 土狼时间
      camX = clamp(camX + ((hero.x - g.W * 0.38) - camX) * 0.12 * k, 0, worldW - g.W);
      enemies.forEach((e) => {
        if (e.hp <= 0) return;
        if (e.kind === "walk") { e.x += e.dir * 1.1 * g.mult * k; if (g.rnd(160) === 0) e.dir *= -1; }
        else e.y = (GROUND - 1) * T + Math.sin(Date.now() / 400 + e.x) * 30 - 40;
        const hit = hero.x + hero.w > e.x && hero.x < e.x + e.w && hero.y + hero.h > e.y && hero.y < e.y + 30;
        if (hit) {
          if (hero.vy > 1.5 && hero.y + hero.h < e.y + 22) {
            e.hp = 0; kills++; hero.vy = -8; g.sfx.score();
            g.juice.burst(e.x + e.w / 2, e.y + 15, "#a35d4a", 12);
            g.juice.float(e.x + e.w / 2, e.y, "+80", GOLD, 15);
            g.juice.shake(3);
          } else die();
        }
      });
      enemies = enemies.filter((e) => e.hp > 0);
      for (const s of spikes) if (hero.x + hero.w > s.x + 6 && hero.x < s.x + T - 6 && hero.y + hero.h > s.y + 12) { die(); break; }
      coinList.forEach((c) => {
        if (!c.taken && Math.hypot(c.x - (hero.x + 13), c.y - (hero.y + 17)) < 30) {
          c.taken = true; coins++; g.sfx.coin();
          g.juice.burst(c.x, c.y, GOLD, 7);
          g.juice.float(c.x, c.y - 14, "+30", GOLD, 13);
        }
      });
      if (hero.x > FLAG_X) {
        won = true; g.sfx.win();
        const sec = (Date.now() - startT) / 1000;
        const score = Math.round((coins * 30 + kills * 80 + Math.max(0, 3000 - sec * 12)) * (g.difficulty === "hard" ? 1.5 : g.difficulty === "easy" ? 0.7 : 1));
        if (!overSent) { overSent = true; setTimeout(() => g.over(score), 900); }
      }
      if (hero.y > g.H + 80) die();
    },
    draw(ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, g.H);
      sky.addColorStop(0, "#12301f"); sky.addColorStop(1, "#0f2015");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      ctx.save(); ctx.translate(-camX, 0);
      ctx.fillStyle = "rgba(62,107,72,.35)";
      for (let i = 0; i < 14; i++) { const mx = i * 320; ctx.beginPath(); ctx.moveTo(mx, (GROUND + 1) * T); ctx.lineTo(mx + 160, (GROUND - 5) * T); ctx.lineTo(mx + 320, (GROUND + 1) * T); ctx.fill(); }
      ctx.fillStyle = "#2c4a35"; ctx.fillRect(camX - 10, (GROUND + 1) * T, g.W + 20, g.H);
      ctx.fillStyle = "#3e6b48"; ctx.fillRect(camX - 10, (GROUND + 1) * T, g.W + 20, 8);
      ctx.fillStyle = "#5a4630";
      platforms.forEach((p) => { if (p.x > camX - 200 && p.x < camX + g.W + 200) { rr(ctx, p.x, p.y, p.w, 14, 5); ctx.fill(); ctx.fillStyle = "#6f9f5c"; ctx.fillRect(p.x, p.y, p.w, 5); ctx.fillStyle = "#5a4630"; } });
      spikes.forEach((s) => {
        if (s.x < camX - 100 || s.x > camX + g.W + 100) return;
        ctx.fillStyle = "#9fb3a5";
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(s.x + i * 12, s.y + T); ctx.lineTo(s.x + i * 12 + 6, s.y + 10); ctx.lineTo(s.x + i * 12 + 12, s.y + T); ctx.fill(); }
      });
      coinList.forEach((c) => {
        if (c.taken || c.x < camX - 60 || c.x > camX + g.W + 60) return;
        ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, 7); ctx.fill();
        ctx.fillStyle = "#8a5f14"; ctx.beginPath(); ctx.arc(c.x, c.y, 4, 0, 7); ctx.fill();
      });
      enemies.forEach((e) => {
        if (e.x < camX - 100 || e.x > camX + g.W + 100) return;
        ctx.fillStyle = e.kind === "fly" ? "#a35d8f" : "#a35d4a";
        rr(ctx, e.x, e.y, e.w, 30, 8); ctx.fill();
        txt(ctx, e.kind === "fly" ? "🦇" : "🍄", e.x + e.w / 2, e.y + 15, 20, "#000");
      });
      ctx.fillStyle = "#cfe3c2"; ctx.fillRect(FLAG_X + 10, (GROUND - 4) * T, 5, 5 * T);
      ctx.fillStyle = BERRY;
      ctx.beginPath(); ctx.moveTo(FLAG_X + 15, (GROUND - 4) * T); ctx.lineTo(FLAG_X + 60, (GROUND - 4) * T + 16); ctx.lineTo(FLAG_X + 15, (GROUND - 4) * T + 32); ctx.fill();
      if (!dead) {
        ctx.fillStyle = "#f0a52e"; rr(ctx, hero.x, hero.y, hero.w, hero.h, 8); ctx.fill();
        ctx.fillStyle = "#7a4a12"; rr(ctx, hero.x + 3, hero.y + 3, hero.w - 6, 12, 5); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(hero.x + (hero.face > 0 ? 18 : 8), hero.y + 19, 3.4, 0, 7); ctx.fill();
        ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(hero.x + (hero.face > 0 ? 19 : 9), hero.y + 19, 1.6, 0, 7); ctx.fill();
      }
      ctx.restore();
      // HUD
      ctx.fillStyle = "rgba(15,32,21,.7)"; rr(ctx, 10, 10, g.W - 20, 36, 18); ctx.fill();
      txt(ctx, `🪙 ${coins}`, 62, 28, 14, GOLD);
      txt(ctx, `⚔ ${kills}`, 130, 28, 14, "#cfe3c2");
      txt(ctx, "❤".repeat(Math.max(0, lives)), g.W / 2 + 20, 28, 13, BERRY);
      txt(ctx, `🏁 ${Math.min(99, Math.floor((hero.x / FLAG_X) * 100))}%`, g.W - 70, 28, 13, "#cfe3c2");
      // 触屏按键
      rr(ctx, btnL.x, btnL.y, btnL.w, btnL.h, 16);
      ctx.fillStyle = touchL ? "rgba(255,215,111,.5)" : "rgba(233,242,228,.16)"; ctx.fill();
      txt(ctx, "◀", btnL.x + 32, btnL.y + 34, 24, "#f3f5ea");
      rr(ctx, btnR.x, btnR.y, btnR.w, btnR.h, 16);
      ctx.fillStyle = touchR ? "rgba(255,215,111,.5)" : "rgba(233,242,228,.16)"; ctx.fill();
      txt(ctx, "▶", btnR.x + 32, btnR.y + 34, 24, "#f3f5ea");
      if (!dead && !won && hero.jumps < 2) txt(ctx, "点按空白处跳跃 ×2", g.W - 116, g.H - 22, 11, "rgba(233,242,228,.45)");
      if (dead) txt(ctx, "勇士倒下了…", g.W / 2, g.H / 2, 28, "#f3f5ea");
      if (won) txt(ctx, "🎉 抵达终点！", g.W / 2, g.H / 2, 30, GOLD);
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y, id) {
      const inL = x >= btnL.x && x <= btnL.x + btnL.w && y >= btnL.y && y <= btnL.y + btnL.h;
      const inR = x >= btnR.x && x <= btnR.x + btnR.w && y >= btnR.y && y <= btnR.y + btnR.h;
      if (t === "down") {
        if (inL) { lId = id ?? -1; touchL = true; }
        else if (inR) { rId = id ?? -2; touchR = true; }
        else jump();
      }
      if (t === "up") {
        if (id === undefined || id === lId) { touchL = false; lId = -1; }
        if (id === undefined || id === rId) { touchR = false; rId = -1; }
      }
    },
    onKey(code, down) {
      if (code === "ArrowLeft" || code === "KeyA") keys.left = down;
      if (code === "ArrowRight" || code === "KeyD") keys.right = down;
      if ((code === "ArrowUp" || code === "KeyW" || code === "Space") && down) jump();
    },
  };
}

/* ============ 跑酷达人 ============ */
export function createRunner(g: GameCtx): GameHandle {
  const GY = g.H - 90;
  let hero = { x: g.W * 0.24, y: GY, vy: 0, jumps: 0, sliding: 0 };
  let obs: { x: number; y: number; w: number; h: number; kind: string }[] = [];
  let coinsR: { x: number; y: number }[] = [];
  let power: { kind: string; x: number; y: number }[] = [];
  let effects: { kind: string; t: number }[] = [];
  let dist = 0, coinN = 0, dead = false, overSent = false, spawnT = 0, speed = 5 * g.mult;
  let downY = 0;
  function jump() {
    if (dead) return;
    if (hero.jumps < 2) { hero.vy = hero.jumps === 0 ? -13 : -11; hero.jumps++; g.sfx.jump(); g.juice.burst(hero.x, hero.y, "#cfe3c2", 4); }
  }
  function addEffect(kind: string) {
    effects = effects.filter((e) => e.kind !== kind);
    effects.push({ kind, t: kind === "shield" ? 8000 : 6000 });
    g.sfx.win();
    g.juice.float(hero.x, hero.y - 60, { magnet: "🧲 磁铁!", shield: "🛡 护盾!", double: "✖2 双倍!", slow: "⏳ 减速!" }[kind] ?? "", GOLD, 18);
  }
  return {
    currentScore() { return Math.round(dist * 10 + coinN * 25); },
    tick(dt) {
      g.juice.update(dt);
      if (dead) return;
      const k = dt / 16.7;
      speed += 0.0012 * dt * g.mult;
      dist += speed * k * 0.1;
      hero.vy += 0.62 * k; hero.y += hero.vy * k;
      if (hero.y >= GY) { hero.y = GY; hero.vy = 0; hero.jumps = 0; }
      hero.sliding = Math.max(0, hero.sliding - dt);
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = (900 + g.rnd(900)) / g.mult;
        const r = g.rnd(10);
        if (r < 4) obs.push({ x: g.W + 60, y: GY + 34, w: 30, h: 34 + g.rnd(26), kind: "rock" });
        else if (r < 6) obs.push({ x: g.W + 60, y: GY - 44, w: 70, h: 22, kind: "bar" });
        else if (r < 8) { for (let i = 0; i < 5; i++) coinsR.push({ x: g.W + 60 + i * 34, y: GY - (i === 2 ? 70 : 40) }); }
        else { const kinds = ["magnet", "shield", "double", "slow"]; power.push({ kind: kinds[g.rnd(4)], x: g.W + 60, y: GY - 60 - g.rnd(60) }); }
      }
      const has = (kk: string) => effects.some((e) => e.kind === kk);
      const spdK = has("slow") ? 0.55 : 1;
      obs.forEach((o) => (o.x -= speed * k * spdK));
      coinsR.forEach((c) => {
        c.x -= speed * k * spdK;
        if (has("magnet")) { const d = Math.hypot(c.x - hero.x, c.y - (hero.y - 16)); if (d < 160 && d > 1) { c.x += ((hero.x - c.x) / d) * 9 * k; c.y += ((hero.y - 16 - c.y) / d) * 9 * k; } }
      });
      power.forEach((p) => (p.x -= speed * k * spdK));
      obs = obs.filter((o) => o.x > -100);
      coinsR = coinsR.filter((c) => {
        if (Math.hypot(c.x - hero.x, c.y - (hero.y - 16)) < 28) { coinN += has("double") ? 2 : 1; g.sfx.coin(); g.juice.float(c.x, c.y - 12, has("double") ? "+2" : "+1", GOLD, 12); return false; }
        return c.x > -40;
      });
      power = power.filter((p) => { if (Math.hypot(p.x - hero.x, p.y - (hero.y - 16)) < 34) { addEffect(p.kind); return false; } return p.x > -40; });
      effects.forEach((e) => (e.t -= dt));
      effects = effects.filter((e) => e.t > 0);
      const hh = hero.sliding > 0 ? 22 : 44;
      for (const o of obs) {
        const hit = hero.x + 14 > o.x && hero.x - 14 < o.x + o.w && hero.y >= o.y - o.h && hero.y - hh <= o.y;
        if (hit) {
          if (has("shield")) { effects = effects.filter((e) => e.kind !== "shield"); obs = obs.filter((x) => x !== o); g.sfx.hit(); g.juice.shake(6); }
          else { dead = true; g.sfx.boom(); g.juice.shake(13); g.juice.burst(hero.x, hero.y - 20, BERRY, 18); if (!overSent) { overSent = true; setTimeout(() => g.over(Math.round(dist * 10 + coinN * 25)), 800); } }
          break;
        }
      }
    },
    draw(ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, g.H);
      sky.addColorStop(0, "#14291c"); sky.addColorStop(1, "#0f2015");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      ctx.fillStyle = "rgba(124,179,86,.1)";
      for (let i = 0; i < 5; i++) { const bx = g.W - ((dist * 6 + i * 220) % (g.W + 300)); ctx.beginPath(); ctx.arc(bx, GY - 120 - (i % 3) * 40, 26 + i * 6, 0, 7); ctx.fill(); }
      ctx.fillStyle = "#2c4a35"; ctx.fillRect(0, GY + 34, g.W, g.H);
      ctx.strokeStyle = "rgba(233,242,228,.25)"; ctx.setLineDash([26, 20]); ctx.lineDashOffset = dist * 30;
      ctx.beginPath(); ctx.moveTo(0, GY + 52); ctx.lineTo(g.W, GY + 52); ctx.stroke(); ctx.setLineDash([]);
      obs.forEach((o) => {
        if (o.kind === "rock") { ctx.fillStyle = "#7d6a55"; rr(ctx, o.x, o.y - o.h, o.w, o.h, 7); ctx.fill(); ctx.fillStyle = "#94805f"; rr(ctx, o.x + 4, o.y - o.h + 4, o.w - 8, 10, 5); ctx.fill(); }
        else { ctx.fillStyle = "#8f5f5f"; ctx.fillRect(o.x, o.y - o.h, o.w, o.h); ctx.fillStyle = "#f0c060"; for (let i = 0; i < 3; i++) ctx.fillRect(o.x + 8 + i * 22, o.y - o.h + 6, 12, 10); }
      });
      coinsR.forEach((c) => { ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, 7); ctx.fill(); });
      power.forEach((p) => {
        const icons: Record<string, string> = { magnet: "🧲", shield: "🛡", double: "✖2", slow: "⏳" };
        ctx.fillStyle = "rgba(95,197,180,.25)"; ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, 7); ctx.fill();
        txt(ctx, icons[p.kind], p.x, p.y, 17, "#cfe3c2");
      });
      const sliding = hero.sliding > 0;
      const shieldOn = effects.some((e) => e.kind === "shield");
      if (shieldOn) { ctx.strokeStyle = "rgba(95,197,180,.8)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hero.x, hero.y - 24, 36, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
      ctx.fillStyle = "#7cb356";
      if (sliding) rr(ctx, hero.x - 18, hero.y - 20, 36, 20, 9); else rr(ctx, hero.x - 13, hero.y - 44, 26, 44, 10);
      ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(hero.x + (sliding ? 8 : 4), hero.y - (sliding ? 12 : 34), 4, 0, 7); ctx.fill();
      ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(hero.x + (sliding ? 9 : 5), hero.y - (sliding ? 12 : 34), 1.8, 0, 7); ctx.fill();
      txt(ctx, `${Math.floor(dist)} m`, 70, 30, 18, "#cfe3c2");
      txt(ctx, `🪙 ${coinN}`, g.W - 70, 30, 15, GOLD);
      const icons: Record<string, string> = { magnet: "🧲", shield: "🛡", double: "✖2", slow: "⏳" };
      effects.forEach((e, i) => txt(ctx, icons[e.kind], g.W / 2 - 30 + i * 34, 30, 17, "#fff"));
      if (dead) txt(ctx, "💥 摔倒了！", g.W / 2, g.H / 2, 30, "#f3f5ea");
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t === "down") downY = y;
      if (t === "up") { if (y - downY > 40) { hero.sliding = 650; g.sfx.click(); } else jump(); }
      void x;
    },
    onKey(code, down) {
      if ((code === "Space" || code === "ArrowUp" || code === "KeyW") && down) jump();
      if ((code === "ArrowDown" || code === "KeyS") && down) hero.sliding = 650;
    },
  };
}

/* ============ 赛车 ============ */
export function createRace(g: GameCtx): GameHandle {
  const ROAD_L = g.W * 0.16, ROAD_R = g.W * 0.84, LANES = 4;
  const laneX = (i: number) => ROAD_L + ((i + 0.5) * (ROAD_R - ROAD_L)) / LANES;
  let car = { x: laneX(1.5), y: g.H - 150, lives: g.difficulty === "easy" ? 4 : 3, inv: 0 };
  let foes: { x: number; y: number; speed: number; color: string }[] = [];
  let coinsC: { x: number; y: number }[] = [];
  let dist = 0, coinN = 0, dead = false, overSent = false, spawnT = 0, speed = 6 * g.mult;
  let keys = { left: false, right: false, up: false };
  let dragging = false, dragX = 0;
  const CAR_COLORS = ["#d95d39", "#6f9fd8", "#b78ed9", "#e07a5f"];
  return {
    currentScore() { return Math.round(dist * 12 + coinN * 30); },
    tick(dt) {
      g.juice.update(dt);
      if (dead) return;
      const k = dt / 16.7;
      car.inv = Math.max(0, car.inv - dt);
      speed += 0.001 * dt * g.mult;
      if (keys.up) speed = Math.min(speed + 0.12 * k, 16);
      const steer = 5.4 * k;
      if (keys.left) car.x -= steer; if (keys.right) car.x += steer;
      if (dragging) car.x += (dragX - car.x) * 0.3 * k;
      car.x = clamp(car.x, ROAD_L + 24, ROAD_R - 24);
      dist += speed * k * 0.12;
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = Math.max(420, 1150 - dist * 2) / g.mult;
        foes.push({ x: laneX(g.rnd(LANES)) + (g.rnd(16) - 8), y: -80, speed: speed * (0.35 + g.rnd(30) / 100), color: CAR_COLORS[g.rnd(4)] });
        if (g.rnd(2) === 0) coinsC.push({ x: laneX(g.rnd(LANES)), y: -40 });
      }
      foes.forEach((f) => (f.y += (speed - f.speed) * k));
      foes = foes.filter((f) => {
        if (f.y > g.H + 100) return false;
        if (car.inv <= 0 && Math.abs(f.x - car.x) < 38 && Math.abs(f.y - car.y) < 58) {
          car.lives--; car.inv = 1600; g.sfx.hit(); g.juice.shake(11);
          g.juice.burst(car.x, car.y - 20, BERRY, 14);
          if (car.lives <= 0) { dead = true; g.sfx.boom(); if (!overSent) { overSent = true; setTimeout(() => g.over(Math.round(dist * 12 + coinN * 30)), 900); } }
          return false;
        }
        return true;
      });
      coinsC.forEach((c) => (c.y += speed * k));
      coinsC = coinsC.filter((c) => {
        if (Math.hypot(c.x - car.x, c.y - car.y) < 36) { coinN++; g.sfx.coin(); g.juice.float(c.x, c.y - 14, "+30", GOLD, 12); return false; }
        return c.y < g.H + 40;
      });
    },
    draw(ctx) {
      ctx.fillStyle = "#131f16"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      ctx.fillStyle = "#25382b"; ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, g.H);
      ctx.fillStyle = "#3e6b48"; ctx.fillRect(ROAD_L - 8, 0, 8, g.H); ctx.fillRect(ROAD_R, 0, 8, g.H);
      ctx.strokeStyle = "rgba(233,242,228,.5)"; ctx.lineWidth = 4; ctx.setLineDash([30, 34]);
      ctx.lineDashOffset = (dist * 60) % 64;
      for (let i = 1; i < LANES; i++) { const x = ROAD_L + (i * (ROAD_R - ROAD_L)) / LANES; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, g.H); ctx.stroke(); }
      ctx.setLineDash([]); ctx.lineWidth = 1;
      ctx.fillStyle = "#1c3626";
      for (let i = 0; i < 8; i++) { const ty = ((i * 130 + dist * 60) % (g.H + 80)) - 40; ctx.beginPath(); ctx.arc(ROAD_L - 34, ty, 16, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(ROAD_R + 34, ty + 60, 16, 0, 7); ctx.fill(); }
      coinsC.forEach((c) => { ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(c.x, c.y, 10, 0, 7); ctx.fill(); ctx.fillStyle = "#8a5f14"; ctx.beginPath(); ctx.arc(c.x, c.y, 4.5, 0, 7); ctx.fill(); });
      foes.forEach((f) => {
        ctx.fillStyle = f.color; rr(ctx, f.x - 20, f.y - 32, 40, 64, 10); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.75)"; rr(ctx, f.x - 14, f.y - 22, 28, 14, 5); ctx.fill();
        ctx.fillStyle = "#222"; ctx.fillRect(f.x - 22, f.y - 18, 5, 14); ctx.fillRect(f.x + 17, f.y - 18, 5, 14);
      });
      if (!dead) {
        const blink = car.inv > 0 && Date.now() % 200 < 100;
        if (!blink) {
          ctx.fillStyle = "#7cb356"; rr(ctx, car.x - 20, car.y - 32, 40, 64, 10); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,.8)"; rr(ctx, car.x - 14, car.y - 6, 28, 16, 5); ctx.fill();
          ctx.fillStyle = "#f0c060"; ctx.fillRect(car.x - 16, car.y - 32, 10, 6); ctx.fillRect(car.x + 6, car.y - 32, 10, 6);
          ctx.fillStyle = "#222";
          ctx.fillRect(car.x - 22, car.y - 20, 5, 14); ctx.fillRect(car.x + 17, car.y - 20, 5, 14);
          ctx.fillRect(car.x - 22, car.y + 8, 5, 14); ctx.fillRect(car.x + 17, car.y + 8, 5, 14);
        }
      }
      ctx.fillStyle = "rgba(15,32,21,.72)"; rr(ctx, 10, 10, g.W - 20, 40, 20); ctx.fill();
      txt(ctx, `${Math.floor(dist * 10) / 10} km`, 84, 30, 15, "#cfe3c2");
      txt(ctx, `🪙 ${coinN}`, g.W / 2, 30, 14, GOLD);
      txt(ctx, "❤".repeat(Math.max(0, car.lives)), g.W - 60, 30, 13, BERRY);
      txt(ctx, `⚡${Math.floor(speed * 18)} km/h`, g.W - 150, 30, 12, "#8fae93");
      if (dead) txt(ctx, "💥 撞车了！", g.W / 2, g.H / 2, 30, "#f3f5ea");
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x) {
      if (t === "down") { dragging = true; dragX = x; }
      if (t === "move" && dragging) dragX = x;
      if (t === "up") dragging = false;
    },
    onKey(code, down) {
      if (code === "ArrowLeft" || code === "KeyA") keys.left = down;
      if (code === "ArrowRight" || code === "KeyD") keys.right = down;
      if (code === "ArrowUp" || code === "KeyW") keys.up = down;
    },
  };
}
