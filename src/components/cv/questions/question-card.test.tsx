import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { readTextDraft } from "@/lib/cv/drafts";
import { makeQuestion, QUESTION_ID } from "@/test/fixtures";

import { answerDraftKey, QuestionCard } from "./question-card";

const question = makeQuestion({ question: "How large was the team you led?" });

function renderCard(props: Partial<Parameters<typeof QuestionCard>[0]> = {}) {
  const onAnswer = vi.fn<(answer: string) => Promise<void>>().mockResolvedValue(undefined);
  const onSkip = vi.fn();
  const user = userEvent.setup();
  const view = render(
    <QuestionCard
      question={question}
      target="Experience · Acme Corp"
      entryRemoved={false}
      locked={false}
      submitting={false}
      skipping={false}
      onAnswer={onAnswer}
      onSkip={onSkip}
      {...props}
    />,
  );
  return { user, onAnswer, onSkip, unmount: view.unmount };
}

const answerBox = () => screen.getByRole("textbox", { name: "How large was the team you led?" });

beforeEach(() => {
  sessionStorage.clear();
});

describe("QuestionCard (open)", () => {
  it("labels the answer box with the question, explains what to write and sends the trimmed answer", async () => {
    const { user, onAnswer } = renderCard();
    expect(screen.getByText("Experience · Acme Corp")).toBeInTheDocument();
    expect(answerBox()).toHaveAccessibleDescription(/full sentence with the facts to use/);

    await user.type(answerBox(), "  Five engineers  ");
    await user.click(screen.getByRole("button", { name: "Update CV" }));

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith("Five engineers"));
  });

  it("requires an answer", async () => {
    const { user, onAnswer } = renderCard();

    await user.click(screen.getByRole("button", { name: "Update CV" }));

    expect(await screen.findByText("Write an answer, or skip the question")).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("shows the API's reason when the answer is refused", async () => {
    const { user, onAnswer } = renderCard();
    onAnswer.mockRejectedValue(
      new ApiError({
        status: 409,
        code: "INVALID_STATE",
        message: "The CV entry this question is about has been removed. Dismiss the question instead.",
      }),
    );

    await user.type(answerBox(), "Five");
    await user.click(screen.getByRole("button", { name: "Update CV" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The CV entry this question is about has been removed.");
  });

  it("shows a local precondition failure (unsaved edits) as is", async () => {
    const { user, onAnswer } = renderCard();
    onAnswer.mockRejectedValue(new Error("Fix the highlighted fields in your CV first."));

    await user.type(answerBox(), "Five");
    await user.click(screen.getByRole("button", { name: "Update CV" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fix the highlighted fields in your CV first.");
  });

  it("shows progress and ignores more taps while pending edits are saved first", async () => {
    let finish: () => void = () => undefined;
    const { user, onAnswer } = renderCard();
    onAnswer.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));

    await user.type(answerBox(), "Five");
    await user.click(screen.getByRole("button", { name: "Update CV" }));
    const button = await screen.findByRole("button", { name: /Update CV/ });
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    await user.click(button);

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(answerBox()).toHaveAttribute("readonly");
    finish();
  });

  it("can be skipped", async () => {
    const { user, onSkip } = renderCard();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("keeps the answer box editable while another answer is applied, but can't send", () => {
    renderCard({ locked: true });
    expect(answerBox()).toBeEnabled();
    expect(screen.getByRole("button", { name: "Update CV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skip" })).toBeDisabled();
  });

  it("keeps a typed answer across a reload and forgets it once sent", async () => {
    const first = renderCard();
    await first.user.type(answerBox(), "Five engineers");
    expect(readTextDraft(answerDraftKey(QUESTION_ID))).toBe("Five engineers");
    first.unmount();

    const second = renderCard();
    expect(answerBox()).toHaveValue("Five engineers");
    await second.user.click(screen.getByRole("button", { name: "Update CV" }));

    await waitFor(() => expect(readTextDraft(answerDraftKey(QUESTION_ID))).toBeNull());
  });
});

describe("QuestionCard (other states)", () => {
  it("shows progress instead of the form while the answer is applied", () => {
    renderCard({ question: { ...question, status: "applying", answer: "Five engineers" } });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Five engineers")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Updating your CV with this answer…");
  });

  it("explains a failed answer and offers it again for editing", async () => {
    const { user, onAnswer } = renderCard({
      question: { ...question, status: "failed", answer: "Five", error: "LLM_UNAVAILABLE" },
    });

    expect(screen.getByText(/couldn't be applied\. The AI service is unavailable right now/)).toBeInTheDocument();
    expect(answerBox()).toHaveValue("Five");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith("Five"));
  });

  it("only offers to skip a question about an entry that was removed", async () => {
    const { user, onSkip } = renderCard({ entryRemoved: true });

    expect(screen.getByText(/entry this question was about has been removed/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
