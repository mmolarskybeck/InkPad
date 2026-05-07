import JSZip from "jszip";
import { validateTitle } from "@/lib/filename-utils";

interface StoryZipOptions {
  html: string;
  title: string;
}

function createReadme(title: string): string {
  const storyTitle = validateTitle(title);

  return `# ${storyTitle}

This is an interactive story created with InkPad.

## How to Play

1. Double-click on "play.html" to open the story in your web browser
2. Read the text and click on choices to progress through the story
3. Use the "Play Again" button to restart the story

## Technical Details

This story was created using:
- Ink scripting language by Inkle Studios
- InkPad web-based IDE
- InkJS runtime for web playback

Enjoy your story!
`;
}

export async function createStoryZip({
  html,
  title,
}: StoryZipOptions): Promise<Blob> {
  const zip = new JSZip();

  zip.file("play.html", html);
  zip.file("README.md", createReadme(title));

  return zip.generateAsync({ type: "blob" });
}
