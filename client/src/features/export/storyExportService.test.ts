import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, downloadTextFile } from "@/features/files/fileDownload";
import {
  exportCompiledJson,
  exportInkSource,
  exportStoryHtml,
} from "./storyExportService";
import { buildStoryHtml } from "./htmlTemplate";
import { createStoryZip } from "./zipExport";

vi.mock("@/features/files/fileDownload", () => ({
  downloadBlob: vi.fn(),
  downloadTextFile: vi.fn(),
}));

vi.mock("./htmlTemplate", () => ({
  buildStoryHtml: vi.fn(async () => "<html></html>"),
}));

vi.mock("./zipExport", () => ({
  createStoryZip: vi.fn(async () => new Blob(["zip"])),
}));

describe("story export filenames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports Ink using the independent file name without lowercasing it", () => {
    exportInkSource({
      source: "Opening",
      filename: "My File Name.ink",
    });

    expect(downloadTextFile).toHaveBeenCalledWith(
      "Opening",
      "My File Name.ink",
      "text/plain",
    );
  });

  it("changes only the extension for compiled JSON", async () => {
    await exportCompiledJson({
      source: "Opening",
      title: "A Different Story Title",
      filename: "My File Name.ink",
      compileStory: async () => ({
        requestId: "compile",
        runtimeStory: null,
        compiledJson: "{}",
        errors: [],
        knots: [],
      }),
    });

    expect(downloadTextFile).toHaveBeenCalledWith(
      "{}",
      "My File Name.json",
      "application/json",
    );
  });

  it("keeps the file name for web export even when source metadata changes the title", async () => {
    await exportStoryHtml({
      source: "Opening",
      title: "Stored Story Title",
      filename: "My File Name.ink",
      htmlOptions: {
        title: "Export-only Title",
        author: "Export Author",
        theme: "high-contrast",
        font: "mono",
        includeReadme: false,
      },
      compileStory: async () => ({
        requestId: "compile",
        runtimeStory: { globalTags: ["title: Source Story Title"] } as never,
        compiledJson: "{}",
        errors: [],
        knots: [],
      }),
    });

    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "My File Name.zip");
    expect(buildStoryHtml).toHaveBeenCalledWith("{}", expect.objectContaining({
      title: "Export-only Title",
      author: "Export Author",
      theme: "high-contrast",
      font: "mono",
    }));
    expect(createStoryZip).toHaveBeenCalledWith({
      html: "<html></html>",
      title: "Export-only Title",
      includeReadme: false,
    });
  });
});
