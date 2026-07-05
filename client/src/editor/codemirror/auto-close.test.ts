import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  getInkAutoCloseEdit,
  getInkBlockCommentAutoCloseEdit,
  getInkBlockCommentTypeOverPos,
  getInkChoiceContinuationEdit,
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

  it("continues a choice marker on Enter", () => {
    const { doc, pos } = docWithCursor("* Open the door|");

    expect(getInkChoiceContinuationEdit(doc, pos)).toEqual({
      from: "* Open the door".length,
      to: "* Open the door".length,
      insert: "\n* ",
      selection: "* Open the door\n* ".length,
    });
  });

  it("continues a nested choice marker on Enter", () => {
    const { doc, pos } = docWithCursor("** deeper choice|");

    expect(getInkChoiceContinuationEdit(doc, pos)).toEqual({
      from: "** deeper choice".length,
      to: "** deeper choice".length,
      insert: "\n** ",
      selection: "** deeper choice\n** ".length,
    });
  });

  it("continues a space-separated choice marker on Enter", () => {
    const { doc, pos } = docWithCursor("* * spaced|");

    expect(getInkChoiceContinuationEdit(doc, pos)).toEqual({
      from: "* * spaced".length,
      to: "* * spaced".length,
      insert: "\n* * ",
      selection: "* * spaced\n* * ".length,
    });
  });

  it("continues a sticky choice marker on Enter", () => {
    const { doc, pos } = docWithCursor("+ again|");

    expect(getInkChoiceContinuationEdit(doc, pos)).toEqual({
      from: "+ again".length,
      to: "+ again".length,
      insert: "\n+ ",
      selection: "+ again\n+ ".length,
    });
  });

  it("continues a gather marker on Enter", () => {
    const { doc, pos } = docWithCursor("- gather text|");

    expect(getInkChoiceContinuationEdit(doc, pos)).toEqual({
      from: "- gather text".length,
      to: "- gather text".length,
      insert: "\n- ",
      selection: "- gather text\n- ".length,
    });
  });

  it("preserves indentation when continuing a choice marker on Enter", () => {
    const { doc, pos } = docWithCursor("  * indented|");

    expect(getInkChoiceContinuationEdit(doc, pos)).toEqual({
      from: "  * indented".length,
      to: "  * indented".length,
      insert: "\n  * ",
      selection: "  * indented\n  * ".length,
    });
  });

  it("continues only the marker when the choice line has a label", () => {
    const { doc, pos } = docWithCursor("* (label) text|");

    expect(getInkChoiceContinuationEdit(doc, pos)).toEqual({
      from: "* (label) text".length,
      to: "* (label) text".length,
      insert: "\n* ",
      selection: "* (label) text\n* ".length,
    });
  });

  it("clears an empty choice marker on Enter instead of continuing it", () => {
    const { doc, pos } = docWithCursor("* |");

    expect(getInkChoiceContinuationEdit(doc, pos)).toEqual({
      from: 0,
      to: "* ".length,
      insert: "",
      selection: 0,
    });
  });

  it("clears an empty choice marker with no trailing space on Enter", () => {
    const { doc, pos } = docWithCursor("*|");

    expect(getInkChoiceContinuationEdit(doc, pos)).toEqual({
      from: 0,
      to: "*".length,
      insert: "",
      selection: 0,
    });
  });

  it("does not continue on a bare divert line", () => {
    const { doc, pos } = docWithCursor("-> somewhere|");

    expect(getInkChoiceContinuationEdit(doc, pos)).toBeNull();
  });

  it("does not continue when the cursor is mid-line", () => {
    const { doc, pos } = docWithCursor("* some| text");

    expect(getInkChoiceContinuationEdit(doc, pos)).toBeNull();
  });

  it("does not continue on a plain prose line", () => {
    const { doc, pos } = docWithCursor("just text|");

    expect(getInkChoiceContinuationEdit(doc, pos)).toBeNull();
  });

  it("does not treat a marker with no space before content as a choice marker", () => {
    const { doc, pos } = docWithCursor("*bold*|");

    expect(getInkChoiceContinuationEdit(doc, pos)).toBeNull();
  });

  it("auto-closes a typed block comment opener", () => {
    const { doc, pos } = docWithCursor("/|");

    expect(getInkBlockCommentAutoCloseEdit(doc, pos, pos, "*")).toEqual({
      from: 1,
      to: 1,
      insert: "*  */",
      selection: 3,
    });
  });

  it("auto-closes an indented block comment opener", () => {
    const { doc, pos } = docWithCursor("  /|");

    expect(getInkBlockCommentAutoCloseEdit(doc, pos, pos, "*")).toEqual({
      from: 3,
      to: 3,
      insert: "*  */",
      selection: 5,
    });
  });

  it("types over the space after the block comment opener", () => {
    const { doc, pos } = docWithCursor("/* note| */");

    expect(getInkBlockCommentTypeOverPos(doc, pos, pos, " ")).toBe(pos + 1);
  });

  it("types over the first * of the block comment closer", () => {
    const { doc, pos } = docWithCursor("/* note |*/");

    expect(getInkBlockCommentTypeOverPos(doc, pos, pos, "*")).toBe(pos + 1);
  });

  it("types over the / of the block comment closer", () => {
    const { doc, pos } = docWithCursor("/* note *|/");

    expect(getInkBlockCommentTypeOverPos(doc, pos, pos, "/")).toBe(pos + 1);
  });

  it("does not auto-close a block comment inside a line comment", () => {
    const { doc, pos } = docWithCursor("//|");

    expect(getInkBlockCommentAutoCloseEdit(doc, pos, pos, "*")).toBeNull();
  });

  it("does not auto-close a block comment when there is content after the cursor", () => {
    const { doc, pos } = docWithCursor("/| code");

    expect(getInkBlockCommentAutoCloseEdit(doc, pos, pos, "*")).toBeNull();
  });

  it("does not type over a block comment closer without a preceding opener", () => {
    const { doc, pos } = docWithCursor("note| */");

    expect(getInkBlockCommentTypeOverPos(doc, pos, pos, " ")).toBeNull();
  });
});
