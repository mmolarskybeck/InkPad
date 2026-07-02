import { AlertTriangle, Copy, Edit3, FolderOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StoredInkDocument } from "@/lib/file-operations";

interface LocalSavesDialogProps {
  open: boolean;
  files: StoredInkDocument[];
  currentFileName: string;
  storageAvailable?: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFile: (fileName: string) => void;
  onRenameFile: (fileName: string) => void;
  onDuplicateFile: (fileName: string) => void;
  onDeleteFile: (fileName: string) => void;
  onExport?: () => void;
}

function formatFileTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function LocalSavesDialog({
  open,
  files,
  currentFileName,
  storageAvailable = true,
  onOpenChange,
  onOpenFile,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onExport,
}: LocalSavesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[82vh] overflow-hidden bg-panel-bg border-border-color text-text-primary sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-text-emphasis">Local Saves</DialogTitle>
          <DialogDescription className="text-text-secondary">
            Open, rename, duplicate, or delete drafts saved in this browser.
          </DialogDescription>
        </DialogHeader>

        {!storageAvailable && (
          <div className="shrink-0 flex items-start gap-2 rounded border border-error/30 bg-error/8 px-3 py-2.5 text-[0.8125rem]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
            <div className="min-w-0">
              <p className="font-medium text-error">Browser storage is unavailable or full</p>
              <p className="mt-0.5 text-text-secondary">Autosave is disabled. Your current work is still active in this session, but you should export your .ink file before closing this tab.</p>
              {onExport && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onExport}
                  className="mt-1.5 h-7 px-2 text-[0.75rem] text-error hover:bg-error/10 hover:text-error"
                >
                  Export now
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto pr-1">
          {files.length === 0 ? (
            <div className="rounded border border-border-color bg-editor-bg p-6 text-center text-[0.875rem] text-text-secondary">
              {storageAvailable ? "No saved local drafts yet." : "Local saves are unavailable in this browser."}
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => {
                const isCurrentFile = file.name === currentFileName;

                return (
                  <div
                    key={file.name}
                    className="flex flex-col gap-3 rounded border border-border-color bg-editor-bg p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[0.9375rem] font-medium text-text-emphasis">
                          {file.settings?.title ?? file.name.replace(/\.ink$/i, "")}
                        </span>
                        {isCurrentFile && (
                          <span className="rounded bg-accent-blue/15 px-1.5 py-0.5 text-[0.6875rem] font-medium text-accent-blue">
                            open
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[0.75rem] text-text-secondary">
                        <span className="font-mono">{file.name}</span>
                        {" · "}
                        Saved {formatFileTime(file.lastSavedAt ?? file.lastModified)}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1 sm:flex sm:items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenFile(file.name)}
                        className="gap-1.5"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only">Open</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRenameFile(file.name)}
                        className="gap-1.5"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only">Rename</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDuplicateFile(file.name)}
                        className="gap-1.5"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only">Duplicate</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteFile(file.name)}
                        className="gap-1.5 text-error hover:bg-error/10 hover:text-error"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
