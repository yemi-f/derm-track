# CLAUDE.md

This file gives Claude Code persistent context for this repo. Read `IMPLEMENTATION.md` in full before writing any code — it's the source of truth for architecture, schema, screens, and API details. This file is the quick-reference layer on top of it: conventions, gotchas, and things not to redo or re-decide.

## What this is

A submission for the YouCam API Hackathon — a dermatology-clinic-provided web app where a patient tracks skin concerns over time using YouCam's AI Skin Analysis + AI Skin Simulation APIs, gets provider-framed treatment options per concern, and sees a projected outcome per treatment. Framing throughout: "[Clinic Name] gave you this app," not a self-diagnosing consumer tool.

## Stack (already decided — do not re-litigate)

- Next.js 14+, App Router, **plain JavaScript, no TypeScript**
- Supabase: email + password auth *and* passwordless magic-link auth (no Google OAuth or other third-party provider), Postgres, Storage
- Chart.js (via react-chartjs-2) for the visit-history line graph
- react-easy-crop for the pre-upload crop step
- Plain CSS with design tokens (see `IMPLEMENTATION.md` §7) — no CSS framework, no component library
- Deploy target: Vercel

Don't introduce TypeScript, Google OAuth or any other auth provider, a different DB, or a UI framework mid-build. If something in `IMPLEMENTATION.md` seems wrong once you're in the code, flag it and ask rather than silently swapping the approach.

## Non-negotiable constraints

1. **`YOUCAM_API_KEY` never touches client code.** All YouCam calls go through `app/api/youcam/*` server routes. If you find yourself calling `yce-api-01.makeupar.com` from a client component, stop — route it through our own API instead.
2. **Storage bucket is private, never public.** Store only storage *paths* in the database (`original_image_path`, `mask_image_path`, `simulated_image_path`) — never a URL. Resolve a path to a usable link only via a freshly-generated signed URL (`lib/storage.js`, `getSignedUrl`), at the moment it's needed: short expiry (~5 min) when handing it to YouCam as `src_file_url`, longer (~1 hr) when rendering it in the UI. Never persist a signed URL. This applies to every image: the original selfie, analysis masks, and simulation results.
3. **Re-host every YouCam result image immediately.** Download URLs expire 2 hours after task success; everything (analysis masks, simulation outputs) must be fetched server-side and re-uploaded to the private Supabase Storage bucket before it's ever shown to the user a second time or referenced in the DB. Never store a raw `yce-us.s3-accelerate.amazonaws.com` or similar YouCam-origin URL anywhere.
4. **Analysis and Simulation use different concern-key vocabularies.** Always go through `lib/concernKeyMap.js` — never hardcode a concern string in more than one place. See `IMPLEMENTATION.md` §9.3 for the full confirmed mapping (e.g. `eye_bag` in Analysis is `eye_bags` in Simulation).
5. **Row Level Security must be on** for `visits`, `concern_scores`, `treatment_selections`, `simulations` — scoped to `auth.uid()`. Combined with the private bucket, this is the actual privacy boundary for a health-adjacent app; don't ship either half without the other.
6. **SD tier only**, all 10 concerns from `lib/concern-treatment-config.json`. Don't mix HD and SD `dst_actions` — the API rejects it outright.
7. **Validate image dimensions before upload, not after a failed API call.** Min short side 480px (SD) is a hard reject; anything else routes through the crop/resize step. See `IMPLEMENTATION.md` §8.1.
8. **Use YouCam's JS Camera Kit for capture, not a plain file input.** It gives guided, in-browser capture with live face-quality feedback (lighting, pose, framing) before the shot is even taken. See the SDK reference in the YouCam API docs (`skincare` detection mode). Upload flow (crop/resize/validate, §8.1) still applies to whatever image comes out of it.

## In scope, not deferred

`IMPLEMENTATION.md` §11 now includes the visit detail page, share-with-provider export, and JS Camera Kit capture directly in the main build sequence — they're not a stretch-goal tier. If you're ever tempted to skip one of these to move faster, don't; there's no deadline pressure requiring that trade-off.

## Build order

Follow the milestone order in `IMPLEMENTATION.md` §11. Group related milestones into single prompts where they naturally belong together (e.g. capture + crop + analysis as one pass) rather than stopping after every small step. Use plan mode before larger prompts and review the plan before approving — cheap insurance against a wrong assumption compounding across a lot of generated code. Still worth pausing to manually verify at the genuine checkpoints: auth working end-to-end, first successful YouCam API call, first successful re-hosted image.

## Conventions

- File/route structure exactly as laid out in `IMPLEMENTATION.md` §8 — don't restructure the App Router tree.
- Server-side polling helper (`pollTask`) is shared logic — extract it once into `lib/pollTask.js` and reuse for both Analysis and Simulation, don't duplicate it per route.
- Loading states during polling should say what's happening ("Calling Skin Analysis…", "Running simulation…"), not a generic spinner — this is called out explicitly in `IMPLEMENTATION.md` §12 because the demo video needs to visibly show the API doing work.
- Error messages from YouCam error codes (`error_src_face_too_small`, `error_lighting_dark`, etc.) should be surfaced as plain-language UI copy, not raw error codes or stack traces — see the mapping in `IMPLEMENTATION.md` §9.2.
- Keep components reasonably small and un-abstracted, but a clean shared abstraction is fine now where it genuinely improves clarity — no need to default to the most minimal possible implementation.
- **Write tests around the two fragile spots**: the `concernKeyMap` translation (§9.3 — easy to typo `dark_circle_v2` vs `dark_circle` across the two APIs) and the polling helper (`pollTask`, shared between Analysis and Simulation). These are the places a silent bug is hardest to catch by eye.

## When something is ambiguous

If `IMPLEMENTATION.md` doesn't cover a decision (e.g. exact copy for an error state, minor layout choice), it's fine to ask rather than guess — there's no deadline pressure forcing a fast unilateral call here. Default toward asking when the decision affects data model, API contracts, or anything expensive to unwind; make a reasonable call and mention it in passing for small, easily-changed things like copy or spacing.
