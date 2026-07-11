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

## Step 4 — HLS playback + CDN (next)

- Transcode uploaded files to HLS ladders
- Serve via CDN-friendly paths

## Step 5 — Ranking / “For You” signals (later)
