"use client";

import { Check, ChevronDown, MessageCircleQuestion } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/api/error-messages";
import type { CvContent, CvQuestion } from "@/lib/api/types";
import { writeTextDraft } from "@/lib/cv/drafts";
import type { ReadyCv } from "@/lib/cv/ready-cv";
import { useAnswerQuestion, useDismissQuestion } from "@/lib/query/cv-hooks";
import { cn } from "@/lib/utils/cn";

import { answerDraftKey, QuestionCard } from "./question-card";
import { describeQuestionTarget, isActiveQuestion, isEntryRemoved, needsAnswer } from "./question-target";

type QuestionsPanelProps = {
  cv: ReadyCv;
  prepareAnswer: () => Promise<string | null>;
  showEmptyState?: boolean;
  className?: string;
};

type Announcement = { id: number; text: string; tone: "success" | "error" };

// Skipping can't be undone on the server, so it is only sent once the Undo toast has gone.
const SKIP_UNDO_MS = 6_000;

function describeTransition(
  previous: CvQuestion[],
  next: CvQuestion[],
  content: CvContent,
): Omit<Announcement, "id"> | null {
  for (const question of next) {
    const before = previous.find((candidate) => candidate.id === question.id);
    if (before?.status !== "applying") continue;
    const target = describeQuestionTarget(question, content);
    if (question.status === "applied") return { text: `Your answer was applied: ${target}.`, tone: "success" };
    if (question.status === "failed") return { text: `Your answer couldn't be applied: ${target}.`, tone: "error" };
  }
  return null;
}

export function QuestionsPanel({ cv, prepareAnswer, showEmptyState = false, className }: QuestionsPanelProps) {
  const answer = useAnswerQuestion(cv.id);
  const dismiss = useDismissQuestion(cv.id);
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resolvedId = useId();
  const [showResolved, setShowResolved] = useState(false);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());

  const [previousQuestions, setPreviousQuestions] = useState(cv.questions);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  if (cv.questions !== previousQuestions) {
    const transition = describeTransition(previousQuestions, cv.questions, cv.content);
    setPreviousQuestions(cv.questions);
    if (transition) setAnnouncement({ id: (announcement?.id ?? 0) + 1, ...transition });
  }
  useEffect(() => {
    if (!announcement) return;
    if (announcement.tone === "success") toast.success(announcement.text);
    else toast.error(announcement.text);
  }, [announcement]);

  const active = cv.questions.filter((question) => isActiveQuestion(question) && !skipped.has(question.id));
  const resolved = cv.questions.filter((question) => !isActiveQuestion(question));
  const openCount = active.filter(needsAnswer).length;
  const locked = cv.busy || answer.isPending || dismiss.isPending;

  // A card that resolves or is skipped takes the focus with it: keep keyboard users in the panel.
  const keepFocusInPanel = useCallback(() => headingRef.current?.focus({ preventScroll: true }), []);

  if (cv.questions.length === 0 && !showEmptyState) return null;

  const submitAnswer = async (questionId: string, text: string) => {
    const problem = await prepareAnswer();
    if (problem) throw new Error(problem);
    await answer.mutateAsync({ questionId, answer: text });
  };

  const skip = (questionId: string) => {
    const restore = () => setSkipped((current) => new Set([...current].filter((id) => id !== questionId)));
    let settled = false;
    const commit = () => {
      if (settled) return;
      settled = true;
      dismiss.mutate(questionId, {
        onSuccess: () => writeTextDraft(answerDraftKey(questionId), ""),
        onError: (error) => {
          restore();
          toast.error("Couldn't skip the question", { description: getErrorMessage(error) });
        },
      });
    };
    setSkipped((current) => new Set(current).add(questionId));
    toast("Question skipped", {
      duration: SKIP_UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          settled = true;
          restore();
        },
      },
      onAutoClose: commit,
      onDismiss: commit,
    });
  };

  return (
    <section aria-labelledby={headingId} className={cn("space-y-3", className)}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-soft-fg"
        >
          <MessageCircleQuestion className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            ref={headingRef}
            id={headingId}
            tabIndex={-1}
            className="flex flex-wrap items-center gap-2 text-base font-semibold text-fg outline-none"
          >
            {openCount > 0 ? "Claude needs a few details" : "Questions"}
            {openCount > 0 && <Badge tone="warning">{openCount}</Badge>}
          </h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            {openCount > 0
              ? "Answer what you can and Claude updates the related part of your CV, still without inventing anything. Skip what doesn't apply."
              : cv.questions.length > 0
                ? "All questions are answered or skipped."
                : "Claude had everything it needed from your source."}
          </p>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement?.text}
      </p>

      {active.length > 0 && (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {active.map((question) => (
              <motion.li
                key={question.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ duration: 0.2 }}
              >
                <QuestionCard
                  question={question}
                  target={describeQuestionTarget(question, cv.content)}
                  entryRemoved={isEntryRemoved(question, cv.content)}
                  locked={locked}
                  submitting={answer.isPending && answer.variables?.questionId === question.id}
                  skipping={dismiss.isPending && dismiss.variables === question.id}
                  onAnswer={(text) => submitAnswer(question.id, text)}
                  onSkip={() => skip(question.id)}
                  onFocusLost={keepFocusInPanel}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {resolved.length > 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-card">
          <button
            type="button"
            aria-expanded={showResolved}
            aria-controls={resolvedId}
            onClick={() => setShowResolved((value) => !value)}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl px-4 text-left text-sm font-medium text-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
          >
            Resolved ({resolved.length})
            <ChevronDown
              aria-hidden="true"
              className={cn("ml-auto size-4 text-fg-subtle transition-transform", showResolved && "rotate-180")}
            />
          </button>
          <ul id={resolvedId} hidden={!showResolved} className="divide-y divide-border border-t border-border">
            {resolved.map((question) => (
              <ResolvedQuestion
                key={question.id}
                question={question}
                target={describeQuestionTarget(question, cv.content)}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ResolvedQuestion({ question, target }: { question: CvQuestion; target: string }) {
  const applied = question.status === "applied";
  return (
    <li className="space-y-1.5 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={applied ? "success" : "neutral"}>
          {applied && <Check aria-hidden="true" className="size-3.5" />}
          {applied ? "Applied" : "Skipped"}
        </Badge>
        <span className="min-w-0 truncate text-xs text-fg-subtle">{target}</span>
      </div>
      <p className="break-words text-fg-muted">{question.question}</p>
      {applied && question.answer && (
        <p className="border-l-2 border-success/40 pl-2.5 break-words whitespace-pre-line text-fg">{question.answer}</p>
      )}
    </li>
  );
}
