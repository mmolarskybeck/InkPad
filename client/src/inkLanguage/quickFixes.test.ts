import { describe, expect, it } from "vitest";
import { getMissingStartingDivertEdit } from "./quickFixes";

describe("getMissingStartingDivertEdit", () => {
  it("inserts a starting divert at the beginning of the document", () => {
    expect(getMissingStartingDivertEdit("find_help")).toEqual({
      from: 0,
      to: 0,
      insert: "-> find_help\n\n",
    });
  });

  it("preserves dotted stitch paths", () => {
    expect(getMissingStartingDivertEdit("hub.intro").insert).toBe("-> hub.intro\n\n");
  });
});
