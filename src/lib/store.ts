import { create } from "zustand";
import * as api from "./api";
import type { AchDef, UserRow } from "./db";

export const THEMES = [
  { id: "moss", name: "苔原", dot: "#24513a" },
  { id: "sakura", name: "暮樱", dot: "#8a3b5c" },
  { id: "ocean", name: "沧海", dot: "#1e4d5e" },
  { id: "amber", name: "暖阳", dot: "#8a5a24" },
  { id: "night", name: "玄夜", dot: "#39463a" },
] as const;

const applyTheme = (t: string) => {
  try {
    if (t === "moss") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  } catch { /* 受限环境下忽略 */ }
};
let savedTheme = "moss";
try { savedTheme = localStorage.getItem("garden_theme") || "moss"; } catch { /* 隐私模式下 localStorage 不可用，用默认主题 */ }
applyTheme(savedTheme);

type Toast = { id: number; text: string; kind: "ok" | "info" | "err" };

interface GardenState {
  booted: boolean;
  user: UserRow | null;
  config: Record<string, string>;
  stats: { visits: number; articles: number; games: number; messages: number };
  toasts: Toast[];
  achQueue: AchDef[];
  updateReady: boolean;
  theme: string;
  setTheme: (t: string) => void;
  toast: (text: string, kind?: Toast["kind"]) => void;
  closeToast: (id: number) => void;
  pushAch: (defs: AchDef[]) => void;
  popAch: () => void;
  boot: () => Promise<void>;
  refresh: () => Promise<void>;
  doLogin: (u: string, p: string) => Promise<UserRow>;
  doRegister: (u: string, p: string, n: string) => Promise<UserRow>;
  doLogout: () => Promise<void>;
  setUser: (u: UserRow | null) => void;
}

let tid = 0;
export const useGarden = create<GardenState>((set, get) => ({
  booted: false,
  user: null,
  config: {},
  stats: { visits: 0, articles: 0, games: 29, messages: 0 },
  toasts: [],
  achQueue: [],
  updateReady: false,
  theme: savedTheme,

  setTheme: (t) => { try { localStorage.setItem("garden_theme", t); } catch { /* 存储受限环境忽略 */ } applyTheme(t); set({ theme: t }); },

  toast: (text, kind = "ok") => {
    const id = ++tid;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind }] }));
    setTimeout(() => get().closeToast(id), 3200);
  },
  closeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  pushAch: (defs) => { if (defs.length) set((s) => ({ achQueue: [...s.achQueue, ...defs] })); },
  popAch: () => set((s) => ({ achQueue: s.achQueue.slice(1) })),

  boot: async () => {
    if (get().booted) return;
    const enter = (partial: Partial<GardenState>) => { if (!get().booted) set({ booted: true, ...partial }); };
    // 6 秒超时兜底：init 链路哪怕卡死（不抛错的挂起），也强制进站，启动遮罩永不冻结
    const timer = setTimeout(() => {
      if (!get().booted) { console.warn("[garden] boot timeout, force enter"); enter({}); setTimeout(() => get().toast("数据加载较慢，稍后会自动补齐", "info"), 500); }
    }, 6000);
    try {
      await api.init();
      const [user, config, stats] = await Promise.all([api.me(), api.getConfig(), api.getHomeStats()]);
      enter({ user, config, stats });
    } catch (e) {
      // 数据库不可用（隐私模式/受限环境）也要能进站，绝不卡在启动遮罩
      console.error("[garden] boot failed:", e);
      enter({});
      setTimeout(() => get().toast("本地数据库暂不可用，浏览不受影响，数据可能无法保存", "err"), 600);
    } finally {
      clearTimeout(timer);
    }
    window.addEventListener("garden:sw-update", () => set({ updateReady: true }));
  },
  refresh: async () => {
    const [config, stats] = await Promise.all([api.getConfig(), api.getHomeStats()]);
    set({ config, stats });
  },
  doLogin: async (u, p) => { const user = await api.login(u, p); set({ user }); return user; },
  doRegister: async (u, p, n) => { const user = await api.register(u, p, n); set({ user }); return user; },
  doLogout: async () => { await api.logout(); set({ user: null }); },
  setUser: (u) => set({ user: u }),
}));
