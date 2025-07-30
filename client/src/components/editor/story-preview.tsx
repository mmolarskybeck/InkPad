// src/components/editor/StoryPreview.tsx
import { useState } from "react";
import { Eye, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { compileInkScript, InkError } from "@/lib/ink-compiler";

interface StoryState {
  text: string;
  choices: Array<{ text: string; index: number }>;
  canContinue: boolean;
}

interface StoryPreviewProps {
  storyState: StoryState | null;
  isRunning: boolean;
  onMakeChoice: (choiceIndex: number) => void;
  inkSource?: string;
  onCompiled?: (story: any) => void;
}

export function StoryPreview({
  storyState,
  isRunning,
  onMakeChoice,
  inkSource,
  onCompiled,
}: StoryPreviewProps) {
  const [compileStatus, setCompileStatus] = useState<
    "idle" | "compiling" | "error" | "success"
  >("idle");
  const [errors, setErrors] = useState<InkError[]>([]);

  const handleCompile = async () => {
    if (!inkSource) return;

    setCompileStatus("compiling");
    setErrors([]);

    try {
      const result = await compileInkScript(inkSource);

      if (result.errors.length === 0 && result.story) {
        setCompileStatus("success");
        onCompiled?.(result.story);
      } else {
        setCompileStatus("error");
        setErrors(result.errors);
      }
    } catch (err: any) {
      setCompileStatus("error");
      setErrors([
        {
          line: 1,
          message: err.message || "Failed to compile story",
          type: "error",
        },
      ]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Run button */}
      <div className="bg-panel-bg px-4 py-2 border-b border-border-color flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Eye className="text-accent-blue text-sm" />
          <span className="text-xs font-medium text-text-emphasis">
            Story Preview
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {inkSource && (
            <Button
              onClick={handleCompile}
              disabled={compileStatus === "compiling"}
              size="sm"
              variant="outline"
              className="text-xs"
            >
              {compileStatus === "compiling" && (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              )}
              {compileStatus === "compiling" ? "Compiling..." : "Run Story"}
            </Button>
          )}
          {isRunning && (
            <span className="text-xs text-success flex items-center">
              <div className="w-2 h-2 bg-success rounded-full mr-1" />
              Running
            </span>
          )}
        </div>
      </div>

      {/* Body: errors or story output */}
      <div className="flex-1 bg-editor-bg p-6 overflow-auto min-h-0">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Compilation errors */}
          {compileStatus === "error" && errors.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {errors.map((err, i) => (
                  <div key={i}>
                    {err.line && `Line ${err.line}: `}
                    {err.message}
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Story output */}
          {storyState ? (
            <>
              {storyState.text && (
                <div className="text-text-emphasis leading-relaxed whitespace-pre-wrap">
                  {storyState.text}
                </div>
              )}

              {storyState.choices.length > 0 && (
                <div className="space-y-2">
                  {storyState.choices.map((choice) => (
                    <Button
                      key={choice.index}
                      onClick={() => onMakeChoice(choice.index)}
                      variant="outline"
                      className="w-full justify-start p-3 border-border-color hover:border-accent-blue hover:bg-panel-bg text-text-primary bg-transparent"
                    >
                      → {choice.text}
                    </Button>
                  ))}
                </div>
              )}

              {!storyState.canContinue &&
                storyState.choices.length === 0 && (
                  <div className="text-text-secondary italic">
                    Story ended. Click "Run Story" to play again.
                  </div>
                )}
            </>
          ) : (
            <div className="text-text-secondary text-center py-12">
              Click "Run Story" to start the preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
