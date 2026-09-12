import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SnippetsPanel } from "./snippets-panel";
import type { InkSnippet } from "@/features/snippets/ink-snippets";
import type { CustomSnippet } from "@/features/snippets/custom-snippets";

const knotSnippet: InkSnippet = {
  id: "knot",
  label: "Knot",
  category: "Structure",
  context: "top-level",
  aliases: ["knot", "==="],
  desktopSnippet: "=== ${1:knot_name} ===\n",
  mobileInsert: "=== [knot_name] ===\n",
  description: "A main story section for branching content.",
};

const divertSnippet: InkSnippet = {
  id: "divert",
  label: "Divert",
  category: "Flow",
  context: "flow",
  aliases: ["divert", "->"],
  desktopSnippet: "-> ${1:target_knot}",
  mobileInsert: "-> [target_knot]",
  description: "Jump to another knot or stitch.",
};

const choiceSnippet: InkSnippet = {
  id: "choice",
  label: "Choice",
  category: "Choices",
  context: "flow",
  aliases: ["choice", "*"],
  desktopSnippet: "* ${1:Choice text}\n",
  mobileInsert: "* [Choice text]\n",
  description: "A choice the player can pick once.",
};

const customSnippet: CustomSnippet = {
  id: "custom-1",
  label: "My combo",
  body: "~ combo()",
  aliases: ["combo"],
  description: "Runs my combo.",
  context: "flow",
  createdAt: 0,
  updatedAt: 0,
};

const customInkSnippet: InkSnippet = {
  id: "custom-1",
  label: "My combo",
  category: "Custom",
  context: "flow",
  aliases: ["combo"],
  desktopSnippet: "~ combo()",
  mobileInsert: "~ combo()",
  description: "Runs my combo.",
  source: "custom",
};

const allSnippets = [knotSnippet, divertSnippet, choiceSnippet, customInkSnippet];

function noop() {}

describe("SnippetsPanel", () => {
  it("renders category headings", () => {
    render(
      <SnippetsPanel
        snippets={allSnippets}
        customSnippets={[customSnippet]}
        onInsertSnippet={noop}
        onCreateCustomSnippet={noop}
        onEditCustomSnippet={noop}
        onDeleteCustomSnippet={noop}
      />,
    );

    expect(screen.getByText("Structure")).toBeInTheDocument();
    expect(screen.getByText("Flow")).toBeInTheDocument();
    expect(screen.getByText("Choices")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("calls onInsertSnippet with the clicked snippet", async () => {
    const onInsertSnippet = vi.fn();
    render(
      <SnippetsPanel
        snippets={allSnippets}
        customSnippets={[customSnippet]}
        onInsertSnippet={onInsertSnippet}
        onCreateCustomSnippet={noop}
        onEditCustomSnippet={noop}
        onDeleteCustomSnippet={noop}
      />,
    );

    await userEvent.click(screen.getByText("Knot"));
    expect(onInsertSnippet).toHaveBeenCalledWith(knotSnippet);
  });

  it("filters with a query and hides group headings", async () => {
    render(
      <SnippetsPanel
        snippets={allSnippets}
        customSnippets={[customSnippet]}
        onInsertSnippet={noop}
        onCreateCustomSnippet={noop}
        onEditCustomSnippet={noop}
        onDeleteCustomSnippet={noop}
      />,
    );

    await userEvent.type(screen.getByLabelText("Search snippets"), "divert");

    expect(screen.getByText("Divert")).toBeInTheDocument();
    expect(screen.queryByText("Knot")).not.toBeInTheDocument();
    expect(screen.queryByText("Flow")).not.toBeInTheDocument();
  });

  it("shows edit and delete buttons for custom rows and calls their handlers", async () => {
    const onEditCustomSnippet = vi.fn();
    const onDeleteCustomSnippet = vi.fn();
    render(
      <SnippetsPanel
        snippets={allSnippets}
        customSnippets={[customSnippet]}
        onInsertSnippet={noop}
        onCreateCustomSnippet={noop}
        onEditCustomSnippet={onEditCustomSnippet}
        onDeleteCustomSnippet={onDeleteCustomSnippet}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit My combo" }));
    expect(onEditCustomSnippet).toHaveBeenCalledWith(customSnippet);

    await userEvent.click(screen.getByRole("button", { name: "Delete My combo" }));
    expect(onDeleteCustomSnippet).toHaveBeenCalledWith(customSnippet);
  });

  it("calls onCreateCustomSnippet when New is clicked", async () => {
    const onCreateCustomSnippet = vi.fn();
    render(
      <SnippetsPanel
        snippets={allSnippets}
        customSnippets={[customSnippet]}
        showHeader
        onInsertSnippet={noop}
        onCreateCustomSnippet={onCreateCustomSnippet}
        onEditCustomSnippet={noop}
        onDeleteCustomSnippet={noop}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "New custom snippet" }));
    expect(onCreateCustomSnippet).toHaveBeenCalledOnce();
  });

  it("collapses a group and hides its rows", async () => {
    render(
      <SnippetsPanel
        snippets={allSnippets}
        customSnippets={[customSnippet]}
        onInsertSnippet={noop}
        onCreateCustomSnippet={noop}
        onEditCustomSnippet={noop}
        onDeleteCustomSnippet={noop}
      />,
    );

    expect(screen.getByText("Knot")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Structure" }));
    expect(screen.queryByText("Knot")).not.toBeInTheDocument();
  });
});
