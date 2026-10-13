import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { CvQuestion } from "@/lib/api/types";

import { QuestionCard } from "./question-card";

const question = (overrides: Partial<CvQuestion> = {}): CvQuestion => ({
  id: "q1",
  section: "experience",
  itemId: "e1",
  question: "How large was the team you led?",
  answer: null,
  status: "open",
  error: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

function renderCard(props: Partial<Parameters<typeof QuestionCard>[0]> = {}) {
  const onAnswer = vi.fn<(answer: string) => Promise<void>>().mockResolvedValue(undefined);
  const onSkip = vi.fn();
  const user = userEvent.setup();
  render(
    <QuestionCard
      question={question()}
      target="Experience · Acme Corp"
      locked={false}
      submitting={false}
      skipping={false}
      onAnswer={onAnswer}
      onSkip={onSkip}
      {...props}
    />,
  );
  return { user, onAnswer, onSkip };
}

describe("QuestionCard (open)", () => {
  it("labels the answer box with the question and sends the trimmed answer", async () => {
    const { user, onAnswer } = renderCard();
    expect(screen.getByText("Experience · Acme Corp")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "How large was the team you led?" }), "  Five engineers  ");
    await user.click(screen.getByRole("button", { name: "Update CV" }));

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith("Five engineers"));
  });

  it("requires an answer", async () => {
    const { user, onAnswer } = renderCard();

    await user.click(screen.getByRole("button", { name: "Update CV" }));

    expect(await screen.findByText("Write an answer, or skip the question")).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("shows why the answer was rejected", async () => {
    const { user, onAnswer } = renderCard();
    onAnswer.mockRejectedValue(new ApiError({ status: 409, code: "INVALID_STATE", message: "Not open" }));

    await user.type(screen.getByRole("textbox"), "Five");
    await user.click(screen.getByRole("button", { name: "Update CV" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This question was already answered or skipped.");
  });

  it("shows a local precondition failure (unsaved edits) as is", async () => {
    const { user, onAnswer } = renderCard();
    onAnswer.mockRejectedValue(new Error("Fix the highlighted fields in your CV first."));

    await user.type(screen.getByRole("textbox"), "Five");
    await user.click(screen.getByRole("button", { name: "Update CV" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fix the highlighted fields in your CV first.");
  });

  it("can be skipped", async () => {
    const { user, onSkip } = renderCard();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("is disabled while another answer is being applied", () => {
    renderCard({ locked: true });
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Update CV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skip" })).toBeDisabled();
  });
});

describe("QuestionCard (other states)", () => {
  it("shows progress instead of the form while the answer is applied", () => {
    renderCard({ question: question({ status: "applying", answer: "Five engineers" }) });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Five engineers")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Updating your CV with this answer…");
  });

  it("explains a failed answer and offers it again for editing", async () => {
    const { user, onAnswer } = renderCard({
      question: question({ status: "failed", answer: "Five", error: "LLM_UNAVAILABLE" }),
    });

    expect(screen.getByText(/couldn't be applied\. The AI service is unavailable right now/)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Five");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith("Five"));
  });
});
