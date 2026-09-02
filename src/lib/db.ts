/* 数据层：IndexedDB 封装，12 张表与需求书数据模型对齐（可整体迁移到 PostgreSQL） */

export type Article = { id: string; title: string; summary: string; content: string; category: string; status: "draft" | "published"; viewCount: number; createdAt: number; updatedAt: number };
export type ScoreBest = { id: string; userId: string; game: string; score: number; difficulty: string; createdAt: number };
export type Todo = { id: string; userId?: string; content: string; completed: boolean; createdAt: number };
export type Message = { id: string; nickname: string; userId?: string; content: string; createdAt: number };
export type MetaRow = { key: string; value: any };
export type UserRow = { id: string; username: string; password: string; salt: string; nickname: string; avatar: string; token: string; role: string; createdAt: number };
export type LbEntry = { id?: number; userId?: string; nickname: string; game: string; score: number; difficulty?: string; createdAt: number };
export type AchDef = { id?: number; code: string; name: string; description: string; icon: string };
export type UserAchRow = { id?: number; userId: string; achievementId: number; code: string; unlockedAt: number };
export type DiaryRow = { id: string; userId?: string; title: string; content: string; date: string; createdAt: number };

const STORES = ["articles", "scores", "todos", "messages", "meta", "users", "leaderboard", "achievements", "userach", "diary"];
const KEYLESS = new Set(["leaderboard", "userach", "achievements"]);

/* 统一数据接口：IndexedDB 实现与内存兜底实现共用，业务层永不拿到 undefined */
export interface IDB {
  get<T>(store: string, key: IDBValidKey): Promise<T | undefined>;
  put<T extends object>(store: string, val: T): Promise<T>;
  del(store: string, key: IDBValidKey): Promise<void>;
  all<T>(store: string): Promise<T[]>;
}

export class DB implements IDB {
  constructor(private db: IDBDatabase) {}
  private tx(store: string, mode: IDBTransactionMode) { return this.db.transaction(store, mode).objectStore(store); }
  get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
    return new Promise((res, rej) => { const r = this.tx(store, "readonly").get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }
  put<T extends object>(store: string, val: T): Promise<T> {
    return new Promise((res, rej) => { const r = this.tx(store, "readwrite").put(val as any); r.onsuccess = () => res(val); r.onerror = () => rej(r.error); });
  }
  del(store: string, key: IDBValidKey): Promise<void> {
    return new Promise((res, rej) => { const r = this.tx(store, "readwrite").delete(key); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
  }
  all<T>(store: string): Promise<T[]> {
    return new Promise((res, rej) => { const r = this.tx(store, "readonly").getAll(); r.onsuccess = () => res(r.result ?? []); r.onerror = () => rej(r.error); });
  }
}

/* 内存兜底库：隐私模式 / WebView / 存储被禁时整站仍可用（数据仅本次会话有效） */
export class MemoryDB implements IDB {
  private stores = new Map<string, Map<string, unknown>>();
  private s(name: string) { if (!this.stores.has(name)) this.stores.set(name, new Map()); return this.stores.get(name)!; }
  get<T>(store: string, key: IDBValidKey): Promise<T | undefined> { return Promise.resolve(this.s(store).get(String(key)) as T | undefined); }
  put<T extends object>(store: string, val: T): Promise<T> {
    const k = String((val as any).id ?? (val as any).key ?? Math.random().toString(36));
    this.s(store).set(k, val); return Promise.resolve(val);
  }
  del(store: string, key: IDBValidKey): Promise<void> { this.s(store).delete(String(key)); return Promise.resolve(); }
  all<T>(store: string): Promise<T[]> { return Promise.resolve([...this.s(store).values()] as T[]); }
}

let dbp: Promise<IDB> | null = null;
export function openDB(): Promise<IDB> {
  if (dbp) return dbp;
  if (typeof indexedDB === "undefined") { console.warn("[garden] IndexedDB 不可用，使用内存库"); dbp = Promise.resolve(new MemoryDB()); return dbp; }
  dbp = new Promise<IDB>((res, rej) => {
    try {
      const req = indexedDB.open("garden-db", 1);
      let settled = false;
      // 3.5 秒超时兜底：IndexedDB 卡死不响应时（某些隐私环境常见），降级内存库，绝不无限等待
      const timer = setTimeout(() => { if (!settled) { settled = true; console.warn("[garden] IndexedDB 超时，降级内存库"); res(new MemoryDB()); } }, 3500);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, KEYLESS.has(s) ? { keyPath: "id", autoIncrement: true } : { keyPath: s === "meta" ? "key" : "id" });
      };
      req.onsuccess = () => { if (!settled) { settled = true; clearTimeout(timer); res(new DB(req.result)); } };
      req.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); rej(req.error); } };
      req.onblocked = () => { if (!settled) { settled = true; clearTimeout(timer); rej(new Error("数据库被占用")); } };
    } catch (e) { rej(e); }
  }).catch((e) => { console.warn("[garden] IndexedDB 打开失败，降级内存库:", e); return new MemoryDB(); });
  return dbp;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export async function hashPassword(pw: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const PAGE_KEYS = ["home", "blog", "games", "tools", "board", "ranks", "me"];

export const ACH_DEFS: AchDef[] = [
  { code: "first_play", name: "初来乍到", description: "完成第一局游戏", icon: "🌱" },
  { code: "ten_games", name: "游园惊梦", description: "玩过 10 款不同的游戏", icon: "🎪" },
  { code: "score_5000", name: "小有身手", description: "单局得分超过 5000", icon: "⭐" },
  { code: "score_10000", name: "炉火纯青", description: "单局得分超过 10000", icon: "🌟" },
  { code: "streak_3", name: "三日不辍", description: "连续 3 天访问花园", icon: "🔥" },
  { code: "streak_7", name: "每周园丁", description: "连续 7 天访问花园", icon: "📅" },
  { code: "blog_author", name: "园丁笔耕", description: "发布过一篇博客文章", icon: "✍️" },
  { code: "explorer", name: "全园漫游", description: "访问过花园的全部页面", icon: "🗺️" },
  { code: "melon_king", name: "瓜王初成", description: "合成大西瓜单局 2000 分", icon: "🍉" },
  { code: "calc_god", name: "神算子", description: "24 点单局 3000 分", icon: "🧮" },
  { code: "detective", name: "温室侦探", description: "完成一次温室逃脱", icon: "🕵️" },
  { code: "pixel_deep", name: "地牢深处", description: "像素地牢到达第 8 层", icon: "🗝️" },
  { code: "contra_hero", name: "孤胆英雄", description: "魂斗勇者击败军团 Boss", icon: "🎖️" },
];

const WELCOME_MD = `欢迎走进这座花园 🌿

这里是一个人的内容小院：**博客**记录想法，**游戏厅**藏着 29 款小游戏，**工具箱**放着趁手的家伙，**留言板**等你来贴便签。

## 快速上手

1. 底部导航（手机）或顶部菜单（电脑）切换园区
2. 游戏厅每款都能计分、上排行榜
3. 注册账号后，分数、成就、待办都跟着你走

## 手机玩家

- 所有游戏竖屏完整显示，横版游戏横持体验最佳
- 浏览器菜单「添加到主屏幕」可像 App 一样打开

> 种下一棵树最好的时间是十年前，其次是现在。

| 园区 | 亮点 |
|---|---|
| 🕹 游戏厅 | 贪吃蛇到中国象棋，29 款 |
| 🧰 工具箱 | 番茄钟、密码生成、天气… |
| 💬 留言板 | 路过留句话 |

祝你逛得开心！`;

const GUIDE_MD = `游戏厅里有 29 款游戏，这篇是园主的私房推荐。

## 通勤路上（单手 · 短局）

- **2048 / 消消乐 / 猜诗**：地铁三站一局
- **合成大西瓜**：物理合成，越玩越上头
- **1A2B 破译**：一分钟学会的密码游戏

## 认真打一局

- **地下城幸存者**：割草 + 升级三选一，小心骷髅王
- **像素地牢**：Roguelike，每 5 层一个 Boss
- **魂斗勇者**：横版突突突，终点有机甲

## 动脑子

- **数独 / 扫雷 / 中国象棋**：经典永流传
- **海龟汤 / 温室逃脱**：悬疑解谜，真相只有一个

每款游戏都有**简单 / 普通 / 困难**三档难度，分数实时入库。右上角可以静音，切后台自动暂停。`;

export async function seedIfNeeded(db: IDB): Promise<void> {
  const seeded = await db.get<MetaRow>("meta", "seeded");
  if (seeded) return;
  const now = Date.now();
  // 成就定义
  for (const a of ACH_DEFS) await db.put("achievements", { ...a });
  // 管理员
  const salt = uid();
  await db.put("users", { id: "u_admin", username: "admin", password: await hashPassword("garden123", salt), salt, nickname: "园主", avatar: "🌳", token: "tok_admin_" + uid(), role: "admin", createdAt: now });
  // 文章
  await db.put("articles", { id: "a_welcome", title: "欢迎来到数字花园", summary: "一座种在浏览器里的个人小院：博客、29 款游戏、工具箱与留言板。", content: WELCOME_MD, category: "公告", status: "published", viewCount: 128, createdAt: now - 86400e3 * 6, updatedAt: now - 86400e3 * 6 });
  await db.put("articles", { id: "a_guide", title: "游戏厅游玩指南", summary: "通勤玩什么、认真打什么、动脑子玩什么——园主的私房推荐。", content: GUIDE_MD, category: "攻略", status: "published", viewCount: 86, createdAt: now - 86400e3 * 3, updatedAt: now - 86400e3 * 3 });
  // 站点配置与统计
  await db.put("meta", { key: "cfg:siteTitle", value: "数字花园" });
  await db.put("meta", { key: "cfg:siteDesc", value: "博客 × 游戏厅 × 工具箱 · 一个人的内容小院" });
  await db.put("meta", { key: "cfg:welcome", value: "欢迎光临！今天想逛博客、打一局游戏，还是用点什么小工具？" });
  await db.put("meta", { key: "stat:visits", value: 0 });
  await db.put("meta", { key: "seeded", value: 1 });
}
