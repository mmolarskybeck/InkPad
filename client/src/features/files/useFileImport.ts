import { useCallback } from "react";

interface UseFileImportOptions {
  onLoad: (importedFilename: string, importedSource: string) => void;
  accept?: string;
}

interface ImportedFile {
  importedFilename: string;
  importedSource: string;
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
          importedFilename: file.name,
          importedSource: loadEvent.target?.result as string,
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
      onLoad(importedFile.importedFilename, importedFile.importedSource);
    }
  }, [accept, onLoad]);
}
