/* 游戏引擎：逻辑坐标缩放 / 竖屏旋转重排 / 自动暂停 / 音效 + BGM / 手感层 / 每日挑战种子 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { useGarden } from "../lib/store";
import type { LbEntry, AchDef } from "../lib/db";

export type Difficulty = "easy" | "normal" | "hard";
export const DIFF_MULT: Record<Difficulty, number> = { easy: 0.8, normal: 1, hard: 1.35 };

/* ---------------- 类型 ---------------- */
export interface GameCtx {
  W: number; H: number; difficulty: Difficulty; mult: number; seed?: number;
  saved?: any; /* 上次存档的状态（有则从存档恢复开局） */
  over: (score: number) => void;
  sfx: Sfx; juice: Juice;
  rnd: (n: number) => number;
  pick: <T>(arr: T[]) => T;
}
export interface GameHandle {
  tick?: (dt: number) => void;
  draw: (ctx: CanvasRenderingContext2D) => void;
  onPointer?: (type: "down" | "move" | "up", x: number, y: number, id?: number) => void;
  onKey?: (code: string, down: boolean) => void;
  destroy?: () => void;
  snapshot?: () => any; /* 返回可序列化状态，用于中途存档 */
  currentScore?: () => number; /* 当前局实时分数，用于「直接结算」 */
}
export interface GameDef {
  id: string; name: string; emoji: string; desc: string; category: string; tags: string[];
  W: number; H: number; landscape?: boolean; scene: string[]; commute?: boolean; hot?: boolean;
  savable?: boolean; /* 支持中途存档/续玩 */
  keys?: { label: string; key: string }[];
  help: { kb: string; touch: string };
  tips?: string[];
  create: (g: GameCtx) => GameHandle | Promise<GameHandle>;
  menuExtra?: React.ComponentType;
}

export const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/* 竖屏旋转模式下键盘方向重映射（以玩家屏幕视角为准） */
const ROT_REMAP: Record<string, string> = {
  ArrowUp: "ArrowLeft", ArrowDown: "ArrowRight", ArrowLeft: "ArrowDown", ArrowRight: "ArrowUp",
  KeyW: "KeyA", KeyS: "KeyD", KeyA: "KeyS", KeyD: "KeyW",
};

/* ---------------- 音效合成器 ---------------- */
export class Sfx {
  muted = localStorage.getItem("garden_muted") === "1";
  private ctx: AudioContext | null = null;
  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  setMuted(m: boolean) { this.muted = m; localStorage.setItem("garden_muted", m ? "1" : "0"); }
  private buzz(ms: number) { try { navigator.vibrate?.(ms); } catch { /* iOS 无此 API */ } }
  tone(freq: number, dur = 0.1, type: OscillatorType = "square", vol = 0.1, slide = 0) {
    if (this.muted) return;
    const ctx = this.ensure(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }
  click() { this.tone(520, 0.05, "square", 0.08); }
  score() { this.tone(880, 0.08, "square", 0.1); setTimeout(() => this.tone(1174, 0.1, "square", 0.1), 60); this.buzz(12); }
  coin() { this.tone(1318, 0.06, "square", 0.09); setTimeout(() => this.tone(1760, 0.12, "square", 0.09), 50); this.buzz(10); }
  hit() { this.tone(160, 0.12, "sawtooth", 0.14, -60); this.buzz(40); }
  boom() { this.tone(90, 0.3, "sawtooth", 0.2, -50); this.tone(60, 0.4, "triangle", 0.2, -20); this.buzz(80); }
  jump() { this.tone(300, 0.12, "square", 0.09, 340); }
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, "square", 0.11), i * 110)); this.buzz(60); }
  over() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, "triangle", 0.12), i * 140)); }
  place() { this.tone(240, 0.07, "triangle", 0.12, 60); }
}
export const sfx = new Sfx();

/* ---------------- 背景音乐（程序化芯片乐） ---------------- */
type MusicKind = "upbeat" | "tense" | "calm";
const MUSIC_OF: Record<string, MusicKind> = {
  经典街机: "upbeat", 休闲益智: "calm", 动作跑酷: "tense", 空战射击: "tense",
  塔防布阵: "upbeat", 对弈棋类: "calm", 通勤轻游: "calm", 悬疑解谜: "tense",
  割草生存: "tense", 像素冒险: "tense",
};
class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private nextT = 0; private step = 0; private kind: MusicKind = "upbeat";
  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = sfx.muted ? 0 : 0.055;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  setMuted(m: boolean) { if (this.master) this.master.gain.value = m ? 0 : 0.055; }
  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private scheduleStep(s: number, t: number) {
    if (this.kind === "upbeat") {
      const mel = [523, 0, 440, 523, 587, 0, 523, 440, 392, 0, 440, 523, 587, 0, 659, 587];
      const m = mel[s % 16];
      if (m) this.note(m, t, 0.17, "square", 0.45);
      if (s % 4 === 0) this.note(s % 8 === 0 ? 131 : 98, t, 0.3, "triangle", 0.9);
      if (s % 2 === 1) this.note(2600, t, 0.02, "square", 0.05);
    } else if (this.kind === "tense") {
      const mel = [0, 0, 220, 0, 262, 0, 220, 196, 0, 0, 233, 0, 311, 0, 262, 220];
      const m = mel[s % 16];
      if (m) this.note(m, t, 0.22, "sawtooth", 0.28);
      if (s % 2 === 0) this.note(s % 8 < 4 ? 55 : 65.4, t, 0.2, "triangle", 0.95);
      if (s % 4 === 2) this.note(1800, t, 0.02, "square", 0.04);
    } else {
      const mel = [220, 262, 330, 262, 440, 330, 262, 220];
      this.note(mel[s % 8], t, 0.85, "sine", 0.5);
      if (s % 8 === 0) this.note(110, t, 1.7, "sine", 0.65);
      if (s % 8 === 4) this.note(165, t, 1.2, "sine", 0.35);
    }
  }
  play(kind: MusicKind) {
    const ctx = this.ensure(); if (!ctx) return;
    this.stop();
    this.kind = kind; this.step = 0; this.nextT = ctx.currentTime + 0.08;
    const spb = kind === "upbeat" ? 0.21 : kind === "tense" ? 0.27 : 0.48;
    this.timer = window.setInterval(() => {
      if (!this.ctx) return;
      while (this.nextT < this.ctx.currentTime + 0.16) {
        this.scheduleStep(this.step, this.nextT);
        this.step++; this.nextT += spb;
      }
    }, 40);
  }
  stop() { if (this.timer !== null) { clearInterval(this.timer); this.timer = null; } }
}
export const music = new Music();

/* ---------------- 手感层（震屏 / 粒子 / 飘字） ---------------- */
export class Juice {
  shakeV = 0;
  parts: { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string }[] = [];
  floats: { x: number; y: number; s: string; c: string; t: number; size: number }[] = [];
  shake(n: number) { this.shakeV = Math.min(16, this.shakeV + n); }
  burst(x: number, y: number, c: string, n = 8) {
    if (this.parts.length > 170) return;
    for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 6.5, vy: (Math.random() - 0.5) * 6.5 - 1, life: 420, max: 420, c });
  }
  float(x: number, y: number, s: string, c = "#fff", size = 15) {
    if (this.floats.length < 30) this.floats.push({ x: x + (Math.random() - 0.5) * 12, y, s, c, t: 720, size });
  }
  update(dt: number) {
    this.shakeV *= 0.87;
    const k = dt / 16.7;
    this.parts.forEach((p) => { p.x += p.vx * k; p.y += p.vy * k; p.vy += 0.14 * k; p.life -= dt; });
    this.parts = this.parts.filter((p) => p.life > 0);
    this.floats.forEach((f) => { f.y -= 0.035 * dt; f.t -= dt; });
    this.floats = this.floats.filter((f) => f.t > 0);
  }
  pre(ctx: CanvasRenderingContext2D) {
    ctx.save();
    if (this.shakeV > 0.4) ctx.translate((Math.random() - 0.5) * this.shakeV, (Math.random() - 0.5) * this.shakeV);
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.parts.forEach((p) => { ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.c; ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5); });
    ctx.globalAlpha = 1;
    this.floats.forEach((f) => {
      ctx.globalAlpha = Math.min(1, f.t / 320);
      ctx.fillStyle = f.c; ctx.font = `700 ${f.size}px "Noto Sans SC", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(f.s, f.x, f.y);
    });
    ctx.globalAlpha = 1;
  }
  post(ctx: CanvasRenderingContext2D) { ctx.restore(); }
}

/* ---------------- 游戏外壳 ---------------- */
type Phase = "menu" | "play" | "over";
const FONT = '"Noto Sans SC", sans-serif';

export function GameShell({ def, onExit, daily = false }: { def: GameDef; onExit: () => void; daily?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotatedRef = useRef(false);
  const gameRef = useRef<GameHandle | null>(null);
  const rafRef = useRef(0);
  const pausedRef = useRef(false);
  const phaseRef = useRef<Phase>("menu");
  const diffRef = useRef<Difficulty>("normal");
  const manualPauseRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("menu");
  const [diff, setDiff] = useState<Difficulty>("normal");
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [muted, setMuted] = useState(sfx.muted);
  const [rotated, setRotated] = useState(false);
  const [phoneLand, setPhoneLand] = useState(false);
  const [best, setBest] = useState(0);
  const [result, setResult] = useState<{ score: number; best: number; isNewBest: boolean; top: LbEntry[]; unlocked: AchDef[]; coins: number } | null>(null);
  const [shareImg, setShareImg] = useState("");
  const pushAch = useGarden((s) => s.pushAch);
  const toast = useGarden((s) => s.toast);

  phaseRef.current = phase;
  diffRef.current = diff;

  /* ---------------- 存档系统（本地 localStorage，玩到一半可存、下次续玩） ---------------- */
  const saveKey = `garden_save_${def.id}`;
  const [hasSave, setHasSave] = useState(() => { try { return !!localStorage.getItem(saveKey); } catch { return false; } });
  const doSave = useCallback((quiet = false) => {
    try {
      if (phaseRef.current !== "play") return;
      const snap = gameRef.current?.snapshot?.();
      if (!snap) { if (!quiet) toast("这款游戏不支持中途存档", "info"); return; }
      localStorage.setItem(saveKey, JSON.stringify({ difficulty: diffRef.current, state: snap, at: Date.now() }));
      setHasSave(true);
      if (!quiet) { sfx.coin(); toast("💾 进度已保存，下次可从菜单「继续上次」"); }
    } catch { if (!quiet) toast("保存失败", "err"); }
  }, [saveKey, toast]);
  const clearSave = useCallback(() => { try { localStorage.removeItem(saveKey); } catch { /* ignore */ } setHasSave(false); }, [saveKey]);

  /* 退出前自动存档（仅 savable 游戏，玩到一半退出不再丢进度） */
  const quitGame = useCallback(() => {
    if (def.savable && phaseRef.current === "play") doSave(true);
    music.stop();
    onExit();
  }, [def.savable, doSave, onExit]);

  /* 尺寸：宽与高双向取最小缩放，永不溢出；横版游戏竖屏手机旋转 90° */
  const resize = useCallback(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current, sizer = sizerRef.current;
    if (!wrap || !canvas || !sizer) return;
    const availW = Math.max(160, wrap.clientWidth - 8);
    const availH = Math.max(160, wrap.clientHeight - 8);
    const ratio = def.W / def.H;
    const rotate = !!def.landscape && availH > availW && window.innerWidth < 820;
    rotatedRef.current = rotate;
    setPhoneLand(!def.landscape && availW > availH && window.innerWidth < 820);
    let cssW: number, cssH: number;
    if (rotate) {
      cssH = Math.min(availW, availH / ratio);
      cssW = cssH * ratio;
      sizer.style.width = cssH + "px";
      sizer.style.height = cssW + "px";
      sizer.style.margin = "auto";
      canvas.style.position = "absolute";
      canvas.style.left = "0"; canvas.style.top = "0";
      canvas.style.transformOrigin = "0 0";
      canvas.style.transform = `translate(${cssH}px, 0) rotate(90deg)`;
    } else {
      cssW = Math.min(availW, availH * ratio);
      cssH = cssW / ratio;
      sizer.style.width = cssW + "px";
      sizer.style.height = cssH + "px";
      sizer.style.margin = "auto";
      canvas.style.position = "static";
      canvas.style.transform = "none";
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    setRotated(rotate);
  }, [def]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    window.visualViewport?.addEventListener("resize", resize);
    api.myBests().then((bs) => setBest(Math.max(0, ...bs.filter((b) => b.game === def.id).map((b) => b.score))));
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
      gameRef.current?.destroy?.();
      music.stop();
    };
  }, [def, resize]);

  /* 主循环：dt 上限 50ms，逻辑→显示缩放 */
  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let last = performance.now();
    const frame = (ts: number) => {
      rafRef.current = requestAnimationFrame(frame);
      const dt = clamp(ts - last, 0, 50);
      last = ts;
      ctx.setTransform(canvas.width / def.W, 0, 0, canvas.height / def.H, 0, 0);
      const g = gameRef.current;
      if (!g) return;
      if (!pausedRef.current && phaseRef.current === "play") g.tick?.(dt);
      g.draw(ctx);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [def]);

  const finish = useCallback(async (score: number) => {
    if (phaseRef.current === "over") return;
    setPhase("over");
    music.stop();
    clearSave(); // 本局结束，清除中途存档
    try {
      const r = await api.submitScore(def.id, Math.max(0, Math.round(score)), diffRef.current);
      setResult({ score: Math.round(score), ...r });
      setBest(r.best);
      if (r.unlocked.length) pushAch(r.unlocked);
      if (r.coins > 0) toast(`🪙 花园金币 +${r.coins}`, "info");
      if (r.isNewBest) sfx.win(); else sfx.over();
    } catch {
      toast("分数保存失败", "err");
      setResult({ score: Math.round(score), best: Math.round(score), isNewBest: true, top: [], unlocked: [], coins: 0 });
      sfx.over();
    }
  }, [def, pushAch, toast, clearSave]);

  const start = useCallback((d: Difficulty, useSave = false) => {
    cancelAnimationFrame(rafRef.current);
    gameRef.current?.destroy?.();
    setShareImg("");
    sfx.click();
    // 读取存档（若选择「继续上次」）
    let saved: any = null;
    if (useSave && !daily) {
      try {
        const raw = localStorage.getItem(saveKey);
        if (raw) { const p = JSON.parse(raw); saved = p.state; if (p.difficulty) d = p.difficulty; setDiff(d); }
      } catch { saved = null; }
    } else if (!useSave) {
      clearSave(); // 开新局清掉旧存档，避免残留
    }
    const seed = daily ? Number(new Date().toISOString().slice(0, 10).replace(/-/g, "")) : undefined;
    const srnd = seed !== undefined ? mulberry32(seed) : null;
    const g: GameCtx = {
      W: def.W, H: def.H, difficulty: d, mult: DIFF_MULT[d], seed, saved,
      over: (score) => finish(score),
      sfx, juice: new Juice(),
      rnd: (n) => Math.floor((srnd ? srnd() : Math.random()) * n),
      pick: (arr) => arr[Math.floor((srnd ? srnd() : Math.random()) * arr.length)],
    };
    gameRef.current = null;
    pausedRef.current = false; manualPauseRef.current = false;
    setPaused(false); setResult(null); setPhase("play");
    loop();
    music.play(MUSIC_OF[def.category] ?? "upbeat");
    // 游戏代码按需加载（首屏不含任何游戏实现）；加载失败给明确提示，绝不静默无响应
    Promise.resolve(def.create(g))
      .then((h) => { if (phaseRef.current === "play") gameRef.current = h; })
      .catch(() => {
        toast("游戏模块加载失败，请检查网络后重试", "err");
        phaseRef.current = "menu";
        setPhase("menu");
        music.stop();
      });
    // 首次游玩：分步操作提示
    const hk = "hint_" + def.id;
    if (!localStorage.getItem(hk)) {
      localStorage.setItem(hk, "1");
      const tips = def.tips ?? [def.help.touch];
      tips.forEach((t, i) => setTimeout(() => { if (phaseRef.current === "play") toast("💡 " + t, "info"); }, 600 + i * 2800));
    }
  }, [def, daily, loop, finish, toast, saveKey, clearSave]);

  /* 键盘（旋转模式自动重映射） */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (phaseRef.current !== "play") return;
      const code = rotatedRef.current ? ROT_REMAP[e.code] ?? e.code : e.code;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) e.preventDefault();
      gameRef.current?.onKey?.(code, true);
    };
    const up = (e: KeyboardEvent) => {
      if (phaseRef.current !== "play") return;
      const code = rotatedRef.current ? ROT_REMAP[e.code] ?? e.code : e.code;
      gameRef.current?.onKey?.(code, false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  /* 切后台自动暂停，回来保持暂停等玩家（防时间跳跃） */
  useEffect(() => {
    const vis = () => {
      if (document.hidden && phaseRef.current === "play") {
        if (def.savable) doSave(true); // 切后台先存档，防 App 被杀丢进度
        if (!pausedRef.current) {
          pausedRef.current = true; manualPauseRef.current = false;
          setPaused(true); music.stop();
        }
      }
    };
    const unload = () => { if (def.savable) doSave(true); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("beforeunload", unload);
    return () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("beforeunload", unload); };
  }, [def.savable, doSave]);

  const togglePause = () => {
    manualPauseRef.current = !pausedRef.current;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    sfx.click();
    if (pausedRef.current) music.stop();
    else music.play(MUSIC_OF[def.category] ?? "upbeat");
  };

  const toggleFs = () => {
    const el = wrapRef.current?.parentElement; if (!el) return;
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (el.requestFullscreen) el.requestFullscreen().catch(() => toast("iPhone 暂不支持全屏，试试横持手机", "info"));
    else toast("iPhone 暂不支持全屏，试试横持手机", "info");
  };

  const toLogical = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const relX = e.clientX - rect.left, relY = e.clientY - rect.top;
    if (rotatedRef.current) {
      return { x: (relY / rect.height) * def.W, y: ((rect.width - relX) / rect.width) * def.H };
    }
    return { x: (relX / rect.width) * def.W, y: (relY / rect.height) * def.H };
  };
  const onPointer = (type: "down" | "move" | "up") => (e: React.PointerEvent) => {
    if (phaseRef.current !== "play" || pausedRef.current) return;
    const p = toLogical(e);
    gameRef.current?.onPointer?.(type, p.x, p.y, e.pointerId);
  };

  const makeShareCard = () => {
    const c = document.createElement("canvas");
    c.width = 640; c.height = 800;
    const x = c.getContext("2d")!;
    const grad = x.createLinearGradient(0, 0, 0, 800);
    grad.addColorStop(0, "#24513a"); grad.addColorStop(1, "#0f2015");
    x.fillStyle = grad; x.fillRect(0, 0, 640, 800);
    x.fillStyle = "rgba(124,179,86,.12)";
    for (let i = 0; i < 26; i++) { x.beginPath(); x.arc((i * 137) % 640, (i * 251) % 800, 3 + (i % 4) * 2, 0, 7); x.fill(); }
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "#8fae93"; x.font = `700 24px ${FONT}`; x.fillText("🌿 数字花园 · 成绩单", 320, 90);
    x.font = `96px ${FONT}`; x.fillText(def.emoji, 320, 230);
    x.fillStyle = "#e9f2e4"; x.font = `700 44px ${FONT}`; x.fillText(def.name, 320, 330);
    x.fillStyle = "#efa32c"; x.font = `700 110px ${FONT}`;
    x.fillText(String(result?.score ?? 0), 320, 460);
    x.fillStyle = "#cfe3c2"; x.font = `700 26px ${FONT}`;
    x.fillText(`${result?.isNewBest ? "🎉 新纪录！" : "历史最佳 " + (result?.best ?? 0)}`, 320, 556);
    x.fillStyle = "#8fae93"; x.font = `400 22px ${FONT}`;
    x.fillText(`${new Date().toLocaleDateString("zh-CN")} · ${diff === "easy" ? "简单" : diff === "hard" ? "困难" : "普通"}难度${daily ? " · 每日挑战" : ""}`, 320, 610);
    x.fillStyle = "rgba(233,242,228,.5)"; x.font = `400 20px ${FONT}`;
    x.fillText("—— 来数字花园和我比一局 ——", 320, 720);
    setShareImg(c.toDataURL("image/png"));
  };

  const Extra = def.menuExtra;

  return (
    <div className="flex flex-col dvh" style={{ background: "radial-gradient(120% 100% at 50% 0%, #182b1e 0%, #0d1c13 55%, #081009 100%)" }}>
      {/* 顶栏 */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-[#e9f2e4] shrink-0 pt-safe">
        <button className="btn btn-ghost btn-ico !text-[#e9f2e4] !border-[#e9f2e4]/30 !px-2.5 !w-auto" onClick={quitGame}>← 大厅</button>
        <div className="flex-1 text-center font-display text-[17px] tracking-wide truncate">
          {def.emoji} {def.name}
          {daily && <span className="ml-2 align-middle text-[10px] font-bold bg-[#efa32c] text-[#4a3208] rounded-full px-2 py-0.5">每日挑战</span>}
        </div>
        {phase === "play" && (
          <>
            <button className="btn btn-ghost btn-ico !text-[#e9f2e4] !border-[#e9f2e4]/30" onClick={togglePause} aria-label="暂停">{paused ? "▶" : "⏸"}</button>
            {def.savable && <button className="btn btn-ghost btn-ico !text-[#e9f2e4] !border-[#e9f2e4]/30" onClick={() => doSave()} aria-label="保存进度">💾</button>}
            <button className="btn btn-ghost btn-ico !text-[#e9f2e4] !border-[#e9f2e4]/30" onClick={() => start(diffRef.current)} aria-label="重开">↻</button>
          </>
        )}
        <button className="btn btn-ghost btn-ico !text-[#e9f2e4] !border-[#e9f2e4]/30" onClick={() => { sfx.setMuted(!muted); music.setMuted(!muted); setMuted(!muted); }} aria-label="静音">{muted ? "🔇" : "🔊"}</button>
        <button className="btn btn-ghost btn-ico !text-[#e9f2e4] !border-[#e9f2e4]/30" onClick={() => setShowHelp(true)} aria-label="说明">?</button>
        <button className="btn btn-ghost btn-ico !text-[#e9f2e4] !border-[#e9f2e4]/30" onClick={toggleFs} aria-label="全屏">⛶</button>
      </div>

      {/* 画布区 */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-1" ref={wrapRef}>
        <div ref={sizerRef} className="relative">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointer("down")}
            onPointerMove={onPointer("move")}
            onPointerUp={onPointer("up")}
            onPointerCancel={onPointer("up")}
            onContextMenu={(e) => e.preventDefault()}
            className="rounded-xl border-2 border-[#e9f2e4]/20 shadow-[0_10px_40px_rgba(0,0,0,.45)] bg-[#0d1c13]"
          />
        </div>
      </div>
      {rotated && <div className="text-center text-[11px] text-[#e9f2e4]/50 pb-1 shrink-0">横屏游戏 · 横持手机画面自动转正</div>}
      {phoneLand && <div className="text-center text-[11px] text-[#e9f2e4]/50 pb-1 shrink-0">↻ 这款游戏竖着拿更顺手</div>}

      {/* 菜单 */}
      {phase === "menu" && (
        <div className="absolute inset-0 z-20 bg-[#0d1c13]/96 backdrop-blur-sm flex items-center justify-center p-5 overflow-y-auto">
          <div className="w-full max-w-md text-center anim-pop">
            <div className="text-6xl mb-2" style={{ animation: "sway 2.4s ease-in-out infinite" }}>{def.emoji}</div>
            <h2 className="font-display text-4xl text-[#f3f5ea]">{def.name}</h2>
            <p className="text-[#8fae93] text-sm mt-2">{def.desc}</p>
            <div className="flex flex-wrap justify-center gap-1.5 mt-3">
              {def.tags.map((t) => <span key={t} className="chip !bg-transparent !text-[#cfe3c2] !border-[#cfe3c2]/25">{t}</span>)}
            </div>
            {best > 0 && <div className="mt-3 text-[#efa32c] font-display text-lg">🏆 我的最高分 {best.toLocaleString()}</div>}
            <div className="mt-4 text-[#cfe3c2] text-sm font-bold">难度</div>
            <div className="seg mt-2 !bg-[#e9f2e4]/10">
              {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
                <button key={d} className={diff === d ? "on !bg-[#3e8e52] !text-white" : "!text-[#cfe3c2]"} onClick={() => { setDiff(d); sfx.click(); }}>
                  {d === "easy" ? "简单" : d === "hard" ? "困难" : "普通"}
                </button>
              ))}
            </div>
            {Extra && <div className="mt-4 text-left"><React.Suspense fallback={null}><Extra /></React.Suspense></div>}
            {hasSave && !daily && (
              <button className="btn btn-primary w-full mt-5 !text-lg !py-4" onClick={() => start(diff, true)}>
                💾 继续上次进度 ▶
              </button>
            )}
            <button className={`btn btn-gold w-full !text-lg !py-4 ${hasSave && !daily ? "mt-2.5" : "mt-5"}`} onClick={() => start(diff)}>
              {daily ? "开始今日挑战" : hasSave ? "开始新游戏" : "开始游戏"} ▶
            </button>
            {hasSave && !daily && (
              <button className="btn btn-ghost !text-[#8fae93] !border-[#8fae93]/30 mt-2 w-full !min-h-[38px]" onClick={() => { clearSave(); toast("已清除存档", "info"); }}>清除存档</button>
            )}
            <button className="btn btn-ghost !text-[#8fae93] !border-[#8fae93]/30 mt-3 w-full" onClick={() => setShowHelp(true)}>操作说明</button>
          </div>
        </div>
      )}

      {/* 暂停 */}
      {phase === "play" && paused && (
        <div className="absolute inset-0 z-20 bg-[#0d1c13]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6">
            <div className="font-display text-3xl text-[#f3f5ea]">⏸ 已暂停</div>
            <p className="text-[#8fae93] text-sm">切后台会自动暂停，回来继续</p>
            <button className="btn btn-gold w-full max-w-xs" onClick={togglePause}>继续 ▶</button>
            {gameRef.current?.currentScore && (
              <button className="btn btn-berry w-full max-w-xs" onClick={() => finish(gameRef.current!.currentScore!())}>🏁 直接结算（{Math.round(gameRef.current.currentScore()).toLocaleString()} 分）</button>
            )}
            {def.savable && <button className="btn btn-ghost !text-[#cfe3c2] !border-[#cfe3c2]/30 w-full max-w-xs" onClick={() => doSave()}>💾 保存进度</button>}
            <button className="btn btn-ghost !text-[#cfe3c2] !border-[#cfe3c2]/30 w-full max-w-xs" onClick={() => start(diff)}>重新开始</button>
            <button className="btn btn-ghost !text-[#cfe3c2] !border-[#cfe3c2]/30 w-full max-w-xs" onClick={quitGame}>返回大厅</button>
          </div>
      )}

      {/* 结算 */}
      {phase === "over" && result && (
        <div className="absolute inset-0 z-20 bg-[#0d1c13]/92 backdrop-blur-sm flex items-center justify-center p-5 overflow-y-auto">
          <div className="w-full max-w-md text-center anim-pop">
            {result.isNewBest ? (
              <div className="font-display text-[#efa32c] text-3xl" style={{ animation: "pulseSoft 1.4s ease-in-out infinite" }}>🎉 新纪录！</div>
            ) : (
              <div className="font-display text-[#cfe3c2] text-2xl">本局结束</div>
            )}
            <div className="font-display text-[#f3f5ea] text-6xl mt-2 tabular">{result.score.toLocaleString()}</div>
            <div className="text-[#8fae93] text-sm mt-1">历史最佳 {result.best.toLocaleString()} · 金币 +{result.coins} 🪙</div>
            {result.unlocked.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {result.unlocked.map((a) => <span key={a.code} className="chip !bg-[#efa32c]/15 !border-[#efa32c]/50 !text-[#efa32c]">{a.icon} {a.name}</span>)}
              </div>
            )}
            {result.top.length > 0 && (
              <div className="mt-4 bg-[#e9f2e4]/6 rounded-xl border border-[#e9f2e4]/12 p-3 text-left">
                <div className="text-[#cfe3c2] text-sm font-bold mb-2">{def.emoji} TOP 5</div>
                {result.top.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-sm">
                    <span className="w-6 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                    <span className="flex-1 text-[#e9f2e4] truncate">{e.nickname}</span>
                    <span className="text-[#efa32c] font-bold tabular">{e.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            {shareImg && (
              <div className="mt-4">
                <img src={shareImg} alt="成绩卡" className="mx-auto rounded-xl border border-[#e9f2e4]/20 w-full max-w-[260px]" />
                <a href={shareImg} download={`数字花园-${def.name}-成绩.png`} className="btn btn-sm !text-[#cfe3c2] !border-[#cfe3c2]/30 mt-2">⬇ 保存图片</a>
              </div>
            )}
            <div className="flex gap-2 mt-5">
              <button className="btn btn-gold flex-1" onClick={() => start(diff)}>再来一局</button>
              {!shareImg && <button className="btn !text-[#cfe3c2] !border-[#cfe3c2]/30 flex-1" onClick={makeShareCard}>📸 成绩卡</button>}
            </div>
            <button className="btn btn-ghost !text-[#8fae93] !border-[#8fae93]/30 w-full mt-2.5" onClick={() => { music.stop(); onExit(); }}>返回游戏厅</button>
          </div>
        </div>
      )}

      {/* 说明弹层 */}
      {showHelp && (
        <div className="absolute inset-0 z-30 bg-[#0d1c13]/90 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowHelp(false)}>
          <div className="card !bg-[#132a1c] !border-[#e9f2e4]/15 w-full max-w-sm p-6 text-[#e9f2e4] anim-pop" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-2xl">{def.emoji} {def.name} · 怎么玩</h3>
            <div className="mt-4 space-y-3 text-sm leading-relaxed">
              <div><span className="chip !bg-transparent !border-[#8fd8e8]/40 !text-[#8fd8e8]">📱 触屏</span><p className="mt-1.5 text-[#cfe3c2]">{def.help.touch}</p></div>
              <div><span className="chip !bg-transparent !border-[#8fd8e8]/40 !text-[#8fd8e8]">⌨️ 键盘</span><p className="mt-1.5 text-[#cfe3c2]">{def.help.kb}</p></div>
            </div>
            {def.keys && (
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {def.keys.map((k) => (
                  <span key={k.label} className="min-w-[44px] min-h-[44px] px-3 inline-flex items-center justify-center rounded-lg border border-[#e9f2e4]/25 bg-[#e9f2e4]/8 font-bold">{k.label}</span>
                ))}
              </div>
            )}
            <button className="btn btn-gold w-full mt-5" onClick={() => setShowHelp(false)}>知道了</button>
          </div>
        </div>
      )}
    </div>
  );
}
