/* 游戏实现 · 第八辑：像素地牢（Roguelike）/ 魂斗勇者（魂斗罗类横版射击） */
import { GameCtx, GameHandle, rr, clamp } from "./engine";
import { getCoins, addCoins, getHeroDef } from "../lib/api";

const FONT = '"Noto Sans SC", sans-serif';
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center", bold = true) {
  ctx.fillStyle = color; ctx.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
}
const GOLD = "#efa32c", BERRY = "#d95d39", LEAF = "#3e8e52";

function drawSprite(ctx: CanvasRenderingContext2D, sp: string[], pal: Record<string, string>, x: number, y: number, px: number, flip = false) {
  for (let j = 0; j < sp.length; j++) {
    const row = sp[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === "." || !pal[ch]) continue;
      ctx.fillStyle = pal[ch];
      const xi = flip ? row.length - 1 - i : i;
      ctx.fillRect(Math.round(x + xi * px), Math.round(y + j * px), px, px);
    }
  }
}

const HERO_SP = ["..hhhh..", ".hhhhhh.", ".hfeefh.", ".hffffh.", "..tttt..", ".ttbbtt.", ".t.tt.t.", "..ll.ll."];
const HERO_PAL = { h: "#8f9aab", f: "#e8c39e", e: "#22262e", t: "#3e8e52", b: "#7a5c3a", l: "#33312c" };
const SLIME_SP = ["..ssss..", ".ssssss.", "snessnes", "ssssssss", "ssssssss", ".s.ss.s."];
const SLIME_PAL = { s: "#6fbf5f", n: "#22301f", e: "#ffffff" };
const BAT_SP = ["w..bb..w", "wwbbbbww", "wwnennew", ".wbbbbw.", "..bbbb..", "w..bb..w"];
const BAT_PAL = { b: "#8a6fbf", w: "#6a539a", n: "#22262e", e: "#ffd76f" };
const SKEL_SP = ["..kkkk..", ".knnnnk.", ".knenek.", ".knnnnk.", "..rrrr..", ".r.rr.r.", "..rrrr..", "..k..k.."];
const SKEL_PAL = { k: "#e8e4d8", n: "#2b2b26", e: "#d95d39", r: "#cfccc0" };
const BOSS_SP = ["...yyyy....", "..y..y..y..", "..kkkkkkk..", ".knnnnnnnk.", ".knennnenk.", ".knnnnnnnk.", "..kkkkkkk..", "..rrrrrrr..", ".rr.rrr.rr.", "..rrrrrrr..", "..rr...rr..", ".kkk...kkk."];
const BOSS_PAL = { y: "#ffd76f", k: "#e8e4d8", n: "#2b2b26", e: "#d95d39", r: "#cfccc0" };
/* 幽灵（半透明飘浮） */
const GHOST_SP = ["..gggg..", ".gggggg.", "gngggngg", "gggggggg", "gggggggg", ".gggggg.", "g.g..g.g"];
const GHOST_PAL = { g: "#8fd8e8", n: "#12202a" };
/* 弓箭手 */
const ARCHER_SP = ["..hhhh..", ".hffffh.", ".feef...", ".ffffff.", "..uuu...", ".uuuuu..", ".u.u.b..", "..p.bb.."];
const ARCHER_PAL = { h: "#4a6b3a", f: "#e8c39e", e: "#22262e", u: "#6a5340", p: "#33312c", b: "#7a5c3a" };
/* 宝箱怪（伪装宝箱，露出獠牙） */
const MIMIC_SP = ["bbbbbbbb", "byyyyyyb", "bbbbbbbb", "btbtbtbt", "bttttttb", "bbbbbbbb", "bbbbbbbb"];
const MIMIC_PAL = { b: "#8a5f14", y: "#ffd76f", t: "#ffffff" };
const HEART_SP = [".rr.rr.", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."];
const SWORD_SP = ["......b.", ".....bb.", "....bb..", "g..bb...", ".gbb....", "..g....."];

/* ================= 像素地牢 ================= */
export function createPixelDungeon(g: GameCtx): GameHandle {
  const T = 32, MW = 15, MH = 18, OY = 64;
  type Ent = { x: number; y: number; hp: number; maxHp: number; kind: string; flash: number; kt: number; kx: number; ky: number; t: number };
  type Item = { x: number; y: number; kind: string };
  type Proj = { x: number; y: number; vx: number; vy: number };
  let map: number[][] = [];
  let rooms: { x: number; y: number; w: number; h: number }[] = [];
  let floor = 1, kills = 0, coins = 0, combo = 0, comboT = 0;
  let revives = 0, shopOpen = false, shopMsg = "", msgT = 0, wallet = 0;
  /* 角色加成：不同人物模型带不同属性 */
  const HERO = getHeroDef("dungeon");
  const baseHp = 6 + (HERO.mods.hp ?? 0);
  let P = {
    x: 0, y: 0, hp: baseHp, maxHp: baseHp,
    atk: Math.max(1, 2 + (HERO.mods.atk ?? 0)),
    spd: Math.max(1.6, 2.7 + (HERO.mods.spd ?? 0)),
    face: 1, atkCd: 0, ifr: 0, swing: 0, moving: false,
    shield: HERO.mods.shield ?? 0,
    rangeMul: HERO.mods.range ?? 1,
    cdBase: Math.max(150, 300 + (HERO.mods.cd ?? 0)),
  };
  /* 地牢商店：花网站花园金币，买装备买命 */
  const SHOP = [
    { id: "revive", icon: "✨", name: "复活符", desc: "本局死后原地满血复活（备 1 张）", cost: 150 },
    { id: "shield", icon: "🛡", name: "魔法盾", desc: "抵挡一次伤害，最多叠 3 层", cost: 80 },
    { id: "atk", icon: "⚔", name: "磨刀石", desc: "攻击力 +2", cost: 150 },
    { id: "spear", icon: "🔱", name: "长枪", desc: "攻击范围翻倍", cost: 200 },
    { id: "spd", icon: "👟", name: "疾风靴", desc: "移动速度 +", cost: 100 },
    { id: "maxhp", icon: "❤", name: "活力之心", desc: "生命上限 +2 并回满", cost: 250 },
  ];
  function openShop() {
    shopOpen = true; shopMsg = "";
    getCoins().then((w) => { wallet = w; }).catch(() => { wallet = 0; });
    g.sfx.click();
  }
  function buy(idx: number) {
    const it = SHOP[idx];
    const maxed = it.id === "spear" && P.rangeMul >= 2;
    if (maxed) { shopMsg = "长枪已持有"; msgT = 1600; g.sfx.hit(); return; }
    if (wallet < it.cost) { shopMsg = "金币不够，去个人中心兑换或玩几局攒攒"; msgT = 2200; g.sfx.hit(); return; }
    wallet -= it.cost;
    addCoins(-it.cost).then((w) => { wallet = w; }).catch(() => {});
    if (it.id === "revive") revives++;
    if (it.id === "shield") P.shield = Math.min(3, P.shield + 1);
    if (it.id === "atk") P.atk += 2;
    if (it.id === "spear") P.rangeMul = 2;
    if (it.id === "spd") P.spd = Math.min(4.2, P.spd + 0.4);
    if (it.id === "maxhp") { P.maxHp += 2; P.hp = P.maxHp; }
    shopMsg = `已购入「${it.name}」！`; msgT = 1800; g.sfx.win();
  }
  let enemies: Ent[] = [], items: Item[] = [], projs: Proj[] = [];
  let shake = 0, freeze = 0, flashFx = 0, dead = false, overSent = false, bossAlive = false, stairsOpen = true, t = 0;
  let joy: { sx: number; sy: number; dx: number; dy: number; on: boolean; id: number } = { sx: 0, sy: 0, dx: 0, dy: 0, on: false, id: -1 };
  let keys = { l: false, r: false, u: false, d: false };
  let holdAtk = false, atkHoldT = 0, atkId = -1;

  const solid = (tx: number, ty: number) => (map[ty]?.[tx] ?? 1) === 1;
  function hitWall(x: number, y: number) {
    const r = 9;
    const ty = (yy: number) => Math.floor((yy - OY) / T), tx = (xx: number) => Math.floor(xx / T);
    return solid(tx(x - r), ty(y - r)) || solid(tx(x + r), ty(y - r)) || solid(tx(x - r), ty(y + r)) || solid(tx(x + r), ty(y + r));
  }
  function genFloor() {
    map = Array.from({ length: MH }, () => Array(MW).fill(1));
    rooms = [];
    for (let i = 0; i < 6; i++) {
      const w = 3 + g.rnd(3), h = 3 + g.rnd(2);
      const x = 1 + g.rnd(MW - w - 2), y = 1 + g.rnd(MH - h - 2);
      rooms.push({ x, y, w, h });
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) map[yy][xx] = 0;
    }
    for (let i = 1; i < rooms.length; i++) {
      let cx = rooms[i - 1].x + (rooms[i - 1].w >> 1), cy = rooms[i - 1].y + (rooms[i - 1].h >> 1);
      const tx = rooms[i].x + (rooms[i].w >> 1), ty = rooms[i].y + (rooms[i].h >> 1);
      while (cx !== tx) { map[cy][cx] = 0; cx += Math.sign(tx - cx); }
      while (cy !== ty) { map[cy][cx] = 0; cy += Math.sign(ty - cy); }
      map[cy][cx] = 0;
    }
    const r0 = rooms[0], rN = rooms[rooms.length - 1];
    P.x = (r0.x + r0.w / 2) * T; P.y = OY + (r0.y + r0.h / 2) * T;
    map[rN.y + (rN.h >> 1)][rN.x + (rN.w >> 1)] = 2;
    bossAlive = floor % 5 === 0; stairsOpen = !bossAlive;
    enemies = [];
    const free = (): [number, number] => {
      const rm = rooms[1 + g.rnd(rooms.length - 1)];
      return [(rm.x + g.rnd(rm.w)) * T + T / 2, OY + (rm.y + g.rnd(rm.h)) * T + T / 2];
    };
    if (bossAlive) {
      const bx = (rN.x + rN.w / 2) * T, by = OY + (rN.y + rN.h / 2) * T - 10;
      enemies.push({ x: bx, y: by, hp: 40 + floor * 6, maxHp: 40 + floor * 6, kind: "boss", flash: 0, kt: 0, kx: 0, ky: 0, t: 0 });
    }
    const n = Math.min(16, 4 + floor * 2);
    for (let i = 0; i < n; i++) {
      /* 敌人出生在离玩家 170px 以外，绝不"出门撞人堆" */
      let x = 0, y = 0, placed = false;
      for (let tries = 0; tries < 14; tries++) {
        const [fx, fy] = free();
        if (Math.hypot(fx - P.x, fy - P.y) > 170) { x = fx; y = fy; placed = true; break; }
      }
      if (!placed) continue;
      const roll = Math.random();
      /* 怪物池随楼层扩充：1层起史莱姆/蝙蝠 → 3层骷髅/弓箭手 → 5层幽灵 → 2层起混入宝箱怪 */
      let kind: string;
      if (roll < 0.1 && floor >= 2) kind = "mimic";
      else if (roll < 0.25 && floor >= 5) kind = "wraith";
      else if (roll < 0.45 && floor >= 3) kind = Math.random() < 0.5 ? "skel" : "archer";
      else if (roll < 0.7) kind = "slime";
      else kind = "bat";
      const hp = kind === "skel" ? 3 + floor : kind === "bat" ? 1 + Math.floor(floor / 2) : kind === "wraith" ? 2 + floor : kind === "archer" ? 2 + Math.floor(floor / 2) : kind === "mimic" ? 4 + floor : 2 + floor;
      enemies.push({ x, y, hp, maxHp: hp, kind, flash: 0, kt: 0, kx: 0, ky: 0, t: Math.random() * 999 });
    }
    items = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = free();
      const roll = Math.random();
      items.push({ x, y, kind: roll < 0.28 ? "coin" : roll < 0.48 ? "heart" : roll < 0.64 ? "sword" : roll < 0.76 ? "boots" : roll < 0.88 ? "shield" : roll < 0.94 ? "great" : "spear" });
    }
    projs = [];
    flashFx = 1;
  }
  function dmgNum(x: number, y: number, s: string, color: string, size = 16) {
    g.juice.float(x, y, s, color, size);
  }
  function tryRevive() {
    if (revives > 0) {
      revives--; P.hp = P.maxHp; P.ifr = 2200;
      g.juice.burst(P.x, P.y, "#ffd76f", 30); g.sfx.win();
      dmgNum(P.x, P.y - 32, "✨ 复活!", "#ffd76f", 22);
      return;
    }
    dead = true; g.juice.burst(P.x, P.y, "#fff", 30); g.sfx.over();
    if (!overSent) { overSent = true; setTimeout(() => g.over(floor * 1000 + kills * 50 + coins * 10), 1000); }
  }
  function attack() {
    if (P.atkCd > 0 || dead || shopOpen) return;
    P.atkCd = P.cdBase; P.swing = 180;
    g.sfx.tone(300, 0.07, "square", 0.09, -120);
    let hitAny = false;
    const range = 62 * P.rangeMul, closeR = 34 * P.rangeMul; // 🔱 长枪：范围翻倍
    enemies.forEach((e) => {
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      const inFront = (e.x - P.x) * P.face >= -14;
      if (d < range && (inFront || d < closeR)) {
        hitAny = true;
        e.hp -= P.atk; e.flash = 130; e.kt = 200;
        e.kx = Math.sign(e.x - P.x || P.face) * 5; e.ky = (Math.random() - 0.5) * 3;
        dmgNum(e.x, e.y - 20, String(P.atk), "#ffd76f", 17);
        shake = Math.min(9, shake + 4);
        g.sfx.hit();
      }
    });
    if (!hitAny) return;
    enemies = enemies.filter((e) => {
      if (e.hp > 0) return true;
      kills++; combo++; comboT = 2500;
      g.juice.burst(e.x, e.y, e.kind === "boss" ? "#ffd76f" : "#6fbf5f", e.kind === "boss" ? 40 : 16);
      dmgNum(e.x, e.y - 30, combo > 1 ? `连击 ×${combo}` : "+击杀", combo > 3 ? BERRY : "#cfe3c2", combo > 3 ? 18 : 13);
      freeze = 55; shake = Math.min(12, shake + (e.kind === "boss" ? 12 : 6));
      g.sfx.boom();
      if (e.kind === "boss") { bossAlive = false; stairsOpen = true; coins += 8; dmgNum(e.x, e.y - 50, "🗝 楼梯解锁!", GOLD, 17); }
      else if (Math.random() < 0.4) { coins += 1; g.juice.burst(e.x, e.y, GOLD, 6); }
      return false;
    });
  }
  genFloor();
  P.ifr = 2500; // 开局 2.5 秒无敌，站稳再打
  return {
    tick(dt) {
      g.juice.update(dt);
      if (shopOpen) return; // 商店界面：游戏冻结
      msgT = Math.max(0, msgT - dt); if (msgT <= 0) shopMsg = "";
      if (dead) return;
      if (freeze > 0) { freeze -= dt; return; }
      t += dt;
      comboT -= dt; if (comboT <= 0) combo = 0;
      P.atkCd = Math.max(0, P.atkCd - dt); P.ifr = Math.max(0, P.ifr - dt); P.swing = Math.max(0, P.swing - dt);
      shake *= 0.86; flashFx = Math.max(0, flashFx - dt / 400);
      let mx = 0, my = 0;
      if (keys.l) mx -= 1; if (keys.r) mx += 1; if (keys.u) my -= 1; if (keys.d) my += 1;
      if (joy.on) { const l = Math.hypot(joy.dx, joy.dy); if (l > 10) { mx = joy.dx / l; my = joy.dy / l; } }
      const ml = Math.hypot(mx, my);
      P.moving = ml > 0.1;
      if (P.moving) {
        if (Math.abs(mx) > 0.2) P.face = mx > 0 ? 1 : -1;
        const sp = P.spd * (dt / 16.7);
        const nx = P.x + (mx / (ml || 1)) * sp;
        if (!hitWall(nx, P.y)) P.x = nx;
        const ny = P.y + (my / (ml || 1)) * sp;
        if (!hitWall(P.x, ny)) P.y = ny;
      }
      // 卡墙救援：永不卡图
      if (hitWall(P.x, P.y)) {
        const cx = Math.floor(P.x / T), cy = Math.floor((P.y - OY) / T);
        rescue: for (let r = 1; r < 7; r++) {
          for (let oy2 = -r; oy2 <= r; oy2++) for (let ox2 = -r; ox2 <= r; ox2++) {
            if ((map[cy + oy2]?.[cx + ox2] ?? 1) !== 1) { P.x = (cx + ox2) * T + T / 2; P.y = OY + (cy + oy2) * T + T / 2; break rescue; }
          }
        }
      }
      if (holdAtk) { atkHoldT -= dt; if (atkHoldT <= 0) { atkHoldT = 320; attack(); } }
      const ptx = Math.floor(P.x / T), pty = Math.floor((P.y - OY) / T);
      if (map[pty]?.[ptx] === 2 && stairsOpen) {
        floor++; g.sfx.win(); g.juice.shake(4);
        if (floor % 3 === 0 && P.maxHp < 9) P.maxHp++;
        P.hp = Math.min(P.maxHp, P.hp + 1);
        genFloor();
        P.ifr = 2500; // 换层落地 2.5 秒无敌，不会被堵门口
        dmgNum(P.x, P.y - 34, "✨ 无敌 2.5s", "#8fd8e8", 14);
        return;
      }
      items = items.filter((it) => {
        if (Math.hypot(it.x - P.x, it.y - P.y) > 22) return true;
        if (it.kind === "coin") { coins++; g.sfx.coin(); dmgNum(it.x, it.y - 16, "+1 🪙", GOLD, 13); }
        if (it.kind === "heart") { P.hp = Math.min(P.maxHp, P.hp + 2); g.sfx.score(); dmgNum(it.x, it.y - 16, "+2 ❤", BERRY, 14); }
        if (it.kind === "sword") { P.atk++; g.sfx.win(); dmgNum(it.x, it.y - 16, `攻击 +1（${P.atk}）`, "#ffd76f", 14); }
        if (it.kind === "boots") { P.spd = Math.min(4.2, P.spd + 0.4); g.sfx.win(); dmgNum(it.x, it.y - 16, "速度 +", "#8fd8e8", 14); }
        if (it.kind === "shield") { P.shield = Math.min(3, P.shield + 1); g.sfx.win(); dmgNum(it.x, it.y - 16, `🛡 +1（${P.shield}）`, "#8fd8e8", 14); }
        if (it.kind === "great") { P.atk += 2; g.sfx.win(); dmgNum(it.x, it.y - 16, `攻击 +2（${P.atk}）`, "#ffd76f", 15); }
        if (it.kind === "spear") {
          if (P.rangeMul < 2) { P.rangeMul = 2; g.sfx.win(); dmgNum(it.x, it.y - 16, "🔱 攻击范围 ×2!", "#c9d2dd", 15); }
          else { coins += 15; g.sfx.coin(); dmgNum(it.x, it.y - 16, "+15 🪙", GOLD, 13); }
        }
        g.juice.burst(it.x, it.y, "#fff", 8);
        return false;
      });
      enemies.forEach((e) => {
        e.t += dt; e.flash = Math.max(0, e.flash - dt); e.kt = Math.max(0, e.kt - dt);
        const safeMove = (nx: number, ny: number) => { if (!hitWall(nx, e.y)) e.x = nx; if (!hitWall(e.x, ny)) e.y = ny; };
        if (e.kt > 0) { safeMove(e.x + e.kx * (dt / 16.7), e.y + e.ky * (dt / 16.7)); return; }
        const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
        let sp = (e.kind === "bat" ? 1.7 : e.kind === "boss" ? 1.1 : e.kind === "skel" ? 0.9 : e.kind === "mimic" ? 2.3 : e.kind === "wraith" ? 1.2 : e.kind === "archer" ? 0.8 : 0.7) * (0.85 + floor * 0.04) * g.mult;
        let vx = (dx / d) * sp, vy = (dy / d) * sp;
        if (e.kind === "bat") { vx += Math.cos(e.t / 200) * 1.2; vy += Math.sin(e.t / 170) * 1.2; }
        if (e.kind === "skel" && d < 130) { vx *= -0.6; vy *= -0.6; }
        /* 宝箱怪：玩家靠近才暴起追击，否则原地装死 */
        if (e.kind === "mimic" && d > 70) { vx = 0; vy = 0; }
        /* 弓箭手：保持距离并射箭 */
        if (e.kind === "archer") {
          if (d < 120) { vx *= -0.8; vy *= -0.8; }
          if (Math.floor(e.t / 1900) !== Math.floor((e.t - dt) / 1900) && d < 280) {
            projs.push({ x: e.x, y: e.y, vx: (dx / d) * 3.2, vy: (dy / d) * 3.2 });
            g.sfx.tone(500, 0.06, "triangle", 0.05, -200);
          }
        }
        if (e.kind === "skel" && Math.floor(e.t / 1600) !== Math.floor((e.t - dt) / 1600) && d < 260) {
          projs.push({ x: e.x, y: e.y, vx: (dx / d) * 3.4, vy: (dy / d) * 3.4 });
          g.sfx.tone(220, 0.08, "sawtooth", 0.06);
        }
        if (e.kind === "boss" && Math.floor(e.t / 2200) !== Math.floor((e.t - dt) / 2200)) {
          for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 * i) / 8; projs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 }); }
          g.sfx.tone(140, 0.2, "sawtooth", 0.12, -40); shake = Math.min(10, shake + 5);
        }
        /* 幽灵穿墙：直接移动，不检测碰撞 */
        if (e.kind === "wraith") { e.x += vx * (dt / 16.7); e.y += vy * (dt / 16.7); }
        else safeMove(e.x + vx * (dt / 16.7), e.y + vy * (dt / 16.7));
        if (P.ifr <= 0 && d < 24) {
          P.ifr = 800; combo = 0;
          shake = Math.min(12, shake + 8);
          // 击退带碰撞检测，绝不嵌墙
          const kx = P.x + (dx / d) * -7, ky = P.y + (dy / d) * -7;
          if (!hitWall(kx, P.y)) P.x = kx;
          if (!hitWall(P.x, ky)) P.y = ky;
          if (P.shield > 0) {
            P.shield--; g.sfx.hit();
            dmgNum(P.x, P.y - 26, "🛡 抵挡!", "#8fd8e8", 15);
            g.juice.burst(P.x, P.y, "#8fd8e8", 10);
          } else {
            P.hp -= e.kind === "boss" ? 2 : 1; g.sfx.boom();
            dmgNum(P.x, P.y - 26, "-" + (e.kind === "boss" ? 2 : 1), BERRY, 18);
            g.juice.burst(P.x, P.y, BERRY, 12);
            if (P.hp <= 0) tryRevive();
          }
        }
      });
      projs.forEach((p) => { p.x += p.vx * (dt / 16.7); p.y += p.vy * (dt / 16.7); });
      projs = projs.filter((p) => {
        if (solid(Math.floor(p.x / T), Math.floor((p.y - OY) / T))) { g.juice.burst(p.x, p.y, "#cfccc0", 4); return false; }
        if (P.ifr <= 0 && Math.hypot(p.x - P.x, p.y - P.y) < 15) {
          P.ifr = 800; shake = Math.min(10, shake + 6);
          if (P.shield > 0) { P.shield--; g.sfx.hit(); dmgNum(P.x, P.y - 24, "🛡 抵挡!", "#8fd8e8", 14); g.juice.burst(P.x, P.y, "#8fd8e8", 8); }
          else { P.hp--; g.sfx.hit(); dmgNum(P.x, P.y - 24, "-1", BERRY, 16); if (P.hp <= 0) tryRevive(); }
          return false;
        }
        return p.x > -20 && p.y > -20 && p.x < g.W + 20 && p.y < g.H + 20;
      });
    },
    draw(ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      ctx.fillStyle = "#12100e"; ctx.fillRect(-10, -10, g.W + 20, g.H + 20);
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const v = map[y][x], px = x * T, py = OY + y * T;
        if (v === 1) {
          ctx.fillStyle = (x + y) % 2 ? "#2b2620" : "#262019";
          ctx.fillRect(px, py, T, T);
          ctx.fillStyle = "#3a332a"; ctx.fillRect(px, py, T, 3);
        } else if (v === 2) {
          ctx.fillStyle = "#0a0908"; ctx.fillRect(px + 3, py + 3, T - 6, T - 6);
          ctx.fillStyle = stairsOpen ? GOLD : "#555049";
          for (let i = 0; i < 3; i++) ctx.fillRect(px + 8, py + 7 + i * 8, T - 16, 3);
        } else {
          ctx.fillStyle = (x + y) % 2 ? "#3d362c" : "#38312a";
          ctx.fillRect(px, py, T, T);
          if ((x * 7 + y * 13) % 11 === 0) { ctx.fillStyle = "#2e2822"; ctx.fillRect(px + 8, py + 12, 4, 4); }
        }
      }
      for (let i = 0; i < rooms.length; i++) {
        const rm = rooms[i];
        const fx = (rm.x + rm.w / 2) * T, fy = OY + rm.y * T - 4;
        const fl = Math.sin(t / 90 + i * 2) * 2;
        ctx.fillStyle = "#7a5c3a"; ctx.fillRect(fx - 2, fy, 4, 10);
        ctx.fillStyle = "#efa32c"; ctx.fillRect(fx - 4, fy - 8 + fl, 8, 8);
        ctx.fillStyle = "#ffd76f"; ctx.fillRect(fx - 2, fy - 6 + fl, 4, 5);
      }
      items.forEach((it) => {
        const bob = Math.sin(t / 260 + it.x) * 2.5;
        if (it.kind === "coin") { ctx.fillStyle = GOLD; ctx.fillRect(it.x - 6, it.y - 6 + bob, 12, 12); ctx.fillStyle = "#8a5f14"; ctx.fillRect(it.x - 2, it.y - 2 + bob, 4, 4); }
        else if (it.kind === "heart") drawSprite(ctx, HEART_SP, { r: "#d95d39" }, it.x - 10, it.y - 9 + bob, 3);
        else if (it.kind === "sword") drawSprite(ctx, SWORD_SP, { b: "#c9d2dd", g: "#7a5c3a" }, it.x - 9, it.y - 9 + bob, 3);
        else if (it.kind === "shield") {
          ctx.fillStyle = "#4a6b7a"; ctx.fillRect(it.x - 8, it.y - 9 + bob, 16, 18);
          ctx.fillStyle = "#8fd8e8"; ctx.fillRect(it.x - 6, it.y - 7 + bob, 12, 14);
          ctx.fillStyle = "#e8f6fa"; ctx.fillRect(it.x - 2, it.y - 5 + bob, 4, 10);
        }
        else if (it.kind === "spear") {
          ctx.fillStyle = "#7a5c3a"; ctx.fillRect(it.x - 1.5, it.y - 8 + bob, 3, 20);
          ctx.fillStyle = "#c9d2dd";
          ctx.fillRect(it.x - 1.5, it.y - 14 + bob, 3, 7);
          ctx.fillRect(it.x - 8, it.y - 10 + bob, 3, 9);
          ctx.fillRect(it.x + 5, it.y - 10 + bob, 3, 9);
          ctx.fillRect(it.x - 8, it.y - 3 + bob, 16, 3);
        }
        else if (it.kind === "great") drawSprite(ctx, SWORD_SP, { b: "#ffd76f", g: "#8a5f14" }, it.x - 11, it.y - 11 + bob, 3.6);
        else { ctx.fillStyle = "#8fd8e8"; ctx.fillRect(it.x - 7, it.y - 5 + bob, 14, 10); ctx.fillStyle = "#4a6b7a"; ctx.fillRect(it.x - 7, it.y - 5 + bob, 14, 3); }
      });
      enemies.forEach((e) => {
        const flip = e.x > P.x;
        const wob = Math.sin(e.t / 160) * 1.5;
        if (e.kind === "slime") drawSprite(ctx, SLIME_SP, SLIME_PAL, e.x - 12, e.y - 9 + wob, 3, flip);
        else if (e.kind === "bat") drawSprite(ctx, BAT_SP, BAT_PAL, e.x - 12, e.y - 9 + Math.sin(e.t / 110) * 4, 3, flip);
        else if (e.kind === "skel") drawSprite(ctx, SKEL_SP, SKEL_PAL, e.x - 12, e.y - 12 + wob, 3, flip);
        else {
          drawSprite(ctx, BOSS_SP, BOSS_PAL, e.x - 19, e.y - 18 + wob, 3, flip);
          ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(e.x - 26, e.y - 30, 52, 5);
          ctx.fillStyle = BERRY; ctx.fillRect(e.x - 26, e.y - 30, 52 * Math.max(0, e.hp / e.maxHp), 5);
        }
        if (e.flash > 0) { ctx.globalAlpha = e.flash / 130; ctx.fillStyle = "#fff"; ctx.fillRect(e.x - 13, e.y - 14, 26, 26); ctx.globalAlpha = 1; }
      });
      projs.forEach((p) => { ctx.fillStyle = "#e8e4d8"; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); });
      if (!dead) {
        if (P.ifr > 0 && Math.floor(P.ifr / 90) % 2) ctx.globalAlpha = 0.4;
        const step = P.moving ? Math.sin(t / 70) * 1.6 : 0;
        drawSprite(ctx, HERO_SP, HERO_PAL, P.x - 12, P.y - 13 + step, 3, P.face < 0);
        ctx.globalAlpha = 1;
        if (P.swing > 0) {
          ctx.strokeStyle = P.rangeMul > 1 ? "rgba(201,210,221,.9)" : "rgba(255,215,111,.85)"; ctx.lineWidth = 4;
          const a0 = P.face > 0 ? -0.9 : Math.PI - 0.5;
          ctx.beginPath(); ctx.arc(P.x, P.y, 34 * P.rangeMul, a0 - 0.7, a0 + 0.7); ctx.stroke(); ctx.lineWidth = 1;
        }
        if (P.shield > 0) {
          ctx.strokeStyle = "rgba(143,216,232,.75)"; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(P.x, P.y - 2, 20 + Math.sin(t / 200) * 1.6, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
        }
      }
      const grad = ctx.createRadialGradient(P.x, P.y, 60, P.x, P.y, 300);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(5,4,3,.82)");
      ctx.fillStyle = grad; ctx.fillRect(0, OY, g.W, g.H - OY);
      ctx.restore();
      // HUD
      ctx.fillStyle = "#1a1712"; ctx.fillRect(0, 0, g.W, OY);
      ctx.fillStyle = "#3a332a"; ctx.fillRect(0, OY - 3, g.W, 3);
      /* 商店按钮（顶栏左上角，44px 触控目标） */
      if (!dead && !shopOpen) {
        rr(ctx, 8, 10, 44, 44, 12);
        ctx.fillStyle = "rgba(239,163,44,.95)"; ctx.fill();
        ctx.strokeStyle = "#8a5f14"; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
        txt(ctx, "🛒", 30, 33, 21, "#000");
      }
      txt(ctx, `🗝 第 ${floor} 层`, 118, 22, 15, "#e8e4d8");
      if (bossAlive) txt(ctx, "☠ BOSS 层", 118, 44, 12, BERRY);
      for (let i = 0; i < P.maxHp; i++) drawSprite(ctx, HEART_SP, i < P.hp ? { r: "#d95d39" } : { r: "#3a332a" }, 150 + i * 24, 12, 3);
      txt(ctx, `⚔${P.atk}`, 150, 48, 12, "#ffd76f", "left");
      txt(ctx, `🪙${coins}`, 204, 48, 12, GOLD, "left");
      if (P.shield > 0) txt(ctx, `🛡${P.shield}`, 258, 48, 12, "#8fd8e8", "left");
      if (revives > 0) txt(ctx, `✨${revives}`, 306, 48, 12, "#ffd76f", "left");
      if (P.rangeMul > 1) txt(ctx, "🔱", 348, 48, 12, "#c9d2dd", "left");
      txt(ctx, `击杀 ${kills}`, g.W - 70, 22, 13, "#cfe3c2");
      if (combo > 1) txt(ctx, `×${combo} 连击!`, g.W - 70, 46, 14, combo > 5 ? BERRY : GOLD);
      if (P.ifr > 1200 && !dead) txt(ctx, "✨ 无敌中", 240, OY + 24, 14, "#8fd8e8");
      if (joy.on) {
        ctx.strokeStyle = "rgba(232,228,216,.3)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(joy.sx, joy.sy, 44, 0, 7); ctx.stroke();
        const l = Math.hypot(joy.dx, joy.dy) || 1, cl2 = Math.min(30, l);
        ctx.fillStyle = "rgba(232,228,216,.35)";
        ctx.beginPath(); ctx.arc(joy.sx + (joy.dx / l) * cl2, joy.sy + (joy.dy / l) * cl2, 18, 0, 7); ctx.fill();
        ctx.lineWidth = 1;
      } else if (!dead) {
        ctx.strokeStyle = "rgba(232,228,216,.14)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(92, g.H - 100, 42, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
        txt(ctx, "滑动移动", 92, g.H - 100, 11, "rgba(232,228,216,.35)");
      }
      rr(ctx, g.W - 92, g.H - 96, 72, 72, 36);
      ctx.fillStyle = "rgba(217,93,57,.85)"; ctx.fill();
      ctx.strokeStyle = "#ffd76f"; ctx.lineWidth = 2.5; ctx.stroke(); ctx.lineWidth = 1;
      txt(ctx, "⚔", g.W - 56, g.H - 60, 30, "#fff");
      if (dead) { ctx.fillStyle = "rgba(10,8,6,.85)"; ctx.fillRect(0, 0, g.W, g.H); txt(ctx, "☠ 你倒在了第 " + floor + " 层", g.W / 2, g.H / 2, 26, "#e8e4d8"); }
      if (flashFx > 0) { ctx.fillStyle = `rgba(255,255,255,${flashFx * 0.7})`; ctx.fillRect(0, 0, g.W, g.H); }
      /* 商店浮层 */
      if (shopOpen) {
        ctx.fillStyle = "rgba(10,8,6,.85)"; ctx.fillRect(0, 0, g.W, g.H);
        const PX = 46, PY = 88, PW = g.W - 92;
        rr(ctx, PX, PY, PW, 440, 16);
        ctx.fillStyle = "#1c1712"; ctx.fill();
        ctx.strokeStyle = "#f0c060"; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
        txt(ctx, "🛒 地牢商店", PX + PW / 2, PY + 26, 19, "#e8e4d8");
        txt(ctx, `🪙 ${wallet}（花园金币）`, PX + PW / 2, PY + 50, 13, GOLD);
        rr(ctx, PX + PW - 50, PY + 10, 40, 40, 20);
        ctx.fillStyle = "#3a332a"; ctx.fill();
        txt(ctx, "✕", PX + PW - 30, PY + 30, 18, "#e8e4d8");
        SHOP.forEach((it, i) => {
          const ry = PY + 68 + i * 54;
          const afford = wallet >= it.cost;
          const maxed = it.id === "spear" && P.rangeMul >= 2;
          rr(ctx, PX + 12, ry, PW - 24, 49, 10);
          ctx.fillStyle = maxed ? "#241f19" : afford ? "#2b2419" : "#201b15"; ctx.fill();
          ctx.strokeStyle = afford && !maxed ? "rgba(240,192,96,.4)" : "#3a332a"; ctx.stroke();
          txt(ctx, it.icon, PX + 40, ry + 25, 20, "#000");
          txt(ctx, it.name, PX + 68, ry + 15, 14, maxed ? "#8a8276" : "#e8e4d8", "left");
          txt(ctx, it.desc, PX + 68, ry + 35, 11, "#8a8276", "left");
          txt(ctx, maxed ? "已持有" : `🪙${it.cost}`, PX + PW - 56, ry + 25, 13, maxed ? "#8a8276" : afford ? GOLD : "#8a5f5f");
        });
        txt(ctx, shopMsg || "金币来自每局结算 · 内测码 123456 可兑换", PX + PW / 2, PY + 68 + 6 * 54 + 16, 12, shopMsg ? "#ffd76f" : "#6b6459");
      }
      ctx.imageSmoothingEnabled = true;
    },
    onPointer(tp, x, y, id) {
      if (dead) return;
      /* 商店交互（打开时屏蔽场上所有操作） */
      if (shopOpen) {
        if (tp !== "down") return;
        const PX = 46, PY = 88, PW = g.W - 92;
        if (x > PX + PW - 54 && x < PX + PW - 4 && y > PY + 6 && y < PY + 56) { shopOpen = false; g.sfx.click(); return; }
        for (let i = 0; i < SHOP.length; i++) {
          const ry = PY + 68 + i * 54;
          if (x > PX + 8 && x < PX + PW - 8 && y > ry && y < ry + 49) { buy(i); return; }
        }
        return;
      }
      const inAtkBtn = x > g.W - 118 && y > g.H - 122;
      const inShopBtn = !shopOpen && x >= 4 && x <= 56 && y >= 6 && y <= 58;
      if (tp === "down") {
        if (inShopBtn) { openShop(); return; }
        if (inAtkBtn) { atkId = id ?? -7; holdAtk = true; atkHoldT = 0; attack(); }
        else if (x < g.W * 0.6) { joy = { sx: x, sy: y, dx: 0, dy: 0, on: true, id: id ?? -8 }; }
        else attack();
      }
      if (tp === "move" && joy.on && (id === undefined || id === joy.id)) { joy.dx = x - joy.sx; joy.dy = y - joy.sy; }
      if (tp === "up") {
        if (id === undefined || id === joy.id) { joy.on = false; joy.dx = 0; joy.dy = 0; joy.id = -1; }
        if (id === undefined || id === atkId) { holdAtk = false; atkId = -1; }
      }
    },
    onKey(code, down) {
      if (code === "ArrowLeft" || code === "KeyA") keys.l = down;
      if (code === "ArrowRight" || code === "KeyD") keys.r = down;
      if (code === "ArrowUp" || code === "KeyW") keys.u = down;
      if (code === "ArrowDown" || code === "KeyS") keys.d = down;
      if ((code === "Space" || code === "KeyJ") && down) attack();
    },
  };
}

/* ================= 魂斗勇者 ================= */
const SOLDIER_SP = ["..rrr...", ".rfffr..", ".feef.g.", ".ffffggg", "..ttt...", ".ttttt..", ".t.t.t..", "..p.p...", ".pp..pp."];
const SOLDIER_PAL = { r: "#d95d39", f: "#e8c39e", e: "#22262e", t: "#4a6b3a", g: "#5a626e", p: "#33312c" };
const ENEMY_SP = ["..hhh...", ".hfffh..", ".feef...", ".ffffff.", "..uuu...", ".uuuuu..", ".u.u.u..", "..p.p..."];
const ENEMY_PAL = { h: "#5a626e", f: "#e8c39e", e: "#22262e", u: "#8a3a3a", p: "#33312c" };

export function createContra(g: GameCtx): GameHandle {
  const GY = 330, WORLD = 4600, BOSS_X = 4200;
  type Bul = { x: number; y: number; vx: number; vy: number; hurt: boolean; r: number };
  type Foe = { x: number; y: number; hp: number; kind: string; t: number; flash: number; dir: number };
  let P = { x: 80, y: GY, vy: 0, face: 1, onGround: true, lives: g.difficulty === "easy" ? 5 : 3, ifr: 0, weapon: "N" as "N" | "S" | "M", fireCd: 0 };
  let camX = 0, score = 0, kills = 0, dist = 0;
  let bullets: Bul[] = [], foes: Foe[] = [], booms: { x: number; y: number; t: number; big: boolean }[] = [], pickups: { x: number; y: number; kind: string }[] = [];
  let plats: { x: number; y: number; w: number }[] = [];
  let boss: { hp: number; maxHp: number; y: number; t: number; fireT: number; spawnT: number } | null = null;
  let bossTriggered = false, dead = false, won = false, overSent = false, shake = 0, t = 0;
  let keys = { l: false, r: false, u: false, jump: false };
  let touchMove = 0, jumpBtn = false, jumpHeld = false, moveId = -1, jumpId = -1;
  const hpMul = g.difficulty === "hard" ? 1.6 : g.difficulty === "easy" ? 0.7 : 1;
  (function build() {
    for (let x = 500; x < BOSS_X - 300; x += 380 + g.rnd(260)) plats.push({ x, y: GY - 90 - g.rnd(60), w: 110 + g.rnd(80) });
    for (let x = 420; x < BOSS_X - 200; x += 260 + g.rnd(300)) {
      const roll = Math.random();
      const kind = roll < 0.45 ? "runner" : roll < 0.75 ? "shooter" : roll < 0.9 ? "fly" : "turret";
      const onPlat = kind === "turret" && plats.length ? plats[g.rnd(plats.length)] : null;
      foes.push({ x, y: onPlat ? onPlat.y - 26 : kind === "fly" ? GY - 130 - g.rnd(60) : GY, hp: (kind === "turret" ? 3 : kind === "shooter" ? 2 : 1) * hpMul, kind, t: Math.random() * 999, flash: 0, dir: -1 });
    }
    for (let x = 700; x < BOSS_X - 300; x += 900 + g.rnd(500)) pickups.push({ x, y: GY - 140 - g.rnd(40), kind: ["S", "M", "H"][g.rnd(3)] });
  })();
  function fire() {
    const cd = P.weapon === "M" ? 110 : 240;
    if (P.fireCd > 0) return;
    P.fireCd = cd;
    const bx = P.x + P.face * 16, by = P.y - 20;
    const aimUp = keys.u;
    const mk = (vx: number, vy: number) => bullets.push({ x: bx, y: by, vx, vy, hurt: false, r: 4 });
    if (P.weapon === "S") { mk(P.face * 8, aimUp ? -6 : 0); mk(P.face * 7.6, aimUp ? -7 : -2); mk(P.face * 7.6, aimUp ? -5 : 2); }
    else mk(P.face * 9, aimUp ? -7 : 0);
    g.sfx.tone(760, 0.05, "square", 0.045, -300);
    shake = Math.min(4, shake + 1);
  }
  function boom(x: number, y: number, big = false) {
    booms.push({ x, y, t: big ? 600 : 380, big });
    shake = Math.min(big ? 14 : 8, shake + (big ? 10 : 5));
    g.sfx.boom();
  }
  function hurtPlayer() {
    P.lives--; P.ifr = 1600; P.weapon = "N";
    shake = 12; g.sfx.boom();
    boom(P.x, P.y - 10);
    g.juice.float(P.x, P.y - 50, P.lives > 0 ? "小心!" : "💀", BERRY, 16);
    if (P.lives <= 0) { dead = true; g.sfx.over(); score += dist * 2 + kills * 10; finish(); }
  }
  function finish() {
    if (overSent) return; overSent = true;
    setTimeout(() => g.over(score), 1100);
  }
  const btnL = { x: 14, y: g.H - 100, w: 64, h: 64 };
  const btnR = { x: 86, y: g.H - 100, w: 64, h: 64 };
  const btnJ = { x: g.W - 84, y: g.H - 100, w: 70, h: 70 };
  const inBtn = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  return {
    currentScore() { return Math.round(score + dist * 2 + kills * 10); },
    tick(dt) {
      g.juice.update(dt);
      if (dead || won) { booms.forEach((b) => (b.t -= dt)); booms = booms.filter((b) => b.t > 0); return; }
      t += dt;
      const k = dt / 16.7;
      P.fireCd = Math.max(0, P.fireCd - dt); P.ifr = Math.max(0, P.ifr - dt);
      shake *= 0.88;
      let mv = 0;
      if (keys.l) mv -= 1; if (keys.r) mv += 1;
      mv += touchMove;
      mv = clamp(mv, -1, 1);
      if (mv !== 0) { P.x += mv * 3.3 * k; P.face = mv > 0 ? 1 : -1; }
      P.x = clamp(P.x, camX + 20, bossTriggered ? WORLD - 40 : Math.min(WORLD - 40, camX + g.W - 20));
      const wantJump = keys.jump || jumpBtn;
      if (wantJump && !jumpHeld && P.onGround) { P.vy = -11.2; P.onGround = false; g.sfx.jump(); }
      jumpHeld = wantJump;
      P.vy = Math.min(13, P.vy + 0.55 * k);
      P.y += P.vy * k;
      let grounded = false;
      if (P.vy >= 0) {
        for (const pl of plats) {
          if (P.x > pl.x - 8 && P.x < pl.x + pl.w + 8 && P.y >= pl.y && P.y - P.vy * k <= pl.y + 8) { P.y = pl.y; P.vy = 0; grounded = true; break; }
        }
        if (P.y >= GY) { P.y = GY; P.vy = 0; grounded = true; }
      }
      P.onGround = grounded;
      const foeAhead = foes.some((f) => f.x > camX - 40 && f.x < camX + g.W + 40 && Math.abs(f.y - P.y) < 190) || (boss && boss.hp > 0);
      if (foeAhead || keys.u) fire();
      dist = Math.max(dist, Math.floor(P.x / 10));
      const camTarget = bossTriggered ? WORLD - g.W : P.x - g.W * 0.35; // 锁到最右，让 Boss 进场可见
      camX = clamp(camX + (camTarget - camX) * 0.1 * k, 0, WORLD - g.W);
      if (!bossTriggered && P.x > BOSS_X - g.W * 0.5) {
        bossTriggered = true;
        boss = { hp: 260 * hpMul, maxHp: 260 * hpMul, y: GY - 90, t: 0, fireT: 1200, spawnT: 4000 };
        g.sfx.tone(110, 0.6, "sawtooth", 0.16, -30); shake = 14;
        g.juice.float(P.x + 60, P.y - 80, "⚠ 军团机甲来袭!", BERRY, 20);
      }
      foes.forEach((f) => {
        f.t += dt; f.flash = Math.max(0, f.flash - dt);
        if (f.x < camX - 100 || f.x > camX + g.W + 200) return;
        if (f.kind === "runner") { f.x -= 1.5 * g.mult * k; f.dir = -1; }
        if (f.kind === "fly") {
          f.x -= 1.1 * g.mult * k;
          const wantY = Math.abs(f.x - P.x) < 260 ? P.y - 46 : GY - 130; // 俯冲攻击
          f.y += (wantY - f.y) * 0.03 * k + Math.sin(f.t / 240) * 1.2 * k;
        }
        if (f.kind === "shooter" && Math.floor(f.t / 1700) !== Math.floor((f.t - dt) / 1700) && Math.abs(f.x - P.x) < 420) {
          const a = Math.atan2(P.y - 20 - f.y, P.x - f.x);
          bullets.push({ x: f.x, y: f.y - 10, vx: Math.cos(a) * 4.4, vy: Math.sin(a) * 4.4, hurt: true, r: 5 });
          g.sfx.tone(300, 0.06, "sawtooth", 0.05, -100);
        }
        if (f.kind === "turret" && Math.floor(f.t / 1300) !== Math.floor((f.t - dt) / 1300) && Math.abs(f.x - P.x) < 400) {
          bullets.push({ x: f.x, y: f.y, vx: P.x > f.x ? 4.6 : -4.6, vy: 0, hurt: true, r: 5 });
          g.sfx.tone(260, 0.06, "sawtooth", 0.05, -80);
        }
        if (P.ifr <= 0 && Math.abs(f.x - P.x) < 22 && Math.abs(f.y - P.y) < 34) hurtPlayer();
      });
      if (boss) {
        boss.t += dt; boss.fireT -= dt; boss.spawnT -= dt;
        boss.y = GY - 62 + Math.sin(boss.t / 900) * 26; // 压低到弹道能打中的高度
        const bx = WORLD - 150;
        if (boss.fireT <= 0) {
          boss.fireT = 1500;
          for (let i = -2; i <= 2; i++) bullets.push({ x: bx - 40, y: boss.y, vx: -5, vy: i * 1.6, hurt: true, r: 6 });
          g.sfx.tone(180, 0.15, "sawtooth", 0.1, -60);
        }
        if (boss.spawnT <= 0 && foes.length < 8) {
          boss.spawnT = 4200;
          foes.push({ x: bx - 60, y: GY, hp: hpMul, kind: "runner", t: 0, flash: 0, dir: -1 });
        }
        if (P.ifr <= 0 && Math.hypot(bx - P.x, boss.y - (P.y - 20)) < 60) hurtPlayer();
        if (boss.hp <= 0) {
          won = true; score += 5000;
          for (let i = 0; i < 5; i++) setTimeout(() => boom(bx + (Math.random() - 0.5) * 90, (boss?.y ?? GY - 90) + (Math.random() - 0.5) * 70, true), i * 180);
          g.sfx.win(); finish();
        }
      }
      bullets.forEach((b) => { b.x += b.vx * k; b.y += b.vy * k; });
      bullets = bullets.filter((b) => {
        if (b.x < camX - 60 || b.x > camX + g.W + 60 || b.y < -40 || b.y > g.H + 40) return false;
        if (b.hurt) {
          if (P.ifr <= 0 && Math.hypot(b.x - P.x, b.y - (P.y - 18)) < 18) { hurtPlayer(); return false; }
          return true;
        }
        for (const f of foes) {
          if (f.hp > 0 && Math.abs(b.x - f.x) < 20 && Math.abs(b.y - (f.y - 14)) < 24) {
            f.hp--; f.flash = 100; b.x = -9999;
            if (f.hp <= 0) {
              kills++; score += f.kind === "turret" ? 300 : 100;
              boom(f.x, f.y - 10);
              g.juice.float(f.x, f.y - 40, "+" + (f.kind === "turret" ? 300 : 100), GOLD, 14);
            } else g.sfx.tone(500, 0.04, "square", 0.05);
            break;
          }
        }
        if (boss && b.x > -9000 && Math.abs(b.x - (WORLD - 150)) < 64 && Math.abs(b.y - boss.y) < 70) {
          boss.hp -= P.weapon === "S" ? 2 : 1.6; b.x = -9999;
          g.sfx.tone(420, 0.04, "square", 0.05);
          if (Math.random() < 0.2) g.juice.burst(WORLD - 150, boss.y, "#ffd76f", 5);
        }
        return b.x > -9000;
      });
      foes = foes.filter((f) => f.hp > 0 && f.x > camX - 160);
      pickups = pickups.filter((p) => {
        if (Math.hypot(p.x - P.x, p.y - (P.y - 18)) < 30) {
          if (p.kind === "H") { P.lives++; g.juice.float(p.x, p.y - 20, "+1 命!", BERRY, 17); }
          else { P.weapon = p.kind as "S" | "M"; g.juice.float(p.x, p.y - 20, p.kind === "S" ? "S 散弹!" : "M 速射!", "#8fd8e8", 17); }
          g.sfx.win(); shake = 5;
          return false;
        }
        return true;
      });
      booms.forEach((b) => (b.t -= dt)); booms = booms.filter((b) => b.t > 0);
    },
    draw(ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      const sky = ctx.createLinearGradient(0, 0, 0, g.H);
      sky.addColorStop(0, "#2a1a3a"); sky.addColorStop(0.5, "#8a3a4a"); sky.addColorStop(0.85, "#e07a3f");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, g.W, g.H);
      ctx.fillStyle = "#ffd76f"; ctx.beginPath(); ctx.arc(g.W * 0.72, 90, 34, 0, 7); ctx.fill();
      ctx.fillStyle = "#3a2444";
      for (let i = 0; i < 8; i++) {
        const mx = ((i * 260 - camX * 0.25) % (g.W + 300)) - 150;
        ctx.beginPath(); ctx.moveTo(mx, GY); ctx.lineTo(mx + 130, GY - 150 - (i % 3) * 30); ctx.lineTo(mx + 260, GY); ctx.fill();
      }
      ctx.fillStyle = "#4a2f3f";
      for (let i = 0; i < 8; i++) {
        const mx = ((i * 200 - camX * 0.5) % (g.W + 260)) - 130;
        ctx.beginPath(); ctx.moveTo(mx, GY); ctx.lineTo(mx + 100, GY - 90 - (i % 2) * 30); ctx.lineTo(mx + 200, GY); ctx.fill();
      }
      ctx.save(); ctx.translate(-camX, 0);
      ctx.fillStyle = "#2f4a2f"; ctx.fillRect(camX - 10, GY, g.W + 20, g.H - GY);
      ctx.fillStyle = "#3f6a3f"; ctx.fillRect(camX - 10, GY, g.W + 20, 5);
      ctx.fillStyle = "#26402a";
      for (let i = 0; i < 30; i++) { const gx = camX + ((i * 67) % g.W); ctx.fillRect(gx, GY + 14 + (i % 3) * 12, 22, 3); }
      plats.forEach((pl) => {
        if (pl.x < camX - 200 || pl.x > camX + g.W + 200) return;
        ctx.fillStyle = "#5a4a3a"; ctx.fillRect(pl.x, pl.y, pl.w, 12);
        ctx.fillStyle = "#7a6a52"; ctx.fillRect(pl.x, pl.y, pl.w, 4);
      });
      pickups.forEach((p) => {
        if (p.x < camX - 60 || p.x > camX + g.W + 60) return;
        const bob = Math.sin(t / 240 + p.x) * 3;
        ctx.fillStyle = "#d95d39";
        ctx.fillRect(p.x - 13, p.y - 13 + bob, 26, 26);
        txt(ctx, p.kind, p.x, p.y + bob, 16, "#fff");
        ctx.strokeStyle = "#ffd76f"; ctx.strokeRect(p.x - 13, p.y - 13 + bob, 26, 26);
      });
      foes.forEach((f) => {
        if (f.x < camX - 80 || f.x > camX + g.W + 80) return;
        if (f.kind === "runner" || f.kind === "shooter") {
          const step = Math.sin(f.t / 90) * 1.5;
          drawSprite(ctx, ENEMY_SP, f.kind === "shooter" ? { ...ENEMY_PAL, u: "#3a5a8a" } : ENEMY_PAL, f.x - 12, f.y - 27 + step, 3, f.x < P.x);
        } else if (f.kind === "turret") {
          ctx.fillStyle = "#5a626e"; ctx.fillRect(f.x - 16, f.y - 16, 32, 16);
          ctx.fillStyle = "#3d434c"; ctx.fillRect(f.x + (f.x > P.x ? -26 : 10), f.y - 12, 16, 7);
          ctx.fillStyle = "#d95d39"; ctx.fillRect(f.x - 4, f.y - 22, 8, 6);
        } else {
          const fy = f.y + Math.sin(f.t / 120) * 2;
          ctx.fillStyle = "#6a539a"; ctx.fillRect(f.x - 14, fy - 16, 28, 12);
          ctx.fillStyle = "#ffd76f"; ctx.fillRect(f.x - 6, fy - 13, 5, 5); ctx.fillRect(f.x + 2, fy - 13, 5, 5);
          ctx.fillStyle = "#4a3a6a"; ctx.fillRect(f.x - 10, fy - 4, 6, 4); ctx.fillRect(f.x + 4, fy - 4, 6, 4);
        }
        if (f.flash > 0) { ctx.globalAlpha = f.flash / 100; ctx.fillStyle = "#fff"; ctx.fillRect(f.x - 14, f.y - 28, 28, 28); ctx.globalAlpha = 1; }
      });
      if (boss) {
        const bx = WORLD - 150;
        const step = Math.sin(boss.t / 150) * 2;
        ctx.fillStyle = "#3d434c";
        ctx.fillRect(bx - 20, boss.y + 30, 14, GY - boss.y - 30 + step);
        ctx.fillRect(bx + 8, boss.y + 30, 14, GY - boss.y - 30 - step);
        ctx.fillStyle = "#5a626e"; ctx.fillRect(bx - 44, boss.y - 34, 88, 66);
        ctx.fillStyle = "#8a3a3a"; ctx.fillRect(bx - 34, boss.y - 22, 30, 20);
        ctx.fillStyle = "#ffd76f"; ctx.fillRect(bx - 28, boss.y - 16, 8, 8); ctx.fillRect(bx - 14, boss.y - 16, 8, 8);
        ctx.fillStyle = "#3d434c"; ctx.fillRect(bx - 60, boss.y - 8, 20, 10);
        ctx.fillStyle = "#2f343c"; ctx.fillRect(bx - 44, boss.y - 44, 88, 12);
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(camX + 60, 66, g.W - 120, 12);
        ctx.fillStyle = BERRY; ctx.fillRect(camX + 60, 66, (g.W - 120) * Math.max(0, boss.hp / boss.maxHp), 12);
        txt(ctx, "军团机甲", camX + g.W / 2, 52, 13, "#ffd76f");
      }
      bullets.forEach((b) => {
        ctx.fillStyle = b.hurt ? "#ff9d7a" : "#ffd76f";
        ctx.fillRect(b.x - b.r, b.y - 2, b.r * 2 + 6 * Math.sign(b.vx || 1), 4);
      });
      booms.forEach((b) => {
        const p = 1 - b.t / (b.big ? 600 : 380);
        const r = (b.big ? 52 : 30) * (0.4 + p * 0.8);
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = "#ffd76f"; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.fill();
        ctx.fillStyle = "#d95d39"; ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.6, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      });
      if (!dead) {
        if (P.ifr > 0 && Math.floor(P.ifr / 90) % 2) ctx.globalAlpha = 0.35;
        const run = touchMove !== 0 || keys.l || keys.r;
        const step = run && P.onGround ? Math.sin(t / 60) * 1.8 : 0;
        drawSprite(ctx, SOLDIER_SP, SOLDIER_PAL, P.x - 12, P.y - 27 + step, 3, P.face < 0);
        ctx.globalAlpha = 1;
        if (P.fireCd > (P.weapon === "M" ? 70 : 170)) { ctx.fillStyle = "#ffd76f"; ctx.beginPath(); ctx.arc(P.x + P.face * 24, P.y - 22, 6, 0, 7); ctx.fill(); }
      }
      ctx.restore();
      // HUD
      ctx.fillStyle = "rgba(20,14,24,.75)"; ctx.fillRect(0, 0, g.W, 44);
      txt(ctx, `分数 ${score}`, 74, 22, 15, "#ffd76f");
      txt(ctx, `${dist} m`, g.W / 2, 22, 14, "#e8e4d8");
      txt(ctx, "❤".repeat(Math.max(0, P.lives)), g.W - 60, 22, 13, BERRY);
      txt(ctx, P.weapon === "N" ? "普通" : P.weapon === "S" ? "S 散弹" : "M 速射", g.W - 140, 22, 12, "#8fd8e8");
      if (!bossTriggered && !dead && !won) txt(ctx, `→ 距离 Boss ${Math.max(0, Math.floor((BOSS_X - P.x) / 10))}m`, g.W / 2, 56, 12, "rgba(255,215,111,.8)");
      rr(ctx, btnL.x, btnL.y, btnL.w, btnL.h, 16); ctx.fillStyle = touchMove < 0 ? "rgba(255,215,111,.5)" : "rgba(232,228,216,.18)"; ctx.fill();
      txt(ctx, "◀", btnL.x + 32, btnL.y + 34, 24, "#fff");
      rr(ctx, btnR.x, btnR.y, btnR.w, btnR.h, 16); ctx.fillStyle = touchMove > 0 ? "rgba(255,215,111,.5)" : "rgba(232,228,216,.18)"; ctx.fill();
      txt(ctx, "▶", btnR.x + 32, btnR.y + 34, 24, "#fff");
      rr(ctx, btnJ.x, btnJ.y, btnJ.w, btnJ.h, 35); ctx.fillStyle = jumpBtn ? "rgba(217,93,57,.7)" : "rgba(217,93,57,.35)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,215,111,.6)"; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
      txt(ctx, "跳", btnJ.x + 35, btnJ.y + 36, 20, "#fff");
      txt(ctx, "🔫 自动开火", g.W / 2, g.H - 22, 11, "rgba(232,228,216,.5)");
      if (dead) { ctx.fillStyle = "rgba(20,10,14,.85)"; ctx.fillRect(0, 0, g.W, g.H); txt(ctx, "💀 任务失败", g.W / 2, g.H / 2, 30, "#e8e4d8"); }
      if (won) { ctx.fillStyle = "rgba(20,14,24,.6)"; ctx.fillRect(0, 0, g.W, g.H); txt(ctx, "🎖 军团覆灭!", g.W / 2, g.H / 2, 32, "#ffd76f"); }
      g.juice.draw(ctx);
      ctx.imageSmoothingEnabled = true;
    },
    onPointer(tp, x, y, id) {
      if (dead || won) return;
      if (tp === "down") {
        if (inBtn(btnJ, x, y)) { jumpId = id ?? -3; jumpBtn = true; }
        else if (inBtn(btnL, x, y)) { moveId = id ?? -1; touchMove = -1; }
        else if (inBtn(btnR, x, y)) { moveId = id ?? -2; touchMove = 1; }
        else if (x < g.W * 0.5) { moveId = id ?? -4; touchMove = x < P.x - camX ? -1 : 1; }
      }
      if (tp === "move" && (id === undefined || id === moveId)) {
        if (inBtn(btnL, x, y)) touchMove = -1;
        else if (inBtn(btnR, x, y)) touchMove = 1;
        else if (x < g.W * 0.5) touchMove = x < P.x - camX ? -1 : 1;
      }
      if (tp === "up") {
        if (id === undefined || id === moveId) { touchMove = 0; moveId = -1; }
        if (id === undefined || id === jumpId) { jumpBtn = false; jumpId = -1; }
      }
    },
    onKey(code, down) {
      if (code === "ArrowLeft" || code === "KeyA") keys.l = down;
      if (code === "ArrowRight" || code === "KeyD") keys.r = down;
      if (code === "ArrowUp" || code === "KeyW") keys.u = down;
      if ((code === "Space" || code === "KeyK" || code === "KeyX") && down) { keys.jump = true; setTimeout(() => (keys.jump = false), 120); }
    },
  };
}
