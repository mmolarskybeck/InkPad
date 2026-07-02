import { describe, expect, it } from "vitest";
import { getSnippetCompletions } from "./ink-completion-provider";

// column is 1-based and sits one past the last typed character, as Monaco
// reports it. For a line "knot" with the cursor at the end, column === 5.
const atEnd = (line: string) => line.length + 1;

function idsFor(line: string, column = atEnd(line)) {
  return getSnippetCompletions(line, column).map((c) => c.snippet.id);
}

describe("getSnippetCompletions conservative triggering", () => {
  it("offers a snippet when its trigger word is alone on the line", () => {
    expect(idsFor("knot")).toContain("knot");
  });

  it("matches on a partial prefix of an alias", () => {
    expect(idsFor("kn")).toContain("knot");
    expect(idsFor("va")).toContain("var");
  });

  it("stays silent when the word is part of prose", () => {
    expect(idsFor("The knot of the city was tight")).toEqual([]);
    expect(idsFor("Once upon a time")).toEqual([]);
  });

  it("stays silent when there is text after the cursor", () => {
    // cursor right after "kn" in "knot story"
    expect(getSnippetCompletions("kn story", 3)).toEqual([]);
  });

  it("ignores leading indentation but still requires a lone word", () => {
    expect(idsFor("    choice")).toContain("choice");
    expect(idsFor("    pick a choice")).toEqual([]);
  });

  it("matches uppercase keyword aliases case-insensitively", () => {
    expect(idsFor("LIST")).toContain("list");
    expect(idsFor("list")).toContain("list");
  });

  it("matches symbol aliases", () => {
    // `->` is divert's alias; tunnel is reached by its word so `->` stays focused.
    expect(idsFor("->")).toContain("divert");
    expect(idsFor("tunnel")).toContain("tunnel");
  });

  it("returns the word range to replace, honoring indentation", () => {
    const [completion] = getSnippetCompletions("  knot", atEnd("  knot"));
    expect(completion.replace).toEqual({ startColumn: 3, endColumn: 7 });
  });

  it("returns nothing on an empty or whitespace-only line", () => {
    expect(idsFor("")).toEqual([]);
    expect(idsFor("    ")).toEqual([]);
  });
});
