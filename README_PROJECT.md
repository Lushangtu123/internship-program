# Short-Video Feed UI — 项目说明

短视频「为你推荐」信息流网页应用：垂直全屏滚动、视口自动播放、微交互、键盘无障碍、评论抽屉，以及轻量 QoE 监控。

> 演示目标：流畅滑动、字幕切换、评论抽屉、点赞动画、键盘导航。

主入口文档见 [README.md](./README.md)。本文补充设计细节与实现要点。

---

## 功能特性

- **垂直信息流**（每视口一个视频）+ **无限滚动**（游标分页）
- **自动播放**：约 ≥70% 可见时播放，离开视口暂停；预加载相邻视频
- **叠加 UI**：创作者信息、标题、话题、音乐标签、点赞 / 评论 / 分享 / 收藏
- **评论抽屉**（移动端底部、桌面端侧栏）+ 乐观更新
- **双击点赞**动画、**键盘快捷键**（含空格播放 / 暂停）
- **字幕开关**、全局静音
- **无障碍**：键盘遍历、ARIA、尊重 `prefers-reduced-motion`
- **调试面板**（`?debug=1`）：QoE + 交互计数

> 说明：进度条、长按保存、举报菜单、高对比度主题、HLS（`hls.js`）等在早期设计中提及，当前仓库尚未实现。

---

## 技术栈

- **框架:** Next.js 14（App Router）+ TypeScript
- **UI:** Tailwind CSS + shadcn/ui 风格组件（`components/ui`）
- **状态 / 数据:** Zustand（UI）、TanStack React Query（服务端）
- **视频:** 原生 `<video>` + `IntersectionObserver`
- **测试:** Vitest、Playwright
- **性能 / CI:** Lighthouse CI（`npm run lhci`）
- **分析:** 自定义 QoE 日志（内存 / 控制台，可 POST `/api/telemetry`）

---

## 快速开始

### 前置要求

- Node.js ≥ 18
- npm 或 pnpm

### 安装与开发

```bash
npm install
npm run dev
# 访问 http://localhost:3000
# 调试: http://localhost:3000?debug=1
```

### 构建

```bash
npm run build && npm run start
```

### 测试与检查

```bash
npm run test
npx playwright install   # 首次
npm run e2e
npm run lint && npm run typecheck
npm run lhci
```

脚本名以 `package.json` 为准：`test`、`e2e`、`lhci`（不是 `test:e2e` / `lighthouse`）。

---

## 键盘快捷键

| 按键 | 操作 |
| --- | --- |
| **J / ↓** | 下一个视频 |
| **K / ↑** | 上一个视频 |
| **Space** | 播放 / 暂停 |
| **M** | 静音 / 取消静音 |
| **C** | 切换字幕 |
| **/** | 聚焦评论输入框 |

---

## 项目结构

```
app/
  page.tsx                    # 主信息流（首页）
  (feed)/page.tsx             # 路由组内同构页面
  api/
    videos/route.ts           # GET /api/videos?cursor&limit
    videos/[id]/like/route.ts
    videos/[id]/comments/route.ts
    telemetry/route.ts        # POST /api/telemetry
components/
  VideoCard.tsx
  ActionsBar.tsx
  CommentsDrawer.tsx
  CaptionBadge.tsx
  DebugPanel.tsx
  ui/
lib/
  useAutoplay.ts
  usePrefetch.ts
  qoe.ts
  keyboard.ts
  api.ts
  store.ts
  utils.ts
public/
  mock/seed.json
  posters/                    # 本地海报（可选）
  avatars/
  captions/                   # .vtt（可选）
```

---

## 性能目标

- **TTI ≤ 1.5s**（3G Fast，中端设备）
- **CLS ≤ 0.02**
- **视频首帧 ≤ 250ms**（进入视口后，配合预加载）
- 初始路由 JS **< 200KB**（gzip，见 `.lighthouserc.json`）

请用 `npm run lhci` 实测，勿将未复测的分数写死为「当前成绩」。

---

## 无障碍

- 完整键盘操作与可见焦点
- 按钮 / 抽屉等 ARIA 标签
- `prefers-reduced-motion` 降级动画
- `<track kind="captions">` 字幕（需提供 `.vtt` 且 seed 中配置路径）

---

## QoE 与遥测

会话内收集（内存 / 控制台，并可上报）：

- `ttff`（首帧时间）
- `stallCount`、`stallDurationMs`
- `framesDropped`
- `scrollNext`、`scrollPrev`
- `likeTapped`、`commentOpened`、`captionToggled`

`?debug=1` 打开调试叠加层。

---

## 实现要点

- **自动播放:** `IntersectionObserver`，threshold `0.7`；离开视口暂停；相邻预加载
- **手动暂停:** `useRef` 记录用户暂停，避免与自动播放竞态
- **预加载:** `usePrefetch` 预热相邻项
- **乐观点赞 / 评论:** 先更新本地 UI，失败时回滚
- **状态:** UI → Zustand；列表 / 评论 → React Query（按视频 ID 缓存）

---

## 环境与内容

- 可选: `NEXT_PUBLIC_CDN_ORIGIN`
- 内容源: `public/mock/seed.json`
- `posters/`、`avatars/`、`captions/` 当前多为占位目录；seed 中引用的本地资源需自行补齐，否则回退到远程视频 URL

---

## 文档

- [README.md](./README.md) — 总览与快速开始
- [QUICKSTART.md](./QUICKSTART.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- [COMMENT_GUIDE.md](./COMMENT_GUIDE.md)
- [PAUSE_FEATURE_GUIDE.md](./PAUSE_FEATURE_GUIDE.md)
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)

---

## 许可证

MIT

## 致谢

用于教育与展示。示例视频来自公开资源（如 Google sample bucket）。
