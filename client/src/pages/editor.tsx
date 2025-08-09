import { useState, useCallback, useEffect, useRef } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { TopMenu } from "@/components/editor/top-menu";
import { MonacoEditor, MonacoEditorHandle } from "@/components/editor/monaco-editor";
import { StoryPreview } from "@/components/editor/story-preview";
import { ErrorPanel } from "@/components/editor/error-panel";
import { VariableInspector } from "@/components/editor/variable-inspector";
import { useInkStory } from "@/hooks/use-ink-story";
import { SAMPLE_STORY } from "@/data/sample-story";
import { FileOperations } from "@/lib/file-operations";
import { useToast } from "@/hooks/use-toast";

export default function Editor() {
  const [code, setCode] = useState(SAMPLE_STORY);
  const [currentFile, setCurrentFile] = useState("story.ink");
  const [title, setTitle] = useState("story");
  const [isModified, setIsModified] = useState(false);
  
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

  // Compile the story on initial load
  useEffect(() => {
    if (code) {
      compileStory(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on initial load

  // Optional: Autosave (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      if (isModified) {
        const src = editorRef.current?.getValue() ?? code;
        try {
          FileOperations.saveFile(currentFile, src);
          setIsModified(false);
          toast({ 
            title: "Autosaved", 
            description: currentFile,
          });
        } catch (e: any) {
          console.error("Autosave failed:", e);
          // Don't show error toast for autosave failures to avoid spam
        }
      }
    }, 1500);
    return () => clearTimeout(id);
  }, [code, currentFile, isModified, toast]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    setIsModified(true);
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

  const handleSave = useCallback(() => {
    try {
      // Use Monaco's value as source of truth
      const src = editorRef.current?.getValue() ?? code;
      FileOperations.saveFile(currentFile, src);
      setIsModified(false);
      
      // Show success toast
      toast({
        title: "Saved",
        description: `${currentFile} updated.`,
      });
    } catch (e: any) {
      console.error("Save failed:", e);
      toast({
        title: "Save failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  }, [code, currentFile, toast]);

  const handleLoad = useCallback((fileName: string, content: string) => {
    // Try to load from FileOperations first, fallback to provided content
    const file = FileOperations.loadFile(fileName);
    const loadedContent = file?.content ?? content;
    
    setCode(loadedContent);
    setCurrentFile(fileName);
    // Extract title from filename
    const titleFromFile = fileName.replace('.ink', '').replace(/[-_]/g, ' ').trim() || 'story';
    setTitle(titleFromFile);
    setIsModified(false);
    compileStory(loadedContent);
  }, [compileStory]);

  const handleNew = useCallback(() => {
    setCode(""); // Set to a blank slate
    setCurrentFile("untitled.ink");
    setTitle("Untitled");
    setIsModified(false);
    // No need to compile an empty story
  }, []);

  const handleTitleChange = useCallback((newTitle: string) => {
    const validTitle = newTitle.trim() || 'story';
    setTitle(validTitle);
    
    // Also update the file name based on the new title
    const newFileName = `${validTitle.replace(/\s+/g, '-').toLowerCase()}.ink`;
    setCurrentFile(newFileName);
    
    setIsModified(true);
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