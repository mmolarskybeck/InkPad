import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Feather, File, FolderOpen, Save, Download, Play, RotateCcw, Circle, Globe } from "lucide-react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { EditableTitle } from "@/components/ui/editable-title";
import { getFilename, validateTitle } from "@/lib/filename-utils";

interface TopMenuProps {
  currentFile: string;
  currentCode: string;
  title: string;
  isModified: boolean;
  isRunning: boolean;
  knots: string[];
  onNew: () => void;
  onSave: () => void;
  onLoad: (fileName: string, content: string) => void;
  onTitleChange: (newTitle: string) => void;
  onRun: () => void;
  onRestart: () => void;
  onNavigateToKnot?: (knotName: string) => void;
}

export function TopMenu({
  currentFile,
  currentCode,
  title,
  isModified,
  isRunning,
  knots,
  onNew,
  onSave,
  onLoad,
  onTitleChange,
  onRun,
  onRestart,
  onNavigateToKnot
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
    const filename = getFilename(title, '.ink');
    const blob = new Blob([currentCode], { type: 'text/plain' });
    saveAs(blob, filename);
    setExportDialogOpen(false);
  };

  const handleExportJson = async () => {
    try {
      // Compile the current code to JSON using the server endpoint
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source: currentCode }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Compilation failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.compiled) {
        // Export the compiled JSON data
        const filename = getFilename(title, '.json');
        const blob = new Blob([JSON.stringify(result.compiled, null, 2)], { type: 'application/json' });
        saveAs(blob, filename);
      } else {
        // If compilation failed, show error
        console.error('Compilation failed: No compiled result');
        alert('Failed to compile story for export: No compiled result returned');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Failed to export JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setExportDialogOpen(false);
  };

  const handleExportHtml = async () => {
    try {
      // First, compile the current code to JSON
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source: currentCode }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Compilation failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.compiled) {
        throw new Error('Failed to compile story for HTML export');
      }

      // Load the HTML template
      const templateResponse = await fetch('/templates/story-template.html');
      if (!templateResponse.ok) {
        throw new Error('Failed to load HTML template');
      }
      
      let htmlTemplate = await templateResponse.text();
      
      // Use the validated title for display
      const storyTitle = validateTitle(title);

      // Replace template placeholders
      htmlTemplate = htmlTemplate
        .replace(/\{\{STORY_TITLE\}\}/g, storyTitle)
        .replace('{{STORY_DATA}}', JSON.stringify(result.compiled));

      // Create a ZIP file with the HTML and supporting files
      const zip = new JSZip();
      
      // Add the main HTML file
      zip.file('play.html', htmlTemplate);
      
      // Add a README with instructions
      const readme = `# ${storyTitle}

This is an interactive story created with InkPad.

## How to Play

1. Double-click on "play.html" to open the story in your web browser
2. Read the text and click on choices to progress through the story
3. Use the "Play Again" button to restart the story

## Technical Details

This story was created using:
- Ink scripting language by Inkle Studios
- InkPad web-based IDE
- InkJS runtime for web playback

Enjoy your story!
`;
      
      zip.file('README.md', readme);

      // Generate the ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download the ZIP file with proper filename
      const filename = title === 'story' ? 'inkpad_story.zip' : getFilename(title, '.zip');
      saveAs(zipBlob, filename);
      
    } catch (error) {
      console.error('HTML export failed:', error);
      alert(`Failed to export HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setExportDialogOpen(false);
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
          {isModified && <Circle className="w-2 h-2 text-accent-blue fill-current" />}
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

                <Button
                  onClick={handleExportHtml}
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
