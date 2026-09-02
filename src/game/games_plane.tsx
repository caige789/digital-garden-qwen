/* 飞机大战（竖屏射击）：机库养成（4 机型 + 火力/装甲/磁石）· 10 关 5 Boss · 局内道具 */
import React, { useEffect, useState } from "react";
import { GameCtx, GameHandle, rr, clamp } from "./engine";
import * as api from "../lib/api";

const FONT = '"Noto Sans SC", sans-serif';
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center", bold = true) {
  ctx.fillStyle = color; ctx.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
}
const GOLD = "#efa32c", BERRY = "#d95d39", LEAF = "#3e8e52";

/* ---------------- 机库（localStorage 持久化 + 花园金币） ---------------- */
export type PlaneModel = { id: string; name: string; cost: number; dmg: number; rate: number; spread: number; hp: number; color: string; desc: string };
export const PLANES: PlaneModel[] = [
  { id: "sparrow", name: "麻雀", cost: 0, dmg: 1, rate: 270, spread: 1, hp: 3, color: "#8fc176", desc: "入门教练机，单发" },
  { id: "falcon", name: "猎隼", cost: 600, dmg: 1.5, rate: 220, spread: 2, hp: 4, color: "#6f9fd8", desc: "双管齐射" },
  { id: "phoenix", name: "凤凰", cost: 1800, dmg: 2.2, rate: 190, spread: 3, hp: 5, color: "#e07a3f", desc: "三叉火力" },
  { id: "dragon", name: "苍龙", cost: 4500, dmg: 3.2, rate: 160, spread: 4, hp: 6, color: "#b78ed9", desc: "四路扇形扫射" },
  { id: "storm", name: "雷隼", cost: 7000, dmg: 2.6, rate: 210, spread: 3, hp: 5, color: "#7fc8e8", desc: "⚡ 闪电链：命中后电弧跳跃灼烧周围敌机" },
  { id: "nova", name: "星陨", cost: 12000, dmg: 3.8, rate: 230, spread: 1, hp: 7, color: "#e8c3f0", desc: "💫 星爆弹：单发穿透全场，命中炸出星屑" },
];
export type HangarData = { owned: string[]; equipped: string; fire: number; armor: number; magnet: number };
const HANGAR_KEY = "garden_hangar";
export function loadHangar(): HangarData {
  try {
    const d = JSON.parse(localStorage.getItem(HANGAR_KEY) || "");
    if (d && d.owned?.length) return d;
  } catch { /* ignore */ }
  return { owned: ["sparrow"], equipped: "sparrow", fire: 0, armor: 0, magnet: 0 };
}
export const saveHangar = (d: HangarData) => localStorage.setItem(HANGAR_KEY, JSON.stringify(d));

export function drawPlaneShape(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, s: number, color: string) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 20, s / 20);
  // 尾焰
  ctx.fillStyle = "#f0a52e";
  ctx.beginPath(); ctx.moveTo(-5, 16); ctx.lineTo(0, 24 + Math.random() * 6); ctx.lineTo(5, 16); ctx.fill();
  ctx.fillStyle = color;
  if (id === "sparrow") {
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-13, 12); ctx.lineTo(0, 6); ctx.lineTo(13, 12); ctx.closePath(); ctx.fill();
  } else if (id === "falcon") {
    ctx.beginPath(); ctx.moveTo(0, -21); ctx.lineTo(-6, -4); ctx.lineTo(-17, 10); ctx.lineTo(-6, 8); ctx.lineTo(0, 14); ctx.lineTo(6, 8); ctx.lineTo(17, 10); ctx.lineTo(6, -4); ctx.closePath(); ctx.fill();
  } else if (id === "phoenix") {
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(-8, -8, -19, 6); ctx.lineTo(-8, 4); ctx.lineTo(-11, 14); ctx.lineTo(0, 9); ctx.lineTo(11, 14); ctx.lineTo(8, 4); ctx.lineTo(19, 6); ctx.quadraticCurveTo(8, -8, 0, -22); ctx.fill();
    ctx.fillStyle = "#ffd76f"; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-3, 2); ctx.lineTo(3, 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(-7, -10); ctx.lineTo(-21, -2); ctx.lineTo(-14, 6); ctx.lineTo(-20, 14); ctx.lineTo(-6, 10); ctx.lineTo(0, 16); ctx.lineTo(6, 10); ctx.lineTo(20, 14); ctx.lineTo(14, 6); ctx.lineTo(21, -2); ctx.lineTo(7, -10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffd76f"; ctx.beginPath(); ctx.arc(0, -4, 4, 0, 7); ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.beginPath(); ctx.arc(0, -6, 3.4, 0, 7); ctx.fill();
  ctx.restore();
}

/* 机库面板（游戏菜单内嵌） */
export function HangarPanel() {
  const [coins, setCoins] = useState(0);
  const [hangar, setHangar] = useState<HangarData>(loadHangar);
  const [msg, setMsg] = useState("");
  useEffect(() => { api.getCoins().then(setCoins); }, []);
  const model = PLANES.find((p) => p.id === hangar.equipped)!;
  const spend = async (cost: number, apply: () => void, okMsg: string) => {
    if (coins < cost) { setMsg("金币不够，多玩几局攒攒 🪙"); return; }
    const bal = await api.addCoins(-cost);
    setCoins(bal); apply(); setMsg(okMsg);
  };
  const buyPlane = (p: PlaneModel) => spend(p.cost, () => { const d = { ...hangar, owned: [...hangar.owned, p.id], equipped: p.id }; setHangar(d); saveHangar(d); }, `已购入「${p.name}」并装配！`);
  const equip = (id: string) => { const d = { ...hangar, equipped: id }; setHangar(d); saveHangar(d); setMsg(`已装配「${PLANES.find((p) => p.id === id)!.name}」`); };
  const UPG = [
    { key: "fire" as const, name: "火力", desc: "伤害+15% 射速+6%", max: 5, cost: (lv: number) => 250 + lv * 200 },
    { key: "armor" as const, name: "装甲", desc: "生命 +1", max: 3, cost: (lv: number) => 300 + lv * 250 },
    { key: "magnet" as const, name: "磁石", desc: "金币吸力 +", max: 3, cost: (lv: number) => 200 + lv * 150 },
  ];
  return (
    <div className="rounded-xl border border-[#e9f2e4]/15 bg-[#e9f2e4]/5 p-3.5 text-left">
      <div className="flex items-center gap-2 text-[#cfe3c2]">
        <span className="font-display text-lg text-[#f3f5ea]">🛩 机库</span>
        <span className="ml-auto text-sm font-bold text-[#efa32c]">🪙 {coins}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mt-2.5">
        {PLANES.map((p) => {
          const owned = hangar.owned.includes(p.id);
          const on = hangar.equipped === p.id;
          return (
            <button
              key={p.id}
              onClick={() => (owned ? equip(p.id) : buyPlane(p))}
              className={`press flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-[11px] font-bold transition-colors ${on ? "border-[#efa32c] bg-[#efa32c]/15 text-[#efa32c]" : "border-[#e9f2e4]/15 bg-[#e9f2e4]/5 text-[#cfe3c2]"}`}
            >
              <PlaneGlyph color={p.color} />
              <span>{p.name}</span>
              <span className={`text-[10px] font-normal ${owned ? "text-[#8fae93]" : "text-[#efa32c]"}`}>{owned ? (on ? "装配中" : "点击装配") : `🪙${p.cost}`}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-1.5 mt-2">
        {UPG.map((u) => {
          const lv = hangar[u.key];
          const maxed = lv >= u.max;
          return (
            <button
              key={u.key}
              disabled={maxed}
              onClick={() => spend(u.cost(lv), () => { const d = { ...hangar, [u.key]: lv + 1 }; setHangar(d); saveHangar(d); }, `${u.name}升到 ${lv + 1} 级！`)}
              className="press rounded-lg border border-[#e9f2e4]/15 bg-[#e9f2e4]/5 px-1 py-1.5 text-center disabled:opacity-45"
            >
              <div className="text-[11px] font-bold text-[#cfe3c2]">{u.name} Lv.{lv}{maxed ? " MAX" : ""}</div>
              <div className="text-[9.5px] text-[#8fae93]">{u.desc}</div>
              {!maxed && <div className="text-[10px] text-[#efa32c] font-bold mt-0.5">🪙{u.cost(lv)}</div>}
            </button>
          );
        })}
      </div>
      <div className="text-[11px] text-[#8fae93] mt-2 min-h-[16px]">{msg || `${model.name} · ${model.desc} · 每局得分会自动攒金币`}</div>
    </div>
  );
}
function PlaneGlyph({ color }: { color: string }) {
  return (
    <svg width="30" height="26" viewBox="-22 -24 44 44">
      <path d="M0,-20 L-15,10 L0,4 L15,10 Z" fill={color} />
      <circle cx="0" cy="-6" r="3" fill="rgba(255,255,255,.8)" />
    </svg>
  );
}

/* ---------------- 游戏本体 ---------------- */
export function createPlane(g: GameCtx): GameHandle {
  const hangar = loadHangar();
  const model = PLANES.find((p) => p.id === hangar.equipped) ?? PLANES[0];
  const dmgMul = 1 + hangar.fire * 0.15;
  const rateMul = 1 - hangar.fire * 0.06;
  const magnetR = 90 + hangar.magnet * 55;
  let player = { x: g.W / 2, y: g.H - 130, lives: model.hp + hangar.armor, inv: 0, shield: false };
  let bullets: { x: number; y: number; vx: number; vy: number; r: number; hurt: number; dmg: number; chain?: number; pierce?: number; kind?: string }[] = [];
  let enemies: { x: number; y: number; hp: number; maxHp: number; r: number; kind: string; t: number; shootT: number }[] = [];
  let coins: { x: number; y: number }[] = [];
  let drops: { x: number; y: number; kind: string; t: number }[] = [];
  let parts: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
  let score = 0, coinN = 0, level = 1, levelT = 0, fireT = 0, dead = false, overSent = false;
  let fx = { spread: 0, rapid: 0 }; // 道具增益剩余时间
  let boss: { x: number; y: number; hp: number; maxHp: number; kind: string; t: number; shootT: number; shield: number } | null = null;
  let targetX = player.x, targetY = player.y, dragging = false;
  let keys = { left: false, right: false, up: false, down: false };
  const BOSS_KINDS = ["charger", "shield", "barrage", "splitter", "overlord"];
  const LEVEL_TIME = 13000;
  const DPR = () => (Math.random() + Math.random()) / 2;
  function spawnEnemy() {
    if (enemies.length > 16) return;
    const hpMul = (1 + level * 0.35) * g.mult;
    const kinds = ["small", "small", "small", "zig", "tank"];
    const kind = kinds[g.rnd(kinds.length)];
    const hp = (kind === "tank" ? 4 : kind === "zig" ? 2 : 1) * hpMul;
    enemies.push({ x: 40 + g.rnd(g.W - 80), y: -30, hp, maxHp: hp, r: kind === "tank" ? 26 : 18, kind, t: 0, shootT: 800 + g.rnd(1200) });
  }
  function spawnBoss() {
    const kind = BOSS_KINDS[Math.min(4, Math.floor(level / 2) - 1)];
    const hp = (level * 26 + 55) * g.mult; // Boss 更快被击破，不拖节奏
    boss = { x: g.W / 2, y: -80, hp, maxHp: hp, kind, t: 0, shootT: 0, shield: kind === "shield" ? hp * 0.35 : 0 };
    g.sfx.tone(110, 0.5, "sawtooth", 0.15, -30);
    g.juice.float(g.W / 2, g.H * 0.3, `⚠ Boss 来袭 · ${kind === "charger" ? "冲锋者" : kind === "shield" ? "护盾堡垒" : kind === "barrage" ? "弹幕核心" : kind === "splitter" ? "分裂母体" : "霸主"}`, BERRY, 20);
    g.juice.shake(8);
  }
  function boom(x: number, y: number, c: string, n = 14) {
    for (let i = 0; i < n && parts.length < 240; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, life: 500, c });
  }
  function fire() {
    const spread = model.spread + (fx.spread > 0 ? 2 : 0);
    const dmg = model.dmg * dmgMul * 5; // 提高单发伤害，打 Boss 不刮痧
    const baseA = -Math.PI / 2;
    for (let i = 0; i < spread; i++) {
      const a = baseA + (i - (spread - 1) / 2) * (spread > 1 ? 0.16 : 0);
      bullets.push({
        x: player.x, y: player.y - 18, vx: Math.cos(a) * 10.5, vy: Math.sin(a) * 10.5,
        r: model.id === "nova" ? 8 : 5, hurt: 1, dmg,
        kind: model.id === "storm" ? "storm" : model.id === "nova" ? "nova" : undefined,
        chain: model.id === "storm" ? 2 : undefined,
        pierce: model.id === "nova" ? 6 : undefined,
      });
    }
    g.sfx.tone(model.id === "storm" ? 980 : model.id === "nova" ? 520 : 700 + Math.random() * 200, 0.05, "square", 0.035, -300);
  }
  function enemyShoot(x: number, y: number, vx: number, vy: number, r = 6) {
    if (bullets.filter((b) => b.hurt < 0).length < 90) bullets.push({ x, y, vx, vy, r, hurt: -1, dmg: 0 });
  }
  function hurtPlayer() {
    if (player.inv > 0 || dead) return;
    if (player.shield) { player.shield = false; g.sfx.hit(); g.juice.shake(5); g.juice.float(player.x, player.y - 40, "护盾抵挡!", "#8fd8e8", 15); return; }
    player.lives--; player.inv = 1500;
    g.sfx.hit(); g.juice.shake(10);
    boom(player.x, player.y, "#efa32c", 10);
    if (player.lives <= 0) {
      dead = true; g.sfx.boom(); g.juice.shake(14);
      boom(player.x, player.y, "#d95d39", 26);
      if (!overSent) { overSent = true; setTimeout(() => g.over(score + coinN * 20), 900); }
    }
  }
  function applyDrop(kind: string) {
    if (kind === "F") { fx.rapid = 10000; g.juice.float(player.x, player.y - 46, "🔥 急速射击!", GOLD, 17); }
    if (kind === "S") { fx.spread = 10000; g.juice.float(player.x, player.y - 46, "🌟 散射强化!", GOLD, 17); }
    if (kind === "H") { player.shield = true; g.juice.float(player.x, player.y - 46, "🛡 护盾!", "#8fd8e8", 17); }
    if (kind === "B") {
      enemies.forEach((e) => { score += 60; boom(e.x, e.y, "#eda93a", 8); });
      enemies = [];
      bullets = bullets.filter((b) => b.hurt > 0);
      if (boss) boss.hp -= 60;
      g.sfx.boom(); g.juice.shake(14);
      g.juice.float(g.W / 2, g.H / 2, "💣 全屏轰炸!", BERRY, 24);
    }
    g.sfx.win();
  }
  return {
    currentScore() { return Math.round(score + coinN * 20); },
    tick(dt) {
      g.juice.update(dt);
      parts.forEach((p) => { p.x += p.vx; p.y += p.vy; p.life -= dt; });
      parts = parts.filter((p) => p.life > 0);
      if (dead) return;
      const k = dt / 16.7;
      player.inv = Math.max(0, player.inv - dt);
      fx.spread = Math.max(0, fx.spread - dt); fx.rapid = Math.max(0, fx.rapid - dt);
      const spd = 6.5 * k;
      if (keys.left) player.x -= spd; if (keys.right) player.x += spd;
      if (keys.up) player.y -= spd; if (keys.down) player.y += spd;
      if (dragging) { player.x += (targetX - player.x) * 0.35 * k; player.y += (targetY - player.y) * 0.35 * k; }
      player.x = clamp(player.x, 20, g.W - 20); player.y = clamp(player.y, 60, g.H - 30);
      fireT += dt;
      const rate = model.rate * rateMul * (fx.rapid > 0 ? 0.62 : 1);
      if (fireT > rate) { fireT = 0; fire(); }
      levelT += dt;
      if (!boss && levelT > LEVEL_TIME) spawnBoss();
      else if (!boss && Math.random() < 0.03 * g.mult * k) spawnEnemy();
      bullets.forEach((b) => { b.x += b.vx * k; b.y += b.vy * k; });
      bullets = bullets.filter((b) => b.y > -30 && b.y < g.H + 30 && b.x > -30 && b.x < g.W + 30);
      enemies.forEach((e) => {
        e.t += dt;
        e.y += (e.kind === "tank" ? 0.8 : 1.6) * g.mult * k;
        if (e.kind === "zig") e.x += Math.sin(e.t / 300) * 2.4 * k;
        e.shootT -= dt;
        if (e.shootT <= 0 && e.y > 0 && level >= 3) {
          e.shootT = 1500 + g.rnd(1500);
          const a = Math.atan2(player.y - e.y, player.x - e.x);
          enemyShoot(e.x, e.y, Math.cos(a) * 4, Math.sin(a) * 4);
        }
        if (Math.hypot(e.x - player.x, e.y - player.y) < e.r + 14) { e.hp = 0; boom(e.x, e.y, "#d95d39"); hurtPlayer(); }
      });
      enemies = enemies.filter((e) => {
        if (e.hp <= 0) {
          if (e.y > 0) {
            score += e.kind === "tank" ? 150 : 60;
            g.sfx.score();
            boom(e.x, e.y, "#eda93a", 8);
            g.juice.float(e.x, e.y, `+${e.kind === "tank" ? 150 : 60}`, GOLD, 13);
            const roll = Math.random();
            if (roll < 0.35) coins.push({ x: e.x, y: e.y });
            else if (roll < 0.62) drops.push({ x: e.x, y: e.y, kind: ["F", "S", "H", "B"][g.rnd(4)], t: 0 });
          }
          return false;
        }
        return e.y < g.H + 40;
      });
      if (boss) {
        boss.t += dt; boss.shootT -= dt;
        boss.y = Math.min(120, boss.y + 1.2 * k);
        boss.x = g.W / 2 + Math.sin(boss.t / 1200) * (g.W / 3);
        if (boss.shootT <= 0 && boss.y >= 100) {
          const kind = boss.kind;
          if (kind === "barrage") { boss.shootT = 1400; for (let i = 0; i < 10; i++) { const a = (Math.PI * 2 * i) / 10 + boss.t / 900; enemyShoot(boss.x, boss.y + 30, Math.cos(a) * 3.4, Math.sin(a) * 3.4); } }
          else if (kind === "charger") { boss.shootT = 1800; const a = Math.atan2(player.y - boss.y, player.x - boss.x); for (const da of [0, 0.15, -0.15]) enemyShoot(boss.x, boss.y, Math.cos(a + da) * 6.2, Math.sin(a + da) * 6.2, 8); }
          else if (kind === "splitter") { boss.shootT = 2000; for (const dx of [-1, 0, 1]) if (enemies.length < 14) enemies.push({ x: boss.x + dx * 40, y: boss.y + 40, hp: 2 * g.mult, maxHp: 2, r: 14, kind: "small", t: 0, shootT: 99999 }); }
          else if (kind === "overlord") { boss.shootT = 1150; for (let i = 0; i < 12; i++) { const a = (Math.PI * 2 * i) / 12 + boss.t / 700; enemyShoot(boss.x, boss.y + 20, Math.cos(a) * 3, Math.sin(a) * 3); } const a = Math.atan2(player.y - boss.y, player.x - boss.x); enemyShoot(boss.x, boss.y, Math.cos(a) * 7, Math.sin(a) * 7, 10); }
          else { boss.shootT = 1600; for (const dx of [-30, 0, 30]) enemyShoot(boss.x + dx, boss.y + 30, 0, 4.5 * g.mult); }
          g.sfx.tone(200, 0.1, "sawtooth", 0.05, -80);
        }
        if (Math.hypot(boss.x - player.x, boss.y - player.y) < 60) hurtPlayer();
        if (boss.hp <= 0) {
          score += 1000 + level * 300;
          for (let i = 0; i < 6; i++) coins.push({ x: boss.x + (Math.random() - 0.5) * 90, y: boss.y + (Math.random() - 0.5) * 50 });
          drops.push({ x: boss.x, y: boss.y, kind: ["F", "S", "H"][g.rnd(3)], t: 0 });
          boom(boss.x, boss.y, "#efa32c", 34);
          g.sfx.boom(); g.juice.shake(14);
          g.juice.float(g.W / 2, g.H * 0.35, `🎉 击破 +${1000 + level * 300}`, GOLD, 24);
          boss = null; level++; levelT = 0;
          if (level > 10) { g.sfx.win(); if (!overSent) { overSent = true; score += 5000; setTimeout(() => g.over(score + coinN * 20), 1000); } }
        }
      }
      for (const b of bullets) {
        if (b.hurt < 0) { if (Math.hypot(b.x - player.x, b.y - player.y) < b.r + 14) { b.y = 99999; hurtPlayer(); } continue; }
        for (const e of enemies) {
          if (e.hp > 0 && Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
            e.hp -= b.dmg;
            g.juice.burst(b.x, b.y, b.kind === "storm" ? "#7fc8e8" : b.kind === "nova" ? "#e8c3f0" : "#bfe8a8", b.kind === "nova" ? 8 : 3);
            if (b.kind === "storm" && (b.chain ?? 0) > 0) {
              // 闪电链：跳跃灼烧最近的两架敌机
              const near = enemies.filter((n) => n !== e && n.hp > 0 && Math.hypot(n.x - e.x, n.y - e.y) < 110).slice(0, b.chain ?? 2);
              near.forEach((n) => { n.hp -= b.dmg * 0.45; g.juice.burst(n.x, n.y, "#7fc8e8", 5); });
              b.chain = 0;
            }
            if (b.kind === "nova" && (b.pierce ?? 0) > 0) {
              (b as any).pierce = (b.pierce ?? 1) - 1; // 穿透继续飞
              boom(b.x, b.y, "#e8c3f0", 4);
            } else b.y = -9999;
            break;
          }
        }
        if (boss && b.y > -100 && Math.hypot(b.x - boss.x, b.y - boss.y) < b.r + 50) {
          const absorb = () => { if (boss!.shield > 0) { boss!.shield -= b.dmg; g.sfx.tone(900, 0.04, "triangle", 0.04); } else boss!.hp -= b.dmg; };
          if (b.kind === "nova" && (b.pierce ?? 0) > 0) { absorb(); (b as any).pierce = (b.pierce ?? 1) - 1; boom(b.x, b.y, "#e8c3f0", 6); }
          else { absorb(); b.y = -9999; }
        }
      }
      bullets = bullets.filter((b) => Math.abs(b.y) < 9000);
      coins.forEach((c) => {
        c.y += 1.2 * k;
        const d = Math.hypot(c.x - player.x, c.y - player.y);
        if (d < magnetR && d > 1) { c.x += ((player.x - c.x) / d) * 6 * k; c.y += ((player.y - c.y) / d) * 6 * k; }
      });
      coins = coins.filter((c) => {
        if (Math.hypot(c.x - player.x, c.y - player.y) < 26) { coinN++; score += 20; g.sfx.coin(); g.juice.float(c.x, c.y - 10, "+20", GOLD, 11); return false; }
        return c.y < g.H + 30;
      });
      drops.forEach((d) => (d.y += 1.5 * k));
      drops = drops.filter((d) => {
        if (Math.hypot(d.x - player.x, d.y - player.y) < 30) { applyDrop(d.kind); return false; }
        return d.y < g.H + 30;
      });
    },
    draw(ctx) {
      ctx.fillStyle = "#0a1710"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      ctx.fillStyle = "rgba(233,242,228,.35)";
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97) % g.W;
        const sy = ((i * 211 + Date.now() * 0.03 * (1 + (i % 3) * 0.5)) % (g.H + 40)) - 20;
        ctx.fillRect(sx, sy, 2, 2);
      }
      coins.forEach((c) => { ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, 7); ctx.fill(); ctx.fillStyle = "#8a5f14"; ctx.beginPath(); ctx.arc(c.x, c.y, 3.6, 0, 7); ctx.fill(); });
      drops.forEach((d) => {
        const col = d.kind === "F" ? "#e07a3f" : d.kind === "S" ? "#f0c060" : d.kind === "H" ? "#8fd8e8" : "#b78ed9";
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(d.x, d.y, 14, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.stroke();
        txt(ctx, d.kind, d.x, d.y + 1, 14, "#1e3325");
      });
      enemies.forEach((e) => {
        ctx.fillStyle = e.kind === "tank" ? "#8f5f8f" : e.kind === "zig" ? "#5f8f8f" : "#a35d4a";
        ctx.beginPath(); ctx.moveTo(e.x, e.y + e.r); ctx.lineTo(e.x - e.r, e.y - e.r * 0.7); ctx.lineTo(e.x + e.r, e.y - e.r * 0.7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(e.x, e.y - e.r * 0.15, e.r * 0.24, 0, 7); ctx.fill();
        if (e.hp < e.maxHp) { ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 4); ctx.fillStyle = LEAF; ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * Math.max(0, e.hp / e.maxHp), 4); }
      });
      if (boss) {
        const bx = boss.x, by = boss.y;
        ctx.fillStyle = "#5d3a5d";
        ctx.beginPath(); ctx.moveTo(bx, by - 50); ctx.lineTo(bx + 56, by + 10); ctx.lineTo(bx + 30, by + 46); ctx.lineTo(bx - 30, by + 46); ctx.lineTo(bx - 56, by + 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#8f5f8f"; ctx.beginPath(); ctx.arc(bx, by + 6, 22, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffd27a";
        ctx.beginPath(); ctx.arc(bx - 8, by + 2, 5, 0, 7); ctx.arc(bx + 8, by + 2, 5, 0, 7); ctx.fill();
        if (boss.kind === "overlord") { ctx.fillStyle = "#f0c060"; ctx.beginPath(); ctx.moveTo(bx - 24, by - 46); ctx.lineTo(bx - 12, by - 64); ctx.lineTo(bx, by - 48); ctx.lineTo(bx + 12, by - 64); ctx.lineTo(bx + 24, by - 46); ctx.closePath(); ctx.fill(); }
        if (boss.shield > 0) { ctx.strokeStyle = "rgba(95,197,180,.8)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(bx, by, 62, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
        ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.fillRect(40, 60, g.W - 80, 8);
        ctx.fillStyle = BERRY; ctx.fillRect(40, 60, (g.W - 80) * Math.max(0, boss.hp / boss.maxHp), 8);
      }
      bullets.forEach((b) => {
        if (b.hurt > 0) {
          if (b.kind === "storm") {
            ctx.strokeStyle = "#7fc8e8"; ctx.lineWidth = 2.5; ctx.beginPath();
            ctx.moveTo(b.x - 3, b.y + 9); ctx.lineTo(b.x + 2, b.y + 1); ctx.lineTo(b.x - 2, b.y - 1); ctx.lineTo(b.x + 3, b.y - 9);
            ctx.stroke(); ctx.lineWidth = 1;
            ctx.fillStyle = "rgba(127,200,232,.35)"; ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, 7); ctx.fill();
          } else if (b.kind === "nova") {
            ctx.fillStyle = "rgba(232,195,240,.3)"; ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, 7); ctx.fill();
            ctx.fillStyle = "#e8c3f0"; ctx.beginPath();
            for (let i = 0; i < 8; i++) { const a = (Math.PI / 4) * i + b.y / 30, r = i % 2 ? 4 : 9; ctx[i ? "lineTo" : "moveTo"](b.x + Math.cos(a) * r, b.y + Math.sin(a) * r); }
            ctx.closePath(); ctx.fill();
          } else { ctx.fillStyle = "#bfe8a8"; ctx.beginPath(); ctx.ellipse(b.x, b.y, 3.4, 8, Math.atan2(b.vy, b.vx) + Math.PI / 2, 0, 7); ctx.fill(); }
        } else { ctx.fillStyle = "#e88f7a"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); }
      });
      parts.forEach((p) => { ctx.globalAlpha = p.life / 500; ctx.fillStyle = p.c; ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5); });
      ctx.globalAlpha = 1;
      if (!dead) {
        const blink = player.inv > 0 && Date.now() % 200 < 100;
        if (!blink) {
          if (player.shield) { ctx.strokeStyle = "rgba(143,216,232,.75)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(player.x, player.y, 30, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
          drawPlaneShape(ctx, model.id, player.x, player.y, 20, model.color);
        }
      }
      // HUD
      ctx.fillStyle = "rgba(10,23,16,.78)"; rr(ctx, 10, 10, g.W - 20, 42, 21); ctx.fill();
      txt(ctx, `关卡 ${Math.min(level, 10)}/10`, 70, 31, 14, "#cfe3c2");
      txt(ctx, `${score}`, g.W / 2, 31, 18, GOLD);
      txt(ctx, `🪙${coinN}`, g.W - 120, 31, 14, GOLD);
      txt(ctx, "❤".repeat(Math.max(0, player.lives)), g.W - 52, 31, 12, BERRY);
      if (fx.spread > 0 || fx.rapid > 0) {
        const fxTxt = [fx.rapid > 0 ? "🔥" : "", fx.spread > 0 ? "🌟" : ""].join("");
        txt(ctx, fxTxt, g.W / 2, 66, 15, "#fff");
      }
      if (dead) txt(ctx, "战机坠毁！", g.W / 2, g.H / 2, 30, "#f3f5ea");
      if (level > 10 && !dead) txt(ctx, "🏆 通关！", g.W / 2, g.H / 2, 34, GOLD);
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y, id) {
      void id;
      if (t === "down") { dragging = true; targetX = x; targetY = y - 40; }
      if (t === "move" && dragging) { targetX = x; targetY = y - 40; }
      if (t === "up") dragging = false;
    },
    onKey(code, down) {
      if (code === "ArrowLeft" || code === "KeyA") keys.left = down;
      if (code === "ArrowRight" || code === "KeyD") keys.right = down;
      if (code === "ArrowUp" || code === "KeyW") keys.up = down;
      if (code === "ArrowDown" || code === "KeyS") keys.down = down;
    },
  };
}
