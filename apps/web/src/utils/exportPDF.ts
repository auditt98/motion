import type { Editor } from "@tiptap/react";
import { buildHTMLDocument } from "./exportHTML";

export function exportAsPDF(editor: Editor, title: string): void {
  const html = editor.getHTML();
  const doc = buildHTMLDocument(title, html);

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to export as PDF.");
    return;
  }

  printWindow.document.write(doc);
  printWindow.document.close();

  // Wait for images/styles to load before printing
  printWindow.onload = () => {
    printWindow.print();
  };
}
