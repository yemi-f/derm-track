# DermTrack

A dermatology-clinic-provided web app: a patient signs in, gets an AI skin analysis across 10 concerns, sees provider-framed treatment options with a simulated before/after preview, and tracks progress over time via a visit history and trend graph. Built for the [YouCam API Hackathon](https://youcam-api.devpost.com/) on Perfect Corp's YouCam AI Skin Analysis and Skin Simulation APIs.

Full architecture, schema, and API details live in [`IMPLEMENTATION.md`](./IMPLEMENTATION.md). Build conventions and non-negotiable constraints are in [`CLAUDE.md`](./CLAUDE.md).

## Stack

- Next.js (App Router, plain JavaScript, no TypeScript)
- Supabase — email/password + passwordless magic-link auth, Postgres, private Storage bucket
- YouCam JS Camera Kit for guided in-browser capture, Skin Analysis + Skin Simulation APIs for scoring and treatment previews
- Chart.js (via `react-chartjs-2`) for the visit-history trend graph
- Plain CSS with a small design-token palette — no UI framework
- Vitest for tests

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

See `.env.local.example`. You'll need:

- `YOUCAM_API_KEY` / `YOUCAM_API_BASE` — YouCam API credentials (server-side only, never exposed to the client)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` — use Supabase's Publishable/Secret key pair, not the legacy anon/service_role keys
- `NEXT_PUBLIC_APP_URL` — app origin, used for the magic-link auth callback
- `NEXT_PUBLIC_CLINIC_NAME` — clinic name used throughout the UI copy

### Supabase setup

Before running the app against a real Supabase project:

1. Create the `visits`, `concern_scores`, `treatment_selections`, and `simulations` tables (schema in `IMPLEMENTATION.md` §5) with Row Level Security enabled, scoped to `auth.uid()`.
2. Create a **private** `visit-images` Storage bucket, restricted to `image/jpeg`/`image/png`, 10MB max.
3. Enable email/password auth and email OTP (magic link) auth.

## Scripts

```bash
npm run dev      # start the dev server
npm run build    # production build
npm run start    # run the production build
npm run lint     # eslint
npm test         # vitest
```

## Project structure

```
app/
  login/page.js                  sign in (password + magic link)
  visits/page.js                 visit history: list + trend graph (home after login)
  visits/new/page.js             capture → analysis → treatment → simulation flow
  visits/[id]/page.js            single visit detail
  visits/[id]/share/page.js      printable share-with-provider summary (one visit)
  visits/share/page.js           printable share-with-provider summary (full history)
  api/youcam/analyze/route.js    creates + polls the Skin Analysis task
  api/youcam/simulate/route.js   creates + polls the Skin Simulation task
components/                      CameraKitCapture, NewVisitFlow, VisitTrendChart, etc.
lib/
  concernKeyMap.js                canonical concern id → Analysis/Simulation API key mapping
  pollTask.js                     shared task-polling helper (Analysis + Simulation)
  storage.js                      signed URL + re-hosting helpers for the private bucket
  imageValidation.js              client-side dimension validation
  concern-treatment-config.json   the 10 concerns and their treatment options
```

## Notes

- The YouCam API key never touches client code — all calls go through `app/api/youcam/*` server routes.
- The Storage bucket is private; the DB stores only storage paths, never URLs. Signed URLs are generated fresh at the point of use and never persisted.
- Every YouCam result image (masks, simulation outputs) is downloaded and re-hosted into Supabase Storage immediately after a task succeeds, since YouCam's result URLs expire 2 hours after completion.
- Capture uses YouCam's JS Camera Kit rather than a plain file input — its live quality gate already enforces correct face framing, so there's no separate manual crop step.

See `CLAUDE.md` for the full list of non-negotiable constraints and build conventions.
