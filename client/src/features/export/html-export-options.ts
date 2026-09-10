import type { ThemeName } from "@/lib/tag-interpreter";

export const HTML_EXPORT_THEMES = [
  "light",
  "dark",
  "sepia",
  "high-contrast",
] as const;

export const HTML_EXPORT_FONTS = ["sans", "serif", "mono"] as const;

export type HtmlExportTheme = ThemeName;
export type HtmlExportFont = (typeof HTML_EXPORT_FONTS)[number];

export interface HtmlExportOptions {
  title: string;
  author: string;
  theme: HtmlExportTheme;
  font: HtmlExportFont;
  includeReadme: boolean;
  /** Adds the editable .inkpad project next to play.html. Off by default: it exposes comments and unpublished content. */
  includeSource: boolean;
}

export interface HtmlExportRequest extends HtmlExportOptions {
  rememberChoices: boolean;
}

export const DEFAULT_HTML_EXPORT_APPEARANCE = {
  theme: "light",
  font: "serif",
  includeReadme: true,
  includeSource: false,
} satisfies Pick<HtmlExportOptions, "theme" | "font" | "includeReadme" | "includeSource">;
