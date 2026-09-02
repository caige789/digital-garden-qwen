import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useGarden } from "../lib/store";
import * as api from "../lib/api";
import type { Article, Message } from "../lib/db";
import { timeAgo } from "../components/ui";

const EMPTY: Article = { id: "", title: "", summary: "", content: "", category: "随笔", status: "published", viewCount: 0, createdAt: 0, updatedAt: 0 };

export default function Admin() {
  const { user } = useGarden();
  const [tab, setTab] = useState<"articles" | "messages" | "config" | "stats">("articles");
  if (!user || user.role !== "admin") return <Gate />;
  return (
    <div>
      <div className="card p-5 sm:p-6 mb-5 flex flex-wrap items-center gap-3">
        <span className="text-3xl">🛠</span>
        <div>
          <h1 className="font-display text-2xl text-ink leading-none">管理后台</h1>
          <p className="text-[12.5px] text-moss mt-1">文章、留言与站点配置。园主 {user.nickname} 在岗。</p>
        </div>
        <span className="chip ml-auto !text-berry !border-berry/40">管理员模式</span>
      </div>
      <div className="seg w-full sm:w-auto mb-5">
        {([["articles", "📝 文章"], ["messages", "💬 留言"], ["config", "⚙️ 配置"], ["stats", "📊 总览"]] as const).map(([k, l]) => (
          <button key={k} className={`${tab === k ? "on" : ""} flex-1 sm:flex-none`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "articles" && <ArticlesTab />}
      {tab === "messages" && <MessagesTab />}
      {tab === "config" && <ConfigTab />}
      {tab === "stats" && <StatsTab />}
    </div>
  );
}

function Gate() {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const toast = useGarden((s) => s.toast);
  const enter = async () => {
    setErr(""); setBusy(true);
    try {
      const me = await api.login(u, p);
      if (me.role !== "admin") { await api.logout(); setErr("该账号不是管理员"); }
      else { useGarden.getState().setUser(me); toast("欢迎回来，园主！"); }
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <div className="max-w-sm mx-auto card p-7 mt-6 text-center">
      <div className="text-4xl">🔒</div>
      <h1 className="font-display text-2xl mt-2 text-ink">管理后台</h1>
      <p className="text-[13px] text-moss mt-1">需要园主账号才能进入</p>
      <input className="input mt-4 text-left" placeholder="用户名" value={u} onChange={(e) => setU(e.target.value)} />
      <input className="input mt-2.5 text-left" type="password" placeholder="密码" value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enter()} />
      {err && <div className="rounded-lg bg-berry/10 border border-berry/40 px-3 py-2 text-[13px] font-bold text-berry mt-3 anim-shake">{err}</div>}
      <button className="btn btn-primary w-full mt-4" disabled={busy} onClick={enter}>{busy ? "校验中…" : "进入后台"}</button>
      <p className="text-[12px] text-moss mt-4 bg-mist/60 rounded-lg px-3 py-2">演示账号：<b>admin</b> / <b>garden123</b></p>
    </div>
  );
}

function ArticlesTab() {
  const [list, setList] = useState<Article[]>([]);
  const [editing, setEditing] = useState<Article | null>(null);
  const [preview, setPreview] = useState(false);
  const { toast } = useGarden();
  const load = () => api.listArticles(true).then(setList);
  useEffect(() => { load(); }, []);

  if (editing) {
    return (
      <div className="card p-5 sm:p-6 anim-fadeup">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-display text-xl text-ink">{editing.id ? "编辑文章" : "新建文章"}</h2>
          <div className="seg ml-auto">
            <button className={!preview ? "on" : ""} onClick={() => setPreview(false)}>编辑</button>
            <button className={preview ? "on" : ""} onClick={() => setPreview(true)}>预览</button>
          </div>
        </div>
        {!preview ? (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-[1fr_150px_150px] gap-2.5">
              <input className="input" placeholder="标题" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              <input className="input" placeholder="分类" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
              <select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as any })}>
                <option value="published">发布</option>
                <option value="draft">草稿</option>
              </select>
            </div>
            <input className="input" placeholder="摘要（显示在列表）" value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} />
            <textarea className="input font-mono !text-[13.5px]" rows={16} placeholder="Markdown 正文… 支持标题、代码块、表格、引用" value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" disabled={!editing.title.trim()} onClick={async () => {
                await api.saveArticle(editing); toast("文章已保存 🌱"); setEditing(null); load(); useGarden.getState().refresh();
              }}>💾 保存</button>
              <button className="btn flex-1" onClick={() => setEditing(null)}>取消</button>
            </div>
          </div>
        ) : (
          <div className="border-[1.5px] border-ink/15 rounded-xl p-5 sm:p-7 bg-cream">
            <h1 className="font-display text-[26px] text-ink mb-4">{editing.title || "（无标题）"}</h1>
            <div className="md-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{editing.content || "*正文还是空的*"}</ReactMarkdown></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-xl text-ink">文章管理</h2>
        <button className="btn btn-primary btn-sm ml-auto" onClick={() => setEditing({ ...EMPTY })}>＋ 新建文章</button>
      </div>
      <div className="space-y-2">
        {list.map((a) => (
          <div key={a.id} className="flex items-center gap-3 bg-mist/50 border border-ink/10 rounded-xl px-4 py-3 flex-wrap">
            <span className={`chip shrink-0 ${a.status === "draft" ? "!text-moss !border-moss/40" : "!text-leaf !border-leaf/40"}`}>{a.status === "draft" ? "草稿" : "已发布"}</span>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[14.5px] text-ink truncate">{a.title}</div>
              <div className="text-[11.5px] text-moss mt-0.5">{a.category} · 👁 {a.viewCount} · {timeAgo(a.updatedAt || a.createdAt)}</div>
            </div>
            <button className="btn btn-sm shrink-0" onClick={() => setEditing({ ...a })}>编辑</button>
            <Link className="btn btn-ghost btn-sm shrink-0 hidden sm:inline-flex" to={`/blog/${a.id}`}>查看</Link>
            <button className="btn btn-ghost btn-sm shrink-0 !text-berry" onClick={async () => { if (confirm(`删除《${a.title}》？`)) { await api.deleteArticle(a.id); toast("文章已删除", "info"); load(); useGarden.getState().refresh(); } }}>删除</button>
          </div>
        ))}
        {list.length === 0 && <div className="text-center text-moss text-sm py-6">还没有文章</div>}
      </div>
    </div>
  );
}

function MessagesTab() {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const { toast } = useGarden();
  useEffect(() => { api.listMessages().then(setMsgs); }, []);
  return (
    <div className="card p-5 sm:p-6">
      <h2 className="font-display text-xl text-ink mb-4">留言管理（{msgs.length}）</h2>
      <div className="space-y-2">
        {msgs.map((m) => (
          <div key={m.id} className="flex items-center gap-3 bg-mist/50 border border-ink/10 rounded-xl px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[14px] text-ink">{m.nickname} <span className="font-normal text-[11.5px] text-moss">{timeAgo(m.createdAt)}</span></div>
              <div className="text-[13.5px] text-moss truncate mt-0.5">{m.content}</div>
            </div>
            <button className="btn btn-ghost btn-sm !text-berry shrink-0" onClick={async () => { await api.deleteMessage(m.id); setMsgs((s) => s.filter((x) => x.id !== m.id)); toast("留言已删除", "info"); useGarden.getState().refresh(); }}>删除</button>
          </div>
        ))}
        {msgs.length === 0 && <div className="text-center text-moss text-sm py-6">没有留言</div>}
      </div>
    </div>
  );
}

function ConfigTab() {
  const [cfg, setCfg] = useState({ siteTitle: "", siteDesc: "", welcome: "" });
  const { toast } = useGarden();
  useEffect(() => { api.getConfig().then((c) => setCfg({ siteTitle: c.siteTitle ?? "", siteDesc: c.siteDesc ?? "", welcome: c.welcome ?? "" })); }, []);
  return (
    <div className="card p-5 sm:p-6 max-w-xl">
      <h2 className="font-display text-xl text-ink mb-4">站点配置</h2>
      <div className="space-y-3">
        <div><label className="text-[13px] font-bold text-moss">站点标题</label><input className="input mt-1" value={cfg.siteTitle} onChange={(e) => setCfg({ ...cfg, siteTitle: e.target.value })} /></div>
        <div><label className="text-[13px] font-bold text-moss">站点简介</label><textarea className="input mt-1" rows={2} value={cfg.siteDesc} onChange={(e) => setCfg({ ...cfg, siteDesc: e.target.value })} /></div>
        <div><label className="text-[13px] font-bold text-moss">首页欢迎语</label><textarea className="input mt-1" rows={2} value={cfg.welcome} onChange={(e) => setCfg({ ...cfg, welcome: e.target.value })} /></div>
        <button className="btn btn-primary w-full" onClick={async () => {
          await api.saveConfig("siteTitle", cfg.siteTitle);
          await api.saveConfig("siteDesc", cfg.siteDesc);
          await api.saveConfig("welcome", cfg.welcome);
          useGarden.getState().refresh();
          toast("配置已生效 ⚙️");
        }}>保存配置</button>
      </div>
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    api.getHomeStats()
      .then(setStats)
      .catch(() => setStats({ visits: 0, articles: 0, messages: 0, games: 29 })); // 数据库不可用时显示零值而非卡住
  }, []);
  if (!stats) return <div className="card p-8 text-center text-moss">统计加载中…</div>;
  const rows: [string, any][] = [
    ["👣 总访问量", stats.visits], ["📝 已发布文章", stats.articles],
    ["💬 留言数", stats.messages], ["🕹 游戏数", stats.games], ["👤 管理员账号", "admin / garden123"],
  ];
  return (
    <div className="card p-5 sm:p-6 max-w-xl">
      <h2 className="font-display text-xl text-ink mb-4">数据总览</h2>
      <div className="grid grid-cols-2 gap-3">
        {rows.map(([k, v]) => (
          <div key={k} className="bg-mist/60 border border-ink/10 rounded-xl p-4">
            <div className="text-[12px] font-bold text-moss">{k}</div>
            <div className="font-display text-[26px] text-pine mt-0.5 tabular">{typeof v === "number" ? v.toLocaleString() : v}</div>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-moss mt-4 leading-relaxed">每次页面访问计数 +1；数据结构与需求书 12 张表对齐，可整体迁移到 PostgreSQL（见 DEPLOY.md）。</p>
    </div>
  );
}
