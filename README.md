# BME Portal v10.6 — Stability-first search rollback

## What changed
Reverts exactly ONE file: `components/OmniSearch.tsx` to the verified source used before v10.5 (Git blob SHA ea0564d21ccd5089734b7d4c1a0b3281a6c534f0).
The v10.5 dynamic ItemCard split added an additional client-side chunk with no demonstrated LCP improvement. This removes that experimental split.

## What remains untouched
All updates v10.4 and earlier: PDF/image readers, image + text, Dynamics sources, admin controls, announcements, schedules, PWA, quiz system, Supabase data. No database migration.

## Deploy
1. Extract the ZIP.
2. In the BME- GitHub main branch, replace ONLY `components/OmniSearch.tsx`.
3. Commit; wait for Vercel Ready.
4. Check homepage and search: 2+ characters -> results, item preview, favourites, back button; no other files changed.
5. Run PageSpeed Mobile 3–5 times against the same live URL, similar conditions; compare median LCP and Performance score. Results vary. A score of 100 cannot be guaranteed by this one-file rollback.

## Audit summary
- Production deployment reported READY at commit 471b3f6ecb64b0fbbc9bbf056a3c694f20ff5214.
- Last git commit (v10.5) changed this file plus README only.
- v10.4 did not change homepage client bundle except subsequent v10.5 search chunk.
- No access to Vercel runtime error groups (403); no full production build or comparative Lighthouse test was performed in this environment.
- CSS render-blocking ~150ms and legacy JS ~12KiB are low-value changes compared with observed LCP 3.9s, and are intentionally untouched.

## If score remains poor
Open LCP breakdown on PageSpeed to identify TTFB, resource load delay, and element render delay; compare the same URL and median of repeated tests rather than chasing one run. Do not blindly remove fonts or change framework target.
