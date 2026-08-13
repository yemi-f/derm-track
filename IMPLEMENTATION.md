# Skin Journey — Implementation Doc

**For: Claude Code**
**Context:** YouCam API Hackathon (devpost.com/youcam-api). See CLAUDE.md for build-order and prompting conventions.

---

## 1. What we're building

A **dermatology-clinic-provided app** that lets a patient:

1. Sign in (email + password, or passwordless magic link)
2. Take/upload a selfie
3. Get an AI skin analysis across 10 concerns, each with a score
4. For each concern, see 2–3 treatment options "recommended by your provider"
5. Pick a treatment and see a realistic AI-simulated projection of that concern improving
6. See a **visit history** (list + line graph) of scores over time, showing real progress

Framing: **"[Clinic Name] gave you this app to track your treatment journey."** Not a self-diagnosing consumer app — a tool a patient uses between/around real dermatologist visits. Treatments are framed as things the provider already discussed, not app-generated medical advice.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14+, App Router, JavaScript (no TS)** | API routes = built-in backend, file routing = fast to scaffold |
| Auth + DB + Storage | **Supabase** | Email + password *and* passwordless magic-link auth, Postgres, file storage, all in one client |
| Charting | **Chart.js**, via **react-chartjs-2** | Canvas-based line graph for score trends; switched from Recharts after its tooltips proved unreliable — custom HTML tooltips (needed for the visit-photo preview) are driven via Chart.js's documented `external` tooltip hook |
| Image cropping | **react-easy-crop** | Lightweight drag/zoom crop UI, avoids repeated upload failures on dimension errors |
| Styling | Plain CSS / CSS modules with a small design-token file | Keeps things simple and consistent without pulling in a UI framework |
| Deployment | **Vercel** | Zero-config Next.js deploy, works with Supabase out of the box |

No TypeScript, no monorepo, no separate backend service. One Next.js app.

---

## 3. Environment variables

Create `.env.local`:

```
# YouCam API
YOUCAM_API_KEY=your_api_key_here
YOUCAM_API_BASE=https://yce-api-01.makeupar.com

# Supabase — use the new Publishable/Secret keys, not legacy anon/service_role
# (Dashboard → Settings → API Keys → "Publishable and secret API keys" tab — create these if the project doesn't have them yet)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SECRET_KEY=your_supabase_secret_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CLINIC_NAME=Riverside Dermatology
```

**Why the new keys, not `anon`/`service_role`:** functionally equivalent permission split (publishable = low-privilege, respects RLS, safe client-side; secret = bypasses RLS, server-only) but with real advantages — they rotate independently of the project's JWT signing secret, so a leaked key can be swapped without breaking active sessions, and Supabase's API gateway rejects a secret-shaped key outright if it's ever sent from a browser. Supabase has stated the legacy keys will eventually be deprecated. No reason to start a new project on them.

**Critical:** `YOUCAM_API_KEY` must only ever be read in server-side code (API routes / server components with `"use server"`). Never expose it in a client component or a `NEXT_PUBLIC_` variable. All YouCam calls go through our own `/api/youcam/*` routes, which attach the key server-side.

---

## 4. Why we need a database — and why storage must be private

YouCam's docs confirm: uploaded files and generated results are retained **30 days**, but the **download URL for a result is only valid for 2 hours** after processing completes. After that, you need the `task_id` to request a fresh link — and after 30 days, everything is gone regardless.

This means: **we must download every result image and re-upload it to our own storage (Supabase Storage) immediately after a task succeeds.** We cannot rely on YouCam's URLs for anything the user will see again later (visit history, trend graphs). This is not optional — it's the only way visit history works at all.

**The storage bucket must be private, not public.** These are photos of a person's face and skin, tied to health concerns — a public bucket means anyone with a URL can view them indefinitely, with no way to revoke access if a link ever leaks (browser history, a screenshot, a referrer header). That's inconsistent with the RLS we require on every DB table (§5) — locking down the rows while leaving the actual images world-readable defeats the purpose. Also restrict the bucket's `allowedMimeTypes` to `['image/jpeg', 'image/png']` and `fileSizeLimit` to 10MB — this backs up the client-side validation in §8.1 at the storage layer itself, so a bypass of the client check (e.g. a direct API call) still can't put an arbitrary file type into the bucket.

Instead: store only the **storage path** (e.g. `visits/{user_id}/{visit_id}/original.jpg`) in the database, never a URL. Resolve a path to an actual usable URL only at the moment it's needed, via a short-lived **signed URL**, generated server-side:

- **For YouCam to fetch the image** (as `src_file_url` in an Analysis/Simulation request): generate a signed URL with a short expiry (a few minutes) immediately before the API call, then let it expire.
- **For displaying an image to the user** (visit history, results screens, graph tooltip): generate a signed URL server-side (in the page or API route rendering it) with a bounded expiry — an hour is reasonable — rather than ever handing the browser a permanent link.

Flow: YouCam task succeeds → we fetch the result image from YouCam's URL server-side → upload it to the private Supabase Storage bucket → store the *path* in the database → discard YouCam's URL → generate a fresh signed URL any time that image needs to be shown or re-sent to YouCam.

---

## 5. Database schema (Supabase Postgres)

```sql
-- Supabase auth.users is automatic; we extend with a profile if needed later. Not required for MVP.

create table visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  original_image_path text not null, -- Supabase storage PATH (private bucket), not a URL — resolve via signed URL at request time
  notes text
);

create table concern_scores (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references visits(id) not null,
  concern_key text not null, -- e.g. 'redness', 'acne'
  ui_score integer not null,
  raw_score numeric,
  mask_image_path text, -- Supabase storage PATH of the detection mask, if we store it
  created_at timestamptz default now()
);

create table treatment_selections (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references visits(id) not null,
  concern_key text not null,
  treatment_id text not null, -- e.g. 'retinoid', 'sleep'
  created_at timestamptz default now()
);

create table simulations (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references visits(id) not null,
  concern_key text not null,
  treatment_id text not null,
  intensity numeric not null, -- 0.3 or 0.7
  simulated_image_path text not null, -- Supabase storage PATH
  created_at timestamptz default now()
);
```

Enable Row Level Security on all four tables, with policies restricting rows to `user_id = auth.uid()` (join through `visits.user_id` for the child tables). Pair this with the private storage bucket (§4) — RLS on the rows and a private bucket for the images are two halves of the same requirement, not separate concerns. This is a five-minute Supabase dashboard task — don't skip it, and for a health-adjacent app it matters even in a demo.

---

## 6. Auth

Use `@supabase/ssr` with Next.js App Router. **Two sign-in methods, both native to Supabase Auth, no third-party provider:**

- **Email + password** — standard `signUp({ email, password })` / `signInWithPassword({ email, password })`. Include this specifically to make judging fast and predictable: a judge can create an account and log back in immediately without waiting on an email, which matters when they're moving through multiple submissions quickly.
- **Passwordless email (magic link)** — `signInWithOtp({ email })`, for anyone who'd rather not set a password.

One login screen, both options visible — e.g. password fields plus a "or, email me a link instead" toggle/link. Don't make the judge hunt for either path.

Files:
- `app/login/page.js` — email + password fields with sign-in/sign-up, plus a magic-link alternative
- `app/signup/page.js` (or handle sign-up inline on `/login` via a toggle — simpler, one less route) — password account creation
- `app/auth/callback/route.js` — handles the magic-link redirect, exchanges code for session
- `middleware.js` — protects all routes except `/login`, `/signup` (if separate), and `/auth/callback`, redirects unauthenticated users to `/login`

---

## 7. Design system

**Palette (pink/tan, warm and clinical-but-soft):**

```css
:root {
  --color-bg: #FBF3EE;         /* warm off-white / tan base */
  --color-surface: #FFFFFF;
  --color-primary: #D98C99;     /* dusty pink - primary actions */
  --color-primary-dark: #B96A78;
  --color-accent: #E8B4A0;      /* warm tan/blush accent */
  --color-text: #3A2E2C;        /* warm near-black, not pure black */
  --color-text-muted: #8A7873;
  --color-border: #EFE0D7;
  --color-success: #8FA88A;     /* muted sage for positive trend */
  --color-warning: #D9A05B;     /* muted amber for concern flags */
  --radius: 16px;
  --shadow-soft: 0 4px 20px rgba(58, 46, 44, 0.08);
}
```

Typography: system font stack is fine (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`) — don't spend hackathon time on web fonts. Generous whitespace, rounded corners (`--radius`), soft shadows, no harsh borders. This should feel like a wellness app, not a hospital form.

---

## 8. Screens / routes

```
app/
  login/page.js                  → sign in
  page.js                        → redirect to /visits if authed
  visits/page.js                 → visit history: list + line graph (home screen after login)
  visits/new/page.js             → capture/upload flow → analysis → treatment → simulation
  visits/[id]/page.js            → view a single past visit's results
  api/youcam/upload/route.js     → proxies YouCam File API
  api/youcam/analyze/route.js    → creates + polls skin-analysis task
  api/youcam/simulate/route.js   → creates + polls skin-simulation task
  api/visits/route.js            → CRUD for visits (or use Supabase client directly from server components)
```

### 8.1 `visits/new` — the core flow, one page with steps (not separate routes, to keep state simple)

**Step A — Capture, crop & validate**

Don't let a bad photo reach the API and fail — validate and let the user fix framing *before* it's submitted. This is worth the extra build time; a failed API call after a slow upload is a bad demo moment.

1. File input (`<input type="file" accept="image/*" capture="user">` covers both "upload" and "take photo" on mobile in one control — simplest implementation, don't build a custom camera UI unless time allows)
2. On file select, read natural dimensions client-side (`Image()` + `naturalWidth/naturalHeight`, or `createImageBitmap`)
3. **Hard reject** (no crop can fix this) if the short side is below the SD minimum (480px) — show: "This photo is too low-resolution. Try a clearer, closer shot." Don't even open the cropper.
4. **Open the crop UI** (`react-easy-crop`) for anything that passes the minimum check. Let the user drag/zoom to frame their face — this is also where you solve the "face must be 60–80% of image width" requirement, since the crop tool naturally lets them zoom in on their own face rather than relying on their original framing.
5. **On crop confirm, resize down client-side via `<canvas>`** if the cropped result's long side exceeds 4096px (or proactively cap at 2560px, since the API auto-resizes anything larger than that anyway — no benefit to sending bigger). Use `canvas.toBlob()` to export the final JPEG/PNG for upload.
6. Reject non-jpg/jpeg/png at file-select time; warn (not hard-block, since crop shrinks it) if original file > 10MB.

```js
// lib/imageValidation.js
export async function getImageDimensions(file) {
  const bitmap = await createImageBitmap(file);
  return { width: bitmap.width, height: bitmap.height };
}

export function validateMinDimensions({ width, height }, tier = "SD") {
  const minShortSide = tier === "HD" ? 1080 : 480;
  const shortSide = Math.min(width, height);
  if (shortSide < minShortSide) {
    return { valid: false, message: `Photo resolution too low. Short side must be at least ${minShortSide}px.` };
  }
  return { valid: true };
}

// After crop, before upload: resize via canvas if long side > 2560
export function resizeIfNeeded(canvas, maxLongSide = 2560) {
  const longSide = Math.max(canvas.width, canvas.height);
  if (longSide <= maxLongSide) return canvas;
  const scale = maxLongSide / longSide;
  const resized = document.createElement("canvas");
  resized.width = canvas.width * scale;
  resized.height = canvas.height * scale;
  resized.getContext("2d").drawImage(canvas, 0, 0, resized.width, resized.height);
  return resized;
}
```

Flow order: select file → check min dimensions (hard reject if too small) → crop UI → resize-down on export if needed → upload the final blob to Supabase Storage → proceed to analysis.

**Step B — Analysis (loading state, then results)**
- On submit: upload to Supabase Storage (private bucket) first, storing the resulting *path*; generate a short-lived signed URL from that path server-side, then call `/api/youcam/analyze` with that signed URL as `src_file_url` and our 10 `dst_actions` (see §9)
- Show a loading state while polling (this can take several seconds — don't let the UI look frozen, use a spinner + rotating status text like "Analyzing texture… Checking for redness…")
- Results: grid of 10 concern cards, each showing `ui_score` (0–100) as a simple radial or bar indicator, sorted worst-to-best so the most relevant concerns surface first

**Step C — Treatment selection**
- Tap a concern card → expands to show 2–3 treatment options from the config (§10), framed as "Your provider may recommend:"
- Selecting one records a `treatment_selections` row and unlocks Step D for that concern

**Step D — Projection**
- Call `/api/youcam/simulate` for the selected concern at intensity 0.3, then 0.7
- Show a 3-way comparison: Original | +0.3 | +0.7, with a small disclaimer under it: *"Simulated preview, not a guarantee. Check in with [Clinic Name] on your progress."*
- Save each simulation result to Supabase Storage + `simulations` table

**Step E — Save visit**
- "Save this visit" button writes the `visits` row (if not already created in Step B) and redirects to `/visits`

### 8.2 `visits` — history (home screen)

- **List view**: reverse-chronological cards, one per visit, showing date + thumbnail + a one-line summary (e.g. "3 concerns tracked")
- **Line graph** (react-chartjs-2 `<Line>`, wrapping Chart.js): X-axis = visit date, Y-axis = score (0–100, set via `scales.y.min`/`max`), one dataset per concern (built-in Chart.js legend, cap at the concerns that have 2+ data points so the graph isn't cluttered on a first visit). Use the palette's `--color-primary` and a few complementary muted tones for multiple lines, not saturated defaults — **as literal hex values, not `var(--color-*)` strings**: Chart.js draws to `<canvas>`, and canvas 2D color properties don't reliably resolve CSS custom properties the way SVG/DOM styling does, so the hex equivalents of the design tokens are hardcoded where they feed the chart (line/grid/axis colors).
- **Hover tooltip shows the visit's photo**, not just the score. Chart.js's built-in canvas tooltip can't render arbitrary HTML (e.g. an `<img>`), so it's disabled (`plugins.tooltip.enabled: false`) in favor of Chart.js's documented `external` tooltip hook, which drives a plain absolutely-positioned `<div>` rendered as a sibling of the chart canvas:

```jsx
// components/VisitTrendChart.jsx (relevant part)
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Legend, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";

// Tooltip must be explicitly registered — react-chartjs-2's <Line> only
// auto-registers LineController, not the tooltip plugin.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Legend, Tooltip);

function externalTooltipHandler({ chart, tooltip }) {
  const el = tooltipRef.current; // useRef(null), rendered as <div ref={tooltipRef} /> beside <Line>
  if (tooltip.opacity === 0) { el.style.opacity = 0; return; }

  const point = data[tooltip.dataPoints[0].dataIndex]; // { date, imageUrl, [concernId]: score, ... }
  el.replaceChildren(); // rebuild: thumbnail <img src={point.imageUrl}>, date, one row per
                         // tooltip.dataPoints entry ("{dp.dataset.label}: {dp.formattedValue}/100")

  el.style.opacity = 1;
  el.style.left = `${chart.canvas.offsetLeft + tooltip.caretX}px`;
  el.style.top = `${chart.canvas.offsetTop + tooltip.caretY}px`;
}

// Usage: <Line data={chartData} options={{ plugins: { tooltip: { enabled: false, external: externalTooltipHandler } } }} />
```

Each chart data point needs an `imageUrl` — but since the bucket is private, this isn't a stored value, it's a **signed URL generated server-side at request time** from the visit's `original_image_path`. Build the chart data server-side: join `visits` and `concern_scores` on `visit_id`, generate one signed URL per visit (reuse it across that visit's data points rather than re-signing per point), and attach it to each point before sending the chart data to the client component.
- Toggle or tab between list and graph, or stack them (graph on top, list below) — stacking is simpler to build, do that.

### 8.3 `visits/[id]` — single visit detail

- Shows that visit's original photo, all concern scores, treatments selected, and simulation images. Useful for the "share with provider" idea later, and for demo narration ("here's what we saw in March").

---

## 9. YouCam API integration

### 9.1 Auth
Every request: header `Authorization: Bearer YOUCAM_API_KEY` (server-side only, from `/api/youcam/*` routes).

### 9.2 Skin Analysis — full flow

```js
// app/api/youcam/analyze/route.js  (simplified — implement error handling per below)
import { getSignedUrl } from "@/lib/storage";

const CONCERNS = [
  "wrinkle", "acne", "oiliness", "eye_bag", "dark_circle_v2",
  "age_spot", "pore", "texture", "redness", "radiance"
]; // SD tier, all 10 are simulation-eligible — see concern-treatment-config.json

export async function POST(req) {
  const { imagePath } = await req.json(); // storage PATH, e.g. "visits/{user_id}/{visit_id}/original.jpg"

  // Short-lived signed URL — just long enough for YouCam to fetch it
  const signedUrl = await getSignedUrl(imagePath, { expiresInSeconds: 300 });

  // Step 1: create task directly using src_file_url — skips the file-upload dance
  const createRes = await fetch(`${process.env.YOUCAM_API_BASE}/s2s/v2.0/task/skin-analysis`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.YOUCAM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      src_file_url: signedUrl,
      dst_actions: CONCERNS,
      format: "json",
    }),
  });
  const { data } = await createRes.json();
  const taskId = data.task_id;

  // Step 2: poll
  const result = await pollTask(`${process.env.YOUCAM_API_BASE}/s2s/v2.0/task/skin-analysis/${taskId}`);
  return Response.json(result);
}

async function pollTask(url, { intervalMs = 2000, maxAttempts = 30 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.YOUCAM_API_KEY}` },
    });
    const json = await res.json();
    if (json.data.task_status === "success") return json.data;
    if (json.data.task_status === "error") throw new Error("Skin analysis task failed");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Skin analysis task timed out");
}
```

**Important — using `src_file_url` instead of the File API:** since we already upload the selfie to Supabase Storage as part of saving the visit, we can generate a signed URL from that private object and pass it directly as `src_file_url`, skipping YouCam's separate File API upload/PUT dance entirely. This cuts real complexity out of the build. The bucket stays private the whole time — YouCam only ever sees a short-lived signed link, never a permanent public one, and that link is worthless once its few-minute expiry passes.

**Response shape (format=json):**
```json
{
  "task_status": "success",
  "results": {
    "output": [
      { "type": "redness", "ui_score": 77, "raw_score": 72.0, "mask_urls": ["https://..."] }
    ]
  }
}
```
Map each `output[]` entry to a `concern_scores` row. Download `mask_urls[0]` and re-upload to the private Supabase Storage bucket before the 2-hour window closes (do this immediately, server-side, right after the task succeeds — don't defer it), storing the resulting path in `mask_image_path`.

**Errors to handle explicitly** (surface a friendly message, don't just show a stack trace):
- `error_src_face_too_small` — "Face needs to fill more of the frame — try moving closer."
- `error_lighting_dark` — "Lighting's too dark — try a brighter spot."
- `error_below_min_image_size` / `error_exceed_max_image_size` — resize/resubmit
- Generic `cannot mix HD and SD dst_actions` — shouldn't happen since we hardcode SD only, but don't let a typo in the concern list silently break

### 9.3 Skin Simulation — same pattern, different endpoint, DIFFERENT FIELD NAMES

**Confirmed real payload** (from Playground — all 10 concern keys):

```json
{
  "src_file_url": "https://plugins-media.makeupar.com/strapi/assets/skin_analysis_01_5b5defd339.png",
  "acne": 1,
  "dark_circle": 0.5,
  "eye_bags": 0.7,
  "oiliness": 0.7,
  "pores": 0.5,
  "radiance": 0.7,
  "redness": 0.7,
  "spots": 0.7,
  "texture": 0.7,
  "wrinkle": 0.7
}
```

Simulation takes a **flat map of concern-key → intensity (0.0–1.0)** directly on the body, alongside `src_file_url` — not a `dst_actions` array like Analysis uses. You only include the keys you want simulated; omit the rest.

**⚠️ Critical: Simulation's concern keys do NOT match Analysis's `dst_actions` keys.** Don't reuse the same strings across both endpoints or requests will silently fail or target the wrong concern. Full confirmed mapping (all 10):

| Analysis `dst_actions` key | Simulation payload key |
|---|---|
| `wrinkle` | `wrinkle` |
| `acne` | `acne` |
| `oiliness` | `oiliness` |
| `eye_bag` | `eye_bags` |
| `dark_circle_v2` | `dark_circle` |
| `age_spot` | `spots` |
| `pore` | `pores` |
| `texture` | `texture` |
| `redness` | `redness` |
| `radiance` | `radiance` |

Note the inconsistent pluralization is real, not a typo on our part — `eye_bags`, `spots`, `pores` are plural, the rest are singular. Match it exactly.

Build a single lookup table (`lib/concernKeyMap.js`) translating our canonical concern id (used throughout the app and in `concern-treatment-config.json`) to each API's specific key, so the rest of the codebase never has to think about this mismatch:

```js
// lib/concernKeyMap.js
export const CONCERN_KEY_MAP = {
  wrinkle:        { analysis: "wrinkle",        simulation: "wrinkle" },
  acne:           { analysis: "acne",           simulation: "acne" },
  oiliness:       { analysis: "oiliness",       simulation: "oiliness" },
  eye_bag:        { analysis: "eye_bag",        simulation: "eye_bags" },
  dark_circle_v2: { analysis: "dark_circle_v2", simulation: "dark_circle" },
  age_spot:       { analysis: "age_spot",       simulation: "spots" },
  pore:           { analysis: "pore",           simulation: "pores" },
  texture:        { analysis: "texture",        simulation: "texture" },
  redness:        { analysis: "redness",        simulation: "redness" },
  radiance:       { analysis: "radiance",       simulation: "radiance" },
};
```

```js
// app/api/youcam/simulate/route.js
import { CONCERN_KEY_MAP } from "@/lib/concernKeyMap";
import { getSignedUrl } from "@/lib/storage";

export async function POST(req) {
  const { imagePath, concern, intensity } = await req.json();
  const simKey = CONCERN_KEY_MAP[concern].simulation;
  const signedUrl = await getSignedUrl(imagePath, { expiresInSeconds: 300 });

  const createRes = await fetch(`${process.env.YOUCAM_API_BASE}/s2s/v2.0/task/skin-simulation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.YOUCAM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      src_file_url: signedUrl,
      [simKey]: intensity,
    }),
  });
  const { data } = await createRes.json();
  const result = await pollTask(`${process.env.YOUCAM_API_BASE}/s2s/v2.0/task/skin-simulation/${data.task_id}`);
  return Response.json(result);
}
```

### 9.4 Storage helpers (used throughout — private bucket, path-based)

```js
// lib/storage.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

// Fetch a YouCam result image and re-host it in our PRIVATE bucket. Returns the storage PATH, not a URL.
export async function rehostImage(youcamUrl, path) {
  const res = await fetch(youcamUrl);
  const blob = await res.blob();
  const { error } = await supabase.storage.from("visit-images").upload(path, blob, {
    contentType: blob.type,
    upsert: true,
  });
  if (error) throw error;
  return path; // store this in the DB, not a URL
}

// Resolve a storage PATH to a short-lived signed URL, generated fresh at the point of use —
// for a YouCam fetch (short expiry, e.g. 300s) or for display in the UI (longer, e.g. 3600s).
export async function getSignedUrl(path, { expiresInSeconds = 3600 } = {}) {
  const { data, error } = await supabase.storage
    .from("visit-images")
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
```

Call `rehostImage` immediately after every successful YouCam task, for every image URL you get back (analysis masks, simulation results) — store the returned *path*, never a URL, in the database. Call `getSignedUrl` fresh every time an image needs to actually be fetched or shown — by YouCam, by a page render, or by the chart tooltip. Never persist a signed URL anywhere; it's meant to expire.

---

## 10. Concern → treatment config

Already scoped to the 10 simulation-eligible concerns. Drop this in as `lib/concern-treatment-config.json` and import it directly — no need to regenerate.

```json
{
  "concerns": [
    { "id": "wrinkle", "label": "Wrinkles", "treatments": [
      { "id": "retinoid", "label": "Retinoid" },
      { "id": "sleep", "label": "Sleep / rest" },
      { "id": "sunscreen", "label": "Sunscreen consistency" }
    ]},
    { "id": "acne", "label": "Acne", "treatments": [
      { "id": "topical", "label": "Topical treatment" },
      { "id": "diet", "label": "Dietary adjustment" },
      { "id": "extraction", "label": "Professional extraction" }
    ]},
    { "id": "oiliness", "label": "Oiliness", "treatments": [
      { "id": "oil_control_cleanser", "label": "Oil-control cleanser" },
      { "id": "niacinamide", "label": "Niacinamide serum" }
    ]},
    { "id": "eye_bag", "label": "Eye bags", "treatments": [
      { "id": "sleep", "label": "Sleep / rest" },
      { "id": "cold_compress", "label": "Cold compress routine" },
      { "id": "caffeine_eye_cream", "label": "Caffeine eye cream" }
    ]},
    { "id": "dark_circle_v2", "label": "Dark circles", "treatments": [
      { "id": "sleep", "label": "Sleep / rest" },
      { "id": "vitamin_k_retinol_eye_cream", "label": "Vitamin K / retinol eye cream" }
    ]},
    { "id": "age_spot", "label": "Age spots", "treatments": [
      { "id": "vitamin_c_serum", "label": "Vitamin C serum" },
      { "id": "sunscreen", "label": "Sunscreen" },
      { "id": "laser_peel", "label": "Professional laser / peel" }
    ]},
    { "id": "pore", "label": "Pores", "treatments": [
      { "id": "salicylic_acid", "label": "Salicylic acid" },
      { "id": "clay_mask", "label": "Clay mask routine" }
    ]},
    { "id": "texture", "label": "Texture", "treatments": [
      { "id": "exfoliation", "label": "Exfoliation routine" },
      { "id": "microdermabrasion", "label": "Professional microdermabrasion" }
    ]},
    { "id": "redness", "label": "Redness", "treatments": [
      { "id": "anti_inflammatory", "label": "Anti-inflammatory skincare" },
      { "id": "avoid_triggers", "label": "Avoid triggers (heat / alcohol)" },
      { "id": "rosacea_treatment", "label": "Rosacea treatment" }
    ]},
    { "id": "radiance", "label": "Radiance", "treatments": [
      { "id": "hydration_routine", "label": "Hydration routine" },
      { "id": "sleep", "label": "Sleep / rest" },
      { "id": "vitamin_c", "label": "Vitamin C" }
    ]}
  ],
  "simulation_intensity_steps": [0.3, 0.7],
  "analysis_tier": "SD"
}
```

---

## 11. Build order

1. **Scaffold**: `create-next-app` (JS, App Router, no TS), install `@supabase/supabase-js`, `@supabase/ssr`, `chart.js`, `react-chartjs-2`, `react-easy-crop`
2. **Supabase project**: create tables (§5), enable RLS, create a **private** `visit-images` storage bucket with `allowedMimeTypes` restricted to `['image/jpeg', 'image/png']` and `fileSizeLimit` set to 10MB (do not make it public — see §4), enable email/password auth and email OTP (magic link) auth
3. **Auth**: login page with email + password (sign-in and sign-up) plus a magic-link alternative, callback route, middleware guard — confirm you can sign in both ways and land on a protected page
4. **Capture → crop/validate → Analysis loop**: YouCam JS Camera Kit capture (or upload fallback) → dimension check → crop UI → resize-down → upload to storage → call `/api/youcam/analyze` (confirmed working via Playground first) → render scores. This is the spine of the whole demo — get it working end-to-end before moving on.
5. **Treatment selection UI**: concern card → expand → pick a treatment → save selection
6. **Simulation**: `concernKeyMap.js` is fully confirmed (§9.3) — wire `/api/youcam/simulate` directly, render 3-way comparison
7. **Save visit + visit list**: write to `visits`, show reverse-chron list on `/visits`
8. **Visit detail page** (`visits/[id]`): full record of a single visit — photo, scores, treatments selected, simulation results
9. **Line graph**: Chart.js (react-chartjs-2) trend view with hover image preview — needs at least 2 visits to look meaningful, so seed a second visit for demo purposes if needed
10. **Share-with-provider export**: doctor-readable summary (scores + trend + treatments tried) generated from a visit or the full history
11. **Polish pass**: disclaimer copy, clinic-name framing on login/onboarding, loading states (see §12), error messages

---

## 12. Demo script reminder

The devpost video needs to **show the API calls happening**, not just the end result — narrate or visually indicate "calling Skin Analysis… calling Skin Simulation…" during the loading states rather than hiding them behind a generic spinner. That loading-state copy earns you Technological Implementation points almost for free.
