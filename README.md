# Short Video Feed — TikTok-style Web App

A high-performance short-video “For You” feed for the web: full-viewport vertical scrolling, viewport-based autoplay, double-tap likes, a comments drawer, keyboard shortcuts, and lightweight QoE monitoring.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwind-css)

## Features

### Core experience
- **Vertical feed** — one video per screen, infinite scroll (cursor pagination)
- **Autoplay / pause** — `IntersectionObserver` (plays at ~70% visibility)
- **Manual play / pause** — tap the video or press Space
- **Double-tap like** — TikTok-style animation with optimistic updates
- **Comments drawer** — bottom sheet on mobile / side panel on desktop, with optimistic posts
- **Share** — Web Share API with clipboard fallback
- **Save** — local UI toggle
- **Volume** — global mute / unmute
- **Captions** — optional `<track>` captions (samples in `public/captions/`)
- **Debug panel** — open `/?debug=1` for QoE metrics

### Keyboard shortcuts

| Key | Action |
|------|------|
| `J` / `↓` | Next video |
| `K` / `↑` | Previous video |
| `Space` | Play / pause |
| `M` | Mute / unmute |
| `C` | Toggle captions |
| `/` | Focus comment input |

### Performance
- Prefetch adjacent videos (`usePrefetch`)
- Debounced IntersectionObserver to reduce spurious toggles
- Optimistic UI for likes and comments
- QoE: TTFF, stall count/duration, and more (optional POST to `/api/telemetry`)

## Tech stack

| Area | Choice |
|------|------|
| Framework | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui-style components |
| State | Zustand (UI) + TanStack React Query (server data) |
| Testing | Vitest (unit) + Playwright (E2E) |
| Performance | Lighthouse CI (`lhci`) |

## Quick start

### Requirements

- Node.js ≥ 18
- npm (or pnpm / yarn)

### Install and develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Debug panel: [http://localhost:3000?debug=1](http://localhost:3000?debug=1)

### Production build

```bash
npm run build
npm run start
```

### Tests and checks

```bash
# Unit tests
npm run test

# E2E (install browsers on first run)
npx playwright install
npm run e2e

# Typecheck / lint
npm run typecheck
npm run lint

# Lighthouse CI
npm run lhci
```

## Project structure

```
internship-program/
├── app/
│   ├── (feed)/              # Feed route (/) + layout
│   ├── api/
│   │   ├── videos/          # List / like / comments
│   │   └── telemetry/       # QoE ingest
│   ├── layout.tsx
│   └── providers.tsx
├── components/
│   ├── VideoCard.tsx
│   ├── ActionsBar.tsx
│   ├── CommentsDrawer.tsx
│   ├── CaptionBadge.tsx
│   ├── DebugPanel.tsx
│   └── ui/
├── lib/
├── types/
├── data/                    # Local persistent store (Step 1)
│   └── store.json           # Created at runtime from seed
├── public/
│   ├── mock/seed.json
│   ├── videos/              # Local sample WebM clips
│   ├── posters/
│   ├── avatars/
│   └── captions/
├── lib/
│   └── db/feedStore.ts      # File-backed videos/likes/comments
├── docs/archive/            # Archived troubleshooting notes
├── __tests__/
├── e2e/
├── README.md
└── CODING_GUIDE.md          # AI / collaboration execution guide
```

## API

| Method | Path | Description |
|------|------|------|
| `GET` | `/api/videos?limit=5&cursor=` | Video list (cursor pagination) |
| `POST` | `/api/videos/:id/like` | Like a video |
| `GET` | `/api/videos/:id/comments` | List comments |
| `POST` | `/api/videos/:id/comments` | Post a comment |
| `POST` | `/api/telemetry` | QoE telemetry |

APIs are backed by a **local persistent JSON store** (`data/store.json`, seeded from `public/mock/seed.json`). Guests get an httpOnly session cookie automatically; register/login upgrades the identity. Likes are per-user. Users can upload videos locally via `POST /api/videos/upload` (stored under `public/uploads/`, poster via ffmpeg). HLS/CDN is the next roadmap step.

## Configuration

- Optional env: `NEXT_PUBLIC_CDN_ORIGIN`
- Local posters / avatars / captions: `public/posters`, `public/avatars`, `public/captions`
- Edit `seed.json` to customize videos and comments

## Performance targets

| Metric | Target |
|------|------|
| TTI | ≤ 1.5s (3G Fast / mid-range device) |
| CLS | ≤ 0.02 |
| Time to first frame (after entering viewport) | ≤ 250ms (with prefetch) |
| Initial route JS | < 200KB gzip (see Lighthouse CI budget) |

Run `npm run lhci` against `.lighthouserc.json` locally.

## Accessibility

- Full keyboard control (shortcuts + visible focus)
- ARIA labels on key controls
- Respects `prefers-reduced-motion`
- Captions via `<track kind="captions">`

## Docs

| Doc | Purpose |
|------|------|
| [ROADMAP.md](./ROADMAP.md) | Incremental product steps |
| [QUICKSTART.md](./QUICKSTART.md) | Quick start |
| [CODING_GUIDE.md](./CODING_GUIDE.md) | Requirements & AI execution protocol |
| [README_PROJECT.md](./README_PROJECT.md) | Design & implementation notes |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Troubleshooting |
| [COMMENT_GUIDE.md](./COMMENT_GUIDE.md) | Comments feature |
| [PAUSE_FEATURE_GUIDE.md](./PAUSE_FEATURE_GUIDE.md) | Play / pause interactions |
| [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | Feature summary & next ideas |
| [docs/archive/](./docs/archive/) | Historical investigation notes |

## License

MIT License
