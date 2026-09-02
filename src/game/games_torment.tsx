/* 痛苦之厅（网页版）：暗黑哥特割草 —— 完成契约目标掉落带词条的装备 */
import { GameCtx, GameHandle, rr } from "./engine";

const FONT = '"Noto Sans SC", sans-serif';
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center", bold = true) {
  ctx.fillStyle = color; ctx.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
}
const GOLD = "#d8a03c", BERRY = "#a33a2a", BONE = "#c9bfa8";

interface Enemy { x: number; y: number; hp: number; maxHp: number; spd: number; r: number; kind: number; xp: number; t: number; flash: number; boss: boolean }
interface Proj { x: number; y: number; vx: number; vy: number; dmg: number; pierce: number; life: number; c: string }
interface Gem { x: number; y: number; v: number }
interface Float { x: number; y: number; s: string; c: string; t: number }
interface Gear { name: string; affix: string; mods: Record<string, number> }

export function createTorment(g: GameCtx): GameHandle {
  const M = g.mult;
  let player = { x: g.W / 2, y: g.H / 2, hp: 100, maxHp: 100, spd: 2.6, magnet: 70, face: 1, level: 1, xp: 0, xpNext: 8, kills: 0, t: 0, hitT: 0 };
  let mods = { dmg: 12, rate: 480, multi: 1, crit: 0.08, moveMul: 1, armor: 0, thorns: 0 };
  let gear: Gear[] = [];
  let enemies: Enemy[] = [], gems: Gem[] = [], projs: Proj[] = [], floats: Float[] = [];
  let shake = 0, freeze = 0, shootT = 0, spawnT = 0, hurtCd = 0, novaCd = 0, dead = false, overSent = false;
  let contractKills = 0, contractTarget = 15, contractLv = 1;
  let choices: string[] = [];
  let gearDrop: Gear | null = null;
  let keys = { l: false, r: false, u: false, d: false };
  let joy = { on: false, ox: 0, oy: 0, dx: 0, dy: 0, id: -1 };
  let joyActive = { on: false, ox: 0, oy: 0, dx: 0, dy: 0, id: -1 }; // 右侧攻击摇杆

  function addFloat(x: number, y: number, s: string, c: string) { floats.push({ x, y, s, c, t: 750 }); }
  const wave = () => 1 + Math.floor(player.t / 40000);

  function spawnOne(boss = false) {
    if (enemies.length > 110) return;
    const ang = Math.random() * Math.PI * 2, dist = 470 + Math.random() * 130;
    const x = player.x + Math.cos(ang) * dist, y = player.y + Math.sin(ang) * dist;
    if (boss) {
      const hp = 700 * wave() * M;
      enemies.push({ x, y, hp, maxHp: hp, spd: 0.55, r: 38, kind: 4, xp: 40, t: 0, flash: 0, boss: true });
      addFloat(player.x, player.y - 56, "💀 受难者现身", BERRY);
      g.sfx.tone(110, 0.4, "sawtooth", 0.14, -30);
      return;
    }
    const avail = wave() >= 4 ? 4 : wave() >= 2 ? 3 : 2;
    const kind = g.rnd(avail);
    const def = [{ hp: 16, spd: 1.1, r: 13, xp: 1 }, { hp: 30, spd: 0.85, r: 16, xp: 2 }, { hp: 10, spd: 2.2, r: 10, xp: 1 }, { hp: 55, spd: 0.7, r: 18, xp: 3 }][kind];
    const hp = def.hp * (1 + wave() * 0.35) * M;
    enemies.push({ x, y, hp, maxHp: hp, spd: def.spd, r: def.r, kind, xp: def.xp, t: Math.random() * 999, flash: 0, boss: false });
  }

  function damageEnemy(e: Enemy, raw: number, isCrit = false) {
    const crit = isCrit || Math.random() < mods.crit;
    const dmg = raw * (crit ? 2 : 1);
    e.hp -= dmg; e.flash = 100;
    addFloat(e.x, e.y - e.r, String(Math.round(dmg)), crit ? "#ffd27a" : e.boss ? "#e8a89a" : "#f3ead8");
    if (e.hp <= 0) {
      player.kills++; contractKills++;
      freeze = e.boss ? 120 : 24;
      shake = Math.min(6, shake + (e.boss ? 6 : 1.4));
      g.juice.burst(e.x, e.y, ["#7a4a3a", "#5a5a6a", "#8a6f3a", "#4a5a4a", "#6a3a4a"][e.kind], e.boss ? 28 : 8);
      g.sfx.score();
      gems.push({ x: e.x, y: e.y, v: e.xp });
      if (mods.thorns > 0) { /* 荆棘对撞击者生效，在接触处处理 */ }
      checkContract();
    }
  }

  function rollGear(): Gear {
    const bases = ["锈蚀胸甲", "受难者指环", "骨制护符", "荆棘腰带", "暗金头盔", "血契之靴"];
    const AFFIXES: [string, Record<string, number>][] = [
      ["力量", { dmgPct: 0.25 }], ["迅捷", { ratePct: -0.15 }], ["鹰眼", { crit: 0.08 }],
      ["坚韧", { maxHp: 30 }], ["厚甲", { armor: 3 }], ["疾行", { move: 0.12 }],
      ["荆棘", { thorns: 12 }], ["磁力", { magnet: 30 }], ["连发", { multi: 1 }],
    ];
    const a = AFFIXES[g.rnd(AFFIXES.length)];
    const b = AFFIXES[g.rnd(AFFIXES.length)];
    const combined: Record<string, number> = { ...a[1] };
    if (a[0] !== b[0]) for (const k of Object.keys(b[1])) combined[k] = (combined[k] ?? 0) + b[1][k];
    const name = `${bases[g.rnd(bases.length)]} · ${a[0]}${a[0] !== b[0] ? "+" + b[0] : ""}`;
    return { name, affix: describe(combined), mods: combined };
  }
  function describe(m: Record<string, number>) {
    const parts: string[] = [];
    if (m.dmgPct) parts.push(`伤害+${Math.round(m.dmgPct * 100)}%`);
    if (m.ratePct) parts.push(`攻速+${Math.round(-m.ratePct * 100)}%`);
    if (m.crit) parts.push(`暴击+${Math.round(m.crit * 100)}%`);
    if (m.maxHp) parts.push(`生命+${m.maxHp}`);
    if (m.armor) parts.push(`护甲+${m.armor}`);
    if (m.move) parts.push(`移速+${Math.round(m.move * 100)}%`);
    if (m.thorns) parts.push(`荆棘+${m.thorns}`);
    if (m.magnet) parts.push(`磁吸+${m.magnet}`);
    if (m.multi) parts.push(`弹道+${m.multi}`);
    return parts.join(" · ");
  }
  function applyGear(gr: Gear) {
    const m = gr.mods;
    if (m.dmgPct) mods.dmg *= 1 + m.dmgPct;
    if (m.ratePct) mods.rate = Math.max(120, mods.rate * (1 + m.ratePct));
    if (m.crit) mods.crit += m.crit;
    if (m.maxHp) { player.maxHp += m.maxHp; player.hp = Math.min(player.maxHp, player.hp + m.maxHp); }
    if (m.armor) mods.armor += m.armor;
    if (m.move) mods.moveMul *= 1 + m.move;
    if (m.thorns) mods.thorns += m.thorns;
    if (m.magnet) player.magnet += m.magnet;
    if (m.multi) mods.multi += m.multi;
    gear.push(gr);
    g.sfx.win();
  }
  function checkContract() {
    if (contractKills >= contractTarget && !gearDrop && !dead) {
      gearDrop = rollGear();
      addFloat(player.x, player.y - 44, "📜 契约达成!", GOLD);
      g.sfx.tone(523, 0.12, "triangle", 0.1); setTimeout(() => g.sfx.tone(659, 0.12, "triangle", 0.1), 120); setTimeout(() => g.sfx.tone(784, 0.2, "triangle", 0.1), 240);
    }
  }

  const UP_INFO: Record<string, [string, string]> = {
    dmg: ["⚔ 开刃", "伤害 +35%"],
    rate: ["⏩ 狂热", "攻击间隔 -12%"],
    multi: ["🌠 分裂", "弹道 +1"],
    crit: ["🎯 致命", "暴击率 +8%"],
    armor: ["🛡 铁壁", "受到伤害 -3"],
    spd: ["👟 疾行", "移动速度 +10%"],
    magnet: ["🧲 贪婪", "拾取范围 +35"],
    hp: ["❤ 强壮", "生命上限 +30 并回复 30"],
    heal: ["🍖 盛宴", "立刻回复 40% 生命"],
  };
  function gainXp(v: number) {
    player.xp += v;
    while (player.xp >= player.xpNext) {
      player.xp -= player.xpNext; player.level++; player.xpNext = 6 + player.level * 4;
      const pool = ["dmg", "dmg", "rate", "rate", "multi", "crit", "crit", "armor", "spd", "magnet", "hp", "heal"];
      choices = [];
      while (choices.length < 3 && pool.length) choices.push(pool.splice(g.rnd(pool.length), 1)[0]);
      g.sfx.win();
    }
  }
  function applyUpgrade(k: string) {
    if (k === "dmg") mods.dmg *= 1.35;
    if (k === "rate") mods.rate = Math.max(120, mods.rate * 0.88);
    if (k === "multi") mods.multi++;
    if (k === "crit") mods.crit += 0.08;
    if (k === "armor") mods.armor += 3;
    if (k === "spd") mods.moveMul *= 1.1;
    if (k === "magnet") player.magnet += 35;
    if (k === "hp") { player.maxHp += 30; player.hp = Math.min(player.maxHp, player.hp + 30); }
    if (k === "heal") player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.4);
    choices = [];
    g.sfx.place();
  }

  function shoot(tx: number, ty: number) {
    const base = Math.atan2(ty - player.y, tx - player.x);
    for (let i = 0; i < mods.multi; i++) {
      const a = base + (i - (mods.multi - 1) / 2) * 0.14;
      projs.push({ x: player.x, y: player.y - 6, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, dmg: mods.dmg, pierce: 1, life: 650, c: "#e8a89a" });
    }
    player.face = tx > player.x ? 1 : -1;
    g.sfx.tone(700, 0.04, "square", 0.04, -350);
  }
  function autoShoot() {
    let target: Enemy | null = null, nd = 1e9;
    for (const e of enemies) if (e.hp > 0) { const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < nd) { nd = d; target = e; } }
    if (target) shoot(target.x, target.y);
  }
  function nova() {
    if (novaCd > 0 || dead) return;
    novaCd = 3200;
    const R = 150;
    for (const e of enemies) if (e.hp > 0 && Math.hypot(e.x - player.x, e.y - player.y) < R + e.r) damageEnemy(e, mods.dmg * 2.6, true);
    g.juice.burst(player.x, player.y, "#d8a03c", 26);
    shake = Math.min(8, shake + 5);
    g.sfx.boom();
    addFloat(player.x, player.y - 40, "🔥 烈焰新星!", "#ff9a5a");
  }

  function die() {
    dead = true; g.juice.burst(player.x, player.y, "#a33a2a", 26); g.sfx.over();
    if (!overSent) { overSent = true; setTimeout(() => g.over(Math.round(player.kills * 12 + player.level * 120 + gear.length * 300 + contractLv * 200)), 900); }
  }

  return {
    tick(dt) {
      if (dead) { shake = Math.max(0, shake - dt * 0.02); return; }
      if (choices.length || gearDrop) return;
      if (freeze > 0) { freeze -= dt; return; }
      const k = dt / 16.7;
      player.t += dt;
      player.hitT = Math.max(0, player.hitT - dt);
      hurtCd = Math.max(0, hurtCd - dt);
      novaCd = Math.max(0, novaCd - dt);
      shake = Math.max(0, shake - dt * 0.015);
      // 移动
      let mx = 0, my = 0;
      if (keys.l) mx -= 1; if (keys.r) mx += 1; if (keys.u) my -= 1; if (keys.d) my += 1;
      if (joy.on) { mx += joy.dx / 40; my += joy.dy / 40; }
      const ml = Math.hypot(mx, my);
      if (ml > 0) {
        const sp = player.spd * mods.moveMul * k;
        player.x += (mx / Math.max(1, ml)) * sp; player.y += (my / Math.max(1, ml)) * sp;
        if (mx) player.face = mx > 0 ? 1 : -1;
      }
      player.x = Math.max(20, Math.min(g.W - 20, player.x)); player.y = Math.max(20, Math.min(g.H - 20, player.y));
      // 刷怪
      spawnT -= dt * M;
      if (spawnT <= 0) { spawnT = Math.max(300, 950 - wave() * 70); spawnOne(); }
      if (wave() >= 3 && !enemies.some((e) => e.boss) && Math.floor(player.t / 40000) > Math.floor((player.t - dt) / 40000)) spawnOne(true);
      // 攻击：右摇杆瞄准射击，否则自动
      if (joyActive.on && Math.hypot(joyActive.dx, joyActive.dy) > 18) {
        shootT -= dt * 0.5; // 手动略快
        if (shootT <= 0) { shootT = mods.rate; shoot(player.x + joyActive.dx, player.y + joyActive.dy); }
      } else {
        shootT -= dt;
        if (shootT <= 0) { shootT = mods.rate; autoShoot(); }
      }
      // 子弹
      projs.forEach((p) => { p.x += p.vx * k; p.y += p.vy * k; p.life -= dt; });
      for (const p of projs) {
        if (p.life <= 0 || p.pierce <= 0) continue;
        for (const e of enemies) if (e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 6) { p.pierce--; damageEnemy(e, p.dmg); break; }
      }
      projs = projs.filter((p) => p.life > 0 && p.pierce > 0);
      // 敌人
      enemies.forEach((e) => {
        e.t += dt; e.flash = Math.max(0, e.flash - dt);
        const d = Math.hypot(player.x - e.x, player.y - e.y) || 1;
        e.x += ((player.x - e.x) / d) * e.spd * M * k; e.y += ((player.y - e.y) / d) * e.spd * M * k;
        if (d < e.r + 14 && hurtCd <= 0) {
          hurtCd = 700; player.hitT = 260;
          const raw = Math.max(2, (e.boss ? 22 : 8) * (g.difficulty === "easy" ? 0.7 : 1) - mods.armor);
          player.hp -= raw; shake = Math.min(7, shake + 4); g.sfx.hit();
          addFloat(player.x, player.y - 30, "-" + Math.round(raw), BERRY);
          if (mods.thorns > 0 && !e.boss) { e.hp -= mods.thorns; e.flash = 100; if (e.hp <= 0) { player.kills++; contractKills++; gems.push({ x: e.x, y: e.y, v: e.xp }); checkContract(); } }
          if (player.hp <= 0) die();
        }
      });
      enemies = enemies.filter((e) => e.hp > 0);
      // 经验
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
      // 哥特地砖
      ctx.fillStyle = "#161114"; ctx.fillRect(-10, -10, g.W + 20, g.H + 20);
      ctx.strokeStyle = "rgba(200,180,150,.05)";
      for (let i = 0; i < g.W; i += 48) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, g.H); ctx.stroke(); }
      for (let i = 0; i < g.H; i += 48) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(g.W, i); ctx.stroke(); }
      // 烛火装饰
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 197 + 60) % g.W), cy = ((i * 311 + 80) % g.H);
        const fl = Math.sin(player.t / 120 + i) * 2;
        ctx.fillStyle = "rgba(216,160,60,.16)"; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 7); ctx.fill();
        ctx.fillStyle = "#d8a03c"; ctx.fillRect(cx - 2, cy - 6 + fl, 4, 6);
      }
      // 敌人
      enemies.forEach((e) => {
        ctx.fillStyle = e.flash > 0 ? "#fff" : ["#7a4a3a", "#5a5a6a", "#8a6f3a", "#4a5a4a", "#6a3a4a"][e.kind];
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffd27a"; ctx.beginPath(); ctx.arc(e.x - e.r * 0.3, e.y - e.r * 0.2, e.r * 0.14, 0, 7); ctx.arc(e.x + e.r * 0.3, e.y - e.r * 0.2, e.r * 0.14, 0, 7); ctx.fill();
        if (e.boss) { ctx.strokeStyle = "#a33a2a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
        if (!e.boss && e.hp < e.maxHp) { ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(e.x - 13, e.y - e.r - 10, 26, 4); ctx.fillStyle = "#a33a2a"; ctx.fillRect(e.x - 13, e.y - e.r - 10, 26 * (e.hp / e.maxHp), 4); }
      });
      gems.forEach((gem) => { ctx.fillStyle = "#c9bfa8"; ctx.beginPath(); ctx.arc(gem.x, gem.y, 5, 0, 7); ctx.fill(); });
      projs.forEach((p) => { ctx.fillStyle = "#e8a89a"; ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 7); ctx.fill(); });
      // 玩家：受难骑士
      if (!dead) {
        const py = player.y + Math.sin(player.t / 200) * 1.5;
        if (player.hitT > 0) ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#4a4038"; rr(ctx, player.x - 9, py - 14, 18, 24, 6); ctx.fill();
        ctx.fillStyle = "#8a8078"; rr(ctx, player.x - 8, py - 12, 16, 12, 4); ctx.fill();
        ctx.fillStyle = "#c9bfa8"; ctx.beginPath(); ctx.arc(player.x, py - 19, 6.5, 0, 7); ctx.fill();
        ctx.fillStyle = "#a33a2a"; ctx.fillRect(player.x - 7, py - 26, 14, 4);
        const sa = Math.sin(player.t / 60) * 0.5;
        ctx.save(); ctx.translate(player.x + player.face * 12, py - 2); ctx.rotate(player.face * (-0.4 + sa));
        ctx.fillStyle = "#c9c2b0"; ctx.fillRect(-1.5, -20, 3, 18);
        ctx.fillStyle = "#d8a03c"; ctx.fillRect(-4, -3, 8, 3);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      // ============ HUD ============
      ctx.fillStyle = "rgba(0,0,0,.5)"; rr(ctx, 54, 16, g.W - 108, 12, 6); ctx.fill();
      const xw = (g.W - 108) * Math.min(1, player.xp / player.xpNext);
      if (xw > 1) { ctx.fillStyle = "#c9bfa8"; rr(ctx, 54, 16, xw, 12, 6); ctx.fill(); }
      ctx.fillStyle = "#161114"; ctx.beginPath(); ctx.arc(30, 22, 17, 0, 7); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(30, 22, 17, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
      txt(ctx, String(player.level), 30, 23, 14, BONE);
      // 血条（暗黑红色）
      ctx.fillStyle = "rgba(0,0,0,.55)"; rr(ctx, 14, 46, 150, 10, 5); ctx.fill();
      const hpF = Math.max(0, player.hp / player.maxHp);
      if (150 * hpF > 2) { ctx.fillStyle = "#a33a2a"; rr(ctx, 14, 46, 150 * hpF, 10, 5); ctx.fill(); }
      txt(ctx, `${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`, 89, 47, 8, "#fff");
      // 契约目标（核心驱动）
      ctx.fillStyle = "rgba(22,17,20,.85)"; rr(ctx, g.W - 170, 38, 156, 52, 10); ctx.fill();
      ctx.strokeStyle = "rgba(216,160,60,.5)"; rr(ctx, g.W - 170, 38, 156, 52, 10); ctx.stroke();
      txt(ctx, `📜 契约 ${contractLv}`, g.W - 92, 52, 12, GOLD);
      txt(ctx, `击杀 ${Math.min(contractKills, contractTarget)}/${contractTarget}`, g.W - 92, 72, 13, BONE);
      // 装备栏（最新一件）
      if (gear.length) {
        const last = gear[gear.length - 1];
        ctx.fillStyle = "rgba(22,17,20,.8)"; rr(ctx, 14, 66, 230, 26, 8); ctx.fill();
        txt(ctx, `🗡 ${last.name}`, 129, 79, 10.5, GOLD);
      }
      txt(ctx, `💀 ${player.kills}`, g.W - 40, 104, 13, "#cfe3c2");
      const boss = enemies.find((e) => e.boss);
      if (boss) {
        ctx.fillStyle = "rgba(0,0,0,.55)"; rr(ctx, 60, 96, g.W - 120, 10, 5); ctx.fill();
        ctx.fillStyle = "#a33a2a"; rr(ctx, 60, 96, (g.W - 120) * Math.max(0, boss.hp / boss.maxHp), 10, 5); ctx.fill();
        txt(ctx, "💀 受难者", g.W / 2, 92, 10, "#e8a89a");
      }
      // 新星冷却
      ctx.fillStyle = novaCd > 0 ? "rgba(233,242,228,.1)" : "rgba(216,160,60,.3)";
      ctx.beginPath(); ctx.arc(g.W - 74, g.H - 108, 34, 0, 7); ctx.fill();
      ctx.strokeStyle = novaCd > 0 ? "rgba(233,242,228,.3)" : GOLD; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(g.W - 74, g.H - 108, 34, 0, 7); ctx.stroke();
      if (novaCd > 0) { ctx.strokeStyle = "rgba(233,242,228,.6)"; ctx.beginPath(); ctx.arc(g.W - 74, g.H - 108, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - novaCd / 3200)); ctx.stroke(); }
      ctx.lineWidth = 1;
      txt(ctx, "🔥", g.W - 74, g.H - 110, 22, "#fff");
      txt(ctx, "新星", g.W - 74, g.H - 90, 10, "#cfe3c2");
      // 摇杆
      if (joy.on) {
        ctx.strokeStyle = "rgba(233,242,228,.3)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 44, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
        const jd = Math.min(40, Math.hypot(joy.dx, joy.dy)), ja = Math.atan2(joy.dy, joy.dx);
        ctx.fillStyle = "rgba(233,242,228,.5)"; ctx.beginPath(); ctx.arc(joy.ox + Math.cos(ja) * jd, joy.oy + Math.sin(ja) * jd, 18, 0, 7); ctx.fill();
      }
      if (joyActive.on && Math.hypot(joyActive.dx, joyActive.dy) > 18) {
        ctx.strokeStyle = "rgba(216,160,60,.5)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(player.x + joyActive.dx, player.y + joyActive.dy); ctx.stroke(); ctx.lineWidth = 1;
      }
      floats.forEach((f) => { ctx.globalAlpha = Math.min(1, f.t / 300); txt(ctx, f.s, f.x, f.y, 13, f.c); });
      ctx.globalAlpha = 1;
      if (dead) { ctx.fillStyle = "rgba(10,6,8,.85)"; ctx.fillRect(0, 0, g.W, g.H); txt(ctx, "💀 痛苦将你吞噬", g.W / 2, g.H / 2 - 16, 26, BONE); txt(ctx, `击杀 ${player.kills} · 装备 ${gear.length} 件`, g.W / 2, g.H / 2 + 20, 14, "#8a7f68"); }
      // 装备掉落弹窗
      if (gearDrop) {
        ctx.fillStyle = "rgba(10,6,8,.9)"; ctx.fillRect(0, 0, g.W, g.H);
        txt(ctx, "📜 契约达成 · 获得装备", g.W / 2, g.H / 2 - 110, 19, GOLD);
        rr(ctx, (g.W - 280) / 2, g.H / 2 - 80, 280, 100, 12);
        ctx.fillStyle = "#241c18"; ctx.fill();
        ctx.strokeStyle = GOLD; ctx.lineWidth = 2; rr(ctx, (g.W - 280) / 2, g.H / 2 - 80, 280, 100, 12); ctx.stroke(); ctx.lineWidth = 1;
        txt(ctx, gearDrop.name, g.W / 2, g.H / 2 - 48, 15, "#f3ead8");
        txt(ctx, gearDrop.affix, g.W / 2, g.H / 2 - 20, 12, "#8fd878");
        txt(ctx, "点击任意处穿上", g.W / 2, g.H / 2 + 44, 13, "#8a7f68");
      }
      // 升级三选一
      if (choices.length) {
        ctx.fillStyle = "rgba(10,6,8,.9)"; ctx.fillRect(0, 0, g.W, g.H);
        txt(ctx, "⬆ 升级！选择一样", g.W / 2, 90, 20, "#f3ead8");
        choices.forEach((c, i) => {
          const cw = 268, ch = 74, cx = (g.W - cw) / 2, cy = 140 + i * 96;
          rr(ctx, cx, cy, cw, ch, 12);
          ctx.fillStyle = "#241c18"; ctx.fill();
          ctx.strokeStyle = "rgba(216,160,60,.5)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
          const info = UP_INFO[c];
          txt(ctx, info[0], g.W / 2, cy + 26, 16, "#f3ead8");
          txt(ctx, info[1], g.W / 2, cy + 50, 11.5, "#8a7f68");
        });
      }
    },
    onPointer(tp, x, y, id) {
      if (dead) return;
      if (gearDrop) { if (tp === "down") { applyGear(gearDrop); gearDrop = null; contractKills = 0; contractLv++; contractTarget = 15 + contractLv * 8; } return; }
      if (choices.length) {
        if (tp !== "down") return;
        const cw = 268, cx = (g.W - cw) / 2;
        choices.forEach((c, i) => { const cy = 140 + i * 96; if (x > cx && x < cx + cw && y > cy && y < cy + 74) applyUpgrade(c); });
        return;
      }
      // 新星按钮
      if (tp === "down" && Math.hypot(x - (g.W - 74), y - (g.H - 108)) < 40) { nova(); return; }
      // 双摇杆：左半屏移动，右半屏瞄准射击
      const isLeft = x < g.W / 2;
      if (tp === "down") {
        if (isLeft) joy = { on: true, ox: x, oy: y, dx: 0, dy: 0, id: id ?? -1 };
        else joyActive = { on: true, ox: x, oy: y, dx: 0, dy: 0, id: id ?? -2 };
      }
      if (tp === "move") {
        if (joy.on && (id === undefined || id === joy.id)) { joy.dx = x - joy.ox; joy.dy = y - joy.oy; }
        if (joyActive.on && (id === undefined || id === joyActive.id)) { joyActive.dx = x - joyActive.ox; joyActive.dy = y - joyActive.oy; }
      }
      if (tp === "up") {
        if (id === undefined || id === joy.id) joy.on = false;
        if (id === undefined || id === joyActive.id) joyActive.on = false;
      }
    },
    onKey(code, down) {
      if (code === "ArrowLeft" || code === "KeyA") keys.l = down;
      if (code === "ArrowRight" || code === "KeyD") keys.r = down;
      if (code === "ArrowUp" || code === "KeyW") keys.u = down;
      if (code === "ArrowDown" || code === "KeyS") keys.d = down;
      if ((code === "Space" || code === "KeyJ") && down) nova();
    },
  };
}
