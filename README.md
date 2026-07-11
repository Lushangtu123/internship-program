# Short Video Feed — TikTok-style Web App

一个高性能的短视频「为你推荐」信息流 Web 应用：垂直全屏滚动、视口自动播放、双击点赞、评论抽屉、键盘快捷键，以及轻量 QoE 监控。

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwind-css)

## 功能特性

### 核心体验
- **垂直信息流** — 每屏一个视频，无限滚动（游标分页）
- **自动播放 / 暂停** — `IntersectionObserver`（约 70% 可见时播放）
- **手动播放 / 暂停** — 单击视频或空格键切换
- **双击点赞** — TikTok 风格动画 + 乐观更新
- **评论抽屉** — 移动端底部抽屉 / 桌面端侧栏，支持发送与乐观追加
- **分享** — Web Share API（不支持时回退）
- **收藏** — 本地 UI 切换
- **音量控制** — 全局静音 / 取消静音
- **字幕开关** — 可选 `<track>` 字幕显示
- **调试面板** — 访问 `/?debug=1` 查看 QoE 指标

### 键盘快捷键

| 按键 | 操作 |
|------|------|
| `J` / `↓` | 下一个视频 |
| `K` / `↑` | 上一个视频 |
| `Space` | 播放 / 暂停 |
| `M` | 静音 / 取消静音 |
| `C` | 开关字幕 |
| `/` | 聚焦评论输入框 |

### 性能与体验
- 相邻视频预加载（`usePrefetch`）
- IntersectionObserver 防抖，减少误触发
- 点赞 / 评论乐观 UI
- QoE：首帧时间（TTFF）、卡顿次数与时长等（可上报 `/api/telemetry`）

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Next.js 14（App Router）+ TypeScript |
| UI | Tailwind CSS + shadcn/ui 风格组件 |
| 状态 | Zustand（UI）+ TanStack React Query（服务端数据） |
| 测试 | Vitest（单元）+ Playwright（E2E） |
| 性能 | Lighthouse CI（`lhci`） |

## 快速开始

### 前置要求

- Node.js ≥ 18
- npm（或 pnpm / yarn）

### 安装与开发

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

调试面板：[http://localhost:3000?debug=1](http://localhost:3000?debug=1)

### 构建与生产

```bash
npm run build
npm run start
```

### 测试与检查

```bash
# 单元测试
npm run test

# E2E（首次需安装浏览器）
npx playwright install
npm run e2e

# 类型检查 / Lint
npm run typecheck
npm run lint

# Lighthouse CI
npm run lhci
```

## 项目结构

```
internship-program/
├── app/
│   ├── (feed)/              # 信息流路由组
│   ├── api/
│   │   ├── videos/          # 列表 / 点赞 / 评论
│   │   └── telemetry/       # QoE 上报
│   ├── page.tsx             # 首页（信息流）
│   ├── layout.tsx
│   └── providers.tsx
├── components/
│   ├── VideoCard.tsx
│   ├── ActionsBar.tsx
│   ├── CommentsDrawer.tsx
│   ├── CaptionBadge.tsx
│   ├── DebugPanel.tsx
│   └── ui/                  # button / input / scroll-area
├── lib/
│   ├── useAutoplay.ts
│   ├── usePrefetch.ts
│   ├── keyboard.ts
│   ├── qoe.ts
│   ├── store.ts
│   ├── api.ts
│   └── utils.ts
├── types/
├── public/mock/seed.json    # Mock 视频与评论数据
├── __tests__/
└── e2e/
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/videos?limit=5&cursor=` | 视频列表（游标分页） |
| `POST` | `/api/videos/:id/like` | 点赞 |
| `GET` | `/api/videos/:id/comments` | 获取评论 |
| `POST` | `/api/videos/:id/comments` | 发布评论 |
| `POST` | `/api/telemetry` | QoE 遥测上报 |

当前 API 为 Mock 实现；内容可在 `public/mock/seed.json` 中修改。视频源使用公开示例地址。

## 配置说明

- 可选环境变量：`NEXT_PUBLIC_CDN_ORIGIN`（从 CDN 提供视频 / 海报时）
- `public/posters/`、`public/avatars/`、`public/captions/` 可放置本地海报、头像与 `.vtt` 字幕
- `seed.json` 中的 `poster` / `avatar` / `captionsVtt` 需与上述路径对应

## 性能目标

| 指标 | 目标 |
|------|------|
| TTI | ≤ 1.5s（3G Fast / 中端设备） |
| CLS | ≤ 0.02 |
| 视频首帧（进入视口后） | ≤ 250ms（配合预加载） |
| 初始路由 JS | < 200KB（gzip，见 Lighthouse CI 预算） |

本地可用 `npm run lhci` 对照 `.lighthouserc.json` 中的断言。

## 无障碍

- 键盘可完整操作（快捷键 + 可见焦点）
- 关键控件带 ARIA 标签
- 尊重 `prefers-reduced-motion`
- 字幕通过 `<track kind="captions">` 支持

## 文档索引

| 文档 | 用途 |
|------|------|
| [QUICKSTART.md](./QUICKSTART.md) | 快速上手 |
| [README_PROJECT.md](./README_PROJECT.md) | 更完整的设计与实现说明 |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | 故障排查 |
| [COMMENT_GUIDE.md](./COMMENT_GUIDE.md) | 评论功能 |
| [PAUSE_FEATURE_GUIDE.md](./PAUSE_FEATURE_GUIDE.md) | 暂停 / 播放交互 |
| [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | 功能完成摘要与后续建议 |

## 许可证

MIT License
