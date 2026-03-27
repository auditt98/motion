-- Add default workspace preference to users
ALTER TABLE public.users
  ADD COLUMN default_workspace_id uuid
  REFERENCES public.workspaces(id) ON DELETE SET NULL;
