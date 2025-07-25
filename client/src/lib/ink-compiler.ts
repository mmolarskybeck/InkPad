import { Story } from 'inkjs';

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
}

export function compileInkScript(inkText: string): CompiledStory {
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
