// Single-character Ink syntax shortcuts, shared by the mobile accessory bar
// and the desktop floating snippet toolbar. Unlike the snippet library these
// insert literal text with no tab stops.

import type { CodeMirrorEditorInsertOptions } from "@/components/editor/codemirror-editor";

export const SYNTAX_INSERTS: { label: string; insert: CodeMirrorEditorInsertOptions }[] = [
  { label: "->", insert: { text: "-> " } },
  { label: "*", insert: { text: "* " } },
  { label: "+", insert: { text: "+ " } },
  { label: "~", insert: { text: "~ " } },
  { label: "=", insert: { text: "= " } },
  { label: "===", insert: { text: "===  ===", cursorOffset: 4 } },
  { label: "{ }", insert: { text: "{ }", cursorOffset: 2 } },
];
