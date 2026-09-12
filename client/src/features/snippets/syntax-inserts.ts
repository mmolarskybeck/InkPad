// Single-character Ink syntax shortcuts, shared by the mobile accessory bar
// and the desktop Insert palette. Unlike the snippet library these insert
// literal text with no tab stops.

import type { CodeMirrorEditorInsertOptions } from "@/components/editor/codemirror-editor";

export const SYNTAX_LABELS: Record<string, string> = {
  "->": "Divert", "*": "Choice", "+": "Sticky choice", "~": "Logic",
  "=": "Stitch", "===": "Knot", "{ }": "Expression",
};

export const SYNTAX_INSERTS: { label: string; insert: CodeMirrorEditorInsertOptions }[] = [
  { label: "->", insert: { text: "-> " } },
  { label: "*", insert: { text: "* " } },
  { label: "+", insert: { text: "+ " } },
  { label: "~", insert: { text: "~ " } },
  { label: "=", insert: { text: "= " } },
  { label: "===", insert: { text: "===  ===", cursorOffset: 4 } },
  { label: "{ }", insert: { text: "{ }", cursorOffset: 2 } },
];
