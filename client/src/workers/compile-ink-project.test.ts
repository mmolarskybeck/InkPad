import { readFileSync } from "node:fs";
import path from "node:path";
import { Story } from "inkjs";
import { describe, expect, it } from "vitest";
import type { CompilerResponse } from "@/types/worker-messages";
import { compileInkProject } from "./compile-ink-project";

const fixturesDir = path.resolve(process.cwd(), "client/src/workers/__fixtures__/inkjs-diagnostics");

function readFixture(name: string) {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}

function compileFixture(
  entryFile: string,
  files: Record<string, string> = { [entryFile]: readFixture(entryFile) },
): CompilerResponse {
  return compileInkProject({
    type: "compile",
    requestId: `fixture-${entryFile}`,
    entryFile,
    files,
  });
}

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

  it("snapshots normalized inkjs diagnostic messages from fixture programs", () => {
    const responses = [
      compileFixture("missing-divert-target.ink"),
      compileFixture("todo-author-warning.ink"),
      compileFixture("include-missing-target.ink"),
      compileFixture("included-file-error.ink", {
        "included-file-error.ink": readFixture("included-file-error.ink"),
        "chapters/broken.ink": readFixture("chapters/broken.ink"),
      }),
    ].map((response) => (
      response.type === "compile-error"
        ? {
            type: response.type,
            requestId: response.requestId,
            errors: response.errors,
          }
        : {
            type: response.type,
            requestId: response.requestId,
            warnings: response.warnings,
          }
    ));

    expect(responses).toMatchInlineSnapshot(`
      [
        {
          "errors": [
            {
              "fileId": "missing-divert-target.ink",
              "line": 1,
              "message": "Divert target not found: '-> missing_target'",
              "type": "error",
            },
          ],
          "requestId": "fixture-missing-divert-target.ink",
          "type": "compile-error",
        },
        {
          "requestId": "fixture-todo-author-warning.ink",
          "type": "compile-success",
          "warnings": [
            {
              "fileId": "todo-author-warning.ink",
              "line": 1,
              "message": "TODO: Tighten this scene.",
              "type": "info",
            },
          ],
        },
        {
          "errors": [
            {
              "message": "Cannot locate chapters/missing.ink. Are you trying a relative import ? This is not yet implemented.",
              "type": "error",
            },
          ],
          "requestId": "fixture-include-missing-target.ink",
          "type": "compile-error",
        },
        {
          "errors": [
            {
              "fileId": "chapters/broken.ink",
              "line": 2,
              "message": "Divert target not found: '-> nowhere'",
              "type": "error",
            },
          ],
          "requestId": "fixture-included-file-error.ink",
          "type": "compile-error",
        },
      ]
    `);
  });
});
