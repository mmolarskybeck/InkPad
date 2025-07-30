// src/monaco-setup.ts
import { loader, setWorkersPath } from "@monaco-editor/react";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker   from "monaco-editor/esm/vs/language/json/json.worker?worker";
import TsWorker     from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import HtmlWorker   from "monaco-editor/esm/vs/language/html/html.worker?worker";
import CssWorker    from "monaco-editor/esm/vs/language/css/css.worker?worker";
import { inkLanguageId, languageDefinition } from "@/ink-monarch";

// 1️⃣  Workers
setWorkersPath({
  editor:      () => new EditorWorker(),
  json:        () => new JsonWorker(),
  typescript:  () => new TsWorker(),
  javascript:  () => new TsWorker(),
  html:        () => new HtmlWorker(),
  css:         () => new CssWorker(),
});

// 2️⃣  Ink language (register once)
const initPromise = loader.init().then(m => {
  m.languages.register({ id: inkLanguageId });
  m.languages.setMonarchTokensProvider(inkLanguageId, languageDefinition);
  return m;
});

export function getMonaco() {
  // consumers await this to get the monaco instance
  return initPromise;
}
