// src/lib/ink-compiler.ts
import { Story } from "inkjs";
import { normalizeStoryJson } from "./json-utils";

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
import type { CompilerWorkerMessage } from "../types/worker-messages";

/**
 * IMPORTANT: Worker Communication Contract
 *
 * This function expects JSON STRINGS from the worker, not parsed objects.
 * The worker sends stringified JSON - if this changes, update both sides.
 *
 * See types/worker-messages.ts for the complete contract definition.
 */
async function compileInkViaWorker(source: string): Promise<string> {
  const worker = new CompilerWorker();

  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<CompilerWorkerMessage>) => {
      worker.terminate();
      if (e.data.ok) {
        // CRITICAL: Worker sends JSON string, not parsed object
        resolve(e.data.json);
      } else {
        reject(new Error(e.data.error));
      }
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage(source);
  });
}

////////////////////////////////////////////////////////////////////////////////
// 2. — compileInkScript  (async)
//     Calls the worker, builds a Story, maps errors
////////////////////////////////////////////////////////////////////////////////

export async function compileInkScript(
  inkSource: string
): Promise<InkCompileResult> {
  try {
    const compiledJson = await compileInkViaWorker(inkSource);
    const storyData = normalizeStoryJson(compiledJson);
    const runtimeStory = new Story(storyData);
    return {
      runtimeStory,
      errors: [],
      knots: extractKnots(inkSource),
      compiledJson,
    };
  } catch (err) {
    // Worker threw – most likely a compilation error.  Try to parse details.
    const parsed = parseInkError(err as Error, inkSource);
    return {
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
  try {
    const runtimeStory = new Story(inkSource); // runtime compile
    return {
      runtimeStory,
      errors: [],
      knots: extractKnots(inkSource),
    };
  } catch (err) {
    return {
      runtimeStory: null,
      errors: [parseInkError(err as Error, inkSource)],
      knots: extractKnots(inkSource),
    };
  }
}

////////////////////////////////////////////////////////////////////////////////
// 4. — helper utilities (unchanged)
////////////////////////////////////////////////////////////////////////////////

// crude parser for “line 12: Something went wrong” messages
function parseInkError(error: Error, inkSource: string): InkCompilerError {
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
