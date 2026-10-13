import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CvContent } from "@/lib/api/types";
import { makeContent } from "@/test/fixtures";

import { CvEditor } from "./cv-editor";

vi.mock("sonner", () => ({ toast: vi.fn() }));

const formRef: { current: UseFormReturn<CvContent> | null } = { current: null };

function Harness({ content }: { content: CvContent }) {
  const form = useForm<CvContent>({ defaultValues: content });
  useEffect(() => {
    formRef.current = form;
  });
  return (
    <FormProvider {...form}>
      <CvEditor targetRole="Backend Engineer" readOnly={false} updatedSections={new Set()} />
    </FormProvider>
  );
}

const twoPositions = () =>
  makeContent({
    experience: [
      {
        id: "e1",
        company: "Acme",
        title: "Engineer",
        location: "",
        startDate: "",
        endDate: "",
        bullets: [{ id: "b1", text: "Built billing." }],
      },
      { id: "e2", company: "Globex", title: "Developer", location: "", startDate: "", endDate: "", bullets: [] },
    ],
  });

const values = () => formRef.current!.getValues();
const undoLastRemoval = () => {
  const action = vi.mocked(toast).mock.calls.at(-1)?.[1]?.action as { onClick: () => void } | undefined;
  act(() => action?.onClick());
};

beforeEach(() => {
  vi.mocked(toast).mockClear();
});

describe("CvEditor entries", () => {
  it("removes a position, keeps focus on its neighbour and can undo", async () => {
    const user = userEvent.setup();
    render(<Harness content={twoPositions()} />);

    await user.click(screen.getByRole("button", { name: "Remove position Engineer · Acme" }));

    expect(values().experience.map((item) => item.id)).toEqual(["e2"]);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Job title" })).toHaveFocus());
    expect(toast).toHaveBeenCalledWith("Position removed", expect.anything());

    undoLastRemoval();
    expect(values().experience.map((item) => item.id)).toEqual(["e1", "e2"]);
  });

  it("focuses Add when the last entry is removed", async () => {
    const user = userEvent.setup();
    render(<Harness content={makeContent()} />);

    await user.click(screen.getByRole("button", { name: "Remove skill group Languages" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Add skill group" })).toHaveFocus());
  });

  it("adds a position and focuses its first field", async () => {
    const user = userEvent.setup();
    render(<Harness content={makeContent({ experience: [] })} />);
    expect(screen.getByText("No positions yet.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add position" }));

    expect(screen.getByRole("textbox", { name: "Job title" })).toHaveFocus();
    expect(values().experience).toHaveLength(1);
  });

  it("moves an entry and keeps focus on the arrow that was pressed", async () => {
    const user = userEvent.setup();
    render(<Harness content={twoPositions()} />);

    await user.click(screen.getByRole("button", { name: "Move down, position Engineer · Acme" }));

    expect(values().experience.map((item) => item.id)).toEqual(["e2", "e1"]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Move up, position Engineer · Acme" })).toHaveFocus(),
    );
  });
});

describe("CvEditor bullets", () => {
  it("starts a new bullet on Enter, but not while an IME composition is confirmed", async () => {
    const user = userEvent.setup();
    render(<Harness content={makeContent()} />);
    const bullet = screen.getByRole("textbox", { name: "Highlight 1" });

    fireEvent.keyDown(bullet, { key: "Enter", keyCode: 229 });
    expect(values().experience[0]!.bullets).toHaveLength(1);

    await user.click(bullet);
    await user.keyboard("{Enter}");
    expect(values().experience[0]!.bullets).toHaveLength(2);
    expect(screen.getByRole("textbox", { name: "Highlight 2" })).toHaveFocus();
  });

  it("moves focus to the remaining bullet after a removal", async () => {
    const user = userEvent.setup();
    const content = makeContent();
    content.experience[0]!.bullets.push({ id: "b2", text: "Second" });
    render(<Harness content={content} />);

    await user.click(screen.getByRole("button", { name: "Remove highlight 2" }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Highlight 1" })).toHaveFocus());
  });
});

describe("CvEditor skills", () => {
  it("adds skills on Enter or comma, skips duplicates and removes the last one on Backspace", async () => {
    const user = userEvent.setup();
    render(<Harness content={makeContent()} />);
    const input = screen.getByRole("textbox", { name: "Skills in Languages" });

    await user.type(input, "SQL{Enter}Rust, go,");
    expect(values().skills[0]!.items).toEqual(["Go", "SQL", "Rust"]);

    await user.keyboard("{Backspace}");
    expect(values().skills[0]!.items).toEqual(["Go", "SQL"]);

    const group = screen.getByRole("textbox", { name: "Skills in Languages" }).parentElement!;
    await user.click(within(group).getByRole("button", { name: "Remove Go" }));
    expect(values().skills[0]!.items).toEqual(["SQL"]);
  });

  it("does not commit a half-composed skill on the Enter that confirms an IME conversion", () => {
    render(<Harness content={makeContent()} />);
    const input = screen.getByRole("textbox", { name: "Skills in Languages" });

    fireEvent.change(input, { target: { value: "日本" } });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });

    expect(values().skills[0]!.items).toEqual(["Go"]);
  });
});
