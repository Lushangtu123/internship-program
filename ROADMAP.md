# Product roadmap (incremental)

We improve toward a TikTok-like product **one step at a time**.

## Step 1 — Persistent local data layer ✅

- File-backed store at `data/store.json` (seeded from `public/mock/seed.json`)
- Likes and comments persist across restarts
- API routes use `lib/db/feedStore.ts`
- Still no auth, upload, or HLS

## Step 2 — Guest session → real identity ✅ (this PR)

- Auto guest session via httpOnly cookie (`sv_session`)
- Register / login / logout (`POST /api/auth`)
- Likes are **per user**; comments use the acting user's username
- Minimal `AuthBar` UI (Sign in / Register / Log out)

## Step 3 — Upload pipeline (next)

- Client upload to object storage
- Basic transcode + poster
- Replace seed-only content

## Step 4 — HLS playback + CDN (later)

## Step 5 — Ranking / “For You” signals (later)
