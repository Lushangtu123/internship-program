# Short-Video Feed UI (TikTok-style) — 项目说明

一个精心打造的短视频"为你推荐"信息流网页克隆，展现前端技术：流畅的滚动自动播放/暂停、精致的微交互、无障碍控制、实时评论抽屉，以及性能和QoE监控。

> 60-90秒演示目标：完美的滑动/滚动体验、零卡顿、字幕切换、评论抽屉、点赞动画、键盘导航。

---

## ✨ 功能特性

- **垂直信息流**（每个视口一个视频）配合**无限滚动**（游标分页）
- **自动播放**：当视频≥70%可见时播放，离开视口时暂停；预加载前后视频源
- **叠加UI**：创作者信息、标题、话题标签、音乐标签、点赞/评论/分享
- **评论抽屉**（移动端底部抽屉，桌面端侧边栏）配合乐观更新
- **双击点赞**动画、长按保存、**键盘快捷键**（J/K 上下切换、M 静音）
- **字幕开关**、音量/静音、进度条、举报菜单（仅UI）
- **无障碍**：焦点管理、ARIA、高对比度、支持`prefers-reduced-motion`
- **调试面板**（通过`?debug=1`切换）：QoE + 性能计数器

---

## 🗺️ 技术栈

- **框架:** Next.js (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **状态/数据:** Zustand (全局UI状态), React Query (服务器数据)
- **视频:** `<video>` + `IntersectionObserver` (或使用HLS时的`hls.js`)
- **测试:** Vitest (单元测试), Playwright (E2E测试)
- **性能/CI:** Lighthouse CI 配合性能预算
- **分析:** 轻量级 QoE 日志记录器（自定义）

---

## 🚀 快速开始

### 前置要求

- Node ≥ 18, pnpm 或 npm

### 安装依赖

\`\`\`bash
pnpm install
# 或
npm install
\`\`\`

### 开发环境

\`\`\`bash
pnpm dev
# 访问 http://localhost:3000
\`\`\`

### 构建和启动

\`\`\`bash
pnpm build && pnpm start
\`\`\`

### 运行测试

\`\`\`bash
# 单元测试
pnpm test

# E2E测试（有界面）
pnpm e2e -- --headed

# E2E测试（CI模式）
pnpm e2e
\`\`\`

### 代码检查和类型检查

\`\`\`bash
pnpm lint && pnpm typecheck
\`\`\`

### Lighthouse CI

\`\`\`bash
pnpm lhci
\`\`\`

---

## ⌨️ 键盘快捷键

| 按键 | 操作 |
| --- | --- |
| **J / 下箭头** | 下一个视频 |
| **K / 上箭头** | 上一个视频 |
| **M** | 静音/取消静音 |
| **C** | 切换字幕 |
| **/** | 聚焦评论输入框 |

---

## 📦 项目结构

\`\`\`
app/
  (feed)/page.tsx           # 主信息流页面
  api/
    videos/route.ts         # GET /api/videos?cursor&limit
    videos/[id]/like/route.ts      # POST /api/videos/:id/like
    videos/[id]/comments/route.ts  # GET /api/videos/:id/comments
components/
  VideoCard.tsx             # 视频卡片组件
  ActionsBar.tsx            # 动作栏（点赞/评论/分享）
  CommentsDrawer.tsx        # 评论抽屉
  CaptionBadge.tsx          # 标题徽章
  DebugPanel.tsx            # 调试面板
lib/
  useAutoplay.ts            # 自动播放hook
  usePrefetch.ts            # 预加载hook
  qoe.ts                    # QoE日志记录器
  keyboard.ts               # 键盘快捷键hook
  api.ts                    # API调用辅助函数
  store.ts                  # Zustand状态管理
public/
  mock/seed.json            # 种子数据
  posters/                  # 海报图片
  avatars/                  # 头像图片
  captions/                 # .vtt字幕文件
\`\`\`

---

## 📈 性能目标

* **TTI ≤ 1.5s** (3G Fast, 中端笔记本)
* **CLS ≤ 0.02**
* **p95 帧率下降 < 5%** (滚动时)
* **视频首帧 ≤ 250ms** (进入视口后，配合预加载)
* 初始路由的JS **< 200KB** (gzip后)

---

## ♿ 无障碍功能

* 完整的键盘遍历（可见焦点环）
* ARIA标签在按钮、抽屉和播放器控件上
* 尊重`prefers-reduced-motion`（淡入淡出代替缩放/滑动）
* 高对比度主题选项
* 通过`<track kind="captions">`支持字幕

---

## 📊 QoE & 遥测

每个会话收集以下指标到内存存储/控制台（或POST到`/api/telemetry`）：

* `ttff` (首帧时间)
* `stallCount`, `stallDurationMs` (卡顿统计)
* `framesDropped` (丢帧数)
* `scrollNext`, `scrollPrev` (滚动次数)
* `likeTapped`, `commentOpened`, `captionToggled` (交互统计)

通过`?debug=1`启用调试叠加层。

---

## 🧰 实现要点

* **自动播放:** 使用`IntersectionObserver`，阈值0.7；离开视口时暂停；进入交叉点时预加载前后视频
* **预加载:** 为相邻项预热`<link rel="prefetch">`或`video.preload = 'metadata'`
* **虚拟化:** 自然的"每视口一个"结构减少DOM大小；如需要可切换到虚拟列表
* **乐观点赞:** 立即更新本地`stats.likes`和UI状态；服务器错误时回滚
* **评论:** 乐观追加；使用`cursor`分页；大列表虚拟化
* **状态:** UI状态存储在Zustand；服务器数据通过React Query，每个视频ID缓存键

---

## 🔧 环境和配置

* 可选: `NEXT_PUBLIC_CDN_ORIGIN` (当从CDN提供视频/海报时)
* `public/mock/seed.json` 控制本地内容
* 如果源是`.m3u8`，在`VideoCard.tsx`中启用`hls.js`切换到HLS

---

## 📝 开发说明

1. 项目使用Next.js 14 App Router架构
2. 所有客户端组件都标记为'use client'
3. API路由在`app/api`目录下
4. 使用React Query处理服务器状态管理
5. Zustand用于客户端UI状态管理
6. Tailwind CSS用于样式，shadcn/ui用于基础组件

---

## 📄 许可证

MIT

---

## 🙏 致谢

此项目用于教育和展示目的。使用的示例视频来自公共资源。

