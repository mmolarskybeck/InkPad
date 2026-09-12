import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InsertPalette, type InsertPaletteProps } from "./insert-palette";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { InkSnippet } from "@/features/snippets/ink-snippets";

// Labels are deliberately distinct from the SYNTAX_LABELS values ("Divert",
// "Choice", "Knot", etc.) so text queries in these tests are unambiguous.
const structureSnippet: InkSnippet = {
  id: "function",
  label: "New Function",
  category: "Structure",
  context: "top-level",
  aliases: ["function", "func"],
  desktopSnippet: "=== function ${1:name}() ===\n",
  mobileInsert: "=== function [name]() ===\n",
  description: "A reusable function that returns a value.",
};

const flowSnippet: InkSnippet = {
  id: "goto",
  label: "Jump ahead",
  category: "Flow",
  context: "flow",
  aliases: ["goto", "jump"],
  desktopSnippet: "-> ${1:target_knot}",
  mobileInsert: "-> [target_knot]",
  description: "Jump to another knot or stitch.",
};

const choicesSnippet: InkSnippet = {
  id: "add-choice",
  label: "Add option",
  category: "Choices",
  context: "flow",
  aliases: ["option"],
  desktopSnippet: "* ${1:Choice text}\n",
  mobileInsert: "* [Choice text]\n",
  description: "A choice the player can pick once.",
};

const allSnippets = [structureSnippet, flowSnippet, choicesSnippet];

const STORAGE_KEY = "inkpad:insert-palette-category";

function TestHarness(props: Partial<InsertPaletteProps>) {
  const [open, setOpen] = useState(props.open ?? true);
  return (
    <InsertPalette
      snippets={allSnippets}
      onInsertSyntax={vi.fn()}
      onInsertSnippet={vi.fn()}
      {...props}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        props.onOpenChange?.(next);
      }}
    />
  );
}

function renderPalette(overrides: Partial<InsertPaletteProps> = {}) {
  const onInsertSyntax = overrides.onInsertSyntax ?? vi.fn();
  const onInsertSnippet = overrides.onInsertSnippet ?? vi.fn();
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  render(
    <TooltipProvider>
      <TestHarness
        {...overrides}
        onInsertSyntax={onInsertSyntax}
        onInsertSnippet={onInsertSnippet}
        onOpenChange={onOpenChange}
      />
    </TooltipProvider>,
  );
  return { onInsertSyntax, onInsertSnippet, onOpenChange };
}

function input() {
  return screen.getByPlaceholderText("Search snippets and syntax…");
}

function rail() {
  return screen.getByLabelText("Categories");
}

function railRow(name: RegExp) {
  return within(rail()).getByRole("button", { name });
}

function selectedCategory() {
  return within(rail())
    .getAllByRole("button")
    .find((button) => button.getAttribute("aria-current") === "true");
}

// Node 22 exposes a global `localStorage` that throws unless the runtime was
// started with `--localstorage-file`, and it shadows jsdom's implementation.
// Swap in a plain in-memory store so the palette's persistence is observable.
let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  const stub: Pick<Storage, "getItem" | "setItem" | "removeItem" | "clear"> = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: stub,
  });
});

describe("InsertPalette", () => {
  it("opens on the Syntax category with a counted rail", () => {
    renderPalette();

    expect(selectedCategory()).toHaveTextContent("Syntax");
    expect(railRow(/^Structure/)).toHaveTextContent("1");
    expect(railRow(/^Flow/)).toBeInTheDocument();
    expect(railRow(/^Choices/)).toBeInTheDocument();

    // The right column lists the selected category only.
    expect(screen.getByText("Divert")).toBeInTheDocument();
    expect(screen.queryByText("New Function")).not.toBeInTheDocument();
  });

  it("switches category when a rail row is clicked", async () => {
    renderPalette();

    await userEvent.click(railRow(/^Structure/));

    expect(await screen.findByText("New Function")).toBeInTheDocument();
    expect(selectedCategory()).toHaveTextContent("Structure");
    expect(screen.queryByText("Divert")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("Structure");
  });

  it("cycles categories with ArrowRight and wraps with ArrowLeft", async () => {
    renderPalette();
    await userEvent.click(input());

    await userEvent.keyboard("{ArrowRight}");
    expect(selectedCategory()).toHaveTextContent("Structure");
    expect(await screen.findByText("New Function")).toBeInTheDocument();

    await userEvent.keyboard("{ArrowRight}");
    expect(selectedCategory()).toHaveTextContent("Flow");

    // Back to Structure, then wrap past Syntax to the last rail row.
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(selectedCategory()).toHaveTextContent("Choices");
    expect(await screen.findByText("Add option")).toBeInTheDocument();
  });

  it("flattens into grouped results while searching and restores the rail when cleared", async () => {
    renderPalette();

    await userEvent.click(railRow(/^Structure/));
    await userEvent.type(input(), "jump");

    expect(screen.queryByLabelText("Categories")).not.toBeInTheDocument();
    expect(await screen.findByText("Jump ahead")).toBeInTheDocument();
    expect(screen.queryByText("New Function")).not.toBeInTheDocument();
    expect(screen.queryByText("Add option")).not.toBeInTheDocument();
    // Group headings survive the flattening.
    expect(screen.getByText("Flow")).toBeInTheDocument();

    await userEvent.clear(input());

    expect(await screen.findByText("New Function")).toBeInTheDocument();
    expect(selectedCategory()).toHaveTextContent("Structure");
  });

  it("shows an empty message for a query with no matches", async () => {
    renderPalette();

    await userEvent.type(input(), "zzzz");

    expect(await screen.findByText("No matches for “zzzz”.")).toBeInTheDocument();
  });

  it("inserts the highlighted snippet on Enter and closes", async () => {
    const { onInsertSnippet, onOpenChange } = renderPalette();

    await userEvent.type(input(), "jump");
    expect(await screen.findByText("Jump ahead")).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");

    expect(onInsertSnippet).toHaveBeenCalledWith(flowSnippet);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("inserts a snippet when its row is clicked", async () => {
    const { onInsertSnippet } = renderPalette();

    await userEvent.click(railRow(/^Choices/));
    await userEvent.click(await screen.findByText("Add option"));

    expect(onInsertSnippet).toHaveBeenCalledWith(choicesSnippet);
  });

  it("inserts syntax from the Syntax category", async () => {
    const { onInsertSyntax } = renderPalette();

    await userEvent.click(screen.getByText("Divert"));

    expect(onInsertSyntax).toHaveBeenCalledWith({ text: "-> " });
  });

  it("shows the highlighted row's description in the footer", async () => {
    renderPalette();
    await userEvent.click(input());

    expect(screen.getByText("Inserts `-> `")).toBeInTheDocument();

    await userEvent.click(railRow(/^Flow/));
    expect(await screen.findByText(flowSnippet.description)).toBeInTheDocument();
  });

  it("restores the stored category on open", () => {
    localStorage.setItem(STORAGE_KEY, "Flow");
    renderPalette();

    expect(selectedCategory()).toHaveTextContent("Flow");
    expect(screen.getByText("Jump ahead")).toBeInTheDocument();
  });

  it("falls back to Syntax when the stored category no longer exists", () => {
    localStorage.setItem(STORAGE_KEY, "Nonexistent");
    renderPalette();

    expect(selectedCategory()).toHaveTextContent("Syntax");
    expect(screen.getByText("Divert")).toBeInTheDocument();
  });

  it("toggles with Cmd+Shift+I", async () => {
    renderPalette({ open: false });

    expect(screen.queryByPlaceholderText("Search snippets and syntax…")).not.toBeInTheDocument();

    await userEvent.keyboard("{Meta>}{Shift>}i{/Shift}{/Meta}");
    expect(await screen.findByPlaceholderText("Search snippets and syntax…")).toBeInTheDocument();

    // The shortcut is ignored while a plain form field has focus, so the
    // closing press comes from outside the palette input.
    input().blur();
    await userEvent.keyboard("{Meta>}{Shift>}i{/Shift}{/Meta}");
    expect(screen.queryByPlaceholderText("Search snippets and syntax…")).not.toBeInTheDocument();
  });
});
