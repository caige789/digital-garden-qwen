/* 地下城幸存者（割草 Roguelite）· 觉醒进化 / 血月狂潮 / 宝箱 Buff / 冲刺 */
import { GameCtx, GameHandle, rr } from "./engine";
import { getHeroDef } from "../lib/api";

const GOLD = "#e0a33c", BERRY = "#d95d39";

interface Enemy { x: number; y: number; hp: number; maxHp: number; spd: number; r: number; kind: number; xp: number; t: number; hitCd: number; slow: number; elite: boolean; boss: boolean; flash: number }
interface Proj { x: number; y: number; vx: number; vy: number; dmg: number; pierce: number; life: number }
interface Boom { x: number; y: number; vx: number; vy: number; back: boolean; life: number; dmg: number; spin: number }
interface Spike { x: number; y: number; t: number; dmg: number; hit: boolean }
interface Gem { x: number; y: number; v: number }
interface Chest { x: number; y: number; t: number }
interface Float { x: number; y: number; s: string; c: string; t: number; big?: boolean }

export function createSurvivor(g: GameCtx): GameHandle {
  const M = g.mult;
  const SH = getHeroDef("survivor");
  let player = { x: 0, y: 0, hp: 100, maxHp: 100, spd: 2.6, magnet: 60, xp: 0, level: 1, xpNext: 8, kills: 0, t: 0, face: 1, might: 1, haste: 1, armor: 0, crit: 0.12, drain: 0, xpMul: 1, thorns: 0 };
  /* 角色加成 */
  player.spd *= 1 + (SH.mods.spd ?? 0);
  player.maxHp += SH.mods.hp ?? 0; player.hp = player.maxHp;
  player.might *= 1 + (SH.mods.might ?? 0);
  player.xpMul += SH.mods.xp ?? 0;
  player.magnet += SH.mods.magnet ?? 0;
  player.drain += SH.mods.drain ?? 0;
  const wpn = { bolt: 1, aura: 0, nova: 0, zap: 0, boom: 0, spike: 0, holy: 0, ice: 0, meteor: 0 };
  const evo = { bolt: false, aura: false, nova: false, zap: false, boom: false, spike: false, holy: false, ice: false, meteor: false };
  const CAP = { bolt: 8, aura: 6, nova: 6, zap: 6, boom: 6, spike: 6, holy: 5, ice: 5, meteor: 5 };

  let enemies: Enemy[] = [], gems: Gem[] = [], chests: Chest[] = [], projs: Proj[] = [], booms: Boom[] = [], spikes: Spike[] = [];
  let floats: Float[] = [];
  let particles: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
  let trail: { x: number; y: number; life: number; gold: boolean }[] = [];
  let boltT = 0, novaT = 0, zapT = 0, boomT = 0, spikeT = 0, auraAng = 0, holyAng = 0, holyHealT = 0;
  let spawnT = 0, bossWave = 0, bossActT = 0, shake = 0, freeze = 0, banner = 0, bannerTxt = "", bannerSub = "";
  let frenzyT = 0, shieldOn = false, magnetT = 0, fever = 0, lvlFlash = 0, pFlash = 0, dustT = 0;
  let bm = false, bmClock = 0, bmLeft = 0; // 血月
  let dashT = 0, dashCd = 0;
  let slowT = 0; // 冰霜法师减速
  let hpShown = player.maxHp; // 血条平滑
  let meteors: { x: number; y: number; t: number }[] = []; // 陨石
  let meteorT = 0, iceT = 0, iceRing = -1; // 新武器计时
  let dead = false, overSent = false;
  let lvlChoices: string[] = [];
  let keys = { l: false, r: false, u: false, d: false };
  let joy = { on: false, ox: 0, oy: 0, dx: 0, dy: 0, id: -1 };
  let hurtCd = 0;
  let dispXp = 0;

  const ENEMY_DEF = [
    { r: 14, hp: 22, spd: 1.05, xp: 1, c: "#6fae5a" }, // 史莱姆
    { r: 11, hp: 13, spd: 2.1, xp: 1, c: "#9a7ac4" },  // 蝙蝠
    { r: 17, hp: 70, spd: 0.72, xp: 3, c: "#cfc9b8" },  // 骷髅
    { r: 12, hp: 18, spd: 2.7, xp: 2, c: "#c98f4f" },   // 蜘蛛
    { r: 15, hp: 44, spd: 1.45, xp: 2, c: "#7fb8c8" },  // 幽灵
    { r: 13, hp: 30, spd: 1.8, xp: 2, c: "#b87f9a" },   // 裂体蠕虫（死亡分裂）
    { r: 15, hp: 55, spd: 1.15, xp: 4, c: "#7f9fd8" },  // 冰霜法师（霜环减速）
    { r: 19, hp: 160, spd: 0.55, xp: 5, c: "#8f9a7f" }, // 装甲甲虫（减伤坦克）
  ];
  const hpScale = (t: number) => 1 + t / 70000;
  const dmgMul = () => player.might * (frenzyT > 0 ? 1.35 : 1);
  const rateMul = () => player.haste * (frenzyT > 0 ? 1.5 : 1);

  function spawnOne(elite = false, boss = false) {
    if (enemies.length > 130) return;
    const ang = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * 160;
    const x = player.x + Math.cos(ang) * dist, y = player.y + Math.sin(ang) * dist;
    if (boss) {
      const hp = 500 * (bossWave + 1) * (1 + bossWave * 0.5) * M;
      enemies.push({ x, y, hp, maxHp: hp, spd: 0.5 + bossWave * 0.08, r: Math.min(64, 40 + bossWave * 5), kind: 2, xp: 60 + bossWave * 30, t: 0, hitCd: 0, slow: 0, elite: false, boss: true, flash: 0 });
      return;
    }
    const avail = player.t > 100000 ? 8 : player.t > 70000 ? 7 : player.t > 45000 ? 6 : player.t > 28000 ? 4 : player.t > 12000 ? 3 : player.t > 5000 ? 2 : 1;
    const kind = g.rnd(avail);
    const d = ENEMY_DEF[kind];
    const hp = d.hp * M * hpScale(player.t) * (elite ? 5 : 1);
    enemies.push({ x, y, hp, maxHp: hp, spd: d.spd * (0.9 + Math.random() * 0.3) * (elite ? 0.85 : 1), r: d.r * (elite ? 1.6 : 1), kind, xp: d.xp * (elite ? 8 : 1), t: Math.random() * 999, hitCd: 0, slow: 0, elite, boss: false, flash: 0 });
  }
  const addFloat = (x: number, y: number, s: string, c: string, big = false) => { if (floats.length < 40) floats.push({ x, y, s, c, t: 700, big }); };
  function burst(x: number, y: number, c: string, n: number) {
    for (let i = 0; i < n && particles.length < 170; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 420, c });
  }
  const dropGem = (x: number, y: number, v: number) => { if (gems.length < 160) gems.push({ x, y, v }); };

  function damageEnemy(e: Enemy, raw: number) {
    const crit = Math.random() < player.crit;
    const armorMul = e.kind === 7 ? 0.5 : 1; // 装甲甲虫减伤
    const dmg = raw * dmgMul() * (crit ? 2 : 1) * armorMul;
    e.hp -= dmg; e.flash = 110;
    addFloat(e.x + (Math.random() - 0.5) * 10, e.y - e.r, String(Math.round(dmg)), crit ? GOLD : e.boss ? "#ffd27a" : "#fff", crit);
    if (crit) { shake = Math.min(6, shake + 2); g.sfx.tone(1400, 0.05, "square", 0.06, -500); }
    if (e.hp <= 0) {
      player.kills++;
      if (player.drain > 0) player.hp = Math.min(player.maxHp, player.hp + player.drain); // 汲取回血
      freeze = e.boss ? 130 : e.elite ? 70 : 30;
      shake = Math.min(5, shake + (e.boss ? 5 : e.elite ? 3 : 1));
      fever = Math.min(100, fever + (e.boss ? 30 : e.elite ? 10 : 2));
      if (fever >= 100 && frenzyT <= 0) { frenzyT = 6000; fever = 0; addFloat(player.x, player.y - 60, "🔥 怒气爆发!", GOLD, true); particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 500, c: "lv" }); g.sfx.win(); }
      if (player.kills % 50 === 0) addFloat(player.x, player.y - 60, `⚔ ${player.kills} 连杀!`, GOLD);
      burst(e.x, e.y, ENEMY_DEF[e.kind].c, e.boss ? 30 : e.elite ? 16 : 7);
      particles.push({ x: e.x, y: e.y, vx: 0, vy: -1.2, life: 550, c: "skull" });
      g.sfx.score();
      const gv = bm ? 2 : 1;
      if (e.boss) {
        g.sfx.boom(); dropGem(e.x, e.y, 30 * gv); dropGem(e.x + 22, e.y, 20 * gv); dropGem(e.x - 22, e.y, 20 * gv);
        chests.push({ x: e.x, y: e.y + 30, t: 0 }, { x: e.x + 40, y: e.y - 20, t: 0 });
      } else {
        dropGem(e.x, e.y, e.xp * gv);
        if (e.elite && Math.random() < 0.4) chests.push({ x: e.x, y: e.y, t: 0 });
        // 裂体蠕虫：死亡分裂成两只小蠕虫（小个体 r=9 不再分裂）
        if (e.kind === 5 && e.r >= 12 && enemies.length < 120) {
          for (const off of [-16, 16]) {
            const hp2 = 14 * hpScale(player.t);
            enemies.push({ x: e.x + off, y: e.y + (Math.random() - 0.5) * 12, hp: hp2, maxHp: hp2, spd: 2.4, r: 9, kind: 5, xp: 1, t: Math.random() * 999, hitCd: 0, slow: 0, elite: false, boss: false, flash: 0 });
          }
          addFloat(e.x, e.y - 20, "💥 分裂!", "#b87f9a");
        }
      }
    }
  }

  const UP_INFO: Record<string, [string, string]> = {
    bolt: ["🔮 魔法弹", "射向最近敌人，升级加伤害与数量"],
    aura: ["🌀 旋风刃", "环绕自身的旋转刀刃"],
    nova: ["❄️ 冰霜新星", "周期性冰环，伤害并减速"],
    zap: ["⚡ 闪电链", "自动连锁劈中多个敌人"],
    boom: ["🪃 回旋镖", "掷出后飞回，往返都造成伤害"],
    spike: ["🗡 地刺", "在敌群脚下突然爆出尖刺"],
    holy: ["✨ 圣光环绕", "光球伤敌，并缓慢治疗自己"],
    ice: ["❄️ 寒冰环", "环绕的冰霜光圈，持续伤敌并减速"],
    meteor: ["☄️ 陨石坠落", "周期性轰炸敌人最密集处"],
    evo_ice: ["🧊 觉醒·永冬领域", "冰环范围大增，伤害翻倍"],
    evo_meteor: ["🌠 觉醒·星陨天罚", "陨石范围大增，伤害翻倍"],
    evo_bolt: ["🌟 觉醒·星陨弹", "弹体 +2 并追踪敌人，伤害翻倍"],
    evo_aura: ["🌪 觉醒·刃风暴", "刀刃 +2、范围大增，伤害翻倍"],
    evo_nova: ["🧊 觉醒·绝对零度", "冰环冻结敌人 2.6 秒，伤害翻倍"],
    evo_zap: ["⛈ 觉醒·雷神之怒", "连锁 +3，伤害翻倍"],
    evo_boom: ["☄️ 觉醒·双子回旋", "回旋镖 +2，伤害翻倍"],
    evo_spike: ["🌋 觉醒·大地崩裂", "尖刺 +2、范围更大，伤害翻倍"],
    evo_holy: ["☀️ 觉醒·圣耀之环", "光球 +2、治疗翻倍，伤害翻倍"],
    hp: ["❤️ 强壮", "生命上限 +30 并回复 30"],
    spd: ["👟 疾行", "移动速度 +8%"],
    magnet: ["🧲 磁力", "经验吸取范围 +34"],
    heal: ["🍖 大餐", "立刻回复 50% 生命"],
    might: ["💪 力量", "全部伤害 +12%"],
    haste: ["⏩ 急速", "全部武器攻速 +12%"],
    armor: ["🛡 厚甲", "受到的伤害 -2"],
    crit: ["🎯 暴击", "暴击率 +10%，暴击伤害 ×2"],
    drain: ["🩸 汲取", "每次击杀回复 2 点生命"],
    scholar: ["📚 学者", "获得的经验 +25%"],
    thorns: ["🌵 荆棘", "撞到你的敌人受到 10 点伤害"],
  };
  let passives = { might: 8, haste: 8, armor: 8, crit: 5, drain: 5, scholar: 4, thorns: 3, heal: 99, hp: 99, spd: 99, magnet: 99 };

  function gainXp(v: number) {
    player.xp += v * player.xpMul;
    while (player.xp >= player.xpNext) {
      player.xp -= player.xpNext; player.level++; player.xpNext = 6 + player.level * 4;
      const pool: string[] = [];
      (Object.keys(wpn) as (keyof typeof wpn)[]).forEach((wkey) => {
        if (wpn[wkey] < CAP[wkey]) pool.push(wkey);
        else if (!evo[wkey]) pool.push("evo_" + wkey);
      });
      (Object.keys(passives) as (keyof typeof passives)[]).forEach((pk) => { if (passives[pk] > 0) pool.push(pk); });
      pool.push("hp", "spd", "magnet", "heal");
      const picks: string[] = [];
      while (picks.length < 3 && pool.length) picks.push(pool.splice(g.rnd(pool.length), 1)[0]);
      lvlChoices = picks;
      lvlFlash = 800;
      particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 500, c: "lv" });
      burst(player.x, player.y, "#ffd27a", 14);
      g.sfx.win();
    }
  }
  function applyUpgrade(k: string) {
    if (k.startsWith("evo_")) {
      const wkey = k.slice(4) as keyof typeof evo;
      evo[wkey] = true;
      addFloat(player.x, player.y - 50, "觉醒!", GOLD, true);
      particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 600, c: "lv" });
      shake = 5; g.sfx.win();
    } else if (k === "bolt") wpn.bolt++;
    else if (k === "aura") wpn.aura++;
    else if (k === "nova") wpn.nova++;
    else if (k === "zap") wpn.zap++;
    else if (k === "boom") wpn.boom++;
    else if (k === "spike") wpn.spike++;
    else if (k === "holy") wpn.holy++;
    else if (k === "hp") { player.maxHp += 30; player.hp = Math.min(player.maxHp, player.hp + 30); }
    else if (k === "spd") player.spd *= 1.08;
    else if (k === "magnet") player.magnet += 34;
    else if (k === "heal") player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.5);
    else if (k === "might") { player.might *= 1.12; passives.might--; }
    else if (k === "haste") { player.haste *= 1.12; passives.haste--; }
    else if (k === "armor") { player.armor += 2; passives.armor--; }
    else if (k === "crit") { player.crit += 0.1; passives.crit--; }
    else if (k === "drain") { player.drain += 2; passives.drain--; }
    else if (k === "scholar") { player.xpMul += 0.25; passives.scholar--; }
    else if (k === "thorns") { player.thorns += 10; passives.thorns--; }
    lvlChoices = [];
    g.sfx.place();
  }
  function die() {
    dead = true; shake = 10; g.sfx.over(); burst(player.x, player.y, "#f0a52e", 26);
    if (!overSent) {
      overSent = true;
      const score = Math.round(player.kills * 10 + player.level * 250 + player.t / 100);
      setTimeout(() => g.over(score), 900);
    }
  }
  function tryDash() {
    if (dashCd > 0 || dead || lvlChoices.length) return;
    dashT = 190; dashCd = 2600; shake = Math.min(6, shake + 2);
    g.sfx.tone(500, 0.12, "triangle", 0.08, 600);
  }
  function openChest() {
    const roll = g.rnd(4);
    g.sfx.win(); burst(player.x, player.y, GOLD, 16);
    if (roll === 0) { frenzyT = 8000; addFloat(player.x, player.y - 50, "🔥 狂暴 8 秒!", GOLD, true); }
    else if (roll === 1) { magnetT = 6000; addFloat(player.x, player.y - 50, "🧲 宝石风暴!", "#6fd8c4", true); }
    else if (roll === 2) { player.hp = player.maxHp; addFloat(player.x, player.y - 50, "❤️ 完全回复!", "#9fd878", true); }
    else { shieldOn = true; addFloat(player.x, player.y - 50, "🛡 获得护盾!", "#8fd8e8", true); }
  }

  /* 暗角（离屏生成一次，每帧贴图，零开销） */
  const vig = (() => {
    const c = document.createElement("canvas"); c.width = g.W; c.height = g.H;
    const v = c.getContext("2d")!;
    const gr = v.createRadialGradient(g.W / 2, g.H / 2, g.H * 0.3, g.W / 2, g.H / 2, g.H * 0.66);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.52)");
    v.fillStyle = gr; v.fillRect(0, 0, g.W, g.H);
    return c;
  })();

  return {
    currentScore() { return Math.round(player.kills * 10 + player.level * 250 + player.t / 100); },
    tick(dt) {
      if (dead) { particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.life -= dt; }); particles = particles.filter((p) => p.life > 0); shake = Math.max(0, shake - dt * 0.02); return; }
      if (lvlChoices.length) return;
      banner = Math.max(0, banner - dt);
      if (freeze > 0) { freeze -= dt; return; }
      const k = dt / 16.7;
      player.t += dt;
      hurtCd = Math.max(0, hurtCd - dt); dashCd = Math.max(0, dashCd - dt); dashT = Math.max(0, dashT - dt);
      slowT = Math.max(0, slowT - dt);
      frenzyT = Math.max(0, frenzyT - dt); magnetT = Math.max(0, magnetT - dt); pFlash = Math.max(0, pFlash - dt); lvlFlash = Math.max(0, lvlFlash - dt);
      fever = Math.max(0, fever - 4 * (dt / 1000));
      shake = Math.max(0, shake - dt * 0.012);
      dispXp += (player.xp / player.xpNext - dispXp) * 0.18 * k;
      // 血月：每 75 秒升起，持续 12 秒，怪潮 ×2.5、经验 ×2
      if (!bm) { bmClock += dt; if (bmClock > 75000) { bm = true; bmLeft = 12000; bmClock = 0; banner = 2600; bannerTxt = "🌕 血月升起"; bannerSub = "怪潮来袭 · 经验翻倍"; g.sfx.tone(110, 0.6, "sawtooth", 0.14, -30); shake = 6; } }
      else { bmLeft -= dt; if (bmLeft <= 0) bm = false; }

      // 移动 + 冲刺
      let mx = 0, my = 0;
      if (keys.l) mx--; if (keys.r) mx++; if (keys.u) my--; if (keys.d) my++;
      if (joy.on) { mx += joy.dx / 40; my += joy.dy / 40; }
      const ml = Math.hypot(mx, my);
      const spdNow = player.spd * (dashT > 0 ? 3.3 : 1) * (slowT > 0 ? 0.55 : 1);
      if (ml > 0) {
        player.x += (mx / Math.max(1, ml)) * spdNow * k; player.y += (my / Math.max(1, ml)) * spdNow * k; if (mx) player.face = mx > 0 ? 1 : -1;
        dustT -= dt;
        if (dustT <= 0) { dustT = dashT > 0 ? 30 : 130; particles.push({ x: player.x - player.face * 6, y: player.y + 16, vx: -player.face * 0.5, vy: -0.3, life: 300, c: dashT > 0 ? "gold" : "dust" }); }
        if (trail.length < 16 && (trail.length === 0 || Math.hypot(player.x - trail[trail.length - 1].x, player.y - trail[trail.length - 1].y) > 8)) trail.push({ x: player.x, y: player.y, life: 240, gold: dashT > 0 || frenzyT > 0 });
      }
      trail.forEach((tr) => (tr.life -= dt));
      trail = trail.filter((tr) => tr.life > 0);

      // 刷怪
      spawnT -= dt;
      const bmMul = bm ? 2.5 : 1;
      if (spawnT <= 0) {
        spawnT = Math.max(240, 950 - player.t * 0.006) / M / bmMul;
        const n = 1 + Math.floor(player.t / 40000);
        for (let i = 0; i < n; i++) spawnOne();
      }
      if (player.t > (bossWave + 1) * 60000) { bossWave++; spawnOne(false, true); g.sfx.tone(140, 0.4, "sawtooth", 0.16, -40); banner = 2400; bannerTxt = `☠ 第 ${bossWave} 位骷髅王驾到`; bannerSub = bossWave > 1 ? "它比上一位更大、更快、更硬" : "小心它的冲击波"; shake = 6; }
      if (player.t > 60000 && Math.random() < 0.004 * k) spawnOne(true);

      // ---- 武器 ----
      const R = rateMul();
      boltT -= dt * R;
      if (wpn.bolt > 0 && boltT <= 0) {
        boltT = Math.max(240, 700 - 65 * wpn.bolt);
        let nearest: Enemy | null = null, nd = 1e9;
        for (const e of enemies) { const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < nd && d < 480) { nd = d; nearest = e; } }
        if (nearest) {
          const n = 1 + Math.floor((wpn.bolt - 1) / 2) + (evo.bolt ? 2 : 0);
          const base = Math.atan2(nearest.y - player.y, nearest.x - player.x);
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.22;
            projs.push({ x: player.x, y: player.y - 10, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8, dmg: (10 + 6 * wpn.bolt) * (evo.bolt ? 2 : 1), pierce: 1 + Math.floor(wpn.bolt / 3), life: 900 });
          }
          g.sfx.tone(760, 0.05, "square", 0.04, 260);
        }
      }
      if (wpn.aura > 0) {
        auraAng += 0.055 * k * R;
        const AR = 66 + 10 * wpn.aura + (evo.aura ? 30 : 0), blades = 2 + wpn.aura + (evo.aura ? 2 : 0);
        for (let b = 0; b < blades; b++) {
          const a = auraAng + (Math.PI * 2 * b) / blades;
          const bx = player.x + Math.cos(a) * AR, by = player.y + Math.sin(a) * AR;
          for (const e of enemies) if (e.hp > 0 && e.hitCd <= 0 && Math.hypot(e.x - bx, e.y - by) < e.r + 16) { e.hitCd = 420; damageEnemy(e, (8 + 5 * wpn.aura) * (evo.aura ? 2 : 1)); }
        }
      }
      enemies.forEach((e) => (e.hitCd = Math.max(0, e.hitCd - dt)));
      novaT -= dt * R;
      if (wpn.nova > 0 && novaT <= 0) {
        novaT = Math.max(1800, 4200 - 400 * wpn.nova);
        const NR = 110 + 25 * wpn.nova + (evo.nova ? 40 : 0);
        for (const e of enemies) if (e.hp > 0 && Math.hypot(e.x - player.x, e.y - player.y) < NR + e.r) { e.slow = evo.nova ? 2600 : 1600; damageEnemy(e, (15 + 8 * wpn.nova) * (evo.nova ? 2 : 1)); }
        particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 380, c: "ring" });
        g.sfx.tone(500, 0.14, "sine", 0.1, -260);
      }
      zapT -= dt * R;
      if (wpn.zap > 0 && zapT <= 0) {
        zapT = Math.max(1200, 2600 - 300 * wpn.zap);
        let from = { x: player.x, y: player.y - 10 };
        const hitSet = new Set<Enemy>();
        for (let i = 0; i < 2 + wpn.zap + (evo.zap ? 3 : 0); i++) {
          let target: Enemy | null = null, nd2 = 320;
          for (const e of enemies) { if (e.hp <= 0 || hitSet.has(e)) continue; const d = Math.hypot(e.x - from.x, e.y - from.y); if (d < nd2) { nd2 = d; target = e; } }
          if (!target) break;
          hitSet.add(target);
          particles.push({ x: from.x, y: from.y, vx: target.x, vy: target.y, life: 200, c: "zap" });
          damageEnemy(target, (20 + 10 * wpn.zap) * (evo.zap ? 2 : 1));
          from = { x: target.x, y: target.y };
        }
        if (hitSet.size) g.sfx.tone(1200, 0.07, "sawtooth", 0.07, -700);
      }
      boomT -= dt * R;
      if (wpn.boom > 0 && boomT <= 0) {
        boomT = Math.max(900, 1800 - 140 * wpn.boom);
        let target: Enemy | null = null, nd3 = 1e9;
        for (const e of enemies) { const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < nd3) { nd3 = d; target = e; } }
        const a = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.face > 0 ? 0 : Math.PI;
        const cnt = Math.min(3, wpn.boom) + (evo.boom ? 2 : 0);
        for (let i = 0; i < cnt; i++) {
          const aa = a + (i - (cnt - 1) / 2) * 0.4;
          booms.push({ x: player.x, y: player.y - 8, vx: Math.cos(aa) * 7.5, vy: Math.sin(aa) * 7.5, back: false, life: 1400, dmg: (14 + 8 * wpn.boom) * (evo.boom ? 2 : 1), spin: 0 });
        }
        g.sfx.tone(600, 0.08, "triangle", 0.06, 300);
      }
      booms.forEach((b) => {
        b.spin += 0.4 * k; b.life -= dt;
        if (!b.back) { b.vx *= 1 - 0.05 * k; b.vy *= 1 - 0.05 * k; if (b.life < 700) b.back = true; }
        else { const d = Math.hypot(player.x - b.x, player.y - b.y) || 1; b.vx += ((player.x - b.x) / d) * 0.9 * k; b.vy += ((player.y - b.y) / d) * 0.9 * k; const sp = Math.hypot(b.vx, b.vy); if (sp > 9) { b.vx = (b.vx / sp) * 9; b.vy = (b.vy / sp) * 9; } if (d < 18) b.life = 0; }
        b.x += b.vx * k; b.y += b.vy * k;
        for (const e of enemies) if (e.hp > 0 && e.hitCd <= 0 && Math.hypot(e.x - b.x, e.y - b.y) < e.r + 12) { e.hitCd = 260; damageEnemy(e, b.dmg); }
      });
      booms = booms.filter((b) => b.life > 0);
      spikeT -= dt * R;
      if (wpn.spike > 0 && spikeT <= 0 && enemies.length) {
        spikeT = Math.max(1100, 2300 - 220 * wpn.spike);
        const targets = [...enemies].sort(() => Math.random() - 0.5).slice(0, 1 + wpn.spike + (evo.spike ? 2 : 0));
        targets.forEach((e) => spikes.push({ x: e.x, y: e.y, t: 700, dmg: (26 + 12 * wpn.spike) * (evo.spike ? 2 : 1), hit: false }));
        g.sfx.tone(300, 0.08, "sawtooth", 0.06, -100);
      }
      spikes.forEach((s) => {
        s.t -= dt;
        if (s.t < 220 && !s.hit) {
          s.hit = true;
          for (const e of enemies) if (e.hp > 0 && Math.hypot(e.x - s.x, e.y - s.y) < (evo.spike ? 82 : 66)) damageEnemy(e, s.dmg);
          burst(s.x, s.y, "#c9c2b0", 8);
        }
      });
      spikes = spikes.filter((s) => s.t > 0);
      if (wpn.holy > 0) {
        holyAng += 0.04 * k;
        holyHealT -= dt;
        if (holyHealT <= 0) { holyHealT = 1200; player.hp = Math.min(player.maxHp, player.hp + (1 + wpn.holy) * (evo.holy ? 2 : 1)); }
        const orbs = 1 + Math.min(3, wpn.holy) + (evo.holy ? 2 : 0);
        for (let o = 0; o < orbs; o++) {
          const a = holyAng + (Math.PI * 2 * o) / orbs;
          const ox = player.x + Math.cos(a) * 82, oy = player.y + Math.sin(a) * 82;
          for (const e of enemies) if (e.hp > 0 && e.hitCd <= 0 && Math.hypot(e.x - ox, e.y - oy) < e.r + 13) { e.hitCd = 300; damageEnemy(e, (7 + 4 * wpn.holy) * (evo.holy ? 2 : 1)); }
        }
      }
      // 寒冰环：环绕玩家的冰霜光圈，持续伤害+减速
      if (wpn.ice > 0) {
        const IR = 100 + 18 * wpn.ice + (evo.ice ? 30 : 0);
        iceT += dt;
        for (const e of enemies) if (e.hp > 0 && e.hitCd <= 0 && Math.hypot(e.x - player.x, e.y - player.y) < IR + e.r) {
          e.hitCd = 320; e.slow = Math.max(e.slow, 1200); damageEnemy(e, (6 + 3 * wpn.ice) * (evo.ice ? 2 : 1));
        }
      }
      // 陨石：周期性从天而降轰炸最密集区域
      if (wpn.meteor > 0) {
        meteorT -= dt;
        if (meteorT <= 0) {
          meteorT = Math.max(1600, 3600 - 300 * wpn.meteor);
          // 选敌人最密集处
          let tx = player.x + (Math.random() - 0.5) * 200, ty = player.y + (Math.random() - 0.5) * 200, bestN = 0;
          for (const e of enemies) if (e.hp > 0) {
            const n = enemies.filter((o) => o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 90).length;
            if (n > bestN) { bestN = n; tx = e.x; ty = e.y; }
          }
          meteors.push({ x: tx, y: ty, t: 700 });
          g.sfx.tone(200, 0.3, "sawtooth", 0.1, -80);
        }
      }
      meteors.forEach((m) => {
        m.t -= dt;
        if (m.t <= 0 && m.t > -1) {
          const MR = 95 + (evo.meteor ? 35 : 0);
          for (const e of enemies) if (e.hp > 0 && Math.hypot(e.x - m.x, e.y - m.y) < MR + e.r) damageEnemy(e, (28 + 12 * wpn.meteor) * (evo.meteor ? 2 : 1));
          burst(m.x, m.y, "#e0a33c", 24); burst(m.x, m.y, "#d95d39", 16);
          shake = Math.min(8, shake + 6);
          particles.push({ x: m.x, y: m.y, vx: 0, vy: 0, life: 500, c: "mboom" });
          g.sfx.boom();
        }
      });
      meteors = meteors.filter((m) => m.t > -1);
      // 弹道（觉醒星陨弹带追踪）
      projs.forEach((p) => {
        if (evo.bolt) {
          let nt: Enemy | null = null, nd = 260;
          for (const e of enemies) if (e.hp > 0) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < nd) { nd = d; nt = e; } }
          if (nt) { const ta = Math.atan2(nt.y - p.y, nt.x - p.x), ca = Math.atan2(p.vy, p.vx); let da = ta - ca; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; const na = ca + Math.max(-0.09, Math.min(0.09, da)) * k; const sp = Math.hypot(p.vx, p.vy); p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp; }
        }
        p.x += p.vx * k; p.y += p.vy * k; p.life -= dt;
        for (const e of enemies) {
          if (e.hp <= 0 || p.pierce <= 0) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 7) { p.pierce--; damageEnemy(e, p.dmg); burst(p.x, p.y, evo.bolt ? "#ffd27a" : "#bfe8a8", 3); break; }
        }
      });
      projs = projs.filter((p) => p.life > 0 && p.pierce > 0);
      // 敌人移动 + 接触伤害
      enemies.forEach((e) => {
        e.t += dt; e.slow = Math.max(0, e.slow - dt); e.flash = Math.max(0, e.flash - dt);
        const sp = e.spd * (e.slow > 0 ? (evo.nova && e.slow > 1800 ? 0.1 : 0.45) : 1) * M * k;
        const d = Math.hypot(player.x - e.x, player.y - e.y) || 1;
        e.x += ((player.x - e.x) / d) * sp; e.y += ((player.y - e.y) / d) * sp;
        // 冰霜法师：周期性霜环减速玩家
        if (e.kind === 6 && Math.floor(e.t / 2600) !== Math.floor((e.t - dt) / 2600)) {
          if (d < 110 && dashT <= 0) { slowT = 1800; addFloat(player.x, player.y - 30, "❄ 冰冻减速!", "#8fd8e8"); g.sfx.tone(600, 0.2, "triangle", 0.08, -300); }
          burst(e.x, e.y, "#8fd8e8", 8);
        }
        if (d < e.r + 14 && hurtCd <= 0 && dashT <= 0) {
          hurtCd = 700;
          const raw = Math.max(2, (e.boss ? 22 : e.elite ? 14 : 8) * (g.difficulty === "easy" ? 0.7 : 1) - player.armor);
          if (shieldOn) { shieldOn = false; addFloat(player.x, player.y - 30, "🛡 抵挡!", "#8fd8e8"); g.sfx.hit(); }
          else {
            player.hp -= raw; pFlash = 260;
            shake = Math.min(6, shake + 4); g.sfx.hit(); addFloat(player.x, player.y - 30, "-" + Math.round(raw), BERRY);
            if (player.hp <= 0) die();
          }
        }
      });
      enemies = enemies.filter((e) => e.hp > 0);
      // Boss 冲击波
      const boss = enemies.find((e) => e.boss);
      if (boss) {
        bossActT += dt;
        if (bossActT > 4200) {
          bossActT = 0;
          particles.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, life: 900, c: "wave" });
          g.sfx.tone(90, 0.35, "sawtooth", 0.14, -20);
          shake = Math.min(6, shake + 3);
        }
      }
      particles.forEach((p) => {
        if (p.c === "wave" && p.life > 0) {
          const rad = (1 - p.life / 900) * 340;
          const d = Math.hypot(player.x - p.x, player.y - p.y);
          if (Math.abs(d - rad) < 24 && hurtCd <= 0 && dashT <= 0) {
            hurtCd = 700;
            if (shieldOn) { shieldOn = false; addFloat(player.x, player.y - 30, "🛡 抵挡!", "#8fd8e8"); }
            else { player.hp -= Math.max(4, 16 - player.armor); pFlash = 260; shake = Math.min(6, shake + 4); g.sfx.hit(); addFloat(player.x, player.y - 30, "-" + Math.max(4, 16 - player.armor), BERRY); if (player.hp <= 0) die(); }
          }
        }
      });
      // 宝石
      gems.forEach((gem) => {
        const d = Math.hypot(player.x - gem.x, player.y - gem.y) || 1;
        const range = magnetT > 0 ? 9999 : player.magnet;
        if (d < range) { const pull = magnetT > 0 ? 13 : 7; gem.x += ((player.x - gem.x) / d) * pull * k; gem.y += ((player.y - gem.y) / d) * pull * k; }
      });
      gems = gems.filter((gem) => {
        if (gem.v === 0) return false;
        if (Math.hypot(player.x - gem.x, player.y - gem.y) < 20) { gainXp(gem.v); g.sfx.coin(); return false; }
        return true;
      });
      // 宝箱
      chests.forEach((c) => (c.t += dt));
      chests = chests.filter((c) => {
        if (Math.hypot(player.x - c.x, player.y - c.y) < 30) { openChest(); return false; }
        return c.t < 30000;
      });
      floats.forEach((f) => { f.y -= 0.03 * dt; f.t -= dt; });
      floats = floats.filter((f) => f.t > 0);
      particles.forEach((p) => { if (p.c !== "zap" && p.c !== "ring" && p.c !== "lv" && p.c !== "wave") { p.x += p.vx * k; p.y += p.vy * k; } p.life -= dt; });
      particles = particles.filter((p) => p.life > 0);
    },

    draw(ctx) {
      ctx.fillStyle = "#12100e"; ctx.fillRect(0, 0, g.W, g.H);
      const camX = player.x - g.W / 2 + (shake > 0.5 ? (Math.random() - 0.5) * shake : 0);
      const camY = player.y - g.H / 2 + (shake > 0.5 ? (Math.random() - 0.5) * shake : 0);
      ctx.save(); ctx.translate(-camX, -camY);
      // 地砖网格
      ctx.strokeStyle = "rgba(233,242,228,0.03)";
      const GS = 80;
      for (let x = Math.floor(camX / GS) * GS; x < camX + g.W + GS; x += GS) { ctx.beginPath(); ctx.moveTo(x, camY - GS); ctx.lineTo(x, camY + g.H + GS); ctx.stroke(); }
      for (let y = Math.floor(camY / GS) * GS; y < camY + g.H + GS; y += GS) { ctx.beginPath(); ctx.moveTo(camX - GS, y); ctx.lineTo(camX + g.W + GS, y); ctx.stroke(); }
      // 地面装饰：烛火 / 碎石 / 荧光菇
      const gx0 = Math.floor(camX / (GS * 2)) * GS * 2, gy0 = Math.floor(camY / (GS * 2)) * GS * 2;
      for (let x = gx0; x < camX + g.W + GS * 2; x += GS * 2) for (let y = gy0; y < camY + g.H + GS * 2; y += GS * 2) {
        const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        if (h < 0.12) {
          const fl = Math.sin(Date.now() / 180 + x) * 1.6;
          ctx.fillStyle = "rgba(240,165,46,.13)"; ctx.beginPath(); ctx.arc(x + 30, y + 30, 19 + fl, 0, 7); ctx.fill();
          ctx.fillStyle = "rgba(240,165,46,.6)"; ctx.beginPath(); ctx.arc(x + 30, y + 30, 4 + fl * 0.5, 0, 7); ctx.fill();
          ctx.fillStyle = "rgba(90,70,50,.8)"; ctx.fillRect(x + 28, y + 34, 4, 8);
        } else if (h > 0.9) { ctx.fillStyle = "rgba(233,242,228,.06)"; rr(ctx, x + 12, y + 40, 26, 12, 5); ctx.fill(); }
        else if (h > 0.3 && h < 0.36) {
          const pu = 0.6 + Math.sin(Date.now() / 500 + y) * 0.4;
          ctx.fillStyle = `rgba(111,216,196,${0.08 * pu})`; ctx.beginPath(); ctx.arc(x + 50, y + 62, 15, 0, 7); ctx.fill();
          ctx.fillStyle = `rgba(111,216,196,${0.5 * pu})`; ctx.beginPath(); ctx.arc(x + 50, y + 62, 4, 0, 7); ctx.fill();
          ctx.fillStyle = "rgba(200,230,220,.4)"; ctx.fillRect(x + 49, y + 65, 2.5, 6);
        }
      }
      // 宝石
      gems.forEach((gem) => {
        const s = gem.v >= 20 ? 9 : gem.v >= 8 ? 7.5 : 6;
        ctx.save(); ctx.translate(gem.x, gem.y); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = gem.v >= 20 ? GOLD : gem.v >= 3 ? "#6fd8c4" : "#8fd878";
        ctx.fillRect(-s / 1.6, -s / 1.6, s * 1.25, s * 1.25); ctx.restore();
      });
      // 宝箱
      chests.forEach((c) => {
        const bob = Math.sin(c.t / 260) * 3, pu = 0.5 + Math.sin(c.t / 300) * 0.5;
        ctx.fillStyle = `rgba(224,163,60,${0.12 + pu * 0.1})`; ctx.beginPath(); ctx.arc(c.x, c.y + bob, 26, 0, 7); ctx.fill();
        ctx.fillStyle = "#8a5f1e"; rr(ctx, c.x - 14, c.y - 10 + bob, 28, 20, 4); ctx.fill();
        ctx.fillStyle = "#c9973c"; rr(ctx, c.x - 14, c.y - 10 + bob, 28, 8, 4); ctx.fill();
        ctx.fillStyle = GOLD; ctx.fillRect(c.x - 2.5, c.y - 4 + bob, 5, 8);
      });
      // 地刺
      spikes.forEach((s) => {
        if (!s.hit) { ctx.strokeStyle = "rgba(217,93,57,.5)"; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(s.x, s.y, 60, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
        else {
          ctx.fillStyle = "#d9d2c0";
          for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + s.x; const px = s.x + Math.cos(a) * 30, py = s.y + Math.sin(a) * 30; ctx.beginPath(); ctx.moveTo(px - 5, py + 6); ctx.lineTo(px, py - 16); ctx.lineTo(px + 5, py + 6); ctx.fill(); }
        }
      });
      // 寒冰环
      if (wpn.ice > 0 && !dead) {
        const IR = 100 + 18 * wpn.ice + (evo.ice ? 30 : 0);
        ctx.strokeStyle = evo.ice ? "rgba(159,216,255,.55)" : "rgba(143,216,232,.4)";
        ctx.lineWidth = evo.ice ? 4 : 3;
        ctx.beginPath(); ctx.arc(player.x, player.y, IR + Math.sin(player.t / 200) * 3, 0, 7); ctx.stroke();
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const a = player.t / 600 + (i / 6) * Math.PI * 2;
          const cx = player.x + Math.cos(a) * IR, cy = player.y + Math.sin(a) * IR;
          ctx.fillStyle = "#bfeaff"; ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx, cy + 6); ctx.lineTo(cx - 4, cy); ctx.closePath(); ctx.fill();
        }
      }
      // 陨石坠落（阴影预警 → 火球砸落）
      meteors.forEach((m) => {
        const p = 1 - Math.max(0, m.t) / 700;
        ctx.fillStyle = `rgba(217,93,57,${0.12 + p * 0.2})`;
        ctx.beginPath(); ctx.ellipse(m.x, m.y, 60 + p * 30, 30 + p * 15, 0, 0, 7); ctx.fill();
        const fx = m.x + (1 - p) * 160, fy = m.y - (1 - p) * 380;
        ctx.fillStyle = "#e0a33c"; ctx.beginPath(); ctx.arc(fx, fy, 14, 0, 7); ctx.fill();
        ctx.fillStyle = "#d95d39"; ctx.beginPath(); ctx.arc(fx - 4, fy + 8, 9, 0, 7); ctx.arc(fx - 9, fy + 16, 6, 0, 7); ctx.fill();
      });
      // 敌人
      enemies.forEach((e) => {
        const d = ENEMY_DEF[e.kind];
        const bob = Math.sin(e.t / 160) * 2;
        ctx.fillStyle = e.slow > 0 ? "#7fb8c8" : d.c;
        if (e.kind === 0) {
          ctx.beginPath(); ctx.ellipse(e.x, e.y + bob * 0.4, e.r, e.r * (0.82 + Math.sin(e.t / 160) * 0.12), 0, 0, 7); ctx.fill();
          ctx.fillStyle = "#12200f"; ctx.beginPath(); ctx.arc(e.x - e.r * 0.3, e.y - e.r * 0.15, e.r * 0.14, 0, 7); ctx.arc(e.x + e.r * 0.3, e.y - e.r * 0.15, e.r * 0.14, 0, 7); ctx.fill();
        } else if (e.kind === 1) {
          const w = Math.sin(e.t / 90) * e.r * 0.9;
          ctx.beginPath(); ctx.moveTo(e.x - e.r - w, e.y - 4); ctx.quadraticCurveTo(e.x - e.r * 0.5, e.y - e.r, e.x, e.y - 2); ctx.quadraticCurveTo(e.x + e.r * 0.5, e.y - e.r, e.x + e.r + w, e.y - 4); ctx.quadraticCurveTo(e.x, e.y + e.r * 0.9, e.x - e.r - w, e.y - 4); ctx.fill();
          ctx.fillStyle = "#ffd27a"; ctx.beginPath(); ctx.arc(e.x - 3, e.y - 3, 1.8, 0, 7); ctx.arc(e.x + 3, e.y - 3, 1.8, 0, 7); ctx.fill();
        } else if (e.kind === 3) {
          ctx.beginPath(); ctx.arc(e.x, e.y + bob * 0.5, e.r, 0, 7); ctx.fill();
          ctx.strokeStyle = ctx.fillStyle as string; ctx.lineWidth = 2;
          for (let l = 0; l < 4; l++) {
            const la = (l / 4) * Math.PI - Math.PI * 0.375, wig = Math.sin(e.t / 80 + l) * 3;
            ctx.beginPath(); ctx.moveTo(e.x + Math.cos(la) * e.r * 0.7, e.y + Math.sin(la) * e.r * 0.5); ctx.lineTo(e.x + Math.cos(la) * (e.r + 7) + wig, e.y + e.r * 0.9); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(e.x - Math.cos(la) * e.r * 0.7, e.y + Math.sin(la) * e.r * 0.5); ctx.lineTo(e.x - Math.cos(la) * (e.r + 7) - wig, e.y + e.r * 0.9); ctx.stroke();
          }
          ctx.lineWidth = 1;
          ctx.fillStyle = "#2a1a0a"; ctx.beginPath(); ctx.arc(e.x - 4, e.y - 3 + bob * 0.5, 2.4, 0, 7); ctx.arc(e.x + 4, e.y - 3 + bob * 0.5, 2.4, 0, 7); ctx.fill();
        } else if (e.kind === 4) {
          ctx.globalAlpha = 0.72;
          ctx.beginPath(); ctx.arc(e.x, e.y - e.r * 0.3 + bob, e.r * 0.9, Math.PI, 0);
          ctx.lineTo(e.x + e.r * 0.9, e.y + e.r * 0.6 + bob);
          for (let wv = 2; wv >= -2; wv--) ctx.lineTo(e.x + wv * e.r * 0.36, e.y + e.r * 0.6 + bob + (wv % 2 ? 6 : 0));
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#12202a"; ctx.beginPath(); ctx.arc(e.x - e.r * 0.3, e.y - e.r * 0.35 + bob, e.r * 0.16, 0, 7); ctx.arc(e.x + e.r * 0.3, e.y - e.r * 0.35 + bob, e.r * 0.16, 0, 7); ctx.fill();
        } else if (e.kind === 5) {
          // 裂体蠕虫：三节蠕动
          for (let seg = 2; seg >= 0; seg--) {
            const sx = e.x - seg * 9 * (e.x > player.x ? -1 : 1), sy = e.y + Math.sin(e.t / 120 + seg) * 3;
            ctx.beginPath(); ctx.arc(sx, sy + bob * 0.4, e.r * (1 - seg * 0.22), 0, 7); ctx.fill();
          }
          ctx.fillStyle = "#3d1f2e"; ctx.beginPath(); ctx.arc(e.x + (e.x > player.x ? -4 : 4), e.y - 3 + bob * 0.4, 2.6, 0, 7); ctx.fill();
          ctx.strokeStyle = "rgba(255,180,200,.5)"; ctx.beginPath(); ctx.moveTo(e.x - 3, e.y + 4 + bob * 0.4); ctx.lineTo(e.x + 3, e.y + 4 + bob * 0.4); ctx.stroke();
        } else if (e.kind === 6) {
          // 冰霜法师：尖帽斗篷 + 法杖冰晶
          ctx.beginPath(); ctx.moveTo(e.x, e.y - e.r * 1.5 + bob); ctx.lineTo(e.x - e.r * 0.8, e.y + e.r * 0.5 + bob); ctx.lineTo(e.x + e.r * 0.8, e.y + e.r * 0.5 + bob); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#2a3a5e"; ctx.beginPath(); ctx.arc(e.x, e.y - e.r * 0.3 + bob, e.r * 0.45, 0, 7); ctx.fill();
          ctx.fillStyle = "#9fd8ff"; ctx.beginPath(); ctx.arc(e.x - 3, e.y - e.r * 0.35 + bob, 1.8, 0, 7); ctx.arc(e.x + 3, e.y - e.r * 0.35 + bob, 1.8, 0, 7); ctx.fill();
          const orb = Math.sin(e.t / 300) * 3;
          ctx.fillStyle = "#bfeaff"; ctx.beginPath(); ctx.moveTo(e.x + e.r + 4, e.y - e.r + bob + orb); ctx.lineTo(e.x + e.r + 9, e.y - e.r + 6 + bob + orb); ctx.lineTo(e.x + e.r + 4, e.y - e.r + 12 + bob + orb); ctx.lineTo(e.x + e.r - 1, e.y - e.r + 6 + bob + orb); ctx.closePath(); ctx.fill();
          // 霜环蓄力提示
          const cyc = (e.t % 2600) / 2600;
          if (cyc > 0.75) { ctx.globalAlpha = (cyc - 0.75) * 2.4; ctx.strokeStyle = "#8fd8e8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 110 * (1 - (cyc - 0.75) * 2), 0, 7); ctx.stroke(); ctx.lineWidth = 1; ctx.globalAlpha = 1; }
        } else if (e.kind === 7) {
          // 装甲甲虫：硬壳 + 铆钉
          ctx.beginPath(); ctx.ellipse(e.x, e.y + bob * 0.3, e.r, e.r * 0.8, 0, 0, 7); ctx.fill();
          ctx.fillStyle = "#5f6a52"; ctx.beginPath(); ctx.ellipse(e.x, e.y - 3 + bob * 0.3, e.r * 0.78, e.r * 0.6, 0, Math.PI, 0); ctx.fill();
          ctx.strokeStyle = "#3d4436"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x, e.y - e.r * 0.6 + bob * 0.3); ctx.lineTo(e.x, e.y + e.r * 0.55 + bob * 0.3); ctx.stroke(); ctx.lineWidth = 1;
          ctx.fillStyle = "#2e3328";
          ctx.beginPath(); ctx.arc(e.x - e.r * 0.4, e.y - 4 + bob * 0.3, 2, 0, 7); ctx.arc(e.x + e.r * 0.4, e.y - 4 + bob * 0.3, 2, 0, 7); ctx.fill();
          ctx.fillStyle = "#c94f4f"; ctx.beginPath(); ctx.arc(e.x - 5, e.y + 6 + bob * 0.3, 2, 0, 7); ctx.arc(e.x + 5, e.y + 6 + bob * 0.3, 2, 0, 7); ctx.fill();
        } else {
          rr(ctx, e.x - e.r * 0.72, e.y - e.r + bob, e.r * 1.44, e.r * 1.7, e.r * 0.5); ctx.fill();
          ctx.fillStyle = e.boss ? "#2a0f0f" : "#33301f";
          ctx.beginPath(); ctx.arc(e.x - e.r * 0.28, e.y - e.r * 0.35 + bob, e.r * 0.2, 0, 7); ctx.arc(e.x + e.r * 0.28, e.y - e.r * 0.35 + bob, e.r * 0.2, 0, 7); ctx.fill();
          if (e.boss) {
            ctx.fillStyle = GOLD;
            ctx.beginPath(); ctx.moveTo(e.x - e.r * 0.7, e.y - e.r + bob); ctx.lineTo(e.x - e.r * 0.4, e.y - e.r * 1.4 + bob); ctx.lineTo(e.x - e.r * 0.15, e.y - e.r + bob); ctx.lineTo(e.x + e.r * 0.1, e.y - e.r * 1.45 + bob); ctx.lineTo(e.x + e.r * 0.35, e.y - e.r + bob); ctx.lineTo(e.x + e.r * 0.6, e.y - e.r * 1.35 + bob); ctx.lineTo(e.x + e.r * 0.75, e.y - e.r + bob); ctx.fill();
          }
        }
        if (e.elite || e.boss) { ctx.strokeStyle = e.boss ? GOLD : "#e07a5f"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(e.x, e.y - 4, e.r + 6, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
        if (!e.boss && e.hp < e.maxHp) { ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(e.x - 14, e.y - e.r - 12, 28, 4); ctx.fillStyle = BERRY; ctx.fillRect(e.x - 14, e.y - e.r - 12, 28 * Math.max(0, e.hp / e.maxHp), 4); }
        // 受击闪白
        if (e.flash > 0) { ctx.globalAlpha = (e.flash / 110) * 0.7; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(e.x, e.y - 2, e.r + 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      });
      // 弹道
      projs.forEach((p) => {
        ctx.fillStyle = evo.bolt ? "#ffd27a" : "#bfe8a8"; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fill();
        ctx.fillStyle = "#fffbe8"; ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, 7); ctx.fill();
      });
      // 回旋镖
      booms.forEach((b) => {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin);
        ctx.fillStyle = evo.boom ? "#ffd27a" : "#c9c2b0";
        ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(0, -10, 14, 0); ctx.quadraticCurveTo(0, 10, -14, 0); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill();
        ctx.restore();
      });
      // 旋风刃
      if (wpn.aura > 0) {
        const AR = 66 + 10 * wpn.aura + (evo.aura ? 30 : 0), blades = 2 + wpn.aura + (evo.aura ? 2 : 0);
        ctx.strokeStyle = evo.aura ? "rgba(255,210,122,.2)" : "rgba(191,232,168,.15)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, player.y, AR, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
        for (let b = 0; b < blades; b++) {
          const a = auraAng + (Math.PI * 2 * b) / blades;
          ctx.save(); ctx.translate(player.x + Math.cos(a) * AR, player.y + Math.sin(a) * AR); ctx.rotate(a + Math.PI / 2);
          ctx.fillStyle = evo.aura ? "#ffd27a" : "#d9e8cf"; ctx.beginPath(); ctx.ellipse(0, 0, 6, 16, 0, 0, 7); ctx.fill(); ctx.restore();
        }
      }
      // 粒子
      particles.forEach((p) => {
        if (p.c === "ring") { ctx.strokeStyle = `rgba(143,216,232,${p.life / 380})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, (1 - p.life / 380) * (110 + 25 * wpn.nova + (evo.nova ? 40 : 0)), 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
        else if (p.c === "zap") { ctx.strokeStyle = `rgba(240,220,120,${p.life / 200})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); const mxx = (p.x + p.vx) / 2 + (Math.random() - 0.5) * 24, myy = (p.y + p.vy) / 2 + (Math.random() - 0.5) * 24; ctx.lineTo(mxx, myy); ctx.lineTo(p.vx, p.vy); ctx.stroke(); ctx.lineWidth = 1; }
        else if (p.c === "lv") { ctx.strokeStyle = `rgba(255,210,122,${p.life / 500})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, (1 - p.life / 500) * 90 + 20, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
        else if (p.c === "wave") { const rad = (1 - p.life / 900) * 340; ctx.strokeStyle = `rgba(217,93,57,${(p.life / 900) * 0.8})`; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
        else if (p.c === "skull") { ctx.globalAlpha = p.life / 550; ctx.font = "13px sans-serif"; ctx.textAlign = "center"; ctx.fillText("💀", p.x, p.y); ctx.globalAlpha = 1; }
        else if (p.c === "dust") { ctx.globalAlpha = (p.life / 300) * 0.4; ctx.fillStyle = "#8a8272"; ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        else if (p.c === "gold") { ctx.globalAlpha = p.life / 300; ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        else { ctx.globalAlpha = p.life / 420; ctx.fillStyle = p.c; ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5); ctx.globalAlpha = 1; }
      });
      // 残影
      trail.forEach((tr) => { ctx.globalAlpha = (tr.life / 240) * 0.25; ctx.fillStyle = tr.gold ? GOLD : "#9fb3c8"; ctx.beginPath(); ctx.arc(tr.x, tr.y - 6, 10, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1;
      // 玩家：小骑士
      if (!dead) {
        const py = player.y + Math.sin(player.t / 140) * 1.5;
        // 披风
        const flap = Math.sin(player.t / 110) * 4;
        ctx.fillStyle = frenzyT > 0 ? "#c9973c" : "#8f3a4a";
        ctx.beginPath(); ctx.moveTo(player.x - player.face * 4, py - 12); ctx.lineTo(player.x - player.face * 16, py + 8 + flap); ctx.lineTo(player.x - player.face * 6, py + 14); ctx.closePath(); ctx.fill();
        // 身体
        ctx.fillStyle = "#33415a"; rr(ctx, player.x - 12, py - 8, 24, 26, 7); ctx.fill();
        ctx.fillStyle = "#46587a"; rr(ctx, player.x - 12, py - 8, 24, 10, 6); ctx.fill();
        // 头 + 头盔 + 红缨
        ctx.fillStyle = "#9fb3c8"; ctx.beginPath(); ctx.arc(player.x, py - 16, 11, 0, 7); ctx.fill();
        ctx.fillStyle = "#33415a"; ctx.fillRect(player.x - 8, py - 18, 16, 4);
        ctx.fillStyle = "#f0a52e"; ctx.fillRect(player.x - 2, py - 27, 4, 7);
        ctx.fillStyle = BERRY;
        ctx.beginPath(); ctx.moveTo(player.x, py - 27); ctx.quadraticCurveTo(player.x - player.face * 8, py - 32 + flap * 0.5, player.x - player.face * 12, py - 24 + flap); ctx.quadraticCurveTo(player.x - player.face * 5, py - 26, player.x, py - 24); ctx.fill();
        // 剑
        const sa = dashT > 0 ? Math.sin(player.t / 30) * 0.9 : Math.sin(player.t / 300) * 0.15;
        ctx.save(); ctx.translate(player.x + player.face * 13, py - 2); ctx.rotate(player.face * (-0.5 + sa));
        ctx.fillStyle = "#c9d4e0"; ctx.fillRect(-1.5, -20, 3, 18);
        ctx.fillStyle = GOLD; ctx.fillRect(-4, -3, 8, 3);
        ctx.restore();
        if (shieldOn) { ctx.strokeStyle = "rgba(143,216,232,.8)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(player.x, py - 6, 26, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
        if (frenzyT > 0) { ctx.strokeStyle = `rgba(224,163,60,${0.4 + Math.sin(player.t / 90) * 0.3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(player.x, py - 6, 30, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
        if (pFlash > 0) { ctx.globalAlpha = (pFlash / 260) * 0.6; ctx.fillStyle = "#ff8a70"; ctx.beginPath(); ctx.arc(player.x, py - 6, 20, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      }
      ctx.restore();

      // 雾气（视差漂浮）
      for (let i = 0; i < 8; i++) {
        const mx = ((i * 517 + Date.now() * 0.008 * (0.5 + (i % 3) * 0.3)) % (g.W + 500)) - 250;
        const my = ((i * 389 + Math.sin(Date.now() / 4000 + i) * 50) % (g.H + 400)) - 200;
        ctx.fillStyle = bm ? "rgba(160,60,60,.05)" : "rgba(180,220,200,.045)";
        ctx.beginPath(); ctx.arc(mx, my, 100 + (i % 4) * 30, 0, 7); ctx.fill();
      }
      // 暗角 + 状态滤镜
      ctx.drawImage(vig, 0, 0);
      if (bm) { ctx.fillStyle = "rgba(150,25,25,.12)"; ctx.fillRect(0, 0, g.W, g.H); }
      if (frenzyT > 0) { ctx.strokeStyle = `rgba(224,163,60,${0.25 + Math.sin(Date.now() / 100) * 0.15})`; ctx.lineWidth = 8; ctx.strokeRect(4, 4, g.W - 8, g.H - 8); ctx.lineWidth = 1; }
      if (!dead && player.hp < player.maxHp * 0.3) { ctx.fillStyle = `rgba(160,30,30,${0.08 + Math.sin(Date.now() / 240) * 0.05})`; ctx.fillRect(0, 0, g.W, g.H); }

      // ============ HUD ============
      // 经验条
      ctx.fillStyle = "rgba(0,0,0,.5)"; rr(ctx, 54, 16, g.W - 108, 12, 6); ctx.fill();
      const xw = (g.W - 108) * Math.min(1, Math.max(0, dispXp));
      if (xw > 1) { ctx.fillStyle = frenzyT > 0 ? GOLD : "#8fd878"; rr(ctx, 54, 16, xw, 12, 6); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.35)"; rr(ctx, 54, 16, xw, 5, 3); ctx.fill(); }
      if (lvlFlash > 0) { ctx.strokeStyle = `rgba(255,210,122,${lvlFlash / 800})`; ctx.lineWidth = 3; rr(ctx, 52, 14, g.W - 104, 16, 8); ctx.stroke(); ctx.lineWidth = 1; }
      // 等级徽章
      ctx.fillStyle = "#24513a"; ctx.beginPath(); ctx.arc(30, 22, 17, 0, 7); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(30, 22, 17, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = "#f3f5ea"; ctx.font = "700 14px 'Noto Sans SC', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(player.level), 30, 23);
      // ❤ 血条（平滑动画 + 低血量告警）
      hpShown += (Math.max(0, player.hp) - hpShown) * 0.12;
      const hpPct = Math.max(0, hpShown / player.maxHp);
      ctx.fillStyle = "rgba(0,0,0,.5)"; rr(ctx, 54, 32, g.W - 108, 10, 5); ctx.fill();
      if (hpPct > 0.01) {
        const low = hpPct < 0.3;
        ctx.fillStyle = low ? (Math.sin(Date.now() / 120) > 0 ? "#e0564a" : "#a83228") : "#d95d39";
        rr(ctx, 54, 32, (g.W - 108) * hpPct, 10, 5); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.3)"; rr(ctx, 54, 32, (g.W - 108) * hpPct, 4, 2); ctx.fill();
      }
      ctx.fillStyle = "#f3e6da"; ctx.font = "700 9px 'Noto Sans SC', sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`${Math.ceil(Math.max(0, player.hp))} / ${player.maxHp}`, g.W / 2, 38);
      // 击杀 & 时间
      const sec = Math.floor(player.t / 1000);
      ctx.fillStyle = "#cfe3c2"; ctx.font = "700 13px 'Noto Sans SC', sans-serif";
      ctx.textAlign = "right"; ctx.fillText(`💀 ${player.kills}`, g.W - 14, 56);
      ctx.textAlign = "center"; ctx.fillText(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`, g.W / 2, 56);
      // 怒气条
      ctx.fillStyle = "rgba(0,0,0,.5)"; rr(ctx, 14, 52, 130, 7, 4); ctx.fill();
      if (fever > 0) { ctx.fillStyle = frenzyT > 0 ? GOLD : BERRY; rr(ctx, 14, 52, 130 * (frenzyT > 0 ? frenzyT / 6000 : fever / 100), 7, 4); ctx.fill(); }
      ctx.textAlign = "left"; ctx.fillStyle = "#8fae93"; ctx.font = "600 10px 'Noto Sans SC', sans-serif";
      ctx.fillText(frenzyT > 0 ? "🔥 狂暴中" : "怒气", 14, 68);
      // 冰冻状态提示
      if (slowT > 0) { ctx.fillStyle = "#8fd8e8"; ctx.textAlign = "center"; ctx.font = "700 11px 'Noto Sans SC', sans-serif"; ctx.fillText("❄ 减速中", g.W / 2, 70); }
      // Buff 图标
      let bx = 60;
      const buffs: [string, number, number][] = [];
      if (frenzyT > 0) buffs.push(["🔥", frenzyT, 8000]);
      if (magnetT > 0) buffs.push(["🧲", magnetT, 6000]);
      if (shieldOn) buffs.push(["🛡", 1, 1]);
      buffs.forEach(([ic, t, max]) => {
        ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.arc(bx, 88, 12, 0, 7); ctx.fill();
        ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, 88, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (t / max)); ctx.stroke(); ctx.lineWidth = 1;
        ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.fillText(ic, bx, 89);
        bx += 30;
      });
      // Boss 血条
      const boss = enemies.find((e) => e.boss);
      if (boss) {
        ctx.fillStyle = "rgba(0,0,0,.55)"; rr(ctx, 60, 104, g.W - 120, 12, 6); ctx.fill();
        ctx.fillStyle = BERRY; rr(ctx, 60, 104, (g.W - 120) * Math.max(0, boss.hp / boss.maxHp), 12, 6); ctx.fill();
        ctx.fillStyle = "#ffd27a"; ctx.font = "700 11px 'Noto Sans SC', sans-serif"; ctx.textAlign = "center";
        ctx.fillText(`☠ 骷髅王 · 第 ${bossWave} 位`, g.W / 2, 98);
      }
      // 冲刺按钮
      const dbx = g.W - 74, dby = g.H - 108;
      ctx.fillStyle = dashCd > 0 ? "rgba(233,242,228,.1)" : "rgba(224,163,60,.28)";
      ctx.beginPath(); ctx.arc(dbx, dby, 34, 0, 7); ctx.fill();
      ctx.strokeStyle = dashCd > 0 ? "rgba(233,242,228,.3)" : GOLD; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(dbx, dby, 34, 0, 7); ctx.stroke();
      if (dashCd > 0) { ctx.strokeStyle = "rgba(233,242,228,.6)"; ctx.beginPath(); ctx.arc(dbx, dby, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - dashCd / 2600)); ctx.stroke(); }
      ctx.lineWidth = 1;
      ctx.font = "22px sans-serif"; ctx.textAlign = "center"; ctx.globalAlpha = dashCd > 0 ? 0.4 : 1; ctx.fillText("⚡", dbx, dby - 2); ctx.globalAlpha = 1;
      ctx.fillStyle = "#cfe3c2"; ctx.font = "600 10px 'Noto Sans SC', sans-serif"; ctx.fillText("冲刺", dbx, dby + 18);
      // 摇杆
      if (joy.on) {
        ctx.strokeStyle = "rgba(233,242,228,.3)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 44, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
        const jd = Math.min(40, Math.hypot(joy.dx, joy.dy)), ja = Math.atan2(joy.dy, joy.dx);
        ctx.fillStyle = "rgba(233,242,228,.5)"; ctx.beginPath(); ctx.arc(joy.ox + Math.cos(ja) * jd, joy.oy + Math.sin(ja) * jd, 18, 0, 7); ctx.fill();
      }
      // 飘字
      floats.forEach((f) => {
        ctx.globalAlpha = Math.min(1, f.t / 300);
        ctx.fillStyle = f.c; ctx.font = `700 ${f.big ? 20 : 13}px 'Noto Sans SC', sans-serif`; ctx.textAlign = "center";
        ctx.fillText(f.s, f.x - camX, f.y - camY);
      });
      ctx.globalAlpha = 1;
      // 横幅
      if (banner > 0) {
        const q = banner > 2000 ? (2600 - banner) / 600 : banner < 500 ? banner / 500 : 1;
        ctx.globalAlpha = Math.max(0, Math.min(1, q));
        const bh = 82 * q, by = g.H * 0.3 - bh / 2;
        ctx.fillStyle = bm && bannerTxt.includes("血月") ? "rgba(120,20,20,.85)" : "rgba(20,14,10,.85)";
        ctx.fillRect(0, by, g.W, bh);
        ctx.fillStyle = GOLD; ctx.fillRect(0, by, g.W, 3); ctx.fillRect(0, by + bh - 3, g.W, 3);
        ctx.fillStyle = "#ffd27a"; ctx.font = "700 26px 'Noto Sans SC', sans-serif"; ctx.textAlign = "center";
        ctx.fillText(bannerTxt, g.W / 2, by + bh / 2 - (bannerSub ? 8 : 0));
        if (bannerSub) { ctx.fillStyle = "#cfe3c2"; ctx.font = "600 13px 'Noto Sans SC', sans-serif"; ctx.fillText(bannerSub, g.W / 2, by + bh / 2 + 20); }
        ctx.globalAlpha = 1;
      }
      // 升级三选一
      if (lvlChoices.length) {
        ctx.fillStyle = "rgba(8,10,14,.8)"; ctx.fillRect(0, 0, g.W, g.H);
        ctx.fillStyle = GOLD; ctx.font = "700 26px 'Noto Sans SC', sans-serif"; ctx.textAlign = "center";
        ctx.fillText("⭐ 升级！", g.W / 2, 130);
        ctx.fillStyle = "#8fae93"; ctx.font = "600 13px 'Noto Sans SC', sans-serif";
        ctx.fillText(`Lv.${player.level} · 选择一项强化`, g.W / 2, 160);
        lvlChoices.forEach((key, i) => {
          const [nm, ds] = UP_INFO[key] ?? ["?", "?"];
          const y = 200 + i * 130;
          const isEvo = key.startsWith("evo_");
          rr(ctx, 50, y, g.W - 100, 112, 16);
          ctx.fillStyle = isEvo ? "rgba(120,80,20,.55)" : "rgba(28,42,58,.9)"; ctx.fill();
          ctx.strokeStyle = isEvo ? GOLD : "rgba(233,242,228,.25)"; ctx.lineWidth = isEvo ? 2.5 : 1.5; ctx.stroke(); ctx.lineWidth = 1;
          if (isEvo) { ctx.fillStyle = GOLD; ctx.font = "700 11px 'Noto Sans SC', sans-serif"; ctx.textAlign = "right"; ctx.fillText("✦ 稀有", g.W - 66, y + 22); }
          ctx.textAlign = "left";
          ctx.fillStyle = "#f3f5ea"; ctx.font = "700 19px 'Noto Sans SC', sans-serif";
          ctx.fillText(nm, 70, y + 42);
          ctx.fillStyle = "#9fb3a8"; ctx.font = "500 13px 'Noto Sans SC', sans-serif";
          ctx.fillText(ds, 70, y + 74);
        });
      }
      // 结算
      if (dead) {
        ctx.fillStyle = "rgba(8,10,14,.85)"; ctx.fillRect(0, 0, g.W, g.H);
        ctx.textAlign = "center";
        ctx.fillStyle = BERRY; ctx.font = "700 34px 'Noto Sans SC', sans-serif";
        ctx.fillText("☠ 你倒下了", g.W / 2, g.H / 2 - 60);
        ctx.fillStyle = "#cfe3c2"; ctx.font = "600 15px 'Noto Sans SC', sans-serif";
        ctx.fillText(`存活 ${Math.floor(player.t / 1000)} 秒 · 击杀 ${player.kills} · 等级 ${player.level}`, g.W / 2, g.H / 2 - 20);
      }
    },

    onPointer(t, x, y, id) {
      if (dead) return;
      // 升级选择
      if (lvlChoices.length) {
        if (t !== "down") return;
        lvlChoices.forEach((key, i) => {
          const cy = 200 + i * 130;
          if (x > 50 && x < g.W - 50 && y > cy && y < cy + 112) applyUpgrade(key);
        });
        return;
      }
      const dbx = g.W - 74, dby = g.H - 108;
      const inDash = Math.hypot(x - dbx, y - dby) < 44;
      if (t === "down") {
        if (inDash) tryDash();
        else if (x < g.W * 0.55) { joy.on = true; joy.id = id ?? -1; joy.ox = x; joy.oy = y; joy.dx = 0; joy.dy = 0; }
        else tryDash();
      }
      if (t === "move" && joy.on && (id === undefined || id === joy.id)) { joy.dx = x - joy.ox; joy.dy = y - joy.oy; }
      if (t === "up" && (id === undefined || id === joy.id)) { joy.on = false; joy.dx = 0; joy.dy = 0; }
    },
    onKey(code, down) {
      if (code === "ArrowLeft" || code === "KeyA") keys.l = down;
      if (code === "ArrowRight" || code === "KeyD") keys.r = down;
      if (code === "ArrowUp" || code === "KeyW") keys.u = down;
      if (code === "ArrowDown" || code === "KeyS") keys.d = down;
      if ((code === "Space" || code === "ShiftLeft") && down) tryDash();
    },
  };
}


