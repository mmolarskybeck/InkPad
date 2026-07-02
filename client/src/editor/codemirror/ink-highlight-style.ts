import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// Maps the vendored Ink grammar's highlight tags (see
// client/src/editor/codemirror/ink-lang/index.ts styleTags) onto InkPad's
// existing theme CSS variables (client/src/index.css), rather than
// hardcoded colors, so light/dark/high-contrast all work automatically.
// Visual intent (knots bold/prominent, diverts distinct, TODO louder than a
// comment, built-ins distinct) follows client/src/utils/ink-monarch.ts's
// Monaco theme, per the migration plan's guidance to treat the Monarch file
// as a record of visual intent, not a correctness baseline.
export const inkHighlightStyle = HighlightStyle.define([
  // Knot / Function / Stitch headers.
  { tag: t.heading1, color: "var(--secondary-blue)", fontWeight: "bold" },
  { tag: t.heading2, color: "var(--secondary-blue)", fontWeight: "600" },

  // Declarations, structural keywords, END/DONE, ref/temp/return, etc.
  { tag: t.keyword, color: "var(--syntax-keyword)", fontWeight: "bold" },
  { tag: t.operatorKeyword, color: "var(--syntax-keyword)" },
  { tag: t.logicOperator, color: "var(--syntax-keyword)" },

  // Diverts, gathers, choice markers -- the "flow control" surface.
  { tag: t.controlOperator, color: "var(--warning)", fontWeight: "bold" },

  // Identifiers.
  { tag: t.name, color: "var(--text-primary)" },
  { tag: t.labelName, color: "var(--error)", fontWeight: "bold" },

  // Literals.
  { tag: t.string, color: "var(--syntax-string)" },
  { tag: t.literal, color: "var(--syntax-string)" },
  { tag: t.number, color: "var(--syntax-number)" },
  { tag: t.bool, color: "var(--syntax-number)" },
  { tag: t.list, color: "var(--success)" },

  // Brackets/braces/operators.
  { tag: t.bracket, color: "var(--secondary-blue)" },
  { tag: t.squareBracket, color: "var(--secondary-blue)" },
  { tag: t.paren, color: "var(--secondary-blue)" },
  { tag: t.brace, color: "var(--secondary-blue)" },
  { tag: t.operator, color: "var(--secondary-blue)" },
  { tag: t.compareOperator, color: "var(--secondary-blue)" },
  { tag: t.arithmeticOperator, color: "var(--secondary-blue)" },
  { tag: t.separator, color: "var(--secondary-blue)" },

  // Content -- ordinary prose. Left at the editor's default text color.
  { tag: t.content, color: "var(--text-primary)" },

  // Comments. TODO/author-warning is tagged as a `special(comment)` (see
  // ink-lang's patch notes) so it can be visibly louder than an ordinary
  // comment, per the migration plan's "Improve" section -- note recognition
  // of that node is currently unreliable, see ink-lang/README.md.
  { tag: t.comment, color: "var(--text-secondary)", fontStyle: "italic" },
  { tag: t.blockComment, color: "var(--text-secondary)", fontStyle: "italic" },
  { tag: t.special(t.comment), color: "var(--error)", fontWeight: "bold", fontStyle: "normal" },
]);
