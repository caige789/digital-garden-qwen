import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as api from "../lib/api";
import type { Article } from "../lib/db";
import { PageHero, Reveal, timeAgo } from "../components/ui";

/* 超时包装：避免任何一次数据库读取无限挂起 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race<T>([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

/* 内置文章：不依赖数据库，进页面立即渲染（与数据库种子文章同 id，数据库恢复后自动无缝接管） */
const FB_WELCOME = `欢迎走进这座花园 🌿

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

const FB_GUIDE = `游戏厅里有 29 款游戏，这篇是园主的私房推荐。

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

const now = Date.now();
export const FALLBACK_ARTICLES: Article[] = [
  { id: "a_welcome", title: "欢迎来到数字花园", summary: "一座种在浏览器里的个人小院：博客、29 款游戏、工具箱与留言板。", content: FB_WELCOME, category: "公告", status: "published", viewCount: 128, createdAt: now - 86400e3 * 6, updatedAt: now - 86400e3 * 6 },
  { id: "a_guide", title: "游戏厅游玩指南", summary: "通勤玩什么、认真打什么、动脑子玩什么——园主的私房推荐。", content: FB_GUIDE, category: "攻略", status: "published", viewCount: 86, createdAt: now - 86400e3 * 3, updatedAt: now - 86400e3 * 3 },
];

export function BlogPage() {
  /* 先用内置文章渲染（零等待），数据库读到了再合并升级 */
  const [articles, setArticles] = useState<Article[]>(FALLBACK_ARTICLES);
  const [cat, setCat] = useState("全部");
  const [dbNote, setDbNote] = useState("");
  useEffect(() => {
    let alive = true;
    withTimeout(api.listArticles(), 3000)
      .then((dbList) => {
        if (!alive) return;
        if (dbList.length) {
          const ids = new Set(dbList.map((a) => a.id));
          setArticles([...dbList, ...FALLBACK_ARTICLES.filter((f) => !ids.has(f.id))]);
        }
      })
      .catch(() => { if (alive) setDbNote("本地数据库暂时没连上，先展示内置文章，不影响阅读。"); });
    return () => { alive = false; };
  }, []);
  const cats = useMemo(() => ["全部", ...new Set(articles.map((a) => a.category))], [articles]);
  const list = articles.filter((a) => cat === "全部" || a.category === cat);
  return (
    <div>
      <PageHero emoji="📝" title="博客 · 园主的碎碎念" sub="公告、攻略与随笔。" tone="#3e8e52" />
      {dbNote && <div className="card !border-dashed p-3 mb-4 text-[13px] text-moss">{dbNote}</div>}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 -mx-4 px-4">
        {cats.map((c) => (
          <button key={c} className={`chip press shrink-0 !min-h-[44px] !px-4 !text-[13px] ${cat === c ? "chip-on" : ""}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="space-y-4">
        {list.map((a, i) => (
          <Reveal key={a.id} delay={Math.min(i, 5) * 60}>
            <Link to={`/blog/${a.id}`} className="card card-hover tilt p-5 block">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="chip">{a.category}</span>
                <span className="text-[12px] text-moss">👁 {a.viewCount} 次阅读</span>
                <span className="text-[12px] text-moss/70 ml-auto">{timeAgo(a.createdAt)}</span>
              </div>
              <h2 className="font-display text-[22px] text-ink mt-2.5">{a.title}</h2>
              <p className="text-[14px] text-moss mt-1.5 leading-relaxed line-clamp-2">{a.summary}</p>
              <span className="inline-block mt-3 text-[13px] font-bold text-leaf">阅读全文 →</span>
            </Link>
          </Reveal>
        ))}
        {list.length === 0 && <div className="card p-10 text-center text-moss">这个分类还是空的</div>}
      </div>
    </div>
  );
}

export function BlogPostPage() {
  const { id } = useParams();
  /* 内置文章直接命中则零等待渲染；否则等数据库（≤3s），读不到再回退内置 */
  const [a, setA] = useState<Article | null | undefined>(() => FALLBACK_ARTICLES.find((f) => f.id === id) ?? undefined);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const fb = FALLBACK_ARTICLES.find((f) => f.id === id) ?? null;
    withTimeout(api.getArticle(id), 3000)
      .then((dbA) => { if (alive) setA(dbA ?? fb); })
      .catch(() => { if (alive) setA(fb); });
    return () => { alive = false; };
  }, [id]);
  if (a === undefined) return <div className="py-20 text-center text-moss">加载中…</div>;
  if (a === null) return <div className="card p-10 text-center text-moss mt-6">文章不存在或已被移走 🍂 <div className="mt-4"><Link to="/blog" className="btn btn-primary btn-sm">回博客列表</Link></div></div>;
  const headings = useMemo(() => {
    return [...a.content.matchAll(/^(#{2,3})\s+(.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2], id: m[2].replace(/\s+/g, "-") }));
  }, [a.content]);
  return (
    <div className="grid lg:grid-cols-[1fr_230px] gap-6 items-start">
      <article className="card p-5 sm:p-9 anim-fadeup">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="chip">{a.category}</span>
          <span className="text-[12px] text-moss">👁 {a.viewCount} 次阅读</span>
          <span className="text-[12px] text-moss/70">{timeAgo(a.createdAt)}</span>
        </div>
        <h1 className="font-display text-[30px] sm:text-[38px] text-ink mt-3 leading-tight">{a.title}</h1>
        <span className="head-rule" aria-hidden />
        <div className="md-body mt-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.content}</ReactMarkdown>
        </div>
        <div className="mt-10 pt-5 border-t-[1.5px] border-ink/10 flex items-center justify-between">
          <Link to="/blog" className="btn btn-ghost btn-sm">← 返回列表</Link>
          <span className="text-[12px] text-moss">🌿 数字花园 · 慢慢长</span>
        </div>
      </article>
      {headings.length > 0 && (
        <aside className="card p-4 sticky top-20 hidden lg:block">
          <div className="text-[11px] font-black tracking-[0.2em] text-moss uppercase mb-2.5">本文目录</div>
          <nav className="space-y-1.5">
            {headings.map((h, i) => (
              <a key={i} href={`#${h.id}`} className="block text-[13px] text-moss hover:text-leaf font-bold transition-colors" style={{ paddingLeft: (h.level - 2) * 12 }}>
                {h.text}
              </a>
            ))}
          </nav>
        </aside>
      )}
    </div>
  );
}
