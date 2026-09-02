import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import * as api from "../lib/api";
import type { ScoreBest } from "../lib/db";
import { CATEGORIES, CAT_TONE, GAMES, SCENES } from "../game/registry";
import { GameShell } from "../game/engine";
import { PageHero, Reveal } from "../components/ui";
import { useGarden } from "../lib/store";

export function GamesPage() {
  const [bests, setBests] = useState<ScoreBest[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(CATEGORIES.map((c, i) => [c, i < 3])));
  const [played, setPlayed] = useState<string[]>([]);
  const [scene, setScene] = useState("");
  useEffect(() => { api.myBests().then(setBests); api.playedGames().then(setPlayed); }, []);
  const bestOf = (id: string) => Math.max(0, ...bests.filter((b) => b.game === id).map((b) => b.score));
  const inScene = (g: (typeof GAMES)[number]) => (scene ? (scene === "commute" ? !!g.commute : g.scene.includes(scene)) : true);

  return (
    <div>
      <PageHero emoji="🕹️" title={`游戏厅 · ${GAMES.length} 款常开`} sub="每款都有分数、排行榜与金币。游客可玩，登录后分数归你。" tone="#d95d39" />
      <div className="flex flex-wrap items-center gap-2 mb-3 text-[13px] text-moss">
        <span className="chip">🎯 {GAMES.length} 款</span>
        <span className="chip">📱 触屏 + 键盘</span>
        <span className="chip">🪙 得分攒金币</span>
        <Link to="/ranks" className="chip press ml-auto !text-berry !border-berry/40 !min-h-[44px]">总排行榜 →</Link>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 -mx-4 px-4">
        <button className={`chip press shrink-0 !min-h-[44px] !px-4 !text-[13px] ${!scene ? "chip-on" : ""}`} onClick={() => setScene("")}>全部</button>
        {SCENES.map((s) => (
          <button key={s.key} className={`chip press shrink-0 !min-h-[44px] !px-4 !text-[13px] ${scene === s.key ? "chip-on" : ""}`} onClick={() => setScene(scene === s.key ? "" : s.key)}>{s.label}</button>
        ))}
      </div>

      <div className="space-y-5">
        {CATEGORIES.map((cat, ci) => {
          const list = GAMES.filter((g) => g.category === cat && inScene(g));
          if (!list.length) return null;
          const isOpen = open[cat];
          const tone = CAT_TONE[cat] ?? "#3e8e52";
          return (
            <Reveal key={cat} delay={Math.min(ci, 4) * 50}>
              <section className="card overflow-hidden">
                <button className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left" onClick={() => setOpen({ ...open, [cat]: !isOpen })}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tone }} />
                  <span className="font-display text-[19px] text-ink">{cat}</span>
                  <span className="text-[12px] text-moss">{list.length} 款</span>
                  <svg className={`ml-auto transition-transform duration-300 text-moss ${isOpen ? "rotate-180" : ""}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {isOpen && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-4 sm:px-5 pb-5">
                    {list.map((g, i) => {
                      const best = bestOf(g.id);
                      return (
                        <Link
                          key={g.id}
                          to={`/game/${g.id}`}
                          className="relative rounded-xl border-[1.5px] border-ink/12 bg-mist/50 p-3.5 press card-hover"
                          style={{ animation: `fadeUp .35s ease ${i * 40}ms both` }}
                        >
                          {g.hot && <span className="absolute -top-2 -right-2 text-[10px] font-black bg-berry text-white rounded-full px-2 py-0.5 shadow" style={{ animation: "pulseSoft 1.8s infinite" }}>HOT</span>}
                          {played.includes(g.id) && !g.hot && <span className="absolute top-2 right-2 text-[10px] font-bold text-leaf">✓ 玩过</span>}
                          <div className="text-[34px] leading-none">{g.emoji}</div>
                          <div className="font-display text-[16px] mt-2 text-ink leading-tight">{g.name}</div>
                          <div className="text-[11px] text-moss mt-0.5 leading-snug min-h-[28px]">{g.desc}</div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex gap-1 flex-wrap">{g.tags.slice(0, 2).map((t) => <span key={t} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-ink/12 text-moss">{t}</span>)}</div>
                            <span className="text-[11px] font-bold tabular" style={{ color: best ? "#b8860b" : "var(--color-moss)" }}>{best ? `🏆 ${best.toLocaleString()}` : "—"}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </Reveal>
          );
        })}
      </div>

      <Reveal className="mt-8">
        <div className="card p-5 border-dashed !border-2 text-[13px] text-moss leading-relaxed">
          <b className="text-ink">📱 手机须知：</b>竖屏完整显示不裁剪；横版游戏（冒险勇士 / 植物大战僵尸等）竖持会自动转正，横持画面更大；切后台自动暂停。
        </div>
      </Reveal>
    </div>
  );
}

export function GamePlayPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const def = GAMES.find((g) => g.id === id);
  if (!def) {
    return (
      <div className="card p-10 text-center text-moss mt-6">
        没有找到这款游戏 🍂
        <div className="mt-4"><Link to="/games" className="btn btn-primary btn-sm">回游戏厅</Link></div>
      </div>
    );
  }
  return <GameShell def={def} daily={sp.get("daily") === "1"} onExit={() => nav("/games")} />;
}
