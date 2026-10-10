-- BME Portal v10.4: new category for Dynamics references (no existing data removed).
-- Run once in Supabase -> SQL Editor BEFORE uploading the matching code.
BEGIN;
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_category_check;
ALTER TABLE public.items ADD CONSTRAINT items_category_check
  CHECK (category IN ('lectures','sources','reports','quizzes','midterms','finals','summaries','videos'));
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_sources_dynamics_only;
ALTER TABLE public.items ADD CONSTRAINT items_sources_dynamics_only
  CHECK (category <> 'sources' OR (subject_slug = 'dynamics-of-human' AND track = 'main'));
COMMIT;
