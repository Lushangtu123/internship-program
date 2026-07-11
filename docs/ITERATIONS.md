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

### 2026-07-11 — Step 16：评论后同步卡片评论数

- **问题**：`CommentsDrawer` 发评后只更新抽屉列表，右侧操作栏 `stats.comments` 仍是旧值。
- **方法**：
  - 新增 `lib/videoQueryCache.ts`：对 React Query `videos` / `creator` 缓存做评论数 delta / absolute 补丁
  - 发评乐观 +1，失败回滚；打开抽屉加载完成后用真实总数校正
- **结果**：发评后卡片评论角标立即更新。提交：`7bb6aa2`
- **后续**：上传后跳新视频；分享反馈；首次静音引导。

### 2026-07-11 — Step 17：上传成功后跳到新视频

- **问题**：Create 发布成功后只显示 `Uploaded v_xxx`，用户还要自己关 sheet、回 For You 找自己的片。
- **方法**：
  - `UploadSheet` 增加 `onUploaded(videoId)`；刷新 `videos` 缓存后回调
  - Feed：关 sheet、切 For You、`router.replace(/?v=id)`，复用既有 deep-link 滚动
- **结果**：发布后直接落到刚上传的视频。提交：`9dadef2`
- **后续**：分享反馈；首次静音引导。

### 2026-07-11 — Step 18：分享成功反馈

- **问题**：点分享后无任何反馈；桌面端静默写剪贴板，用户不知道链接是否已复制。
- **方法**：
  - 抽出 `lib/shareVideo.ts`：优先 Web Share，失败/不支持则剪贴板；用户取消（AbortError）不提示
  - `VideoCard` 底部短暂 toast：`Shared` / `Link copied` / `Couldn’t share`
- **结果**：分享操作有明确结果反馈。提交：`4304a31`
- **后续**：首次静音引导；Following/Inbox 空态引导登录。

### 2026-07-11 — Step 19 / UI-F：首次进入「点按开声」引导

- **问题**：浏览器要求静音才能自动播放，新用户不知道如何开声；右下角静音按钮偏小、无首次说明。
- **方法**：
  - 新增 `lib/muteTip.ts`（`localStorage` 键 `sv_mute_tip_seen`）与 `MuteGestureTip`
  - 仅在当前激活卡片 + 仍静音 + 未看过引导时，居中显示「Tap for sound」
  - 点引导条或任意开声路径后永久不再显示
- **结果**：首次进入有一次清晰开声提示，之后不打扰。提交：`33f39ef`
- **后续**：Following/Inbox 空态引导登录；深链找不到视频时提示。

### 2026-07-11 — Step 20 / UI-G：Following / Inbox 空态引导登录

- **问题**：游客在 Following、Inbox 看到空列表时，不知道账号入口已迁到 Me，转化路径断裂。
- **方法**：
  - `FollowingEmptyState`：游客文案强调「登录后关注才持久」，主 CTA「Sign in on Me」；高度改为 `h-full` 适配手机框
  - `NotificationSheet` 空态：游客引导去 Me 登录；已登录用户给简短说明
- **结果**：空态直接指向 Me 认证，与 UI-E 结构一致。提交：`02f9a84`
- **后续**：深链找不到视频时提示；ABR / 对象存储仍走实验分支。

### 2026-07-11 — Step 21：深链找不到视频时提示

- **问题**：`/?v=` 翻完所有分页仍找不到目标时静默失败，用户不知道链接已失效。
- **方法**：
  - `isDeepLinkExhausted`：无下一页且列表中无目标 id 时判定耗尽
  - Feed：展示顶部「Video not found」条，并 `router.replace('/')` 清掉失效 `v=`
  - 点 OK 关闭提示；新的 `?v=` 会重置提示
- **结果**：失效深链有明确反馈，可继续刷 For You。提交：`ec1d3df`
- **后续**：ABR / 对象存储等不确定项走实验分支。

### 2026-07-11 — 测试修复：深链 URL 同步与 e2e 选择器

- **问题**：跑 e2e 时深链被「当前视频 URL 同步」覆盖（Next 会 patch `history.replaceState`）；旧选择器仍用 `.h-screen`。
- **方法**：
  - 深链解析完成前禁用 URL sync；找不到视频时保留 `?v=` 直到点 OK
  - e2e：`data-testid=feed-scroll`、评论关闭用 dialog 内按钮、评论文案加时间戳
- **结果**：chromium e2e 全绿。提交：`216ad11`
- **后续**：ABR / 对象存储等不确定项走实验分支。

### 2026-07-11 — 修复：Me → Inbox 被关掉变成视频流

- **问题**：在 Me 点 Inbox 会跳到 `/?sheet=inbox`，随后 URL sync 补上 `?v=`，深链 effect 误执行 `setSheet(null)`，Inbox 被关掉只剩视频播放。
- **方法**：
  - 深链「落地」逻辑：若已有 sheet 打开（或 URL 带 `sheet=`），不再关 sheet / 不再当视频深链处理
  - 关闭 Upload/Inbox 时清掉 URL 上的 `sheet` 参数
  - e2e 覆盖 Me → Inbox 路径
- **结果**：从 Me 进 Inbox 面板保持打开。提交：`34aecf3`
- **后续**：ABR / 对象存储等不确定项走实验分支。

### 2026-07-11 — 修复：Me 页 Inbox/Create 就地打开

- **问题**：Me 底栏 Inbox/Create 仍 `router.push('/?sheet=…')`，会离开个人主页跳进视频流再盖一层 sheet，体感像「又回到视频」。
- **方法**：
  - `/creator/[id]` 本地挂载 `NotificationSheet` / `UploadSheet`
  - Inbox/Create 只切换本页 sheet，不再跳转 feed；上传成功仍跳到新视频
- **结果**：Me → Inbox 留在个人主页打开通知面板。提交：`c73a978`
- **后续**：用户仍反馈会跳到视频；改为独立 `/inbox` 路由（见下条）。

### 2026-07-11 — 修复：Inbox 独立页，彻底离开视频流

- **问题**：Inbox 叠在 feed / Me 上时，仍容易和 `?v=` 深链、视频背景搅在一起，体感「又跳回视频」。
- **方法**：
  - 新增 `/inbox` 全页（手机框内），`InboxPanel` 抽共用列表
  - 底栏 Inbox 改为 `Link` → `/inbox`，不再用 feed sheet
  - 旧 `/?sheet=inbox` 重定向到 `/inbox`；Create 仍用 UploadSheet
- **结果**：Me / Home 点 Inbox 都进无视频的通知页。提交：`ac4e2f4`
- **后续**：点赞/评论通知仍可点进对应视频（有意为之）。

### 2026-07-11 — Step 22：For You / Following 顶栏 + URL 同步

- **问题**：信息流模式只靠底栏切换，顶栏看不见当前是 For You 还是 Following；刷新/`?feed=` 与本地状态不同步；切到 Following 时残留的 `?v=` 还会把人拽回 For You。
- **方法**：
  - 新增 `FeedTabs`（Following | For You）叠在信息流顶部
  - `parseFeedMode` / `applyFeedModeToSearchParams`：Following 写 `feed=following` 并清掉 `v`/`c`；For You 去掉 `feed`
  - 底栏 Home/Following 与顶栏共用 `changeFeedMode`；Following 下不做 `?v=` URL 同步
- **结果**：模式可见、可分享、可刷新保持。提交：`051aa8e`
- **后续**：字幕按钮；评论分页；分享计数；上传进度。

### 2026-07-11 — Step 23–26：字幕按钮 / 评论分页 / 分享计数 / 上传进度

- **问题**：字幕只能按键盘 `C`；评论抽屉只拉一页；分享角标是静态数；上传长时间无进度。
- **方法**：
  - Step 23：有 VTT 的卡片在静音按钮上方加字幕开关（`Subtitles`）
  - Step 24：`CommentsDrawer` 接 `nextCursor`，底部 Load more
  - Step 25：`POST /api/videos/[id]/share` + `recordShare`；成功分享/复制后写入；排名计入 shares
  - Step 26：`UploadSheet` 用 XHR 上传进度条，完成后显示 Processing…
- **结果**：上述四项体感补齐。提交：`c22ef85`
- **后续**：作品管理（删/改 caption）；搜索 MVP。

---

<!-- 新条目追加在上方「---」之前。每次更新必须写：问题 / 方法 / 结果（含提交）。 -->
