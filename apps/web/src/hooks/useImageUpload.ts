import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const BUCKET = "page-images";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

export function useImageUpload(workspaceId: string | null, pageId: string) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File): Promise<string | null> => {
      setError(null);

      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Unsupported file type. Use PNG, JPEG, GIF, WebP, or SVG.");
        return null;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError("File too large. Maximum size is 10 MB.");
        return null;
      }

      const ext = file.name.split(".").pop() || "png";
      const id = crypto.randomUUID();
      const path = workspaceId
        ? `${workspaceId}/${pageId}/${id}.${ext}`
        : `shared/${pageId}/${id}.${ext}`;

      setUploading(true);
      try {
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });

        if (uploadError) {
          setError(uploadError.message);
          return null;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET).getPublicUrl(path);

        return publicUrl;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        return null;
      } finally {
        setUploading(false);
      }
    },
    [workspaceId, pageId],
  );

  return { upload, uploading, error };
}
