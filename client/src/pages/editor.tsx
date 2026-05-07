import { useState, useCallback, useEffect, useRef } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { TopMenu } from "@/components/editor/top-menu";
import { MonacoEditor, MonacoEditorHandle } from "@/components/editor/monaco-editor";
import { StoryPreview } from "@/components/editor/story-preview";
import { ErrorPanel } from "@/components/editor/error-panel";
import { VariableInspector } from "@/components/editor/variable-inspector";
import { useInkStory } from "@/hooks/use-ink-story";
import { useAutosave } from "@/hooks/use-autosave";
import { useSaveErrorToast } from "@/hooks/use-save-error-toast";
import { SAMPLE_STORY } from "@/data/sample-story";
import { FileOperations } from "@/lib/file-operations";
import { useToast } from "@/hooks/use-toast";
import { useStoryExport } from "@/features/export/useStoryExport";
import { useFileImport } from "@/features/files/useFileImport";
import type { InkDocument } from "@/types/ink-document";

export default function Editor() {
  const [currentDocument, setCurrentDocument] = useState<InkDocument>({
    filename: "story.ink",
    source: SAMPLE_STORY,
  });
  const [title, setTitle] = useState("story");
  
  const editorRef = useRef<MonacoEditorHandle>(null);
  const { toast } = useToast();
  
  const {
    runtimeState,
    errors,
    variables,
    knots,
    isRunning,
    runStory,
    restartStory,
    makeChoice,
    compileLive,
    compileNow,
    jumpToKnot
  } = useInkStory();

  // Autosave system
  const autosave = useAutosave({
    fileName: currentDocument.filename,
    content: currentDocument.source,
    onSave: async (filename, source) => {
      await FileOperations.saveFile(filename, source);
    }
  });

  // Show error toasts for save failures
  useSaveErrorToast({
    saveState: autosave.saveState,
    fileName: currentDocument.filename
  });

  // Compile the Ink source on initial load
  useEffect(() => {
    if (currentDocument.source) {
      compileLive(currentDocument.source);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on initial load

  const handleSourceChange = (newSource: string) => {
    setCurrentDocument((document) => ({
      ...document,
      source: newSource,
      updatedAt: Date.now(),
    }));
    compileLive(newSource);
  };

  const getCurrentSource = useCallback(() => {
    const editorSource = editorRef.current?.getValue() || "";
    return editorSource || currentDocument.source;
  }, [currentDocument.source]);

  const handleExportError = useCallback((message: string, error: unknown) => {
    console.error(message, error);
    alert(`${message}: ${error instanceof Error ? error.message : "Unknown error"}`);
  }, []);

  const handleRun = async () => {
    // Use Monaco's value as source of truth and do immediate compile
    const editorSource = editorRef.current?.getValue() || "";
    const sourceToCompile = editorSource || currentDocument.source;
    const result = await compileNow(sourceToCompile);
    
    if (result?.runtimeStory) {
      runStory(result.runtimeStory); // Pass the freshly compiled runtime story directly
    } else {
      console.error("Compile failed; not running.", result?.errors);
    }
  };

  const handleRestart = useCallback(() => {
    restartStory();
  }, [restartStory]);

  const handleSave = useCallback(async () => {
    try {
      // Manual save using autosave system
      await autosave.saveNow();
      
      // Show success toast for manual saves
      toast({
        title: "Saved",
        description: `${currentDocument.filename} saved successfully.`,
      });
    } catch (e: any) {
      console.error("Save failed:", e);
      toast({
        title: "Save failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  }, [currentDocument.filename, autosave, toast]);

  const handleLoad = useCallback((filename: string, importedSource: string) => {
    // Try to load from storage first, fallback to the imported source.
    const storedDocument = FileOperations.loadFile(filename);
    const sourceToLoad = storedDocument?.content ?? importedSource;
    
    setCurrentDocument({
      filename,
      source: sourceToLoad,
      updatedAt: storedDocument?.lastModified,
      lastSavedAt: storedDocument?.lastSavedAt,
    });
    // Extract title from filename
    const titleFromFile = filename.replace('.ink', '').replace(/[-_]/g, ' ').trim() || 'story';
    setTitle(titleFromFile);
    compileLive(sourceToLoad);
  }, [compileLive]);

  const handleNew = useCallback(() => {
    setCurrentDocument({
      filename: "untitled.ink",
      source: "",
      updatedAt: Date.now(),
    });
    setTitle("Untitled");
    // No need to compile an empty source document.
  }, []);

  const handleOpen = useFileImport({
    onLoad: handleLoad,
  });

  const handleTitleChange = useCallback((newTitle: string) => {
    const validTitle = newTitle.trim() || 'story';
    setTitle(validTitle);
    
    // Also update the file name based on the new title
    const nextFilename = `${validTitle.replace(/\s+/g, '-').toLowerCase()}.ink`;
    setCurrentDocument((document) => ({
      ...document,
      filename: nextFilename,
      updatedAt: Date.now(),
    }));
  }, []);

  const handleNavigateToKnot = useCallback((knotName: string) => {
    // Jump to knot in editor - find the line with "=== knotName ==="
    const lines = currentDocument.source.split('\n');
    const knotLineIndex = lines.findIndex(line => 
      line.trim() === `=== ${knotName} ===`
    );
    
    if (knotLineIndex !== -1) {
      // Jump to line in Monaco Editor (line numbers are 1-based)
      const lineNumber = knotLineIndex + 1;
      console.log(`Jump to line ${lineNumber} for knot ${knotName}`);
      // Use the global jumpToLine function set up by Monaco Editor
      if ((window as any).jumpToLine) {
        (window as any).jumpToLine(lineNumber);
      }
    }
    
    // Also jump to knot in story preview if running
    if (isRunning) {
      jumpToKnot(knotName);
    }
  }, [currentDocument.source, isRunning, jumpToKnot]);

  const { exportInk, exportJson, exportHtml, isExporting } = useStoryExport({
    getSource: getCurrentSource,
    title,
    compileStory: compileNow,
    onError: handleExportError,
  });

  return (
    <div className="h-screen flex flex-col bg-editor-bg text-text-primary">
      <TopMenu
        title={title}
        knots={knots}
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={handleSave}
        onTitleChange={handleTitleChange}
        onRun={handleRun}
        onRestart={handleRestart}
        onExportInk={exportInk}
        onExportJson={exportJson}
        onExportHtml={exportHtml}
        isExporting={isExporting}
        onNavigateToKnot={handleNavigateToKnot}
        saveState={autosave.saveState}
      />
      
      <ResizablePanelGroup direction="vertical" className="flex-1">
        {/* Top panel (Editor + Preview) */}
        <ResizablePanel defaultSize={75}>
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Editor Panel */}
            <ResizablePanel defaultSize={50} minSize={30}>
              {/* REMOVED the problematic onKeyDownCapture handler entirely */}
              {/* Let Monaco handle ALL keyboard events naturally */}
              <div className="h-full">
                <MonacoEditor
                  ref={editorRef}
                  value={currentDocument.source}
                  onChange={handleSourceChange}
                  errors={errors}
                  fileName={currentDocument.filename}
                  onNavigateToLine={() => {}}
                />
              </div>
            </ResizablePanel>
            
            <ResizableHandle className="w-1 bg-border-color hover:bg-accent-blue transition-colors" />
            
            {/* Story Preview Panel */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <StoryPreview
                runtimeState={runtimeState}
                isRunning={isRunning}
                onMakeChoice={makeChoice}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        
        <ResizableHandle className="h-1 bg-border-color hover:bg-accent-blue transition-colors" />
        
        {/* Bottom panel (Errors + Variables) */}
        <ResizablePanel defaultSize={25}>
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Error Panel */}
            <ResizablePanel defaultSize={70} minSize={40}>
              <ErrorPanel errors={errors} onErrorClick={(line) => {
                // TODO: Jump to error line in editor
                console.log(`Jump to line ${line}`);
              }} />
            </ResizablePanel>
            
            <ResizableHandle className="w-1 bg-border-color hover:bg-accent-blue transition-colors" />
            
            {/* Variable Inspector Panel */}
            <ResizablePanel defaultSize={30} minSize={20} className="h-full flex flex-col">
              <VariableInspector variables={variables} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
