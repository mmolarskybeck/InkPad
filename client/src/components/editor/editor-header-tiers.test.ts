import { describe, expect, it } from "vitest";
import {
  EDITOR_HEADER_COMPACT_WIDTH,
  EDITOR_HEADER_NARROW_WIDTH,
  getEditorHeaderTier,
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
