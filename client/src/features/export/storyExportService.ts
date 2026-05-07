import { getFilename } from "@/lib/filename-utils";
import type { InkCompileResult } from "@/lib/ink-compiler";
import { downloadBlob, downloadTextFile } from "@/features/files/fileDownload";
import { buildStoryHtml } from "./htmlTemplate";
import { createStoryZip } from "./zipExport";

export type CompileInkSource = (inkSource: string) => Promise<InkCompileResult | null>;

interface StoryExportOptions {
  source: string;
  title: string;
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
}: Pick<StoryExportOptions, "source" | "compileStory">): Promise<string> {
  const result = await compileStory(source);

  if (!result?.compiledJson) {
    throw new Error(getCompileErrorMessage(result));
  }

  return result.compiledJson;
}

export function exportInkSource({
  source,
  title,
}: Pick<StoryExportOptions, "source" | "title">): void {
  downloadTextFile(source, getFilename(title, ".ink"), "text/plain");
}

export async function exportCompiledJson(
  options: StoryExportOptions
): Promise<void> {
  const compiledJson = await compileForExport(options);
  downloadTextFile(compiledJson, getFilename(options.title, ".json"), "application/json");
}

export async function exportStoryHtml(options: StoryExportOptions): Promise<void> {
  const compiledJson = await compileForExport(options);
  const html = await buildStoryHtml(compiledJson, options.title);
  const zipBlob = await createStoryZip({ html, title: options.title });
  const filename =
    options.title === "story" ? "inkpad_story.zip" : getFilename(options.title, ".zip");

  downloadBlob(zipBlob, filename);
}
