import React, { lazy, Suspense, useEffect } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { useGarden } from "./lib/store";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import { Sprout } from "./components/ui";

/* 除首页外全部按需加载：首屏只含 Home + Layout，JS gzip < 100KB */
/* lazySafe：12 秒超时 + 失败兜底页，杜绝"一直加载" */
function LoadFail() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-6">
      <div className="text-5xl">🥀</div>
      <div className="font-display text-xl text-ink">这一页没加载出来</div>
      <p className="text-sm text-moss max-w-xs leading-relaxed">可能是网络波动，或浏览器缓存了旧版本资源。点下方按钮清缓存重试。</p>
      <button
        className="btn btn-primary"
        onClick={() => { try { caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))); } catch { /* ignore */ } location.reload(); }}
      >🔄 清缓存并重新加载</button>
    </div>
  );
}
function lazySafe<T extends React.ComponentType<any>>(loader: () => Promise<{ default: T }>) {
  return lazy(() =>
    Promise.race<{ default: T }>([
      loader(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("chunk timeout")), 12000)),
    ]).catch(() => ({ default: LoadFail as unknown as T }))
  );
}
const GamesPage = lazySafe(() => import("./pages/Games").then((m) => ({ default: m.GamesPage })));
const GamePlayPage = lazySafe(() => import("./pages/Games").then((m) => ({ default: m.GamePlayPage })));
const BlogPage = lazySafe(() => import("./pages/Blog").then((m) => ({ default: m.BlogPage })));
const BlogPostPage = lazySafe(() => import("./pages/Blog").then((m) => ({ default: m.BlogPostPage })));
const Tools = lazySafe(() => import("./pages/Tools"));
const Admin = lazySafe(() => import("./pages/Admin"));
const Board = lazySafe(() => import("./pages/Board"));
const Ranks = lazySafe(() => import("./pages/Ranks"));
const Me = lazySafe(() => import("./pages/Me"));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div style={{ animation: "sway 1.4s ease-in-out infinite" }}>
        <Sprout size={46} />
      </div>
      <div className="text-sm font-bold text-moss">正在翻开这一页…</div>
    </div>
  );
}

/* 全局错误兜底：任何渲染错误都不会白屏，而是显示友好提示 + 重载 */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: string }> {
  state = { err: "" };
  static getDerivedStateFromError(e: unknown) { return { err: String((e as Error)?.message ?? e) }; }
  componentDidCatch(e: unknown) { console.error("[garden] render error:", e); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-paper, #f3f5ea)" }}>
        <div className="card p-8 max-w-sm w-full text-center">
          <div className="text-5xl">🥀</div>
          <h1 className="font-display text-2xl mt-3" style={{ color: "var(--color-ink, #1e3325)" }}>花园出了点小状况</h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--color-moss, #47604f)" }}>
            页面渲染时遇到错误。先试试刷新；如果反复出现，请清除浏览器缓存后再打开。
          </p>
          <p className="text-[11px] mt-2 font-mono opacity-60 break-all">{this.state.err.slice(0, 120)}</p>
          <button className="btn btn-primary w-full mt-5" onClick={() => location.reload()}>🌱 重新加载花园</button>
        </div>
      </div>
    );
  }
}

export default function App() {
  const boot = useGarden((s) => s.boot);
  useEffect(() => { boot(); }, [boot]);

  return (
    <ErrorBoundary>
    <HashRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:id" element={<BlogPostPage />} />
            <Route path="/games" element={<GamesPage />} />
            <Route path="/game/:id" element={<GamePlayPage />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/board" element={<Board />} />
            <Route path="/ranks" element={<Ranks />} />
            <Route path="/me" element={<Me />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
    </ErrorBoundary>
  );
}
