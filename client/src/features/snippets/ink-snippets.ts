// Shared Ink snippet library — single source of truth for desktop autocomplete,
// the snippet palette, and the mobile insertion tools.
//
// See docs/structural-assistance-spec.md. Every snippet here must compile
// through InkPad's own compiler; ink-snippets.test.ts enforces that.

export type SnippetCategory =
  | "Structure"
  | "Choices"
  | "Variables"
  | "Logic"
  | "Comments";

/**
 * Where a snippet is meant to be inserted. This is real product metadata, not
 * just test scaffolding: it tells the completion provider where a trigger may
 * fire (a top-level `knot` should not be offered mid-prose) and tells the test
 * harness how to wrap a fragment so it compiles.
 *
 * - `top-level`  declaration at file/knot scope (knot, stitch, VAR, LIST, func)
 * - `flow`       a new line within a knot/stitch body (choice, divert, ~)
 * - `inline`     mid-line, printed as the story runs (inline conditional, seq)
 */
export type SnippetContext = "top-level" | "flow" | "inline";

export interface InkSnippet {
  /** Stable id; also the primary autocomplete trigger word. */
  id: string;
  /** Human label shown in the palette and completion detail. */
  label: string;
  category: SnippetCategory;
  context: SnippetContext;
  /** Desktop autocomplete trigger words/symbols. */
  aliases: string[];
  /** TextMate-style insert text with `${n:default}` tab stops, compatible with `@codemirror/autocomplete`'s `snippet()`. */
  desktopSnippet: string;
  /** Plain insert text with `[placeholder]` markers the user types over. */
  mobileInsert: string;
  description: string;
}

/**
 * Starter set (v1). Intentionally small and diverse — see the dogfooding gate
 * in the spec before growing this. Candidates to add later: sticky/gather,
 * once/cycle/shuffle variants, hub, thread, glue, tunnel-return.
 */
export const INK_SNIPPETS: InkSnippet[] = [
  {
    id: "knot",
    label: "Knot",
    category: "Structure",
    context: "top-level",
    aliases: ["knot", "==="],
    desktopSnippet: "=== ${1:knot_name} ===\n${2:Story text.}\n-> END\n",
    mobileInsert: "=== [knot_name] ===\n[Story text.]\n-> END\n",
    description: "A main story section you can divert to.",
  },
  {
    id: "stitch",
    label: "Stitch",
    category: "Structure",
    context: "top-level",
    aliases: ["stitch"],
    desktopSnippet: "= ${1:stitch_name}\n${2:Story text.}\n-> END\n",
    mobileInsert: "= [stitch_name]\n[Story text.]\n-> END\n",
    description: "A sub-section inside a knot.",
  },
  {
    id: "divert",
    label: "Divert",
    category: "Structure",
    context: "flow",
    aliases: ["divert", "->"],
    desktopSnippet: "-> ${1:target_knot}",
    mobileInsert: "-> [target_knot]",
    description: "Jump to another knot or stitch.",
  },
  {
    id: "function",
    label: "Function",
    category: "Structure",
    context: "top-level",
    aliases: ["function", "func"],
    desktopSnippet:
      "=== function ${1:add}(${2:a}, ${3:b}) ===\n    ~ return ${4:a + b}\n",
    mobileInsert: "=== function [add]([a], [b]) ===\n    ~ return [a + b]\n",
    description: "A reusable function that returns a value.",
  },
  {
    id: "choice",
    label: "Choice",
    category: "Choices",
    context: "flow",
    aliases: ["choice", "*"],
    desktopSnippet:
      "* ${1:Choice text}\n    ${2:Result text.}\n    -> ${3:target_knot}\n",
    mobileInsert: "* [Choice text]\n    [Result text.]\n    -> [target_knot]\n",
    description: "A choice the player can pick once.",
  },
  {
    id: "sticky-choice",
    label: "Sticky choice",
    category: "Choices",
    context: "flow",
    aliases: ["sticky", "+"],
    desktopSnippet:
      "+ ${1:Choice text}\n    ${2:Result text.}\n    -> ${3:target_knot}\n",
    mobileInsert: "+ [Choice text]\n    [Result text.]\n    -> [target_knot]\n",
    description: "A choice the player can pick more than once.",
  },
  {
    id: "tunnel",
    label: "Tunnel",
    category: "Choices",
    context: "flow",
    aliases: ["tunnel"],
    desktopSnippet: "-> ${1:tunnel_knot} ->\n",
    mobileInsert: "-> [tunnel_knot] ->\n",
    description: "Run a knot as a tunnel, then return here.",
  },
  {
    id: "var",
    label: "Global variable",
    category: "Variables",
    context: "top-level",
    aliases: ["VAR", "var"],
    desktopSnippet: "VAR ${1:my_var} = ${2:0}",
    mobileInsert: "VAR [my_var] = [0]",
    description: "Declare a global variable.",
  },
  {
    id: "list",
    label: "List",
    category: "Variables",
    context: "top-level",
    aliases: ["LIST", "list"],
    desktopSnippet: "LIST ${1:my_list} = ${2:first}, ${3:second}, ${4:third}",
    mobileInsert: "LIST [my_list] = [first], [second], [third]",
    description: "Declare a list of named states.",
  },
  {
    id: "conditional",
    label: "Conditional",
    category: "Logic",
    context: "flow",
    aliases: ["cond", "if"],
    desktopSnippet:
      "{${1:condition}:\n    ${2:Text if true.}\n  - else:\n    ${3:Text if false.}\n}\n",
    mobileInsert:
      "{[condition]:\n    [Text if true.]\n  - else:\n    [Text if false.]\n}\n",
    description: "Show different text depending on a condition.",
  },
  {
    id: "sequence",
    label: "Sequence",
    category: "Logic",
    context: "inline",
    aliases: ["seq", "stopping"],
    desktopSnippet:
      "{stopping: ${1:First time.}|${2:Second time.}|${3:Every time after.}}",
    mobileInsert: "{stopping: [First time.]|[Second time.]|[Every time after.]}",
    description: "Print a different line on each visit, then stop.",
  },
  {
    id: "comment",
    label: "Comment",
    category: "Comments",
    context: "top-level",
    aliases: ["comment", "//"],
    desktopSnippet: "// ${1:Your comment here.}\n",
    mobileInsert: "// [Your comment here.]\n",
    description: "A note that is ignored by the compiler.",
  },
];
