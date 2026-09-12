import { describe, expect, it } from "vitest";
import { compileInkProject } from "@/workers/compile-ink-project";
import {
  desktopToMobileInsert,
  groupSnippetsByCategory,
  INK_SNIPPETS,
  SNIPPET_CATEGORY_ORDER,
  type InkSnippet,
} from "./ink-snippets";

/**
 * Hard rule from the spec: a snippet that inserts non-compiling code is worse
 * than no snippet. Every shipped snippet is verified here by compiling its
 * desktop form through InkPad's own compiler.
 *
 * Snippets are insertion *fragments*, so each one is filled (tab stops replaced
 * with their defaults) and embedded in the minimal valid program that gives it
 * the context it needs to compile (a knot to live in, a divert target, a
 * declared variable, etc.). The wrapper text lives only here, never in shipped
 * data.
 *
 * The mobile form is not compiled directly: its `[placeholder]` markers are
 * ambiguous with Ink's own choice brackets and are meant to be typed over by
 * the user. Instead we assert it stays structurally in lock-step with the
 * desktop form (same placeholder count), so verifying one verifies both.
 */

/** Replace `${n:default}` -> `default` and `${n}` -> "". */
function fillDesktop(snippet: string): string {
  return snippet
    .replace(/\$\{\d+:([^}]*)\}/g, "$1")
    .replace(/\$\{\d+\}/g, "");
}

/**
 * A harness either returns the whole `main.ink` program, or a program plus the
 * extra project files it needs (INCLUDE targets).
 */
type HarnessResult = string | { program: string; files: Record<string, string> };

/** Minimal valid program embedding the filled snippet, keyed by snippet id. */
const harness: Record<string, (filled: string) => HarnessResult> = {
  knot: (s) => `-> knot_name\n${s}`,
  stitch: (s) => `-> main.stitch_name\n=== main ===\n${s}`,
  function: (s) => `-> start\n=== start ===\nSum: {add(2, 3)}.\n-> END\n${s}`,
  include: (s) => ({
    program: `${s}\n-> start\n=== start ===\n-> other\n`,
    files: {
      "main.ink": `${s}\n-> start\n=== start ===\n-> other\n`,
      "other.ink": "=== other ===\nHi.\n-> END\n",
    },
  }),
  external: (s) => `${s}\n-> start\n=== start ===\nHi.\n-> END`,

  divert: (s) => `${s}\n=== target_knot ===\nReached.\n-> END`,
  tunnel: (s) =>
    `-> start\n=== start ===\n${s}-> END\n=== tunnel_knot ===\nInside tunnel.\n->->\n`,
  "tunnel-return": (s) =>
    `-> start\n=== start ===\n-> t ->\n-> END\n=== t ===\nIn.\n${s}\n`,
  thread: (s) =>
    `-> start\n=== start ===\n${s}\n* [Wait] -> END\n=== thread_knot ===\n* [Thread choice] -> END\n`,
  glue: (s) => `-> start\n=== start ===\nHello ${s} world.\n-> END`,
  gather: (s) => `-> start\n=== start ===\n* [A]\n* [B]\n${s}\n-> END`,
  end: (s) => `-> start\n=== start ===\nHi.\n${s}\n`,
  done: (s) => `-> start\n=== start ===\nHi.\n${s}\n`,

  choice: (s) =>
    `-> start\n=== start ===\n${s}=== target_knot ===\nReached.\n-> END`,
  "sticky-choice": (s) =>
    `-> start\n=== start ===\n${s}=== target_knot ===\nReached.\n-> END`,
  "choice-hidden": (s) =>
    `-> start\n=== start ===\n${s}=== target_knot ===\nReached.\n-> END`,
  "choice-mixed": (s) =>
    `-> start\n=== start ===\n${s}=== target_knot ===\nReached.\n-> END`,
  "fallback-choice": (s) =>
    `-> start\n=== start ===\n* [Go] -> target_knot\n${s}\n=== target_knot ===\nReached.\n-> END`,
  "labeled-choice": (s) =>
    `-> start\n=== start ===\n${s}=== target_knot ===\nReached.\n-> END`,
  "conditional-choice": (s) =>
    `VAR condition = true\n-> start\n=== start ===\n${s}=== target_knot ===\nReached.\n-> END`,

  var: (s) => `${s}\n-> start\n=== start ===\nValue is {my_var}.\n-> END`,
  list: (s) => `${s}\n-> start\n=== start ===\nDone.\n-> END`,
  const: (s) => `${s}\n-> start\n=== start ===\nValue is {MY_CONST}.\n-> END`,
  temp: (s) => `-> start\n=== start ===\n${s}\nValue {my_temp}.\n-> END`,
  assign: (s) => `VAR my_var = 1\n-> start\n=== start ===\n${s}\n-> END`,
  print: (s) => `VAR my_var = 1\n-> start\n=== start ===\nValue: ${s}\n-> END`,
  return: (s) => `-> start\n=== start ===\n{f()}\n-> END\n=== function f ===\n${s}\n`,

  conditional: (s) =>
    `VAR condition = true\n-> start\n=== start ===\n${s}-> END`,
  sequence: (s) => `-> start\n=== start ===\n${s}\n-> END`,
  "conditional-chain": (s) =>
    `VAR condition_a = true\nVAR condition_b = false\n-> start\n=== start ===\n${s}-> END`,
  switch: (s) => `VAR my_var = 1\n-> start\n=== start ===\n${s}-> END`,
  "inline-conditional": (s) =>
    `VAR condition = true\n-> start\n=== start ===\n${s}\n-> END`,
  cycle: (s) => `-> start\n=== start ===\n${s}\n-> END`,
  once: (s) => `-> start\n=== start ===\n${s}\n-> END`,
  shuffle: (s) => `-> start\n=== start ===\n${s}\n-> END`,

  comment: (s) => `-> start\n=== start ===\n${s}Hello.\n-> END`,
  "block-comment": (s) => `-> start\n=== start ===\n${s}\nHi.\n-> END`,
  todo: (s) => `-> start\n=== start ===\n${s}\nHi.\n-> END`,
  tag: (s) => `-> start\n=== start ===\n${s}\nHi.\n-> END`,
};

function resolveHarness(snippet: InkSnippet): {
  program: string;
  files: Record<string, string>;
} {
  const result = harness[snippet.id](fillDesktop(snippet.desktopSnippet));
  if (typeof result === "string") {
    return { program: result, files: { "main.ink": result } };
  }
  return result;
}

function countDesktopPlaceholders(snippet: string): number {
  return (snippet.match(/\$\{\d+/g) ?? []).length;
}

function countMobilePlaceholders(snippet: string): number {
  return (snippet.match(/\[[^\]]*\]/g) ?? []).length;
}

describe("INK_SNIPPETS data integrity", () => {
  it("has unique ids", () => {
    const ids = INK_SNIPPETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(INK_SNIPPETS)("$id keeps desktop and mobile forms in lock-step", (snippet) => {
    expect(snippet.aliases.length).toBeGreaterThan(0);
    expect(countMobilePlaceholders(snippet.mobileInsert)).toBe(
      countDesktopPlaceholders(snippet.desktopSnippet),
    );
  });

  it("has a compile harness for every snippet", () => {
    for (const snippet of INK_SNIPPETS) {
      expect(harness[snippet.id], `missing harness for "${snippet.id}"`).toBeTypeOf(
        "function",
      );
    }
  });
});

describe("INK_SNIPPETS compile through InkPad's compiler", () => {
  it.each(INK_SNIPPETS)("$id produces compiling Ink", (snippet) => {
    const { program, files } = resolveHarness(snippet);

    const response = compileInkProject({
      type: "compile",
      requestId: snippet.id,
      entryFile: "main.ink",
      files,
    });

    if (response.type !== "compile-success") {
      throw new Error(
        `Snippet "${snippet.id}" failed to compile:\n${program}\n\n` +
          response.errors.map((e) => `  [${e.type}] ${e.message}`).join("\n"),
      );
    }

    expect(response.type).toBe("compile-success");
  });
});

describe("groupSnippetsByCategory", () => {
  it("groups in SNIPPET_CATEGORY_ORDER order", () => {
    const groups = groupSnippetsByCategory(INK_SNIPPETS);
    const categories = groups.map((group) => group.category);
    const expected = SNIPPET_CATEGORY_ORDER.filter((category) =>
      INK_SNIPPETS.some((snippet) => snippet.category === category),
    );
    expect(categories).toEqual(expected);
  });

  it("drops empty categories", () => {
    const groups = groupSnippetsByCategory(
      INK_SNIPPETS.filter((snippet) => snippet.category === "Structure"),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe("Structure");
  });

  it("keeps every snippet exactly once", () => {
    const groups = groupSnippetsByCategory(INK_SNIPPETS);
    const ids = groups.flatMap((group) => group.snippets.map((s) => s.id));
    expect(ids.sort()).toEqual(INK_SNIPPETS.map((s) => s.id).sort());
  });

  it("returns an empty array for no snippets", () => {
    expect(groupSnippetsByCategory([])).toEqual([]);
  });
});

describe("desktopToMobileInsert", () => {
  it("turns `${n:default}` into `[default]`", () => {
    expect(desktopToMobileInsert("VAR ${1:my_var} = ${2:0}")).toBe(
      "VAR [my_var] = [0]",
    );
  });

  it("turns a bare `${n}` into `[]`", () => {
    expect(desktopToMobileInsert("-> ${1}")).toBe("-> []");
  });

  it("leaves text without tab stops untouched", () => {
    expect(desktopToMobileInsert("-> END")).toBe("-> END");
  });

  it("reproduces the shipped mobile forms for tab-stop snippets", () => {
    for (const snippet of INK_SNIPPETS) {
      expect(
        desktopToMobileInsert(snippet.desktopSnippet),
        `mobileInsert drifted for "${snippet.id}"`,
      ).toBe(snippet.mobileInsert);
    }
  });
});
