import { getFilename, replaceFilenameExtension } from "@/lib/filename-utils";
import type { InkCompileResult } from "@/lib/ink-compiler";
import type { InkCompileInput } from "@/types/worker-messages";
import { downloadBlob, downloadTextFile } from "@/features/files/fileDownload";
import {
  parseGlobalTags,
  resolveMetadata,
} from "@/lib/tag-interpreter";
import {
  DEFAULT_HTML_EXPORT_APPEARANCE,
  type HtmlExportOptions,
} from "./html-export-options";

export type CompileInkSource = (inkSource: string | InkCompileInput) => Promise<InkCompileResult | null>;

interface StoryExportOptions {
  source: string | InkCompileInput;
  title: string;
  author?: string;
  htmlOptions?: HtmlExportOptions;
  filename?: string;
  compileStory: CompileInkSource;
  /** Builds the editable .inkpad archive when htmlOptions.includeSource is set. */
  createSourceBundle?: () => Promise<Blob>;
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
  if (typeof source !== "string") {
    throw new Error("Use project export for multi-file InkPad projects.");
  }

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
  const [{ buildStoryHtml }, { createStoryZip }] = await Promise.all([
    import("./htmlTemplate"),
    import("./zipExport"),
  ]);
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
  const sourceBundle = htmlOptions.includeSource && options.createSourceBundle
    ? await options.createSourceBundle()
    : undefined;
  const zipBlob = await createStoryZip({
    html,
    title: metadata.title,
    includeReadme: htmlOptions.includeReadme,
    sourceBundle,
    theme: htmlOptions.theme,
    font: htmlOptions.font,
  });
  const filename = replaceFilenameExtension(
    options.filename ?? getFilename(metadata.title, ".ink"),
    ".zip",
  );

  downloadBlob(zipBlob, filename);
}
