// src/monaco-setup.ts
import { loader } from "@monaco-editor/react";

/* ---------- 1️⃣  Wire workers ---------- */
import EditorWorker  from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker    from "monaco-editor/esm/vs/language/json/json.worker?worker";
import TsWorker      from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import HtmlWorker    from "monaco-editor/esm/vs/language/html/html.worker?worker";
import CssWorker     from "monaco-editor/esm/vs/language/css/css.worker?worker";

/* Tell Monaco where to get a worker for each language */
(self as any).MonacoEnvironment = {
  getWorker(_: any, label: string) {
    switch (label) {
      case "json":        return new JsonWorker();
      case "css":
      case "scss":
      case "less":        return new CssWorker();
      case "html":
      case "handlebars":
      case "razor":       return new HtmlWorker();
      case "typescript":
      case "javascript":  return new TsWorker();
      default:            return new EditorWorker();
    }
  },
};

/* ---------- 2️⃣  Register Ink once ---------- */
import { inkLanguageId, languageDefinition } from "@/utils/ink-monarch";

const initPromise = loader.init().then((m) => {
  m.languages.register({ id: inkLanguageId });
  m.languages.setMonarchTokensProvider(inkLanguageId, languageDefinition);
  return m;
});

export function getMonaco() {
  return initPromise;          // component awaits this
}
