import { useState, useCallback, useEffect, useRef } from 'react';
import type { Story } from 'inkjs';
import {
  compileInkScript,
  createCompilerRequestId,
  type InkCompileResult,
  type InkCompilerError,
} from '@/lib/ink-compiler';
import type { InkCompileInput } from '@/types/worker-messages';
import { extractInkVariables, extractListDefs, convertToUIVariables, convertStateToUIVariables } from '@/lib/ink-variable-utils';
import { normalizeStoryJson } from '@/lib/json-utils';
import {
  attachTagWarningLines,
  parseGlobalTags,
  type ParsedGlobalTags,
} from '@/lib/tag-interpreter';
import { parseTagsFromSource } from '@/lib/ink-source-tags';
import type { StoryRuntimeState } from '@/types/story-runtime';
import {
  advanceStory,
  bindIssueSink,
  cloneDraft,
  createDraft,
  hasRuntimeError,
  prefixRuntimeIssues,
  recordChoice,
  toRuntimeState,
  type SessionDraft,
} from '@/lib/story-session';
import { replayPath, type ReplayFailure, type ReplayStep } from '@/lib/choice-replay';

interface InkVariable {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'list';
}

type CompileSource = string | InkCompileInput;

export interface CompileOptions {
  /**
   * When true and a preview session is running, rebuild that session from the
   * new compiled JSON by replaying the writer's choice path. Live (debounced)
   * compiles set this; explicit Run does not, because Run restarts anyway.
   */
  restoreRunningSession?: boolean;
}

function createRuntimeStoryFromJson(runtimeStory: Story, compiledJson: string): Story {
  const StoryConstructor = runtimeStory.constructor as new (storyData: unknown) => Story;
  return new StoryConstructor(normalizeStoryJson(compiledJson));
}

function getEntrySource(sourceOrInput: CompileSource): string {
  if (typeof sourceOrInput === "string") return sourceOrInput;
  return sourceOrInput.files[sourceOrInput.entryFile] ?? "";
}

export type CompileStatus = 'idle' | 'compiling' | 'success' | 'warning' | 'error';

/**
 * Live-compile trigger.
 *
 * While the preview is visible, the editor reports commit-like moments (space,
 * Enter, sentence punctuation, moving to another line, leaving the editor) and
 * the pending compile fires at once, so the preview echoes each finished word
 * without ever echoing mid-word. Anything else (a mid-word pause, a deletion)
 * falls back to an idle timer. Compiling is cheap; this is about when the
 * preview is allowed to move.
 *
 * While the preview is hidden (phone on the code tab, or a collapsed preview
 * panel) signals are ignored and only the idle timer runs, keeping diagnostics
 * current. Revealing the preview fires any pending compile immediately.
 */
export type EditCommitSignal = 'space' | 'newline' | 'punctuation' | 'line-change' | 'blur';
const LIVE_COMPILE_SIGNALS: ReadonlySet<EditCommitSignal> = new Set<EditCommitSignal>([
  'space', 'newline', 'punctuation', 'line-change', 'blur',
]);
const LIVE_COMPILE_IDLE_MS = 1500;
/** Only show "Compiling" once a compile has run this long; quick ones stay silent. */
const COMPILING_STATUS_DELAY_MS = 150;

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
  const [restoreNotice, setRestoreNotice] = useState<ReplayFailure | null>(null);
  /** With `jump-missing`: the knot the writer had jumped to, for the notice copy. */
  const [restoreNoticeKnot, setRestoreNoticeKnot] = useState<string | null>(null);

  const activeRuntimeStoryRef = useRef<Story | null>(null);
  const latestCompiledStoryJsonRef = useRef<string | null>(null);
  const activeRuntimeStoryJsonRef = useRef<string | null>(null);
  const latestCompileRequestId = useRef<string | null>(null);
  const draftRef = useRef<SessionDraft>(createDraft());
  const variableNamesRef = useRef<string[]>([]);
  const isRunningRef = useRef(false);
  // The route the writer took. Only the first `replayedCountRef` steps are live;
  // any tail beyond that is stale from a partial restore and is truncated on the next choice.
  const replayPathRef = useRef<ReplayStep[]>([]);
  const replayedCountRef = useRef(0);

  const setRunning = useCallback((running: boolean) => {
    isRunningRef.current = running;
    setIsRunning(running);
  }, []);

  const clearRestoreNotice = useCallback(() => {
    setRestoreNotice(null);
    setRestoreNoticeKnot(null);
  }, []);

  const resetRoute = useCallback(() => {
    replayPathRef.current = [];
    replayedCountRef.current = 0;
    clearRestoreNotice();
  }, [clearRestoreNotice]);

  /** Drop the stale tail left by a partial restore, then append one live step. */
  const appendRouteStep = useCallback((step: ReplayStep) => {
    replayPathRef.current = [...replayPathRef.current.slice(0, replayedCountRef.current), step];
    replayedCountRef.current = replayPathRef.current.length;
    clearRestoreNotice();
  }, [clearRestoreNotice]);

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

  /** Commit a draft to visible state. The single place runtime state is published. */
  const publish = useCallback((story: Story, draft: SessionDraft, names: string[] = variableNamesRef.current) => {
    draftRef.current = draft;
    setRuntimeState(toRuntimeState(story, draft));
    if (story.variablesState && names.length > 0) {
      setVariables(convertStateToUIVariables(story.variablesState, names));
    }
  }, []);

  const updateRuntimeState = useCallback((runtimeStory: Story) => {
    const draft = draftRef.current;
    bindIssueSink(runtimeStory, draft);
    const runtimeIssues = advanceStory(runtimeStory, draft);
    publish(runtimeStory, draft);
    if (runtimeIssues.length > 0) {
      setErrors(runtimeIssues);
    }
    return runtimeIssues;
  }, [publish]);

  const startSession = useCallback((runtimeStory: Story, storyJson: string | null) => {
    activeRuntimeStoryRef.current = runtimeStory;
    activeRuntimeStoryJsonRef.current = storyJson;
    draftRef.current = createDraft();
    resetRoute();
    setRunning(true);
    updateRuntimeState(runtimeStory);
  }, [resetRoute, setRunning, updateRuntimeState]);

  const restoreRunningSession = useCallback((compiledJson: string, sourceStory: Story, names: string[]) => {
    if (!isRunningRef.current) return;

    let fresh: Story;
    const draft = createDraft();
    try {
      fresh = createRuntimeStoryFromJson(sourceStory, compiledJson);
      bindIssueSink(fresh, draft);
    } catch (error) {
      // Nothing published; the previous preview stays intact.
      console.error('[InkPad] restoreRunningSession: could not instantiate story:', error);
      return;
    }

    const result = replayPath(fresh, replayPathRef.current, draft);

    activeRuntimeStoryRef.current = fresh;
    activeRuntimeStoryJsonRef.current = compiledJson;
    if (result.failure === 'jump-missing') {
      // The route is unusable; the story starts over. Replay validated every
      // jump before touching state, so `fresh` is still at the beginning.
      advanceStory(fresh, draft);
      replayPathRef.current = [];
      replayedCountRef.current = 0;
      setRestoreNoticeKnot(result.missingKnot ?? null);
    } else {
      replayedCountRef.current = result.replayedCount;
      setRestoreNoticeKnot(null);
    }
    publish(fresh, draft, names);
    setRestoreNotice(result.outcome === 'partial' ? result.failure ?? null : null);
    if (draft.issues.length > 0) {
      setErrors(prefixRuntimeIssues('Error restoring preview', draft.issues));
    }
  }, [publish]);

  const applyCompileResult = useCallback((result: InkCompileResult, source: string, options: CompileOptions = {}) => {
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
      const names = extractInkVariables(compiledJsonData).map(v => v.name);
      variableNamesRef.current = names;
      setVariableNames(names);

      if (options.restoreRunningSession) {
        restoreRunningSession(result.compiledJson, result.runtimeStory, names);
      }
    } else {
      // Clear stale compile-derived state if compilation failed.
      // The running preview session (if any) is left untouched.
      setLatestCompiledRuntimeStory(null);
      latestCompiledStoryJsonRef.current = null;
      setVariables([]);
      variableNamesRef.current = [];
      setVariableNames([]);
    }
  }, [restoreRunningSession, updateVariablesFromCompiledJson]);

  // Live-compile scheduler. One compile in flight at a time; while it runs,
  // only the newest source waits behind it (the worker cannot abort, so every
  // request we send is work it will do).
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveWaitingRef = useRef<CompileSource | null>(null);
  const inFlightRef = useRef(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLiveTimer = useCallback(() => {
    if (liveTimerRef.current !== null) clearTimeout(liveTimerRef.current);
    liveTimerRef.current = null;
  }, []);

  const clearStatusTimer = useCallback(() => {
    if (statusTimerRef.current !== null) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = null;
  }, []);

  /** Flip to "Compiling" only if this request is still current and unfinished after the delay. */
  const armCompilingStatus = useCallback((requestId: string) => {
    clearStatusTimer();
    statusTimerRef.current = setTimeout(() => {
      statusTimerRef.current = null;
      if (requestId === latestCompileRequestId.current && inFlightRef.current) {
        setCompileStatus('compiling');
      }
    }, COMPILING_STATUS_DELAY_MS);
  }, [clearStatusTimer]);

  const runCompile = useCallback(async (
    inkSource: CompileSource,
    options: CompileOptions,
    showStatusImmediately: boolean,
  ): Promise<InkCompileResult | null> => {
    const requestId = createCompilerRequestId();
    latestCompileRequestId.current = requestId;
    inFlightRef.current = true;
    setIsCompiling(true);
    if (showStatusImmediately) {
      clearStatusTimer();
      setCompileStatus('compiling');
    } else {
      armCompilingStatus(requestId);
    }

    let result: InkCompileResult | null = null;
    try {
      result = await compileInkScript(inkSource, requestId);
    } finally {
      if (requestId === latestCompileRequestId.current) {
        inFlightRef.current = false;
        clearStatusTimer();
      }
    }

    if (requestId !== latestCompileRequestId.current || result.requestId !== requestId) {
      return null;
    }
    applyCompileResult(result, getEntrySource(inkSource), options);
    setIsCompiling(false);
    return result;
  }, [applyCompileResult, armCompilingStatus, clearStatusTimer]);

  const startLiveCompile = useCallback(async (inkSource: CompileSource) => {
    await runCompile(inkSource, { restoreRunningSession: true }, false);
    const waiting = liveWaitingRef.current;
    if (waiting !== null && !inFlightRef.current) {
      liveWaitingRef.current = null;
      void startLiveCompile(waiting);
    }
  }, [runCompile]);

  const dispatchLiveCompile = useCallback((inkSource: CompileSource) => {
    if (inFlightRef.current) {
      liveWaitingRef.current = inkSource;
      return;
    }
    liveWaitingRef.current = null;
    void startLiveCompile(inkSource);
  }, [startLiveCompile]);

  const livePendingSourceRef = useRef<CompileSource | null>(null);
  const previewVisibleRef = useRef(true);

  const compileLive = useCallback((inkSource: CompileSource) => {
    clearLiveTimer();
    livePendingSourceRef.current = inkSource;
    liveTimerRef.current = setTimeout(() => {
      liveTimerRef.current = null;
      livePendingSourceRef.current = null;
      dispatchLiveCompile(inkSource);
    }, LIVE_COMPILE_IDLE_MS);
  }, [clearLiveTimer, dispatchLiveCompile]);

  const flushLiveCompile = useCallback(() => {
    const pending = livePendingSourceRef.current;
    if (pending === null) return;
    clearLiveTimer();
    livePendingSourceRef.current = null;
    dispatchLiveCompile(pending);
  }, [clearLiveTimer, dispatchLiveCompile]);

  /** A commit-like edit moment: sends any pending live compile now, if the preview can show it. */
  const commitLiveCompile = useCallback((signal: EditCommitSignal) => {
    if (!previewVisibleRef.current || !LIVE_COMPILE_SIGNALS.has(signal)) return;
    flushLiveCompile();
  }, [flushLiveCompile]);

  /** Tell the scheduler whether the preview is on screen. Revealing it flushes a pending compile. */
  const setPreviewVisible = useCallback((visible: boolean) => {
    const wasVisible = previewVisibleRef.current;
    previewVisibleRef.current = visible;
    if (visible && !wasVisible) flushLiveCompile();
  }, [flushLiveCompile]);

  useEffect(() => () => {
    clearLiveTimer();
    clearStatusTimer();
    liveWaitingRef.current = null;
  }, [clearLiveTimer, clearStatusTimer]);

  const compileNow = useCallback(async (inkSource: CompileSource, options: CompileOptions = { restoreRunningSession: false }) => {
    // An explicit Run compiles the latest source; anything waiting is obsolete.
    clearLiveTimer();
    liveWaitingRef.current = null;
    livePendingSourceRef.current = null;
    return runCompile(inkSource, options, true);
  }, [clearLiveTimer, runCompile]);

  const stopStory = useCallback(() => {
    activeRuntimeStoryRef.current = null;
    activeRuntimeStoryJsonRef.current = null;
    draftRef.current = createDraft();
    resetRoute();
    setRunning(false);
    setRuntimeState(null);
  }, [resetRoute, setRunning]);

  const runStory = useCallback((runtimeStoryToRun?: Story) => {
    let activeRuntimeStory = runtimeStoryToRun || latestCompiledRuntimeStory;
    if (!activeRuntimeStory) {
      stopStory();
      return;
    }

    // Always prefer the exact raw JSON from the compiler to avoid inkjs ToJson()/ResetState() bugs
    const storyJson = latestCompiledStoryJsonRef.current ?? (runtimeStoryToRun ? runtimeStoryToRun.ToJson() : activeRuntimeStory.ToJson());

    if (typeof storyJson === 'string') {
      try {
        // Re-instantiate from raw JSON to guarantee a perfectly clean runtime state
        activeRuntimeStory = createRuntimeStoryFromJson(activeRuntimeStory, storyJson);
      } catch (e) {
        console.error('Error instantiating clean story in runStory:', e);
      }
    }

    startSession(activeRuntimeStory, typeof storyJson === 'string' ? storyJson : null);
  }, [latestCompiledRuntimeStory, startSession, stopStory]);

  const restartStory = useCallback(() => {
    const activeStoryJson = latestCompiledStoryJsonRef.current ?? activeRuntimeStoryJsonRef.current;
    let runtimeStory: Story | null = null;

    if (activeStoryJson) {
      try {
        const sourceStory = activeRuntimeStoryRef.current ?? latestCompiledRuntimeStory;
        if (sourceStory) {
          runtimeStory = createRuntimeStoryFromJson(sourceStory, activeStoryJson);
        }
      } catch (error) {
        console.error('[InkPad] restartStory: createRuntimeStoryFromJson failed:', error);
      }
    }

    if (!runtimeStory) {
      setErrors([{
        line: 1,
        message: 'Could not restart story: no compiled story available. Try clicking Run.',
        type: 'error',
      }]);
      return;
    }

    try {
      startSession(runtimeStory, activeStoryJson);
    } catch (error) {
      console.error('[InkPad] restartStory: failed to start session:', error);
    }
  }, [latestCompiledRuntimeStory, startSession]);

  const makeChoice = useCallback((choiceIndex: number) => {
    const runtimeStory = activeRuntimeStoryRef.current;
    if (!runtimeStory || !isRunning) return;
    if (!runtimeStory.currentChoices[choiceIndex]) return;

    const previousDraft = draftRef.current;
    const draft = cloneDraft(previousDraft);
    bindIssueSink(runtimeStory, draft);
    const rollback = () => {
      // Only a snapshot recorded during this call may be loaded back.
      const snapshot = draft.history.length > previousDraft.history.length ? draft.history.at(-1) : undefined;
      bindIssueSink(runtimeStory, previousDraft);
      if (snapshot) {
        try {
          runtimeStory.state.LoadJson(snapshot.storyStateJson);
        } catch {
          // Preserve the original runtime error below.
        }
      }
    };

    try {
      const choice = recordChoice(runtimeStory, draft, choiceIndex);
      if (!choice) return;
      runtimeStory.ChooseChoiceIndex(choiceIndex);
      const runtimeIssues = advanceStory(runtimeStory, draft);
      if (hasRuntimeError(runtimeIssues)) {
        rollback();
        setErrors(prefixRuntimeIssues('Error processing choice', runtimeIssues));
        return;
      }

      publish(runtimeStory, draft);
      appendRouteStep({ kind: 'choice', index: choiceIndex, text: choice.text });
    } catch (error) {
      rollback();
      console.error('Error making choice:', error);
      setErrors([{
        line: 1,
        message: 'Error processing choice: ' + (error as Error).message,
        type: 'error'
      }]);
    }
  }, [appendRouteStep, isRunning, publish]);

  const stepBack = useCallback(() => {
    const runtimeStory = activeRuntimeStoryRef.current;
    const snapshot = draftRef.current.history.at(-1);
    if (!runtimeStory || !snapshot || !isRunning) return;

    try {
      runtimeStory.state.LoadJson(snapshot.storyStateJson);
      const draft = cloneDraft(draftRef.current);
      draft.history = draft.history.slice(0, -1);
      draft.transcript = draft.transcript.slice(0, snapshot.transcriptLength);
      draftRef.current = draft;
      updateRuntimeState(runtimeStory);
      replayPathRef.current = replayPathRef.current.slice(0, Math.max(0, replayedCountRef.current - 1));
      replayedCountRef.current = replayPathRef.current.length;
      clearRestoreNotice();
    } catch (error) {
      console.error('Error stepping back:', error);
      setErrors([{
        line: 1,
        message: 'Error stepping back: ' + (error as Error).message,
        type: 'error',
      }]);
    }
  }, [clearRestoreNotice, isRunning, updateRuntimeState]);

  const jumpToKnot = useCallback((knotName: string) => {
    const runtimeStory = activeRuntimeStoryRef.current;
    if (!runtimeStory || !isRunning) return;
    try {
      runtimeStory.ChoosePathString(knotName);
      draftRef.current = createDraft();
      updateRuntimeState(runtimeStory);
      // Earlier steps stay recorded so replay can rebuild the variables they
      // set; the jump itself wipes the visible transcript, as it just did here.
      appendRouteStep({ kind: 'jump', knot: knotName });
    } catch (error) {
      console.error('Error jumping to knot:', error);
      setErrors([{
        line: 1,
        message: 'Error jumping to knot "' + knotName + '": ' + (error as Error).message,
        type: 'error'
      }]);
    }
  }, [appendRouteStep, isRunning, updateRuntimeState]);

  const dismissRestoreNotice = clearRestoreNotice;

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
    restoreNotice,
    restoreNoticeKnot,
    dismissRestoreNotice,
    runStory,
    restartStory,
    stopStory,
    makeChoice,
    stepBack,
    compileLive,
    commitLiveCompile,
    setPreviewVisible,
    compileNow,
    jumpToKnot
  };
}
