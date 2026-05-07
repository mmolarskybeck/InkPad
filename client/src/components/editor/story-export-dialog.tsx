import { useState } from "react";
import { Download, File, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface StoryExportDialogProps {
  onExportInk: () => void | Promise<void>;
  onExportJson: () => void | Promise<void>;
  onExportHtml: () => void | Promise<void>;
  isExporting?: boolean;
}

export function StoryExportDialog({
  onExportInk,
  onExportJson,
  onExportHtml,
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
          className="px-3 py-1.5 text-xs hover:bg-border-color"
        >
          <Download className="w-3 h-3 mr-1" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-panel-bg border-border-color">
        <DialogHeader>
          <DialogTitle className="text-text-emphasis">Export Story</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Button
            onClick={() => void runExport(onExportInk)}
            disabled={isExporting}
            className="w-full justify-start bg-transparent border border-border-color hover:border-accent-blue text-text-primary"
          >
            <File className="w-4 h-4 mr-3 text-accent-blue" />
            <div className="text-left">
              <div className="font-medium">Export as .ink</div>
              <div className="text-xs text-text-secondary">Raw Ink source file</div>
            </div>
          </Button>

          <Button
            onClick={() => void runExport(onExportJson)}
            disabled={isExporting}
            className="w-full justify-start bg-transparent border border-border-color hover:border-accent-blue text-text-primary"
          >
            <Download className="w-4 h-4 mr-3 text-success" />
            <div className="text-left">
              <div className="font-medium">Export as .json</div>
              <div className="text-xs text-text-secondary">Compiled story data</div>
            </div>
          </Button>

          <Button
            onClick={() => void runExport(onExportHtml)}
            disabled={isExporting}
            className="w-full justify-start bg-transparent border border-border-color hover:border-accent-blue text-text-primary"
          >
            <Globe className="w-4 h-4 mr-3 text-orange-500" />
            <div className="text-left">
              <div className="font-medium">Export as .html</div>
              <div className="text-xs text-text-secondary">Playable web story (ZIP)</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
