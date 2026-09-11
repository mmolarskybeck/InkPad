import JSZip from "jszip";
import { validateTitle } from "@/lib/filename-utils";
import { createReadmeHtml, type ReadmeOptions } from "./readmeTemplate";

interface StoryZipOptions {
  html: string;
  title: string;
  includeReadme?: boolean;
  /** Editable .inkpad project archive to place beside index.html. */
  sourceBundle?: Blob;
  /** Appearance the story was exported with; shown in README.html. */
  theme?: ReadmeOptions["theme"];
  font?: ReadmeOptions["font"];
}

export async function createStoryZip({
  html,
  title,
  includeReadme = true,
  sourceBundle,
  theme = "light",
  font = "serif",
}: StoryZipOptions): Promise<Blob> {
  const zip = new JSZip();

  zip.file("index.html", html);
  if (includeReadme) {
    zip.file(
      "README.html",
      createReadmeHtml({
        title: validateTitle(title),
        theme,
        font,
        includesSource: Boolean(sourceBundle),
      }),
    );
  }
  if (sourceBundle) {
    zip.file("source.inkpad", sourceBundle);
  }

  return zip.generateAsync({ type: "blob" });
}
