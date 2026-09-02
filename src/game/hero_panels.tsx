/* 角色选择面板（游戏菜单扩展）：地牢 / 幸存者共用一套 UI，属性加成在创建游戏时生效 */
import React, { useEffect, useState } from "react";
import { getCoins, getHeroId, HEROES, heroOwned, buyHero, equipHero } from "../lib/api";
import { useGarden } from "../lib/store";

function HeroPanel({ game, title, tone }: { game: string; title: string; tone: string }) {
  const [coins, setCoins] = useState<number | null>(null);
  const [cur, setCur] = useState(getHeroId(game));
  const [owned, setOwned] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const toast = useGarden((s) => s.toast);
  useEffect(() => {
    getCoins().then(setCoins).catch(() => setCoins(null));
    Promise.all((HEROES[game] ?? []).map(async (h) => [h.id, await heroOwned(game, h.id)] as const))
      .then((pairs) => setOwned(Object.fromEntries(pairs)));
  }, [msg, game]);
  const act = async (id: string) => {
    if (id === cur) return;
    if (owned[id]) {
      await equipHero(game, id); setCur(id);
      toast(`已切换为「${(HEROES[game] ?? []).find((h) => h.id === id)?.name}」`, "info");
      return;
    }
    const r = await buyHero(game, id);
    setMsg(r.msg);
    if (r.ok) { setCur(id); toast(r.msg); }
  };
  return (
    <div className="rounded-xl border-[1.5px] border-[#8fae93]/30 bg-[#122a1c] p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="font-display text-[15px] text-[#e9f2e4]">{title}</span>
        <span className="text-[12px] font-bold ml-auto" style={{ color: tone }}>{coins !== null ? `🪙 ${coins}` : "…"}</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5 max-h-[190px] overflow-y-auto no-scrollbar pr-0.5">
        {(HEROES[game] ?? []).map((h) => {
          const isCur = cur === h.id, isOwned = owned[h.id];
          return (
            <button key={h.id} onClick={() => act(h.id)}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left border-[1.5px] transition-all press ${isCur ? "border-[#f0c060] bg-[#f0c060]/10" : "border-[#8fae93]/25 bg-[#16351f] hover:border-[#8fae93]/60"}`}>
              <span className="text-[22px]">{h.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-[#e9f2e4]">{h.name} <span className="text-[11px] font-normal text-[#8fae93]">{h.stat}</span></span>
                <span className="block text-[11px] text-[#8fae93] truncate">{h.desc}</span>
              </span>
              <span className={`shrink-0 text-[12px] font-bold ${isCur ? "text-[#f0c060]" : isOwned ? "text-[#8fc176]" : "text-[#f0c060]"}`}>
                {isCur ? "使用中" : isOwned ? "切换" : `🪙${h.cost}`}
              </span>
            </button>
          );
        })}
      </div>
      {msg && <div className="text-[12px] font-bold mt-2" style={{ color: tone }}>{msg}</div>}
      <div className="text-[11px] text-[#8fae93] mt-2">属性下一局生效 · 金币在「我的 → 内测兑换码」领取</div>
    </div>
  );
}

export function DungeonHeroPanel() { return <HeroPanel game="dungeon" title="🧙 选择人物" tone="#f0c060" />; }
export function SurvivorHeroPanel() { return <HeroPanel game="survivor" title="⚔️ 选择英雄" tone="#f0c060" />; }
