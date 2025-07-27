import { useState, useCallback, useRef } from 'react';
import { Story } from 'inkjs';
import { compileInkScript, compileInkScriptSync, type InkError } from '@/lib/ink-compiler';
import { extractInkVariables, convertToUIVariables } from '@/lib/ink-variable-utils';
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
    if (!inkStory || !inkStory.canContinue && inkStory.currentChoices.length === 0) {
      setStoryState(null);
      return;
    }

    let text = '';
    while (inkStory.canContinue) {
      text += inkStory.Continue() + '\n';
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

    // Update variables from the raw JSON if available
    const storyData = (inkStory as any)._inkJSONData || (inkStory as any).inkJSONData || (inkStory as any)._data;
    if (storyData) {
      updateVariablesFromJSON(storyData);
    }
  }, [updateVariablesFromJSON]);

  const debouncedCompile = useCallback(
    debounce(async (inkText: string) => {
      const result = await compileInkScript(inkText);
      setErrors(result.errors);
      setKnots(result.knots);
      
      if (result.story) {
        setStory(result.story);
        currentStory.current = result.story;
        // Update variables when story is compiled (even if not running)
        // Pass the raw JSON to make variable extraction easier
        updateVariablesFromJSON(result.rawJSON);
      } else {
        // Clear variables if compilation failed
        setVariables([]);
      }
    }, 500),
    [updateVariablesFromJSON]
  );

  const compileStory = useCallback((inkText: string) => {
    debouncedCompile(inkText);
  }, [debouncedCompile]);

  const runStory = useCallback(async (inkText: string) => {
    const result = await compileInkScript(inkText);
    
    if (result.errors.length > 0) {
      setErrors(result.errors);
      setIsRunning(false);
      return;
    }

    if (result.story) {
      setStory(result.story);
      currentStory.current = result.story;
      setErrors([]);
      setKnots(result.knots);
      setIsRunning(true);
      updateStoryState(result.story);
    }
  }, [updateStoryState, updateVariablesFromJSON]);

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
    jumpToKnot
  };
}
