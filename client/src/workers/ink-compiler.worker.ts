// Web‑Worker context — isolates heavy compile so UI never lags
import * as ink from "inkjs/full"; // the `full` build includes the compiler

self.onmessage = ({ data }: MessageEvent<string>) => {
  try {
    const story = new ink.Compiler(data).Compile();
    const jsonResult = story.ToJson();
    postMessage({ ok: true, json: jsonResult });
  } catch (e: any) {
    postMessage({ ok: false, error: e.message ?? "Unknown error" });
  }
};
export default null as any;
