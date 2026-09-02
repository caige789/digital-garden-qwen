import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGarden } from "../lib/store";
import * as api from "../lib/api";
import type { Article, Message, LbEntry } from "../lib/db";
import { CountUp, LeafFall, Reveal, SectionHead, Sprout, timeAgo } from "../components/ui";
import { GAMES } from "../game/registry";

export default function Home() {
  const { stats, config, user } = useGarden();
  const [articles, setArticles] = useState<Article[]>([]);
  const [activity, setActivity] = useState<{ icon: string; text: string; t: number }[]>([]);
  useEffect(() => {
    api.listArticles().then((a) => setArticles(a.slice(0, 3)));
    Promise.all([api.listMessages(), api.leaderboard("snake", 3)]).then(([msgs, tops]) => {
      const items: { icon: string; text: string; t: number }[] = [
        ...msgs.slice(0, 5).map((m: Message) => ({ icon: "💬", text: `${m.nickname}：${m.content.slice(0, 24)}`, t: m.createdAt })),
        ...tops.map((e: LbEntry) => ({ icon: "🏆", text: `${e.nickname} 在贪吃蛇拿下 ${e.score} 分`, t: e.createdAt })),
      ].sort((a, b) => b.t - a.t);
      setActivity(items.slice(0, 6));
    });
  }, []);

  return (
    <div>
      {/* 开场：欢迎语 + 实时数据 */}
      <section className="relative card overflow-hidden px-5 sm:px-8 py-7 sm:py-9 border-l-[6px] !border-l-leaf">
        <LeafFall count={7} />
        <div className="relative flex flex-wrap items-center gap-5">
          <div style={{ animation: "sway 3.2s ease-in-out infinite" }}><Sprout size={64} /></div>
          <div className="flex-1 min-w-[230px]">
            <div className="text-[11px] font-black tracking-[0.28em] text-berry uppercase">Digital Garden</div>
            <h1 className="font-display text-[32px] sm:text-[44px] leading-[1.1] text-ink mt-1">
              {config.siteTitle || "数字花园"}
              <span className="block text-[17px] sm:text-[20px] text-moss font-body font-medium mt-2">{config.welcome || "欢迎光临！今天想逛博客、打一局游戏，还是用点什么小工具？"}</span>
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto">
            {[
              ["👣", "总访问量", stats.visits],
              ["📝", "文章", stats.articles],
              ["🕹", "游戏", stats.games],
              ["💬", "留言", stats.messages],
            ].map(([icon, label, val]) => (
              <div key={label as string} className="card !shadow-none bg-mist/60 px-4 py-2.5 text-center min-w-[92px]">
                <div className="font-display text-[22px] text-pine leading-none"><CountUp to={val as number} /></div>
                <div className="text-[11px] text-moss font-bold mt-1">{icon} {label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 动态跑马灯 */}
      {activity.length > 0 && (
        <div className="ticker-wrap overflow-hidden mt-4 border-y-[1.5px] border-ink/8 py-2 text-[13px] text-moss">
          <div className="ticker-track whitespace-nowrap">
            {[...activity, ...activity].map((a, i) => (
              <span key={i} className="mx-5">{a.icon} {a.text} <span className="opacity-50">· {timeAgo(a.t)}</span></span>
            ))}
          </div>
        </div>
      )}

      {/* 园区 */}
      <section className="mt-10">
        <SectionHead kicker="PARK MAP" title="逛一逛园区" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to: "/blog", emoji: "📝", name: "博客", sub: `${stats.articles} 篇文章`, tone: "#3e8e52", span: "" },
            { to: "/games", emoji: "🕹️", name: "游戏厅", sub: `${stats.games} 款游戏 · 排行榜`, tone: "#d95d39", span: "col-span-2 row-span-2" },
            { to: "/tools", emoji: "🧰", name: "工具箱", sub: "11 件趁手工具", tone: "#2e8f83", span: "" },
            { to: "/board", emoji: "💬", name: "留言板", sub: `${stats.messages} 条脚印`, tone: "#efa32c", span: "" },
            { to: "/ranks", emoji: "🏆", name: "排行榜", sub: "每款游戏一张榜", tone: "#7b4b94", span: "" },
            { to: "/me", emoji: "🌰", name: "个人中心", sub: user ? user.nickname : "登录 / 注册", tone: "#6f9fd8", span: "" },
          ].map((z, i) => (
            <Reveal key={z.to} delay={i * 60} className={z.span}>
              <Link
                to={z.to}
                className={`card card-hover tilt flex flex-col justify-between p-4 sm:p-5 h-full min-h-[104px] ${z.span ? "!p-6" : ""}`}
                style={{ borderLeft: `5px solid ${z.tone}` }}
              >
                <span className={`${z.span ? "text-[56px]" : "text-[32px]"}`} style={{ animation: "pulseSoft 2.8s ease-in-out infinite", animationDelay: `${i * 0.4}s` }}>{z.emoji}</span>
                <span>
                  <span className={`font-display ${z.span ? "text-[26px]" : "text-[18px]"} text-ink block`}>{z.name}</span>
                  <span className="text-[12px] text-moss">{z.sub}</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 今日挑战 */}
      <DailyStrip />
      {/* 通勤推荐 */}
      <CommuteStrip />

      {/* 最新文章 */}
      <section className="mt-10">
        <SectionHead kicker="FRESH PICKS" title="刚长出来的文章" extra={<Link to="/blog" className="btn btn-ghost btn-sm shrink-0">全部 →</Link>} />
        <div className="grid sm:grid-cols-3 gap-3">
          {articles.map((a, i) => (
            <Reveal key={a.id} delay={i * 70}>
              <Link to={`/blog/${a.id}`} className="card card-hover tilt p-4 block h-full">
                <span className="chip">{a.category}</span>
                <h3 className="font-display text-[17px] text-ink mt-2 leading-snug">{a.title}</h3>
                <p className="text-[12.5px] text-moss mt-1.5 line-clamp-2">{a.summary}</p>
                <div className="text-[11px] text-moss/70 mt-3">👁 {a.viewCount} · {timeAgo(a.createdAt)}</div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PWA */}
      <Reveal className="mt-10">
        <div className="card p-5 flex flex-wrap items-center gap-4 border-dashed !border-2">
          <Sprout size={40} />
          <div className="flex-1 min-w-[220px]">
            <h3 className="font-display text-lg text-ink">把花园装进口袋</h3>
            <p className="text-[13px] text-moss mt-0.5">浏览器菜单选「添加到主屏幕」，像 App 一样全屏打开，离线也能逛。</p>
          </div>
          <span className="chip !text-lagoon !border-lagoon/50">📲 PWA 就绪</span>
        </div>
      </Reveal>
    </div>
  );
}

/* 今日挑战：日期种子，全服同题 */
function DailyStrip() {
  const pool = ["maze", "sudoku", "watermelon", "2048", "lightsout", "calc24"];
  const day = Math.floor(Date.now() / 86400e3);
  const picks = [0, 1, 2].map((i) => pool[(day + i * 2) % pool.length]);
  return (
    <Reveal className="mt-10">
      <SectionHead kicker="DAILY" title="🎯 今日挑战" extra={<span className="chip shrink-0 !text-marigold !border-marigold/50">{new Date().toLocaleDateString("zh-CN")} 全服同题</span>} />
      <div className="grid grid-cols-3 gap-3">
        {picks.map((id) => {
          const gm = GAMES.find((g) => g.id === id)!;
          return (
            <Link key={id} to={`/game/${id}?daily=1`} className="card card-hover tilt p-3.5 sm:p-4 text-center">
              <div className="text-[30px] sm:text-[36px]">{gm.emoji}</div>
              <div className="font-display text-[14px] sm:text-[16px] mt-1 text-ink">{gm.name}</div>
              <div className="text-[10.5px] sm:text-[11px] text-moss mt-0.5">种子 #{day % 10000}</div>
            </Link>
          );
        })}
      </div>
    </Reveal>
  );
}

/* 通勤时段推荐 */
function CommuteStrip() {
  const h = new Date().getHours();
  const on = (h >= 7 && h <= 9) || (h >= 17 && h <= 20);
  if (!on) return null;
  const list = GAMES.filter((g) => g.commute).slice(0, 8);
  return (
    <Reveal className="mt-10">
      <SectionHead kicker="ON THE WAY" title="🚇 通勤路上来一局" extra={<Link to="/games" className="btn btn-ghost btn-sm shrink-0">更多 →</Link>} />
      <div className="card p-4 !border-l-lagoon" style={{ borderLeftWidth: 5 }}>
        <p className="text-[13px] text-moss mb-3">单手可玩、随时能断、一局三五分钟。</p>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {list.map((gm) => (
            <Link key={gm.id} to={`/game/${gm.id}`} className="shrink-0 w-[118px] rounded-xl border-[1.5px] border-ink/12 bg-mist/60 p-3 text-center press hover:border-lagoon/50 transition-colors">
              <div className="text-[30px]">{gm.emoji}</div>
              <div className="font-display text-[14px] mt-1 text-ink leading-tight">{gm.name}</div>
              <div className="text-[10.5px] text-moss mt-0.5 truncate">{gm.tags[0]}</div>
            </Link>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
