# 迭代记录（问题 → 方法 → 结果）

> **分支约定**：确认的产品更新直接进 `main`；只有不确定/实验性改动才开其他分支。  
> **强制约定**：每次合入 `main` 的产品/UI 更新，都必须在此追加一条（问题 → 方法 → 结果）。不写文档不算完成。

## 条目模板

```md
### YYYY-MM-DD — 简短标题

- **问题**：当时界面或产品上哪里不合理
- **方法**：具体改了什么（组件 / 路由 / 交互）
- **结果**：用户可见变化 + 相关提交
- **后续**：若有未做完的跟进项
```

---

### 2026-07-11 — UI-A：Saved 移出信息流顶栏

- **问题**：顶栏同时放 For You / Following / Saved，和内容流切换抢同一条视觉带；收藏属于「个人库」，不应与推荐流同级。
- **方法**：
  - `FeedTabs` 去掉 Saved
  - 自己的 `/creator/[id]` 增加 **Videos | Saved** 分段；Saved 仍调 `GET /api/videos?feed=saved`
- **结果**：信息流顶栏只保留内容切换语义；收藏入口回到个人主页。提交：`de3c21f`
- **后续**：顶栏仍有上传/铃铛/身份，继续减负。

### 2026-07-11 — UI-B/C：底栏导航 + 清掉顶栏工具

- **问题**：身份、通知、上传、流切换全部浮在视频上方，第一屏 chrome 过重，拇指区冲突。
- **方法**：
  - 新增 `BottomNav`：`Home | Following | Create | Inbox | Me`
  - 上传 → `UploadSheet`；通知 → `NotificationSheet`（底栏上方暗色面板）
  - 删除顶栏 `FeedTabs` / `UploadButton` / `NotificationBell`
  - `AuthBar` 收缩为仅登录/登出
  - 视频文案与操作列上移，避开底栏；去掉无效 More 按钮
- **结果**：内容区更干净；账号与工具走底栏。提交：`52e1202`
- **后续**：桌面全宽拉伸不像手机产品；评论抽屉仍偏亮色。

### 2026-07-11 — UI-D：桌面手机框 + 暗色评论

- **问题**：桌面端全宽视频条不自然；评论抽屉浅色，与全黑沉浸流割裂；滚动用 `window.innerHeight` 与框内高度不一致。
- **方法**：
  - Feed / Creator layout：居中 `max-w-md` 手机框
  - 底栏与 sheet 改为框内 `absolute` 定位
  - `CommentsDrawer` 改为暗色底栏式抽屉
  - `.video-container` 与滚动计算改用容器高度
- **结果**：桌面像手机壳；评论与 feed 视觉统一。提交：`8e4b250`
- **后续**：登录仍占左上角，可迁到 Me。

### 2026-07-11 — UI-E：认证入口迁到 Me + 建立迭代文档

- **问题**：信息流左上角仍挂 Sign in / Log out，和「工具走底栏、身份走 Me」的结构不一致；缺少统一的「问题→方法→结果」记录，后续更新难追溯。
- **方法**：
  - 新建 `docs/ITERATIONS.md`，回填 UI-A～D，并规定后续每次更新追加条目
  - 删除 feed 上的 `AuthBar`
  - 新建 `ProfileAuthPanel`：自己的主页展示游客登录/注册，或已登录用户的 Log out；登录/登出后跳转到对应 `/creator/[id]`
  - README / ROADMAP 链到迭代文档
- **结果**：信息流顶层无账号控件；账号能力集中在 Me。提交：`c1b4dc8`（跳转补丁见后续 commit）
- **后续**：可考虑在 Following 空态与 Inbox 空态强化引导注册；静音可并进首次手势提示。

### 2026-07-11 — Step 15：Inbox 可点进内容 + 评论通知打开抽屉

- **问题**：通知行无法跳转；评论类通知即使进了视频也不会打开评论。
- **方法**：
  - `notificationTargetHref`：like → `/?v=`；comment → `/?v=&c=1`；follow → `/creator/[id]`
  - `NotificationSheet` 行改为可点 `Link`
  - Feed：`?v=` 强制 For You；滚到目标后若带 `c=1` 则打开评论抽屉并清掉 `c`
- **结果**：Inbox 可导航；评论通知直接看到评论。提交：`a014044`
- **后续**：游客注册原地升级；发评同步角标；上传后跳新视频（确认项继续直接进 main）。

### 2026-07-11 — Step 14：游客注册原地升级身份

- **问题**：文档写 register 会「升级身份」，但实现一直 `newId` 新建用户，游客期间的赞/收藏/关注/上传全部 orphan。
- **方法**：
  - `registerUser(..., upgradeFromUserId)`：guest 原地改 username / password / `isGuest=false`，保留同一 `user.id`
  - `syncIdentityDisplay`：同步视频 creator、评论、通知展示名
  - `POST /api/auth` register 读取当前 session；guest 则传入升级 id
  - Me 注册表单补充「保留互动与上传」说明
- **结果**：游客注册后仍看到自己的赞/收藏/关注/作品。提交：`c0a8301`
- **后续**：发评同步角标；上传后跳新视频；分享反馈。

---

<!-- 新条目追加在上方「---」之前。每次更新必须写：问题 / 方法 / 结果（含提交）。 -->
