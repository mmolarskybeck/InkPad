import { describe, expect, it } from "vitest";
import { compileInkProject } from "@/workers/compile-ink-project";
import { LIBRARY_SNIPPETS, toLibrarySnippetText } from "./library-snippets";
import { getSnippetPreview, type InkSnippet } from "./ink-snippets";

/**
 * The library entries are verbatim copies of inkle's snippet files, so the same
 * rule as the hand-written snippets applies: what we insert has to compile.
 * Each one is dropped in as a whole `main.ink` with its snippet escaping undone.
 *
 * A few files are pure function collections with no story flow, so on their own
 * they have nothing to run; those get a `-> DONE` preamble here (never in the
 * shipped data) so the compiler has an entry point.
 */

/** Undo the CodeMirror escaping applied in `toLibrarySnippetText`. */
function unescapeSnippet(text: string): string {
  return text.replace(/\\\$\{/g, "${").replace(/\\#\{/g, "#{");
}

/** Ids whose file declares only functions, and so needs an entry point. */
const NEEDS_ENTRY_POINT = new Set([
  "lib-list-pop",
  "lib-list-pop-random",
  "lib-list-prev-next",
  "lib-list-item-is-member-of",
  "lib-list-random-subset",
  "lib-list-random-subset-of-size",
  "lib-string-to-list",
  "lib-maybe",
  "lib-type-of",
  "lib-divisor",
  "lib-abs",
  "lib-came-from",
  "lib-seen-very-recently",
  "lib-seen-more-recently-than",
  "lib-seen-this-scene",
  "lib-thread-in-tunnel",
  "lib-a-or-an",
  "lib-uppercase",
  "lib-print-number",
  "lib-list-with-commas",
]);

/**
 * Dependencies inkle's own file headers declare ("Requires 'pop'"). Inserting
 * such a snippet alone is expected to leave a missing function; the compile
 * check supplies it here rather than editing the shipped file.
 */
const DEPENDS_ON: Record<string, string[]> = {
  "lib-list-random-subset": ["lib-list-pop"],
  "lib-list-random-subset-of-size": ["lib-list-pop-random"],
  "lib-list-with-commas": ["lib-list-pop"],
};

function bodyOf(id: string): string {
  const snippet = LIBRARY_SNIPPETS.find((candidate) => candidate.id === id);
  if (!snippet) throw new Error(`unknown library snippet "${id}"`);
  return unescapeSnippet(snippet.desktopSnippet);
}

function buildProgram(snippet: InkSnippet): string {
  const parts = (DEPENDS_ON[snippet.id] ?? []).map(bodyOf);
  parts.push(unescapeSnippet(snippet.desktopSnippet));
  const body = parts.join("\n");
  return NEEDS_ENTRY_POINT.has(snippet.id) ? `-> DONE\n${body}` : body;
}

describe("LIBRARY_SNIPPETS data integrity", () => {
  it("ships every library file", () => {
    expect(LIBRARY_SNIPPETS.length).toBe(23);
  });

  it("has unique ids", () => {
    const ids = LIBRARY_SNIPPETS.map((snippet) => snippet.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(LIBRARY_SNIPPETS)("$id is tagged as a library snippet", (snippet) => {
    expect(snippet.id.startsWith("lib-")).toBe(true);
    expect(snippet.source).toBe("library");
    expect(snippet.category).toBe("Library");
    expect(snippet.context).toBe("top-level");
    expect(snippet.aliases.length).toBeGreaterThan(0);
    expect(snippet.description.length).toBeGreaterThan(0);
    expect(snippet.description.length).toBeLessThanOrEqual(140);
  });

  it.each(LIBRARY_SNIPPETS)("$id inserts the same text on both platforms", (snippet) => {
    expect(snippet.mobileInsert).toBe(snippet.desktopSnippet);
    expect(snippet.desktopSnippet.endsWith("\n")).toBe(true);
    expect(snippet.desktopSnippet.endsWith("\n\n")).toBe(false);
  });

  it.each(LIBRARY_SNIPPETS)("$id has no unescaped tab-stop markers", (snippet) => {
    // An unescaped `${` would be read by CodeMirror's snippet() as a tab stop
    // and silently eaten from the inserted text.
    expect(snippet.desktopSnippet).not.toMatch(/(^|[^\\])\$\{/);
    expect(snippet.desktopSnippet).not.toMatch(/(^|[^\\])#\{/);
  });
});

describe("toLibrarySnippetText", () => {
  it("escapes CodeMirror's snippet markers", () => {
    expect(toLibrarySnippetText("{x}${1} #{tag}\n")).toBe("{x}\\${1} \\#{tag}\n");
  });

  it("normalises the trailing newline to exactly one", () => {
    expect(toLibrarySnippetText("-> END\n\n\n")).toBe("-> END\n");
    expect(toLibrarySnippetText("-> END")).toBe("-> END\n");
  });
});

describe("LIBRARY_SNIPPETS compile through InkPad's compiler", () => {
  it.each(LIBRARY_SNIPPETS)("$id produces compiling Ink", (snippet) => {
    const program = buildProgram(snippet);

    const response = compileInkProject({
      type: "compile",
      requestId: snippet.id,
      entryFile: "main.ink",
      files: { "main.ink": program },
    });

    if (response.type !== "compile-success") {
      const errors = response.errors.filter((error) => error.type === "error");
      if (errors.length > 0) {
        throw new Error(
          `Library snippet "${snippet.id}" failed to compile:\n` +
            errors.map((error) => `  [${error.type}] ${error.message}`).join("\n"),
        );
      }
    }
  });
});

describe("getSnippetPreview", () => {
  const librarySnippet = (mobileInsert: string): InkSnippet => ({
    id: "lib-example",
    label: "Example",
    category: "Library",
    context: "top-level",
    aliases: ["example"],
    desktopSnippet: mobileInsert,
    mobileInsert,
    description: "Example.",
    source: "library",
  });

  it("truncates a library snippet to four lines plus an ellipsis", () => {
    expect(getSnippetPreview(librarySnippet("a\nb\nc\nd\ne\nf\n"))).toBe(
      "a\nb\nc\nd\n…",
    );
  });

  it("leaves a short library snippet alone", () => {
    expect(getSnippetPreview(librarySnippet("a\nb"))).toBe("a\nb");
  });

  it("never truncates a non-library snippet", () => {
    const snippet = { ...librarySnippet("a\nb\nc\nd\ne\n"), source: undefined };
    expect(getSnippetPreview(snippet)).toBe("a\nb\nc\nd\ne\n");
  });

  it("truncates every shipped library snippet to at most five lines", () => {
    for (const snippet of LIBRARY_SNIPPETS) {
      expect(getSnippetPreview(snippet).split("\n").length).toBeLessThanOrEqual(5);
    }
  });
});
