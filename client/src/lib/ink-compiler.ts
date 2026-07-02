// src/lib/ink-compiler.ts
import type { Story } from "inkjs";
import { normalizeStoryJson } from "./json-utils";
import type {
  CompilerErrorResponse,
  CompilerResponse,
  CompilerSuccessResponse,
  InkCompileInput,
  InkCompilerMessage,
} from "../types/worker-messages";

////////////////////////////////////////////////////////////////////////////////
// Types
////////////////////////////////////////////////////////////////////////////////

export interface InkCompilerError {
  line: number;
  column?: number;
  message: string;
  // "info" = inkjs Author/TODO message; shown in the Problems panel but not
  // counted as an error or warning and not blocking export.
  type: "error" | "warning" | "info";
}

export interface InkCompileResult {
  requestId: string;
  runtimeStory: Story | null;
  errors: InkCompilerError[];
  knots: string[];
  compiledJson?: string;
}

const MAX_COMPILE_SOURCE_BYTES = 2 * 1024 * 1024;

function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
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

async function compileInkViaWorker(
  input: InkCompileInput,
  requestId: string
): Promise<CompilerSuccessResponse> {
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
        resolve(e.data);
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
      entryFile: input.entryFile,
      files: input.files,
    });
  });
}

////////////////////////////////////////////////////////////////////////////////
// 2. — compileInkScript  (async)
//     Calls the worker, builds a Story, maps errors
////////////////////////////////////////////////////////////////////////////////

export async function compileInkScript(
  sourceOrInput: string | InkCompileInput,
  requestId = createCompilerRequestId()
): Promise<InkCompileResult> {
  const input = typeof sourceOrInput === "string"
    ? createSingleFileCompileInput(sourceOrInput)
    : sourceOrInput;
  const combinedSource = Object.values(input.files).join("\n");
  const sourceSizeBytes = getUtf8ByteLength(combinedSource);

  if (!input.entryFile || !Object.prototype.hasOwnProperty.call(input.files, input.entryFile)) {
    return {
      requestId,
      runtimeStory: null,
      errors: [{
        line: 1,
        message: `Entry file "${input.entryFile}" was not found in this project.`,
        type: "error",
      }],
      knots: extractKnots(combinedSource),
    };
  }

  if (sourceSizeBytes > MAX_COMPILE_SOURCE_BYTES) {
    return {
      requestId,
      runtimeStory: null,
      errors: [{
        line: 1,
        message: `Story is ${formatBytes(sourceSizeBytes)}. InkPad compiles stories up to ${formatBytes(MAX_COMPILE_SOURCE_BYTES)}.`,
        type: "error",
      }],
      knots: extractKnots(combinedSource),
    };
  }

  try {
    const response = await compileInkViaWorker(input, requestId);
    const compiledJson = response.storyJson;
    const storyData = normalizeStoryJson(compiledJson);
    const { Story } = await import("inkjs");
    const runtimeStory = new Story(storyData);
    return {
      requestId,
      runtimeStory,
      errors: normalizeCompilerMessages(response.warnings),
      knots: extractKnots(combinedSource),
      compiledJson,
    };
  } catch (err) {
    // Worker threw – most likely a compilation error.  Try to parse details.
    const errors = err instanceof CompilerResponseError
      ? normalizeCompilerMessages(err.response.errors)
      : [parseInkError(err as Error)];

    return {
      requestId,
      runtimeStory: null,
      errors,
      knots: extractKnots(combinedSource),
    };
  }
}

export function createSingleFileCompileInput(
  source: string,
  fileName = "story.ink",
): InkCompileInput {
  return {
    entryFile: fileName,
    files: {
      [fileName]: source,
    },
  };
}

////////////////////////////////////////////////////////////////////////////////
// 3. — helper utilities
////////////////////////////////////////////////////////////////////////////////

// Parser for inkjs message strings, which follow these formats:
//   ERROR: 'file.ink' line 9: Something went wrong
//   WARNING: 'file.ink' line 9: Something went wrong
//   TODO: 'file.ink' line 9: Add something here
//   9: Something went wrong   (fallback, no prefix)
//
// Goal: extract the line number and produce a clean message with no redundant
// file/line info. Errors and warnings drop the severity prefix (the icon
// communicates that). TODOs keep the "TODO:" label since the info icon is
// generic.
function parseInkError(error: Error): InkCompilerError {
  const msg = error.message ?? "Compilation failed";

  let line = 1;
  let cleanMessage = msg;

  // Primary: explicit "line N:" pattern used by all inkjs prefixed messages.
  const lineMatch = msg.match(/\bline\s+(\d+):/i);
  if (lineMatch) {
    line = Number(lineMatch[1]);

    cleanMessage = msg
      // ERROR/WARNING: strip the entire prefix including file + line
      .replace(/^(?:ERROR|WARNING):\s*(?:'[^']+'\s+)?line\s+\d+:\s*/i, "")
      // TODO/author: strip file + line but keep the label ("TODO: message")
      .replace(/^(TODO|FIXME):\s*'[^']+'\s+line\s+\d+:\s*/i, "$1: ")
      .trimStart();
  } else {
    // Fallback: bare "9: message" format
    const bareMatch = msg.match(/^(\d+):\s*/);
    if (bareMatch) {
      line = Number(bareMatch[1]);
      cleanMessage = msg.replace(/^\d+:\s*/, "");
    }
  }

  return {
    line,
    column: undefined,
    message: cleanMessage,
    type: msg.toLowerCase().includes("warning") ? "warning" : "error",
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
    message: parsed.message, // Use the cleaned message
    type: message.type || parsed.type,
  };
}

function normalizeCompilerMessages(messages: InkCompilerMessage[] = []): InkCompilerError[] {
  return messages.map(normalizeCompilerMessage);
}

function extractKnots(source: string): string[] {
  const re = /^===\s*([^=\s]+)\s*===/gm;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.push(m[1].trim());
  return out;
}
