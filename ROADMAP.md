# Product roadmap (incremental)

We improve toward a TikTok-like product **one step at a time**.
**Confirmed** updates land directly on `main`; **uncertain / experimental** ideas stay on other branches.

## Step 1 — Persistent local data layer ✅

- File-backed store at `data/store.sqlite` (seeded from `public/mock/seed.json`; legacy `store.json` migrated once)
- Likes and comments persist across restarts
- API routes use `lib/db/feedStore.ts`

## Step 2 — Guest session → real identity ✅

- Auto guest session via httpOnly cookie (`sv_session`)
- Register / login / logout (`POST /api/auth`)
- Likes are **per user**; comments use the acting user's username
- Minimal `AuthBar` UI

## Step 3 — Upload pipeline ✅

- `POST /api/videos/upload` (multipart)
- Local storage under `public/uploads/` (object-storage abstraction; S3 driver experimental)
- ffmpeg poster frame + duration probe
- Uploads prepend into the feed; `UploadButton` UI

## Step 4 — HLS playback ✅

- Uploads are transcoded to multi-rendition VOD HLS (`public/uploads/hls/{id}/`, ABR experimental)
- Progressive file kept as fallback artifact
- Player uses native HLS (Safari) or `hls.js` (Chromium)
- CDN-friendly cache headers on `/uploads/hls/*`

## Step 5 — Ranking / “For You” signals ✅

- Play + complete signals via `POST /api/engagement`
- Score = engagement (`likes/comments/plays/completes`) + freshness
- Feed list is ranked by score (not raw insert order)

## Step 6 — Follow graph + Following feed ✅

- `POST /api/follow` toggles follow for a creator
- `GET /api/videos?feed=following|foryou`
- Top tabs: **For You** / **Following**
- Follow button on each video card

## Step 7 — Creator profiles ✅

- `GET /api/creators/[id]` returns profile, stats, and that creator’s videos
- Profile page at `/creator/[id]` with Follow + video grid
- Avatar / handle on each card links to the profile

## Step 8 — Persistent saves ✅

- `POST /api/videos/:id/save` toggles a per-user bookmark
- `GET /api/videos?feed=saved` returns saved videos (newest first)
- Bookmark control on each card; **Saved** lives on your profile (Videos | Saved)

## UI polish — feed chrome ✅

- Bottom nav: **Home | Following | Create | Inbox | Me**
- Own profile hosts **Videos | Saved** + sign-in / log-out
- Upload opens as a dark sheet above the nav; Inbox is a dedicated `/inbox` page
- Desktop: centered phone frame (`max-w-md`); comments drawer matches dark feed
- Iteration log: [`docs/ITERATIONS.md`](./docs/ITERATIONS.md)

## Step 9 — Notifications ✅

- Like / comment / follow events write in-app notifications (no self-notify)
- `GET /api/notifications` + `POST /api/notifications` (`action: read`)
- Bell UI with unread badge on the feed

## Step 10 — Deep link to a video ✅

- `/?v={videoId}` loads For You pages until the video is found, then scrolls to it
- Active video id stays in the URL via `history.replaceState`
- Share copies / shares a `/?v=` link

## Step 11 — Follow UX polish ✅

- Hide Follow on your own videos
- Following empty state suggests creators (`GET /api/creators/suggested`)
- One-tap Follow from suggestions; jump back to For You

## Step 12 — Comment replies ✅

- Comments support one-level `parentId` replies
- List API nests replies under top-level threads
- Comments drawer: Reply / cancel chip + indented replies

## Step 13 — Own profile entry ✅

- AuthBar identity chip links to `/creator/[me]`
- Profile page hides Follow when viewing yourself

## Step 14 — Guest register upgrades in place ✅

- Register from a guest session keeps the same `user.id`
- Likes / saves / follows / uploads / comments stay attached
- Denormalized display names (creator handle, comment author) refresh

## Step 15 — Tappable inbox + open comments ✅

- Like / comment / follow rows navigate to video or profile
- Comment notifications use `/?v=&c=1` to open the comments drawer
- Confirmed product updates land on `main`; experiments stay on branches

## Step 16 — Comment count sync on cards ✅

- Posting / loading comments patches React Query `videos` (and creator) caches
- Action-bar comment badge stays in sync with the drawer

## Step 17 — Jump to video after upload ✅

- Successful publish closes the upload sheet
- Navigates to `/?v={newId}` on For You so the new clip plays immediately

## Step 18 — Share success feedback ✅

- Share uses Web Share when available, else clipboard
- Transient toast: Shared / Link copied / Couldn’t share (cancel stays silent)

## Step 19 — First-visit mute coach ✅

- One-shot 「Tap for sound」 tip on the active muted card
- Persisted via `localStorage` (`sv_mute_tip_seen`)

## Step 20 — Empty-state sign-in CTAs ✅

- Following / Inbox empty states guide guests to **Sign in on Me**
- Aligns with Me-hosted auth (UI-E)

## Step 21 — Deep-link not-found feedback ✅

- After exhausting For You pages, missing `?v=` shows a dismissible banner
- Dead `v=` is cleared so browsing can continue

## Step 22 — Feed tabs + URL-synced mode ✅

- Top **Following | For You** tabs on the feed
- `?feed=following` stays in sync; switching to Following clears `v`/`c`
- Bottom nav Home / Following share the same mode switcher

## Step 23 — On-card captions toggle ✅

- CC / Subtitles control next to mute when `captionsVtt` exists

## Step 24 — Comments pagination ✅

- Comments drawer loads more via `nextCursor`

## Step 25 — Share count persistence ✅

- Successful share/copy calls `POST /api/videos/[id]/share`
- Ranking includes share signal

## Step 26 — Upload progress feedback ✅

- XHR upload % progress, then “Processing…” while server transcodes

## Step 27 — Own-video manage (edit / delete) ✅

- `PATCH` / `DELETE /api/videos/[id]` for the owner
- Manage control on own profile video grid

## Step 28 — Search MVP ✅

- `GET /api/search?q=` over captions + creator usernames
- `/search` page; search icon on the feed top bar

## Step 29 — Productization stack (landed from experiment) ✅

Merged from `cursor/personalize-async-upload-8729` / PR #17:

- Personalized For You affinity boosts
- Async HLS upload (`processing` → `ready` / `failed`)
- SQLite WAL + normalized relational tables + incremental SQL ops
- Object storage abstraction (`STORAGE_DRIVER=local|s3`)
- Multi-bitrate ABR HLS ladder
- Messaging MVP (Inbox Activity | Messages) + SSE Live + optional `REDIS_URL` fan-out

## Step 30 — Upload packaging status UI ✅

- Feed card plays progressive file while HLS packs; shows **Processing…** / failed badge
- Polls `GET /api/videos/[id]` and patches React Query caches when ready
- Own-profile grid shows Processing / Failed chips

## Step 31 — Inbox smart Messages tab ✅

- Bottom nav → Messages when only DMs are unread (activity unread still opens Activity)
- Bare `/inbox` auto-lands on Messages in the same case; tabs show unread dots

## Step 32 — DM thread chrome + Message errors ✅

- Conversation page shares BottomNav + Create sheet with the rest of the app
- Creator **Message** failures show an inline error (not only console)

## Step 33 — DM activity notifications ✅

- Sending a DM writes an Activity notification for the peer (`type=message`)
- Notification deep-links into `/inbox/c/{id}`; Activity copy shows a short preview

## Step 34 — Clear message notifications when thread is read ✅

- `markConversationRead` also marks matching `message` Activity rows as read
- Opening a thread refreshes the notifications query so the badge/dot updates

## Step 35 — Packaging Ready toast ✅

- When a card leaves `processing` for `ready`, briefly show a green **Ready** badge
- Failed transitions keep a failed cue; Processing… still shows while packing

## Later ideas (not scheduled)

- Horizontal / shared DB for multi-instance store (beyond single-node SQLite WAL)
