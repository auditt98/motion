-- 010_soft_delete.sql
-- Add soft-delete support to pages table

-- Add columns
ALTER TABLE public.pages
  ADD COLUMN deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN deleted_by uuid REFERENCES public.users(id) DEFAULT NULL;

-- Partial index for efficient trash queries
CREATE INDEX idx_pages_soft_deleted
  ON public.pages(workspace_id, deleted_at)
  WHERE deleted_at IS NOT NULL;
