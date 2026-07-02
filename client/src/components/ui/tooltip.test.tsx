import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function renderTooltip() {
  render(
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button">Focus me</button>
        </TooltipTrigger>
        <TooltipContent>Helpful context</TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );
}

describe("Tooltip", () => {
  it("does not open from programmatic focus", () => {
    renderTooltip();

    screen.getByRole("button", { name: "Focus me" }).focus();

    expect(screen.queryByText("Helpful context")).not.toBeInTheDocument();
  });

  it("opens from keyboard tab focus", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();

    expect(screen.getAllByText("Helpful context").length).toBeGreaterThan(0);
  });
});
