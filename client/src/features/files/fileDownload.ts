import { saveAs } from "file-saver";

export function downloadBlob(blob: Blob, filename: string): void {
  saveAs(blob, filename);
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = "text/plain"
): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}
