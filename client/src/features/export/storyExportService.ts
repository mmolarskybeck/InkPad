import { getFilename, replaceFilenameExtension } from "@/lib/filename-utils";
import type { InkCompileResult } from "@/lib/ink-compiler";
import { downloadBlob, downloadTextFile } from "@/features/files/fileDownload";
import { buildStoryHtml } from "./htmlTemplate";
import { createStoryZip } from "./zipExport";
import {
  parseGlobalTags,
  resolveMetadata,
} from "@/lib/tag-interpreter";
import {
  DEFAULT_HTML_EXPORT_APPEARANCE,
  type HtmlExportOptions,
} from "./html-export-options";

export type CompileInkSource = (inkSource: string) => Promise<InkCompileResult | null>;

interface StoryExportOptions {
  source: string;
  title: string;
  author?: string;
  htmlOptions?: HtmlExportOptions;
  filename?: string;
  compileStory: CompileInkSource;
}

function getCompileErrorMessage(result: InkCompileResult | null): string {
  return (
    result?.errors.map((error) => error.message).join(", ") ||
    "Compilation was superseded by a newer edit."
  );
}

async function compileForExport({
  source,
  compileStory,
}: Pick<StoryExportOptions, "source" | "compileStory">): Promise<InkCompileResult> {
  const result = await compileStory(source);

  if (!result?.compiledJson) {
    throw new Error(getCompileErrorMessage(result));
  }

  return result;
}

export function exportInkSource({
  source,
  filename,
}: Pick<StoryExportOptions, "source" | "filename">): void {
  downloadTextFile(
    source,
    replaceFilenameExtension(filename ?? "story.ink", ".ink"),
    "text/plain",
  );
}

export async function exportCompiledJson(
  options: StoryExportOptions
): Promise<void> {
  const result = await compileForExport(options);
  downloadTextFile(
    result.compiledJson!,
    replaceFilenameExtension(options.filename ?? "story.ink", ".json"),
    "application/json",
  );
}

export async function exportStoryHtml(options: StoryExportOptions): Promise<void> {
  const result = await compileForExport(options);
  const resolvedStoryMetadata = resolveMetadata(
    parseGlobalTags(result.runtimeStory?.globalTags),
    {
      title: options.title,
      author: options.author,
    },
    options.filename ?? getFilename(options.title, ".ink"),
  );
  const htmlOptions = options.htmlOptions ?? {
    title: resolvedStoryMetadata.title,
    author: resolvedStoryMetadata.author ?? "",
    ...DEFAULT_HTML_EXPORT_APPEARANCE,
  };
  const metadata = resolveMetadata(
    parseGlobalTags([]),
    {
      title: htmlOptions.title,
      author: htmlOptions.author,
    },
    options.filename ?? getFilename(options.title, ".ink"),
  );
  const html = await buildStoryHtml(result.compiledJson!, {
    title: metadata.title,
    author: metadata.author,
    theme: htmlOptions.theme,
    font: htmlOptions.font,
  });
  const zipBlob = await createStoryZip({
    html,
    title: metadata.title,
    includeReadme: htmlOptions.includeReadme,
  });
  const filename = replaceFilenameExtension(
    options.filename ?? getFilename(metadata.title, ".ink"),
    ".zip",
  );

  downloadBlob(zipBlob, filename);
}
