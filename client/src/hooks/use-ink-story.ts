import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Story } from 'inkjs';
import {
  compileInkScript,
  createCompilerRequestId,
  type InkCompileResult,
  type InkCompilerError,
} from '@/lib/ink-compiler';
import { extractInkVariables, convertToUIVariables, convertStateToUIVariables } from '@/lib/ink-variable-utils';
import { normalizeStoryJson } from '@/lib/json-utils';
import type { StoryRuntimeState } from '@/types/story-runtime';
import { debounce } from 'lodash';

interface InkVariable {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'list';
}

export function useInkStory() {
  const [latestCompiledRuntimeStory, setLatestCompiledRuntimeStory] = useState<Story | null>(null);
  const [runtimeState, setRuntimeState] = useState<StoryRuntimeState | null>(null);
  const [errors, setErrors] = useState<InkCompilerError[]>([]);
  const [variables, setVariables] = useState<InkVariable[]>([]);
  const [knots, setKnots] = useState<string[]>([]);
  const [variableNames, setVariableNames] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  
  const activeRuntimeStoryRef = useRef<Story | null>(null);
  const latestCompileRequestId = useRef<string | null>(null);

  const updateVariablesFromCompiledJson = useCallback((compiledJsonData: any) => {
    try {
      if (!compiledJsonData) {
        setVariables([]);
        return;
      }
      
      const inkVariables = extractInkVariables(compiledJsonData);
      const uiVariables = convertToUIVariables(inkVariables);
      setVariables(uiVariables);
    } catch (error) {
      console.error('Error extracting variables from JSON:', error);
      setVariables([]);
    }
  }, []);

  const updateRuntimeState = useCallback((runtimeStory: Story) => {
    if (!runtimeStory || !runtimeStory.canContinue && runtimeStory.currentChoices.length === 0) {
      setRuntimeState(null);
      return;
    }

    let text = '';
    while (runtimeStory.canContinue) {
      const nextText = runtimeStory.Continue();
      text += (nextText || '') + '\n';
    }

    const choices = runtimeStory.currentChoices.map((choice, index) => ({
      text: choice.text,
      index: index
    }));

    setRuntimeState({
      text: text.trim(),
      choices,
      canContinue: runtimeStory.canContinue
    });

    // Update variables from the live story state
    if (runtimeStory.variablesState && variableNames.length > 0) {
      const uiVariables = convertStateToUIVariables(runtimeStory.variablesState, variableNames);
      setVariables(uiVariables);
    }
  }, [variableNames]);

  const applyCompileResult = useCallback((result: InkCompileResult) => {
    setErrors(result.errors);
    setKnots(result.knots);
    
    if (result.runtimeStory && result.compiledJson) {
      setLatestCompiledRuntimeStory(result.runtimeStory);
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
      setVariables([]);
      setVariableNames([]);
    }
  }, [updateVariablesFromCompiledJson]);

  const debouncedLiveCompile = useMemo(
    () => debounce(async (inkSource: string, requestId: string) => {
      if (requestId !== latestCompileRequestId.current) return;

      setIsCompiling(true);
      const result = await compileInkScript(inkSource, requestId);
      if (
        requestId !== latestCompileRequestId.current ||
        result.requestId !== latestCompileRequestId.current
      ) {
        return;
      }

      applyCompileResult(result);
      setIsCompiling(false);
    }, 500),
    [applyCompileResult]
  );

  useEffect(() => {
    return () => {
      debouncedLiveCompile.cancel();
    };
  }, [debouncedLiveCompile]);

  const compileLive = useCallback((inkSource: string) => {
    const requestId = createCompilerRequestId();
    latestCompileRequestId.current = requestId;
    debouncedLiveCompile(inkSource, requestId);
  }, [debouncedLiveCompile]);

  const compileNow = useCallback(async (inkSource: string) => {
    debouncedLiveCompile.cancel();
    const requestId = createCompilerRequestId();
    latestCompileRequestId.current = requestId;
    setIsCompiling(true);

    const result = await compileInkScript(inkSource, requestId);
    if (
      requestId !== latestCompileRequestId.current ||
      result.requestId !== latestCompileRequestId.current
    ) {
      return null;
    }

    applyCompileResult(result);
    setIsCompiling(false);
    return result;
  }, [applyCompileResult, debouncedLiveCompile]);

  const runStory = useCallback((runtimeStoryToRun?: Story) => {
    const activeRuntimeStory = runtimeStoryToRun || latestCompiledRuntimeStory;
    if (activeRuntimeStory) {
      activeRuntimeStoryRef.current = activeRuntimeStory;
      activeRuntimeStory.ResetState(); // IMPORTANT: Reset state before running
      setIsRunning(true);
      updateRuntimeState(activeRuntimeStory);
    } else {
      setIsRunning(false);
    }
  }, [latestCompiledRuntimeStory, updateRuntimeState]);

  const restartStory = useCallback(() => {
    if (activeRuntimeStoryRef.current) {
      activeRuntimeStoryRef.current.ResetState();
      setIsRunning(true);
      updateRuntimeState(activeRuntimeStoryRef.current);
    }
  }, [updateRuntimeState]);

  const makeChoice = useCallback((choiceIndex: number) => {
    if (activeRuntimeStoryRef.current && isRunning) {
      try {
        activeRuntimeStoryRef.current.ChooseChoiceIndex(choiceIndex);
        updateRuntimeState(activeRuntimeStoryRef.current);
      } catch (error) {
        console.error('Error making choice:', error);
        setErrors([{
          line: 1,
          message: 'Error processing choice: ' + (error as Error).message,
          type: 'error'
        }]);
      }
    }
  }, [isRunning, updateRuntimeState]);

  const jumpToKnot = useCallback((knotName: string) => {
    if (activeRuntimeStoryRef.current && isRunning) {
      try {
        // In inkjs, we can use ChoosePathString to jump to a knot
        activeRuntimeStoryRef.current.ChoosePathString(knotName);
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
    runStory,
    restartStory,
    makeChoice,
    compileLive,
    compileNow,
    jumpToKnot
  };
}
