import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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

export default function Editor() {
  const [code, setCode] = useState(SAMPLE_STORY);
  const [currentFile, setCurrentFile] = useState("story.ink");
  const [title, setTitle] = useState("story");
  
  const editorRef = useRef<MonacoEditorHandle>(null);
  const { toast } = useToast();
  
  const {
    story,
    storyState,
    errors,
    variables,
    knots,
    isRunning,
    runStory,
    restartStory,
    makeChoice,
    compileStory,
    compileStoryNow,
    jumpToKnot
  } = useInkStory();

  // Autosave system
  const autosave = useAutosave({
    fileName: currentFile,
    content: code,
    onSave: async (fileName, content) => {
      await FileOperations.saveFile(fileName, content);
    }
  });

  // Show error toasts for save failures
  useSaveErrorToast({
    saveState: autosave.saveState,
    fileName: currentFile
  });

  // Compile the story on initial load
  useEffect(() => {
    if (code) {
      compileStory(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on initial load

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  const handleRun = async () => {
    // Use Monaco's value as source of truth and do immediate compile
    const monacoCode = editorRef.current?.getValue() || "";
    const codeToCompile = monacoCode || code;
    const result = await compileStoryNow(codeToCompile);
    
    if (result.story) {
      runStory(result.story); // Pass the freshly compiled story directly
    } else {
      console.error("Compile failed; not running.", result.errors);
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
        description: `${currentFile} saved successfully.`,
      });
    } catch (e: any) {
      console.error("Save failed:", e);
      toast({
        title: "Save failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  }, [currentFile, autosave, toast]);

  const handleLoad = useCallback((fileName: string, content: string) => {
    // Try to load from FileOperations first, fallback to provided content
    const file = FileOperations.loadFile(fileName);
    const loadedContent = file?.content ?? content;
    
    setCode(loadedContent);
    setCurrentFile(fileName);
    // Extract title from filename
    const titleFromFile = fileName.replace('.ink', '').replace(/[-_]/g, ' ').trim() || 'story';
    setTitle(titleFromFile);
    compileStory(loadedContent);
  }, [compileStory]);

  const handleNew = useCallback(() => {
    setCode(""); // Set to a blank slate
    setCurrentFile("untitled.ink");
    setTitle("Untitled");
    // No need to compile an empty story
  }, []);

  const handleTitleChange = useCallback((newTitle: string) => {
    const validTitle = newTitle.trim() || 'story';
    setTitle(validTitle);
    
    // Also update the file name based on the new title
    const newFileName = `${validTitle.replace(/\s+/g, '-').toLowerCase()}.ink`;
    setCurrentFile(newFileName);
  }, []);

  const handleNavigateToKnot = useCallback((knotName: string) => {
    // Jump to knot in editor - find the line with "=== knotName ==="
    const lines = code.split('\n');
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
  }, [code, isRunning, jumpToKnot]);

  // Stable modified state to prevent flickering  
  // Keep the previous modified state while saving to prevent flicker
  const isModified = useMemo(() => {
    if (autosave.saveState === "saving") {
      // During save, maintain previous state to prevent flicker
      return true; // Assume modified during saving to avoid flash
    }
    return autosave.saveState === "dirty" || autosave.saveState === "error";
  }, [autosave.saveState]);

  return (
    <div className="h-screen flex flex-col bg-editor-bg text-text-primary">
      <TopMenu
        currentFile={currentFile}
        currentCode={code}
        title={title}
        isModified={isModified}
        isRunning={isRunning}
        knots={knots}
        editorRef={editorRef}
        onNew={handleNew}
        onSave={handleSave}
        onLoad={handleLoad}
        onTitleChange={handleTitleChange}
        onRun={handleRun}
        onRestart={handleRestart}
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
                  value={code}
                  onChange={handleCodeChange}
                  errors={errors}
                  fileName={currentFile}
                  onNavigateToLine={() => {}}
                />
              </div>
            </ResizablePanel>
            
            <ResizableHandle className="w-1 bg-border-color hover:bg-accent-blue transition-colors" />
            
            {/* Story Preview Panel */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <StoryPreview
                storyState={storyState}
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