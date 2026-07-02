import type { PreviewMode } from "@/types/story-runtime";
import type { HtmlExportFont, HtmlExportOptions } from "@/features/export/html-export-options";

export interface InkDocument {
  id?: string;
  filename: string;
  title?: string;
  source: string;
  author?: string;
  htmlExport?: HtmlExportOptions;
  storyTypeface?: HtmlExportFont;
  previewMode?: PreviewMode;
  updatedAt?: number;
  lastSavedAt?: number;
}
