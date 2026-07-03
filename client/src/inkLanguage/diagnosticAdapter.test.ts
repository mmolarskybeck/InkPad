import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { InkCompilerError } from "@/lib/ink-compiler";
import { compileInkProject } from "@/workers/compile-ink-project";
import {
  adaptCompilerDiagnostic,
  getUnresolvedDivertTarget,
  UNRESOLVED_DIVERT_CODE,
} from "./diagnosticAdapter";

const fixturesDir = path.resolve(process.cwd(), "client/src/workers/__fixtures__/inkjs-diagnostics");

function readFixture(name: string) {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}

describe("getUnresolvedDivertTarget", () => {
  it("recognizes pinned inkjs unresolved-divert messages", () => {
    expect(getUnresolvedDivertTarget("Divert target not found: '-> missing_target'")).toBe("missing_target");
  });

  it("ignores unrelated compiler messages", () => {
    expect(getUnresolvedDivertTarget("Cannot locate chapters/missing.ink.")).toBeNull();
  });
});

describe("adaptCompilerDiagnostic", () => {
  it("adds unresolved-divert metadata from a fixture-backed compiler diagnostic", () => {
    const response = compileInkProject({
      type: "compile",
      requestId: "adapter-missing-divert",
      entryFile: "missing-divert-target.ink",
      files: {
        "missing-divert-target.ink": readFixture("missing-divert-target.ink"),
      },
    });

    expect(response.type).toBe("compile-error");
    if (response.type !== "compile-error") return;

    const diagnostic: InkCompilerError = {
      line: response.errors[0].line ?? 1,
      fileId: response.errors[0].fileId,
      message: response.errors[0].message,
      type: response.errors[0].type,
    };

    expect(adaptCompilerDiagnostic(diagnostic)).toMatchObject({
      code: UNRESOLVED_DIVERT_CODE,
      targetName: "missing_target",
    });
  });

  it("leaves unrecognized diagnostics untouched", () => {
    const diagnostic: InkCompilerError = {
      line: 1,
      message: "Cannot locate chapters/missing.ink.",
      type: "error",
    };

    expect(adaptCompilerDiagnostic(diagnostic)).toEqual(diagnostic);
  });
});
