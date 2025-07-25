import { useState, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { TopMenu } from "@/components/editor/top-menu";
import { MonacoEditor } from "@/components/editor/monaco-editor";
import { StoryPreview } from "@/components/editor/story-preview";
import { ErrorPanel } from "@/components/editor/error-panel";
import { VariableInspector } from "@/components/editor/variable-inspector";
import { useInkStory } from "@/hooks/use-ink-story";
import { SAMPLE_STORY } from "@/data/sample-story";

export default function Editor() {
  const [code, setCode] = useState(SAMPLE_STORY);
  const [currentFile, setCurrentFile] = useState("story.ink");
  const [isModified, setIsModified] = useState(false);
  
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
    jumpToKnot
  } = useInkStory();

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    setIsModified(true);
    compileStory(newCode);
  }, [compileStory]);

  const handleRun = useCallback(async () => {
    await runStory(code);
  }, [code, runStory]);

  const handleRestart = useCallback(() => {
    restartStory();
  }, [restartStory]);

  const handleSave = useCallback(() => {
    // Save to localStorage
    localStorage.setItem(`inkpad_${currentFile}`, code);
    setIsModified(false);
  }, [code, currentFile]);

  const handleLoad = useCallback((fileName: string, content: string) => {
    setCode(content);
    setCurrentFile(fileName);
    setIsModified(false);
    compileStory(content);
  }, [compileStory]);

  const handleNew = useCallback(() => {
    setCode(SAMPLE_STORY);
    setCurrentFile("story.ink");
    setIsModified(false);
    compileStory(SAMPLE_STORY);
  }, [compileStory]);

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
        isModified={isModified}
        isRunning={isRunning}
        knots={knots}
        onNew={handleNew}
        onSave={handleSave}
        onLoad={handleLoad}
        onRun={handleRun}
        onRestart={handleRestart}
        onNavigateToKnot={handleNavigateToKnot}
      />
      
      <div className="flex-1 flex flex-col min-h-0">
        {/* Main editor and preview panels */}
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={50} minSize={30} className="min-h-0">
            <div className="h-full">
              <MonacoEditor
                value={code}
                onChange={handleCodeChange}
                errors={errors}
                fileName={currentFile}
                onNavigateToLine={() => {}}
              />
            </div>
          </ResizablePanel>
          
          <ResizableHandle className="w-1 bg-border-color hover:bg-accent-blue transition-colors" />
          
          <ResizablePanel defaultSize={50} minSize={30} className="min-h-0">
            <div className="h-full">
              <StoryPreview
                storyState={storyState}
                isRunning={isRunning}
                onMakeChoice={makeChoice}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
        
        {/* Bottom panels for errors and variables */}
        <div className="h-64 border-t border-border-color">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={70} minSize={40}>
              <ErrorPanel errors={errors} onErrorClick={(line) => {
                // TODO: Jump to error line in editor
                console.log(`Jump to line ${line}`);
              }} />
            </ResizablePanel>
            
            <ResizableHandle className="w-1 bg-border-color hover:bg-accent-blue transition-colors" />
            
            <ResizablePanel defaultSize={30} minSize={20}>
              <VariableInspector variables={variables} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
