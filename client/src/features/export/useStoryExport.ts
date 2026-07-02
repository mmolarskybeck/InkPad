import { useCallback, useState } from "react";
import type { CompileInkSource } from "./storyExportService";
import type { HtmlExportOptions } from "./html-export-options";
import type { InkCompileInput } from "@/types/worker-messages";
import { trackExportClicked } from "@/lib/analytics";

interface UseStoryExportOptions {
  getSource: () => string;
  getCompileInput?: () => InkCompileInput;
  title: string;
  author: string;
  filename: string;
  compileStory: CompileInkSource;
  onError?: (message: string, error: unknown) => void;
}

export function useStoryExport({
  getSource,
  getCompileInput,
  title,
  author,
  filename,
  compileStory,
  onError,
}: UseStoryExportOptions) {
  const [isExporting, setIsExporting] = useState(false);

  const exportInk = useCallback(async () => {
    const source = getSource();
    trackExportClicked({ format: "ink", storyText: source });
    setIsExporting(true);
    try {
      const { exportInkSource } = await import("./storyExportService");
      exportInkSource({ source, filename });
    } catch (error) {
      onError?.("Failed to export Ink", error);
    } finally {
      setIsExporting(false);
    }
  }, [filename, getSource, onError]);

  const exportJson = useCallback(async () => {
    const source = getSource();
    trackExportClicked({ format: "json", storyText: source });
    setIsExporting(true);
    try {
      const { exportCompiledJson } = await import("./storyExportService");
      await exportCompiledJson({
        source: getCompileInput?.() ?? source,
        title,
        filename,
        compileStory,
      });
    } catch (error) {
      onError?.("Failed to export JSON", error);
    } finally {
      setIsExporting(false);
    }
  }, [compileStory, filename, getCompileInput, getSource, onError, title]);

  const exportHtml = useCallback(async (htmlOptions: HtmlExportOptions) => {
    const source = getSource();
    trackExportClicked({ format: "html", storyText: source });
    setIsExporting(true);
    try {
      const { exportStoryHtml } = await import("./storyExportService");
      await exportStoryHtml({
        source: getCompileInput?.() ?? source,
        title,
        author,
        htmlOptions,
        filename,
        compileStory,
      });
    } catch (error) {
      onError?.("Failed to export HTML", error);
    } finally {
      setIsExporting(false);
    }
  }, [author, compileStory, filename, getCompileInput, getSource, onError, title]);

  return {
    exportInk,
    exportJson,
    exportHtml,
    isExporting,
  };
}
