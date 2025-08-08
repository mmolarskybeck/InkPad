// Web‑Worker context — isolates heavy compile so UI never lags
import * as ink from "inkjs/full"; // the `full` build includes the compiler
import type { CompilerWorkerMessage, CompilerWorkerInput } from "../types/worker-messages";

/**
 * IMPORTANT: Worker Communication Contract
 *
 * This worker sends JSON STRINGS to the main thread, not parsed objects.
 * The main thread's compileInkScript() expects to receive strings for parsing.
 *
 * DO NOT change this to send parsed objects without updating the receiver
 * in ink-compiler.ts - this will cause "[object Object]" compilation errors.
 *
 * See types/worker-messages.ts for the complete contract definition.
 */

self.onmessage = ({ data }: MessageEvent<CompilerWorkerInput>) => {
  try {
    const story = new ink.Compiler(data).Compile();
    const jsonResult = story.ToJson();
    
    if (typeof jsonResult !== 'string') {
      throw new Error("Failed to serialize story to JSON");
    }
    
    // CRITICAL: Send JSON string, not parsed object
    const message: CompilerWorkerMessage = { ok: true, json: jsonResult };
    postMessage(message);
  } catch (e: any) {
    const message: CompilerWorkerMessage = {
      ok: false,
      error: e.message ?? "Unknown error"
    };
    postMessage(message);
  }
};

export default null as any;
