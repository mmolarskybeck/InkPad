import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  BookOpen,
  Eye,
  Play,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  PreviewMode,
  StoryRuntimeState,
  StoryTranscriptEntry,
} from "@/types/story-runtime";
import type { StoryMetadata } from "@/lib/tag-interpreter";
import type { PreviewThemePreference } from "@/types/user-preferences";

const CHOICE_CONFIRMATION_DELAY = 160;
const FOLLOW_BOTTOM_THRESHOLD = 96;

interface StoryPreviewProps {
  runtimeState: StoryRuntimeState | null;
  isRunning: boolean;
  isStale?: boolean;
  showHeader?: boolean;
  previewMode?: PreviewMode;
  previewFontSize?: number;
  previewTheme?: PreviewThemePreference;
  metadata?: StoryMetadata;
  sessionKey?: number;
  onMakeChoice: (choiceIndex: number) => void;
  onStepBack?: () => void;
  onRun?: () => void;
  onRestart?: () => void;
  hasErrors?: boolean;
  onViewProblems?: () => void;
}

function TranscriptEntry({ entry }: { entry: StoryTranscriptEntry }) {
  if (entry.type === "choice") {
    return (
      <div className="ml-3 border-l-2 border-accent-blue/35 pl-4 text-[0.875em] italic leading-[1.7] text-text-secondary">
        {entry.choice.text}
      </div>
    );
  }

  return entry.passage.text ? (
    <div className="whitespace-pre-wrap text-[1em] leading-[1.75] tracking-[0.005em] text-text-emphasis">
      {entry.passage.text}
    </div>
  ) : null;
}

export function StoryPreview({
  runtimeState,
  isRunning,
  isStale = false,
  showHeader = true,
  previewMode = "transcript",
  previewFontSize = 16,
  previewTheme = "inkpad",
  metadata,
  sessionKey = 0,
  hasErrors = false,
  onViewProblems,
  onMakeChoice,
  onStepBack,
  onRun,
  onRestart,
}: StoryPreviewProps) {
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const choiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldFollowRef = useRef(true);

  const clearChoiceTimer = useCallback(() => {
    if (choiceTimerRef.current) {
      clearTimeout(choiceTimerRef.current);
      choiceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setSelectedChoiceIndex(null);
  }, [runtimeState]);

  useEffect(() => clearChoiceTimer, [clearChoiceTimer]);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = scrollRef.current;
    if (!container) return;
    shouldFollowRef.current = true;
    setIsFollowing(true);
    container.scrollTo?.({ top: container.scrollHeight, behavior });
    container.scrollTop = container.scrollHeight;
  }, []);

  useEffect(() => {
    if (!runtimeState || !shouldFollowRef.current) return;
    const frame = window.requestAnimationFrame(() => scrollToLatest("smooth"));
    return () => window.cancelAnimationFrame(frame);
  }, [previewMode, runtimeState?.transcript.length, runtimeState?.choices.length, scrollToLatest]);

  // Reset scroll to top instantly on each new run/restart so iOS Safari smooth-scroll
  // can't leave the viewport pointing at empty space below the new (shorter) content.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || sessionKey === undefined) return;
    container.scrollTop = 0;
    shouldFollowRef.current = true;
    setIsFollowing(true);
  }, [sessionKey]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nextFollowing = distanceFromBottom <= FOLLOW_BOTTOM_THRESHOLD;
    shouldFollowRef.current = nextFollowing;
    setIsFollowing(nextFollowing);
  }, []);

  const handleChoice = useCallback((choiceIndex: number) => {
    if (selectedChoiceIndex !== null) return;
    setSelectedChoiceIndex(choiceIndex);
    clearChoiceTimer();
    choiceTimerRef.current = setTimeout(() => {
      choiceTimerRef.current = null;
      onMakeChoice(choiceIndex);
    }, CHOICE_CONFIRMATION_DELAY);
  }, [clearChoiceTimer, onMakeChoice, selectedChoiceIndex]);

  const visibleEntries = previewMode === "transcript"
    ? runtimeState?.transcript ?? []
    : runtimeState?.currentPassage
      ? [{
          id: runtimeState.currentPassage.id,
          type: "passage" as const,
          passage: runtimeState.currentPassage,
        }]
      : [];
  const effectivePreviewTheme = (() => {
    if (previewTheme === "inkpad") return null;
    return previewTheme;
  })();
  const previewThemeClass = effectivePreviewTheme
    ? `story-preview-theme-${effectivePreviewTheme}`
    : "";

  return (
    <div className={`flex h-full flex-col ${previewThemeClass}`}>
      {showHeader ? (
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border-color bg-panel-bg px-3 lg:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Eye className="shrink-0 text-sm text-accent-blue" />
            <span className="text-[0.875rem] font-medium tracking-[0.01em] text-text-emphasis">
              Story Preview
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isStale && onRun ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRun}
                className="h-7 gap-1.5 px-2 text-[0.8125rem] font-medium text-warning hover:bg-warning/10 hover:text-warning"
                aria-label="Re-run to update preview"
              >
                <Play className="h-3 w-3" />
                Re-run to update?
              </Button>
            ) : isStale ? (
              <span className="text-[0.8125rem] font-medium text-warning">Preview stale</span>
            ) : isRunning ? (
              <span className="text-[0.8125rem] font-medium text-success">Running</span>
            ) : null}
            {runtimeState ? (
              <>
                <div className="h-4 w-px bg-border-color" aria-hidden="true" />
                <div className="flex items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onStepBack}
                        disabled={!runtimeState.canStepBack || !onStepBack}
                        className="h-8 w-8 p-0 text-text-primary hover:bg-accent hover:text-text-emphasis disabled:opacity-35"
                        aria-label="Back to previous choice"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Return to the previous choice and restore the story state.
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onRestart}
                        disabled={!onRestart}
                        className="h-8 w-8 p-0 text-text-primary hover:bg-accent hover:text-text-emphasis disabled:opacity-35"
                        aria-label="Restart story from beginning"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Restart story from the beginning.</TooltipContent>
                  </Tooltip>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="story-preview-copy relative min-h-0 flex-1 overflow-auto bg-editor-bg p-5 sm:p-6"
        style={{ "--preview-font-size": `${previewFontSize}px` } as React.CSSProperties}
      >
        <div className="mx-auto max-w-[68ch] space-y-6 pb-8">
          {runtimeState ? (
            <>
              {metadata ? (
                <header className="border-b border-border-color pb-5">
                  <h1 className="text-balance text-[1.5em] font-semibold leading-tight tracking-[-0.02em] text-text-emphasis">
                    {metadata.title}
                  </h1>
                  {metadata.author ? (
                    <p className="mt-1.5 text-[0.8125em] text-text-secondary">
                      by {metadata.author}
                    </p>
                  ) : null}
                </header>
              ) : null}
              <div className="space-y-6">
                {visibleEntries.map((entry) => <TranscriptEntry key={entry.id} entry={entry} />)}
              </div>

              {runtimeState.choices.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {runtimeState.choices.map((choice) => (
                    <Button
                      key={choice.index}
                      onClick={() => handleChoice(choice.index)}
                      disabled={selectedChoiceIndex !== null}
                      aria-pressed={selectedChoiceIndex === choice.index}
                      variant="outline"
                      className={`h-auto w-full justify-start whitespace-normal p-3 text-left text-[0.9375em] leading-[1.6] disabled:opacity-100 ${
                        selectedChoiceIndex === choice.index
                          ? "border-accent-blue bg-accent text-text-emphasis"
                          : "border-border-color bg-transparent text-text-primary hover:border-accent-blue hover:bg-accent hover:text-text-emphasis"
                      }`}
                    >
                      <span aria-hidden="true">&rarr;&nbsp;</span>{choice.text}
                    </Button>
                  ))}
                </div>
              ) : null}

              {runtimeState.isComplete ? (
                <div className="flex flex-col items-center gap-3 border-t border-border-color pt-6 text-center">
                  <p className="text-[0.875rem] text-text-secondary">Story complete.</p>
                  {onRestart ? (
                    <Button variant="outline" size="sm" onClick={onRestart} className="gap-1.5 border-border-color text-[0.875rem] text-text-primary hover:border-accent-blue">
                      <RotateCcw className="h-3 w-3" />
                      Play again
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-8 py-20 text-center">
              <div className="flex select-none items-center gap-3 text-[0.6875rem] font-semibold uppercase tracking-[0.15em]">
                <span className="text-text-secondary">Write</span>
                <span className="text-border-color">&rarr;</span>
                <span className={hasErrors ? "text-text-emphasis" : "text-text-secondary"}>Run</span>
                <span className="text-border-color">&rarr;</span>
                <span className={hasErrors ? "text-text-secondary" : "text-text-emphasis"}>Preview</span>
              </div>
              
              <div className="space-y-2.5 max-w-[340px]">
                <h3 className={`text-[1.0625rem] font-semibold tracking-[-0.01em] ${hasErrors ? 'text-destructive' : 'text-text-emphasis'}`}>
                  {hasErrors ? "Fix errors to preview" : "Ready when you are"}
                </h3>
                <p className="text-[0.9375rem] leading-[1.6] text-text-secondary text-balance">
                  {hasErrors 
                    ? "Your story has errors that prevent preview. Fix them in the Problems panel, then run again." 
                    : "Compile and run your story to start the interactive preview."}
                </p>
              </div>
              
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center w-full">
                {onRun ? (
                  <Button 
                    onClick={onRun} 
                    disabled={hasErrors}
                    className={`h-9 gap-2 px-6 text-[0.875rem] font-semibold tracking-[0.01em] shadow-sm transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none ${
                      hasErrors 
                        ? "bg-disabled-bg text-text-secondary shadow-none" 
                        : "bg-success text-editor-bg hover:brightness-110"
                    }`}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Run story
                  </Button>
                ) : null}
                {hasErrors && onViewProblems ? (
                  <Button
                    variant="outline"
                    onClick={onViewProblems}
                    className="h-9 border-border-color px-6 text-[0.875rem] font-medium text-text-primary hover:border-text-secondary hover:bg-panel-bg shadow-sm transition-all duration-200 active:scale-[0.98]"
                  >
                    View problems
                  </Button>
                ) : null}
              </div>

              <div className="mt-8 w-full max-w-[240px] border-t border-border-color pt-8 mx-auto">
                <a 
                  href="https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="group inline-flex items-center gap-1.5 rounded-md text-[0.875rem] font-medium text-text-secondary transition-colors hover:text-text-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
                >
                  <BookOpen className="h-3.5 w-3.5 transition-colors group-hover:text-accent-blue" />
                  New to ink? Read the tutorial
                </a>
              </div>
            </div>
          )}
        </div>

        {runtimeState && !isFollowing ? (
          <Button
            type="button"
            size="sm"
            onClick={() => scrollToLatest()}
            className="sticky bottom-2 left-1/2 z-10 mx-auto flex -translate-x-1/2 gap-1.5 bg-accent-blue text-editor-bg shadow-lg hover:brightness-110"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Jump to latest
          </Button>
        ) : null}
      </div>
    </div>
  );
}
