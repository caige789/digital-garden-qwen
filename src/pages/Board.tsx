import React, { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import type { Message } from "../lib/db";
import { PageHero, Reveal, timeAgo } from "../components/ui";
import { useGarden } from "../lib/store";

const EMOJIS = ["🌸", "🌻", "🍄", "🐝", "🌈", "⭐", "🔥", "😄", "🤝", "🍀"];

export default function Board() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [nick, setNick] = useState(() => localStorage.getItem("garden_nick") ?? "");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const { user, toast } = useGarden();

  const load = () => api.listMessages().then(setMessages);
  useEffect(() => { load(); }, []);

  /* 窗口化渲染：先挂 20 条，滚动到底再追加，避免长列表一次渲染几百个 DOM */
  const [visible, setVisible] = useState(20);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setVisible(20); }, [messages]);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visible >= messages.length) return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) setVisible((v) => v + 20); }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible, messages.length]);

  const post = async () => {
    if (!content.trim()) { toast("写点什么再发吧～", "err"); return; }
    setSending(true);
    try {
      localStorage.setItem("garden_nick", nick);
      await api.addMessage(nick || user?.nickname || "", content);
      setContent("");
      toast("留言已贴上！🌸");
      load();
      useGarden.getState().refresh();
    } catch (e: any) { toast(e.message, "err"); }
    setSending(false);
  };

  return (
    <div>
      <PageHero emoji="💬" title="留言板 · 脚印墙" sub="路过留句话；管理员可清理墙面。" tone="#efa32c" />
      <div className="grid lg:grid-cols-[360px_1fr] gap-5 items-start">
        <Reveal>
          <div className="card p-5 sticky top-20">
            <h2 className="font-display text-xl text-ink">✍️ 贴一张便签</h2>
            <input className="input mt-3" placeholder="昵称（可留空）" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={16} />
            <textarea className="input mt-2.5" rows={4} placeholder="想说点什么？攻略、问候、吐槽都欢迎…" value={content} onChange={(e) => setContent(e.target.value)} maxLength={300} />
            <div className="text-right text-[11px] text-moss mt-1">{content.length}/300</div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {EMOJIS.map((e) => (
                <button key={e} className="press w-11 h-11 rounded-lg bg-mist/70 border border-ink/10 text-lg hover:scale-110 transition-transform" onClick={() => setContent((c) => (c + e).slice(0, 300))}>{e}</button>
              ))}
            </div>
            <button className="btn btn-gold w-full mt-4" disabled={sending} onClick={post}>{sending ? "粘贴中…" : "📌 贴上留言"}</button>
            {!user && <p className="text-[12px] text-moss mt-3 leading-relaxed">💡 登录后留言会带上你的昵称与头像。</p>}
          </div>
        </Reveal>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[13px] text-moss font-bold px-1">
            共 {messages.length} 条脚印 <span className="w-1.5 h-1.5 rounded-full bg-leaf inline-block" style={{ animation: "pulseSoft 1.6s infinite" }} /> 最新在前
          </div>
          {messages.slice(0, visible).map((m, i) => (
            <Reveal key={m.id} delay={Math.min(i, 6) * 50}>
              <div className="card card-hover p-4 sm:p-5 group">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full flex items-center justify-center text-lg border-[1.5px] border-ink/15 shrink-0" style={{ background: `hsl(${(m.nickname.charCodeAt(0) * 37) % 360} 45% 88%)` }}>
                    {m.nickname[0] ?? "花"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-[15px] text-ink truncate">{m.nickname}</span>
                      <span className="text-[12px] text-moss shrink-0">{timeAgo(m.createdAt)}</span>
                      {user?.role === "admin" && (
                        <button className="ml-auto text-[12px] font-bold text-berry opacity-0 group-hover:opacity-100 md:opacity-60 hover:!opacity-100 press shrink-0" onClick={async () => { await api.deleteMessage(m.id); load(); toast("留言已清理", "info"); }}>
                          🧹 删除
                        </button>
                      )}
                    </div>
                    <p className="text-[14.5px] text-moss mt-1 leading-relaxed break-words whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
          {visible < messages.length && <div ref={sentinelRef} className="text-center text-[12px] text-moss py-2">往下滑加载更多…</div>}
          {messages.length === 0 && <div className="card p-10 text-center text-moss">第一张便签还空着，来抢沙发！</div>}
        </div>
      </div>
    </div>
  );
}
