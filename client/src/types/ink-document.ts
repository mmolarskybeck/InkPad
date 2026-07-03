import type { PreviewMode } from "@/types/story-runtime";
import type { HtmlExportFont, HtmlExportOptions } from "@/features/export/html-export-options";

export interface InkDocument {
  id: string;
  filename: string;
  title?: string;
  source: string;
  /**
   * Transient naming hint for the project wrapper built from this document:
   * false = a genuinely new/imported document whose names should auto-follow
   * the story title until pinned; undefined = treat names as already chosen
   * (legacy saves and anything else that predates the naming model).
   */
  namingExplicit?: boolean;
  author?: string;
  htmlExport?: HtmlExportOptions;
  storyTypeface?: HtmlExportFont;
  previewMode?: PreviewMode;
  updatedAt?: number;
  lastSavedAt?: number;
}
