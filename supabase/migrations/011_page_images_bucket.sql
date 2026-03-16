-- Create a public storage bucket for page images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'page-images',
  'page-images',
  true,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'page-images');

-- Allow public read access (images are embedded in shared documents)
CREATE POLICY "Public read access for page images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'page-images');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'page-images' AND auth.uid()::text = (storage.foldername(name))[1]);
