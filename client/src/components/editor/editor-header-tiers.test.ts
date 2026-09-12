import { describe, expect, it } from "vitest";
import {
  EDITOR_HEADER_COMPACT_WIDTH,
  EDITOR_HEADER_NARROW_WIDTH,
  getEditorHeaderTier,
  getSaveStatus,
  getSaveStatusDotClass,
} from "@/components/editor/editor-header-tiers";

describe("getEditorHeaderTier", () => {
  it("assumes the widest tier before the first measurement", () => {
    expect(getEditorHeaderTier(null)).toBe("wide");
    expect(getEditorHeaderTier(undefined)).toBe("wide");
  });

  it("tiers on the measured width", () => {
    expect(getEditorHeaderTier(900)).toBe("wide");
    expect(getEditorHeaderTier(EDITOR_HEADER_COMPACT_WIDTH)).toBe("wide");
    expect(getEditorHeaderTier(EDITOR_HEADER_COMPACT_WIDTH - 1)).toBe("compact");
    expect(getEditorHeaderTier(EDITOR_HEADER_NARROW_WIDTH)).toBe("compact");
    expect(getEditorHeaderTier(EDITOR_HEADER_NARROW_WIDTH - 1)).toBe("narrow");
    expect(getEditorHeaderTier(0)).toBe("narrow");
  });
});

describe("save status mappings", () => {
  it("labels every state once", () => {
    expect(getSaveStatus("saved").label).toBe("Saved");
    expect(getSaveStatus("dirty").label).toBe("Modified");
    expect(getSaveStatus("saving").label).toBe("Saving...");
    expect(getSaveStatus("error").label).toBe("Save failed");
    expect(getSaveStatus("disabled").label).toBe("Autosave disabled");
  });

  it("gives the dot a colour per state", () => {
    expect(getSaveStatusDotClass("saved")).toContain("bg-success");
    expect(getSaveStatusDotClass("dirty")).toContain("bg-warning");
    expect(getSaveStatusDotClass("saving")).toContain("bg-accent-blue");
    expect(getSaveStatusDotClass("saving")).toContain("animate-pulse");
    expect(getSaveStatusDotClass("error")).toContain("bg-error");
    expect(getSaveStatusDotClass("disabled")).toContain("bg-warning");
  });
});
