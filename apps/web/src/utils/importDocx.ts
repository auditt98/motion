import mammoth from "mammoth";
import { htmlToDoc } from "./importHTML";
import type { ImportResult } from "./importHTML";

/**
 * Convert a .docx file to a ProseMirror JSON document using mammoth.
 */
export async function docxToDoc(file: File): Promise<ImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });

  const { title, doc } = htmlToDoc(result.value);

  // Use filename (without extension) as title if no H1 was found
  const finalTitle =
    title !== "Untitled"
      ? title
      : file.name.replace(/\.docx?$/i, "") || "Untitled";

  return { title: finalTitle, doc };
}
