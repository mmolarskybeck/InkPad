import { useState, useCallback, useRef } from 'react';
import { Story } from 'inkjs';
import { compileInkScript, compileInkScriptSync, type InkError } from '@/lib/ink-compiler';
import { extractInkVariables, convertToUIVariables, convertStateToUIVariables } from '@/lib/ink-variable-utils';
import { debounce } from 'lodash';

interface StoryState {
  text: string;
  choices: Array<{
    text: string;
    index: number;
  }>;
  canContinue: boolean;
}

interface InkVariable {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'list';
}

export function useInkStory() {
  const [story, setStory] = useState<Story | null>(null);
  const [storyState, setStoryState] = useState<StoryState | null>(null);
  const [errors, setErrors] = useState<InkError[]>([]);
  const [variables, setVariables] = useState<InkVariable[]>([]);
  const [knots, setKnots] = useState<string[]>([]);
  const [variableNames, setVariableNames] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  const currentStory = useRef<Story | null>(null);

  const updateVariablesFromJSON = useCallback((compiledJSON: any) => {
    try {
      if (!compiledJSON) {
        setVariables([]);
        return;
      }
      
      const inkVariables = extractInkVariables(compiledJSON);
      const uiVariables = convertToUIVariables(inkVariables);
      setVariables(uiVariables);
    } catch (error) {
      console.error('Error extracting variables from JSON:', error);
      setVariables([]);
    }
  }, []);

  const updateStoryState = useCallback((inkStory: Story) => {
    console.log('updateStoryState called');
    console.log('inkStory:', inkStory);
    console.log('inkStory.variablesState:', inkStory.variablesState);
    console.log('variableNames:', variableNames);
    console.log('variableNames.length:', variableNames.length);
    
    if (!inkStory || !inkStory.canContinue && inkStory.currentChoices.length === 0) {
      setStoryState(null);
      return;
    }

    let text = '';
    while (inkStory.canContinue) {
      const nextText = inkStory.Continue();
      text += (nextText || '') + '\n';
    }

    const choices = inkStory.currentChoices.map((choice, index) => ({
      text: choice.text,
      index: index
    }));

    setStoryState({
      text: text.trim(),
      choices,
      canContinue: inkStory.canContinue
    });

    // Update variables from the live story state
    console.log('About to check variables condition');
    console.log('inkStory.variablesState exists?', !!inkStory.variablesState);
    console.log('variableNames.length > 0?', variableNames.length > 0);
    
    if (inkStory.variablesState && variableNames.length > 0) {
      console.log('Calling convertStateToUIVariables');
      const uiVariables = convertStateToUIVariables(inkStory.variablesState, variableNames);
      setVariables(uiVariables);
    } else {
      console.log('NOT calling convertStateToUIVariables because condition failed');
      if (!inkStory.variablesState) {
        console.log('  - inkStory.variablesState is falsy');
      }
      if (variableNames.length === 0) {
        console.log('  - variableNames is empty');
      }
    }
  }, [updateVariablesFromJSON, variableNames]);

  const applyCompileResult = useCallback((result: any) => {
    console.log('applyCompileResult called');
    console.log('result:', result);
    console.log('result.rawJSON:', result.rawJSON);
    
    setErrors(result.errors);
    setKnots(result.knots);
    
    if (result.story) {
      setStory(result.story);
      currentStory.current = result.story;
      // Update variables when story is compiled (even if not running)
      // Pass the raw JSON to make variable extraction easier
      // Parse rawJSON if it's a string
      const jsonData = typeof result.rawJSON === 'string' ? JSON.parse(result.rawJSON) : result.rawJSON;
      console.log('jsonData (parsed if needed):', jsonData);
      
      updateVariablesFromJSON(jsonData);
      // Also store the names of the variables
      const extractedVars = extractInkVariables(jsonData);
      console.log('extractedVars:', extractedVars);
      const varNames = extractedVars.map(v => v.name);
      console.log('Setting variableNames to:', varNames);
      setVariableNames(varNames);
    } else {
      // Clear variables if compilation failed
      setVariables([]);
      setVariableNames([]);
    }
  }, [updateVariablesFromJSON]);

  const debouncedCompile = useCallback(
    debounce(async (inkText: string) => {
      const result = await compileInkScript(inkText);
      applyCompileResult(result);
    }, 500),
    [applyCompileResult]
  );

  const compileStory = useCallback((inkText: string) => {
    debouncedCompile(inkText);
  }, [debouncedCompile]);

  const compileStoryNow = useCallback(async (inkText: string) => {
    const result = await compileInkScript(inkText);
    applyCompileResult(result);
    return result;
  }, [applyCompileResult]);

  const runStory = useCallback((storyToRun?: any) => {
    const activeStory = storyToRun || story;
    if (activeStory) {
      currentStory.current = activeStory;
      activeStory.ResetState(); // IMPORTANT: Reset state before running
      setIsRunning(true);
      updateStoryState(activeStory);
    } else {
      setIsRunning(false);
    }
  }, [story, updateStoryState]);

  const restartStory = useCallback(() => {
    if (currentStory.current) {
      currentStory.current.ResetState();
      setIsRunning(true);
      updateStoryState(currentStory.current);
    }
  }, [updateStoryState]);

  const makeChoice = useCallback((choiceIndex: number) => {
    if (currentStory.current && isRunning) {
      try {
        currentStory.current.ChooseChoiceIndex(choiceIndex);
        updateStoryState(currentStory.current);
      } catch (error) {
        console.error('Error making choice:', error);
        setErrors([{
          line: 1,
          message: 'Error processing choice: ' + (error as Error).message,
          type: 'error'
        }]);
      }
    }
  }, [isRunning, updateStoryState]);

  const jumpToKnot = useCallback((knotName: string) => {
    if (currentStory.current && isRunning) {
      try {
        // In inkjs, we can use ChoosePathString to jump to a knot
        currentStory.current.ChoosePathString(knotName);
        updateStoryState(currentStory.current);
      } catch (error) {
        console.error('Error jumping to knot:', error);
        setErrors([{
          line: 1,
          message: 'Error jumping to knot "' + knotName + '": ' + (error as Error).message,
          type: 'error'
        }]);
      }
    }
  }, [isRunning, updateStoryState]);

  return {
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
  };
}
