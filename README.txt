BME Portal v10.9 — safe first-load optimization and build cleanup

1) components/PwaBits.tsx
   - Defers production service-worker registration to 1.8 s AFTER window load.
   - Installation of the existing SW preloads the offline shell and hashed Next assets;
     moving this off the initial render may reduce bandwidth contention on first visits.
   - Keeps PWA installation banner, install flow, offline caches and existing SW intact.
   - No extra libraries and no changes to PDF, classes, alerts, search or Supabase.

2) tsconfig.json
   - Excludes five exact root-level duplicate TypeScript files accidentally uploaded
     outside their proper folders. This is a build/typecheck hygiene optimization,
     NOT a measurable mobile runtime speed optimization.
   - Includes all original app/components/lib files through existing include patterns.

GitHub duplicate files safe to remove manually, only after checking paths:
  /UploadForm.tsx
  /route (1).ts
  /route.ts
  /quizGenerator.ts
  /uploadLimits.ts
  /schema.sql
  /raise_materials_to_50mb.sql
These are byte-identical to their canonical copies under components/, app/api/,
lib/ or supabase/. Do not delete the canonical copies. GitHub UI Upload Files
cannot delete the old root copies automatically. Old README files and migrations
are not included in website downloads, and do not affect Lighthouse scores.

INSTALL:
1. Extract this ZIP.
2. Upload components/PwaBits.tsx and tsconfig.json to the exact same paths
   in your original GitHub repo's main branch. Upload the FILES, not the ZIP.
3. Verify Vercel deployment is READY; do not modify Supabase.
4. Optional: manually remove the seven old root-level duplicates in GitHub.

Important: This patch targets first-visit network contention, not every LCP cause.
A guaranteed PageSpeed increase is not possible; measure on consistent conditions.
Only syntax and static checks were run here, not a full live mobile Lighthouse test.
