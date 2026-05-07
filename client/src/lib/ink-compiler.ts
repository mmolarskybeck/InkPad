// src/lib/ink-compiler.ts
import { Story } from "inkjs";
import { normalizeStoryJson } from "./json-utils";
import type {
  CompilerErrorResponse,
  CompilerResponse,
  InkCompilerMessage,
} from "../types/worker-messages";

////////////////////////////////////////////////////////////////////////////////
// Types
////////////////////////////////////////////////////////////////////////////////

export interface InkCompilerError {
  line: number;
  column?: number;
  message: string;
  type: "error" | "warning";
}

export interface InkCompileResult {
  requestId: string;
  runtimeStory: Story | null;
  errors: InkCompilerError[];
  knots: string[];
  compiledJson?: string;
}

////////////////////////////////////////////////////////////////////////////////
// 1. — compileInkViaWorker
//     Wrapper around the Web Worker that actually runs inkjs/full
////////////////////////////////////////////////////////////////////////////////

import CompilerWorker from "../workers/ink-compiler.worker?worker";

/**
 * IMPORTANT: Worker Communication Contract
 *
 * This function expects JSON STRINGS from the worker, not parsed objects.
 * The worker sends stringified JSON - if this changes, update both sides.
 *
 * See types/worker-messages.ts for the complete contract definition.
 */
export function createCompilerRequestId(): string {
  return `compile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

class CompilerResponseError extends Error {
  constructor(readonly response: CompilerErrorResponse) {
    super(response.errors[0]?.message ?? "Compilation failed");
  }
}

async function compileInkViaWorker(source: string, requestId: string): Promise<string> {
  const worker = new CompilerWorker();

  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<CompilerResponse>) => {
      worker.terminate();
      if (e.data.requestId !== requestId) {
        reject(new Error("Compiler response requestId did not match the request."));
        return;
      }

      if (e.data.type === "compile-success") {
        // CRITICAL: Worker sends JSON string, not parsed object
        resolve(e.data.storyJson);
      } else {
        reject(new CompilerResponseError(e.data));
      }
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage({
      type: "compile",
      requestId,
      source,
    });
  });
}

////////////////////////////////////////////////////////////////////////////////
// 2. — compileInkScript  (async)
//     Calls the worker, builds a Story, maps errors
////////////////////////////////////////////////////////////////////////////////

export async function compileInkScript(
  inkSource: string,
  requestId = createCompilerRequestId()
): Promise<InkCompileResult> {
  try {
    const compiledJson = await compileInkViaWorker(inkSource, requestId);
    const storyData = normalizeStoryJson(compiledJson);
    const runtimeStory = new Story(storyData);
    return {
      requestId,
      runtimeStory,
      errors: [],
      knots: extractKnots(inkSource),
      compiledJson,
    };
  } catch (err) {
    // Worker threw – most likely a compilation error.  Try to parse details.
    const parsed = err instanceof CompilerResponseError
      ? normalizeCompilerMessage(err.response.errors[0])
      : parseInkError(err as Error);

    return {
      requestId,
      runtimeStory: null,
      errors: [parsed],
      knots: extractKnots(inkSource),
    };
  }
}

////////////////////////////////////////////////////////////////////////////////
// 3. — compileInkScriptSync  (fallback / tests)
//     Uses inkjs runtime’s on‑the‑fly compile (for tiny scripts or unit tests)
//     NOTE: this is *not* 100 % spec‑accurate vs. inklecate, but handy offline.
////////////////////////////////////////////////////////////////////////////////

export function compileInkScriptSync(inkSource: string): InkCompileResult {
  const requestId = createCompilerRequestId();

  try {
    const runtimeStory = new Story(inkSource); // runtime compile
    return {
      requestId,
      runtimeStory,
      errors: [],
      knots: extractKnots(inkSource),
    };
  } catch (err) {
    return {
      requestId,
      runtimeStory: null,
      errors: [parseInkError(err as Error)],
      knots: extractKnots(inkSource),
    };
  }
}

////////////////////////////////////////////////////////////////////////////////
// 4. — helper utilities (unchanged)
////////////////////////////////////////////////////////////////////////////////

// crude parser for “line 12: Something went wrong” messages
function parseInkError(error: Error): InkCompilerError {
  const msg = error.message ?? "Compilation failed";
  const lineMatch = msg.match(/line (\d+)/i);
  const colMatch = msg.match(/column (\d+)/i);
  return {
    line: lineMatch ? Number(lineMatch[1]) : 1,
    column: colMatch ? Number(colMatch[1]) : undefined,
    message: msg.replace(/line \d+:?\s*/i, "").replace(/column \d+:?\s*/i, ""),
    type: "error",
  };
}

function normalizeCompilerMessage(message?: InkCompilerMessage): InkCompilerError {
  if (!message) {
    return {
      line: 1,
      message: "Compilation failed",
      type: "error",
    };
  }

  const parsed = parseInkError(new Error(message.message));

  return {
    line: message.line ?? parsed.line,
    column: message.column ?? parsed.column,
    message: message.line ? message.message : parsed.message,
    type: message.type,
  };
}

function extractKnots(source: string): string[] {
  const re = /^===\s*([^=\s]+)\s*===/gm;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.push(m[1].trim());
  return out;
}

////////////////////////////////////////////////////////////////////////////////
// 5. — extra lint / syntax checks (optional, left from your old file)
////////////////////////////////////////////////////////////////////////////////

export function validateInkSyntax(inkSource: string): InkCompilerError[] {
  const errors: InkCompilerError[] = [];
  const lines = inkSource.split("\n");
  lines.forEach((l, i) => {
    const n = i + 1;
    const t = l.trim();
    if (t.includes("===") && !/^===\s*\w+\s*===/.test(t))
      errors.push({ line: n, message: "Invalid knot declaration", type: "error" });
    if ((l.match(/"/g) ?? []).length % 2)
      errors.push({ line: n, message: "Unterminated string", type: "error" });
    if (t.startsWith("VAR") && !/^VAR\s+\w+\s*=/.test(t))
      errors.push({ line: n, message: "Invalid variable declaration", type: "warning" });
  });
  return errors;
}
