import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CvQuestion } from "@/lib/api/types";
import type { ReadyCv } from "@/lib/cv/ready-cv";
import { createQueryClient } from "@/lib/query/query-client";
import { fetchCall, jsonResponse, mockFetch } from "@/test/http";

import { QuestionsPanel } from "./questions-panel";

const CV_ID = "11111111-1111-4111-8111-111111111111";

const question = (overrides: Partial<CvQuestion> = {}): CvQuestion => ({
  id: "22222222-2222-4222-8222-222222222222",
  section: "experience",
  itemId: "e1",
  question: "By how much did you improve API latency?",
  answer: null,
  status: "open",
  error: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeCv = (questions: CvQuestion[], busy = false): ReadyCv => ({
  id: CV_ID,
  title: "Backend",
  targetRole: "Senior Backend Engineer",
  sourceType: "text",
  sourceFilename: null,
  status: "ready",
  stage: "done",
  error: null,
  content: {
    contact: { fullName: "Jane", headline: "", email: "", phone: "", location: "", links: [] },
    summary: "",
    experience: [{ id: "e1", company: "Acme", title: "Engineer", location: "", startDate: "", endDate: "", bullets: [] }],
    education: [],
    skills: [],
  },
  review: null,
  questions,
  version: 3,
  busy,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

let queryClient: QueryClient;
const wrap = (node: ReactNode) => <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>;

beforeEach(() => {
  queryClient = createQueryClient({ onUnauthorized: vi.fn() });
});

describe("QuestionsPanel", () => {
  it("saves pending edits first, sends the answer and announces when it was applied", async () => {
    const fetchMock = mockFetch();
    const applying = makeCv([question({ status: "applying", answer: "From 800 ms to 200 ms" })], true);
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
    const { rerender } = render(wrap(<QuestionsPanel cv={makeCv([question()])} prepareAnswer={prepareAnswer} />));

    expect(screen.getByRole("heading", { name: /Claude needs a few details/ })).toBeInTheDocument();
    expect(screen.getByText("Experience · Acme")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: question().question }), "From 800 ms to 200 ms");
    await user.click(screen.getByRole("button", { name: "Update CV" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(order).toEqual(["prepare", "post"]);
    const { url, init } = fetchCall(fetchMock);
    expect(url).toBe(`/api/cvs/${CV_ID}/questions/${question().id}/answer`);
    expect(JSON.parse(String(init.body))).toEqual({ answer: "From 800 ms to 200 ms" });

    // Polling brings the CV while the job runs, then once it is done.
    rerender(wrap(<QuestionsPanel cv={applying} prepareAnswer={prepareAnswer} />));
    expect(screen.getByText("Updating your CV with this answer…")).toBeInTheDocument();
    rerender(
      wrap(<QuestionsPanel cv={makeCv([question({ status: "applied", answer: "From 800 ms to 200 ms" })])} prepareAnswer={prepareAnswer} />),
    );

    expect(screen.getByText("Your answer was applied: Experience · Acme.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolved (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update CV" })).not.toBeInTheDocument();
  });

  it("does not send the answer when the edits can't be saved first", async () => {
    const fetchMock = mockFetch();
    const prepareAnswer = vi.fn().mockResolvedValue("Fix the highlighted fields in your CV first.");
    const user = userEvent.setup();
    render(wrap(<QuestionsPanel cv={makeCv([question()])} prepareAnswer={prepareAnswer} />));

    await user.type(screen.getByRole("textbox"), "Five");
    await user.click(screen.getByRole("button", { name: "Update CV" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fix the highlighted fields in your CV first.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("locks every answer box while the CV is busy", () => {
    mockFetch();
    render(wrap(<QuestionsPanel cv={makeCv([question()], true)} prepareAnswer={vi.fn()} />));

    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skip" })).toBeDisabled();
  });
});
