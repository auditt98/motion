-- Change snapshot column from bytea to text.
-- We store base64-encoded Yjs state as plain text to avoid
-- double-encoding (Supabase REST API base64-encodes bytea on read).
ALTER TABLE public.page_versions ALTER COLUMN snapshot TYPE text USING encode(snapshot, 'escape');
