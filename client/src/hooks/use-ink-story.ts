import { useState, useCallback, useRef } from 'react';
import { Story } from 'inkjs';
import { compileInkScript, compileInkScriptSync, type InkError } from '@/lib/ink-compiler';
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

    // Update variables
    updateVariables(inkStory);
  }, []);

  const updateVariables = useCallback((inkStory: Story) => {
    try {
      const variableNames = inkStory.variablesState.globalVariableNames;
      const vars: InkVariable[] = [];
      
      // Check if variableNames is iterable
      if (variableNames && typeof variableNames[Symbol.iterator] === 'function') {
        for (const varName of variableNames) {
          const value = inkStory.variablesState.$(varName);
          let type: InkVariable['type'] = 'string';
          
          if (typeof value === 'number') {
            type = 'number';
          } else if (typeof value === 'boolean') {
            type = 'boolean';
          } else if (Array.isArray(value)) {
            type = 'list';
          }
          
          vars.push({
            name: varName,
            value,
            type
          });
        }
      } else if (variableNames && typeof variableNames === 'object') {
        // Handle case where variableNames might be an object instead of array
        for (const varName in variableNames) {
          if (variableNames.hasOwnProperty(varName)) {
            const value = inkStory.variablesState.$(varName);
            let type: InkVariable['type'] = 'string';
            
            if (typeof value === 'number') {
              type = 'number';
            } else if (typeof value === 'boolean') {
              type = 'boolean';
            } else if (Array.isArray(value)) {
              type = 'list';
            }
            
            vars.push({
              name: varName,
              value,
              type
            });
          }
        }
      }
      
      setVariables(vars);
    } catch (error) {
      console.warn('Error updating variables:', error);
      setVariables([]);
    }
  }, []);

  const debouncedCompile = useCallback(
    debounce(async (inkText: string) => {
      const result = await compileInkScript(inkText);
      setErrors(result.errors);
      setKnots(result.knots);
      
      if (result.story) {
        setStory(result.story);
        currentStory.current = result.story;
      }
    }, 500),
    []
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
  }, [updateStoryState]);

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
        updateVariables(currentStory.current);
      } catch (error) {
        console.error('Error jumping to knot:', error);
        setErrors([{
          line: 1,
          message: 'Error jumping to knot "' + knotName + '": ' + (error as Error).message,
          type: 'error'
        }]);
      }
    }
  }, [isRunning, updateStoryState, updateVariables]);

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
