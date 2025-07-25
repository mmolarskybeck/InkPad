import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Feather, File, FolderOpen, Save, Download, Play, RotateCcw, Circle } from "lucide-react";
import { saveAs } from "file-saver";

interface TopMenuProps {
  currentFile: string;
  isModified: boolean;
  isRunning: boolean;
  knots: string[];
  onNew: () => void;
  onSave: () => void;
  onLoad: (fileName: string, content: string) => void;
  onRun: () => void;
  onRestart: () => void;
}

export function TopMenu({
  currentFile,
  isModified,
  isRunning,
  knots,
  onNew,
  onSave,
  onLoad,
  onRun,
  onRestart
}: TopMenuProps) {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const handleOpen = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ink,.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          onLoad(file.name, content);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleExportInk = () => {
    const content = localStorage.getItem(`inkpad_${currentFile}`) || '';
    const blob = new Blob([content], { type: 'text/plain' });
    saveAs(blob, currentFile);
    setExportDialogOpen(false);
  };

  const handleExportJson = () => {
    const content = localStorage.getItem(`inkpad_${currentFile}`) || '';
    // TODO: Compile to JSON format
    const jsonData = { content, compiled: true };
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    saveAs(blob, currentFile.replace('.ink', '.json'));
    setExportDialogOpen(false);
  };

  const handleKnotNavigation = (knotName: string) => {
    if (knotName) {
      // TODO: Jump to knot in editor
      console.log(`Navigate to knot: ${knotName}`);
    }
  };

  return (
    <div className="bg-panel-bg border-b border-border-color px-4 py-2 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Feather className="text-accent-blue text-lg" />
          <h1 className="text-text-emphasis font-semibold text-sm">InkPad</h1>
        </div>
        
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onNew}
            className="px-3 py-1.5 text-xs hover:bg-border-color"
          >
            <File className="w-3 h-3 mr-1" />
            New
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpen}
            className="px-3 py-1.5 text-xs hover:bg-border-color"
          >
            <FolderOpen className="w-3 h-3 mr-1" />
            Open
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            className="px-3 py-1.5 text-xs hover:bg-border-color"
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
          
          <div className="w-px h-4 bg-border-color mx-1" />
          
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
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
                  onClick={handleExportInk}
                  className="w-full justify-start bg-transparent border border-border-color hover:border-accent-blue text-text-primary"
                >
                  <File className="w-4 h-4 mr-3 text-accent-blue" />
                  <div className="text-left">
                    <div className="font-medium">Export as .ink</div>
                    <div className="text-xs text-text-secondary">Raw Ink source file</div>
                  </div>
                </Button>
                
                <Button
                  onClick={handleExportJson}
                  className="w-full justify-start bg-transparent border border-border-color hover:border-accent-blue text-text-primary"
                >
                  <Download className="w-4 h-4 mr-3 text-success" />
                  <div className="text-left">
                    <div className="font-medium">Export as .json</div>
                    <div className="text-xs text-text-secondary">Compiled story data</div>
                  </div>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        <Select onValueChange={handleKnotNavigation}>
          <SelectTrigger className="bg-border-color text-text-primary text-xs px-3 py-1.5 border-border-color focus:border-accent-blue min-w-[150px]">
            <SelectValue placeholder="Navigate to knot..." />
          </SelectTrigger>
          <SelectContent className="bg-panel-bg border-border-color">
            {knots.map((knot) => (
              <SelectItem key={knot} value={knot} className="text-text-primary">
                → {knot}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={onRun}
            className="px-4 py-1.5 bg-success hover:bg-success/90 text-editor-bg text-xs font-medium"
          >
            <Play className="w-3 h-3 mr-1" />
            Run
          </Button>
          
          <Button
            onClick={onRestart}
            variant="ghost"
            size="sm"
            className="px-3 py-1.5 text-xs hover:bg-border-color"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
          
          {isRunning && (
            <div className="flex items-center text-xs text-success">
              <Circle className="w-2 h-2 mr-1 fill-current" />
              Running
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
