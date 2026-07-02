import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree } from "@codemirror/language";
import { InkLanguageSupport } from "@/editor/codemirror/ink-lang";
import { findIdentifierMatches, identifierWordAt } from "@/editor/codemirror/identifier-occurrences";

const doc = `VAR mood = "curious"
LONDON, 1872. The mood in london was curious.
-> london

=== london ===
The mood improved.
~ mood = "cheerful"
-> london.deeper

= deeper
Still in london.
-> END
`;

function createState() {
  const state = EditorState.create({ doc, extensions: InkLanguageSupport() });
  ensureSyntaxTree(state, state.doc.length, 5000);
  return state;
}

function posOf(text: string, occurrence = 0) {
  let index = -1;
  for (let i = 0; i <= occurrence; i += 1) {
    index = doc.indexOf(text, index + 1);
  }
  if (index === -1) throw new Error(`"${text}" occurrence ${occurrence} not found in fixture`);
  return index;
}

describe("identifierWordAt", () => {
  it("finds the word when the cursor is inside a divert target", () => {
    const state = createState();
    const word = identifierWordAt(state, posOf("-> london") + 4);

    expect(word).toMatchObject({ text: "london" });
  });

  it("finds the word when the cursor is inside a knot definition", () => {
    const state = createState();
    const word = identifierWordAt(state, posOf("=== london ===") + 5);

    expect(word).toMatchObject({ text: "london" });
  });

  it("finds a variable name in a VAR declaration", () => {
    const state = createState();
    const word = identifierWordAt(state, posOf("VAR mood") + 5);

    expect(word).toMatchObject({ text: "mood" });
  });

  it("returns null when the cursor is in prose", () => {
    const state = createState();

    expect(identifierWordAt(state, posOf("The mood in london") + 13)).toBeNull();
    expect(identifierWordAt(state, posOf("LONDON, 1872") + 2)).toBeNull();
  });
});

describe("findIdentifierMatches", () => {
  it("matches definitions and references but never prose", () => {
    const state = createState();
    const matches = findIdentifierMatches(state, "london", 0, state.doc.length);
    const texts = matches.map((match) => state.doc.sliceString(match.from, match.to));

    // -> london, === london ===, -> london.deeper — but not the two prose "london"s
    expect(texts).toEqual(["london", "london", "london"]);
    expect(matches.map((match) => state.doc.lineAt(match.from).number)).toEqual([3, 5, 8]);
  });

  it("matches variable declaration and assignment but not prose usage", () => {
    const state = createState();
    const matches = findIdentifierMatches(state, "mood", 0, state.doc.length);

    // VAR mood, ~ mood = — not "The mood in london" or "The mood improved."
    expect(matches.map((match) => state.doc.lineAt(match.from).number)).toEqual([1, 7]);
  });

  it("requires whole-word matches", () => {
    const state = createState();
    const matches = findIdentifierMatches(state, "lond", 0, state.doc.length);

    expect(matches).toEqual([]);
  });
});
