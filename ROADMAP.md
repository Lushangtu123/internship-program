# Product roadmap (incremental)

We improve toward a TikTok-like product **one step at a time**.
Completed work lands on `main`; experimental ideas stay on branches.

## Step 1 — Persistent local data layer ✅

- File-backed store at `data/store.json` (seeded from `public/mock/seed.json`)
- Likes and comments persist across restarts
- API routes use `lib/db/feedStore.ts`

## Step 2 — Guest session → real identity ✅

- Auto guest session via httpOnly cookie (`sv_session`)
- Register / login / logout (`POST /api/auth`)
- Likes are **per user**; comments use the acting user's username
- Minimal `AuthBar` UI

## Step 3 — Upload pipeline ✅

- `POST /api/videos/upload` (multipart)
- Local storage under `public/uploads/` (stub toward object storage)
- ffmpeg poster frame + duration probe
- Uploads prepend into the feed; `UploadButton` UI

## Step 4 — HLS playback ✅

- Uploads are transcoded to single-rendition VOD HLS (`public/uploads/hls/{id}/`)
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

## Step 11 — Follow UX polish ✅

- Hide Follow on your own videos
- Following empty state suggests creators (`GET /api/creators/suggested`)
- One-tap Follow from suggestions; jump back to For You

## Later ideas (not scheduled)

- Multi-bitrate ABR ladders
- Real object storage + CDN origin
- Creator profiles and notifications
- Messaging / inbox
