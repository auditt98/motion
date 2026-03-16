# Image Upload (Drag & Drop + Paste)

## Problem

Images can only be inserted by URL. Users cannot drag images from their desktop, paste screenshots from clipboard, or upload files through a picker. This is a "feels broken" moment for new users who expect standard editor behavior.

## Priority

**Sprint 5.** ~1–2 days of effort. Medium trust impact but high UX impact.

## What to Build

### 1. Supabase Storage bucket

Create a `page-images` bucket in Supabase Storage:

- Public read access (images are embedded in documents shared across peers)
- Write access scoped to workspace members via RLS
- File path convention: `{workspace_id}/{page_id}/{uuid}.{ext}`
- Max file size: 10MB
- Allowed MIME types: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`

### 2. Upload service hook

New `apps/web/src/hooks/useImageUpload.ts`:

```typescript
function useImageUpload(workspaceId: string, pageId: string) {
  const upload = async (file: File): Promise<string> => {
    // Validate type and size
    // Generate unique path: `${workspaceId}/${pageId}/${uuid}.${ext}`
    // Upload to Supabase Storage
    // Return public URL
  };
  return { upload, uploading, error };
}
```

### 3. Editor drag & drop handling

Extend the Image extension in `packages/editor-extensions/src/extensions.ts`:

**Drop handler:**
- Listen for `drop` events on the editor
- Filter for image files in `dataTransfer.files`
- Upload each image → insert image node at drop position with returned URL
- Show placeholder node with spinner during upload

**Paste handler:**
- Listen for `paste` events
- Check `clipboardData.files` for images (screenshots, copied images)
- Same upload flow as drop

**File picker fallback:**
- Update the existing image toolbar button to open a file picker dialog
- Currently it prompts for a URL — add a tab/toggle: "Upload" | "URL"

### 4. Upload progress indicator

While an image is uploading:
- Insert a placeholder block with a loading spinner and progress bar
- On success: replace placeholder with the actual image node
- On failure: replace placeholder with an error message and retry button

### 5. Image resize and alignment (stretch goal)

- Add resize handles to image nodes (drag corners to resize)
- Store `width` as a node attribute (percentage or pixels)
- Alignment options in a floating toolbar: left, center, right, full-width
- Store as `align` node attribute

## Files to Modify

- `apps/web/src/hooks/useImageUpload.ts` (new)
- `packages/editor-extensions/src/extensions.ts` — extend Image extension with drop/paste handlers
- `apps/web/src/components/editor/EditorToolbar.tsx` — update image button to support file picker
- Supabase Storage configuration (dashboard or migration)

## Verification

1. Drag an image from desktop onto the editor → image uploads and appears
2. Paste a screenshot (Cmd+V) → image uploads and appears
3. Click image button in toolbar → file picker opens → select image → uploads
4. Upload a 15MB image → error message (exceeds 10MB limit)
5. Upload a non-image file → error message
6. Slow network: placeholder with spinner visible during upload
7. Image is visible to other connected peers after upload completes

## Dependencies

Needs Supabase Storage bucket configured. No code dependencies on other sprints.
