import { validateTitle } from "@/lib/filename-utils";
import {
  HTML_EXPORT_FONTS,
  HTML_EXPORT_THEMES,
  type HtmlExportFont,
  type HtmlExportTheme,
} from "./html-export-options";

interface HtmlStoryMetadata {
  title: string;
  author: string | null;
  theme: HtmlExportTheme;
  font: HtmlExportFont;
}

const STORY_TEMPLATE_URL = "/templates/story-template.html";

export async function loadStoryHtmlTemplate(
  fetchTemplate: typeof fetch = fetch
): Promise<string> {
  const templateResponse = await fetchTemplate(STORY_TEMPLATE_URL);
  if (!templateResponse.ok) {
    throw new Error("Failed to load HTML template");
  }

  return templateResponse.text();
}

export function renderStoryHtmlTemplate(
  htmlTemplate: string,
  compiledJson: string,
  metadata: HtmlStoryMetadata,
): string {
  const storyTitle = validateTitle(metadata.title);
  const author = metadata.author ?? "";
  const theme = (HTML_EXPORT_THEMES as readonly string[]).includes(metadata.theme)
    ? metadata.theme
    : "light";
  const font = (HTML_EXPORT_FONTS as readonly string[]).includes(metadata.font)
    ? metadata.font
    : "serif";
  const safeStoryData = serializeJsonForHtml(JSON.parse(compiledJson));
  const safeMetadata = serializeJsonForHtml({ title: storyTitle, author, theme, font });

  return htmlTemplate
    .replace(/\{\{STORY_TITLE\}\}/g, () => escapeHtml(storyTitle))
    .replace(/\{\{STORY_AUTHOR\}\}/g, () => escapeHtml(author))
    .replace(/\{\{STORY_THEME\}\}/g, () => theme)
    .replace(/\{\{STORY_FONT\}\}/g, () => font)
    .replace(/\{\{STORY_DATA\}\}/g, () => safeStoryData)
    .replace(/\{\{STORY_METADATA\}\}/g, () => safeMetadata);
}

export async function buildStoryHtml(
  compiledJson: string,
  metadata: HtmlStoryMetadata,
): Promise<string> {
  const htmlTemplate = await loadStoryHtmlTemplate();
  return renderStoryHtmlTemplate(htmlTemplate, compiledJson, metadata);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function serializeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
