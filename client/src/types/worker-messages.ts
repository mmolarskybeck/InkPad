/**
 * Shared type definitions for Web Worker communication
 * 
 * IMPORTANT: These types define the contract between workers and the main thread.
 * Any changes here must be reflected in both the worker implementation and
 * the main thread code that consumes the worker messages.
 */

/**
 * Message sent from the Ink compiler worker to the main thread
 * 
 * CRITICAL: The `json` field contains a JSON STRING, not a parsed object.
 * This is intentional to maintain a clear boundary and avoid issues with
 * the browser's structured cloning algorithm.
 */
export interface CompilerWorkerSuccessMessage {
  ok: true;
  json: string; // JSON string representation of compiled Ink story
}

export interface CompilerWorkerErrorMessage {
  ok: false;
  error: string; // Error message describing what went wrong
}

export type CompilerWorkerMessage = CompilerWorkerSuccessMessage | CompilerWorkerErrorMessage;

/**
 * Input message sent to the Ink compiler worker
 */
export type CompilerWorkerInput = string; // Raw Ink script text