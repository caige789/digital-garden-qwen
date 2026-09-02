import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useGarden, THEMES } from "../lib/store";
import * as api from "../lib/api";
import { Sprout } from "./ui";
import { sfx } from "../game/engine";

const pageKeyOf = (path: string) => {
  if (path === "/") return "home";
  if (path.startsWith("/blog")) return "blog";
  if (path.startsWith("/game")) return "games";
  if (path.startsWith("/tools")) return "tools";
  if (path.startsWith("/board")) return "board";
  if (path.startsWith("/ranks")) return "ranks";
  if (path.startsWith("/me")) return "me";
  return null;
};

const ic = (d: string) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

/* Toast 视图：游戏页与普通页共用 */
export function ToastView({ toasts, closeToast }: { toasts: { id: number; text: string; kind: "ok" | "info" | "err" }[]; closeToast: (id: number) => void }) {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-8 z-[70] flex flex-col gap-2 items-center pointer-events-none px-4 w-full max-w-sm">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => closeToast(t.id)}
          className="pointer-events-auto w-full text-left px-4 py-3 rounded-xl border-[1.5px] text-sm font-bold shadow-[4px_4px_0_var(--shadow-soft)]"
          style={{
            background: t.kind === "err" ? "color-mix(in srgb, var(--color-berry) 12%, var(--color-cream))" : "color-mix(in srgb, var(--color-leaf) 12%, var(--color-cream))",
            borderColor: t.kind === "err" ? "var(--color-berry)" : "var(--color-leaf)",
            color: "var(--color-ink)",
            animation: "toastIn .3s ease both",
          }}
        >
          {t.kind === "err" ? "⚠️ " : t.kind === "info" ? "💡 " : "✅ "}
          {t.text}
        </button>
      ))}
    </div>
  );
}

/* 成就解锁弹窗视图：游戏页与普通页共用 */
export function AchQueueView({ achQueue, popAch }: { achQueue: { icon: string; name: string; description: string }[]; popAch: () => void }) {
  if (!achQueue.length) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-ink/55 flex items-center justify-center p-6" onClick={popAch}>
      <div className="card w-full max-w-xs p-6 text-center anim-pop" onClick={(e) => e.stopPropagation()}>
        <div className="text-[11px] font-black tracking-[0.3em] text-berry">成就解锁</div>
        <div className="text-6xl mt-3" style={{ animation: "pulseSoft 1.6s ease-in-out infinite" }}>{achQueue[0].icon}</div>
        <h3 className="font-display text-2xl mt-2 text-ink">{achQueue[0].name}</h3>
        <p className="text-sm text-moss mt-1">{achQueue[0].description}</p>
        <button className="btn btn-gold w-full mt-5" onClick={() => { sfx.coin(); popAch(); }}>收下勋章！</button>
        {achQueue.length > 1 && <div className="text-xs text-moss mt-2">还有 {achQueue.length - 1} 个成就排队中…</div>}
      </div>
    </div>
  );
}

function NavItem({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 min-w-[56px] py-1.5 rounded-xl text-[11px] font-bold transition-all press ${
          isActive ? "text-pine bg-mist scale-105" : "text-moss/80"
        }`
      }
    >
      <span className="w-6 h-6 flex items-center justify-center">{icon}</span>
      {label}
    </NavLink>
  );
}

function ThemeSwitcher() {
  const { theme, setTheme } = useGarden();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="flex items-center justify-center w-[44px] h-[44px] rounded-full border-[1.5px] border-ink/20 bg-cream press hover:border-ink/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-label="切换主题色"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pine">
          <path d="M12 21a9 9 0 1 1 9-9c0 2.2-1.8 3-3.5 3H15a2.5 2.5 0 0 0-1.8 4.2c.5.6.3 1.8-.7 1.8Z" />
          <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
          <circle cx="12" cy="7.5" r="1" fill="currentColor" />
          <circle cx="16.5" cy="10.5" r="1" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[50px] z-50 card p-3 w-[188px] anim-pop">
            <div className="text-[11px] font-black tracking-[0.18em] text-moss px-1 pb-2">主题色调</div>
            <div className="grid grid-cols-1 gap-1">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-bold text-ink hover:bg-mist transition-colors press"
                  onClick={() => { setTheme(t.id); setOpen(false); sfx.click(); }}
                >
                  <span className="w-4 h-4 rounded-full border border-ink/20 shrink-0" style={{ background: t.dot }} />
                  {t.name}
                  {theme === t.id && <span className="ml-auto text-leaf">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Layout() {
  const loc = useLocation();
  const { user, booted, toasts, closeToast, achQueue, popAch, updateReady, config } = useGarden();

  useEffect(() => {
    window.scrollTo({ top: 0 });
    const key = pageKeyOf(loc.pathname);
    if (key) api.trackPage(key).catch(() => {});
  }, [loc.pathname]);

  // 游戏页（/game/xxx）全屏渲染：不带顶栏/页脚/底部菜单，避免遮挡游戏操作按钮
  const isGamePage = loc.pathname.startsWith("/game/");
  if (isGamePage) {
    return (
      <div className="min-h-screen dvh">
        <Outlet />
        {/* 成就解锁弹窗在-game 页也需要（提交分数后触发） */}
        {achQueue.length > 0 && <AchQueueView achQueue={achQueue} popAch={popAch} />}
        <ToastView toasts={toasts} closeToast={closeToast} />
      </div>
    );
  }

  const desktopNav = [
    { to: "/", label: "首页" },
    { to: "/blog", label: "博客" },
    { to: "/games", label: "游戏厅" },
    { to: "/tools", label: "工具箱" },
    { to: "/board", label: "留言板" },
    { to: "/ranks", label: "排行榜" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 pt-safe bg-paper/90 backdrop-blur border-b-[1.5px] border-ink/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 press shrink-0">
            <Sprout size={30} />
            <span className="font-display text-xl text-pine whitespace-nowrap">{config.siteTitle || "数字花园"}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 mx-auto">
            {desktopNav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  `px-3.5 py-2 rounded-full text-sm font-bold transition-all ${
                    isActive ? "bg-pine text-paper shadow-[2px_2px_0_var(--shadow-soft)]" : "text-moss hover:bg-mist hover:text-ink"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 ml-auto md:ml-0">
            <ThemeSwitcher />
            {user?.role === "admin" && (
              <Link to="/admin" className="chip press hidden sm:inline-flex !text-berry !border-berry/40">🛠 后台</Link>
            )}
            <Link to="/me" className="flex items-center gap-2 pl-1.5 pr-3 min-h-[44px] rounded-full border-[1.5px] border-ink/20 bg-cream press hover:border-ink/40 transition-colors">
              <span className="w-7 h-7 rounded-full bg-mist flex items-center justify-center text-[15px]">{user?.avatar ?? "🌰"}</span>
              <span className="text-sm font-bold text-ink max-w-[80px] truncate">{user ? user.nickname : "登录"}</span>
            </Link>
          </div>
        </div>
      </header>

      {updateReady && (
        <div className="bg-pine text-paper text-center text-sm py-2 px-4 flex items-center justify-center gap-3">
          <span>🌱 花园长出了新版本</span>
          <button className="btn btn-gold btn-sm" onClick={() => navigator.serviceWorker?.getRegistration().then((r) => r?.waiting?.postMessage({ type: "SKIP_WAITING" }))}>
            立即刷新
          </button>
        </div>
      )}

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-5 pb-28 md:pb-10">
        <div key={loc.pathname} className="page-anim">
          <Outlet />
        </div>
      </main>

      <footer className="hidden md:block border-t-[1.5px] border-ink/10 bg-mist/40">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-moss">
          <span className="flex items-center gap-2 font-bold text-pine"><Sprout size={20} /> 数字花园</span>
          <span>{config.siteDesc || ""}</span>
          <span className="ml-auto flex gap-4">
            <Link className="hover:text-ink font-bold" to="/me">个人中心</Link>
            <Link className="hover:text-ink font-bold" to="/ranks">排行榜</Link>
            <Link className="hover:text-ink font-bold" to="/admin">管理后台</Link>
          </span>
          <span className="w-full text-xs opacity-70">© {new Date().getFullYear()} 数字花园 · 支持安装到手机主屏幕（PWA）· 数据保存在本地数据库</span>
        </div>
      </footer>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-cream/95 backdrop-blur border-t-[1.5px] border-ink/12 pb-safe">
        <div className="flex items-stretch justify-around px-1 pt-1">
          <NavItem to="/" label="首页" icon={ic("M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5")} />
          <NavItem to="/blog" label="博客" icon={ic("M4 4h16v16H4zM8 8h8M8 12h8M8 16h5")} />
          <NavItem to="/games" label="游戏" icon={ic("M6 12h4M8 10v4M15 11h.01M18 13h.01M17.3 5H6.7a4.7 4.7 0 0 0-4.6 5.6l.8 4A3 3 0 0 0 8 17l1.2-1.5h5.6L16 17a3 3 0 0 0 5.1-2.4l.8-4A4.7 4.7 0 0 0 17.3 5Z")} />
          <NavItem to="/tools" label="工具" icon={ic("M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7Z")} />
          <NavItem to="/me" label="我的" icon={ic("M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0")} />
        </div>
      </nav>

      <ToastView toasts={toasts} closeToast={closeToast} />
      <AchQueueView achQueue={achQueue} popAch={popAch} />

      {!booted && (
        <div className="fixed inset-0 z-[90] bg-paper flex flex-col items-center justify-center gap-4">
          <div style={{ animation: "sway 1.4s ease-in-out infinite" }}><Sprout size={64} /></div>
          <div className="font-display text-xl text-pine">花园开门中…</div>
        </div>
      )}
    </div>
  );
}
