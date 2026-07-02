import { Story } from "inkjs";
import { describe, expect, it } from "vitest";
import { compileInkProject } from "./compile-ink-project";

describe("compileInkProject", () => {
  it("compiles an entry file with an INCLUDE from the virtual file map", () => {
    const response = compileInkProject({
      type: "compile",
      requestId: "include-test",
      entryFile: "main.ink",
      files: {
        "main.ink": "INCLUDE chapter.ink\n-> chapter",
        "chapter.ink": "=== chapter ===\nIncluded works.\n-> END",
      },
    });

    expect(response.type).toBe("compile-success");
    if (response.type !== "compile-success") return;

    const story = new Story(response.storyJson);
    expect(story.Continue().trim()).toBe("Included works.");
  });

  it("returns a useful error when the entry file is missing", () => {
    const response = compileInkProject({
      type: "compile",
      requestId: "missing-entry",
      entryFile: "main.ink",
      files: {
        "chapter.ink": "Chapter",
      },
    });

    expect(response).toMatchObject({
      type: "compile-error",
      requestId: "missing-entry",
      errors: [{
        message: 'Entry file "main.ink" was not found in this project.',
        type: "error",
      }],
    });
  });
});
