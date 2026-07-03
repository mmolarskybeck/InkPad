import { useState } from "react";
import { Download, FileArchive, FileText, Braces, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

interface StoryExportDialogProps {
  onExportInk: () => void | Promise<void>;
  onExportProject?: () => void | Promise<void>;
  onExportProjectZip?: () => void | Promise<void>;
  onExportJson: () => void | Promise<void>;
  onConfigureHtml: () => void;
  hasMultipleFiles?: boolean;
  isExporting?: boolean;
}

export function StoryExportDialog({
  onExportInk,
  onExportProject,
  onExportProjectZip,
  onExportJson,
  onConfigureHtml,
  hasMultipleFiles = false,
  isExporting = false,
}: StoryExportDialogProps) {
  const [open, setOpen] = useState(false);

  const runExport = async (exportStory: () => void | Promise<void>) => {
    try {
      await exportStory();
    } finally {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-[0.8125rem] text-text-primary hover:bg-accent hover:text-text-emphasis"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] overflow-hidden border-border-color bg-panel-bg sm:max-w-md">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl font-semibold text-text-emphasis tracking-tight">Export Story</DialogTitle>
          <DialogDescription className="text-text-secondary text-[0.95rem]">
            Choose a format to export your current project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-2">
          <Button
            onClick={() => void runExport(onExportInk)}
            disabled={isExporting}
            variant="outline"
            className="h-auto w-full min-w-0 justify-start whitespace-normal border-border-color bg-editor-bg p-3 text-left hover:border-accent-blue hover:bg-accent"
          >
            <div className="mr-3 rounded-md bg-accent-blue/10 p-2">
              <FileText className="h-5 w-5 text-accent-blue" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[0.9375rem] font-semibold text-text-emphasis">Ink source</span>
              <span className="text-[0.8125rem] font-normal leading-5 text-text-secondary">Current file as editable .ink</span>
            </div>
          </Button>

          {hasMultipleFiles && onExportProject && (
            <>
              <Button
                onClick={() => void runExport(onExportProject)}
                disabled={isExporting}
                variant="outline"
                className="h-auto w-full min-w-0 justify-start whitespace-normal border-border-color bg-editor-bg p-3 text-left hover:border-accent-blue hover:bg-accent"
              >
                <div className="mr-3 rounded-md bg-accent-blue/10 p-2">
                  <FileArchive className="h-5 w-5 text-accent-blue" />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.9375rem] font-semibold text-text-emphasis">InkPad project</span>
                  <span className="text-[0.8125rem] font-normal leading-5 text-text-secondary">ZIP archive with .inkpad extension</span>
                </div>
              </Button>
              {onExportProjectZip && (
                <Button
                  onClick={() => void runExport(onExportProjectZip)}
                  disabled={isExporting}
                  variant="outline"
                  className="h-auto w-full min-w-0 justify-start whitespace-normal border-border-color bg-editor-bg p-3 text-left hover:border-accent-blue hover:bg-accent"
                >
                  <div className="mr-3 rounded-md bg-accent-blue/10 p-2">
                    <FileArchive className="h-5 w-5 text-accent-blue" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[0.9375rem] font-semibold text-text-emphasis">Project ZIP</span>
                    <span className="text-[0.8125rem] font-normal leading-5 text-text-secondary">Same archive, named .zip</span>
                  </div>
                </Button>
              )}
            </>
          )}

          <Button
            onClick={() => void runExport(onExportJson)}
            disabled={isExporting}
            variant="outline"
            className="h-auto w-full min-w-0 justify-start whitespace-normal border-border-color bg-editor-bg p-3 text-left hover:border-success hover:bg-accent"
          >
            <div className="mr-3 rounded-md bg-success/10 p-2">
              <Braces className="h-5 w-5 text-success" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[0.9375rem] font-semibold text-text-emphasis">Compiled JSON</span>
              <span className="text-[0.8125rem] font-normal leading-5 text-text-secondary">Story data for a game or custom player</span>
            </div>
          </Button>

          <Button
            onClick={() => {
              setOpen(false);
              window.setTimeout(onConfigureHtml, 0);
            }}
            disabled={isExporting}
            variant="outline"
            className="h-auto w-full min-w-0 justify-start whitespace-normal border-border-color bg-editor-bg p-3 text-left hover:border-warning hover:bg-accent"
          >
            <div className="mr-3 rounded-md bg-warning/10 p-2">
              <MonitorPlay className="h-5 w-5 text-warning" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[0.9375rem] font-semibold text-text-emphasis">Playable HTML</span>
              <span className="text-[0.8125rem] font-normal leading-5 text-text-secondary">
                Configure appearance and download a ZIP
              </span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
