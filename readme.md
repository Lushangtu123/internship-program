# 🎬 Short Video Feed - TikTok Clone

一个高性能的短视频"为你推荐"信息流 Web 应用，采用现代化技术栈打造，具备流畅的用户体验和完善的交互功能。

![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat-square&logo=tailwind-css)

## ✨ 功能特性

### 🎥 核心功能
- ✅ **无限滚动视频流** - 流畅加载更多视频
- ✅ **自动播放/暂停** - 基于视口的智能控制
- ✅ **手动播放/暂停** - 单击视频切换播放状态
- ✅ **双击点赞** - TikTok 风格的双击交互
- ✅ **评论系统** - 完整的评论查看和发布功能
- ✅ **分享功能** - 原生分享 API 支持
- ✅ **音量控制** - 全局静音/取消静音
- ✅ **字幕开关** - 可选的视频字幕显示

### ⌨️ 键盘快捷键
- \`J\` / \`K\` - 上一个/下一个视频
- \`Space\` - 播放/暂停当前视频
- \`M\` - 静音/取消静音
- \`C\` - 开关字幕
- \`/\` - 打开/关闭评论

### 🚀 性能优化
- **视频预加载** - 提前加载相邻视频
- **防抖机制** - 优化 IntersectionObserver 触发频率
- **乐观 UI 更新** - 点赞和评论即时反馈
- **QoE 监控** - 首帧时间（TTFF）、卡顿监控

## 🛠️ 技术栈

- **Next.js 14** - App Router + Server Components
- **React 18** - 最新特性支持
- **TypeScript** - 类型安全
- **Tailwind CSS** - 原子化 CSS
- **shadcn/ui** - 高质量组件库
- **Zustand** - 状态管理
- **React Query** - 服务端数据管理
- **Vitest** - 单元测试
- **Playwright** - E2E 测试

## 📦 快速开始

### 安装依赖

\`\`\`bash
npm install
\`\`\`

### 启动开发服务器

\`\`\`bash
npm run dev
\`\`\`

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建生产版本

\`\`\`bash
npm run build
npm run start
\`\`\`

### 运行测试

\`\`\`bash
# 单元测试
npm run test

# E2E 测试
npm run test:e2e

# Lighthouse CI
npm run lighthouse
\`\`\`

## 📁 项目结构

\`\`\`
internship-program/
├── app/                      # Next.js App Router
│   ├── api/                  # API 路由
│   ├── page.tsx             # 首页
│   └── layout.tsx           # 根布局
├── components/              # React 组件
│   ├── VideoCard.tsx        # 视频卡片
│   ├── ActionsBar.tsx       # 操作栏
│   └── CommentsDrawer.tsx   # 评论抽屉
├── lib/                     # 工具函数和 Hooks
│   ├── useAutoplay.ts       # 自动播放 Hook
│   ├── keyboard.ts          # 键盘快捷键
│   └── store.ts             # Zustand Store
├── types/                   # TypeScript 类型
├── public/                  # 静态资源
└── __tests__/               # 测试文件
\`\`\`

## 🎯 核心功能实现

### 自动播放控制

使用 \`IntersectionObserver\` API 监控视频可见性，配合防抖机制优化性能：

\`\`\`typescript
const observer = new IntersectionObserver(
  (entries) => {
    // 150ms 防抖 + 50px 缓冲区
  },
  { threshold: 0.7, rootMargin: '50px' }
);
\`\`\`

### 手动暂停控制

使用 \`useRef\` 实现即时状态访问，避免 React 异步更新导致的竞态条件。

### 无限滚动

使用 React Query 的 \`useInfiniteQuery\` 实现流畅的无限滚动加载。

## 🔌 API 接口

### 获取视频列表
\`\`\`
GET /api/videos?limit=5&cursor=0
\`\`\`

### 点赞视频
\`\`\`
POST /api/videos/:id/like
\`\`\`

### 获取/发布评论
\`\`\`
GET  /api/videos/:id/comments
POST /api/videos/:id/comments
\`\`\`

## 📊 性能指标

| 指标 | 目标 | 当前 | 状态 |
|------|------|------|------|
| Performance | ≥ 90 | 92 | ✅ |
| Accessibility | ≥ 95 | 98 | ✅ |
| Best Practices | ≥ 95 | 96 | ✅ |
| SEO | ≥ 95 | 100 | ✅ |

## 📖 文档

- [快速开始](./QUICKSTART.md)
- [故障排查](./TROUBLESHOOTING.md)
- [评论功能指南](./COMMENT_GUIDE.md)
- [暂停功能指南](./PAUSE_FEATURE_GUIDE.md)
- [IntersectionObserver 优化](./INTERSECTION_OBSERVER_FIX.md)

## 📄 许可证

MIT License

---

⭐ 如果这个项目对你有帮助，请给个 Star！
