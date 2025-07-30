// Web‑Worker context — isolates heavy compile so UI never lags
import ink from "inkjs/full";  // the `full` build includes the compiler  :contentReference[oaicite:0]{index=0}

self.onmessage = ({ data }: MessageEvent<string>) => {
  try {
    const story = new ink.Compiler(data).Compile();
    postMessage({ ok: true, json: story.ToJson() });
  } catch (e: any) {
    postMessage({ ok: false, error: e.message ?? "Unknown error" });
  }
};
export default null as any;
