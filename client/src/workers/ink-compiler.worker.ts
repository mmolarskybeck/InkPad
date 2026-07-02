// Web‑Worker context — isolates heavy compile so UI never lags
import type { CompilerRequest } from "../types/worker-messages";
import { compileInkProject } from "./compile-ink-project";

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

  postMessage(compileInkProject(data));
};

export default null as any;
