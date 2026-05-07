import { validateTitle } from "@/lib/filename-utils";

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
  rawStoryJson: string,
  title: string
): string {
  const storyTitle = validateTitle(title);

  return htmlTemplate
    .replace(/\{\{STORY_TITLE\}\}/g, () => storyTitle)
    .replace(/\{\{STORY_DATA\}\}/g, () => rawStoryJson);
}

export async function buildStoryHtml(
  rawStoryJson: string,
  title: string
): Promise<string> {
  const htmlTemplate = await loadStoryHtmlTemplate();
  return renderStoryHtmlTemplate(htmlTemplate, rawStoryJson, title);
}
