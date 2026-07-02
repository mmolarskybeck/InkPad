import { describe, expect, it } from "vitest";
import { compileInkProject } from "@/workers/compile-ink-project";
import { INK_SNIPPETS } from "./ink-snippets";

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

/** Minimal valid program embedding the filled snippet, keyed by snippet id. */
const harness: Record<string, (filled: string) => string> = {
  knot: (s) => `-> knot_name\n${s}`,
  stitch: (s) => `-> main.stitch_name\n=== main ===\n${s}`,
  divert: (s) => `${s}\n=== target_knot ===\nReached.\n-> END`,
  function: (s) => `-> start\n=== start ===\nSum: {add(2, 3)}.\n-> END\n${s}`,
  choice: (s) =>
    `-> start\n=== start ===\n${s}=== target_knot ===\nReached.\n-> END`,
  "sticky-choice": (s) =>
    `-> start\n=== start ===\n${s}=== target_knot ===\nReached.\n-> END`,
  tunnel: (s) =>
    `-> start\n=== start ===\n${s}-> END\n=== tunnel_knot ===\nInside tunnel.\n->->\n`,
  var: (s) => `${s}\n-> start\n=== start ===\nValue is {my_var}.\n-> END`,
  list: (s) => `${s}\n-> start\n=== start ===\nDone.\n-> END`,
  conditional: (s) =>
    `VAR condition = true\n-> start\n=== start ===\n${s}-> END`,
  sequence: (s) => `-> start\n=== start ===\n${s}\n-> END`,
  comment: (s) => `-> start\n=== start ===\n${s}Hello.\n-> END`,
};

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
    const program = harness[snippet.id](fillDesktop(snippet.desktopSnippet));

    const response = compileInkProject({
      type: "compile",
      requestId: snippet.id,
      entryFile: "main.ink",
      files: { "main.ink": program },
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
