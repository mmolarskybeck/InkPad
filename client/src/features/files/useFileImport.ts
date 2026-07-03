import { useCallback } from "react";

interface UseFileImportOptions {
  onLoad: (importedFile: ImportedFile) => void | Promise<void>;
  onError?: (message: string) => void;
  accept?: string;
  maxFileSizeBytes?: number;
}

export interface ImportedFile {
  importedFilename: string;
  importedSource: string | ArrayBuffer;
  kind: "text" | "archive";
}

const DEFAULT_MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function pickTextFile(
  accept: string,
  maxFileSizeBytes: number
): Promise<ImportedFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;

    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      if (file.size > maxFileSizeBytes) {
        reject(new Error(
          `${file.name} is ${formatBytes(file.size)}. InkPad can import files up to ${formatBytes(maxFileSizeBytes)}.`
        ));
        return;
      }

      const isArchive = /\.(?:inkpad|zip)$/i.test(file.name);
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        resolve({
          importedFilename: file.name,
          importedSource: loadEvent.target?.result as string | ArrayBuffer,
          kind: isArchive ? "archive" : "text",
        });
      };
      reader.onerror = () => resolve(null);
      if (isArchive) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    };

    input.click();
  });
}

export function useFileImport({
  onLoad,
  onError,
  accept = ".ink,.txt,.inkpad,.zip",
  maxFileSizeBytes = DEFAULT_MAX_IMPORT_FILE_BYTES,
}: UseFileImportOptions) {
  return useCallback(async () => {
    try {
      const importedFile = await pickTextFile(accept, maxFileSizeBytes);
      if (importedFile) {
        await onLoad(importedFile);
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Could not import file.");
    }
  }, [accept, maxFileSizeBytes, onError, onLoad]);
}
