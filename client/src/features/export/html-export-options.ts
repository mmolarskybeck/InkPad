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
}

export interface HtmlExportRequest extends HtmlExportOptions {
  rememberChoices: boolean;
}

export const DEFAULT_HTML_EXPORT_APPEARANCE = {
  theme: "light",
  font: "serif",
  includeReadme: true,
} satisfies Pick<HtmlExportOptions, "theme" | "font" | "includeReadme">;
