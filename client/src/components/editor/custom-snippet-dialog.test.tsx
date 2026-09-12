import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CustomSnippetDialog } from "./custom-snippet-dialog";
import type { CustomSnippet } from "@/features/snippets/custom-snippets";

const initialValue: CustomSnippet = {
  id: "custom-1",
  label: "My combo",
  body: "~ combo()",
  aliases: ["combo", "mc"],
  description: "Runs my combo.",
  context: "inline",
  createdAt: 0,
  updatedAt: 0,
};

function noop() {}

describe("CustomSnippetDialog", () => {
  it("submits valid fields with parsed aliases and trimmed strings", async () => {
    const onSubmit = vi.fn();
    render(
      <CustomSnippetDialog
        open
        mode="create"
        onOpenChange={noop}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.type(screen.getByLabelText("Label"), "  My snippet  ");
    await userEvent.type(screen.getByLabelText("Triggers"), " mysnip, ms ,");
    await userEvent.type(screen.getByLabelText("Body"), "~ my_snip()");

    await userEvent.click(screen.getByRole("button", { name: "Save snippet" }));

    expect(onSubmit).toHaveBeenCalledWith({
      label: "My snippet",
      body: "~ my_snip()",
      aliases: ["mysnip", "ms"],
      description: "",
      context: "flow",
    });
  });

  it("shows a validation alert and does not submit when the label is empty", async () => {
    const onSubmit = vi.fn();
    render(
      <CustomSnippetDialog
        open
        mode="create"
        onOpenChange={noop}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.type(screen.getByLabelText("Triggers"), "mysnip");
    await userEvent.type(screen.getByLabelText("Body"), "~ my_snip()");
    await userEvent.click(screen.getByRole("button", { name: "Save snippet" }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("pre-fills fields from initialValue in edit mode", () => {
    render(
      <CustomSnippetDialog
        open
        mode="edit"
        initialValue={initialValue}
        onOpenChange={noop}
        onSubmit={noop}
      />,
    );

    expect(screen.getByLabelText("Label")).toHaveValue("My combo");
    expect(screen.getByLabelText("Triggers")).toHaveValue("combo, mc");
    expect(screen.getByLabelText("Description")).toHaveValue("Runs my combo.");
    expect(screen.getByLabelText("Body")).toHaveValue("~ combo()");
  });

  it("shows the mobile conversion of the typed body in the preview", async () => {
    render(
      <CustomSnippetDialog
        open
        mode="create"
        onOpenChange={noop}
        onSubmit={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText("Body"), {
      target: { value: "~ ${1:my_var} = ${2:0}" },
    });

    expect(screen.getByText("~ [my_var] = [0]")).toBeInTheDocument();
  });
});
