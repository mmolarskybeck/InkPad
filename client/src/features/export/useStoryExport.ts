import { useCallback, useState } from "react";
import {
  exportCompiledJson,
  exportInkSource,
  exportStoryHtml,
  type CompileInkSource,
} from "./storyExportService";
import type { HtmlExportOptions } from "./html-export-options";
import { trackExportClicked } from "@/lib/analytics";

interface UseStoryExportOptions {
  getSource: () => string;
  title: string;
  author: string;
  filename: string;
  compileStory: CompileInkSource;
  onError?: (message: string, error: unknown) => void;
}

export function useStoryExport({
  getSource,
  title,
  author,
  filename,
  compileStory,
  onError,
}: UseStoryExportOptions) {
  const [isExporting, setIsExporting] = useState(false);

  const exportInk = useCallback(() => {
    const source = getSource();
    trackExportClicked({ format: "ink", storyText: source });
    try {
      exportInkSource({ source, filename });
    } catch (error) {
      onError?.("Failed to export Ink", error);
    }
  }, [filename, getSource, onError]);

  const exportJson = useCallback(async () => {
    const source = getSource();
    trackExportClicked({ format: "json", storyText: source });
    setIsExporting(true);
    try {
      await exportCompiledJson({
        source,
        title,
        filename,
        compileStory,
      });
    } catch (error) {
      onError?.("Failed to export JSON", error);
    } finally {
      setIsExporting(false);
    }
  }, [compileStory, filename, getSource, onError, title]);

  const exportHtml = useCallback(async (htmlOptions: HtmlExportOptions) => {
    const source = getSource();
    trackExportClicked({ format: "html", storyText: source });
    setIsExporting(true);
    try {
      await exportStoryHtml({
        source,
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
  }, [author, compileStory, filename, getSource, onError, title]);

  return {
    exportInk,
    exportJson,
    exportHtml,
    isExporting,
  };
}
