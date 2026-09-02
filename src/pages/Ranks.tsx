import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../lib/api";
import type { LbEntry } from "../lib/db";
import { GAMES, GAME_EMOJI_MAP } from "../game/registry";
import { PageHero, Reveal } from "../components/ui";
import { useGarden } from "../lib/store";

export default function Ranks() {
  const [game, setGame] = useState("snake");
  const [top, setTop] = useState<LbEntry[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const { user } = useGarden();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.leaderboard(game, 10), api.myRank(game)])
      .then(([t, r]) => { setTop(t); setRank(r); })
      .catch(() => { /* 数据库超时/不可用：显示空榜而不是卡住 */ })
      .finally(() => setLoading(false));
  }, [game]);

  const def = GAMES.find((g) => g.id === game)!;

  return (
    <div>
      <PageHero emoji="🏆" title="排行榜 · 园丁榜" sub="每款游戏一张榜，取每人最高分；游客分数登录后并入账号。" tone="#7b4b94" />
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 -mx-4 px-4 pb-1">
        {GAMES.map((g) => (
          <button key={g.id} className={`chip press shrink-0 !min-h-[44px] !px-3.5 !text-[13px] ${game === g.id ? "chip-on" : ""}`} onClick={() => setGame(g.id)}>
            {g.emoji} {g.name}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-5 items-start">
        <Reveal>
          <div className="card p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{def.emoji}</span>
              <div>
                <h2 className="font-display text-xl text-ink leading-none">{def.name} TOP 10</h2>
                <p className="text-[12px] text-moss mt-1">每人取最高分 · 实时更新</p>
              </div>
              <Link to={`/game/${game}`} className="btn btn-primary btn-sm ml-auto shrink-0">去玩 →</Link>
            </div>
            {loading ? (
              <div className="py-10 text-center text-moss text-sm">榜单刷新中…</div>
            ) : top.length === 0 ? (
              <div className="py-10 text-center text-moss text-sm">还没有人上榜，第一个 {GAME_EMOJI_MAP[game]} 王者就是你！</div>
            ) : (
              <div className="space-y-2">
                {top.map((e, i) => {
                  const isMe = user && e.userId === user.id;
                  return (
                    <div key={e.id ?? i} className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 border-[1.5px] transition-all ${i < 3 ? "bg-mist/70 border-ink/15" : "border-transparent bg-cream"} ${isMe ? "!border-leaf ring-2 ring-leaf/25" : ""}`} style={{ animation: `fadeUp .4s ease ${i * 40}ms both` }}>
                      <span className="w-8 text-center font-display text-[18px] shrink-0">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-moss">{i + 1}</span>}</span>
                      <span className="w-8 h-8 rounded-full bg-cream border border-ink/15 flex items-center justify-center text-[15px] shrink-0">{e.nickname === "游客" ? "🌫️" : "🙂"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[14px] text-ink truncate">{e.nickname}{isMe && <span className="text-leaf text-[11px] font-black ml-1.5">（我）</span>}</div>
                        <div className="text-[11px] text-moss">{e.difficulty === "easy" ? "简单" : e.difficulty === "hard" ? "困难" : "普通"}难度 · {new Date(e.createdAt).toLocaleDateString("zh-CN")}</div>
                      </div>
                      <span className="font-display text-[19px] tabular shrink-0" style={{ color: i < 3 ? "#b8860b" : "var(--color-moss)" }}>{e.score.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Reveal>

        <div className="space-y-4">
          <div className="card p-5 text-center">
            <div className="text-[12px] font-black tracking-[0.2em] text-moss">我的排名</div>
            {!user ? (
              <div className="mt-2">
                <div className="font-display text-3xl text-moss">—</div>
                <p className="text-[12px] text-moss mt-1">登录后显示名次</p>
                <Link to="/me" className="btn btn-primary btn-sm mt-3">去登录</Link>
              </div>
            ) : (
              <div className="mt-1">
                <div className="font-display text-[44px] leading-none text-pine">{rank ? `#${rank}` : "—"}</div>
                <p className="text-[12px] text-moss mt-2">{rank ? `在「${def.name}」的第 ${rank} 名` : "还没上过榜，打一局试试！"}</p>
              </div>
            )}
          </div>
          <div className="card p-5">
            <h3 className="font-display text-[16px] text-ink mb-2">🧮 计分规则</h3>
            <ul className="text-[13px] text-moss space-y-1.5 leading-relaxed list-disc pl-4">
              <li>每局结束自动提交，取每人每游戏最高分</li>
              <li>单局超过 5000 / 10000 分解锁成就</li>
              <li>每局还会产出花园金币，可换皮肤与战机</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
