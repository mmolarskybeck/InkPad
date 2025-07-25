import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StoryState {
  text: string;
  choices: Array<{
    text: string;
    index: number;
  }>;
  canContinue: boolean;
}

interface StoryPreviewProps {
  storyState: StoryState | null;
  isRunning: boolean;
  onMakeChoice: (choiceIndex: number) => void;
}

export function StoryPreview({ storyState, isRunning, onMakeChoice }: StoryPreviewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-panel-bg px-4 py-2 border-b border-border-color flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Eye className="text-accent-blue text-sm" />
          <span className="text-xs font-medium text-text-emphasis">Story Preview</span>
        </div>
        <div className="flex items-center space-x-1">
          {isRunning && (
            <span className="text-xs text-success flex items-center">
              <div className="w-2 h-2 bg-success rounded-full mr-1" />
              Running
            </span>
          )}
        </div>
      </div>
      
      <div className="flex-1 bg-editor-bg p-6 overflow-auto min-h-0">
        <div className="max-w-2xl mx-auto space-y-4">
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
              
              {!storyState.canContinue && storyState.choices.length === 0 && (
                <div className="text-text-secondary italic">
                  Story ended. Click "Restart" to play again.
                </div>
              )}
            </>
          ) : (
            <div className="text-text-secondary text-center py-12">
              Click "Run" to start the story preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
