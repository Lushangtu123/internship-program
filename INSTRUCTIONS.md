# 项目设置说明

## 快速开始

### 1. 安装依赖

\`\`\`bash
npm install
# 或
pnpm install
\`\`\`

### 2. 运行开发服务器

\`\`\`bash
npm run dev
# 或
pnpm dev
\`\`\`

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 3. 查看调试面板

访问 [http://localhost:3000?debug=1](http://localhost:3000?debug=1) 查看QoE调试面板。

---

## 功能演示

### 基本功能
- ✅ 垂直滚动视频信息流
- ✅ 自动播放/暂停（基于视口可见性）
- ✅ 点赞、评论、分享按钮
- ✅ 双击点赞动画
- ✅ 音乐标签旋转动画

### 评论功能
- ✅ 评论抽屉（移动端/桌面端自适应）
- ✅ 乐观更新
- ✅ 实时评论发送

### 键盘快捷键
- `J` 或 `↓`: 下一个视频
- `K` 或 `↑`: 上一个视频
- `M`: 静音/取消静音
- `C`: 切换字幕
- `/`: 聚焦评论输入

### 调试功能
- 添加 `?debug=1` 查看QoE指标
- 实时监控：
  - 首帧时间(TTFF)
  - 卡顿次数和时长
  - 用户交互统计

---

## 测试

### 单元测试
\`\`\`bash
npm run test
\`\`\`

### E2E测试
\`\`\`bash
# 安装Playwright浏览器（首次运行）
npx playwright install

# 运行测试
npm run e2e

# 带UI运行
npm run e2e -- --headed
\`\`\`

---

## 构建和部署

### 本地构建
\`\`\`bash
npm run build
npm run start
\`\`\`

### 部署到Vercel
1. 推送代码到GitHub
2. 在Vercel导入仓库
3. Vercel会自动检测Next.js并部署

---

## 自定义数据

编辑 `public/mock/seed.json` 来修改视频和评论数据：

\`\`\`json
{
  "videos": [
    {
      "id": "v_001",
      "src": "视频URL",
      "poster": "海报图片URL",
      "duration": 596.5,
      "creator": {
        "id": "u_1",
        "handle": "@用户名",
        "avatar": "/avatars/1.png"
      },
      "caption": "视频描述 #标签",
      "music": {
        "title": "音乐标题",
        "artist": "艺术家"
      },
      "stats": {
        "likes": 45200,
        "comments": 892,
        "shares": 234
      }
    }
  ]
}
\`\`\`

---

## 常见问题

### 视频不自动播放？
- 确保浏览器允许自动播放（某些浏览器需要用户交互）
- 视频默认静音以允许自动播放

### 评论抽屉不显示？
- 点击评论按钮或按 `/` 键
- 确保选中了有效的视频

### 测试失败？
- 确保安装了Playwright浏览器：`npx playwright install`
- 检查端口3000是否被占用

---

## 性能优化建议

1. **视频优化**
   - 使用适当的视频编码（H.264）
   - 提供多个质量选项
   - 考虑使用HLS进行自适应流媒体

2. **图片优化**
   - 使用WebP格式
   - 使用Next.js Image组件
   - 实现懒加载

3. **代码优化**
   - 启用代码分割
   - 使用动态导入
   - 优化包大小

---

## 技术支持

如有问题，请查看：
- Next.js文档: https://nextjs.org/docs
- React Query文档: https://tanstack.com/query
- Tailwind CSS文档: https://tailwindcss.com/docs

---

## 项目结构说明

\`\`\`
/app                # Next.js App Router
  /(feed)          # 信息流页面组
  /api             # API路由
  layout.tsx       # 根布局
  globals.css      # 全局样式

/components        # React组件
  /ui              # shadcn/ui基础组件
  VideoCard.tsx    # 视频卡片
  ActionsBar.tsx   # 动作栏
  CommentsDrawer.tsx # 评论抽屉
  ...

/lib               # 工具函数和Hooks
  useAutoplay.ts   # 自动播放Hook
  keyboard.ts      # 键盘快捷键
  qoe.ts           # QoE监控
  store.ts         # 状态管理
  ...

/types             # TypeScript类型定义
/public            # 静态资源
/__tests__         # 单元测试
/e2e               # E2E测试
\`\`\`

