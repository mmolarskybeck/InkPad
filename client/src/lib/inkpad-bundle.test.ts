import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { createSingleFileProject } from "./ink-project";
import {
  INKPAD_BUNDLE_FORMAT_VERSION,
  createInkPadBundleBlob,
  parseInkPadBundle,
} from "./inkpad-bundle";

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

describe("InkPad bundle archive", () => {
  function multiFileProject() {
    const project = createSingleFileProject({
      id: "project-1",
      name: "80 Days",
      fileName: "untitled.ink",
      content: "INCLUDE chapter2.ink\n-> chapter2",
      explicit: true,
    });

    return {
      ...project,
      files: {
        ...project.files,
        "chapter2.ink": { content: "=== chapter2 ===\nHello.\n-> END" },
        "chapters/chapter3_new.ink": { content: "Chapter 3" },
      },
    };
  }

  it("exports project metadata and separate raw Ink files", async () => {
    const blob = await createInkPadBundleBlob(multiFileProject(), {
      title: "80 Days",
      author: "inkle",
      previewMode: "scene",
    });

    const zip = await JSZip.loadAsync(await blobToArrayBuffer(blob));
    const manifest = JSON.parse(await zip.file("inkpad.json")!.async("string"));

    expect(manifest).toEqual({
      format: "inkpad",
      formatVersion: INKPAD_BUNDLE_FORMAT_VERSION,
      schemaVersion: 2,
      id: "project-1",
      name: "80 Days",
      entryFile: "ink/untitled.ink",
      files: [
        "ink/untitled.ink",
        "ink/chapter2.ink",
        "ink/chapters/chapter3_new.ink",
      ],
      settings: {
        title: "80 Days",
        author: "inkle",
        previewMode: "scene",
      },
    });
    expect(manifest.files).not.toHaveProperty("untitled.ink");
    expect(await zip.file("ink/untitled.ink")!.async("string")).toBe("INCLUDE chapter2.ink\n-> chapter2");
    expect(await zip.file("ink/chapter2.ink")!.async("string")).toContain("Hello.");
    expect(zip.file("README.txt")).toBeTruthy();
  });

  it("imports the archive as a sanitized InkProject without exposing metadata files", async () => {
    const blob = await createInkPadBundleBlob(multiFileProject(), {
      title: "80 Days",
      author: "inkle",
      previewMode: "scene",
      htmlExport: {
        title: "80 Days",
        author: "inkle",
        theme: "high-contrast",
        font: "mono",
        includeReadme: false,
      },
    });

    const parsed = await parseInkPadBundle(await blobToArrayBuffer(blob));

    expect(parsed.project).toMatchObject({
      schemaVersion: 2,
      id: "project-1",
      name: "80 Days",
      entryFile: "untitled.ink",
      files: {
        "untitled.ink": { content: "INCLUDE chapter2.ink\n-> chapter2" },
        "chapter2.ink": { content: "=== chapter2 ===\nHello.\n-> END" },
        "chapters/chapter3_new.ink": { content: "Chapter 3" },
      },
    });
    expect(Object.keys(parsed.project.files)).not.toContain("inkpad.json");
    expect(parsed.settings).toEqual({
      title: "80 Days",
      author: "inkle",
      previewMode: "scene",
      htmlExport: {
        title: "80 Days",
        author: "inkle",
        theme: "high-contrast",
        font: "mono",
        includeReadme: false,
      },
    });
  });

  it("rejects manifests with unsafe Ink paths", async () => {
    const zip = new JSZip();
    zip.file("inkpad.json", JSON.stringify({
      format: "inkpad",
      formatVersion: INKPAD_BUNDLE_FORMAT_VERSION,
      schemaVersion: 2,
      id: "project-1",
      name: "Bad",
      entryFile: "ink/../bad.ink",
      files: ["ink/../bad.ink"],
    }));
    zip.file("ink/../bad.ink", "Nope");

    const data = await zip.generateAsync({ type: "arraybuffer" });

    await expect(parseInkPadBundle(data)).rejects.toThrow("invalid or conflicting Ink file paths");
  });
});
