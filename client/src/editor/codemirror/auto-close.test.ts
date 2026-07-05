import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  getInkAutoCloseEdit,
  getInkKnotDeclarationEnterEdit,
  getInkKnotTypeOverPos,
} from "./auto-close";

function docWithCursor(source: string) {
  const pos = source.indexOf("|");
  if (pos === -1) throw new Error("Test document must include a | cursor marker.");

  return {
    doc: EditorState.create({
      doc: source.slice(0, pos) + source.slice(pos + 1),
    }).doc,
    pos,
  };
}

describe("Ink CodeMirror auto-close", () => {
  it("turns typed === at the start of a line into a knot declaration shell", () => {
    const { doc, pos } = docWithCursor("==|");

    expect(getInkAutoCloseEdit(doc, pos, pos, "=")).toEqual({
      from: 0,
      to: 2,
      insert: "===  ===",
      selection: 4,
    });
  });

  it("preserves indentation when completing a typed knot declaration shell", () => {
    const { doc, pos } = docWithCursor("  ==|");

    expect(getInkAutoCloseEdit(doc, pos, pos, "=")).toEqual({
      from: 2,
      to: 4,
      insert: "===  ===",
      selection: 6,
    });
  });

  it("also normalizes pasted === at the start of a line", () => {
    const { doc, pos } = docWithCursor("|");

    expect(getInkAutoCloseEdit(doc, pos, pos, "===")).toEqual({
      from: 0,
      to: 0,
      insert: "===  ===",
      selection: 4,
    });
  });

  it("stays quiet when === is typed in prose", () => {
    const { doc, pos } = docWithCursor("The equation is ==|");

    expect(getInkAutoCloseEdit(doc, pos, pos, "=")).toBeNull();
  });

  it("stays quiet when there is text after the cursor", () => {
    const { doc, pos } = docWithCursor("==| existing");

    expect(getInkAutoCloseEdit(doc, pos, pos, "=")).toBeNull();
  });

  it("stays quiet when replacing a selection", () => {
    const { doc } = docWithCursor("==|");

    expect(getInkAutoCloseEdit(doc, 0, 2, "=")).toBeNull();
  });

  it("moves Enter past the closing knot declaration marker", () => {
    const { doc, pos } = docWithCursor("=== start| ===");

    expect(getInkKnotDeclarationEnterEdit(doc, pos)).toEqual({
      from: "=== start ===".length,
      to: "=== start ===".length,
      insert: "\n",
      selection: "=== start ===\n".length,
    });
  });

  it("moves Enter past the closing marker in an indented declaration", () => {
    const { doc, pos } = docWithCursor("  === start| ===");

    expect(getInkKnotDeclarationEnterEdit(doc, pos)).toEqual({
      from: "  === start ===".length,
      to: "  === start ===".length,
      insert: "\n",
      selection: "  === start ===\n".length,
    });
  });

  it("drops trailing whitespace after the closing marker when moving Enter past it", () => {
    const { doc, pos } = docWithCursor("=== start| ===  ");

    expect(getInkKnotDeclarationEnterEdit(doc, pos)).toEqual({
      from: "=== start ===".length,
      to: "=== start ===  ".length,
      insert: "\n",
      selection: "=== start ===\n".length,
    });
  });

  it("does not move Enter past an empty knot declaration name", () => {
    const { doc, pos } = docWithCursor("=== | ===");

    expect(getInkKnotDeclarationEnterEdit(doc, pos)).toBeNull();
  });

  it("does not move Enter in prose before ===", () => {
    const { doc, pos } = docWithCursor("The marker is| ===");

    expect(getInkKnotDeclarationEnterEdit(doc, pos)).toBeNull();
  });

  it("types over the space between the knot name and the closing marker", () => {
    const { doc, pos } = docWithCursor("=== start| ===");

    expect(getInkKnotTypeOverPos(doc, pos, pos, " ")).toBe(pos + 1);
  });

  it("types over the first = of the closing marker", () => {
    const { doc, pos } = docWithCursor("=== start |===");

    expect(getInkKnotTypeOverPos(doc, pos, pos, "=")).toBe(pos + 1);
  });

  it("types over the second = of the closing marker", () => {
    const { doc, pos } = docWithCursor("=== start =|==");

    expect(getInkKnotTypeOverPos(doc, pos, pos, "=")).toBe(pos + 1);
  });

  it("types over the third = of the closing marker", () => {
    const { doc, pos } = docWithCursor("=== start ==|=");

    expect(getInkKnotTypeOverPos(doc, pos, pos, "=")).toBe(pos + 1);
  });

  it("does not type over when the typed character does not match the character at the cursor", () => {
    const { doc, pos } = docWithCursor("=== start| ===");

    expect(getInkKnotTypeOverPos(doc, pos, pos, "=")).toBeNull();
  });

  it("does not type over before a knot name has been typed", () => {
    const { doc, pos } = docWithCursor("=== | ===");

    expect(getInkKnotTypeOverPos(doc, pos, pos, " ")).toBeNull();
  });

  it("does not type over in a prose line", () => {
    const { doc, pos } = docWithCursor("The marker is| ===");

    expect(getInkKnotTypeOverPos(doc, pos, pos, " ")).toBeNull();
  });

  it("does not type over when replacing a selection", () => {
    const { doc } = docWithCursor("=== start| ===");

    expect(getInkKnotTypeOverPos(doc, 0, 5, " ")).toBeNull();
  });

  it("does not type over at the end of a line with nothing after the cursor", () => {
    const { doc, pos } = docWithCursor("=== start ===|");

    expect(getInkKnotTypeOverPos(doc, pos, pos, "=")).toBeNull();
  });
});
