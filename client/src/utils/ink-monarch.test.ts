import { beforeAll, describe, expect, it } from "vitest";

import { languageDefinition } from "@/utils/ink-monarch";

const languageId = "ink-monarch-test";
let monaco: typeof import("monaco-editor/esm/vs/editor/editor.api");

type TokenSpan = {
  text: string;
  type: string;
};

function tokenize(source: string): TokenSpan[][] {
  const lines = source.split("\n");

  return monaco.editor.tokenize(source, languageId).map((tokens, lineIndex) =>
    tokens.map((token, tokenIndex) => ({
      text: lines[lineIndex].slice(
        token.offset,
        tokens[tokenIndex + 1]?.offset ?? lines[lineIndex].length,
      ),
      type: token.type,
    })),
  );
}

function typeFor(spans: TokenSpan[], text: string): string {
  const span = spans.find((candidate) => candidate.text.includes(text));
  expect(span, `Expected to find a token containing "${text}"`).toBeDefined();
  return span?.type ?? "";
}

beforeAll(async () => {
  window.matchMedia ??= () => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });

  monaco = await import("monaco-editor/esm/vs/editor/editor.api");

  if (!monaco.languages.getLanguages().some((language) => language.id === languageId)) {
    monaco.languages.register({ id: languageId });
  }

  monaco.languages.setMonarchTokensProvider(languageId, languageDefinition);
});

describe("Ink Monarch grammar", () => {
  it("leaves ordinary narrative prose unclassified", () => {
    const [line] = tokenize('Once true and RANDOM words "remain narrative".');

    expect(line.every(({ type }) =>
      !/(keyword|variable|support\.function|operator|string)/.test(type)
    )).toBe(true);
  });

  it("returns to narrative mode after expression lines", () => {
    const lines = tokenize([
      "VAR score = RANDOM(1, 6)",
      "This prose has true and false words.",
      "~ score += 1",
      "More prose with LIST_COUNT in it.",
    ].join("\n"));

    expect(typeFor(lines[0], "RANDOM")).toContain("support.function.math");
    expect(typeFor(lines[0], "score")).toContain("variable.global");
    expect(lines[1].every(({ type }) => !/(keyword|variable|operator)/.test(type))).toBe(true);
    expect(typeFor(lines[2], "+=")).toContain("operator");
    expect(lines[3].every(({ type }) => !/(keyword|variable|support\.function)/.test(type))).toBe(true);
  });

  it("highlights nested choices, labels, suppression, and inline tags", () => {
    const [line] = tokenize("* * (greeting) [Hello] there # warm # first-meeting");

    expect(typeFor(line, "* *")).toContain("delimiter.choice");
    expect(typeFor(line, "greeting")).toContain("entity.name.label");
    expect(typeFor(line, "[")).toContain("delimiter.choice-bracket");
    expect(typeFor(line, "Hello")).toContain("string.content");
    expect(typeFor(line, "warm")).toContain("entity.name.tag");
    expect(typeFor(line, "first-meeting")).toContain("entity.name.tag");
  });

  it("distinguishes knot, stitch, and label segments in diverts", () => {
    const lines = tokenize([
      "Continue -> chapter.arrival.greet",
      "* Call -> calculate(score + 1) # computed",
    ].join("\n"));

    expect(typeFor(lines[0], "chapter")).toContain("variable.other.knot");
    expect(typeFor(lines[0], "arrival")).toContain("variable.other.stitch");
    expect(typeFor(lines[0], "greet")).toContain("variable.other.label");
    expect(typeFor(lines[1], "score")).toContain("variable.name");
    expect(typeFor(lines[1], "+")).toContain("operator");
    expect(typeFor(lines[1], "computed")).toContain("entity.name.tag");
  });

  it("recognizes current Ink built-ins, word operators, and Unicode identifiers", () => {
    const lines = tokenize([
      "VAR café = LIST_COUNT(fruit)",
      "~ café = café hasnt rotten ^ fresh",
      "EXTERNAL résumé(ref target)",
    ].join("\n"));

    expect(typeFor(lines[0], "café")).toContain("variable.global");
    expect(typeFor(lines[0], "LIST_COUNT")).toContain("support.function.math");
    expect(typeFor(lines[1], "hasnt")).toContain("operator.word");
    expect(typeFor(lines[1], "^")).toContain("operator");
    expect(typeFor(lines[2], "résumé")).toContain("entity.name.function");
    expect(typeFor(lines[2], "ref")).toContain("keyword.parameter");
    expect(typeFor(lines[2], "target")).toContain("variable.parameter");
  });

  it("recognizes sequence types without treating sequence prose as expressions", () => {
    const lines = tokenize([
      "{~ first once | second true | third}",
      "{shuffle once: first|second}",
    ].join("\n"));

    expect(typeFor(lines[0], "~")).toContain("keyword.alternative.type");
    expect(typeFor(lines[0], "|")).toContain("keyword.alternative");
    expect(typeFor(lines[0], "once")).not.toMatch(/keyword|variable|operator/);
    expect(typeFor(lines[0], "true")).not.toMatch(/keyword|variable|operator/);
    expect(typeFor(lines[1], "shuffle once")).toContain("keyword.multiline");
  });

  it("handles multiline conditionals and returns to narrative afterwards", () => {
    const lines = tokenize([
      "{ score > 0:",
      "  - score > 10: Excellent",
      "  - else: Fine",
      "  * (again) [Try again]",
      "}",
      "Narrative true and LIST_COUNT stay plain.",
    ].join("\n"));

    expect(typeFor(lines[0], "score")).toContain("variable.name");
    expect(typeFor(lines[0], ">")).toContain("operator");
    expect(typeFor(lines[1], "score > 10")).toContain("keyword.condition");
    expect(typeFor(lines[2], "else")).toContain("keyword.condition");
    expect(typeFor(lines[3], "again")).toContain("entity.name.label");
    expect(typeFor(lines[3], "Try again")).toContain("string.content");
    expect(lines[5].every(({ type }) =>
      !/(keyword|variable|support\.function|operator)/.test(type)
    )).toBe(true);
  });

  it("does not start a tag for an escaped hash", () => {
    const [line] = tokenize("A literal \\# symbol # actual-tag");

    expect(typeFor(line, "\\#")).toContain("string.escape");
    expect(typeFor(line, "actual-tag")).toContain("entity.name.tag");
  });
});
