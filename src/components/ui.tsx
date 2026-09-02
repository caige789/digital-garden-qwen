import React, { useEffect, useRef, useState } from "react";

/* 园标：新芽 */
export function Sprout({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M24 42V24" stroke="#7a5c3a" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M24 26c0-8-6-13-15-13 0 9 6 13 15 13Z" fill="#3e8e52" />
      <path d="M24 22c0-7 5-11 13-11 0 8-5 11-13 11Z" fill="#7cb356" />
      <ellipse cx="24" cy="42" rx="9" ry="3" fill="rgba(30,51,37,.18)" />
    </svg>
  );
}

export function PageHero({ emoji, title, sub, tone }: { emoji: string; title: string; sub: string; tone: string }) {
  return (
    <header className="mb-6 anim-fadeup">
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-[1.5px] border-ink/15 flex items-center justify-center text-[26px] sm:text-[30px] shrink-0 card" style={{ background: `color-mix(in srgb, ${tone} 14%, var(--color-cream))` }}>
          {emoji}
        </span>
        <div>
          <h1 className="font-display text-[26px] sm:text-[34px] leading-none text-ink">{title}</h1>
          <p className="text-[13px] sm:text-[14px] text-moss mt-1.5">{sub}</p>
        </div>
      </div>
      <span className="head-rule" style={{ background: `linear-gradient(90deg, ${tone}, var(--color-marigold))` }} aria-hidden />
    </header>
  );
}

export function SectionHead({ kicker, title, extra }: { kicker: string; title: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div>
        <div className="text-[11px] font-black tracking-[0.24em] text-berry uppercase">{kicker}</div>
        <h2 className="font-display text-[24px] sm:text-[30px] leading-tight text-ink mt-0.5">{title}</h2>
        <span className="head-rule" aria-hidden />
      </div>
      {extra}
    </div>
  );
}

/* 滚动浮现 */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (ents) => ents.forEach((e) => { if (e.isIntersecting) { el.classList.add("on"); io.disconnect(); } }),
      { threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function CountUp({ to, duration = 900 }: { to: number; duration?: number }) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const step = (t: number) => {
            const p = Math.min(1, (t - t0) / duration);
            setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          io.disconnect();
        }
      });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);
  return <span ref={ref} className="tabular">{v.toLocaleString()}</span>;
}

export function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60e3) return "刚刚";
  if (d < 3600e3) return `${Math.floor(d / 60e3)} 分钟前`;
  if (d < 86400e3) return `${Math.floor(d / 3600e3)} 小时前`;
  if (d < 7 * 86400e3) return `${Math.floor(d / 86400e3)} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

/* 飘落树叶（环境元素，尊重减弱动态设置） */
export function LeafFall({ count = 6 }: { count?: number }) {
  const leaves = useRef(
    Array.from({ length: count }, (_, i) => ({
      left: `${(i * 17 + 7) % 100}%`,
      dur: 13 + (i % 5) * 3,
      delay: i * 2.7,
      drift: ((i % 2 ? 1 : -1) * (30 + i * 8)) + "px",
      emoji: ["🍃", "🌿", "🍂"][i % 3],
      size: 14 + (i % 3) * 5,
    }))
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {leaves.current.map((l, i) => (
        <span
          key={i}
          className="leaf-fall"
          style={{ left: l.left, fontSize: l.size, ["--dur" as any]: `${l.dur}s`, ["--delay" as any]: `${l.delay}s`, ["--drift" as any]: l.drift }}
        >
          {l.emoji}
        </span>
      ))}
    </div>
  );
}
