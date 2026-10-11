-- Run once in your EXISTING BME4 Supabase project (SQL Editor).
-- Increases ONLY the existing materials bucket limit, without deleting files.
-- Important: Storage > Settings > Global file size limit must be >= 50 MB.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'materials') THEN
    RAISE EXCEPTION 'materials bucket was not found; no changes applied';
  END IF;
END $$;

UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'materials';

SELECT id, name, file_size_limit
FROM storage.buckets
WHERE id = 'materials';
