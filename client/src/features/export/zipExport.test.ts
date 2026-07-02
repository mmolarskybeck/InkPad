import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createStoryZip } from "./zipExport";

describe("web story ZIP", () => {
  it("includes the README when requested", async () => {
    const blob = await createStoryZip({
      html: "<html></html>",
      title: "Story",
      includeReadme: true,
    });
    const zip = await JSZip.loadAsync(blob);

    expect(zip.file("play.html")).not.toBeNull();
    expect(zip.file("README.md")).not.toBeNull();
  });

  it("omits the README when requested", async () => {
    const blob = await createStoryZip({
      html: "<html></html>",
      title: "Story",
      includeReadme: false,
    });
    const zip = await JSZip.loadAsync(blob);

    expect(zip.file("play.html")).not.toBeNull();
    expect(zip.file("README.md")).toBeNull();
  });
});
