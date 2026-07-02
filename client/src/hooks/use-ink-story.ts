import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Story as InkStory, type Story } from 'inkjs';
import type { ErrorType } from 'inkjs/engine/Error';
import {
  compileInkScript,
  createCompilerRequestId,
  type InkCompileResult,
  type InkCompilerError,
} from '@/lib/ink-compiler';
import type { InkCompileInput } from '@/types/worker-messages';
import { extractInkVariables, extractListDefs, convertToUIVariables, convertStateToUIVariables } from '@/lib/ink-variable-utils';
import { normalizeStoryJson } from '@/lib/json-utils';
import { decodeHtmlCharacterReferences } from '@/lib/ink-text';
import {
  attachTagWarningLines,
  parseGlobalTags,
  type ParsedGlobalTags,
} from '@/lib/tag-interpreter';
import { parseTagsFromSource } from '@/lib/ink-source-tags';
import type {
  StoryChoice,
  StoryPassage,
  StoryRuntimeState,
  StoryTranscriptEntry,
} from '@/types/story-runtime';
import { debounce } from '@/lib/debounce';

interface InkVariable {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'list';
}

interface ChoiceSnapshot {
  storyStateJson: string;
  transcriptLength: number;
}

type RuntimeIssue = InkCompilerError;
type CompileSource = string | InkCompileInput;

const INK_RUNTIME_ERROR_TYPE = 2;

function createRuntimeStoryFromJson(compiledJson: string): Story {
  return new InkStory(normalizeStoryJson(compiledJson));
}

function runtimeIssueFromInkError(message: string, type: ErrorType): RuntimeIssue {
  const lineMatch = message.match(/line\s+(\d+)/i);

  return {
    line: lineMatch ? Number(lineMatch[1]) : 1,
    message,
    type: type === INK_RUNTIME_ERROR_TYPE ? 'error' : 'warning',
  };
}

function hasRuntimeError(issues: RuntimeIssue[]) {
  return issues.some((issue) => issue.type === 'error');
}

function prefixRuntimeIssues(prefix: string, issues: RuntimeIssue[]): RuntimeIssue[] {
  return issues.map((issue) => ({
    ...issue,
    message: `${prefix}: ${issue.message}`,
  }));
}

function getEntrySource(sourceOrInput: CompileSource): string {
  if (typeof sourceOrInput === "string") return sourceOrInput;
  return sourceOrInput.files[sourceOrInput.entryFile] ?? "";
}

export type CompileStatus = 'idle' | 'queued' | 'compiling' | 'success' | 'warning' | 'error';

export function useInkStory() {
  const [latestCompiledRuntimeStory, setLatestCompiledRuntimeStory] = useState<Story | null>(null);
  const [runtimeState, setRuntimeState] = useState<StoryRuntimeState | null>(null);
  const [errors, setErrors] = useState<InkCompilerError[]>([]);
  const [variables, setVariables] = useState<InkVariable[]>([]);
  const [knots, setKnots] = useState<string[]>([]);
  const [variableNames, setVariableNames] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState<CompileStatus>('idle');
  const [parsedGlobalTags, setParsedGlobalTags] = useState<ParsedGlobalTags>(() => parseGlobalTags([]));
  
  const activeRuntimeStoryRef = useRef<Story | null>(null);
  const latestCompiledStoryJsonRef = useRef<string | null>(null);
  const activeRuntimeStoryJsonRef = useRef<string | null>(null);
  const latestCompileRequestId = useRef<string | null>(null);
  const transcriptRef = useRef<StoryTranscriptEntry[]>([]);
  const choiceHistoryRef = useRef<ChoiceSnapshot[]>([]);
  const entryIdRef = useRef(0);
  const runtimeIssuesRef = useRef<RuntimeIssue[]>([]);

  const nextEntryId = useCallback((prefix: string) => {
    entryIdRef.current += 1;
    return `${prefix}-${entryIdRef.current}`;
  }, []);

  const updateVariablesFromCompiledJson = useCallback((compiledJsonData: any) => {
    try {
      if (!compiledJsonData) {
        setVariables([]);
        return;
      }
      
      const inkVariables = extractInkVariables(compiledJsonData);
      const listDefs = extractListDefs(compiledJsonData);
      const uiVariables = convertToUIVariables(inkVariables, listDefs);
      setVariables(uiVariables);
    } catch (error) {
      console.error('Error extracting variables from JSON:', error);
      setVariables([]);
    }
  }, []);

  const attachRuntimeErrorHandler = useCallback((runtimeStory: Story) => {
    runtimeStory.onError = (message, type) => {
      runtimeIssuesRef.current = [
        ...runtimeIssuesRef.current,
        runtimeIssueFromInkError(message, type),
      ];
    };
  }, []);

  const updateRuntimeState = useCallback((runtimeStory: Story, commitRuntimeErrors = true) => {
    attachRuntimeErrorHandler(runtimeStory);
    runtimeIssuesRef.current = [];
    let text = '';
    const tags = new Set<string>();
    while (runtimeStory.canContinue) {
      const nextText = runtimeStory.Continue();
      text += (nextText || '') + '\n';
      runtimeStory.currentTags?.forEach((tag) => tags.add(tag));
    }
    const runtimeIssues = runtimeIssuesRef.current;
    runtimeIssuesRef.current = [];

    if (!commitRuntimeErrors && hasRuntimeError(runtimeIssues)) {
      return runtimeIssues;
    }

    const trimmedText = decodeHtmlCharacterReferences(text.trim());
    let currentPassage: StoryPassage | null = null;
    if (trimmedText || tags.size > 0) {
      currentPassage = {
        id: nextEntryId('passage'),
        text: trimmedText,
        tags: Array.from(tags),
      };
      transcriptRef.current = [
        ...transcriptRef.current,
        {
          id: currentPassage.id,
          type: 'passage',
          passage: currentPassage,
        },
      ];
    } else {
      const latestPassage = [...transcriptRef.current]
        .reverse()
        .find((entry) => entry.type === 'passage');
      currentPassage = latestPassage?.type === 'passage'
        ? latestPassage.passage
        : null;
    }

    const choices: StoryChoice[] = runtimeStory.currentChoices.map((choice, index) => ({
      text: decodeHtmlCharacterReferences(choice.text),
      index,
      tags: choice.tags ?? [],
    }));

    setRuntimeState({
      transcript: transcriptRef.current,
      currentPassage,
      choices,
      canContinue: runtimeStory.canContinue,
      isComplete: !runtimeStory.canContinue && choices.length === 0,
      canStepBack: choiceHistoryRef.current.length > 0,
    });

    // Update variables from the live story state
    if (runtimeStory.variablesState && variableNames.length > 0) {
      const uiVariables = convertStateToUIVariables(runtimeStory.variablesState, variableNames);
      setVariables(uiVariables);
    }

    if (runtimeIssues.length > 0) {
      setErrors(runtimeIssues);
    }

    return runtimeIssues;
  }, [attachRuntimeErrorHandler, nextEntryId, variableNames]);

  const applyCompileResult = useCallback((result: InkCompileResult, source: string) => {
    // When compilation fails, parse tags directly from source so settings panel
    // stays up to date even when ink has errors elsewhere in the file.
    const nextParsedGlobalTags = result.runtimeStory
      ? parseGlobalTags(result.runtimeStory.globalTags)
      : parseTagsFromSource(source);
    const tagWarnings = attachTagWarningLines(nextParsedGlobalTags.warnings, source);

    setParsedGlobalTags({
      ...nextParsedGlobalTags,
      warnings: tagWarnings,
    });
    setErrors([
      ...result.errors,
      ...tagWarnings.map((warning) => ({
        line: warning.line ?? 1,
        message: warning.message,
        type: 'warning' as const,
      })),
    ]);
    setKnots(result.knots);
    const hasCompilerError = result.errors.some((error) => error.type === 'error');
    const hasWarning = tagWarnings.length > 0
      || result.errors.some((error) => error.type === 'warning');
    setCompileStatus(
      hasCompilerError
        ? 'error'
        : hasWarning
          ? 'warning'
          : 'success'
    );
    
    if (result.runtimeStory && result.compiledJson) {
      setLatestCompiledRuntimeStory(result.runtimeStory);
      latestCompiledStoryJsonRef.current = result.compiledJson;
      // Update variables when story is compiled (even if not running)
      // Normalize JSON data regardless of source
      const compiledJsonData = normalizeStoryJson(result.compiledJson);
      
      updateVariablesFromCompiledJson(compiledJsonData);
      // Also store the names of the variables
      const extractedVars = extractInkVariables(compiledJsonData);
      setVariableNames(extractedVars.map(v => v.name));
    } else {
      // Clear stale compile-derived state if compilation failed.
      setLatestCompiledRuntimeStory(null);
      latestCompiledStoryJsonRef.current = null;
      setVariables([]);
      setVariableNames([]);
    }
  }, [updateVariablesFromCompiledJson]);

  const debouncedLiveCompile = useMemo(
    () => debounce(async (inkSource: CompileSource, requestId: string) => {
      if (requestId !== latestCompileRequestId.current) return;

      setIsCompiling(true);
      setCompileStatus('compiling');
      const result = await compileInkScript(inkSource, requestId);
      if (
        requestId !== latestCompileRequestId.current ||
        result.requestId !== latestCompileRequestId.current
      ) {
        return;
      }

      applyCompileResult(result, getEntrySource(inkSource));
      setIsCompiling(false);
    }, 500),
    [applyCompileResult]
  );

  useEffect(() => {
    return () => {
      debouncedLiveCompile.cancel();
    };
  }, [debouncedLiveCompile]);

  const compileLive = useCallback((inkSource: CompileSource) => {
    const requestId = createCompilerRequestId();
    latestCompileRequestId.current = requestId;
    setCompileStatus('queued');
    debouncedLiveCompile(inkSource, requestId);
  }, [debouncedLiveCompile]);

  const compileNow = useCallback(async (inkSource: CompileSource) => {
    debouncedLiveCompile.cancel();
    const requestId = createCompilerRequestId();
    latestCompileRequestId.current = requestId;
    setIsCompiling(true);
    setCompileStatus('compiling');

    const result = await compileInkScript(inkSource, requestId);
    if (
      requestId !== latestCompileRequestId.current ||
      result.requestId !== latestCompileRequestId.current
    ) {
      return null;
    }

    applyCompileResult(result, getEntrySource(inkSource));
    setIsCompiling(false);
    return result;
  }, [applyCompileResult, debouncedLiveCompile]);

  const runStory = useCallback((runtimeStoryToRun?: Story) => {
    let activeRuntimeStory = runtimeStoryToRun || latestCompiledRuntimeStory;
    if (activeRuntimeStory) {
      // Always prefer the exact raw JSON from the compiler to avoid inkjs ToJson()/ResetState() bugs
      const storyJson = latestCompiledStoryJsonRef.current ?? (runtimeStoryToRun ? runtimeStoryToRun.ToJson() : activeRuntimeStory.ToJson());

      if (typeof storyJson === 'string') {
        try {
          // Re-instantiate from raw JSON to guarantee a perfectly clean runtime state
          activeRuntimeStory = createRuntimeStoryFromJson(storyJson);
        } catch (e) {
          console.error('Error instantiating clean story in runStory:', e);
        }
      }

      activeRuntimeStoryRef.current = activeRuntimeStory;
      activeRuntimeStoryJsonRef.current = typeof storyJson === 'string' ? storyJson : null;
      attachRuntimeErrorHandler(activeRuntimeStory);
      
      transcriptRef.current = [];
      choiceHistoryRef.current = [];
      entryIdRef.current = 0;
      setIsRunning(true);
      updateRuntimeState(activeRuntimeStory);
    } else {
      activeRuntimeStoryRef.current = null;
      activeRuntimeStoryJsonRef.current = null;
      setIsRunning(false);
      setRuntimeState(null);
    }
  }, [latestCompiledRuntimeStory, updateRuntimeState]);

  const restartStory = useCallback(() => {
    const activeStoryJson = latestCompiledStoryJsonRef.current ?? activeRuntimeStoryJsonRef.current;
    // Keep a reference to the compiled story as a fallback in case JSON instantiation fails.
    // latestCompiledRuntimeStory is captured in runStory's closure, so use the ref path here.
    let runtimeStory: Story | null = null;

    if (activeStoryJson) {
      try {
        runtimeStory = createRuntimeStoryFromJson(activeStoryJson);
      } catch (error) {
        console.error('[InkPad] restartStory: createRuntimeStoryFromJson failed:', error);
      }
    }

    if (!runtimeStory) {
      console.error('[InkPad] restartStory: no story JSON available and no fallback — cannot restart');
      setErrors([{
        line: 1,
        message: 'Could not restart story: no compiled story available. Try clicking Run.',
        type: 'error',
      }]);
      return;
    }

    console.log('[InkPad] restartStory: fresh story canContinue=', runtimeStory.canContinue, 'choices=', runtimeStory.currentChoices.length);

    activeRuntimeStoryRef.current = runtimeStory;
    activeRuntimeStoryJsonRef.current = activeStoryJson;
    attachRuntimeErrorHandler(runtimeStory);
    transcriptRef.current = [];
    choiceHistoryRef.current = [];
    entryIdRef.current = 0;
    setIsRunning(true);
    try {
      updateRuntimeState(runtimeStory);
    } catch (error) {
      console.error('[InkPad] restartStory: updateRuntimeState threw:', error);
    }
  }, [updateRuntimeState]);

  const makeChoice = useCallback((choiceIndex: number) => {
    if (activeRuntimeStoryRef.current && isRunning) {
      const runtimeStory = activeRuntimeStoryRef.current;
      const selectedChoice = runtimeStory.currentChoices[choiceIndex];
      if (!selectedChoice) return;

      try {
        const snapshot: ChoiceSnapshot = {
          storyStateJson: runtimeStory.state.ToJson(),
          transcriptLength: transcriptRef.current.length,
        };
        const choice: StoryChoice = {
          index: choiceIndex,
          text: decodeHtmlCharacterReferences(selectedChoice.text),
          tags: selectedChoice.tags ?? [],
        };
        const choiceEntry: StoryTranscriptEntry = {
          id: nextEntryId('choice'),
          type: 'choice',
          choice,
        };

        choiceHistoryRef.current = [...choiceHistoryRef.current, snapshot];
        transcriptRef.current = [...transcriptRef.current, choiceEntry];
        runtimeStory.ChooseChoiceIndex(choiceIndex);
        const runtimeIssues = updateRuntimeState(runtimeStory, false);
        if (hasRuntimeError(runtimeIssues)) {
          choiceHistoryRef.current = choiceHistoryRef.current.slice(0, -1);
          transcriptRef.current = transcriptRef.current.slice(0, snapshot.transcriptLength);
          runtimeStory.state.LoadJson(snapshot.storyStateJson);
          setErrors(prefixRuntimeIssues('Error processing choice', runtimeIssues));
          return;
        }
      } catch (error) {
        const snapshot = choiceHistoryRef.current.at(-1);
        if (snapshot) {
          choiceHistoryRef.current = choiceHistoryRef.current.slice(0, -1);
          transcriptRef.current = transcriptRef.current.slice(0, snapshot.transcriptLength);
          try {
            runtimeStory.state.LoadJson(snapshot.storyStateJson);
          } catch {
            // Preserve the original runtime error below.
          }
        }
        console.error('Error making choice:', error);
        setErrors([{
          line: 1,
          message: 'Error processing choice: ' + (error as Error).message,
          type: 'error'
        }]);
      }
    }
  }, [isRunning, nextEntryId, updateRuntimeState]);

  const stepBack = useCallback(() => {
    const runtimeStory = activeRuntimeStoryRef.current;
    const snapshot = choiceHistoryRef.current.at(-1);
    if (!runtimeStory || !snapshot || !isRunning) return;

    try {
      runtimeStory.state.LoadJson(snapshot.storyStateJson);
      choiceHistoryRef.current = choiceHistoryRef.current.slice(0, -1);
      transcriptRef.current = transcriptRef.current.slice(0, snapshot.transcriptLength);
      updateRuntimeState(runtimeStory);
    } catch (error) {
      console.error('Error stepping back:', error);
      setErrors([{
        line: 1,
        message: 'Error stepping back: ' + (error as Error).message,
        type: 'error',
      }]);
    }
  }, [isRunning, updateRuntimeState]);

  const jumpToKnot = useCallback((knotName: string) => {
    if (activeRuntimeStoryRef.current && isRunning) {
      try {
        // In inkjs, we can use ChoosePathString to jump to a knot
        activeRuntimeStoryRef.current.ChoosePathString(knotName);
        transcriptRef.current = [];
        choiceHistoryRef.current = [];
        updateRuntimeState(activeRuntimeStoryRef.current);
      } catch (error) {
        console.error('Error jumping to knot:', error);
        setErrors([{
          line: 1,
          message: 'Error jumping to knot "' + knotName + '": ' + (error as Error).message,
          type: 'error'
        }]);
      }
    }
  }, [isRunning, updateRuntimeState]);

  return {
    runtimeStory: latestCompiledRuntimeStory,
    runtimeState,
    errors,
    variables,
    knots,
    isRunning,
    isCompiling,
    compileStatus,
    parsedGlobalTags,
    runStory,
    restartStory,
    makeChoice,
    stepBack,
    compileLive,
    compileNow,
    jumpToKnot
  };
}
