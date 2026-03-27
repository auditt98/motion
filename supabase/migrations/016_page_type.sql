-- Add page_type column to distinguish document pages from database pages
ALTER TABLE public.pages
  ADD COLUMN page_type text NOT NULL DEFAULT 'document'
  CHECK (page_type IN ('document', 'database'));

CREATE INDEX idx_pages_type ON public.pages(workspace_id, page_type);
