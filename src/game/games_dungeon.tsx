/* 像素地牢 v2 —— Roguelike：火把光影、6 种怪物、骷髅王三阶段、冲刺无敌帧 */
import { GameCtx, GameHandle, clamp, rr } from "./engine";

const T = 32, MW = 15, MH = 17, OY = 64;
const GOLD = "#ffd76f", BERRY = "#d95d39";

function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center") {
  ctx.fillStyle = color; ctx.font = `700 ${size}px "Noto Sans SC", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
}
function drawSprite(ctx: CanvasRenderingContext2D, sp: string[], pal: Record<string, string>, x: number, y: number, s: number, flip = false) {
  for (let r = 0; r < sp.length; r++) for (let c = 0; c < sp[r].length; c++) {
    const ch = sp[r][flip ? sp[r].length - 1 - c : c];
    const col = pal[ch]; if (!col) continue;
    ctx.fillStyle = col; ctx.fillRect(x + c * s, y + r * s, s, s);
  }
}

/* ---------------- 像素精灵 ---------------- */
const KNIGHT = ["...RR...", "..RRRR..", "..GGGG..", ".GGDDGG.", ".GGDDGG.", "..AAAA..", ".YAABAY.", ".AABBAA.", "..AAAA..", "..L..L..", ".LL..LL."];
const KNIGHT_PAL = { R: "#d95d39", G: "#aeb9c4", D: "#23272e", A: "#5f7d95", B: "#46617a", Y: "#e0a33c", L: "#3a4a5c" };
const SLIME = ["..GGGG..", ".GGGGGG.", "GGWBGWBG", "GGGGGGGG", "GGGGGGGG", ".DGGGGD."];
const SLIME_PAL = { G: "#7cb356", D: "#3a5c28", W: "#ffffff", B: "#22262c" };
const SLIME_MINI_PAL = { G: "#a4d47e", D: "#4a6c38", W: "#ffffff", B: "#22262c" };
const BAT = ["PP....PP", "PPPRRPPP", ".PPPPPP.", "..PPPP.."];
const BAT_PAL = { P: "#7a5fae", R: "#ff6b6b" };
const SKEL = [".BBBBBB.", "BBDBBDB.", "BBBBBBB.", ".BBBBBB.", "..BBBB..", ".BBBBBB.", "B.BBBB.B", "..BBBB..", "..B..B..", ".BB..BB."];
const SKEL_PAL = { B: "#e8e0cf", D: "#1a1a1a" };
const ARCHER_PAL = { B: "#cfe0b8", D: "#2c3a1e" };
const WRAITH = ["..CCCC..", ".CCCCCC.", "CCECCECC", "CCCCCCCC", "CCCCCCCC", "CCCCCCCC", "C.CCCC.C", ".CC..CC."];
const WRAITH_PAL = { C: "#9fc4d8", E: "#ffdf6f" };
const KING = ["..Y.YY.Y..", "..YYYYYY..", ".BBBBBBBB.", "BBBDBBDBB.", "BBBBBBBBB.", ".BBBBBBBB.", "..PPPPPP..", ".PPPPPPPP.", "PPBBBBBBPP", "PP.BBBB.PP", "...B..B...", "..BB..BB.."];
const KING_PAL = { Y: "#ffd76f", B: "#e8e0cf", D: "#a32020", P: "#5d3a6e" };

type Enemy = { kind: string; x: number; y: number; hp: number; maxHp: number; spd: number; r: number; t: number; flash: number; hitCd: number; mini?: boolean; boss?: boolean; chargeT?: number; chargeDir?: number; ringT?: number; summonT?: number };
type Arrow = { x: number; y: number; vx: number; vy: number; from: string };
type Item = { x: number; y: number; kind: string; t: number };
type Amb = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; s: number };

export function createPixelDungeon(g: GameCtx): GameHandle {
  const hpMul = g.mult, spdMul = 0.75 + 0.25 * g.mult;
  let map: number[][] = [];
  let torches: { x: number; y: number; ph: number }[] = [];
  let decors: { x: number; y: number; k: number }[] = [];
  let stairs = { x: 0, y: 0, locked: false };
  let floor = 1, score = 0, kills = 0;
  let P = {
    x: 0, y: 0, hp: g.difficulty === "easy" ? 130 : 100, maxHp: g.difficulty === "easy" ? 130 : 100,
    atk: 12, spd: 2.4, face: 1, atkCd: 0, atkT: 0, inv: 0, dashT: 0, dashCd: 0, dashFace: 1, anim: 0, moving: false, coins: 0,
    bow: 0, shield: 0, berserkT: 0, // 弓等级 / 护盾值 / 狂暴剩余
  };
  let bowT = 0;
  let enemies: Enemy[] = [], arrows: Arrow[] = [], items: Item[] = [], amb: Amb[] = [];
  let joyId = -1, atkId = -1, dashId = -1, holdAtk = false, joy = { on: false, sx: 0, sy: 0, dx: 0, dy: 0 };
  let keys = { l: false, r: false, u: false, d: false };
  let freeze = 0, fade = 0, fading = false, regenQueued = false, dead = false, overSent = false;
  let banner = { t: "", sub: "", life: 0 };
  let hpShown = P.hp;
  const darkCv = document.createElement("canvas");
  darkCv.width = g.W; darkCv.height = g.H;
  const dctx = darkCv.getContext("2d")!;
  const boss = () => enemies.find((e) => e.boss);

  /* ---------------- 地图生成 ---------------- */
  function genFloor() {
    map = Array.from({ length: MH }, () => Array(MW).fill(1));
    torches = []; decors = []; enemies = []; arrows = []; items = [];
    const rooms: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < 60 && rooms.length < 6; i++) {
      const w = 3 + g.rnd(4), h = 3 + g.rnd(3);
      const x = 1 + g.rnd(MW - w - 2), y = 1 + g.rnd(MH - h - 2);
      if (rooms.some((r) => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) continue;
      rooms.push({ x, y, w, h });
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) map[yy][xx] = 0;
    }
    if (rooms.length < 2) { rooms.length = 0; rooms.push({ x: 2, y: 2, w: 4, h: 3 }, { x: 9, y: 11, w: 4, h: 4 }); for (const r of rooms) for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) map[yy][xx] = 0; }
    for (let i = 0; i < rooms.length - 1; i++) {
      const a = rooms[i], b = rooms[i + 1];
      let cx = a.x + (a.w >> 1), cy = a.y + (a.h >> 1);
      const tx = b.x + (b.w >> 1), ty = b.y + (b.h >> 1);
      while (cx !== tx) { map[cy][cx] = 0; cx += Math.sign(tx - cx); }
      while (cy !== ty) { map[cy][cx] = 0; cy += Math.sign(ty - cy); }
      map[cy][cx] = 0;
    }
    // 火把：靠墙的地板旁的墙格
    const cand: { x: number; y: number }[] = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (map[y][x] !== 1) continue;
      const nearFloor = (map[y + 1]?.[x] === 0 || map[y - 1]?.[x] === 0 || map[y][x + 1] === 0 || map[y][x - 1] === 0);
      if (nearFloor) cand.push({ x, y });
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = g.rnd(i + 1); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    torches = cand.slice(0, 7).map((c) => ({ x: c.x * T + T / 2, y: OY + c.y * T + 6, ph: 1 + g.rnd(4) }));
    // 装饰：裂缝 / 苔藓 / 蛛网
    const floorTiles: [number, number][] = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (map[y][x] === 0) floorTiles.push([x, y]);
    for (let i = 0; i < 14 && floorTiles.length; i++) { const [x, y] = floorTiles[g.rnd(floorTiles.length)]; decors.push({ x, y, k: g.rnd(3) }); }
    // 出生点 & 楼梯
    const r0 = rooms[0], rN = rooms[rooms.length - 1];
    P.x = (r0.x + r0.w / 2) * T; P.y = OY + (r0.y + r0.h / 2) * T;
    const isBoss = floor % 5 === 0;
    stairs = { x: (rN.x + (rN.w >> 1)) * T + T / 2, y: OY + (rN.y + (rN.h >> 1)) * T + T / 2, locked: isBoss };
    map[rN.y + (rN.h >> 1)][rN.x + (rN.w >> 1)] = 2;
    // 怪物
    const spawnAt = (): [number, number] => {
      const rm = rooms[1 + g.rnd(rooms.length - 1)] ?? rN;
      return [(rm.x + g.rnd(rm.w)) * T + T / 2, OY + (rm.y + g.rnd(rm.h)) * T + T / 2];
    };
    const pool: string[] = ["slime", "slime", "bat"];
    if (floor >= 2) pool.push("skel", "skel");
    if (floor >= 3) pool.push("archer");
    if (floor >= 5) pool.push("wraith");
    const n = Math.min(12, 4 + floor + g.rnd(3));
    for (let i = 0; i < n; i++) {
      const kind = pool[g.rnd(pool.length)];
      const [x, y] = spawnAt();
      addEnemy(kind, x, y);
    }
    if (isBoss) {
      const hp = (300 + floor * 60) * hpMul;
      enemies.push({ kind: "king", x: stairs.x, y: stairs.y - 60, hp, maxHp: hp, spd: 0.55 * spdMul, r: 26, t: 0, flash: 0, hitCd: 0, boss: true, chargeT: 2200, ringT: 0, summonT: 0 });
      banner = { t: `☠ 第 ${floor} 层 · 骷髅王的巢穴`, sub: "击败它，楼梯才会开启", life: 2600 };
      g.sfx.tone(110, 0.5, "sawtooth", 0.14, -30);
    } else banner = { t: `第 ${floor} 层`, sub: floor === 1 ? "找到楼梯，往下走" : "", life: 1800 };
    // 物品
    for (let i = 0; i < 2 + g.rnd(2); i++) {
      const [x, y] = spawnAt();
      const roll = g.rnd(10);
      items.push({ x, y, kind: roll < 3 ? "heart" : roll < 5 ? "coin" : roll < 7 ? "sword" : roll < 9 ? "boots" : "potion", t: g.rnd(999) });
    }
  }
  function addEnemy(kind: string, x: number, y: number, mini = false) {
    const f = 1 + (floor - 1) * 0.22;
    const defs: Record<string, { hp: number; spd: number; r: number }> = {
      slime: { hp: 16 * f, spd: 0.85, r: 12 },
      bat: { hp: 10 * f, spd: 1.5, r: 10 },
      skel: { hp: 30 * f, spd: 1.05, r: 13 },
      archer: { hp: 22 * f, spd: 0.9, r: 13 },
      wraith: { hp: 26 * f, spd: 1.2, r: 12 },
    };
    const d = defs[kind]; if (!d) return;
    enemies.push({ kind, x, y, hp: (mini ? d.hp * 0.45 : d.hp) * hpMul, maxHp: (mini ? d.hp * 0.45 : d.hp) * hpMul, spd: d.spd * spdMul * (mini ? 1.4 : 1), r: mini ? d.r * 0.7 : d.r, t: g.rnd(999), flash: 0, hitCd: 0, mini });
  }

  /* ---------------- 碰撞 ---------------- */
  const tileAt = (x: number, y: number) => map[Math.floor((y - OY) / T)]?.[Math.floor(x / T)] ?? 1;
  const solid = (x: number, y: number, r: number) => tileAt(x - r, y - r) === 1 || tileAt(x + r, y - r) === 1 || tileAt(x - r, y + r) === 1 || tileAt(x + r, y + r) === 1;
  function moveEnt(e: { x: number; y: number }, dx: number, dy: number, r: number) {
    if (dx && !solid(e.x + dx, e.y, r)) e.x += dx;
    if (dy && !solid(e.x, e.y + dy, r)) e.y += dy;
  }

  /* ---------------- 战斗 ---------------- */
  function blood(x: number, y: number, c: string, n: number) { g.juice.burst(x, y, c, n); }
  function damageEnemy(e: Enemy, dmg: number, kx: number, ky: number) {
    const crit = Math.random() < 0.12;
    const d = Math.round(dmg * (crit ? 2 : 1));
    e.hp -= d; e.flash = 100; e.hitCd = 220;
    freeze = Math.max(freeze, e.hp <= 0 ? 80 : 40);
    g.juice.shake(e.hp <= 0 ? 5 : 2.5);
    g.juice.float(e.x, e.y - e.r - 8, String(d), crit ? GOLD : "#ffffff", crit ? 19 : 14);
    const pal = e.kind === "slime" ? "#7cb356" : e.kind === "wraith" ? "#9fc4d8" : e.kind === "bat" ? "#7a5fae" : "#e8e0cf";
    blood(e.x, e.y, pal, e.hp <= 0 ? 14 : 6);
    if (kx || ky) { const nx = e.x + kx, ny = e.y + ky; if (!solid(nx, e.y, e.r)) e.x = nx; if (!solid(e.x, ny, e.r)) e.y = ny; }
    g.sfx.tone(200 + Math.random() * 60, 0.05, "square", 0.07, -80);
    if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e: Enemy) {
    kills++; score += e.boss ? 2000 : e.mini ? 10 : 20;
    g.sfx.score();
    if (e.kind === "slime" && !e.mini) { addEnemy("slime", e.x - 12, e.y, true); addEnemy("slime", e.x + 12, e.y, true); g.juice.float(e.x, e.y - 24, "分裂!", "#a4d47e", 12); }
    if (Math.random() < (e.boss ? 1 : 0.16)) items.push({ x: e.x, y: e.y, kind: e.boss ? "potion" : ["heart", "coin", "coin", "sword", "boots"][g.rnd(5)], t: 0 });
    if (e.boss) {
      stairs.locked = false;
      score += 0;
      banner = { t: "🏆 骷髅王倒下了", sub: "楼梯已开启，继续深入", life: 2200 };
      g.juice.shake(12); g.sfx.boom(); g.sfx.win();
      for (let i = 0; i < 5; i++) items.push({ x: stairs.x + (g.rnd(5) - 2) * 18, y: stairs.y - 20, kind: "coin", t: i * 100 });
    }
  }
  function hurtPlayer(dmg: number, fx: number, fy: number) {
    if (P.inv > 0 || P.dashT > 0 || dead) return;
    P.hp -= dmg; P.inv = 900;
    g.juice.shake(8); g.sfx.hit();
    blood(P.x, P.y, "#d95d39", 10);
    g.juice.float(P.x, P.y - 26, `-${dmg}`, BERRY, 16);
    const kx = clamp((P.x - fx) * 0.3, -14, 14), ky = clamp((P.y - fy) * 0.3, -14, 14);
    if (!solid(P.x + kx, P.y, 10)) P.x += kx;
    if (!solid(P.x, P.y + ky, 10)) P.y += ky;
    if (P.hp <= 0) {
      P.hp = 0; dead = true;
      blood(P.x, P.y, "#d95d39", 26); g.sfx.boom(); g.sfx.over();
      banner = { t: `💀 倒在第 ${floor} 层`, sub: `击杀 ${kills} · 金币 ${P.coins}`, life: 99999 };
      if (!overSent) { overSent = true; setTimeout(() => g.over(score + floor * 800), 1300); }
    }
  }
  function attack() {
    if (P.atkCd > 0 || dead) return;
    P.atkCd = 300; P.atkT = 180;
    g.sfx.tone(900, 0.08, "sawtooth", 0.05, -600);
    let hitAny = false;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
      if (d < 58 + e.r * 0.4 && dx * P.face >= -10) { damageEnemy(e, P.atk, (dx / (d || 1)) * 7, (dy / (d || 1)) * 7); hitAny = true; }
    }
    if (hitAny) freeze = Math.max(freeze, 45);
  }
  function dash() {
    if (P.dashCd > 0 || dead) return;
    P.dashCd = 2200; P.dashT = 170; P.dashFace = P.face;
    g.sfx.tone(500, 0.1, "triangle", 0.08, 400);
  }

  /* ---------------- 主循环 ---------------- */
  genFloor();
  return {
    tick(dt) {
      g.juice.update(dt);
      if (freeze > 0) { freeze -= dt; return; }
      banner.life = Math.max(0, banner.life - dt);
      if (fading) {
        fade += dt / 260;
        if (fade >= 1 && regenQueued) { floor++; score += 800; genFloor(); regenQueued = false; g.sfx.tone(300, 0.2, "triangle", 0.1, 200); }
        if (fade >= 1 && !regenQueued) { fade -= dt / 300; if (fade <= 0) { fade = 0; fading = false; } }
        return;
      }
      if (dead) return;
      const k = dt / 16.7;
      P.atkCd = Math.max(0, P.atkCd - dt); P.atkT = Math.max(0, P.atkT - dt);
      P.inv = Math.max(0, P.inv - dt); P.dashCd = Math.max(0, P.dashCd - dt); P.dashT = Math.max(0, P.dashT - dt);
      hpShown += (P.hp - hpShown) * 0.12 * k;
      // 移动
      let mx = 0, my = 0;
      if (keys.l) mx -= 1; if (keys.r) mx += 1; if (keys.u) my -= 1; if (keys.d) my += 1;
      if (joy.on) { mx += clamp(joy.dx / 42, -1, 1); my += clamp(joy.dy / 42, -1, 1); }
      const ml = Math.hypot(mx, my);
      P.moving = ml > 0.1;
      if (P.moving) {
        const sp = (P.dashT > 0 ? 9 : P.spd) * k;
        if (mx) P.face = mx > 0 ? 1 : -1;
        moveEnt(P, (mx / ml) * sp, (my / ml) * sp, 10);
        P.anim += dt * (P.dashT > 0 ? 0.05 : 0.02);
        if (P.dashT > 0 && Math.random() < 0.5) amb.push({ x: P.x, y: P.y, vx: 0, vy: 0, life: 260, max: 260, c: "ghost", s: 1 });
      }
      // 卡墙救援
      if (solid(P.x, P.y, 8)) {
        const cx = Math.floor(P.x / T), cy = Math.floor((P.y - OY) / T);
        out: for (let r = 1; r < 7; r++) for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
          if ((map[cy + oy]?.[cx + ox] ?? 1) !== 1) { P.x = (cx + ox) * T + T / 2; P.y = OY + (cy + oy) * T + T / 2; break out; }
        }
      }
      if (holdAtk) attack();
      // 楼梯
      if (!stairs.locked && Math.hypot(P.x - stairs.x, P.y - stairs.y) < 24 && !fading) { fading = true; regenQueued = true; }
      // 怪物 AI
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        e.t += dt; e.flash = Math.max(0, e.flash - dt); e.hitCd = Math.max(0, e.hitCd - dt);
        const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (e.boss) {
          e.chargeT = (e.chargeT ?? 2200) - dt;
          if ((e.chargeDir ?? 0) !== 0) {
            const cdx = Math.cos(e.chargeDir!) * 5.4 * k, cdy = Math.sin(e.chargeDir!) * 5.4 * k;
            moveEnt(e, cdx, cdy, e.r);
            if (Math.random() < 0.4) amb.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 400, max: 400, c: "#e8e0cf", s: 3 });
            e.chargeT! -= dt * 2.4;
            if (e.chargeT! <= -600) e.chargeDir = 0;
          } else if (e.chargeT! <= 0) {
            e.chargeDir = Math.atan2(dy, dx); e.chargeT = 2600;
            g.juice.shake(6); g.sfx.tone(90, 0.25, "sawtooth", 0.12, -20);
            g.juice.float(e.x, e.y - 44, "冲锋!", BERRY, 15);
          } else moveEnt(e, (dx / d) * e.spd * k, (dy / d) * e.spd * k, e.r);
          if (e.hp < e.maxHp * 0.55) {
            e.summonT = (e.summonT ?? 5000) - dt;
            if (e.summonT! <= 0 && enemies.filter((x) => !x.boss && x.hp > 0).length < 6) {
              e.summonT = 6000;
              addEnemy("skel", e.x - 40, e.y); addEnemy("skel", e.x + 40, e.y);
              g.juice.float(e.x, e.y - 50, "召唤骷髅!", "#b78ed9", 14); g.sfx.tone(160, 0.2, "sawtooth", 0.1);
            }
          }
          if (e.hp < e.maxHp * 0.25) {
            e.ringT = (e.ringT ?? 3000) - dt;
            if (e.ringT! <= 0) {
              e.ringT = 3200;
              for (let i = 0; i < 10; i++) { const a = (Math.PI * 2 * i) / 10 + e.t / 900; arrows.push({ x: e.x, y: e.y, vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.6, from: "bone" }); }
              g.sfx.tone(220, 0.15, "sawtooth", 0.1, -60);
            }
          }
        } else if (e.kind === "slime") {
          if (Math.floor(e.t / 700) !== Math.floor((e.t - dt) / 700)) { moveEnt(e, (dx / d) * e.spd * 14, (dy / d) * e.spd * 14, e.r); }
        } else if (e.kind === "bat") {
          const a = Math.atan2(dy, dx) + Math.sin(e.t / 240) * 1.1;
          moveEnt(e, Math.cos(a) * e.spd * k, Math.sin(a) * e.spd * k, e.r);
        } else if (e.kind === "archer") {
          if (d > 150) moveEnt(e, (dx / d) * e.spd * k, (dy / d) * e.spd * k, e.r);
          else if (d < 100) moveEnt(e, -(dx / d) * e.spd * k, -(dy / d) * e.spd * k, e.r);
          if (Math.floor(e.t / 1800) !== Math.floor((e.t - dt) / 1800) && d < 260) {
            arrows.push({ x: e.x, y: e.y - 6, vx: (dx / d) * 3.6, vy: (dy / d) * 3.6, from: "arrow" });
            g.sfx.tone(700, 0.06, "triangle", 0.05, -300);
          }
        } else if (e.kind === "wraith") {
          e.x += (dx / d) * e.spd * 0.85 * k; e.y += (dy / d) * e.spd * 0.85 * k; // 穿墙
        } else moveEnt(e, (dx / d) * e.spd * k, (dy / d) * e.spd * k, e.r);
        if (e.hitCd <= 0 && Math.hypot(e.x - P.x, e.y - P.y) < e.r + 12) { e.hitCd = 600; hurtPlayer(e.boss ? 22 : 8 + floor, e.x, e.y); }
      }
      enemies = enemies.filter((e) => e.hp > 0);
      // 箭矢
      arrows.forEach((a) => { a.x += a.vx * k; a.y += a.vy * k; });
      arrows = arrows.filter((a) => {
        if (tileAt(a.x, a.y) === 1) { blood(a.x, a.y, "#c9c2b0", 3); return false; }
        if (a.from === "player") {
          // 玩家箭：命中敌人
          for (const e of enemies) {
            if (e.hp > 0 && Math.hypot(a.x - e.x, a.y - e.y) < e.r + 6) {
              e.hp -= P.atk * 0.8; e.flash = 110; blood(a.x, a.y, "#f0a52e", 5);
              g.juice.float(e.x, e.y - e.r, String(Math.round(P.atk * 0.8)), "#f0a52e", 12);
              g.sfx.tone(900, 0.04, "triangle", 0.05, -400);
              return false;
            }
          }
        } else if (Math.hypot(a.x - P.x, a.y - P.y) < 14) { hurtPlayer(a.from === "bone" ? 14 : 10, a.x, a.y); return false; }
        return a.x > 0 && a.x < MW * T && a.y > OY && a.y < OY + MH * T;
      });
      // 弓：自动锁定最近敌人射箭
      P.berserkT = Math.max(0, P.berserkT - dt);
      bowT -= dt;
      if (P.bow > 0 && bowT <= 0) {
        let tgt: Enemy | null = null, nd = 1e9;
        for (const e of enemies) { if (e.hp > 0) { const d2 = Math.hypot(e.x - P.x, e.y - P.y); if (d2 < nd && d2 < 300) { nd = d2; tgt = e; } } }
        if (tgt) {
          bowT = Math.max(380, 900 - P.bow * 120);
          const d2 = nd || 1; const n = P.bow >= 3 ? 3 : P.bow >= 2 ? 2 : 1;
          for (let i = 0; i < n; i++) {
            const off = (i - (n - 1) / 2) * 0.22;
            const ang = Math.atan2(tgt.y - P.y, tgt.x - P.x) + off;
            arrows.push({ x: P.x, y: P.y - 8, vx: Math.cos(ang) * 5.5, vy: Math.sin(ang) * 5.5, from: "player" });
          }
          g.sfx.tone(1100, 0.05, "square", 0.04, -500);
        }
      }
      // 物品
      items.forEach((it) => { it.t += dt; });
      items = items.filter((it) => {
        const d = Math.hypot(it.x - P.x, it.y - P.y);
        if (it.kind === "coin" && d < 80) { it.x += ((P.x - it.x) / d) * 5 * k; it.y += ((P.y - it.y) / d) * 5 * k; }
        if (d < 22) {
          if (it.kind === "heart") { P.hp = Math.min(P.maxHp, P.hp + 30); g.juice.float(it.x, it.y - 16, "+30 HP", "#7cb356", 15); g.sfx.score(); }
          else if (it.kind === "potion") { P.hp = P.maxHp; g.juice.float(it.x, it.y - 16, "完全回复!", "#8fd8e8", 16); g.sfx.win(); }
          else if (it.kind === "sword") { P.atk += 3; g.juice.float(it.x, it.y - 16, "攻击 +3", GOLD, 16); g.sfx.win(); }
          else if (it.kind === "boots") { P.spd += 0.4; g.juice.float(it.x, it.y - 16, "速度 +", "#b78ed9", 15); g.sfx.win(); }
          else if (it.kind === "bow") { P.bow++; g.juice.float(it.x, it.y - 16, P.bow === 1 ? "🏹 获得弓箭!" : `弓 Lv.${P.bow}!`, "#f0a52e", 16); g.sfx.win(); banner = { t: P.bow === 1 ? "获得弓箭" : "弓箭强化", sub: "自动射向最近的敌人", life: 1600 }; }
          else if (it.kind === "bomb") {
            g.juice.shake(8); g.sfx.boom(); blood(it.x, it.y, "#f0a52e", 16);
            for (const e of enemies) if (Math.hypot(e.x - P.x, e.y - P.y) < 130) { e.hp -= P.atk * 2.5; e.flash = 140; }
            g.juice.float(it.x, it.y - 16, "💥 轰!", "#f0a52e", 20);
          }
          else if (it.kind === "scroll") { P.shield += 25; g.juice.float(it.x, it.y - 16, "🛡 护盾 +25", "#8fd8e8", 16); g.sfx.win(); }
          else if (it.kind === "elixir") { P.berserkT = 10000; g.juice.float(it.x, it.y - 16, "🔥 狂暴 10 秒!", BERRY, 17); g.sfx.win(); banner = { t: "狂暴之力", sub: "伤害 ×2，持续 10 秒", life: 1600 }; }
          else { P.coins++; score += 25; g.juice.float(it.x, it.y - 16, "+25", GOLD, 13); g.sfx.coin(); }
          blood(it.x, it.y, GOLD, 5);
          return false;
        }
        return true;
      });
      // 环境粒子：尘土 + 火把火星
      if (Math.random() < 0.06) amb.push({ x: Math.random() * g.W, y: OY + Math.random() * (MH * T), vx: (Math.random() - 0.5) * 0.3, vy: -0.15, life: 1600, max: 1600, c: "dust", s: 2 });
      torches.forEach((tc) => { if (Math.random() < 0.12) amb.push({ x: tc.x + (Math.random() - 0.5) * 6, y: tc.y - 4, vx: (Math.random() - 0.5) * 0.5, vy: -0.7, life: 700, max: 700, c: "#f0a52e", s: 2 }); });
      amb.forEach((p) => { p.x += p.vx * k; p.y += p.vy * k; p.life -= dt; });
      amb = amb.filter((p) => p.life > 0);
      if (amb.length > 130) amb.splice(0, amb.length - 130);
    },

    draw(ctx) {
      const now = performance.now();
      ctx.imageSmoothingEnabled = false;
      g.juice.pre(ctx);
      // 地面
      ctx.fillStyle = "#141017"; ctx.fillRect(0, 0, g.W, g.H);
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const v = map[y]?.[x];
        if (v === undefined) continue;
        const px = x * T, py = OY + y * T;
        if (v === 1) {
          ctx.fillStyle = (x + y) % 2 ? "#2a2333" : "#262031";
          ctx.fillRect(px, py, T, T);
          ctx.fillStyle = "#1c1725"; ctx.fillRect(px, py + T - 5, T, 5);
          ctx.fillStyle = "#372f42"; ctx.fillRect(px, py, T, 3);
        } else {
          ctx.fillStyle = (x + y) % 2 ? "#211b29" : "#1e1926";
          ctx.fillRect(px, py, T, T);
          ctx.fillStyle = "rgba(255,255,255,.03)"; ctx.fillRect(px, py, T, 2);
        }
      }
      // 装饰
      decors.forEach((d) => {
        const px = d.x * T, py = OY + d.y * T;
        if (d.k === 0) { ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.moveTo(px + 6, py + 10); ctx.lineTo(px + 16, py + 16); ctx.lineTo(px + 13, py + 24); ctx.stroke(); }
        else if (d.k === 1) { ctx.fillStyle = "rgba(90,130,80,.25)"; ctx.fillRect(px + 5, py + 8, 7, 4); ctx.fillRect(px + 16, py + 18, 9, 4); }
        else { ctx.strokeStyle = "rgba(220,220,230,.16)"; ctx.beginPath(); ctx.moveTo(px + 2, py + 2); ctx.lineTo(px + 12, py + 2); ctx.lineTo(px + 2, py + 12); ctx.closePath(); ctx.stroke(); }
      });
      // 楼梯
      {
        const sx = stairs.x, sy = stairs.y;
        ctx.fillStyle = "#0b0810"; ctx.fillRect(sx - 15, sy - 15, 30, 30);
        ctx.fillStyle = "#171221";
        for (let i = 0; i < 4; i++) ctx.fillRect(sx - 15 + i * 2, sy - 11 + i * 7, 30 - i * 4, 5);
        if (stairs.locked) {
          ctx.fillStyle = "#5a5168"; ctx.fillRect(sx - 8, sy - 8, 16, 16);
          ctx.fillStyle = GOLD; ctx.fillRect(sx - 2, sy - 3, 4, 7);
          txt(ctx, "击败骷髅王!", sx, sy - 28, 11, "rgba(255,215,111,.85)");
        } else {
          const gl = 0.5 + Math.sin(now / 300) * 0.25;
          ctx.strokeStyle = `rgba(255,215,111,${gl})`; ctx.lineWidth = 2; ctx.strokeRect(sx - 15, sy - 15, 30, 30); ctx.lineWidth = 1;
        }
      }
      // 火把
      torches.forEach((tc) => {
        ctx.fillStyle = "#4a3a2a"; ctx.fillRect(tc.x - 2, tc.y, 4, 12);
        const fl = Math.sin(now / 90 + tc.ph * 7) * 2;
        ctx.fillStyle = "#f0a52e"; ctx.beginPath(); ctx.arc(tc.x, tc.y - 3 + fl * 0.3, 5, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffd76f"; ctx.beginPath(); ctx.arc(tc.x, tc.y - 4 + fl * 0.3, 2.6, 0, 7); ctx.fill();
      });
      // 物品
      items.forEach((it) => {
        const bob = Math.sin(it.t / 260) * 3;
        const y = it.y + bob;
        ctx.fillStyle = "rgba(255,215,111,.12)"; ctx.beginPath(); ctx.arc(it.x, it.y + 10, 12, 0, 7); ctx.fill();
        if (it.kind === "heart") { ctx.fillStyle = BERRY; ctx.beginPath(); ctx.arc(it.x - 4, y - 3, 5, 0, 7); ctx.arc(it.x + 4, y - 3, 5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(it.x - 8, y - 1); ctx.lineTo(it.x, y + 9); ctx.lineTo(it.x + 8, y - 1); ctx.fill(); }
        else if (it.kind === "coin") { ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(it.x, y, 8, 0, 7); ctx.fill(); ctx.fillStyle = "#8a5f14"; ctx.beginPath(); ctx.arc(it.x, y, 3.5, 0, 7); ctx.fill(); }
        else if (it.kind === "sword") { ctx.fillStyle = "#cfd6de"; ctx.fillRect(it.x - 2, y - 12, 4, 16); ctx.fillStyle = "#8a5f34"; ctx.fillRect(it.x - 6, y + 4, 12, 3); ctx.fillStyle = GOLD; ctx.fillRect(it.x - 2, y + 7, 4, 5); }
        else if (it.kind === "boots") { ctx.fillStyle = "#b78ed9"; ctx.fillRect(it.x - 7, y - 6, 8, 12); ctx.fillRect(it.x - 7, y + 3, 14, 5); }
        else { ctx.fillStyle = "#8fd8e8"; rr(ctx, it.x - 5, y - 8, 10, 16, 4); ctx.fill(); ctx.fillStyle = "#d95d39"; ctx.fillRect(it.x - 3, y - 11, 6, 4); }
      });
      // 怪物
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const hop = e.kind === "slime" ? Math.abs(Math.sin(e.t / 350)) * -4 : Math.sin(e.t / 300) * 1.6;
        const flip = e.x > P.x;
        if (e.kind === "wraith") ctx.globalAlpha = 0.55 + Math.sin(e.t / 400) * 0.2;
        if (e.boss) {
          const sc = 3.2;
          drawSprite(ctx, KING, KING_PAL, e.x - 5 * sc, e.y - 6 * sc + hop, sc, flip);
        } else if (e.kind === "slime") drawSprite(ctx, SLIME, e.mini ? SLIME_MINI_PAL : SLIME_PAL, e.x - 4 * 3, e.y - 3 * 3 + hop * 0.6, 3, flip);
        else if (e.kind === "bat") drawSprite(ctx, BAT, BAT_PAL, e.x - 4 * 3, e.y - 2 * 3 + hop, 3, flip);
        else if (e.kind === "archer") { drawSprite(ctx, SKEL, ARCHER_PAL, e.x - 4 * 3, e.y - 5 * 3 + hop * 0.4, 3, flip); ctx.strokeStyle = "#8a5f34"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x + (flip ? -10 : 10), e.y - 6, 9, -1, 1); ctx.stroke(); ctx.lineWidth = 1; }
        else if (e.kind === "wraith") drawSprite(ctx, WRAITH, WRAITH_PAL, e.x - 4 * 3, e.y - 4 * 3 + hop, 3, flip);
        else drawSprite(ctx, SKEL, SKEL_PAL, e.x - 4 * 3, e.y - 5 * 3 + hop * 0.4, 3, flip);
        ctx.globalAlpha = 1;
        if (e.flash > 0) { ctx.globalAlpha = e.flash / 100 * 0.85; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(e.x, e.y - 4, e.r + 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        if (!e.boss && e.hp < e.maxHp) { ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(e.x - 13, e.y - e.r - 12, 26, 4); ctx.fillStyle = BERRY; ctx.fillRect(e.x - 13, e.y - e.r - 12, 26 * Math.max(0, e.hp / e.maxHp), 4); }
      }
      // 玩家
      if (!dead) {
        if (P.inv > 0 && Math.floor(P.inv / 80) % 2) ctx.globalAlpha = 0.4;
        const run = P.moving ? Math.sin(P.anim * 10) * 1.6 : Math.sin(now / 500) * 0.8;
        const sc = 3;
        drawSprite(ctx, KNIGHT, KNIGHT_PAL, P.x - 4 * sc, P.y - 6 * sc + run * 0.4, sc, P.face < 0);
        ctx.globalAlpha = 1;
        if (P.atkT > 0) {
          const p = 1 - P.atkT / 180;
          ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - p)})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          const a0 = P.face > 0 ? -1.3 + p * 1.6 : Math.PI - 0.3 - p * 1.6;
          ctx.arc(P.x, P.y - 6, 34 + p * 16, a0, a0 + (P.face > 0 ? 1.6 : -1.6), P.face < 0);
          ctx.stroke(); ctx.lineWidth = 1;
        }
      }
      // 箭矢
      arrows.forEach((a) => {
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(a.vy, a.vx));
        if (a.from === "bone") { ctx.fillStyle = "#e8e0cf"; ctx.fillRect(-6, -2, 12, 4); ctx.fillRect(-2, -5, 4, 10); }
        else { ctx.fillStyle = "#c9a86a"; ctx.fillRect(-7, -1, 14, 2); ctx.fillStyle = "#cfd6de"; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(2, -3); ctx.lineTo(2, 3); ctx.fill(); }
        ctx.restore();
      });
      // 环境粒子
      amb.forEach((p) => {
        if (p.c === "ghost") { ctx.globalAlpha = (p.life / p.max) * 0.3; ctx.fillStyle = "#aeb9c4"; ctx.fillRect(p.x - 8, p.y - 12, 16, 22); }
        else if (p.c === "dust") { ctx.globalAlpha = (p.life / p.max) * 0.14; ctx.fillStyle = "#cfd6de"; ctx.fillRect(p.x, p.y, p.s, p.s); }
        else { ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); }
      });
      ctx.globalAlpha = 1;
      g.juice.draw(ctx);
      /* ---- 光影 ---- */
      dctx.globalCompositeOperation = "source-over";
      dctx.clearRect(0, 0, g.W, g.H);
      dctx.fillStyle = boss() ? "rgba(10,4,8,0.9)" : "rgba(5,4,10,0.9)";
      dctx.fillRect(0, 0, g.W, g.H);
      dctx.globalCompositeOperation = "destination-out";
      const hole = (x: number, y: number, r: number) => {
        const gr = dctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.55, "rgba(0,0,0,.85)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        dctx.fillStyle = gr; dctx.beginPath(); dctx.arc(x, y, r, 0, 7); dctx.fill();
      };
      if (!dead) hole(P.x, P.y, 150 + Math.sin(now / 200) * 6);
      torches.forEach((tc) => hole(tc.x, tc.y, 74 + Math.sin(now / 120 + tc.ph * 5) * 9));
      if (!stairs.locked) hole(stairs.x, stairs.y, 60 + Math.sin(now / 300) * 8);
      const b0 = boss(); if (b0) hole(b0.x, b0.y, 90);
      ctx.drawImage(darkCv, 0, 0);
      /* ---- HUD ---- */
      ctx.fillStyle = "rgba(14,10,18,.88)"; ctx.fillRect(0, 0, g.W, 56);
      ctx.fillStyle = "rgba(255,215,111,.25)"; ctx.fillRect(0, 55, g.W, 1.5);
      // 血条
      txt(ctx, "♥", 26, 28, 18, BERRY);
      rr(ctx, 42, 19, 130, 18, 9); ctx.fillStyle = "#241a2c"; ctx.fill();
      const hpW = 126 * Math.max(0, hpShown / P.maxHp);
      if (hpW > 0) { rr(ctx, 44, 21, hpW, 14, 7); ctx.fillStyle = hpShown / P.maxHp < 0.3 ? BERRY : "#7cb356"; ctx.fill(); }
      ctx.strokeStyle = "rgba(255,255,255,.2)"; rr(ctx, 42, 19, 130, 18, 9); ctx.stroke();
      txt(ctx, `${Math.ceil(P.hp)}`, 107, 28, 11, "#fff");
      txt(ctx, `F${floor}`, g.W / 2 + 20, 28, 20, GOLD);
      txt(ctx, `⚔${P.atk}`, g.W - 118, 28, 13, "#cfd6de");
      txt(ctx, `🪙${P.coins}`, g.W - 58, 28, 13, GOLD);
      // Boss 血条
      if (b0) {
        rr(ctx, 60, 62, g.W - 120, 10, 5); ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fill();
        rr(ctx, 62, 64, (g.W - 124) * Math.max(0, b0.hp / b0.maxHp), 6, 3); ctx.fillStyle = "#a32020"; ctx.fill();
        txt(ctx, "☠ 骷髅王", g.W / 2, 82, 11, "#e8a0a0");
      }
      /* ---- 触控 ---- */
      if (!joy.on && !dead) { ctx.strokeStyle = "rgba(232,228,216,.13)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(92, g.H - 104, 44, 0, 7); ctx.stroke(); ctx.lineWidth = 1; txt(ctx, "滑动移动", 92, g.H - 104, 11, "rgba(232,228,216,.35)"); }
      if (joy.on) {
        ctx.strokeStyle = "rgba(255,215,111,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.sx, joy.sy, 40, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
        const jl = Math.hypot(joy.dx, joy.dy) || 1, jr = Math.min(34, jl);
        ctx.fillStyle = "rgba(255,215,111,.75)"; ctx.beginPath(); ctx.arc(joy.sx + (joy.dx / jl) * jr, joy.sy + (joy.dy / jl) * jr, 17, 0, 7); ctx.fill();
      }
      const abx = g.W - 74, aby = g.H - 92;
      ctx.fillStyle = P.atkT > 0 ? "rgba(217,93,57,.85)" : "rgba(217,93,57,.5)";
      ctx.beginPath(); ctx.arc(abx, aby, 34, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,215,111,.6)"; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
      txt(ctx, "⚔", abx, aby + 1, 26, "#fff");
      const dbx = g.W - 148, dby = g.H - 74;
      ctx.fillStyle = P.dashCd > 0 ? "rgba(90,100,120,.4)" : "rgba(143,216,232,.5)";
      ctx.beginPath(); ctx.arc(dbx, dby, 25, 0, 7); ctx.fill();
      if (P.dashCd > 0) { ctx.strokeStyle = "#8fd8e8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(dbx, dby, 25, -Math.PI / 2, -Math.PI / 2 + (1 - P.dashCd / 2200) * Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
      txt(ctx, "💨", dbx, dby + 1, 18, "#fff");
      /* ---- 横幅 / 低血量 / 过渡 ---- */
      if (banner.life > 0) {
        const q = banner.life > 2200 ? (2600 - banner.life) / 400 : banner.life < 400 ? banner.life / 400 : 1;
        ctx.globalAlpha = clamp(q, 0, 1);
        ctx.fillStyle = "rgba(10,6,12,.72)"; ctx.fillRect(0, g.H * 0.32, g.W, 84);
        ctx.fillStyle = "rgba(255,215,111,.7)"; ctx.fillRect(40, g.H * 0.32, g.W - 80, 2); ctx.fillRect(40, g.H * 0.32 + 82, g.W - 80, 2);
        txt(ctx, banner.t, g.W / 2, g.H * 0.32 + 34, 26 * (0.8 + q * 0.2), GOLD);
        if (banner.sub) txt(ctx, banner.sub, g.W / 2, g.H * 0.32 + 62, 13, "#c9c2d8");
        ctx.globalAlpha = 1;
      }
      if (P.hp / P.maxHp < 0.3 && !dead) {
        const a = 0.22 + Math.sin(now / 240) * 0.1;
        const vg = ctx.createRadialGradient(g.W / 2, g.H / 2, g.H * 0.3, g.W / 2, g.H / 2, g.H * 0.62);
        vg.addColorStop(0, "rgba(160,20,20,0)"); vg.addColorStop(1, `rgba(160,20,20,${a})`);
        ctx.fillStyle = vg; ctx.fillRect(0, 0, g.W, g.H);
      }
      if (fading || fade > 0) { ctx.fillStyle = `rgba(6,4,10,${clamp(fade, 0, 1)})`; ctx.fillRect(0, 0, g.W, g.H); }
      g.juice.post(ctx);
      ctx.imageSmoothingEnabled = true;
    },

    onPointer(tp, x, y, id) {
      if (dead) return;
      const nearAtk = Math.hypot(x - (g.W - 74), y - (g.H - 92)) < 44;
      const nearDash = Math.hypot(x - (g.W - 148), y - (g.H - 74)) < 34;
      if (tp === "down") {
        if (nearAtk) { atkId = id ?? -7; holdAtk = true; attack(); }
        else if (nearDash) { dashId = id ?? -9; dash(); }
        else if (x < g.W * 0.62) { joyId = id ?? -8; joy = { on: true, sx: x, sy: y, dx: 0, dy: 0 }; }
      }
      if (tp === "move" && joy.on && (id === undefined || id === joyId)) { joy.dx = x - joy.sx; joy.dy = y - joy.sy; }
      if (tp === "up") {
        if (id === undefined || id === joyId) { joy.on = false; joy.dx = 0; joy.dy = 0; joyId = -1; }
        if (id === undefined || id === atkId) { holdAtk = false; atkId = -1; }
        if (id === undefined || id === dashId) dashId = -1;
      }
    },
    onKey(code, down) {
      if (code === "ArrowLeft" || code === "KeyA") keys.l = down;
      if (code === "ArrowRight" || code === "KeyD") keys.r = down;
      if (code === "ArrowUp" || code === "KeyW") keys.u = down;
      if (code === "ArrowDown" || code === "KeyS") keys.d = down;
      if ((code === "Space" || code === "KeyJ" || code === "KeyX") && down) attack();
      if ((code === "KeyK" || code === "ShiftLeft" || code === "ShiftRight") && down) dash();
    },
  };
}
