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

### 2026-07-11 — Step 27–28：作品管理 + 搜索 MVP

- **问题**：自己主页只能点进播放，不能改文案/删除；发现入口几乎只有推荐流。
- **方法**：
  - Step 27：`PATCH/DELETE /api/videos/[id]`（仅作者）；Me 作品格 `ManagedVideoGrid` 管理面板
  - Step 28：`GET /api/search?q=` + `/search` 页；信息流顶栏搜索入口
- **结果**：作者可管自己的片；可按作者/文案搜索。提交：`001bb7c`
- **后续**：异步上传 / 真数据库 / 个性化 / ABR 仍走实验分支。

### 2026-07-11 — 实验：个性化 For You + 异步 HLS 上传

- **问题**：For You 对所有人同一排序；上传要等整段 ffmpeg HLS 结束才返回，体验卡住。
- **方法**（实验分支，未合 main）：
  - 个性化：`UserAffinity`（关注/点赞创作者/收藏/已赞/已播）叠在全局分上；`playsByUser` 由 engagement 写入
  - 异步上传：`acceptUploadedVideo` 先落盘 progressive + poster → `status=processing` 立刻返回；后台 `enqueueHlsTranscode` 完成后续改 `src` 为 m3u8 / `ready`
  - `GET /api/videos/[id]` 可查 packaging 状态
- **结果**：见本分支 PR。提交：`e36376a`
- **后续**：对象存储 / 真数据库 / ABR 仍实验；确认后可合 main。

### 2026-07-11 — 实验：SQLite 持久化替换 store.json

- **问题**：整份 `store.json` 链式重写，并发 API 易撕裂；也不适合多实例。
- **方法**（同实验分支）：
  - Node 内置 `node:sqlite`（WAL）存 `store_snapshot` 原子快照
  - `feedStore` API 不变，只换 `ensureStore` / `persist`
  - 首次启动若仍有 `store.json` 则迁入 SQLite 并改名为 `.migrated`
- **结果**：提交：`a5d02d8`；规范化表结构 / 对象存储 / ABR 仍后续。
- **后续**：确认后可合 main；下一步优先对象存储或 ABR。

### 2026-07-11 — 实验：对象存储抽象（local / S3）

- **问题**：上传产物写死在 `public/uploads/`，多实例与 CDN 源站无法复用；异步 HLS 需要可替换的发布层。
- **方法**（同实验分支）：
  - `ObjectStore`：`put` / `putFile` / `putDirectory` / `publicUrl`
  - `LocalObjectStore`（默认）与 `S3CompatibleObjectStore`（SigV4 PutObject，无 AWS SDK）
  - `STORAGE_DRIVER=local|s3` + `.env.example`；上传管线经 `getObjectStore()` 发布 progressive / poster / HLS
- **结果**：`333ac9c`。
- **后续**：ABR；规范化 SQL 表结构；确认后可合 main。

### 2026-07-11 — 实验：多码率 ABR HLS 阶梯

- **问题**：上传只打单码率 HLS，弱网容易卡；播放器也无法按分辨率切换。
- **方法**（同实验分支）：
  - `ABR_LADDER`：360p / 480p / 720p + `master.m3u8`（`index.m3u8` 作别名）
  - 阶梯失败回退单码率；`useHlsPlayback` 开启 `capLevelToPlayerSize` + 自动 startLevel
- **结果**：`07db91f`。
- **后续**：规范化 SQL 已落地（`9cb7235`）；确认后可合 main。

### 2026-07-11 — 实验：规范化 SQLite 关系表

- **问题**：v1 仍是整包 JSON blob，无法按用户/视频查询；备份与演进困难。
- **方法**（同实验分支）：
  - 关系表：`users` / `sessions` / `videos` / `comments` / `likes` / `saves` / `follows` / `signals` / `plays` / `notifications`
  - `FeedStoreData` ↔ 表行映射；事务替换写入
  - 自动迁移：`store.json` → v1 blob → v2 表；`feedStore` API 不变
- **结果**：提交：`9cb7235`；`npm test` 64 通过。
- **后续**：即时通讯 MVP；确认后可合 main。

### 2026-07-11 — 实验：即时通讯 MVP（Inbox Messages）

- **问题**：Inbox 只有活动通知，没有 1:1 私信；创作者主页无法发起对话。
- **方法**（同实验分支）：
  - 数据：`conversations` / `messages` / `conversation_reads` 表；`FeedStoreData.conversations`
  - API：`GET/POST /api/conversations`、`GET/POST .../messages`、`POST ... action:read`
  - UI：Inbox **Activity | Messages**；`/inbox/c/[id]` 会话页；主页 **Message** 按钮；底栏未读 = 通知 + 私信
  - 规则：仅注册用户可发；游客引导登录；每会话最多 200 条；轮询刷新
- **结果**：提交：`cc0e69e`；`npm test` 66 通过。
- **后续**：按操作 SQL 写入；确认后可合 main；WebSocket 仍可选。

### 2026-07-11 — 实验：热路径按操作 SQL 写入

- **问题**：每次发私信 / 标已读仍整库 DELETE+重插，消息量大时浪费且易与其它表竞态。
- **方法**（同实验分支）：
  - 新增 `lib/db/sqliteOps.ts`：`opInsertConversation` / `opAppendMessage` / `opMarkConversationRead` / `opMarkNotificationsRead`
  - `feedStore` 对上述热路径走 `persistIncremental`（仍串行化 writeChain）；其它变更仍全量快照
  - 回归：发私信后 likes 行数不变
- **结果**：提交：`1a48de3`；`npm test` 68 通过。
- **后续**：点赞/评论/关注等迁到按操作写入；确认后可合 main；WebSocket 仍可选。

### 2026-07-11 — 实验：互动热路径按操作 SQL 写入

- **问题**：点赞/评论/关注/收藏/播放信号仍整库重写，高频互动浪费大。
- **方法**（同实验分支）：
  - 扩展 `sqliteOps`：`opToggleLike` / `opToggleFollow` / `opToggleSave` / `opAddComment` / `opRecordSignal` / `opRecordShare`（可附带通知插入）
  - `feedStore` 上述路径全部走 `persistIncremental`
  - 回归：互动后既有私信行不被抹掉
- **结果**：提交：`765f305`；`npm test` 69 通过。
- **后续**：私信 SSE 实时推送；确认后可合 main。

### 2026-07-11 — 实验：私信 SSE 实时推送

- **问题**：私信依赖 8–10s 轮询，对端回复体感滞后；多开标签也会空转请求。
- **方法**（同实验分支）：
  - 进程内 `conversationBus`（会话频道 + 用户频道）；`sendMessage` 成功后 fan-out
  - SSE：`GET /api/conversations/[id]/events`、`GET /api/conversations/events`
  - 客户端 `useConversationLive` / `useInboxLive`；连上后放慢轮询作兜底；会话头显示 Live
- **结果**：提交：`67bc47e`；`npm test` 70 通过。
- **后续**：鉴权/视频 CRUD 增量写入；确认后可合 main。

### 2026-07-11 — 实验：鉴权与视频 CRUD 按操作 SQL 写入

- **问题**：游客/注册/登录、上传与改删视频仍整库重写，与已增量的互动路径不一致。
- **方法**（同实验分支）：
  - `opInsertUserWithSession` / `opRegisterUpgrade` / `opInsertSession` / `opDeleteSession`
  - `opInsertVideo` / `opUpdateVideoFields` / `opDeleteVideo`（级联清 likes/saves/comments/signals/plays/notifications）
  - `feedStore` 可变路径全部 `persistIncremental`；全量快照仅保留 seed/迁移
- **结果**：提交：`12c9ef1`；`npm test` 71 通过。
- **后续**：多实例 DM Redis；确认后可合 main。

### 2026-07-11 — 实验：多实例 DM Redis pub/sub

- **问题**：SSE 总线仅进程内有效，多 Node 实例时对端收不到实时私信。
- **方法**（同实验分支）：
  - `REDIS_URL` 可选；`redisBridge` 订阅 `sv:dm`，带 `origin` 去重避免回声
  - `conversationBus` 仍先本地 fan-out，再异步 publish；无 Redis 时行为不变
  - `.env.example` 补充说明
- **结果**：提交：`efe79aa`；`npm test` 74 通过。
- **后续**：合入 main。

### 2026-07-11 — Step 29：实验栈合入 main

- **问题**：个性化 / 异步上传 / SQLite / 对象存储 / ABR / 私信 / 增量 SQL / SSE / Redis 长期停在实验分支，main 缺少这些能力。
- **方法**：
  - 将 `cursor/personalize-async-upload-8729`（PR #17）merge 进 `main`
  - `ROADMAP` 记为 Step 29；后续新实验再开分支
- **结果**：提交：`60031ac`（merge `0ebb119`）；`npm test` 74 通过。
- **后续**：上传打包状态 UI；共享/多实例数据库。

### 2026-07-11 — Step 30：上传打包状态 UI

- **问题**：异步上传已返回 `processing`，但信息流/主页不展示进度，也仍可能卡在 progressive 源。
- **方法**：
  - `fetchVideoPackagingStatus` + `useVideoPackagingPoll`；处理中优先播 `progressiveSrc`
  - `patchVideoPackaging` 写回 React Query；卡片角标 Processing… / failed；主页网格同态 chip
- **结果**：提交：`6c08c9f`；`npm test` 77 通过。
- **后续**：Inbox 智能 Messages tab。

### 2026-07-11 — Step 31：Inbox 智能 Messages tab

- **问题**：底栏未读红点含私信，但 Inbox 总是打开 Activity，容易漏掉私信。
- **方法**：
  - `preferInboxTab` / `inboxHref`：仅私信未读 → Messages，否则 Activity
  - BottomNav 与裸 `/inbox` 共用规则；tab 旁显示未读小圆点
- **结果**：提交：`517cb6d`；`npm test` 80 通过。
- **后续**：会话页底栏；共享数据库。

### 2026-07-11 — Step 32：私信会话底栏与 Message 错误提示

- **问题**：`/inbox/c/[id]` 没有底栏，像死胡同；主页 Message 失败只打 console。
- **方法**：
  - 会话页接入 `BottomNav` + `UploadSheet`，内容区 `pb-14` 避开底栏
  - 创作者页 `messageError` 行内展示
- **结果**：提交：`05fccbd`；`npm test` 80 通过。
- **后续**：私信 Activity 通知。

### 2026-07-11 — Step 33：私信写入 Activity 通知

- **问题**：收到私信只靠 Messages 列表/红点，Activity 看不到，旧习惯用户会漏掉。
- **方法**：
  - `NotificationType` 增加 `message`；`conversationId` 字段 + SQLite 列迁移
  - `sendMessage` 给对方 `pushNotification` + `opInsertNotification`
  - 深链 `/inbox/c/...`；Inbox 文案带预览
- **结果**：提交：`efc3d76`；`npm test` 80 通过。
- **后续**：打开会话时同步清除 message 通知。

### 2026-07-11 — Step 34：读会话同步清除私信 Activity 通知

- **问题**：进了私信会话后，Activity 里对应 message 通知仍未读，底栏红点偏高。
- **方法**：
  - `markConversationRead` 把同 `conversationId` 的 `message` 通知标已读
  - 会话页打开时刷新 `notifications` 查询
- **结果**：提交：`0a181ad`；`npm test` 80 通过。
- **后续**：打包完成 Ready 提示。

### 2026-07-11 — Step 35：打包完成 Ready 提示

- **问题**：Processing… 消失后用户不知道 HLS 是否已就绪。
- **方法**：
  - `packagingStatusToast(prev, next)`：processing→ready 显示 Ready（约 2.2s）
  - VideoCard 左上角角标；失败仍提示
- **结果**：提交：`6dd3896`；`npm test` 83 通过。
- **后续**：同会话未读私信通知合并。

### 2026-07-11 — Fix：私信测试断言与合并行为对齐

- **问题**：Step 36 合并通知测试发了第二条消息后，仍按「仅一条未读」断言 `unreadCount` / `lastMessage` / 线程条数，导致 `npm test` 失败（此前被 `tail` 管道掩盖）。
- **方法**：第二条消息后期望会话未读为 2、预览为 `second ping`、线程 2 条；Activity 仍保持合并为 1 行。
- **结果**：提交：`27292e6`；`npm test` 83 通过；`npm test` 待跑。
- **后续**：共享/多实例数据库；或其他 polish。

### 2026-07-11 — Step 36：同会话未读私信通知合并

- **问题**：连续发多条私信会在 Activity 堆很多 message 行。
- **方法**：
  - `pushOrCoalesceMessageNotification`：同 `conversationId` 且未读则更新预览并置顶
  - SQL：`opRefreshNotification`（删旧插新到 position 0）
- **结果**：提交：`b014e61`；合并通知行为正确，但 messaging 测试断言未同步（见上条 Fix）。
- **后续**：共享/多实例数据库；或其他 polish。

---

<!-- 新条目追加在上方「---」之前。每次更新必须写：问题 / 方法 / 结果（含提交）。 -->
