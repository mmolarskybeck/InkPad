import { Story } from 'inkjs';

interface CompileResult {
  success: boolean;
  story?: any;
  errors?: Array<{
    message: string;
    line?: number;
    type: string;
  }>;
  compileTime?: number;
}

class CompilationError extends Error {
  constructor(public errors: any[], public isWakeUp = false) {
    super(errors[0]?.message || 'Compilation failed');
  }
}

export interface InkError {
  line: number;
  column?: number;
  message: string;
  type: 'error' | 'warning';
}

export interface CompiledStory {
  story: Story | null;
  errors: InkError[];
  knots: string[];
  rawJSON?: any; // The raw compiled JSON from inklecate
}

export async function compileWithRetry(
  inkSource: string, 
  options = { maxRetries: 3, onWakeUp: () => {} }
): Promise<CompileResult> {
  const { maxRetries, onWakeUp } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get API URL from environment or default to relative path
      const apiUrl = import.meta.env.VITE_API_URL || '';
      
      const response = await fetch(`${apiUrl}/api/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source: inkSource }),
      });

      // Handle cold start (service waking up)
      if (response.status === 502 || response.status === 503) {
        if (attempt === 0) {
          onWakeUp();
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new CompilationError([{ 
          message: result.error || 'Compilation failed', 
          type: 'compilation' 
        }]);
      }

      return {
        success: true,
        story: result.compiled,
        compileTime: Date.now()
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on compilation errors (syntax errors, etc)
      if (error instanceof CompilationError && !error.isWakeUp) {
        throw error;
      }

      // On final attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Compilation failed after retries');
}

// Health check for warming up the service
export async function checkCompilerHealth(): Promise<boolean> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${apiUrl}/health`);
    const data = await response.json();
    return data.status === 'healthy';
  } catch {
    return false;
  }
}

export async function compileInkScript(inkText: string): Promise<CompiledStory> {
  try {
    // Use the new retry logic for better reliability
    const result = await compileWithRetry(inkText, {
      maxRetries: 3,
      onWakeUp: () => {} // No UI callback here, handled in components
    });

    if (result.success && result.story) {
      // Create story from compiled JSON
      const story = new Story(result.story);
      const knots = extractKnots(inkText);
      
      return {
        story,
        errors: [],
        knots,
        rawJSON: result.story
      };
    } else {
      return {
        story: null,
        errors: result.errors?.map((err: any) => ({
          line: err.line || 1,
          column: err.column,
          message: err.message,
          type: 'error' as const
        })) || [{
          line: 1,
          column: undefined,
          message: 'Compilation failed',
          type: 'error' as const
        }],
        knots: extractKnots(inkText)
      };
    }
  } catch (error) {
    if (error instanceof CompilationError) {
      return {
        story: null,
        errors: error.errors.map((err: any) => ({
          line: err.line || 1,
          column: err.column,
          message: err.message,
          type: 'error' as const
        })),
        knots: extractKnots(inkText)
      };
    }
    // Fallback: try client-side compilation (will likely fail for raw Ink)
    try {
      const story = new Story(inkText);
      const knots = extractKnots(inkText);
      
      return {
        story,
        errors: [],
        knots
      };
    } catch (clientError) {
      const parsedError = parseInkError(error as Error, inkText);
      
      return {
        story: null,
        errors: [parsedError],
        knots: extractKnots(inkText)
      };
    }
  }
}

// Keep the synchronous version for backward compatibility
export function compileInkScriptSync(inkText: string): CompiledStory {
  try {
    const story = new Story(inkText);
    
    // Extract knots from the story
    const knots = extractKnots(inkText);
    
    return {
      story,
      errors: [],
      knots
    };
  } catch (error) {
    // Parse error message to extract line/column information
    const parsedError = parseInkError(error as Error, inkText);
    
    return {
      story: null,
      errors: [parsedError],
      knots: extractKnots(inkText) // Try to extract knots even with errors
    };
  }
}

function parseInkError(error: Error, inkText: string): InkError {
  const message = error.message;
  
  // Try to extract line number from error message
  const lineMatch = message.match(/line (\d+)/i);
  const line = lineMatch ? parseInt(lineMatch[1]) : 1;
  
  // Try to extract column from error message
  const columnMatch = message.match(/column (\d+)/i);
  const column = columnMatch ? parseInt(columnMatch[1]) : undefined;
  
  return {
    line,
    column,
    message: message.replace(/line \d+:?\s*/i, '').replace(/column \d+:?\s*/i, ''),
    type: 'error'
  };
}

function extractKnots(inkText: string): string[] {
  const knotPattern = /^===\s*([^=\s]+)\s*===/gm;
  const knots: string[] = [];
  let match;
  
  while ((match = knotPattern.exec(inkText)) !== null) {
    knots.push(match[1].trim());
  }
  
  return knots;
}

export function validateInkSyntax(inkText: string): InkError[] {
  const errors: InkError[] = [];
  const lines = inkText.split('\n');
  
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();
    
    // Check for common syntax errors
    if (trimmedLine.includes('===') && !trimmedLine.match(/^===\s*\w+\s*===/)) {
      errors.push({
        line: lineNumber,
        message: 'Invalid knot declaration syntax',
        type: 'error'
      });
    }
    
    // Check for unterminated strings
    const stringMatches = line.match(/"/g);
    if (stringMatches && stringMatches.length % 2 !== 0) {
      errors.push({
        line: lineNumber,
        message: 'Unterminated string',
        type: 'error'
      });
    }
    
    // Check for invalid variable declarations
    if (trimmedLine.startsWith('VAR') && !trimmedLine.match(/^VAR\s+\w+\s*=/)) {
      errors.push({
        line: lineNumber,
        message: 'Invalid variable declaration',
        type: 'warning'
      });
    }
  });
  
  return errors;
}
