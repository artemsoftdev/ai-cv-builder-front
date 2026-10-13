import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { TitleEditor } from "./title-editor";

function renderTitle({ disabled = false } = {}) {
  const onSave = vi.fn();
  render(<TitleEditor title="Backend CV" onSave={onSave} disabled={disabled} headingRef={createRef()} />);
  return { onSave, user: userEvent.setup(), rename: () => screen.getByRole("button", { name: "Backend CV, rename" }) };
}

describe("TitleEditor", () => {
  it("renames on Enter with the trimmed title and returns focus to the heading button", async () => {
    const { onSave, user, rename } = renderTitle();

    await user.click(rename());
    const input = screen.getByRole("textbox", { name: "CV title" });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, "  Staff Engineer CV  {Enter}");

    expect(onSave).toHaveBeenCalledExactlyOnceWith("Staff Engineer CV");
    await waitFor(() => expect(rename()).toHaveFocus());
  });

  it("cancels on Escape", async () => {
    const { onSave, user, rename } = renderTitle();

    await user.click(rename());
    await user.type(screen.getByRole("textbox", { name: "CV title" }), " draft{Escape}");

    expect(onSave).not.toHaveBeenCalled();
    expect(rename()).toBeInTheDocument();
  });

  it("explains an empty title on Enter, and drops it when the field is left", async () => {
    const { onSave, user, rename } = renderTitle();

    await user.click(rename());
    await user.clear(screen.getByRole("textbox", { name: "CV title" }));
    await user.keyboard("{Enter}");
    expect(screen.getByText("Give your CV a title")).toBeInTheDocument();

    await user.tab();
    expect(onSave).not.toHaveBeenCalled();
    expect(rename()).toBeInTheDocument();
  });

  it("can't be renamed while Claude works on the CV", () => {
    const { rename } = renderTitle({ disabled: true });
    expect(rename()).toBeDisabled();
  });
});
