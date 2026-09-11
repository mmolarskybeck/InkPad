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

    expect(zip.file("index.html")).not.toBeNull();
    expect(zip.file("README.html")).not.toBeNull();
  });

  it("omits the README when requested", async () => {
    const blob = await createStoryZip({
      html: "<html></html>",
      title: "Story",
      includeReadme: false,
    });
    const zip = await JSZip.loadAsync(blob);

    expect(zip.file("index.html")).not.toBeNull();
    expect(zip.file("README.html")).toBeNull();
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
    expect(withSource.file("index.html")).not.toBeNull();
    expect(await withSource.file("source.inkpad")?.async("string")).toBe("bundle");
  });

  it("mentions source.inkpad in the README only when the source is bundled", async () => {
    const withSource = await createStoryZip({
      html: "<html></html>",
      title: "Story",
      sourceBundle: new Blob(["x"]),
    });
    const withoutSource = await createStoryZip({ html: "<html></html>", title: "Story" });
    const readmeWith = await (await JSZip.loadAsync(withSource)).file("README.html")!.async("string");
    const readmeWithout = await (await JSZip.loadAsync(withoutSource)).file("README.html")!.async("string");
    expect(readmeWith).toContain("source.inkpad");
    expect(readmeWithout).not.toContain("<code>source.inkpad</code> — your editable project");
    expect(readmeWith).toContain("<!DOCTYPE html>");
  });
});
