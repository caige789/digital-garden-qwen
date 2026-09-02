/* 业务接口层：所有数据读写经此封装（替换内部实现即可切换云端数据库） */
import { openDB, uid, hashPassword, seedIfNeeded, ACH_DEFS, PAGE_KEYS } from "./db";
import type { IDB, Article, ScoreBest, Todo, Message, MetaRow, UserRow, LbEntry, AchDef, UserAchRow, DiaryRow } from "./db";

export type { Article, ScoreBest, Todo, Message, LbEntry, AchDef, DiaryRow };

let dbImpl: IDB | null = null;
let initP: Promise<void> | null = null;
export function init(): Promise<void> {
  if (!initP) {
    initP = (async () => {
      dbImpl = await openDB(); // 内部永不失败：IndexedDB 不可用时降级内存库
      try { await seedIfNeeded(dbImpl); } catch (e) { console.error("[garden] 种子数据写入失败:", e); }
      try { await refreshSkinCache(); } catch (e) { console.error("[garden] 皮肤缓存失败:", e); }
      try { await refreshHeroCache(); } catch (e) { console.error("[garden] 角色缓存失败:", e); }
    })().catch((e) => { initP = null; throw e; }); // 失败不钉死，下次调用可重试
  }
  return initP;
}
/* 代理：任何 db 操作前自动确保 init 完成；调用点写法不变，彻底杜绝 "undefined.all"
   关键：每次操作硬性 4 秒超时 —— 数据库卡死时操作会"失败"而不是"永远挂起"，
   保证全站没有任何页面会被数据库拖成无限加载。 */
const DB_OP_TIMEOUT = 4000;
export const db = new Proxy({} as IDB, {
  get: (_t, prop: string) => (...args: unknown[]) =>
    Promise.race([
      init().then(() => {
        if (!dbImpl) throw new Error("数据库未就绪");
        return (dbImpl as unknown as Record<string, (...a: unknown[]) => unknown>)[prop](...args);
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("db op timeout")), DB_OP_TIMEOUT)),
    ]),
});

/* ---------------- 身份 ---------------- */
const lsGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* 存储受限环境忽略 */ } };
const lsDel = (k: string) => { try { localStorage.removeItem(k); } catch { /* 同上 */ } };
export const guestUid = (): string => {
  let g = lsGet("garden_guest");
  if (!g) { g = "g_" + uid(); lsSet("garden_guest", g); }
  return g;
};
const tokenKey = () => lsGet("garden_token");

export async function me(): Promise<UserRow | null> {
  const tk = tokenKey();
  if (!tk) return null;
  const users = await db.all<UserRow>("users");
  return users.find((u) => u.token === tk) ?? null;
}
export async function login(username: string, password: string): Promise<UserRow> {
  const users = await db.all<UserRow>("users");
  const u = users.find((x) => x.username === username.trim());
  if (!u) throw new Error("用户名不存在");
  if ((await hashPassword(password, u.salt)) !== u.password) throw new Error("密码不对，再想想");
  const guest = guestUid();
  await mergeGuest(guest, u.id);
  lsSet("garden_token", u.token);
  return u;
}
export async function register(username: string, password: string, nickname: string): Promise<UserRow> {
  username = username.trim();
  if (username.length < 2) throw new Error("用户名至少 2 个字符");
  if (password.length < 6) throw new Error("密码至少 6 位");
  const users = await db.all<UserRow>("users");
  if (users.some((u) => u.username === username)) throw new Error("用户名已被占用");
  const salt = uid();
  const u: UserRow = { id: "u_" + uid(), username, password: await hashPassword(password, salt), salt, nickname: nickname.trim() || username, avatar: "🙂", token: "tok_" + uid(), role: "user", createdAt: Date.now() };
  await db.put("users", u);
  const guest = guestUid();
  await mergeGuest(guest, u.id);
  lsSet("garden_token", u.token);
  return u;
}
export async function logout(): Promise<void> { lsDel("garden_token"); }
export async function setProfile(patch: Partial<Pick<UserRow, "nickname" | "avatar">>): Promise<UserRow> {
  const u = await me(); if (!u) throw new Error("未登录");
  const nu = { ...u, ...patch }; await db.put("users", nu); return nu;
}
async function mergeGuest(guest: string, userId: string) {
  const scores = (await db.all<ScoreBest>("scores")).filter((s) => s.userId === guest);
  for (const s of scores) {
    const mine = (await db.all<ScoreBest>("scores")).filter((x) => x.userId === userId && x.game === s.game);
    if (!mine.some((m) => m.score >= s.score)) await db.put("scores", { ...s, id: uid(), userId });
    await db.del("scores", s.id);
  }
  const lbs = (await db.all<LbEntry>("leaderboard")).filter((l) => l.userId === guest);
  for (const l of lbs) await db.put("leaderboard", { ...l, userId, nickname: (await me())?.nickname ?? l.nickname });
  const todos = (await db.all<Todo>("todos")).filter((t) => t.userId === guest);
  for (const t of todos) await db.put("todos", { ...t, userId });
  const diaries = (await db.all<DiaryRow>("diary")).filter((d) => d.userId === guest);
  for (const d of diaries) await db.put("diary", { ...d, userId });
  // 金币、皮肤、角色一并并入账号
  const metas = await db.all<MetaRow>("meta");
  for (const m of metas) {
    const k = String(m.key);
    if (k === `coins:${guest}`) {
      const mine = (await db.get<MetaRow>("meta", `coins:${userId}`))?.value ?? 0;
      await db.put("meta", { key: `coins:${userId}`, value: mine + ((m.value as number) ?? 0) });
      await db.del("meta", k);
    } else if (k.includes(`:${guest}`) && (k.startsWith("hero:") || k.startsWith("heroown:") || k.startsWith("skin:"))) {
      const nk = k.replace(`:${guest}`, `:${userId}`);
      if (!(await db.get<MetaRow>("meta", nk))) await db.put("meta", { key: nk, value: m.value });
      await db.del("meta", k);
    }
  }
}

/* ---------------- 文章 ---------------- */
export async function listArticles(includeDraft = false): Promise<Article[]> {
  const all = await db.all<Article>("articles");
  return all.filter((a) => includeDraft || a.status === "published").sort((a, b) => b.createdAt - a.createdAt);
}
export async function getArticle(id: string): Promise<Article | null> {
  const a = (await db.get<Article>("articles", id)) ?? null;
  if (a && a.status === "published") { a.viewCount++; await db.put("articles", a); }
  return a;
}
export async function saveArticle(a: Article): Promise<Article> {
  const now = Date.now();
  a = { ...a, id: a.id || "a_" + uid(), createdAt: a.createdAt || now, updatedAt: now };
  await db.put("articles", a);
  if (a.status === "published") {
    const u = await me(); const key = `blogauthor:${u?.id ?? guestUid()}`;
    await db.put("meta", { key, value: 1 });
    await evaluateAndUnlock(u?.id ?? guestUid(), { publishedBlog: true });
  }
  return a;
}
export const deleteArticle = (id: string) => db.del("articles", id);

/* ---------------- SWR 缓存层（先显示缓存、后台静默刷新；联机版零感知延迟的关键） ---------------- */
const mem = new Map<string, { v: unknown; t: number }>();
function swr<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = mem.get(key);
  if (hit) {
    if (Date.now() - hit.t < ttl) return Promise.resolve(hit.v as T);
    fn().then((v) => mem.set(key, { v, t: Date.now() })).catch(() => {}); // 过期：返回旧值，后台刷新
    return Promise.resolve(hit.v as T);
  }
  return fn().then((v) => { mem.set(key, { v, t: Date.now() }); return v; });
}
const bust = () => mem.clear(); // 任何写操作后读缓存全部失效

/* ---------------- 留言 ---------------- */
export function listMessages(): Promise<Message[]> {
  return swr("messages", 30e3, () => db.all<Message>("messages").then((ms) => ms.sort((a, b) => b.createdAt - a.createdAt)));
}
export async function addMessage(nickname: string, content: string): Promise<Message> {
  const u = await me();
  const m: Message = { id: uid(), nickname: (nickname || u?.nickname || "游客").slice(0, 16), userId: u?.id, content: content.slice(0, 300), createdAt: Date.now() };
  await db.put("messages", m);
  bust();
  return m;
}
export const deleteMessage = async (id: string) => { await db.del("messages", id); bust(); };

/* ---------------- 配置 / 统计 ---------------- */
export async function getConfig(): Promise<Record<string, string>> {
  const metas = await db.all<MetaRow>("meta");
  const cfg: Record<string, string> = {};
  metas.forEach((m) => { if (m.key.startsWith("cfg:")) cfg[m.key.slice(4)] = String(m.value); });
  return cfg;
}
export const saveConfig = (key: string, value: string) => db.put("meta", { key: "cfg:" + key, value });
export async function trackPage(page: string): Promise<void> {
  const v = (await db.get<MetaRow>("meta", "stat:visits"))?.value ?? 0;
  await db.put("meta", { key: "stat:visits", value: v + 1 });
  const ukey = `pages:${(await me())?.id ?? guestUid()}`;
  const pages: string[] = (await db.get<MetaRow>("meta", ukey))?.value ?? [];
  if (!pages.includes(page)) { pages.push(page); await db.put("meta", { key: ukey, value: pages }); }
  await markVisitDay();
  await evaluateAndUnlock((await me())?.id ?? guestUid(), {});
}
async function markVisitDay() {
  const key = `days:${(await me())?.id ?? guestUid()}`;
  const today = new Date().toISOString().slice(0, 10);
  const days: string[] = (await db.get<MetaRow>("meta", key))?.value ?? [];
  if (!days.includes(today)) { days.push(today); await db.put("meta", { key, value: days.slice(-60) }); }
}
function calcStreak(days: string[]): number {
  if (!days.length) return 0;
  const set = new Set(days);
  let streak = 0; const d = new Date();
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  if (!set.has(fmt(d))) d.setDate(d.getDate() - 1);
  while (set.has(fmt(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}
export function getHomeStats() {
  return swr("homestats", 60e3, async () => {
    const [articles, messages, visits] = await Promise.all([listArticles(), listMessages(), db.get<MetaRow>("meta", "stat:visits")]);
    return { visits: (visits?.value as number) ?? 0, articles: articles.length, games: 29, messages: messages.length };
  });
}

/* ---------------- 待办 / 日记 ---------------- */
export async function listTodos(): Promise<Todo[]> {
  const u = await me(); const k = u?.id ?? guestUid();
  return (await db.all<Todo>("todos")).filter((t) => t.userId === k).sort((a, b) => Number(a.completed) - Number(b.completed) || b.createdAt - a.createdAt);
}
export const addTodo = (content: string) => db.put("todos", { id: uid(), userId: (undefined as any), content: content.slice(0, 120), completed: false, createdAt: Date.now() }).then(async (t) => { t.userId = (await me())?.id ?? guestUid(); return db.put("todos", t); });
export async function toggleTodo(id: string) { const t = await db.get<Todo>("todos", id); if (t) { t.completed = !t.completed; await db.put("todos", t); } }
export const deleteTodo = (id: string) => db.del("todos", id);
export async function listDiary(): Promise<DiaryRow[]> {
  const k = (await me())?.id ?? guestUid();
  return (await db.all<DiaryRow>("diary")).filter((d) => d.userId === k).sort((a, b) => b.date.localeCompare(a.date));
}
export async function saveDiary(d: { id: string; title: string; content: string; date: string }) {
  const row: DiaryRow = { id: d.id || "d_" + uid(), userId: (await me())?.id ?? guestUid(), title: d.title || "无题", content: d.content, date: d.date, createdAt: Date.now() };
  await db.put("diary", row);
}
export const deleteDiary = (id: string) => db.del("diary", id);

/* ---------------- 分数 / 排行 / 金币 ---------------- */
export async function submitScore(game: string, score: number, difficulty: string) {
  const u = await me(); const uidX = u?.id ?? guestUid();
  const bests = (await db.all<ScoreBest>("scores")).filter((s) => s.userId === uidX && s.game === game);
  const prevBest = Math.max(0, ...bests.map((b) => b.score));
  const isNewBest = score > prevBest;
  if (isNewBest) {
    const row = bests[0] ?? { id: uid(), userId: uidX, game, score: 0, difficulty, createdAt: Date.now() };
    await db.put("scores", { ...row, score, difficulty, createdAt: Date.now() });
  }
  await db.put("leaderboard", { userId: uidX, nickname: u?.nickname ?? "游客", game, score, difficulty, createdAt: Date.now() });
  const coinsEarned = Math.max(1, Math.floor(score / 50));
  await addCoins(coinsEarned);
  const unlocked = await evaluateAndUnlock(uidX, { roundScore: score, roundGame: game });
  bust(); // 分数变了，排行榜/最高分/统计缓存全部作废
  return { best: Math.max(prevBest, score), isNewBest, top: await leaderboard(game, 5), unlocked, coins: coinsEarned };
}
export async function myBests(): Promise<ScoreBest[]> {
  const k = (await me())?.id ?? guestUid();
  return swr(`bests:${k}`, 60e3, () => db.all<ScoreBest>("scores").then((ss) => ss.filter((s) => s.userId === k)));
}
export function leaderboard(game: string, limit = 10): Promise<LbEntry[]> {
  return swr(`lb:${game}:${limit}`, 45e3, async () => {
    const all = (await db.all<LbEntry>("leaderboard")).filter((l) => l.game === game);
    const byUser = new Map<string, LbEntry>();
    for (const l of all) {
      const k = l.userId ?? "anon" + l.nickname;
      const cur = byUser.get(k);
      if (!cur || l.score > cur.score) byUser.set(k, l);
    }
    return [...byUser.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  });
}
export async function myRank(game: string): Promise<number | null> {
  const u = await me(); if (!u) return null;
  const all = await leaderboard(game, 99999);
  const i = all.findIndex((l) => l.userId === u.id);
  return i >= 0 ? i + 1 : null;
}
export async function playedGames(): Promise<string[]> {
  const k = (await me())?.id ?? guestUid();
  return [...new Set((await db.all<ScoreBest>("scores")).filter((s) => s.userId === k).map((s) => s.game))];
}

/* 金币 */
const coinKey = async () => `coins:${(await me())?.id ?? guestUid()}`;
export async function getCoins(): Promise<number> { return (await db.get<MetaRow>("meta", await coinKey()))?.value ?? 0; }
export async function addCoins(n: number): Promise<number> {
  const k = await coinKey();
  const cur = (await db.get<MetaRow>("meta", k))?.value ?? 0;
  await db.put("meta", { key: k, value: cur + n });
  bust();
  return cur + n;
}
/* 内测兑换码：123456 → +1000 金币（内测玩家不限次数） */
export async function redeemCode(code: string): Promise<{ ok: boolean; coins: number; msg: string }> {
  const c = code.trim();
  if (c === "123456") {
    const total = await addCoins(1000);
    return { ok: true, coins: 1000, msg: `兑换成功！+1000 🪙（余额 ${total}）` };
  }
  return { ok: false, coins: 0, msg: "兑换码无效，再核对一下？" };
}

/* ---------------- 角色系统（带属性加成，地牢 / 幸存者） ---------------- */
export type HeroDef = { id: string; name: string; emoji: string; cost: number; desc: string; stat: string; mods: Record<string, number> };
export const HEROES: Record<string, HeroDef[]> = {
  dungeon: [
    { id: "knight", name: "见习骑士", emoji: "🗡️", cost: 0, desc: "稳扎稳打的标准战士", stat: "攻2 血6 速2.7", mods: {} },
    { id: "berserk", name: "狂战士", emoji: "🪓", cost: 600, desc: "以血换力，刀刀见红", stat: "攻+2 血-2 攻速↑", mods: { atk: 2, hp: -2, cd: -70 } },
    { id: "rogue", name: "暗影刺客", emoji: "🥷", cost: 800, desc: "天下武功，唯快不破", stat: "速+0.8 攻速大↑", mods: { spd: 0.8, cd: -120, atk: -1 } },
    { id: "warden", name: "铁壁守卫", emoji: "🛡️", cost: 800, desc: "自带护盾，稳如磐石", stat: "血+3 开局🛡×1", mods: { hp: 3, shield: 1, spd: -0.3 } },
    { id: "lancer", name: "长枪游侠", emoji: "🔱", cost: 1200, desc: "出生即持长枪，范围翻倍", stat: "攻击范围 ×2", mods: { range: 2, atk: -1 } },
  ],
  survivor: [
    { id: "ranger", name: "林间游侠", emoji: "🧝", cost: 0, desc: "均衡的新手英雄", stat: "全属性标准", mods: {} },
    { id: "wind", name: "疾风行者", emoji: "⚡", cost: 600, desc: "跑得快，怪就追不上你", stat: "移速 +15%", mods: { spd: 0.15 } },
    { id: "brute", name: "重装武僧", emoji: "💪", cost: 800, desc: "更硬，更能打", stat: "伤害+15% 生命+30", mods: { might: 0.15, hp: 30 } },
    { id: "sage", name: "星辉学者", emoji: "🧙", cost: 1000, desc: "成长飞快，滚雪球之王", stat: "经验+30% 拾取+25", mods: { xp: 0.3, magnet: 25 } },
    { id: "blood", name: "血誓骑士", emoji: "❤️‍🔥", cost: 1500, desc: "越杀越强，以战养战", stat: "生命+60 击杀回血2", mods: { hp: 60, drain: 2 } },
  ],
};
const heroCache: Record<string, string> = {};
export function getHeroId(game: string): string { return heroCache[game] ?? HEROES[game]?.[0]?.id ?? ""; }
export function getHeroDef(game: string): HeroDef {
  const list = HEROES[game] ?? [];
  return list.find((h) => h.id === heroCache[game]) ?? list[0];
}
export async function refreshHeroCache(): Promise<void> {
  for (const gk of Object.keys(HEROES)) {
    const k = (await me())?.id ?? guestUid();
    const v = await db.get<MetaRow>("meta", `hero:${gk}:${k}`);
    if (v) heroCache[gk] = String(v.value);
  }
}
export async function buyHero(game: string, heroId: string): Promise<{ ok: boolean; msg: string }> {
  const item = (HEROES[game] ?? []).find((h) => h.id === heroId);
  if (!item) return { ok: false, msg: "角色不存在" };
  const balance = await getCoins();
  if (balance < item.cost) return { ok: false, msg: `金币不够（需 ${item.cost}），去兑换码或玩几局攒攒` };
  await addCoins(-item.cost);
  await markHeroOwned(game, heroId);
  const k = (await me())?.id ?? guestUid();
  await db.put("meta", { key: `hero:${game}:${k}`, value: heroId });
  heroCache[game] = heroId;
  return { ok: true, msg: `已解锁「${item.name}」并装备！` };
}
export async function equipHero(game: string, heroId: string): Promise<void> {
  const item = (HEROES[game] ?? []).find((h) => h.id === heroId);
  if (!item) return;
  const k = (await me())?.id ?? guestUid();
  const owned = (await db.get<MetaRow>("meta", `heroown:${game}:${heroId}:${k}`)) || item.cost === 0;
  if (!owned) return;
  await db.put("meta", { key: `hero:${game}:${k}`, value: heroId });
  heroCache[game] = heroId;
}
export async function heroOwned(game: string, heroId: string): Promise<boolean> {
  const item = (HEROES[game] ?? []).find((h) => h.id === heroId);
  if (!item) return false;
  if (item.cost === 0) return true;
  const k = (await me())?.id ?? guestUid();
  return !!(await db.get<MetaRow>("meta", `heroown:${game}:${heroId}:${k}`));
}
async function markHeroOwned(game: string, heroId: string) {
  const k = (await me())?.id ?? guestUid();
  await db.put("meta", { key: `heroown:${game}:${heroId}:${k}`, value: 1 });
}

/* 皮肤 */
export type SkinItem = { id: string; name: string; cost: number; value: string };
export const SKINS: Record<string, { label: string; emoji: string; items: SkinItem[] }> = {
  snake: { label: "贪吃蛇", emoji: "🐍", items: [{ id: "classic", name: "青竹", cost: 0, value: "#7cb356" }, { id: "gold", name: "鎏金", cost: 300, value: "#ffd76f" }, { id: "sakura", name: "暮樱", cost: 300, value: "#e8a0b8" }, { id: "ice", name: "霜蓝", cost: 300, value: "#8fd8e8" }] },
  flappy: { label: "Flappy", emoji: "🐤", items: [{ id: "classic", name: "小黄", cost: 0, value: "#f0c060" }, { id: "robin", name: "知更", cost: 250, value: "#6f9fd8" }, { id: "parrot", name: "鹦鹉", cost: 250, value: "#8fc176" }] },
  t2048: { label: "2048 棋盘", emoji: "🔢", items: [{ id: "moss", name: "苔原", cost: 0, value: "moss" }, { id: "night", name: "玄夜", cost: 400, value: "night" }, { id: "sakura", name: "暮樱", cost: 400, value: "sakura" }] },
};
export const skinCache: Record<string, string> = { snake: "classic", flappy: "classic", t2048: "moss" };
async function refreshSkinCache() {
  // 注意：本函数在 init() 内部被调用，必须直连 dbImpl，绝不能走 db 代理（代理会回头等 init，形成死锁）
  if (!dbImpl) return;
  const metas = await dbImpl.all<MetaRow>("meta");
  metas.forEach((m) => { if (m.key.startsWith("skin:")) skinCache[m.key.slice(5)] = String(m.value); });
}
export const getSkinValue = (game: string): string => {
  const id = skinCache[game] ?? "classic";
  return SKINS[game]?.items.find((i) => i.id === id)?.value ?? SKINS[game]?.items[0].value ?? "#7cb356";
};
export async function buySkin(game: string, skinId: string): Promise<{ ok: boolean; msg: string }> {
  const item = SKINS[game]?.items.find((i) => i.id === skinId);
  if (!item) return { ok: false, msg: "皮肤不存在" };
  const balance = await getCoins();
  if (balance < item.cost) return { ok: false, msg: "金币不够，多玩几局攒攒" };
  await addCoins(-item.cost);
  const k = (await me())?.id ?? guestUid();
  await db.put("meta", { key: `skin:${game}`, value: skinId });
  skinCache[game] = skinId;
  return { ok: true, msg: `已购入「${item.name}」` };
}

/* ---------------- 成就 ---------------- */
export async function myAchievements(): Promise<AchDef[]> {
  const k = (await me())?.id ?? guestUid();
  const rows = (await db.all<UserAchRow>("userach")).filter((r) => r.userId === k);
  return rows.map((r) => ACH_DEFS.find((a) => a.code === r.code)!).filter(Boolean);
}
export async function evaluateAndUnlock(uidX: string, ctx: { roundScore?: number; roundGame?: string; publishedBlog?: boolean }): Promise<AchDef[]> {
  const bests = (await db.all<ScoreBest>("scores")).filter((s) => s.userId === uidX);
  const gamesPlayed = new Set(bests.map((b) => b.game));
  const maxEver = Math.max(0, ...bests.map((b) => b.score), ctx.roundScore ?? 0);
  if (ctx.roundGame) gamesPlayed.add(ctx.roundGame);
  const days: string[] = (await db.get<MetaRow>("meta", `days:${uidX}`))?.value ?? [];
  const streak = calcStreak(days);
  const pages: string[] = (await db.get<MetaRow>("meta", `pages:${uidX}`))?.value ?? [];
  const authored = !!(await db.get<MetaRow>("meta", `blogauthor:${uidX}`));
  const cond: Record<string, boolean> = {
    first_play: gamesPlayed.size >= 1,
    ten_games: gamesPlayed.size >= 10,
    score_5000: maxEver >= 5000,
    score_10000: maxEver >= 10000,
    streak_3: streak >= 3,
    streak_7: streak >= 7,
    blog_author: !!(ctx.publishedBlog || authored),
    explorer: PAGE_KEYS.every((p) => pages.includes(p)),
    melon_king: bests.some((b) => b.game === "watermelon" && b.score >= 2000) || (ctx.roundGame === "watermelon" && (ctx.roundScore ?? 0) >= 2000),
    calc_god: bests.some((b) => b.game === "calc24" && b.score >= 3000) || (ctx.roundGame === "calc24" && (ctx.roundScore ?? 0) >= 3000),
    detective: bests.some((b) => b.game === "greenhouse" && b.score >= 800) || (ctx.roundGame === "greenhouse" && (ctx.roundScore ?? 0) >= 800),
    pixel_deep: bests.some((b) => b.game === "pixeldungeon" && b.score >= 8000) || (ctx.roundGame === "pixeldungeon" && (ctx.roundScore ?? 0) >= 8000),
    contra_hero: bests.some((b) => b.game === "contra" && b.score >= 6000) || (ctx.roundGame === "contra" && (ctx.roundScore ?? 0) >= 6000),
  };
  const owned = new Set((await db.all<UserAchRow>("userach")).filter((r) => r.userId === uidX).map((r) => r.code));
  const fresh: AchDef[] = [];
  for (const def of ACH_DEFS) {
    if (cond[def.code] && !owned.has(def.code)) {
      const saved = (await db.all<AchDef>("achievements")).find((a) => a.code === def.code);
      await db.put("userach", { userId: uidX, achievementId: saved?.id ?? 0, code: def.code, unlockedAt: Date.now() });
      fresh.push(def);
    }
  }
  return fresh;
}
