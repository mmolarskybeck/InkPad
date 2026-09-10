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

  it("adds source.inkpad only when a source bundle is provided", async () => {
    const withoutSource = await JSZip.loadAsync(await createStoryZip({
      html: "<html></html>",
      title: "Story",
    }));
    expect(withoutSource.file("source.inkpad")).toBeNull();

    const withSource = await JSZip.loadAsync(await createStoryZip({
      html: "<html></html>",
      title: "Story",
      sourceBundle: new Blob(["bundle"], { type: "application/zip" }),
    }));
    expect(withSource.file("play.html")).not.toBeNull();
    expect(await withSource.file("source.inkpad")?.async("string")).toBe("bundle");
  });
});
