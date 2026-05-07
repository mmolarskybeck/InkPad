import { useCallback } from "react";

interface UseFileImportOptions {
  onLoad: (fileName: string, content: string) => void;
  accept?: string;
}

interface ImportedFile {
  fileName: string;
  content: string;
}

function pickTextFile(accept: string): Promise<ImportedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;

    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        resolve({
          fileName: file.name,
          content: loadEvent.target?.result as string,
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };

    input.click();
  });
}

export function useFileImport({
  onLoad,
  accept = ".ink,.txt",
}: UseFileImportOptions) {
  return useCallback(async () => {
    const importedFile = await pickTextFile(accept);
    if (importedFile) {
      onLoad(importedFile.fileName, importedFile.content);
    }
  }, [accept, onLoad]);
}
