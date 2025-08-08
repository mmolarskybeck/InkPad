// src/lib/ink-compiler.ts
import { Story } from "inkjs";

////////////////////////////////////////////////////////////////////////////////
// Types
////////////////////////////////////////////////////////////////////////////////

export interface InkError {
  line: number;
  column?: number;
  message: string;
  type: "error" | "warning";
}

export interface CompiledStory {
  story: Story | null;
  errors: InkError[];
  knots: string[];
  rawJSON?: string; // raw compiled JSON
}

////////////////////////////////////////////////////////////////////////////////
// 1. — compileInkViaWorker
//     Wrapper around the Web Worker that actually runs inkjs/full
////////////////////////////////////////////////////////////////////////////////

import CompilerWorker from "../workers/ink-compiler.worker?worker";

async function compileInkViaWorker(source: string): Promise<string> {
  const worker = new CompilerWorker();

  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<any>) => {
      worker.terminate();
      if (e.data.ok) resolve(e.data.json);
      else reject(new Error(e.data.error));
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
  inkText: string
): Promise<CompiledStory> {
  try {
    const json = await compileInkViaWorker(inkText);
    const data = JSON.parse(json);
    const story = new Story(data);
    return {
      story,
      errors: [],
      knots: extractKnots(inkText),
      rawJSON: json, // Store the raw JSON string for export
    };
  } catch (err) {
    // Worker threw – most likely a compilation error.  Try to parse details.
    const parsed = parseInkError(err as Error, inkText);
    return {
      story: null,
      errors: [parsed],
      knots: extractKnots(inkText),
    };
  }
}

// Non-debounced version for immediate compilation (exports)
export async function compileInkScriptNow(inkText: string): Promise<CompiledStory> {
  return compileInkScript(inkText);
}

////////////////////////////////////////////////////////////////////////////////
// 3. — compileInkScriptSync  (fallback / tests)
//     Uses inkjs runtime’s on‑the‑fly compile (for tiny scripts or unit tests)
//     NOTE: this is *not* 100 % spec‑accurate vs. inklecate, but handy offline.
////////////////////////////////////////////////////////////////////////////////

export function compileInkScriptSync(inkText: string): CompiledStory {
  try {
    const story = new Story(inkText); // runtime compile
    return {
      story,
      errors: [],
      knots: extractKnots(inkText),
    };
  } catch (err) {
    return {
      story: null,
      errors: [parseInkError(err as Error, inkText)],
      knots: extractKnots(inkText),
    };
  }
}

////////////////////////////////////////////////////////////////////////////////
// 4. — helper utilities (unchanged)
////////////////////////////////////////////////////////////////////////////////

// crude parser for “line 12: Something went wrong” messages
function parseInkError(error: Error, inkText: string): InkError {
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

export function validateInkSyntax(inkText: string): InkError[] {
  const errors: InkError[] = [];
  const lines = inkText.split("\n");
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
