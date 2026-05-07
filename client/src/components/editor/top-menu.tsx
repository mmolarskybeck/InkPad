import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Feather, File, FolderOpen, Save, Play, RotateCcw } from "lucide-react";
import { EditableTitle } from "@/components/ui/editable-title";
import { StoryExportDialog } from "./story-export-dialog";

interface TopMenuProps {
  title: string;
  knots: string[];
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onTitleChange: (newTitle: string) => void;
  onRun: () => void;
  onRestart: () => void;
  onExportInk: () => void | Promise<void>;
  onExportJson: () => void | Promise<void>;
  onExportHtml: () => void | Promise<void>;
  isExporting?: boolean;
  onNavigateToKnot?: (knotName: string) => void;
  saveState?: "dirty" | "saving" | "saved" | "error";
}

export function TopMenu({
  title,
  knots,
  onNew,
  onOpen,
  onSave,
  onTitleChange,
  onRun,
  onRestart,
  onExportInk,
  onExportJson,
  onExportHtml,
  isExporting = false,
  onNavigateToKnot,
  saveState = "saved"
}: TopMenuProps) {
  // Get CSS class for save state dot - always mounted, only styling changes
  const getSaveStatusDotClass = () => {
    const baseClass = "w-2 h-2 rounded-full transition-colors duration-200";
    
    switch (saveState) {
      case "dirty":
        return `${baseClass} bg-amber-500`;
      case "saving":
        return `${baseClass} bg-blue-500 animate-pulse`;
      case "saved":
        return `${baseClass} bg-green-500`;
      case "error":
        return `${baseClass} bg-red-500`;
      default:
        return `${baseClass} bg-gray-400 opacity-30`;
    }
  };

  const handleKnotNavigation = (knotName: string) => {
    if (knotName && onNavigateToKnot) {
      onNavigateToKnot(knotName);
    }
  };

  return (
    <div className="bg-panel-bg border-b border-border-color px-4 py-2 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Feather className="text-accent-blue text-lg" />
          <span className="text-text-emphasis font-semibold text-sm">InkPad</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-text-secondary text-xs">•</span>
          <EditableTitle 
            title={title}
            onTitleChange={onTitleChange}
          />
          <div className={getSaveStatusDotClass()} />
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
            onClick={onOpen}
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
          
          <StoryExportDialog
            onExportInk={onExportInk}
            onExportJson={onExportJson}
            onExportHtml={onExportHtml}
            isExporting={isExporting}
          />
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
          

        </div>
      </div>
    </div>
  );
}
