import React, { useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";
import type { DiaryRow, Todo } from "../lib/db";
import { PageHero } from "../components/ui";
import { useGarden } from "../lib/store";

const TOOLS = [
  { id: "pomodoro", name: "番茄钟", emoji: "🍅", tone: "#d95d39" },
  { id: "todo", name: "待办", emoji: "✅", tone: "#3e8e52" },
  { id: "diary", name: "日记", emoji: "📔", tone: "#efa32c" },
  { id: "password", name: "密码", emoji: "🔐", tone: "#2e8f83" },
  { id: "countdown", name: "倒计时", emoji: "⏳", tone: "#7b4b94" },
  { id: "color", name: "取色器", emoji: "🎨", tone: "#e07a5f" },
  { id: "quote", name: "名言", emoji: "💬", tone: "#6f9fd8" },
  { id: "weather", name: "天气", emoji: "⛅", tone: "#4a90a4" },
  { id: "json", name: "JSON", emoji: "🧾", tone: "#8a6fbf" },
  { id: "timestamp", name: "时间戳", emoji: "🕰️", tone: "#5a8a4a" },
  { id: "wheel", name: "转盘", emoji: "🎡", tone: "#c94f4f" },
];

export default function Tools() {
  const [tool, setTool] = useState("pomodoro");
  const cur = TOOLS.find((t) => t.id === tool)!;
  return (
    <div>
      <PageHero emoji="🧰" title="工具箱 · 十一件趁手的" sub="番茄钟、待办、日记存在你的数据库里；其余随取随用。" tone="#2e8f83" />
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-2 mb-5">
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => setTool(t.id)} className={`press flex flex-col items-center gap-1 rounded-xl border-[1.5px] py-2.5 transition-all text-[11px] font-bold ${tool === t.id ? "bg-pine text-paper border-pine shadow-[3px_3px_0_var(--shadow-soft)]" : "bg-cream text-moss border-ink/15 hover:border-ink/35"}`}>
            <span className="text-[22px]">{t.emoji}</span>
            {t.name}
          </button>
        ))}
      </div>
      <div className="card p-5 sm:p-7 anim-fadeup" key={tool} style={{ borderLeft: `5px solid ${cur.tone}` }}>
        {tool === "pomodoro" && <Pomodoro />}
        {tool === "todo" && <TodoTool />}
        {tool === "diary" && <DiaryTool />}
        {tool === "password" && <PasswordTool />}
        {tool === "countdown" && <CountdownTool />}
        {tool === "color" && <ColorTool />}
        {tool === "quote" && <QuoteTool />}
        {tool === "weather" && <WeatherTool />}
        {tool === "json" && <JsonTool />}
        {tool === "timestamp" && <TimestampTool />}
        {tool === "wheel" && <WheelTool />}
      </div>
    </div>
  );
}

function ToolHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-[24px] text-ink">{title}</h2>
      <p className="text-[13px] text-moss mt-0.5">{sub}</p>
    </div>
  );
}

function Pomodoro() {
  const [mode, setMode] = useState<"work" | "rest">("work");
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0);
  const toast = useGarden((s) => s.toast);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(t); setRunning(false);
          if (mode === "work") { setRounds((r) => r + 1); setMode("rest"); toast("🍅 番茄完成！休息 5 分钟"); return 5 * 60; }
          setMode("work"); toast("休息结束，开始新的番茄！", "info"); return 25 * 60;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, mode]);
  const total = mode === "work" ? 25 * 60 : 5 * 60;
  const pct = 1 - left / total;
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  const R = 88, C = 2 * Math.PI * R;
  return (
    <div>
      <ToolHead title="番茄钟" sub="25 分钟专注 + 5 分钟休息。" />
      <div className="flex flex-col sm:flex-row items-center gap-7">
        <div className="relative w-[210px] h-[210px]">
          <svg viewBox="0 0 210 210" className="w-full h-full -rotate-90">
            <circle cx="105" cy="105" r={R} fill="none" stroke="var(--color-mist)" strokeWidth="14" />
            <circle cx="105" cy="105" r={R} fill="none" stroke={mode === "work" ? "var(--color-berry)" : "var(--color-leaf)"} strokeWidth="14" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: "stroke-dashoffset .8s ease" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-display text-[46px] tabular leading-none text-ink">{mm}:{ss}</div>
            <div className="text-[12px] font-black mt-1.5" style={{ color: mode === "work" ? "var(--color-berry)" : "var(--color-leaf)" }}>{mode === "work" ? "专注中" : "休息中"}</div>
          </div>
        </div>
        <div className="flex flex-col gap-3 w-full sm:w-auto">
          <div className="flex gap-2">
            <button className="btn btn-berry flex-1" onClick={() => setRunning((r) => !r)}>{running ? "⏸ 暂停" : "▶ 开始"}</button>
            <button className="btn flex-1" onClick={() => { setRunning(false); setLeft(mode === "work" ? 1500 : 300); }}>重置</button>
          </div>
          <div className="card !shadow-none bg-mist/60 px-4 py-3 text-[14px]">🍅 今日已完成 <b className="font-display text-[20px] text-berry">{rounds}</b> 个番茄</div>
        </div>
      </div>
    </div>
  );
}

function TodoTool() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const toast = useGarden((s) => s.toast);
  const load = () => api.listTodos().then(setTodos);
  useEffect(() => { load(); }, []);
  const list = todos.filter((t) => (filter === "all" ? true : filter === "done" ? t.completed : !t.completed));
  return (
    <div>
      <ToolHead title="待办清单" sub="存在数据库里，登录前后都跟着你。" />
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="要做的事…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn btn-primary shrink-0" onClick={add}>添加</button>
      </div>
      <div className="flex gap-2 mt-3">
        {([["all", "全部"], ["open", "未完成"], ["done", "已完成"]] as const).map(([k, l]) => (
          <button key={k} className={`chip press !min-h-[44px] ${filter === k ? "chip-on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="space-y-2 mt-3">
        {list.map((t) => (
          <div key={t.id} className="flex items-center gap-3 bg-mist/50 rounded-xl px-3.5 py-2.5 border border-ink/10 group" style={{ animation: "fadeUp .3s ease both" }}>
            <button className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[13px] text-white transition-all press shrink-0 ${t.completed ? "bg-leaf border-leaf" : "border-moss/50 hover:border-leaf"}`} onClick={async () => { await api.toggleTodo(t.id); load(); }}>
              {t.completed && "✓"}
            </button>
            <span className={`flex-1 text-[14px] break-words ${t.completed ? "line-through text-moss/60" : "text-ink"}`}>{t.content}</span>
            <button className="text-moss/50 hover:text-berry text-lg px-1 opacity-0 group-hover:opacity-100 transition-opacity press" onClick={async () => { await api.deleteTodo(t.id); load(); toast("已删除", "info"); }}>✕</button>
          </div>
        ))}
        {list.length === 0 && <div className="text-center text-moss text-sm py-6">清单空空如也，种点任务进去 🌱</div>}
      </div>
    </div>
  );
  async function add() {
    if (!text.trim()) return;
    await api.addTodo(text); setText(""); load();
  }
}

function DiaryTool() {
  const [entries, setEntries] = useState<DiaryRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ id: "", title: "", content: "", date: new Date().toISOString().slice(0, 10) });
  const toast = useGarden((s) => s.toast);
  const load = () => api.listDiary().then(setEntries);
  useEffect(() => { load(); }, []);
  return (
    <div>
      <ToolHead title="日记本" sub="记录每天的心情，按日期倒序。" />
      {!editing ? (
        <div>
          <button className="btn btn-gold" onClick={() => { setForm({ id: "", title: "", content: "", date: new Date().toISOString().slice(0, 10) }); setEditing(true); }}>✍️ 写一篇新日记</button>
          <div className="space-y-3 mt-4">
            {entries.map((d) => (
              <div key={d.id} className="bg-mist/50 border border-ink/10 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <span className="chip !text-[11px]">{d.date}</span>
                  <h3 className="font-display text-[17px] text-ink truncate">{d.title}</h3>
                  <span className="ml-auto flex gap-2 shrink-0">
                    <button className="text-[12px] font-bold text-lagoon hover:underline press" onClick={() => { setForm({ id: d.id, title: d.title, content: d.content, date: d.date }); setEditing(true); }}>编辑</button>
                    <button className="text-[12px] font-bold text-berry hover:underline press" onClick={async () => { await api.deleteDiary(d.id); load(); toast("日记已删除", "info"); }}>删除</button>
                  </span>
                </div>
                <p className="text-[14px] text-moss mt-2 whitespace-pre-wrap leading-relaxed">{d.content}</p>
              </div>
            ))}
            {entries.length === 0 && <div className="text-center text-moss text-sm py-6">还没有日记，今天是个好开始 📔</div>}
          </div>
        </div>
      ) : (
        <div className="space-y-3 anim-fadeup">
          <div className="flex gap-2">
            <input type="date" className="input !w-[160px] shrink-0" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input className="input flex-1" placeholder="标题（可留空）" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={40} />
          </div>
          <textarea className="input" rows={6} placeholder="今天发生了什么？" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" disabled={!form.content.trim()} onClick={async () => { await api.saveDiary(form); setEditing(false); load(); toast("日记已保存 📔"); }}>保存</button>
            <button className="btn flex-1" onClick={() => setEditing(false)}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PasswordTool() {
  const [len, setLen] = useState(16);
  const [opts, setOpts] = useState({ upper: true, num: true, sym: true });
  const [pw, setPw] = useState("");
  const [copied, setCopied] = useState(false);
  const gen = () => {
    let pool = "abcdefghijkmnopqrstuvwxyz";
    if (opts.upper) pool += "ABCDEFGHJKLMNPQRSTUVWXYZ";
    if (opts.num) pool += "23456789";
    if (opts.sym) pool += "!@#$%^&*()-_=+[]{}";
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    setPw(Array.from(arr, (n) => pool[n % pool.length]).join(""));
    setCopied(false);
  };
  useEffect(gen, [len, opts]);
  const strength = useMemo(() => {
    let s = 0;
    if (len >= 12) s++; if (len >= 16) s++; if (opts.upper) s++; if (opts.num) s++; if (opts.sym) s++;
    return s;
  }, [len, opts]);
  const sLabel = ["很弱", "弱", "一般", "较强", "强", "极强"][strength];
  const sColor = ["#d95d39", "#d95d39", "#efa32c", "#8fc176", "#3e8e52", "#24513a"][strength];
  return (
    <div>
      <ToolHead title="密码生成器" sub="本地随机数生成，绝不上传。" />
      <div className="flex items-center gap-2 bg-mist/60 border border-ink/12 rounded-xl p-3 flex-wrap">
        <code className="flex-1 font-mono text-[15px] sm:text-[17px] break-all text-pine font-bold min-w-[150px]">{pw}</code>
        <button className="btn btn-sm shrink-0" onClick={() => { navigator.clipboard?.writeText(pw); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "✓ 已复制" : "复制"}</button>
        <button className="btn btn-primary btn-sm shrink-0" onClick={gen}>↻ 换一个</button>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-[12px] font-bold mb-1"><span className="text-moss">强度评级</span><span style={{ color: sColor }}>{sLabel}</span></div>
        <div className="h-2.5 rounded-full bg-mist overflow-hidden flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="flex-1 rounded-full transition-colors" style={{ background: i < strength ? sColor : "var(--color-mist)", animation: "growBar .5s ease both", transformOrigin: "left" }} />)}
        </div>
      </div>
      <div className="mt-4">
        <div className="text-[14px] font-bold text-ink">长度：{len} 位</div>
        <input type="range" min={6} max={32} value={len} onChange={(e) => setLen(Number(e.target.value))} className="w-full accent-[#3e8e52] mt-1" />
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {([["upper", "大写字母"], ["num", "数字"], ["sym", "符号"]] as const).map(([k, l]) => (
          <button key={k} className={`chip press !min-h-[44px] !px-4 ${opts[k] ? "chip-on" : ""}`} onClick={() => setOpts({ ...opts, [k]: !opts[k] })}>{opts[k] ? "✓ " : ""}{l}</button>
        ))}
      </div>
    </div>
  );
}

function CountdownTool() {
  const [target, setTarget] = useState(() => Date.now() + 10 * 60e3);
  const [label, setLabel] = useState("泡面好了");
  const [left, setLeft] = useState(target - Date.now());
  const toast = useGarden((s) => s.toast);
  useEffect(() => {
    const t = setInterval(() => {
      const l = target - Date.now();
      setLeft(l);
      if (l <= 0 && l > -1000) toast(`⏰ 「${label}」时间到！`);
    }, 250);
    return () => clearInterval(t);
  }, [target, label]);
  const presets: [string, number][] = [["5 分钟", 5], ["10 分钟", 10], ["30 分钟", 30], ["1 小时", 60]];
  const s = Math.max(0, Math.ceil(left / 1000));
  const hh = Math.floor(s / 3600), mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0"), ss = String(s % 60).padStart(2, "0");
  return (
    <div>
      <ToolHead title="倒计时" sub="设个目标时刻，到点提醒你。" />
      <input className="input" placeholder="倒计时做什么？" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={20} />
      <div className="flex flex-wrap gap-2 mt-3">
        {presets.map(([l, m]) => (
          <button key={l} className="chip press !min-h-[44px] !px-4" onClick={() => setTarget(Date.now() + m * 60e3)}>{l}</button>
        ))}
        <input type="datetime-local" className="input !w-auto !py-1 text-[13px]" onChange={(e) => e.target.value && setTarget(new Date(e.target.value).getTime())} />
      </div>
      <div className={`mt-5 text-center rounded-xl py-7 border-[1.5px] ${left <= 0 ? "bg-berry/10 border-berry/40" : "bg-mist/60 border-ink/10"}`}>
        <div className="font-display tabular leading-none text-ink" style={{ fontSize: "clamp(42px, 10vw, 76px)" }}>
          {hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`}
        </div>
        <div className="text-[13px] text-moss mt-2">{left <= 0 ? `⏰ ${label} · 时间到！` : `距离「${label}」还剩`}</div>
      </div>
    </div>
  );
}

function ColorTool() {
  const [hex, setHex] = useState("#3e8e52");
  const [copied, setCopied] = useState("");
  const { h, s, l } = useMemo(() => hexToHsl(hex), [hex]);
  const palette = useMemo(() => {
    const toHex2 = (hh: number, ss: number, ll: number) => hslToHex(((hh % 360) + 360) % 360, ss, ll);
    return [
      { name: "互补色", v: toHex2(h + 180, s, l) },
      { name: "类似色 −30°", v: toHex2(h - 30, s, l) },
      { name: "类似色 +30°", v: toHex2(h + 30, s, l) },
      { name: "三角色 +120°", v: toHex2(h + 120, s, l) },
      { name: "三角色 −120°", v: toHex2(h - 120, s, l) },
      { name: "加深", v: toHex2(h, s, Math.max(8, l - 18)) },
      { name: "提亮", v: toHex2(h, s, Math.min(94, l + 22)) },
    ];
  }, [h, s, l]);
  const copy = (v: string) => { navigator.clipboard?.writeText(v); setCopied(v); setTimeout(() => setCopied(""), 1200); };
  return (
    <div>
      <ToolHead title="取色器" sub="选一个主色，自动推导整套配色，点击色块复制。" />
      <div className="flex flex-wrap items-center gap-4">
        <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="w-[86px] h-[86px] rounded-xl border-[1.5px] border-ink/25 cursor-pointer bg-cream p-1.5" />
        <div>
          <button className="btn btn-sm" onClick={() => copy(hex)}>{copied === hex ? "✓ 已复制" : `复制 ${hex.toUpperCase()}`}</button>
          <div className="text-[12px] text-moss mt-2 font-mono">HSL({Math.round(h)}, {Math.round(s)}%, {Math.round(l)}%)</div>
        </div>
        <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setHex(hslToHex(Math.random() * 360, 45 + Math.random() * 40, 38 + Math.random() * 25))}>🎲 随机手气</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
        <button className="press rounded-xl h-[74px] border-[1.5px] border-ink/15 flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-white" style={{ background: hex }} onClick={() => copy(hex)}>
          主色<span className="font-mono opacity-90">{hex.toUpperCase()}</span>
        </button>
        {palette.map((p) => (
          <button key={p.name} className="press rounded-xl h-[74px] border-[1.5px] border-ink/15 flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-white" style={{ background: p.v, textShadow: "0 1px 3px rgba(0,0,0,.4)" }} onClick={() => copy(p.v)}>
            {p.name}<span className="font-mono opacity-90">{copied === p.v ? "✓ 已复制" : p.v.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
function hexToHsl(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g2 = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g2, b), min = Math.min(r, g2, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g2 - b) / d + (g2 < b ? 6 : 0)) * 60;
    else if (max === g2) h = ((b - r) / d + 2) * 60;
    else h = ((r - g2) / d + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}
function hslToHex(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

const QUOTES_DB: [string, string][] = [
  ["种下一棵树最好的时间是十年前，其次是现在。", "非洲谚语"],
  ["简单是可靠的先决条件。", "Edsger Dijkstra"],
  ["任何足够先进的技术，都与魔法无异。", "Arthur C. Clarke"],
  ["先可玩，再好玩，最后才是好看。", "游戏厅园规"],
  ["生活不是我们活过的日子，而是我们记住的日子。", "史铁生"],
  ["代码写出来是给人看的，附带能在机器上运行。", "Harold Abelson"],
  ["把每一天当作世界末日来过，总有一天你会是对的。", "Steve Jobs"],
  ["读书是在别人思想的帮助下，建立起自己的思想。", "鲁巴金"],
  ["千里之行，始于足下。", "老子"],
  ["好的软件，像好的酒，需要时间。", "园主随笔"],
  ["世界上只有一种英雄主义，就是看清生活后依然热爱它。", "罗曼·罗兰"],
  ["不要温和地走进那个良夜。", "Dylan Thomas"],
  ["学而不思则罔，思而不学则殆。", "孔子"],
  ["预测未来最好的方式，就是去创造它。", "Alan Kay"],
];
function QuoteTool() {
  const [i, setI] = useState(() => Math.floor(Math.random() * QUOTES_DB.length));
  const [flip, setFlip] = useState(0);
  const toast = useGarden((s) => s.toast);
  const next = () => { let n = i; while (n === i) n = Math.floor(Math.random() * QUOTES_DB.length); setI(n); setFlip((f) => f + 1); };
  const [q, by] = QUOTES_DB[i];
  return (
    <div>
      <ToolHead title="随机名言" sub="花园里收集的十四句话，摇一摇换一句。" />
      <div key={flip} className="anim-pop rounded-xl bg-pine text-paper p-7 sm:p-10 text-center relative overflow-hidden">
        <div className="absolute -left-2 -top-6 text-[90px] opacity-15 select-none">「</div>
        <p className="font-display text-[22px] sm:text-[27px] leading-relaxed">{q}</p>
        <p className="text-sprout text-[14px] mt-4 font-bold">—— {by}</p>
      </div>
      <div className="flex gap-2 mt-4">
        <button className="btn btn-primary flex-1" onClick={next}>🎲 换一句</button>
        <button className="btn flex-1" onClick={() => { navigator.clipboard?.writeText(`「${q}」—— ${by}`); toast("名言已复制"); }}>复制</button>
      </div>
    </div>
  );
}

function WeatherTool() {
  const [city, setCity] = useState("北京");
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const query = async (c: string) => {
    setLoading(true); setErr(""); setData(null);
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(c)}?format=j1&lang=zh`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { setErr("天气服务暂时连不上（需要联网），换个城市或稍后再试。"); }
    setLoading(false);
  };
  const cur = data?.current_condition?.[0];
  const days = data?.weather?.slice(0, 3) ?? [];
  return (
    <div>
      <ToolHead title="天气查询" sub="查全球城市实时天气与三日预报（数据来自 wttr.in）。" />
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="城市名，如：上海 / Tokyo" value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => e.key === "Enter" && query(city)} />
        <button className="btn btn-primary shrink-0" disabled={loading} onClick={() => query(city)}>{loading ? "查询中…" : "查询"}</button>
      </div>
      <div className="flex gap-2 mt-2.5 flex-wrap">
        {["北京", "上海", "广州", "成都", "杭州"].map((c) => <button key={c} className="chip press !min-h-[44px]" onClick={() => { setCity(c); query(c); }}>{c}</button>)}
      </div>
      {err && <div className="mt-4 rounded-xl bg-berry/10 border border-berry/40 p-4 text-[14px] text-berry font-bold">{err}</div>}
      {cur && (
        <div className="mt-5 anim-fadeup">
          <div className="rounded-xl bg-gradient-to-br from-lagoon to-pine text-paper p-6 flex flex-wrap items-center gap-6">
            <div>
              <div className="font-display text-[44px] leading-none">{cur.temp_C}°C</div>
              <div className="text-[14px] opacity-85 mt-1.5">{cur.lang_zh?.[0]?.value ?? cur.weatherDesc?.[0]?.value}</div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] ml-auto">
              <span>💧 湿度 {cur.humidity}%</span>
              <span>🌬 风速 {cur.windspeedKmph} km/h</span>
              <span>🌡 体感 {cur.FeelsLikeC}°C</span>
              <span>👁 能见度 {cur.visibility} km</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5 mt-3">
            {days.map((d: any, i: number) => (
              <div key={i} className="bg-mist/60 border border-ink/10 rounded-xl p-3 text-center">
                <div className="text-[12px] font-bold text-moss">{i === 0 ? "今天" : d.date.slice(5)}</div>
                <div className="text-[20px] my-1">{Number(d.hourly?.[4]?.chanceofrain ?? 0) > 50 ? "🌧" : Number(d.hourly?.[4]?.cloudcover ?? 0) > 60 ? "☁️" : "☀️"}</div>
                <div className="text-[13px] font-bold text-ink tabular">{d.mintempC}° / {d.maxtempC}°</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {!cur && !err && !loading && <div className="mt-6 text-center text-moss text-sm py-6">输入城市名，看看外面的天气 ⛅</div>}
    </div>
  );
}

function JsonTool() {
  const [src, setSrc] = useState('{\n  "name": "数字花园",\n  "games": 29,\n  "tags": ["博客", "游戏厅", "工具箱"]\n}');
  const [out, setOut] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState<null | boolean>(null);
  const fmt = (min = false) => {
    try {
      const v = JSON.parse(src);
      setOut(JSON.stringify(v, null, min ? 0 : 2));
      setErr(""); setOk(true);
    } catch (e: any) {
      setOk(false); setOut(""); setErr(e.message.replace(/^JSON\.parse:?\s*/i, ""));
    }
  };
  return (
    <div>
      <ToolHead title="JSON 格式化 / 校验" sub="本地解析，不上传。格式化、压缩、查错一步到位。" />
      <textarea className="input font-mono !text-[13px]" rows={7} value={src} onChange={(e) => { setSrc(e.target.value); setOk(null); setErr(""); }} spellCheck={false} />
      <div className="flex flex-wrap gap-2 mt-3">
        <button className="btn btn-primary btn-sm" onClick={() => fmt(false)}>格式化</button>
        <button className="btn btn-sm" onClick={() => fmt(true)}>压缩</button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(out || src)}>复制结果</button>
      </div>
      {err && <div className="mt-3 rounded-xl bg-berry/10 border border-berry/40 p-3 text-[13px] font-bold text-berry anim-shake">✗ {err}</div>}
      {ok && !err && <div className="mt-2 text-[13px] font-bold text-leaf">✓ 合法的 JSON</div>}
      {out && <pre className="mt-3 bg-[#1d3325] text-[#d9e8d2] rounded-xl p-4 text-[12.5px] overflow-x-auto max-h-[300px] font-mono">{out}</pre>}
    </div>
  );
}

function TimestampTool() {
  const [nowTs, setNowTs] = useState(Date.now());
  const [tsIn, setTsIn] = useState("");
  const [dateIn, setDateIn] = useState("");
  const [tsOut, setTsOut] = useState("");
  const [dateOut, setDateOut] = useState("");
  useEffect(() => { const t = setInterval(() => setNowTs(Date.now()), 1000); return () => clearInterval(t); }, []);
  const to13 = (v: string) => (v.length <= 10 ? Number(v) * 1000 : Number(v));
  return (
    <div>
      <ToolHead title="时间戳转换" sub="Unix 时间戳 ↔ 北京时间，秒 / 毫秒都认。" />
      <div className="rounded-xl bg-pine text-paper p-4 text-center">
        <div className="text-[12px] opacity-75">当前时间戳（毫秒）</div>
        <div className="font-display text-[26px] tabular">{nowTs}</div>
        <div className="text-[12px] opacity-75 mt-0.5">{new Date(nowTs).toLocaleString("zh-CN")}</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="text-[13px] font-bold text-moss">时间戳 → 日期</label>
          <input className="input mt-1 font-mono" placeholder="如 1735660800" value={tsIn} onChange={(e) => setTsIn(e.target.value)} />
          <button className="btn btn-primary btn-sm mt-2" onClick={() => { const n = to13(tsIn.trim()); setTsOut(Number.isFinite(n) && n > 0 ? new Date(n).toLocaleString("zh-CN") : "无效时间戳"); }}>转换 →</button>
          <div className="text-[14px] font-bold text-ink mt-2 min-h-[20px]">{tsOut}</div>
        </div>
        <div>
          <label className="text-[13px] font-bold text-moss">日期 → 时间戳</label>
          <input type="datetime-local" className="input mt-1" value={dateIn} onChange={(e) => setDateIn(e.target.value)} />
          <button className="btn btn-primary btn-sm mt-2" onClick={() => { const n = new Date(dateIn).getTime(); setDateOut(Number.isFinite(n) ? `${Math.floor(n / 1000)}（秒）/ ${n}（毫秒）` : "请选择日期"); }}>转换 →</button>
          <div className="text-[13px] font-bold text-ink mt-2 min-h-[20px] font-mono">{dateOut}</div>
        </div>
      </div>
    </div>
  );
}

function WheelTool() {
  const [names, setNames] = useState("火锅\n烧烤\n日料\n轻食\n螺蛳粉\n随便吃吃");
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState("");
  const list = names.split("\n").map((s) => s.trim()).filter(Boolean);
  const spin = () => {
    if (spinning || list.length < 2) return;
    setSpinning(true); setResult("");
    const turns = 5 + Math.random() * 3;
    const target = rot + turns * 360 + Math.random() * 360;
    setRot(target);
    setTimeout(() => {
      const deg = ((target % 360) + 360) % 360;
      const idx = Math.floor(((360 - deg) % 360) / (360 / list.length));
      setResult(list[idx % list.length]);
      setSpinning(false);
    }, 3200);
  };
  const colors = ["#d95d39", "#efa32c", "#3e8e52", "#2e8f83", "#6f9fd8", "#b78ed9", "#e07a5f", "#8fc176"];
  const seg = 360 / Math.max(list.length, 1);
  return (
    <div>
      <ToolHead title="幸运转盘" sub="纠结的时候交给命运。每行一个选项。" />
      <div className="grid sm:grid-cols-[280px_1fr] gap-6 items-start">
        <div className="relative w-[240px] h-[240px] mx-auto">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 text-[26px]">▼</div>
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-lg" style={{ transform: `rotate(${rot}deg)`, transition: spinning ? "transform 3.1s cubic-bezier(.15,.85,.25,1)" : "none" }}>
            {list.map((_, i) => {
              const a0 = (i * seg - 90) * (Math.PI / 180), a1 = ((i + 1) * seg - 90) * (Math.PI / 180);
              const x0 = 100 + 96 * Math.cos(a0), y0 = 100 + 96 * Math.sin(a0);
              const x1 = 100 + 96 * Math.cos(a1), y1 = 100 + 96 * Math.sin(a1);
              return <path key={i} d={`M100,100 L${x0},${y0} A96,96 0 ${seg > 180 ? 1 : 0},1 ${x1},${y1} Z`} fill={colors[i % colors.length]} stroke="#f3f5ea" strokeWidth="2" />;
            })}
            <circle cx="100" cy="100" r="16" fill="#1e3325" />
          </svg>
        </div>
        <div>
          <textarea className="input" rows={6} value={names} onChange={(e) => setNames(e.target.value)} placeholder="每行一个选项" />
          <div className="flex items-center gap-3 mt-3">
            <button className="btn btn-berry flex-1" disabled={spinning || list.length < 2} onClick={spin}>{spinning ? "转动中…" : "🎡 转！"}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setRot(0); setResult(""); }}>重置</button>
          </div>
          {result && <div className="mt-4 text-center anim-pop"><div className="text-[13px] text-moss">命运的选择是</div><div className="font-display text-[30px] text-berry">{result}</div></div>}
          {list.length < 2 && <div className="text-[12px] text-berry font-bold mt-2">至少填 2 个选项才能转</div>}
        </div>
      </div>
    </div>
  );
}
