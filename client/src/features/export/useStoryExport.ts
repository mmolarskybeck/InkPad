import { useCallback, useState } from "react";
import {
  exportCompiledJson,
  exportInkSource,
  exportStoryHtml,
  type CompileInkSource,
} from "./storyExportService";

interface UseStoryExportOptions {
  getSource: () => string;
  title: string;
  compileStory: CompileInkSource;
  onError?: (message: string, error: unknown) => void;
}

export function useStoryExport({
  getSource,
  title,
  compileStory,
  onError,
}: UseStoryExportOptions) {
  const [isExporting, setIsExporting] = useState(false);

  const exportInk = useCallback(() => {
    try {
      exportInkSource({ source: getSource(), title });
    } catch (error) {
      onError?.("Failed to export Ink", error);
    }
  }, [getSource, onError, title]);

  const exportJson = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportCompiledJson({
        source: getSource(),
        title,
        compileStory,
      });
    } catch (error) {
      onError?.("Failed to export JSON", error);
    } finally {
      setIsExporting(false);
    }
  }, [compileStory, getSource, onError, title]);

  const exportHtml = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportStoryHtml({
        source: getSource(),
        title,
        compileStory,
      });
    } catch (error) {
      onError?.("Failed to export HTML", error);
    } finally {
      setIsExporting(false);
    }
  }, [compileStory, getSource, onError, title]);

  return {
    exportInk,
    exportJson,
    exportHtml,
    isExporting,
  };
}
