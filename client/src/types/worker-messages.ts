/**
 * Shared type definitions for Web Worker communication
 * 
 * IMPORTANT: These types define the contract between workers and the main thread.
 * Any changes here must be reflected in both the worker implementation and
 * the main thread code that consumes the worker messages.
 */

export interface InkCompilerMessage {
  fileId?: string;
  message: string;
  line?: number;
  column?: number;
  // "info" = inkjs Author/TODO message (ErrorType 0); not a compiler error.
  type: "error" | "warning" | "info";
}

export interface InkCompileInput {
  entryFile: string;
  files: Record<string, string>;
  unresolvedIncludePolicy?: "strict" | "ignore";
}

export interface CompilerCompileRequest {
  type: "compile";
  requestId: string;
  entryFile: string;
  files: Record<string, string>;
  unresolvedIncludePolicy?: "strict" | "ignore";
}

export type CompilerRequest = CompilerCompileRequest;

/**
 * CRITICAL: `storyJson` contains a JSON string, not a parsed object.
 * Keeping the worker boundary string-based avoids structured-clone surprises.
 */
export interface CompilerSuccessResponse {
  type: "compile-success";
  requestId: string;
  storyJson: string;
  warnings?: InkCompilerMessage[];
}

export interface CompilerErrorResponse {
  type: "compile-error";
  requestId: string;
  errors: InkCompilerMessage[];
  warnings?: InkCompilerMessage[];
}

export type CompilerResponse = CompilerSuccessResponse | CompilerErrorResponse;
