import { useState } from "react";
import { Download, FileArchive, FileText, Braces, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface StoryExportMenuProps {
  onExportInk: () => void | Promise<void>;
  onExportProject?: () => void | Promise<void>;
  onExportProjectZip?: () => void | Promise<void>;
  onExportJson: () => void | Promise<void>;
  onConfigureHtml: () => void;
  hasMultipleFiles?: boolean;
  isExporting?: boolean;
}

export function StoryExportMenu({
  onExportInk,
  onExportProject,
  onExportProjectZip,
  onExportJson,
  onConfigureHtml,
  hasMultipleFiles = false,
  isExporting = false,
}: StoryExportMenuProps) {
  const [open, setOpen] = useState(false);

  const runExport = async (exportStory: () => void | Promise<void>) => {
    try {
      await exportStory();
    } finally {
      setOpen(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-[0.8125rem] text-text-primary hover:bg-accent hover:text-text-emphasis data-[state=open]:bg-accent data-[state=open]:text-text-emphasis"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[320px] bg-panel-bg border-border-color p-2 shadow-sm">
        <DropdownMenuLabel className="px-2 pt-1.5 pb-2">
          <div className="text-[0.9375rem] font-semibold text-text-emphasis tracking-tight">Export Story</div>
          <div className="text-[0.8125rem] font-normal text-text-secondary mt-0.5">Choose a format to export.</div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator className="bg-border-color/50 mb-2" />
        
        <div className="grid gap-1">
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              void runExport(onExportInk);
            }}
            disabled={isExporting}
            className="flex items-start gap-3 rounded-md p-2.5 cursor-pointer transition-all duration-200 focus:bg-accent focus:outline-none active:scale-[0.98] data-[disabled]:opacity-50"
          >
            <div className="shrink-0 rounded bg-accent-blue/10 p-1.5 text-accent-blue">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.875rem] font-semibold text-text-emphasis leading-none">Ink source</span>
              <span className="text-[0.8125rem] text-text-secondary leading-tight">Editable source file</span>
            </div>
          </DropdownMenuItem>

          {hasMultipleFiles && onExportProject && (
            <>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  void runExport(onExportProject);
                }}
                disabled={isExporting}
                className="flex items-start gap-3 rounded-md p-2.5 cursor-pointer transition-all duration-200 focus:bg-accent focus:outline-none active:scale-[0.98] data-[disabled]:opacity-50"
              >
                <div className="shrink-0 rounded bg-accent-blue/10 p-1.5 text-accent-blue">
                  <FileArchive className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.875rem] font-semibold text-text-emphasis leading-none">InkPad project</span>
                  <span className="text-[0.8125rem] text-text-secondary leading-tight">Full project archive</span>
                </div>
              </DropdownMenuItem>

              {onExportProjectZip && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    void runExport(onExportProjectZip);
                  }}
                  disabled={isExporting}
                  className="flex items-start gap-3 rounded-md p-2.5 cursor-pointer transition-all duration-200 focus:bg-accent focus:outline-none active:scale-[0.98] data-[disabled]:opacity-50"
                >
                  <div className="shrink-0 rounded bg-accent-blue/10 p-1.5 text-accent-blue">
                    <FileArchive className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.875rem] font-semibold text-text-emphasis leading-none">Project ZIP</span>
                    <span className="text-[0.8125rem] text-text-secondary leading-tight">Standard ZIP format</span>
                  </div>
                </DropdownMenuItem>
              )}
            </>
          )}

          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              void runExport(onExportJson);
            }}
            disabled={isExporting}
            className="flex items-start gap-3 rounded-md p-2.5 cursor-pointer transition-all duration-200 focus:bg-accent focus:outline-none active:scale-[0.98] data-[disabled]:opacity-50"
          >
            <div className="shrink-0 rounded bg-success/10 p-1.5 text-success">
              <Braces className="h-4 w-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.875rem] font-semibold text-text-emphasis leading-none">Compiled JSON</span>
              <span className="text-[0.8125rem] text-text-secondary leading-tight">Compiled for custom engines</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
              window.setTimeout(onConfigureHtml, 0);
            }}
            disabled={isExporting}
            className="flex items-start gap-3 rounded-md p-2.5 cursor-pointer transition-all duration-200 focus:bg-accent focus:outline-none active:scale-[0.98] data-[disabled]:opacity-50"
          >
            <div className="shrink-0 rounded bg-warning/10 p-1.5 text-warning">
              <MonitorPlay className="h-4 w-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.875rem] font-semibold text-text-emphasis leading-none">Playable HTML</span>
              <span className="text-[0.8125rem] text-text-secondary leading-tight">Ready-to-play web build</span>
            </div>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
