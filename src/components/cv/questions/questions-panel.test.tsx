import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CvQuestion } from "@/lib/api/types";
import { createQueryClient } from "@/lib/query/query-client";
import { CV_ID, makeContent, makeQuestion, makeReadyCv, QUESTION_ID } from "@/test/fixtures";
import { fetchCall, jsonResponse, mockFetch } from "@/test/http";

import { QuestionsPanel } from "./questions-panel";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const makeCv = (questions: CvQuestion[], busy = false) => makeReadyCv({ questions, busy });

let queryClient: QueryClient;
const wrap = (node: ReactNode) => <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>;

type ToastOptions = { action: { onClick: () => void }; onAutoClose: () => void; onDismiss: () => void };
const lastToastOptions = () => vi.mocked(toast).mock.calls.at(-1)?.[1] as unknown as ToastOptions;

beforeEach(() => {
  queryClient = createQueryClient({ onUnauthorized: vi.fn() });
  vi.mocked(toast).mockClear();
  sessionStorage.clear();
});

describe("QuestionsPanel answering", () => {
  it("saves pending edits first, sends the answer and announces when it was applied", async () => {
    const fetchMock = mockFetch();
    const applying = makeCv([makeQuestion({ status: "applying", answer: "From 800 ms to 200 ms" })], true);
    const order: string[] = [];
    const prepareAnswer = vi.fn(async () => {
      order.push("prepare");
      return null;
    });
    fetchMock.mockImplementation(async () => {
      order.push("post");
      return jsonResponse({ cv: applying }, { status: 202 });
    });
    const user = userEvent.setup();
    const { rerender } = render(wrap(<QuestionsPanel cv={makeCv([makeQuestion()])} prepareAnswer={prepareAnswer} />));

    expect(screen.getByRole("heading", { name: /Claude needs a few details/ })).toBeInTheDocument();
    expect(screen.getByText("Experience · Acme")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: makeQuestion().question }), "From 800 ms to 200 ms");
    await user.click(screen.getByRole("button", { name: "Update CV" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(order).toEqual(["prepare", "post"]);
    const { url, init } = fetchCall(fetchMock);
    expect(url).toBe(`/api/cvs/${CV_ID}/questions/${QUESTION_ID}/answer`);
    expect(JSON.parse(String(init.body))).toEqual({ answer: "From 800 ms to 200 ms" });

    // Polling brings the CV while the job runs, then once it is done.
    rerender(wrap(<QuestionsPanel cv={applying} prepareAnswer={prepareAnswer} />));
    expect(screen.getByText("Updating your CV with this answer…")).toBeInTheDocument();
    rerender(
      wrap(
        <QuestionsPanel
          cv={makeCv([makeQuestion({ status: "applied", answer: "From 800 ms to 200 ms" })])}
          prepareAnswer={prepareAnswer}
        />,
      ),
    );

    expect(screen.getByText("Your answer was applied: Experience · Acme.")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Your answer was applied: Experience · Acme.");
    expect(screen.getByRole("button", { name: "Resolved (1)" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Update CV" })).not.toBeInTheDocument());
    // The card that held focus is gone: focus stays in the panel.
    await waitFor(() => expect(screen.getByRole("heading", { name: /Questions/ })).toHaveFocus());
  });

  it("does not send the answer when the edits can't be saved first", async () => {
    const fetchMock = mockFetch();
    const prepareAnswer = vi.fn().mockResolvedValue("Fix the highlighted fields in your CV first.");
    const user = userEvent.setup();
    render(wrap(<QuestionsPanel cv={makeCv([makeQuestion()])} prepareAnswer={prepareAnswer} />));

    await user.type(screen.getByRole("textbox"), "Five");
    await user.click(screen.getByRole("button", { name: "Update CV" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fix the highlighted fields in your CV first.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("announces an answer that couldn't be applied", () => {
    mockFetch();
    const prepareAnswer = vi.fn();
    const { rerender } = render(
      wrap(
        <QuestionsPanel
          cv={makeCv([makeQuestion({ status: "applying", answer: "x" })], true)}
          prepareAnswer={prepareAnswer}
        />,
      ),
    );

    rerender(
      wrap(
        <QuestionsPanel
          cv={makeCv([makeQuestion({ status: "failed", answer: "x", error: "LLM_UNAVAILABLE" })])}
          prepareAnswer={prepareAnswer}
        />,
      ),
    );

    expect(toast.error).toHaveBeenCalledWith("Your answer couldn't be applied: Experience · Acme.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("lets the user draft answers while the CV is busy, but not send them", () => {
    mockFetch();
    render(wrap(<QuestionsPanel cv={makeCv([makeQuestion()], true)} prepareAnswer={vi.fn()} />));

    expect(screen.getByRole("textbox")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Update CV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skip" })).toBeDisabled();
  });

  it("only offers to skip a question about an entry the user removed", () => {
    mockFetch();
    const cv = makeReadyCv({ questions: [makeQuestion()], content: makeContent({ experience: [] }) });
    render(wrap(<QuestionsPanel cv={cv} prepareAnswer={vi.fn()} />));

    expect(screen.getByText(/entry this question was about has been removed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update CV" })).not.toBeInTheDocument();
  });
});

describe("QuestionsPanel resolved questions", () => {
  it("lists applied and skipped questions under a collapsed Resolved section", async () => {
    mockFetch();
    const cv = makeCv([
      makeQuestion({ id: "q1", status: "applied", answer: "Five engineers" }),
      makeQuestion({ id: "q2", status: "dismissed", question: "Which database did you use?" }),
    ]);
    render(wrap(<QuestionsPanel cv={cv} prepareAnswer={vi.fn()} />));

    expect(screen.getByRole("heading", { name: "Questions" })).toBeInTheDocument();
    expect(screen.getByText("All questions are answered or skipped.")).toBeInTheDocument();
    expect(screen.getByText("Which database did you use?")).not.toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Resolved (2)" }));

    expect(screen.getByText("Applied")).toBeVisible();
    expect(screen.getByText("Skipped")).toBeVisible();
    expect(screen.getByText("Five engineers")).toBeVisible();
  });

  it("is hidden on desktop when Claude asked nothing, and explains it on the phone tab", () => {
    mockFetch();
    const { container, rerender } = render(wrap(<QuestionsPanel cv={makeCv([])} prepareAnswer={vi.fn()} />));
    expect(container).toBeEmptyDOMElement();

    rerender(wrap(<QuestionsPanel cv={makeCv([])} prepareAnswer={vi.fn()} showEmptyState />));
    expect(screen.getByText("Claude had everything it needed from your source.")).toBeInTheDocument();
  });
});

describe("QuestionsPanel skipping", () => {
  it("hides the question at once but only dismisses it once the Undo toast is gone", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse({ cv: makeCv([makeQuestion({ status: "dismissed" })]) }));
    const user = userEvent.setup();
    render(wrap(<QuestionsPanel cv={makeCv([makeQuestion()])} prepareAnswer={vi.fn()} />));

    await user.click(screen.getByRole("button", { name: "Skip" }));

    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    expect(toast).toHaveBeenCalledWith("Question skipped", expect.objectContaining({ duration: expect.any(Number) }));
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => lastToastOptions().onAutoClose());
    act(() => lastToastOptions().onDismiss());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchCall(fetchMock).url).toBe(`/api/cvs/${CV_ID}/questions/${QUESTION_ID}/dismiss`);
  });

  it("brings the question back on Undo without telling the server", async () => {
    const fetchMock = mockFetch();
    const user = userEvent.setup();
    render(wrap(<QuestionsPanel cv={makeCv([makeQuestion()])} prepareAnswer={vi.fn()} />));

    await user.type(screen.getByRole("textbox"), "Half-written");
    await user.click(screen.getByRole("button", { name: "Skip" }));
    act(() => lastToastOptions().action.onClick());
    act(() => lastToastOptions().onDismiss());

    expect(await screen.findByRole("textbox")).toHaveValue("Half-written");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
