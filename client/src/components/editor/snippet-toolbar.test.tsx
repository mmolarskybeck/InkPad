import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SnippetToolbar } from "./snippet-toolbar";
import { INK_SNIPPETS } from "@/features/snippets/ink-snippets";
import { SYNTAX_INSERTS } from "@/features/snippets/syntax-inserts";

function renderToolbar(overrides: Partial<Parameters<typeof SnippetToolbar>[0]> = {}) {
  const props = {
    snippets: INK_SNIPPETS,
    onInsertSyntax: vi.fn(),
    onInsertSnippet: vi.fn(),
    onOpenSnippetsPane: vi.fn(),
    ...overrides,
  };
  render(<SnippetToolbar {...props} />);
  return props;
}

describe("SnippetToolbar", () => {
  it("renders every syntax insert button", () => {
    renderToolbar();

    expect(screen.getByRole("toolbar", { name: "Quick inserts" })).toBeInTheDocument();
    for (const item of SYNTAX_INSERTS) {
      expect(screen.getByRole("button", { name: `Insert ${item.label}` })).toBeInTheDocument();
    }
  });

  it("inserts the syntax literal when a syntax button is clicked", async () => {
    const { onInsertSyntax } = renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: "Insert *" }));

    expect(onInsertSyntax).toHaveBeenCalledWith({ text: "* " });
  });

  it("inserts a pinned snippet when its button is clicked", async () => {
    const { onInsertSnippet } = renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: "Insert Choice snippet" }));

    expect(onInsertSnippet).toHaveBeenCalledWith(
      INK_SNIPPETS.find((snippet) => snippet.id === "choice"),
    );
  });

  it("skips pinned snippets that are missing from the library", () => {
    renderToolbar({ snippets: INK_SNIPPETS.filter((snippet) => snippet.id !== "knot") });

    expect(screen.queryByRole("button", { name: "Insert Knot snippet" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Insert Choice snippet" })).toBeInTheDocument();
  });

  it("calls the pane callback", async () => {
    const { onOpenSnippetsPane } = renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: "Open snippets pane" }));
    expect(onOpenSnippetsPane).toHaveBeenCalledOnce();
  });

  it("moves focus with the arrow keys and keeps one tab stop", async () => {
    renderToolbar();

    const first = screen.getByRole("button", { name: "Insert ->" });
    const second = screen.getByRole("button", { name: "Insert *" });
    expect(first).toHaveAttribute("tabindex", "0");
    expect(second).toHaveAttribute("tabindex", "-1");

    first.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(second).toHaveFocus();

    await userEvent.keyboard("{ArrowLeft}");
    expect(first).toHaveFocus();
  });
});
