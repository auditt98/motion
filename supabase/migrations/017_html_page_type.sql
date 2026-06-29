-- Allow 'html' artifact pages (code + live preview) alongside documents and databases.
ALTER TABLE public.pages
  DROP CONSTRAINT IF EXISTS pages_page_type_check;

ALTER TABLE public.pages
  ADD CONSTRAINT pages_page_type_check
  CHECK (page_type IN ('document', 'database', 'html'));
