/* 深岩银河·幸存者（网页版）：可以挖矿改地形的割草 —— 炸出护城河，让虫子绕路 */
import { GameCtx, GameHandle, rr } from "./engine";

const FONT = '"Noto Sans SC", sans-serif';
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center", bold = true) {
  ctx.fillStyle = color; ctx.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
}
const GOLD = "#f0c060", BERRY = "#d95d39", CYAN = "#7fc8e8";

interface Enemy { x: number; y: number; hp: number; maxHp: number; spd: number; r: number; kind: number; xp: number; t: number; flash: number; boss: boolean }
interface Proj { x: number; y: number; vx: number; vy: number; dmg: number; pierce: number; life: number }
interface Gem { x: number; y: number; v: number }
interface Turret { x: number; y: number; cd: number; life: number }
interface Float { x: number; y: number; s: string; c: string; t: number }

export function createRock(g: GameCtx): GameHandle {
  const M = g.mult;
  const CELL = 20, COLS = Math.floor(g.W / CELL), ROWS = Math.floor(g.H / CELL);
  // 0 地面 / 1 岩石 / 2 矿石
  let grid: number[][] = [];
  function genMap() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    for (let i = 0; i < 46; i++) { // 岩石团
      let cx = g.rnd(COLS), cy = g.rnd(ROWS);
      if (Math.abs(cx - COLS / 2) < 4 && Math.abs(cy - ROWS / 2) < 4) continue; // 中央出生区清空
      const n = 2 + g.rnd(5);
      for (let j = 0; j < n; j++) {
        if (cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS) grid[cy][cx] = Math.random() < 0.18 ? 2 : 1;
        cx += g.rnd(3) - 1; cy += g.rnd(3) - 1;
      }
    }
  }
  genMap();
  const isRock = (x: number, y: number) => {
    const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
    return c >= 0 && c < COLS && r >= 0 && r < ROWS && grid[r][c] === 1;
  };
  const cellAt = (x: number, y: number) => {
    const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
    return c >= 0 && c < COLS && r >= 0 && r < ROWS ? grid[r][c] : 1;
  };
  function dig(x: number, y: number): boolean {
    const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
    if (grid[r][c] === 0) return false;
    const wasOre = grid[r][c] === 2;
    grid[r][c] = 0;
    g.juice.burst(c * CELL + CELL / 2, r * CELL + CELL / 2, wasOre ? GOLD : "#8a8078", wasOre ? 8 : 4);
    if (wasOre) { gems.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, v: 3 }); coins += 2; addFloat(x, y - 10, "+2 🪙", GOLD); g.sfx.coin(); }
    return true;
  }

  let player = { x: g.W / 2, y: g.H / 2, hp: 100, maxHp: 100, spd: 2.7, magnet: 70, face: 1, level: 1, xp: 0, xpNext: 8, kills: 0, t: 0, hitT: 0 };
  let mods = { dmg: 11, rate: 320, multi: 1, drill: 1, turrets: 1, bomb: 0 };
  let enemies: Enemy[] = [], gems: Gem[] = [], projs: Proj[] = [], turrets: Turret[] = [], floats: Float[] = [];
  let shake = 0, freeze = 0, shootT = 0, spawnT = 0, bombT = 0, hurtCd = 0, dashT = 0, dashCd = 0, dead = false, overSent = false;
  let coins = 0, dug = 0;
  let choices: string[] = [];
  let keys = { l: false, r: false, u: false, d: false };
  let joy = { on: false, ox: 0, oy: 0, dx: 0, dy: 0, id: -1 };
  let dashBtn = { on: false };

  function addFloat(x: number, y: number, s: string, c: string) { floats.push({ x, y, s, c, t: 750 }); }
  const wave = () => 1 + Math.floor(player.t / 35000);

  const SPAWNS = [[30, 30], [g.W - 30, 30], [30, g.H - 30], [g.W - 30, g.H - 30]];
  function spawnOne(boss = false) {
    if (enemies.length > 90) return;
    const [sx, sy] = SPAWNS[g.rnd(4)];
    if (boss) {
      const hp = 800 * wave() * M;
      enemies.push({ x: sx, y: sy, hp, maxHp: hp, spd: 0.6, r: 30, kind: 3, xp: 40, t: 0, flash: 0, boss: true });
      addFloat(player.x, player.y - 56, "🐛 钻岩巨虫!", BERRY);
      g.sfx.tone(90, 0.5, "sawtooth", 0.16, -25);
      return;
    }
    const avail = wave() >= 4 ? 3 : wave() >= 2 ? 2 : 1;
    const kind = g.rnd(avail);
    const def = [{ hp: 15, spd: 1.2, r: 12, xp: 1 }, { hp: 40, spd: 0.8, r: 16, xp: 2 }, { hp: 22, spd: 1.6, r: 11, xp: 2 }][kind];
    const hp = def.hp * (1 + wave() * 0.4) * M;
    enemies.push({ x: sx + (Math.random() - 0.5) * 40, y: sy + (Math.random() - 0.5) * 40, hp, maxHp: hp, spd: def.spd, r: def.r, kind, xp: def.xp, t: Math.random() * 999, flash: 0, boss: false });
  }

  function damageEnemy(e: Enemy, raw: number) {
    e.hp -= raw; e.flash = 100;
    addFloat(e.x, e.y - e.r, String(Math.round(raw)), e.boss ? GOLD : "#fff");
    if (e.hp <= 0) {
      player.kills++;
      freeze = e.boss ? 120 : 24;
      shake = Math.min(6, shake + (e.boss ? 6 : 1.4));
      g.juice.burst(e.x, e.y, ["#8a9a4a", "#7a6a5a", "#5a8a8a", "#9a6a4a"][e.kind], e.boss ? 28 : 8);
      g.sfx.score();
      gems.push({ x: e.x, y: e.y, v: e.xp });
    }
  }

  const UP_INFO: Record<string, [string, string]> = {
    dmg: ["⛏ 强化钻头", "子弹伤害 +35%"],
    rate: ["⏩ 连发", "射击间隔 -12%"],
    multi: ["🌠 散射", "钻头 +1"],
    drill: ["🧱 掘进", "子弹穿透岩石层数 +1"],
    turret: ["🗼 炮塔", "部署 +1 座自动炮塔（最多 4 座）"],
    bomb: ["💣 爆破", "获得定时爆破，炸开周围岩石和敌人"],
    spd: ["👟 疾行", "移动速度 +10%"],
    magnet: ["🧲 磁力", "拾取范围 +35"],
    hp: ["❤ 强壮", "生命上限 +30 并回复 30"],
    heal: ["🍺 矮人麦酒", "立刻回复 40% 生命"],
  };
  function gainXp(v: number) {
    player.xp += v;
    while (player.xp >= player.xpNext) {
      player.xp -= player.xpNext; player.level++; player.xpNext = 6 + player.level * 4;
      const pool = ["dmg", "dmg", "rate", "rate", "multi", "drill", "drill", "turret", "bomb", "spd", "magnet", "hp", "heal"];
      choices = [];
      while (choices.length < 3 && pool.length) choices.push(pool.splice(g.rnd(pool.length), 1)[0]);
      g.sfx.win();
    }
  }
  function placeTurrets() {
    const want = Math.min(4, mods.turrets);
    while (turrets.length < want) {
      const a = (turrets.length / 4) * Math.PI * 2 + Math.PI / 4;
      turrets.push({ x: player.x + Math.cos(a) * 70, y: player.y + Math.sin(a) * 70, cd: 0, life: 99999 });
      g.juice.burst(player.x + Math.cos(a) * 70, player.y + Math.sin(a) * 70, CYAN, 8);
    }
  }
  function applyUpgrade(k: string) {
    if (k === "dmg") mods.dmg *= 1.35;
    if (k === "rate") mods.rate = Math.max(110, mods.rate * 0.88);
    if (k === "multi") mods.multi++;
    if (k === "drill") mods.drill++;
    if (k === "turret") { mods.turrets++; placeTurrets(); }
    if (k === "bomb") { mods.bomb++; addFloat(player.x, player.y - 40, "💣 爆破就绪", BERRY); }
    if (k === "spd") player.spd *= 1.1;
    if (k === "magnet") player.magnet += 35;
    if (k === "hp") { player.maxHp += 30; player.hp = Math.min(player.maxHp, player.hp + 30); }
    if (k === "heal") player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.4);
    choices = [];
    g.sfx.place();
  }

  function shoot() {
    let target: Enemy | null = null, nd = 1e9;
    for (const e of enemies) if (e.hp > 0) { const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < nd) { nd = d; target = e; } }
    const base = target ? Math.atan2(target.y - player.y, target.x - player.x) : (player.face > 0 ? 0 : Math.PI);
    for (let i = 0; i < mods.multi; i++) {
      const a = base + (i - (mods.multi - 1) / 2) * 0.18;
      projs.push({ x: player.x, y: player.y - 6, vx: Math.cos(a) * 8.5, vy: Math.sin(a) * 8.5, dmg: mods.dmg, pierce: 2 + mods.drill, life: 750 });
    }
    if (target) player.face = target.x > player.x ? 1 : -1;
    g.sfx.tone(300, 0.05, "square", 0.05, -120);
  }
  function bomb() {
    if (mods.bomb <= 0 || dead) return;
    const R = 120 + mods.bomb * 15;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * R;
      dig(player.x + Math.cos(a) * d, player.y + Math.sin(a) * d);
      dug++;
    }
    for (const e of enemies) if (e.hp > 0 && Math.hypot(e.x - player.x, e.y - player.y) < R + e.r) damageEnemy(e, mods.dmg * 3);
    shake = Math.min(10, shake + 8);
    g.juice.burst(player.x, player.y, "#f0c060", 30);
    g.sfx.boom();
    addFloat(player.x, player.y - 40, "💥 爆破!", BERRY);
  }

  function die() {
    dead = true; g.juice.burst(player.x, player.y, "#f0c060", 26); g.sfx.over();
    if (!overSent) { overSent = true; setTimeout(() => g.over(Math.round(player.kills * 12 + player.level * 120 + coins * 8 + dug * 3)), 900); }
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
      dashT = Math.max(0, dashT - dt);
      dashCd = Math.max(0, dashCd - dt);
      shake = Math.max(0, shake - dt * 0.015);
      // 移动（岩石阻挡，冲刺可掘进）
      let mx = 0, my = 0;
      if (keys.l) mx -= 1; if (keys.r) mx += 1; if (keys.u) my -= 1; if (keys.d) my += 1;
      if (joy.on) { mx += joy.dx / 40; my += joy.dy / 40; }
      const ml = Math.hypot(mx, my);
      if (ml > 0) {
        const sp = player.spd * (dashT > 0 ? 3.4 : 1) * k;
        const nx = player.x + (mx / Math.max(1, ml)) * sp;
        const ny = player.y + (my / Math.max(1, ml)) * sp;
        if (dashT > 0) { if (dig(nx, player.y)) dug++; if (dig(player.x, ny)) dug++; player.x = nx; player.y = ny; }
        else { if (!isRock(nx, player.y)) player.x = nx; if (!isRock(player.x, ny)) player.y = ny; }
        if (mx) player.face = mx > 0 ? 1 : -1;
      }
      player.x = Math.max(14, Math.min(g.W - 14, player.x)); player.y = Math.max(14, Math.min(g.H - 14, player.y));
      // 刷怪
      spawnT -= dt * M;
      if (spawnT <= 0) { spawnT = Math.max(320, 1000 - wave() * 80); spawnOne(); }
      if (player.t > 60000 && Math.floor(player.t / 60000) > Math.floor((player.t - dt) / 60000)) spawnOne(true);
      // 射击
      shootT -= dt;
      if (shootT <= 0) { shootT = mods.rate; shoot(); }
      // 炮塔
      turrets.forEach((tu) => {
        tu.cd -= dt;
        if (tu.cd > 0) return;
        let target: Enemy | null = null, nd = 1e9;
        for (const e of enemies) if (e.hp > 0) { const d = Math.hypot(e.x - tu.x, e.y - tu.y); if (d < 240 && d < nd) { nd = d; target = e; } }
        if (target) {
          tu.cd = 420;
          const a = Math.atan2(target.y - tu.y, target.x - tu.x);
          projs.push({ x: tu.x, y: tu.y, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, dmg: mods.dmg * 0.7, pierce: 1, life: 500 });
          g.sfx.tone(900, 0.04, "square", 0.03, -400);
        }
      });
      // 子弹：命中岩石会挖掘！
      projs.forEach((p) => {
        p.x += p.vx * k; p.y += p.vy * k; p.life -= dt;
        if (cellAt(p.x, p.y) > 0) {
          if (dig(p.x, p.y)) { dug++; p.pierce -= 1; }
          if (cellAt(p.x, p.y) > 0) p.pierce = Math.min(p.pierce, 0);
        }
      });
      for (const p of projs) {
        if (p.life <= 0 || p.pierce <= 0) continue;
        for (const e of enemies) if (e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 6) { p.pierce--; damageEnemy(e, p.dmg); break; }
      }
      projs = projs.filter((p) => p.life > 0 && p.pierce > 0 && p.x > -20 && p.x < g.W + 20 && p.y > -20 && p.y < g.H + 20);
      // 敌人：岩石挡路（虫子不会挖，巨虫会）
      enemies.forEach((e) => {
        e.t += dt; e.flash = Math.max(0, e.flash - dt);
        const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
        const canDig = e.boss;
        const sp = e.spd * M * k;
        let nx = e.x + (dx / d) * sp, ny = e.y + (dy / d) * sp;
        if (isRock(nx, ny)) {
          if (canDig) { dig(nx, ny); }
          else {
            // 沿墙绕行
            if (!isRock(e.x + (dy / d) * sp, e.y - (dx / d) * sp)) { nx = e.x + (dy / d) * sp; ny = e.y - (dx / d) * sp; }
            else if (!isRock(e.x - (dy / d) * sp, e.y + (dx / d) * sp)) { nx = e.x - (dy / d) * sp; ny = e.y + (dx / d) * sp; }
            else { nx = e.x; ny = e.y; }
          }
        }
        e.x = nx; e.y = ny;
        if (d < e.r + 14 && hurtCd <= 0) {
          hurtCd = 700; player.hitT = 260;
          const raw = Math.max(2, (e.boss ? 20 : 7) * (g.difficulty === "easy" ? 0.7 : 1));
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
      ctx.fillStyle = "#2a2320"; ctx.fillRect(-10, -10, g.W + 20, g.H + 20);
      // 岩层（洞穴质感）
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        if (v === 0) continue;
        const x = c * CELL, y = r * CELL;
        if (v === 2) { // 矿石：发光金块
          ctx.fillStyle = "#4a4038"; ctx.fillRect(x, y, CELL, CELL);
          ctx.fillStyle = "#f0c060";
          ctx.fillRect(x + 5, y + 5, 5, 5); ctx.fillRect(x + 11, y + 9, 4, 4); ctx.fillRect(x + 7, y + 12, 4, 4);
          ctx.fillStyle = "rgba(240,192,96,.15)"; ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, 14, 0, 7); ctx.fill();
        } else { // 岩石
          ctx.fillStyle = (r + c) % 2 ? "#5a5048" : "#534a42";
          ctx.fillRect(x, y, CELL, CELL);
          ctx.fillStyle = "#6a6058"; ctx.fillRect(x, y, CELL, 3);
          ctx.fillStyle = "#453d36"; ctx.fillRect(x + 4, y + 9, 6, 5); ctx.fillRect(x + 12, y + 5, 5, 4);
        }
      }
      // 刷怪洞口
      SPAWNS.forEach(([sx, sy]) => {
        ctx.fillStyle = "#120e0c"; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, 7); ctx.fill();
        ctx.strokeStyle = "#d95d39"; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(sx, sy, 22, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
      });
      // 炮塔
      turrets.forEach((tu) => {
        ctx.fillStyle = "#3a4a5a"; rr(ctx, tu.x - 9, tu.y - 11, 18, 22, 4); ctx.fill();
        ctx.fillStyle = CYAN; rr(ctx, tu.x - 5, tu.y - 16, 10, 8, 3); ctx.fill();
        ctx.fillStyle = "#8a9aa8"; ctx.fillRect(tu.x - 2, tu.y - 20, 4, 6);
      });
      // 敌人（洞穴虫子）
      enemies.forEach((e) => {
        ctx.fillStyle = e.flash > 0 ? "#fff" : ["#8a9a4a", "#7a6a5a", "#5a8a8a", "#9a6a4a"][e.kind];
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill();
        if (e.kind === 0 || e.kind === 2) { // 虫足
          ctx.strokeStyle = ctx.fillStyle as string; ctx.lineWidth = 2;
          for (let l = 0; l < 3; l++) { const la = e.t / 90 + l; ctx.beginPath(); ctx.moveTo(e.x - e.r, e.y + l * 5 - 5); ctx.lineTo(e.x - e.r - 5 - Math.sin(la) * 2, e.y + l * 5 - 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(e.x + e.r, e.y + l * 5 - 5); ctx.lineTo(e.x + e.r + 5 + Math.sin(la) * 2, e.y + l * 5 - 2); ctx.stroke(); }
          ctx.lineWidth = 1;
        }
        ctx.fillStyle = "#ffd27a"; ctx.beginPath(); ctx.arc(e.x - e.r * 0.3, e.y - e.r * 0.25, e.r * 0.14, 0, 7); ctx.arc(e.x + e.r * 0.3, e.y - e.r * 0.25, e.r * 0.14, 0, 7); ctx.fill();
        if (e.boss) { ctx.strokeStyle = BERRY; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
        if (!e.boss && e.hp < e.maxHp) { ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(e.x - 13, e.y - e.r - 10, 26, 4); ctx.fillStyle = BERRY; ctx.fillRect(e.x - 13, e.y - e.r - 10, 26 * (e.hp / e.maxHp), 4); }
      });
      gems.forEach((gem) => { ctx.fillStyle = "#7fc8e8"; ctx.beginPath(); ctx.arc(gem.x, gem.y, 5, 0, 7); ctx.fill(); ctx.fillStyle = "#d8f0fa"; ctx.beginPath(); ctx.arc(gem.x - 1.5, gem.y - 1.5, 2, 0, 7); ctx.fill(); });
      // 钻头子弹（旋转三角）
      projs.forEach((p) => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx) + p.life / 20);
        ctx.fillStyle = "#c9c2b0";
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#f0c060"; ctx.beginPath(); ctx.arc(-3, 0, 2.5, 0, 7); ctx.fill();
        ctx.restore();
      });
      // 玩家：矮人矿工
      if (!dead) {
        const py = player.y + Math.sin(player.t / 200) * 1.5;
        if (player.hitT > 0) ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#7a5c3a"; rr(ctx, player.x - 9, py - 13, 18, 23, 6); ctx.fill();
        ctx.fillStyle = "#e8c39e"; ctx.beginPath(); ctx.arc(player.x, py - 18, 6.5, 0, 7); ctx.fill();
        ctx.fillStyle = "#d95d39"; ctx.fillRect(player.x - 8, py - 25, 16, 5); // 红帽
        ctx.fillStyle = "#f0c060"; ctx.fillRect(player.x - 2, py - 25, 4, 5); // 帽灯
        const sa = Math.sin(player.t / 55) * 0.6;
        ctx.save(); ctx.translate(player.x + player.face * 12, py - 2); ctx.rotate(player.face * (-0.4 + sa));
        ctx.fillStyle = "#8a6f4a"; ctx.fillRect(-1.5, -16, 3, 15);
        ctx.fillStyle = "#c9c2b0"; ctx.beginPath(); ctx.arc(0, -16, 5, Math.PI, 0); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      // ============ HUD ============
      ctx.fillStyle = "rgba(0,0,0,.5)"; rr(ctx, 54, 16, g.W - 108, 12, 6); ctx.fill();
      const xw = (g.W - 108) * Math.min(1, player.xp / player.xpNext);
      if (xw > 1) { ctx.fillStyle = "#7fc8e8"; rr(ctx, 54, 16, xw, 12, 6); ctx.fill(); }
      ctx.fillStyle = "#2a2320"; ctx.beginPath(); ctx.arc(30, 22, 17, 0, 7); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(30, 22, 17, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
      txt(ctx, String(player.level), 30, 23, 14, "#f3f5ea");
      ctx.fillStyle = "rgba(0,0,0,.55)"; rr(ctx, 14, 46, 150, 10, 5); ctx.fill();
      const hpF = Math.max(0, player.hp / player.maxHp);
      if (150 * hpF > 2) { ctx.fillStyle = hpF < 0.3 ? BERRY : "#5fc46f"; rr(ctx, 14, 46, 150 * hpF, 10, 5); ctx.fill(); }
      txt(ctx, `${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`, 89, 47, 8, "#fff");
      txt(ctx, `⛏ 掘进 ${dug}`, g.W / 2, 42, 13, CYAN);
      txt(ctx, `🪙 ${coins}`, g.W - 40, 42, 13, GOLD);
      const boss = enemies.find((e) => e.boss);
      if (boss) {
        ctx.fillStyle = "rgba(0,0,0,.55)"; rr(ctx, 60, 60, g.W - 120, 10, 5); ctx.fill();
        ctx.fillStyle = BERRY; rr(ctx, 60, 60, (g.W - 120) * Math.max(0, boss.hp / boss.maxHp), 10, 5); ctx.fill();
        txt(ctx, "🐛 钻岩巨虫", g.W / 2, 56, 10, "#e8a89a");
      }
      // 爆破按钮
      if (mods.bomb > 0) {
        ctx.fillStyle = "rgba(217,93,57,.3)"; ctx.beginPath(); ctx.arc(g.W - 74, g.H - 108, 34, 0, 7); ctx.fill();
        ctx.strokeStyle = BERRY; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(g.W - 74, g.H - 108, 34, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
        txt(ctx, "💣", g.W - 74, g.H - 110, 22, "#fff");
        txt(ctx, `爆破×${mods.bomb}`, g.W - 74, g.H - 88, 10, "#cfe3c2");
      }
      // 摇杆
      if (joy.on) {
        ctx.strokeStyle = "rgba(233,242,228,.3)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 44, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
        const jd = Math.min(40, Math.hypot(joy.dx, joy.dy)), ja = Math.atan2(joy.dy, joy.dx);
        ctx.fillStyle = "rgba(233,242,228,.5)"; ctx.beginPath(); ctx.arc(joy.ox + Math.cos(ja) * jd, joy.oy + Math.sin(ja) * jd, 18, 0, 7); ctx.fill();
      }
      floats.forEach((f) => { ctx.globalAlpha = Math.min(1, f.t / 300); txt(ctx, f.s, f.x, f.y, 13, f.c); });
      ctx.globalAlpha = 1;
      if (dead) { ctx.fillStyle = "rgba(16,12,10,.85)"; ctx.fillRect(0, 0, g.W, g.H); txt(ctx, "⛏ 你被埋在了矿井", g.W / 2, g.H / 2 - 16, 26, "#e8e4d8"); txt(ctx, `击杀 ${player.kills} · 挖掘 ${dug} · 金币 ${coins}`, g.W / 2, g.H / 2 + 20, 14, "#8a7f68"); }
      // 升级三选一
      if (choices.length) {
        ctx.fillStyle = "rgba(16,12,10,.9)"; ctx.fillRect(0, 0, g.W, g.H);
        txt(ctx, "⬆ 升级！选择一样", g.W / 2, 90, 20, "#f3f5ea");
        choices.forEach((c, i) => {
          const cw = 268, ch = 74, cx = (g.W - cw) / 2, cy = 140 + i * 96;
          rr(ctx, cx, cy, cw, ch, 12);
          ctx.fillStyle = "#2a2320"; ctx.fill();
          ctx.strokeStyle = "rgba(127,200,232,.5)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
          const info = UP_INFO[c];
          txt(ctx, info[0], g.W / 2, cy + 26, 16, "#f3f5ea");
          txt(ctx, info[1], g.W / 2, cy + 50, 11.5, "#8a7f68");
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
      if (tp === "down" && mods.bomb > 0 && Math.hypot(x - (g.W - 74), y - (g.H - 108)) < 40) { bomb(); return; }
      if (tp === "down" && dashCd <= 0 && Math.hypot(x - 74, y - (g.H - 108)) < 44) { dashT = 200; dashCd = 1500; g.sfx.tone(500, 0.1, "square", 0.07, 300); return; }
      if (tp === "down") joy = { on: true, ox: x, oy: y, dx: 0, dy: 0, id: id ?? -1 };
      if (tp === "move" && joy.on && (id === undefined || id === joy.id)) { joy.dx = x - joy.ox; joy.dy = y - joy.oy; }
      if (tp === "up" && (id === undefined || id === joy.id)) joy.on = false;
    },
    onKey(code, down) {
      if (code === "ArrowLeft" || code === "KeyA") keys.l = down;
      if (code === "ArrowRight" || code === "KeyD") keys.r = down;
      if (code === "ArrowUp" || code === "KeyW") keys.u = down;
      if (code === "ArrowDown" || code === "KeyS") keys.d = down;
      if ((code === "Space" || code === "KeyJ") && down) bomb();
      if (code === "ShiftLeft" && down && dashCd <= 0) { dashT = 200; dashCd = 1500; }
    },
  };
}
