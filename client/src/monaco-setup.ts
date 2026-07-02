// src/monaco-setup.ts
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/edcore.main";
import "monaco-editor/esm/vs/editor/contrib/codeAction/browser/codeActionContributions";
import "monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon-modifiers.css";
import "@/monaco-codicons.css";

/* ---------- 1. Wire workers ---------- */
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

/* InkPad only edits Ink files, so Monaco only needs the base editor worker. */
(self as any).MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

/* ---------- 2. Register Ink once ---------- */
import {
  inkLanguageId,
  languageDefinition,
  inkTheme,
  inkThemeHighContrast,
  inkThemeLight,
  inkLanguageConfig,
} from "@/utils/ink-monarch";
import { registerInkSnippetCompletions } from "@/features/snippets/ink-completion-provider";
import { registerInkMissingStartQuickFix } from "@/inkLanguage/inkCodeActions";

loader.config({ monaco });

const initPromise = loader.init().then((m) => {
  m.languages.register({ id: inkLanguageId });
  m.languages.setMonarchTokensProvider(inkLanguageId, languageDefinition);
  m.languages.setLanguageConfiguration(inkLanguageId, inkLanguageConfig);
  registerInkSnippetCompletions(m, inkLanguageId);
  registerInkMissingStartQuickFix(m, inkLanguageId);
  m.editor.defineTheme('ink-tokyo-night', inkTheme);
  m.editor.defineTheme('ink-paper-light', inkThemeLight);
  m.editor.defineTheme('ink-high-contrast', inkThemeHighContrast);
  return m;
});

export function getMonaco() {
  return initPromise;          // component awaits this
}
