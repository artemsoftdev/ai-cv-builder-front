import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { CvContent } from "@/lib/api/types";
import { makeContent } from "@/test/fixtures";

import { EditorProvider } from "./editor-context";
import { SectionCard } from "./section-card";

const formRef: { current: UseFormReturn<CvContent> | null } = { current: null };

function Harness({ readOnly = false }: { readOnly?: boolean }) {
  const form = useForm<CvContent>({ defaultValues: makeContent() });
  useEffect(() => {
    formRef.current = form;
  });
  return (
    <FormProvider {...form}>
      <EditorProvider readOnly={readOnly}>
        <SectionCard section="summary" title="Summary" icon={null}>
          <textarea aria-label="Professional summary" {...form.register("summary")} />
        </SectionCard>
      </EditorProvider>
    </FormProvider>
  );
}

describe("SectionCard", () => {
  it("collapses and expands its body", async () => {
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: "Summary" });

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.getByRole("textbox", { name: "Professional summary" })).toBeVisible();
  });

  it("opens by itself when one of its fields gets an error, so it can be fixed", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Summary" }));

    act(() => formRef.current?.setError("summary", { type: "server", message: "Too long" }));

    expect(screen.getByRole("button", { name: "Summary" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "Professional summary" })).toBeVisible();
  });

  it("disables its fields while a background job rewrites the CV, but not the toggle", () => {
    render(<Harness readOnly />);
    expect(screen.getByRole("textbox", { name: "Professional summary" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Summary" })).toBeEnabled();
  });
});
