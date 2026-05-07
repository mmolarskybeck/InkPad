// Web‑Worker context — isolates heavy compile so UI never lags
import * as ink from "inkjs/full"; // the `full` build includes the compiler
import type { CompilerRequest, CompilerResponse } from "../types/worker-messages";

/**
 * IMPORTANT: Worker Communication Contract
 *
 * This worker sends JSON strings to the main thread, not parsed objects.
 * The main thread's compileInkScript() expects strings for parsing.
 *
 * DO NOT change this to send parsed objects without updating the receiver
 * in ink-compiler.ts - this will cause "[object Object]" compilation errors.
 *
 * See types/worker-messages.ts for the complete contract definition.
 */
self.onmessage = ({ data }: MessageEvent<CompilerRequest>) => {
  if (data.type !== "compile") {
    return;
  }

  const { requestId, source } = data;

  try {
    const compiledStory = new ink.Compiler(source).Compile();
    const compiledJson = compiledStory.ToJson();
    
    if (typeof compiledJson !== 'string') {
      throw new Error("Failed to serialize story to JSON");
    }
    
    // CRITICAL: Send JSON string, not parsed object
    const message: CompilerResponse = {
      type: "compile-success",
      requestId,
      storyJson: compiledJson,
    };
    postMessage(message);
  } catch (e: any) {
    const message: CompilerResponse = {
      type: "compile-error",
      requestId,
      errors: [
        {
          message: e.message ?? "Unknown error",
          type: "error",
        },
      ],
    };
    postMessage(message);
  }
};

export default null as any;
