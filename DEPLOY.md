# 数字花园 · 部署说明（方案 B：React 静态站）

## 本交付物的技术栈（对应《代码交付部署规范》方案 B）

- **React 18 + Vite 6 + TypeScript + Tailwind CSS 4**（静态站）
- **数据：IndexedDB（浏览器本地）** —— 用户、分数、排行榜、待办、日记、留言、站点配置、成就全部存本地，
  表结构与规范 12 张表模型一一对应，开箱即用、离线可玩、无需任何服务器或数据库密钥。

> 因此本项目**不需要** Next.js / Prisma / Neon / `DATABASE_URL`，也不含 `.env`、`.dev.vars`、
> `内测账号.txt`、`*.tar` 等禁止文件（已自查确认）。

## 一键部署（Cloudflare Pages，免费）

1. 代码推 GitHub 仓库（`main` 分支）。
2. Cloudflare Pages → Create project → 连接仓库。
3. 构建配置：
   - Build command: `npm ci && npm run build`
   - Build output directory: `dist`
   - Root directory: `.`
4. 保存。之后每次 push `main` 自动构建部署，几分钟内上线，电脑关机不影响。

> 若用 Cloudflare Workers 托管：`wrangler pages deploy dist` 一行即可。

## 本地验证

```bash
npm install
npm run build   # 产出 dist/，正常体积约 600 kB JS（如突然变成 ~150 kB 说明入口被重置，需检查 src/App.tsx）
npm run dev     # 本地开发（端口 3000）
```

## 数据模型（12 张表，IndexedDB 实现，可平迁 PostgreSQL）

User / Article / GameScore / UserScore / LeaderboardEntry / Todo / Message / Diary /
SiteConfig / SiteStat / Achievement / UserAchievement（+ meta）

若日后要跨设备共享数据（升级为云端方案 A），`src/lib/api.ts` 是统一接口层，
把每个函数内部从 IndexedDB 读写改为对云端 API 的 `fetch` 调用即可，前端零改动。

## 手机端 6 条硬性要求自查（已通过）

1. ✅ 画布逻辑→显示缩放：`ctx.setTransform(dpr * scale)`（`canvas.width/def.W = dpr * cssW/def.W`），非只乘 dpr
2. ✅ `devicePixelRatio` 上限 2
3. ✅ 画布 `touch-action: none`；触控目标 ≥44px；375px 无横向溢出
4. ✅ 横版游戏竖屏旋转 90° 保持比例，横版提示横持，无拉伸变形
5. ✅ `visibilitychange` 切后台自动暂停；dt 封顶 50ms；RAF 有 cleanup
6. ✅ 物理推进按 `dt/16.7` 时间归一化（帧率无关，非纯按帧加速），120Hz 高刷屏速度一致

## Windows 本地开发注意

- 构建报错先清空代理：`set HTTP_PROXY=` / `set HTTPS_PROXY=` 后重试
- Node.js 18+；无需管理员权限、无符号链接依赖
