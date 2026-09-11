import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StoryPreview } from "./story-preview";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { MetadataField, StoryMetadata } from "@/lib/tag-interpreter";
import type { StoryRuntimeState } from "@/types/story-runtime";

const runtimeState: StoryRuntimeState = {
  transcript: [
    {
      id: "passage-1",
      type: "passage",
      passage: { id: "passage-1", text: "Opening passage", tags: ["opening"] },
    },
    {
      id: "choice-1",
      type: "choice",
      choice: { index: 0, text: "Earlier choice", tags: [] },
    },
    {
      id: "passage-2",
      type: "passage",
      passage: { id: "passage-2", text: "Current passage", tags: [] },
    },
  ],
  currentPassage: { id: "passage-2", text: "Current passage", tags: [] },
  choices: [{ index: 0, text: "Continue", tags: [] }],
  canContinue: false,
  isComplete: false,
  canStepBack: true,
};

const metadata: StoryMetadata = {
  title: "The Moonlit Garden",
  author: "Marina",
  theme: "sepia",
  sourceFields: new Set<MetadataField>(["title", "author", "theme"]),
};

afterEach(() => {
  vi.useRealTimers();
});

function renderWithTooltips(component: React.ReactNode) {
  return render(<TooltipProvider>{component}</TooltipProvider>);
}

describe("StoryPreview", () => {
  it("defaults to transcript mode", () => {
    renderWithTooltips(
      <StoryPreview
        runtimeState={runtimeState}
        isRunning
        onMakeChoice={() => {}}
      />
    );

    expect(screen.getByText("Opening passage")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Scene" })).not.toBeInTheDocument();
  });

  it("uses the project-controlled preview mode", () => {
    renderWithTooltips(
      <StoryPreview
        runtimeState={runtimeState}
        isRunning
        previewMode="scene"
        onMakeChoice={() => {}}
      />
    );

    expect(screen.queryByText("Opening passage")).not.toBeInTheDocument();
    expect(screen.getByText("Current passage")).toBeInTheDocument();
  });

  it("exposes Back only when a choice snapshot exists", async () => {
    const onStepBack = vi.fn();
    const { rerender } = renderWithTooltips(
      <StoryPreview
        runtimeState={{ ...runtimeState, canStepBack: false }}
        isRunning
        onMakeChoice={() => {}}
        onStepBack={onStepBack}
      />
    );

    expect(screen.getByRole("button", { name: "Back to previous choice" })).toBeDisabled();
    rerender(
      <TooltipProvider>
        <StoryPreview
          runtimeState={runtimeState}
          isRunning
          onMakeChoice={() => {}}
          onStepBack={onStepBack}
        />
      </TooltipProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "Back to previous choice" }));
    expect(onStepBack).toHaveBeenCalledOnce();
  });

  it("offers restart alongside Back in the preview header", async () => {
    const onRestart = vi.fn();
    renderWithTooltips(
      <StoryPreview
        runtimeState={runtimeState}
        isRunning
        onMakeChoice={() => {}}
        onRestart={onRestart}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Restart story from beginning" }));
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it("renders a restore notice with the failure detail and dismiss action", async () => {
    const onDismissRestoreNotice = vi.fn();
    renderWithTooltips(
      <StoryPreview
        runtimeState={runtimeState}
        isRunning
        restoreNotice="choice-changed"
        onMakeChoice={() => {}}
        onDismissRestoreNotice={onDismissRestoreNotice}
      />
    );

    const restoreNotice = screen.getByTestId("restore-notice");
    expect(restoreNotice).toHaveAttribute("role", "status");
    expect(restoreNotice).toHaveTextContent("Preview updated — this choice path changed.");
    expect(restoreNotice).toHaveTextContent("The choices at this point changed. Pick one to continue.");

    await userEvent.click(screen.getByRole("button", { name: "Dismiss notice" }));
    expect(onDismissRestoreNotice).toHaveBeenCalledOnce();
  });

  it("renders the restore notice in scene preview mode", () => {
    renderWithTooltips(
      <StoryPreview
        runtimeState={runtimeState}
        isRunning
        previewMode="scene"
        restoreNotice="ambiguous-text"
        onMakeChoice={() => {}}
      />
    );

    expect(screen.getByTestId("restore-notice")).toHaveTextContent(
      "The choice you picked moved, and more than one choice here has the same text, so InkPad stopped rather than guess."
    );
  });

  it("does not render a restore notice when there is nothing to report", () => {
    renderWithTooltips(
      <StoryPreview
        runtimeState={runtimeState}
        isRunning
        restoreNotice={null}
        onMakeChoice={() => {}}
      />
    );

    expect(screen.queryByTestId("restore-notice")).not.toBeInTheDocument();
  });

  it("keeps the last successful run and points at the problem when compilation fails", async () => {
    const onRun = vi.fn();
    const onViewProblems = vi.fn();
    renderWithTooltips(
      <StoryPreview
        runtimeState={runtimeState}
        isRunning
        hasErrors
        errorCount={1}
        onMakeChoice={() => {}}
        onRun={onRun}
        onViewProblems={onViewProblems}
      />
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("1 error");
    expect(status).not.toHaveTextContent("Showing last successful run");
    expect(screen.queryByRole("button", { name: "Re-run to update preview" })).not.toBeInTheDocument();
    await userEvent.click(status);
    expect(onViewProblems).toHaveBeenCalledOnce();
    expect(onRun).not.toHaveBeenCalled();
  });

  it("makes View problems the primary action when no preview has ever run", async () => {
    const onViewProblems = vi.fn();
    renderWithTooltips(
      <StoryPreview
        runtimeState={null}
        isRunning={false}
        hasErrors
        errorCount={2}
        onMakeChoice={() => {}}
        onRun={() => {}}
        onViewProblems={onViewProblems}
      />
    );

    expect(screen.getByText("Fix errors to preview")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Run story/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View problems" }));
    expect(onViewProblems).toHaveBeenCalledOnce();
  });

  it("does not render status dots in the preview header", () => {
    renderWithTooltips(
      <StoryPreview
        runtimeState={runtimeState}
        isRunning
        onMakeChoice={() => {}}
      />
    );

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.queryByLabelText("Story is running")).not.toBeInTheDocument();
  });

  it("renders the story masthead in the scrollable preview", () => {
    const { container } = renderWithTooltips(
      <StoryPreview
        runtimeState={runtimeState}
        isRunning
        metadata={metadata}
        onMakeChoice={() => {}}
      />
    );

    expect(screen.getByRole("heading", { name: "The Moonlit Garden" })).toBeInTheDocument();
    expect(screen.getByText("by Marina")).toBeInTheDocument();
    expect(container.firstElementChild).not.toHaveClass("story-preview-theme-sepia");
  });

  it("applies the selected browser preview theme", () => {
    const { container } = renderWithTooltips(
      <StoryPreview
        runtimeState={runtimeState}
        isRunning
        metadata={{ ...metadata, theme: "high-contrast" }}
        previewTheme="high-contrast"
        onMakeChoice={() => {}}
      />
    );

    expect(container.firstElementChild).toHaveClass("story-preview-theme-high-contrast");
  });

  it("keeps the choice confirmation delay", () => {
    vi.useFakeTimers();
    const onMakeChoice = vi.fn();
    renderWithTooltips(
      <StoryPreview
        runtimeState={runtimeState}
        isRunning
        onMakeChoice={onMakeChoice}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onMakeChoice).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(160));
    expect(onMakeChoice).toHaveBeenCalledWith(0);
  });

  it("pauses following when scrolled up and offers a jump to latest control", () => {
    renderWithTooltips(
      <StoryPreview
        runtimeState={runtimeState}
        isRunning
        onMakeChoice={() => {}}
      />
    );
    const scroller = screen.getByText("Opening passage").closest(".overflow-auto") as HTMLDivElement;
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 300 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    });

    fireEvent.scroll(scroller);
    expect(screen.getByRole("button", { name: /jump to latest/i })).toBeInTheDocument();
  });
});
