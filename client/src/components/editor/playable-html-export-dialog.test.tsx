import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayableHtmlExportDialog } from "./playable-html-export-dialog";
import type { MetadataField, StoryMetadata } from "@/lib/tag-interpreter";

const metadataWithTheme: StoryMetadata = {
  title: "Source Title",
  author: "Source Author",
  theme: "sepia",
  sourceFields: new Set<MetadataField>(["title", "author", "theme"]),
};

const metadataNoTheme: StoryMetadata = {
  title: "Source Title",
  author: "Source Author",
  theme: null,
  sourceFields: new Set<MetadataField>(["title", "author"]),
};

describe("PlayableHtmlExportDialog", () => {
  it("uses file theme as default when # theme: is set", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();

    render(
      <PlayableHtmlExportDialog
        open
        metadata={metadataWithTheme}
        storyTypeface="serif"
        resolvedTheme="dark"
        resolvedFromSystem={false}
        filename="Story File.ink"
        onOpenChange={() => {}}
        onExport={onExport}
        onSetFileTheme={vi.fn()}
        onStoryTypefaceChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Download ZIP" }));

    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({
      theme: "sepia",
      font: "serif",
      rememberChoices: true,
    }));
  });

  it("uses resolved preview theme as default when no # theme: tag", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();

    render(
      <PlayableHtmlExportDialog
        open
        metadata={metadataNoTheme}
        storyTypeface="serif"
        resolvedTheme="dark"
        resolvedFromSystem={false}
        filename="Story File.ink"
        onOpenChange={() => {}}
        onExport={onExport}
        onSetFileTheme={vi.fn()}
        onStoryTypefaceChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Download ZIP" }));

    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({
      theme: "dark",
    }));
  });

  it("shows file theme status text when theme matches # theme:", () => {
    render(
      <PlayableHtmlExportDialog
        open
        metadata={metadataWithTheme}
        storyTypeface="serif"
        resolvedTheme="dark"
        resolvedFromSystem={false}
        filename="Story File.ink"
        onOpenChange={() => {}}
        onExport={vi.fn()}
        onSetFileTheme={vi.fn()}
        onStoryTypefaceChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Export will use Sepia from/)).toBeInTheDocument();
    expect(screen.getByText(/# theme:/)).toBeInTheDocument();
  });

  it("shows system-based copy when no file theme and resolved from system", () => {
    render(
      <PlayableHtmlExportDialog
        open
        metadata={metadataNoTheme}
        storyTypeface="serif"
        resolvedTheme="dark"
        resolvedFromSystem
        filename="Story File.ink"
        onOpenChange={() => {}}
        onExport={vi.fn()}
        onSetFileTheme={vi.fn()}
        onStoryTypefaceChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/based on your current system setting/)).toBeInTheDocument();
  });

  it("shows set file theme button when user changes theme", async () => {
    const user = userEvent.setup();
    const onSetFileTheme = vi.fn();

    render(
      <PlayableHtmlExportDialog
        open
        metadata={metadataNoTheme}
        storyTypeface="serif"
        resolvedTheme="light"
        resolvedFromSystem={false}
        filename="Story File.ink"
        onOpenChange={() => {}}
        onExport={vi.fn()}
        onSetFileTheme={onSetFileTheme}
        onStoryTypefaceChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Set file theme/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "HTML export theme" }));
    await user.click(screen.getByRole("option", { name: "Dark" }));

    expect(screen.getByRole("button", { name: "Set file theme to Dark" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Set file theme to Dark" }));

    expect(onSetFileTheme).toHaveBeenCalledWith("dark");
    expect(screen.queryByRole("button", { name: /Set file theme/ })).not.toBeInTheDocument();
  });

  it("can make the export a one-off", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();

    render(
      <PlayableHtmlExportDialog
        open
        metadata={metadataWithTheme}
        storyTypeface="serif"
        resolvedTheme="dark"
        resolvedFromSystem={false}
        filename="Story File.ink"
        onOpenChange={() => {}}
        onExport={onExport}
        onSetFileTheme={vi.fn()}
        onStoryTypefaceChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("switch", { name: "Remember these choices" }));
    await user.click(screen.getByRole("button", { name: "Download ZIP" }));

    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({
      rememberChoices: false,
    }));
  });

  it("calls onStoryTypefaceChange when typeface changes", async () => {
    const user = userEvent.setup();
    const onStoryTypefaceChange = vi.fn();

    render(
      <PlayableHtmlExportDialog
        open
        metadata={metadataWithTheme}
        storyTypeface="serif"
        resolvedTheme="dark"
        resolvedFromSystem={false}
        filename="Story File.ink"
        onOpenChange={() => {}}
        onExport={vi.fn()}
        onSetFileTheme={vi.fn()}
        onStoryTypefaceChange={onStoryTypefaceChange}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "HTML export typeface" }));
    await user.click(screen.getByRole("option", { name: "Mono" }));

    expect(onStoryTypefaceChange).toHaveBeenCalledWith("mono");
  });
});
