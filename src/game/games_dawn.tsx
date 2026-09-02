/* 黎明前 20 分钟（网页版）：黑暗恐惧割草 —— 灯光照不到的地方，怪看不见也打不着 */
import { GameCtx, GameHandle, rr } from "./engine";

const FONT = '"Noto Sans SC", sans-serif';
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center", bold = true) {
  ctx.fillStyle = color; ctx.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
}
const GOLD = "#f0c060", BERRY = "#d95d39", ICE = "#8fd8e8";

interface Enemy { x: number; y: number; hp: number; maxHp: number; spd: number; r: number; kind: number; xp: number; t: number; hitCd: number; flash: number; boss: boolean }
interface Gem { x: number; y: number; v: number }
interface Proj { x: number; y: number; vx: number; vy: number; dmg: number; pierce: number; life: number }
interface Float { x: number; y: number; s: string; c: string; t: number }

export function createDawn(g: GameCtx): GameHandle {
  const DAY = 30000; // 现实 30 秒 = 游戏内 1 分钟，共 20 分钟
  const M = g.mult;
  let player = { x: g.W / 2, y: g.H / 2, hp: 100, maxHp: 100, spd: 2.7, magnet: 70, face: 1, lightR: 150, dmg: 10, rate: 500, multi: 1, pierce: 0, level: 1, xp: 0, xpNext: 8, kills: 0, t: 0, hitT: 0 };
  let enemies: Enemy[] = [], gems: Gem[] = [], projs: Proj[] = [], floats: Float[] = [];
  let shake = 0, freeze = 0, shootT = 0, spawnT = 0, hurtCd = 0, dead = false, overSent = false, won = false;
  let choices: string[] = [];
  let keys = { l: false, r: false, u: false, d: false };
  let joy = { on: false, ox: 0, oy: 0, dx: 0, dy: 0, id: -1 };

  const inLight = (x: number, y: number) => Math.hypot(x - player.x, y - player.y) < player.lightR;
  const gameMin = () => Math.floor(player.t / DAY) + 1;

  function addFloat(x: number, y: number, s: string, c: string) { floats.push({ x, y, s, c, t: 700 }); }
  function burst(x: number, y: number, c: string, n: number) { g.juice.burst(x, y, c, n); }

  function spawnOne(boss = false) {
    if (enemies.length > 110) return;
    const ang = Math.random() * Math.PI * 2, dist = 460 + Math.random() * 120;
    const x = player.x + Math.cos(ang) * dist, y = player.y + Math.sin(ang) * dist;
    if (boss) {
      const hp = 900 * gameMin() * M;
      enemies.push({ x, y, hp, maxHp: hp, spd: 0.5, r: 40, kind: 4, xp: 40, t: 0, hitCd: 0, flash: 0, boss: true });
      addFloat(player.x, player.y - 60, "☠ 梦魇苏醒!", BERRY);
      g.sfx.tone(100, 0.5, "sawtooth", 0.16, -30);
      return;
    }
    const min = gameMin();
    const avail = min >= 12 ? 4 : min >= 6 ? 3 : min >= 3 ? 2 : 1;
    const kind = g.rnd(avail);
    const def = [{ hp: 18, spd: 1.15, r: 13, xp: 1 }, { hp: 12, spd: 2.3, r: 10, xp: 1 }, { hp: 60, spd: 0.8, r: 17, xp: 3 }, { hp: 35, spd: 1.7, r: 14, xp: 2 }][kind];
    const hp = def.hp * (1 + min * 0.4) * M;
    enemies.push({ x, y, hp, maxHp: hp, spd: def.spd, r: def.r, kind, xp: def.xp, t: Math.random() * 999, hitCd: 0, flash: 0, boss: false });
  }

  function damageEnemy(e: Enemy, raw: number) {
    if (!inLight(e.x, e.y)) return; // 黑暗中的怪打不着
    e.hp -= raw; e.flash = 100;
    addFloat(e.x, e.y - e.r, String(Math.round(raw)), e.boss ? GOLD : "#fff");
    if (e.hp <= 0) {
      player.kills++;
      freeze = e.boss ? 120 : 26;
      shake = Math.min(6, shake + (e.boss ? 6 : 1.5));
      burst(e.x, e.y, ["#6fae5a", "#9a7ac4", "#cfc9b8", "#c98f4f", "#4a2a4a"][e.kind], e.boss ? 30 : 8);
      g.sfx.score();
      gems.push({ x: e.x, y: e.y, v: e.xp });
    }
  }

  const UP_INFO: Record<string, [string, string]> = {
    light: ["🔦 强光", "灯光半径 +35（照得更远）"],
    dmg: ["⚔ 利刃", "子弹伤害 +40%"],
    rate: ["⏩ 速射", "射击间隔 -12%"],
    multi: ["🌠 多重", "子弹数 +1"],
    pierce: ["🗡 贯穿", "子弹穿透 +1"],
    spd: ["👟 疾行", "移动速度 +10%"],
    magnet: ["🧲 磁力", "经验吸取范围 +40"],
    hp: ["❤ 强壮", "生命上限 +30 并回满 30"],
    heal: ["🍖 饱餐", "立刻回复 40% 生命"],
  };
  function gainXp(v: number) {
    player.xp += v;
    while (player.xp >= player.xpNext) {
      player.xp -= player.xpNext; player.level++; player.xpNext = 6 + player.level * 4;
      const pool = ["light", "light", "dmg", "dmg", "rate", "rate", "multi", "pierce", "spd", "magnet", "hp", "heal"];
      choices = [];
      while (choices.length < 3 && pool.length) choices.push(pool.splice(g.rnd(pool.length), 1)[0]);
      g.sfx.win();
    }
  }
  function applyUpgrade(k: string) {
    if (k === "light") player.lightR += 35;
    if (k === "dmg") player.dmg *= 1.4;
    if (k === "rate") player.rate = Math.max(120, player.rate * 0.88);
    if (k === "multi") player.multi++;
    if (k === "pierce") player.pierce++;
    if (k === "spd") player.spd *= 1.1;
    if (k === "magnet") player.magnet += 40;
    if (k === "hp") { player.maxHp += 30; player.hp = Math.min(player.maxHp, player.hp + 30); }
    if (k === "heal") player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.4);
    addFloat(player.x, player.y - 40, UP_INFO[k][0], GOLD);
    choices = [];
    g.sfx.place();
  }

  function shoot() {
    let target: Enemy | null = null, nd = 1e9;
    for (const e of enemies) if (e.hp > 0 && inLight(e.x, e.y)) { const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < nd) { nd = d; target = e; } }
    const base = target ? Math.atan2(target.y - player.y, target.x - player.x) : (player.face > 0 ? 0 : Math.PI);
    for (let i = 0; i < player.multi; i++) {
      const a = base + (i - (player.multi - 1) / 2) * 0.16;
      projs.push({ x: player.x, y: player.y - 6, vx: Math.cos(a) * 9.5, vy: Math.sin(a) * 9.5, dmg: player.dmg, pierce: 1 + player.pierce, life: 700 });
    }
    if (target) player.face = target.x > player.x ? 1 : -1;
    g.sfx.tone(880, 0.05, "square", 0.04, -400);
  }

  function die() {
    dead = true; burst(player.x, player.y, "#fff", 26); g.sfx.over();
    if (!overSent) { overSent = true; setTimeout(() => g.over(Math.round(player.kills * 10 + player.level * 100 + gameMin() * 60)), 900); }
  }

  return {
    tick(dt) {
      if (dead) { shake = Math.max(0, shake - dt * 0.02); return; }
      if (choices.length) return;
      if (freeze > 0) { freeze -= dt; return; }
      const k = dt / 16.7;
      player.t += dt;
      player.hitT = Math.max(0, player.hitT - dt);
      hurtCd = Math.max(0, hurtCd - dt);
      shake = Math.max(0, shake - dt * 0.015);
      // 胜利：撑过 20 分钟
      if (player.t > 20 * DAY && !won) {
        won = true; g.sfx.win(); addFloat(player.x, player.y - 50, "🌅 黎明到来!", GOLD);
        if (!overSent) { overSent = true; setTimeout(() => g.over(Math.round(player.kills * 10 + player.level * 100 + 20 * 60 + 2000)), 1400); }
      }
      // 移动
      let mx = 0, my = 0;
      if (keys.l) mx -= 1; if (keys.r) mx += 1; if (keys.u) my -= 1; if (keys.d) my += 1;
      if (joy.on) { mx += joy.dx / 40; my += joy.dy / 40; }
      const ml = Math.hypot(mx, my);
      if (ml > 0) { player.x += (mx / Math.max(1, ml)) * player.spd * k; player.y += (my / Math.max(1, ml)) * player.spd * k; if (mx) player.face = mx > 0 ? 1 : -1; }
      player.x = Math.max(20, Math.min(g.W - 20, player.x)); player.y = Math.max(20, Math.min(g.H - 20, player.y));
      // 刷怪：随时间越来越密；黑暗中刷新
      spawnT -= dt * M;
      if (spawnT <= 0) { spawnT = Math.max(260, 900 - gameMin() * 40); spawnOne(); }
      if (gameMin() === 10 || gameMin() === 16) { if (!enemies.some((e) => e.boss)) spawnOne(true); }
      // 自动射击
      shootT -= dt;
      if (shootT <= 0) { shootT = player.rate; shoot(); }
      // 子弹
      projs.forEach((p) => { p.x += p.vx * k; p.y += p.vy * k; p.life -= dt; });
      for (const p of projs) {
        if (p.life <= 0 || p.pierce <= 0) continue;
        for (const e of enemies) if (e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 6) { p.pierce--; damageEnemy(e, p.dmg); break; }
      }
      projs = projs.filter((p) => p.life > 0 && p.pierce > 0);
      // 敌人：黑暗中照样追你（看不见≠不存在）
      enemies.forEach((e) => {
        e.t += dt; e.flash = Math.max(0, e.flash - dt); e.hitCd = Math.max(0, e.hitCd - dt);
        const d = Math.hypot(player.x - e.x, player.y - e.y) || 1;
        const sp = e.spd * M * k * (e.boss ? 1 : 1 + gameMin() * 0.02);
        e.x += ((player.x - e.x) / d) * sp; e.y += ((player.y - e.y) / d) * sp;
        if (d < e.r + 14 && hurtCd <= 0) {
          hurtCd = 700; player.hitT = 260;
          const raw = Math.max(3, (e.boss ? 20 : 7) * (g.difficulty === "easy" ? 0.7 : 1));
          player.hp -= raw; shake = Math.min(7, shake + 4); g.sfx.hit();
          addFloat(player.x, player.y - 30, "-" + Math.round(raw), BERRY);
          if (player.hp <= 0) die();
        }
      });
      enemies = enemies.filter((e) => e.hp > 0);
      // 经验宝石
      gems.forEach((gem) => {
        const d = Math.hypot(player.x - gem.x, player.y - gem.y) || 1;
        if (d < player.magnet) { gem.x += ((player.x - gem.x) / d) * 8 * k; gem.y += ((player.y - gem.y) / d) * 8 * k; }
      });
      gems = gems.filter((gem) => {
        if (Math.hypot(player.x - gem.x, player.y - gem.y) < 22) { gainXp(gem.v); return false; }
        return true;
      });
      floats.forEach((f) => { f.y -= 0.6 * k; f.t -= dt; });
      floats = floats.filter((f) => f.t > 0);
    },
    draw(ctx) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      // 地面
      ctx.fillStyle = "#0b100d"; ctx.fillRect(-10, -10, g.W + 20, g.H + 20);
      ctx.strokeStyle = "rgba(143,174,147,.06)";
      for (let i = 0; i < g.W; i += 44) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, g.H); ctx.stroke(); }
      for (let i = 0; i < g.H; i += 44) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(g.W, i); ctx.stroke(); }
      // 血迹装饰
      ctx.fillStyle = "rgba(120,40,40,.14)";
      for (let i = 0; i < 7; i++) { const bx = ((i * 173) % g.W), by = ((i * 271) % g.H); ctx.beginPath(); ctx.ellipse(bx, by, 22 + (i % 3) * 8, 12, i, 0, 7); ctx.fill(); }
      // 敌人（黑暗中的只画一双眼睛！）
      enemies.forEach((e) => {
        const lit = inLight(e.x, e.y);
        if (!lit) {
          ctx.fillStyle = `rgba(255,60,60,${0.35 + Math.sin(e.t / 200) * 0.15})`;
          ctx.beginPath(); ctx.arc(e.x - 5, e.y - 3, 2.2, 0, 7); ctx.arc(e.x + 5, e.y - 3, 2.2, 0, 7); ctx.fill();
          return;
        }
        ctx.fillStyle = ["#6fae5a", "#9a7ac4", "#cfc9b8", "#c98f4f", "#4a2a4a"][e.kind];
        if (e.flash > 0) ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill();
        ctx.fillStyle = "#12100e"; ctx.beginPath(); ctx.arc(e.x - e.r * 0.3, e.y - e.r * 0.2, e.r * 0.16, 0, 7); ctx.arc(e.x + e.r * 0.3, e.y - e.r * 0.2, e.r * 0.16, 0, 7); ctx.fill();
        if (e.boss) { ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
        if (!e.boss && e.hp < e.maxHp) { ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(e.x - 13, e.y - e.r - 10, 26, 4); ctx.fillStyle = BERRY; ctx.fillRect(e.x - 13, e.y - e.r - 10, 26 * (e.hp / e.maxHp), 4); }
      });
      // 宝石
      gems.forEach((gem) => { ctx.fillStyle = "#8fd878"; ctx.beginPath(); ctx.arc(gem.x, gem.y, 5, 0, 7); ctx.fill(); ctx.fillStyle = "#d8f7c8"; ctx.beginPath(); ctx.arc(gem.x - 1.5, gem.y - 1.5, 2, 0, 7); ctx.fill(); });
      // 子弹（火光）
      projs.forEach((p) => { ctx.fillStyle = "#ffd27a"; ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, 7); ctx.fill(); ctx.fillStyle = "#fff8e0"; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 7); ctx.fill(); });
      // 玩家：提灯人
      if (!dead) {
        const py = player.y + Math.sin(player.t / 200) * 1.5;
        if (player.hitT > 0) { ctx.globalAlpha = 0.5; }
        ctx.fillStyle = "#3e5a48"; rr(ctx, player.x - 9, py - 14, 18, 24, 7); ctx.fill();
        ctx.fillStyle = "#e8c39e"; ctx.beginPath(); ctx.arc(player.x, py - 19, 7, 0, 7); ctx.fill();
        ctx.fillStyle = "#2a3a30"; ctx.fillRect(player.x - 8, py - 26, 16, 5);
        // 提灯
        const lx = player.x + player.face * 14, ly = py - 4 + Math.sin(player.t / 180) * 2;
        ctx.strokeStyle = "#8a6f4a"; ctx.beginPath(); ctx.moveTo(player.x + player.face * 8, py - 8); ctx.lineTo(lx, ly - 6); ctx.stroke();
        ctx.fillStyle = "#f0c060"; rr(ctx, lx - 4, ly - 6, 8, 11, 2); ctx.fill();
        ctx.fillStyle = "#fff8e0"; rr(ctx, lx - 2, ly - 4, 4, 7, 1); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // 黑暗遮罩：灯光之外全黑（destination-out 挖洞）
      const dark = (createDawn as any)._dark ?? ((createDawn as any)._dark = document.createElement("canvas"));
      if (dark.width !== g.W) { dark.width = g.W; dark.height = g.H; }
      const dctx = dark.getContext("2d")!;
      dctx.globalCompositeOperation = "source-over";
      const min = gameMin();
      const darkness = Math.min(0.97, 0.86 + min * 0.004); // 越晚越黑
      dctx.clearRect(0, 0, g.W, g.H);
      dctx.fillStyle = `rgba(2,4,3,${darkness})`;
      dctx.fillRect(0, 0, g.W, g.H);
      dctx.globalCompositeOperation = "destination-out";
      const lg = dctx.createRadialGradient(player.x, player.y, player.lightR * 0.25, player.x, player.y, player.lightR);
      lg.addColorStop(0, "rgba(0,0,0,1)"); lg.addColorStop(0.75, "rgba(0,0,0,.95)"); lg.addColorStop(1, "rgba(0,0,0,0)");
      dctx.fillStyle = lg;
      dctx.beginPath(); dctx.arc(player.x, player.y, player.lightR, 0, 7); dctx.fill();
      ctx.drawImage(dark, 0, 0);
      // 灯光暖圈描边
      ctx.strokeStyle = `rgba(240,192,96,${0.12 + Math.sin(player.t / 500) * 0.04})`;
      ctx.setLineDash([8, 10]);
      ctx.beginPath(); ctx.arc(player.x, player.y, player.lightR, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      // ============ HUD ============
      ctx.fillStyle = "rgba(0,0,0,.5)"; rr(ctx, 54, 16, g.W - 108, 12, 6); ctx.fill();
      const xw = (g.W - 108) * Math.min(1, player.xp / player.xpNext);
      if (xw > 1) { ctx.fillStyle = "#8fd878"; rr(ctx, 54, 16, xw, 12, 6); ctx.fill(); }
      ctx.fillStyle = "#14231a"; ctx.beginPath(); ctx.arc(30, 22, 17, 0, 7); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(30, 22, 17, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
      txt(ctx, String(player.level), 30, 23, 14, "#f3f5ea");
      // 血条
      const hpw = 150;
      ctx.fillStyle = "rgba(0,0,0,.55)"; rr(ctx, 14, 46, hpw, 10, 5); ctx.fill();
      const hpF = Math.max(0, player.hp / player.maxHp);
      if (hpw * hpF > 2) { ctx.fillStyle = hpF < 0.3 ? BERRY : "#5fc46f"; rr(ctx, 14, 46, hpw * hpF, 10, 5); ctx.fill(); }
      txt(ctx, `${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`, 14 + hpw / 2, 47, 8, "#fff");
      // 时钟：现在是几点
      const sec = Math.floor(player.t / 1000);
      const clockH = Math.floor(sec / 30); // 30 秒 = 1 小时（20 分钟局 = 从 00:00 到黎明）
      txt(ctx, `🌙 ${String(clockH).padStart(2, "0")}:${String(sec % 30 * 2).padStart(2, "0")}`, g.W / 2, 42, 14, ICE);
      txt(ctx, `💀 ${player.kills}`, g.W - 40, 42, 13, "#cfe3c2");
      const boss = enemies.find((e) => e.boss);
      if (boss) {
        ctx.fillStyle = "rgba(0,0,0,.55)"; rr(ctx, 60, 66, g.W - 120, 10, 5); ctx.fill();
        ctx.fillStyle = BERRY; rr(ctx, 60, 66, (g.W - 120) * Math.max(0, boss.hp / boss.maxHp), 10, 5); ctx.fill();
        txt(ctx, "☠ 梦魇", g.W / 2, 62, 10, "#ffd27a");
      }
      // 摇杆
      if (joy.on) {
        ctx.strokeStyle = "rgba(233,242,228,.3)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 44, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
        const jd = Math.min(40, Math.hypot(joy.dx, joy.dy)), ja = Math.atan2(joy.dy, joy.dx);
        ctx.fillStyle = "rgba(233,242,228,.5)"; ctx.beginPath(); ctx.arc(joy.ox + Math.cos(ja) * jd, joy.oy + Math.sin(ja) * jd, 18, 0, 7); ctx.fill();
      }
      // 飘字
      floats.forEach((f) => { ctx.globalAlpha = Math.min(1, f.t / 300); txt(ctx, f.s, f.x, f.y, 13, f.c); });
      ctx.globalAlpha = 1;
      if (dead) { ctx.fillStyle = "rgba(4,6,5,.85)"; ctx.fillRect(0, 0, g.W, g.H); txt(ctx, "🌑 你没撑到黎明", g.W / 2, g.H / 2 - 16, 26, "#e8e4d8"); txt(ctx, `坚持到 ${String(Math.min(20, gameMin())).padStart(2, "0")}:00 · 击杀 ${player.kills}`, g.W / 2, g.H / 2 + 20, 14, "#8fae93"); }
      if (won && !dead) txt(ctx, "🌅 你活到了黎明！", g.W / 2, g.H / 2, 28, GOLD);
      // 升级三选一
      if (choices.length) {
        ctx.fillStyle = "rgba(4,8,6,.88)"; ctx.fillRect(0, 0, g.W, g.H);
        txt(ctx, "⬆ 升级！选择一样", g.W / 2, 90, 20, "#f3f5ea");
        choices.forEach((c, i) => {
          const cw = 268, ch = 74, cx = (g.W - cw) / 2, cy = 140 + i * 96;
          rr(ctx, cx, cy, cw, ch, 12);
          ctx.fillStyle = "#16281d"; ctx.fill();
          ctx.strokeStyle = "rgba(240,192,96,.5)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
          const info = UP_INFO[c];
          txt(ctx, info[0], g.W / 2, cy + 26, 16, "#f3f5ea");
          txt(ctx, info[1], g.W / 2, cy + 50, 11.5, "#8fae93");
        });
      }
    },
    onPointer(tp, x, y, id) {
      if (dead) return;
      if (choices.length) {
        if (tp !== "down") return;
        const cw = 268, cx = (g.W - cw) / 2;
        choices.forEach((c, i) => { const cy = 140 + i * 96; if (x > cx && x < cx + cw && y > cy && y < cy + 74) applyUpgrade(c); });
        return;
      }
      if (tp === "down") { joy = { on: true, ox: x, oy: y, dx: 0, dy: 0, id: id ?? -1 }; }
      if (tp === "move" && joy.on && (id === undefined || id === joy.id)) { joy.dx = x - joy.ox; joy.dy = y - joy.oy; }
      if (tp === "up" && (id === undefined || id === joy.id)) joy.on = false;
    },
    onKey(code, down) {
      if (code === "ArrowLeft" || code === "KeyA") keys.l = down;
      if (code === "ArrowRight" || code === "KeyD") keys.r = down;
      if (code === "ArrowUp" || code === "KeyW") keys.u = down;
      if (code === "ArrowDown" || code === "KeyS") keys.d = down;
    },
  };
}
