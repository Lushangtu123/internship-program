# Product roadmap (incremental)

We improve toward a TikTok-like product **one step at a time**.

## Step 1 — Persistent local data layer ✅ (this PR)

- File-backed store at `data/store.json` (seeded from `public/mock/seed.json`)
- Likes and comments persist across restarts
- API routes use `lib/db/feedStore.ts`
- Still no auth, upload, or HLS

## Step 2 — Guest session → real identity (next)

- Simple auth (credentials or magic link)
- Likes/comments tied to a user id
- “Liked” state per user

## Step 3 — Upload pipeline (later)

- Client upload to object storage
- Basic transcode + poster
- Replace seed-only content

## Step 4 — HLS playback + CDN (later)

## Step 5 — Ranking / “For You” signals (later)
