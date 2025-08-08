/**
 * Utilities for handling JSON data that might come in different formats
 */

/**
 * Normalizes JSON data that could be a string or already-parsed object
 * Useful for handling data from various sources (imports, API, etc.)
 */
export function normalizeStoryJson(json: string | object): object {
  if (typeof json === 'string') {
    try {
      return JSON.parse(json);
    } catch (error) {
      throw new Error(`Invalid JSON string: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  if (typeof json === 'object' && json !== null) {
    return json;
  }
  
  throw new Error('Expected JSON string or object, got: ' + typeof json);
}