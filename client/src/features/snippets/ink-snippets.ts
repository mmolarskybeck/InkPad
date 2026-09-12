// Shared Ink snippet library — single source of truth for desktop autocomplete,
// the snippet palette, and the mobile insertion tools.
//
// See docs/structural-assistance-spec.md. Every snippet here must compile
// through InkPad's own compiler; ink-snippets.test.ts enforces that.

import { LIBRARY_SNIPPETS } from "./library-snippets";

export type SnippetCategory =
  | "Structure"
  | "Flow"
  | "Choices"
  | "Variables"
  | "Logic"
  | "Comments"
  | "Library"
  | "Custom";

/** Display order for grouped snippet UIs. */
export const SNIPPET_CATEGORY_ORDER: SnippetCategory[] = [
  "Structure",
  "Flow",
  "Choices",
  "Variables",
  "Logic",
  "Comments",
  "Library",
  "Custom",
];

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
  /** Where the snippet came from. Builtins may leave this undefined. */
  source?: "builtin" | "library" | "custom";
}

/**
 * Built-in library. Every entry is compile-verified in ink-snippets.test.ts;
 * user-authored additions live separately (see custom-snippets.ts) and are
 * merged in by the snippet library provider.
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
    id: "include",
    label: "Include file",
    category: "Structure",
    context: "top-level",
    aliases: ["INCLUDE", "include"],
    desktopSnippet: "INCLUDE ${1:other.ink}",
    mobileInsert: "INCLUDE [other.ink]",
    description: "Pull another .ink file into this story.",
  },
  {
    id: "external",
    label: "External function",
    category: "Structure",
    context: "top-level",
    aliases: ["EXTERNAL", "external"],
    desktopSnippet: "EXTERNAL ${1:play_sound}(${2:name})",
    mobileInsert: "EXTERNAL [play_sound]([name])",
    description: "Declare a function provided by the host app.",
  },
  {
    id: "divert",
    label: "Divert",
    category: "Flow",
    context: "flow",
    aliases: ["divert", "->"],
    desktopSnippet: "-> ${1:target_knot}",
    mobileInsert: "-> [target_knot]",
    description: "Jump to another knot or stitch.",
  },
  {
    id: "tunnel",
    label: "Tunnel",
    category: "Flow",
    context: "flow",
    aliases: ["tunnel"],
    desktopSnippet: "-> ${1:tunnel_knot} ->\n",
    mobileInsert: "-> [tunnel_knot] ->\n",
    description: "Run a knot as a tunnel, then return here.",
  },
  {
    id: "tunnel-return",
    label: "Tunnel return",
    category: "Flow",
    context: "flow",
    aliases: ["->->", "return-tunnel"],
    desktopSnippet: "->->",
    mobileInsert: "->->",
    description: "Return from the current tunnel.",
  },
  {
    id: "thread",
    label: "Thread",
    category: "Flow",
    context: "flow",
    aliases: ["thread", "<-"],
    desktopSnippet: "<- ${1:thread_knot}",
    mobileInsert: "<- [thread_knot]",
    description: "Pull another knot's content and choices into this point.",
  },
  {
    id: "glue",
    label: "Glue",
    category: "Flow",
    context: "inline",
    aliases: ["glue", "<>"],
    desktopSnippet: "<>",
    mobileInsert: "<>",
    description: "Join this line to the next with no line break.",
  },
  {
    id: "gather",
    label: "Gather",
    category: "Flow",
    context: "flow",
    aliases: ["gather", "-"],
    desktopSnippet: "- ${1:Gathered text.}",
    mobileInsert: "- [Gathered text.]",
    description: "Bring branching choices back together.",
  },
  {
    id: "end",
    label: "End",
    category: "Flow",
    context: "flow",
    aliases: ["END"],
    desktopSnippet: "-> END",
    mobileInsert: "-> END",
    description: "Finish the story here.",
  },
  {
    id: "done",
    label: "Done",
    category: "Flow",
    context: "flow",
    aliases: ["DONE"],
    desktopSnippet: "-> DONE",
    mobileInsert: "-> DONE",
    description: "Stop this flow and wait for the player.",
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
    id: "choice-hidden",
    label: "Choice (hidden text)",
    category: "Choices",
    context: "flow",
    aliases: ["[choice]", "hidden"],
    desktopSnippet:
      "* [${1:Choice text}]\n    ${2:Result text.}\n    -> ${3:target_knot}\n",
    mobileInsert:
      "* [[Choice text]]\n    [Result text.]\n    -> [target_knot]\n",
    description: "A choice whose label is not printed after it is picked.",
  },
  {
    id: "choice-mixed",
    label: "Choice (mixed output)",
    category: "Choices",
    context: "flow",
    aliases: ["mixed", "*[]"],
    desktopSnippet:
      "* ${1:Try} [${2:it}] ${3:this example!}\n    -> ${4:target_knot}\n",
    mobileInsert:
      "* [Try] [[it]] [this example!]\n    -> [target_knot]\n",
    description:
      "Text before the brackets prints in both the choice and the result; text after prints only in the result.",
  },
  {
    id: "fallback-choice",
    label: "Fallback choice",
    category: "Choices",
    context: "flow",
    aliases: ["fallback", "*->"],
    desktopSnippet: "* -> ${1:target_knot}",
    mobileInsert: "* -> [target_knot]",
    description: "Taken automatically when no other choices remain.",
  },
  {
    id: "labeled-choice",
    label: "Labeled choice",
    category: "Choices",
    context: "flow",
    aliases: ["labeled", "(label)"],
    desktopSnippet: "* (${1:label}) ${2:Choice text}\n    -> ${3:target_knot}\n",
    mobileInsert: "* ([label]) [Choice text]\n    -> [target_knot]\n",
    description: "A choice you can refer to later by its label.",
  },
  {
    id: "conditional-choice",
    label: "Conditional choice",
    category: "Choices",
    context: "flow",
    aliases: ["cchoice", "*{"],
    desktopSnippet:
      "* {${1:condition}} ${2:Choice text}\n    -> ${3:target_knot}\n",
    mobileInsert: "* {[condition]} [Choice text]\n    -> [target_knot]\n",
    description: "A choice shown only when the condition is true.",
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
    id: "const",
    label: "Constant",
    category: "Variables",
    context: "top-level",
    aliases: ["CONST", "const"],
    desktopSnippet: "CONST ${1:MY_CONST} = ${2:0}",
    mobileInsert: "CONST [MY_CONST] = [0]",
    description: "Declare a value that never changes.",
  },
  {
    id: "temp",
    label: "Temporary variable",
    category: "Variables",
    context: "flow",
    aliases: ["temp", "~temp"],
    desktopSnippet: "~ temp ${1:my_temp} = ${2:0}",
    mobileInsert: "~ temp [my_temp] = [0]",
    description: "A variable that lives only inside this knot or stitch.",
  },
  {
    id: "assign",
    label: "Assignment",
    category: "Variables",
    context: "flow",
    aliases: ["assign", "~"],
    desktopSnippet: "~ ${1:my_var} = ${2:0}",
    mobileInsert: "~ [my_var] = [0]",
    description: "Set a variable to a new value.",
  },
  {
    id: "print",
    label: "Print value",
    category: "Variables",
    context: "inline",
    aliases: ["print", "{}"],
    desktopSnippet: "{${1:my_var}}",
    mobileInsert: "{[my_var]}",
    description: "Print a variable or expression inline.",
  },
  {
    id: "return",
    label: "Return",
    category: "Variables",
    context: "flow",
    aliases: ["return"],
    desktopSnippet: "~ return ${1:0}",
    mobileInsert: "~ return [0]",
    description: "Return a value from a function.",
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
    id: "conditional-chain",
    label: "Multi-branch conditional",
    category: "Logic",
    context: "flow",
    aliases: ["elseif", "branches"],
    desktopSnippet:
      "{\n  - ${1:condition_a}:\n    ${2:Text A.}\n  - ${3:condition_b}:\n    ${4:Text B.}\n  - else:\n    ${5:Fallback text.}\n}\n",
    mobileInsert:
      "{\n  - [condition_a]:\n    [Text A.]\n  - [condition_b]:\n    [Text B.]\n  - else:\n    [Fallback text.]\n}\n",
    description: "Test several conditions in order.",
  },
  {
    id: "switch",
    label: "Switch on value",
    category: "Logic",
    context: "flow",
    aliases: ["switch", "case"],
    desktopSnippet:
      "{ ${1:my_var}:\n  - ${2:0}:\n    ${3:Text for zero.}\n  - ${4:1}:\n    ${5:Text for one.}\n  - else:\n    ${6:Fallback text.}\n}\n",
    mobileInsert:
      "{ [my_var]:\n  - [0]:\n    [Text for zero.]\n  - [1]:\n    [Text for one.]\n  - else:\n    [Fallback text.]\n}\n",
    description: "Branch on the value of a variable.",
  },
  {
    id: "inline-conditional",
    label: "Inline conditional",
    category: "Logic",
    context: "inline",
    aliases: ["icond", "{?"],
    desktopSnippet: "{${1:condition}:${2:yes text}|${3:no text}}",
    mobileInsert: "{[condition]:[yes text]|[no text]}",
    description: "Print one of two texts depending on a condition.",
  },
  {
    id: "cycle",
    label: "Cycle",
    category: "Logic",
    context: "inline",
    aliases: ["cycle", "&"],
    desktopSnippet: "{&${1:First}|${2:Second}|${3:Third}}",
    mobileInsert: "{&[First]|[Second]|[Third]}",
    description: "Loop through the options on each visit.",
  },
  {
    id: "once",
    label: "Once-only",
    category: "Logic",
    context: "inline",
    aliases: ["once", "!"],
    desktopSnippet: "{!${1:Once}|${2:Twice}}",
    mobileInsert: "{![Once]|[Twice]}",
    description: "Print each option once, then nothing.",
  },
  {
    id: "shuffle",
    label: "Shuffle",
    category: "Logic",
    context: "inline",
    aliases: ["shuffle", "~|"],
    desktopSnippet: "{~${1:Heads}|${2:Tails}}",
    mobileInsert: "{~[Heads]|[Tails]}",
    description: "Print a random option each visit.",
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
  {
    id: "block-comment",
    label: "Block comment",
    category: "Comments",
    context: "top-level",
    aliases: ["/*", "block"],
    desktopSnippet: "/* ${1:Comment} */",
    mobileInsert: "/* [Comment] */",
    description: "A multi-line note ignored by the compiler.",
  },
  {
    id: "todo",
    label: "TODO",
    category: "Comments",
    context: "top-level",
    aliases: ["TODO", "todo"],
    desktopSnippet: "TODO: ${1:note}",
    mobileInsert: "TODO: [note]",
    description: "A reminder that shows as a compiler warning.",
  },
  {
    id: "tag",
    label: "Tag",
    category: "Comments",
    context: "flow",
    aliases: ["tag", "#"],
    desktopSnippet: "# ${1:tag_name}",
    mobileInsert: "# [tag_name]",
    description: "Attach metadata to a line for the host app.",
  },
];

/**
 * Everything InkPad ships: the hand-written insertion fragments above plus
 * inkle's own longer snippet library. This is what the snippet palette and the
 * mobile insertion tools show; word-alone autocomplete still uses
 * `INK_SNIPPETS` only, since the library entries are whole blocks of code.
 */
export const ALL_BUILTIN_SNIPPETS: InkSnippet[] = [
  ...INK_SNIPPETS,
  ...LIBRARY_SNIPPETS,
];

/**
 * Group snippets for display: categories appear in `SNIPPET_CATEGORY_ORDER`,
 * and categories with no snippets are dropped.
 */
export function groupSnippetsByCategory(
  snippets: readonly InkSnippet[],
): { category: SnippetCategory; snippets: InkSnippet[] }[] {
  return SNIPPET_CATEGORY_ORDER.map((category) => ({
    category,
    snippets: snippets.filter((snippet) => snippet.category === category),
  })).filter((group) => group.snippets.length > 0);
}

/**
 * Convert a desktop tab-stop snippet into the mobile `[placeholder]` form:
 * `${n:default}` becomes `[default]` and a bare `${n}` becomes `[]`.
 */
export function desktopToMobileInsert(desktopSnippet: string): string {
  return desktopSnippet
    .replace(/\$\{\d+:([^}]*)\}/g, "[$1]")
    .replace(/\$\{\d+\}/g, "[]");
}

/** Lines of a library snippet shown before the preview is truncated. */
const LIBRARY_PREVIEW_LINES = 4;

/**
 * Insert text to show in a code preview. Library snippets are whole files, far
 * too long for a drawer row, so they are cut to their first few lines with an
 * ellipsis line; every other snippet previews in full.
 */
export function getSnippetPreview(snippet: InkSnippet): string {
  if (snippet.source !== "library") return snippet.mobileInsert;
  const lines = snippet.mobileInsert.split("\n");
  if (lines.length <= LIBRARY_PREVIEW_LINES) return snippet.mobileInsert;
  return `${lines.slice(0, LIBRARY_PREVIEW_LINES).join("\n")}\n…`;
}
