import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";

function renderPopover() {
  const user = userEvent.setup();
  render(
    <div>
      <button type="button">Outside</button>
      <Popover>
        <PopoverTrigger aria-label="Why was this flagged?">?</PopoverTrigger>
        <PopoverContent>Not found in your source.</PopoverContent>
      </Popover>
    </div>,
  );
  return { user, trigger: screen.getByRole("button", { name: "Why was this flagged?" }) };
}

describe("Popover", () => {
  it("toggles on click and exposes its state", async () => {
    const { user, trigger } = renderPopover();
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Why was this flagged?" })).toHaveTextContent(
      "Not found in your source.",
    );

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const { user, trigger } = renderPopover();
    await user.click(trigger);

    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes when clicking outside", async () => {
    const { user, trigger } = renderPopover();
    await user.click(trigger);

    await user.click(screen.getByRole("button", { name: "Outside" }));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
