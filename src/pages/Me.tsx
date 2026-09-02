import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../lib/api";
import type { AchDef, ScoreBest } from "../lib/db";
import { ACH_DEFS } from "../lib/db";
import { PageHero, Reveal } from "../components/ui";
import { useGarden } from "../lib/store";
import { GAME_NAME_MAP, GAME_EMOJI_MAP } from "../game/registry";

const AVATARS = ["🙂", "😎", "🐱", "🐶", "🦊", "🐼", "🐸", "🌻", "🍄", "⭐", "🌈", "🔥"];

/* 内测兑换码卡片：登录前/登录后都显示，123456 → +1000 金币，不限次数 */
function RedeemCard() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [coins, setCoins] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useGarden((s) => s.toast);
  useEffect(() => { api.getCoins().then(setCoins).catch(() => setCoins(null)); }, [msg]);
  const redeem = async () => {
    setBusy(true);
    try {
      const r = await api.redeemCode(code);
      setOk(r.ok); setMsg(r.msg);
      if (r.ok) { setCode(""); toast(r.msg); }
    } catch { setOk(false); setMsg("兑换失败，稍后再试"); }
    setBusy(false);
  };
  return (
    <div className="card p-5 sm:p-6" style={{ borderLeftWidth: 5, borderLeftColor: "#efa32c" }}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">🎁</span>
        <h2 className="font-display text-[20px] text-ink">内测兑换码</h2>
        {coins !== null && <span className="chip ml-auto !text-[#96660f] !border-marigold/50">🪙 余额 {coins}</span>}
      </div>
      <p className="text-[13px] text-moss mt-1.5">内测玩家福利：输入兑换码领金币，用来解锁角色、皮肤与地牢商店装备。<b className="text-marigold">不限次数</b>。</p>
      <div className="flex gap-2 mt-3">
        <input className="input flex-1 font-mono tracking-[0.3em] text-center" placeholder="兑换码" value={code} onChange={(e) => { setCode(e.target.value); setMsg(""); }} onKeyDown={(e) => e.key === "Enter" && redeem()} maxLength={12} />
        <button className="btn btn-gold shrink-0" disabled={busy || !code.trim()} onClick={redeem}>{busy ? "兑换中…" : "立即兑换"}</button>
      </div>
      {msg && <div className={`rounded-lg px-3 py-2 text-[13px] font-bold mt-3 anim-fadeup ${ok ? "bg-leaf/10 border border-leaf/40 text-leaf" : "bg-berry/10 border border-berry/40 text-berry anim-shake"}`}>{msg}</div>}
      <p className="text-[12px] text-moss/70 mt-3 bg-mist/50 rounded-lg px-3 py-2">💡 提示：内测码是 <b className="font-mono">123456</b>。金币也能通过每局游戏结算自动获得。</p>
    </div>
  );
}

export default function Me() {
  const { user, doLogin, doRegister, doLogout, toast, setUser } = useGarden();
  if (!user) return <AuthCard doLogin={doLogin} doRegister={doRegister} toast={toast} />;
  return (
    <div>
      <PageHero emoji="🌰" title="个人中心" sub="分数、成就、金币与皮肤都跟着你走；游客数据登录时自动并入。" tone="#3e8e52" />
      <div className="grid lg:grid-cols-[340px_1fr] gap-5 items-start">
        {/* 资料卡 */}
        <Reveal>
          <div className="card p-6 text-center">
            <div className="text-[64px] leading-none">{user.avatar}</div>
            <h2 className="font-display text-[26px] text-ink mt-2">{user.nickname}</h2>
            <div className="text-[12px] text-moss">@{user.username}{user.role === "admin" && <span className="chip ml-2 !text-berry !border-berry/40">园主</span>}</div>
            <div className="grid grid-cols-3 gap-2 mt-5">
              {AVATARS.slice(0, 6).map((a) => (
                <button key={a} className={`press h-12 rounded-xl border-[1.5px] text-[22px] transition-all ${user.avatar === a ? "border-leaf bg-mist scale-105" : "border-ink/12 bg-cream hover:border-ink/30"}`} onClick={async () => { const u = await api.setProfile({ avatar: a }); setUser(u); }}>
                  {a}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-ghost btn-sm flex-1" onClick={async () => { const n = prompt("新昵称（2-12 字）"); if (n && n.trim()) { const u = await api.setProfile({ nickname: n.trim().slice(0, 12) }); setUser(u); toast("昵称已更新"); } }}>改昵称</button>
              <button className="btn btn-berry btn-sm flex-1" onClick={async () => { await doLogout(); toast("已退出登录", "info"); }}>退出登录</button>
            </div>
          </div>
        </Reveal>
        <div className="space-y-5">
          <RedeemCard />
          <MyBests />
          <Achievements />
          <SkinShop />
        </div>
      </div>
    </div>
  );
}

function AuthCard({ doLogin, doRegister, toast }: any) {
  const [mode, setMode] = useState<"login" | "reg">("login");
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [n, setN] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (mode === "login") { await doLogin(u, p); toast("欢迎回来！🌿"); }
      else { await doRegister(u, p, n); toast("注册成功，花园欢迎你！🌱"); }
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <div className="max-w-md mx-auto">
      <PageHero emoji="🌰" title="个人中心" sub="注册一个账号，游戏分数、成就、金币都会跟着你走。" tone="#3e8e52" />
      <div className="card p-6 sm:p-8 anim-fadeup">
        <div className="seg w-full mb-5">
          <button className={`flex-1 ${mode === "login" ? "on" : ""}`} onClick={() => { setMode("login"); setErr(""); }}>登录</button>
          <button className={`flex-1 ${mode === "reg" ? "on" : ""}`} onClick={() => { setMode("reg"); setErr(""); }}>注册</button>
        </div>
        <div className="space-y-3">
          <input className="input" placeholder="用户名" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" />
          {mode === "reg" && <input className="input" placeholder="昵称（可选）" value={n} onChange={(e) => setN(e.target.value)} maxLength={12} />}
          <input className="input" type="password" placeholder="密码（至少 6 位）" value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
        {err && <div className="rounded-lg bg-berry/10 border border-berry/40 px-3 py-2 text-[13px] font-bold text-berry mt-3 anim-shake">{err}</div>}
        <button className="btn btn-primary w-full mt-4" disabled={busy || !u || !p} onClick={submit}>
          {busy ? "请稍候…" : mode === "login" ? "登录花园" : "注册账号"}
        </button>
        <p className="text-[12px] text-moss mt-4 bg-mist/60 rounded-lg px-3 py-2 leading-relaxed">
          🔑 管理员演示账号：<b>admin</b> / <b>garden123</b><br />游客期间的游戏分数会在登录时自动并入账号。
        </p>
      </div>
      <div className="mt-5"><RedeemCard /></div>
    </div>
  );
}

function MyBests() {
  const [bests, setBests] = useState<ScoreBest[]>([]);
  useEffect(() => { api.myBests().then(setBests); }, []);
  const list = [...bests].sort((a, b) => b.score - a.score).slice(0, 8);
  return (
    <Reveal>
      <div className="card p-5">
        <h3 className="font-display text-[19px] text-ink mb-3">🏆 我的最高分</h3>
        {list.length === 0 ? (
          <div className="text-center py-4 text-moss text-sm">
            还没有成绩，去游戏厅逛逛吧
            <div className="mt-3"><Link to="/games" className="btn btn-primary btn-sm">进游戏厅 →</Link></div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {list.map((b) => (
              <Link key={b.id} to={`/game/${b.game}`} className="flex items-center gap-2.5 rounded-xl bg-mist/50 border border-ink/10 px-3 py-2.5 card-hover">
                <span className="text-[22px]">{GAME_EMOJI_MAP[b.game] ?? "🎮"}</span>
                <span className="flex-1 text-[13.5px] font-bold text-ink truncate">{GAME_NAME_MAP[b.game] ?? b.game}</span>
                <span className="font-display text-[16px] tabular" style={{ color: "#b8860b" }}>{b.score.toLocaleString()}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Reveal>
  );
}

function Achievements() {
  const [owned, setOwned] = useState<AchDef[]>([]);
  useEffect(() => { api.myAchievements().then(setOwned); }, []);
  const ownedSet = new Set(owned.map((a) => a.code));
  return (
    <Reveal>
      <div className="card p-5">
        <h3 className="font-display text-[19px] text-ink mb-1">🎖 成就墙 <span className="text-[13px] text-moss font-body font-normal">已点亮 {owned.length}/{ACH_DEFS.length}</span></h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
          {ACH_DEFS.map((a) => {
            const on = ownedSet.has(a.code);
            return (
              <div key={a.code} className={`rounded-xl border-[1.5px] px-3 py-3 text-center transition-all ${on ? "border-marigold/60 bg-mist/70" : "border-ink/10 bg-cream opacity-55 grayscale"}`}>
                <div className="text-[26px]" style={on ? { animation: "pulseSoft 2.4s ease-in-out infinite" } : undefined}>{a.icon}</div>
                <div className="text-[13px] font-bold text-ink mt-1">{a.name}</div>
                <div className="text-[10.5px] text-moss leading-snug mt-0.5">{a.description}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Reveal>
  );
}

function SkinShop() {
  const [coins, setCoins] = useState(0);
  const [ver, setVer] = useState(0);
  const toast = useGarden((s) => s.toast);
  useEffect(() => { api.getCoins().then(setCoins); }, [ver]);
  return (
    <Reveal>
      <div className="card p-5">
        <h3 className="font-display text-[19px] text-ink mb-1">🛍 皮肤商店 <span className="chip ml-2 !text-marigold !border-marigold/50">🪙 {coins}</span></h3>
        <p className="text-[12px] text-moss mb-3">每局游戏按得分产出金币（得分 ÷ 50）；皮肤只改外观，不卖数值。</p>
        <div className="space-y-4">
          {Object.entries(api.SKINS).map(([game, cat]) => (
            <div key={game}>
              <div className="text-[13px] font-bold text-moss mb-1.5">{cat.emoji} {cat.label}</div>
              <div className="flex gap-2 flex-wrap">
                {cat.items.map((item) => {
                  const equipped = api.skinCache[game] === item.id;
                  const owned = item.cost === 0 || equipped;
                  return (
                    <button
                      key={item.id}
                      className={`press rounded-xl border-[1.5px] px-3.5 py-2.5 text-left transition-all ${equipped ? "border-leaf bg-mist" : "border-ink/12 bg-cream hover:border-ink/30"}`}
                      onClick={async () => {
                        if (equipped) return;
                        const r = await api.buySkin(game, item.id);
                        toast(r.msg, r.ok ? "ok" : "err");
                        setVer((v) => v + 1);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border border-ink/20" style={{ background: item.value.startsWith("#") ? item.value : "linear-gradient(135deg,#24513a,#7cb356)" }} />
                        <span className="text-[13px] font-bold text-ink">{item.name}</span>
                      </span>
                      <span className="text-[11px] text-moss block mt-0.5">{equipped ? "✓ 使用中" : owned ? "点击使用" : `🪙 ${item.cost}`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
