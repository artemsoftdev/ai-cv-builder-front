"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, MessageCircleQuestion } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { describeJobError, getErrorMessage } from "@/lib/api/error-messages";
import { ApiError, isApiError } from "@/lib/api/errors";
import { API_LIMITS, type CvQuestion } from "@/lib/api/types";
import { applyServerError, SERVER_ERROR } from "@/lib/forms/apply-server-error";
import { cn } from "@/lib/utils/cn";

const { min: ANSWER_MIN, max: ANSWER_MAX } = API_LIMITS.answer;

const answerSchema = z.object({
  answer: z
    .string()
    .trim()
    .min(ANSWER_MIN, "Write an answer, or skip the question")
    .max(ANSWER_MAX, `Keep it under ${ANSWER_MAX.toLocaleString("en")} characters`),
});
type AnswerValues = z.input<typeof answerSchema>;

type QuestionCardProps = {
  question: CvQuestion;
  /** "Experience · Acme Corp" */
  target: string;
  /** Another answer is being applied (or the CV is busy): one at a time. */
  locked: boolean;
  /** This card's answer request is in flight. */
  submitting: boolean;
  skipping: boolean;
  /** Rejects with the error to show on the card. */
  onAnswer: (answer: string) => Promise<void>;
  onSkip: () => void;
};

function answerErrorMessage(error: unknown): string {
  if (isApiError(error, "INVALID_STATE")) return "This question was already answered or skipped.";
  if (isApiError(error, "CV_BUSY")) return "Claude is still updating your CV. Try again when it's done.";
  if (error instanceof ApiError) return getErrorMessage(error);
  return error instanceof Error ? error.message : getErrorMessage(error);
}

/** One open, failed or in-progress question with its answer form. */
export function QuestionCard({ question, target, locked, submitting, skipping, onAnswer, onSkip }: QuestionCardProps) {
  const id = useId();
  const rootRef = useRef<HTMLElement>(null);
  const [submittedHere, setSubmittedHere] = useState(false);
  const failed = question.status === "failed";
  const applying = question.status === "applying";

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AnswerValues>({
    resolver: zodResolver(answerSchema),
    // A failed answer is offered again for editing.
    defaultValues: { answer: question.answer ?? "" },
    mode: "onTouched",
  });
  const length = useWatch({ control, name: "answer" }).trim().length;

  // The form is replaced by a progress line: keep keyboard focus on the card.
  useEffect(() => {
    if (applying && submittedHere) rootRef.current?.focus();
  }, [applying, submittedHere]);

  const onSubmit = handleSubmit(async ({ answer }) => {
    try {
      setSubmittedHere(true);
      await onAnswer(answer);
    } catch (error) {
      setSubmittedHere(false);
      if (isApiError(error, "VALIDATION_ERROR")) applyServerError(error, setError, ["answer"]);
      else setError(SERVER_ERROR, { type: "server", message: answerErrorMessage(error) });
    }
  });

  const answerId = `${id}-answer`;
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;

  return (
    <article
      ref={rootRef}
      tabIndex={-1}
      aria-labelledby={`${id}-question`}
      className={cn(
        "rounded-xl border bg-surface p-4 shadow-card outline-none focus-visible:ring-4 focus-visible:ring-ring",
        failed ? "border-danger/30" : applying ? "border-primary/30" : "border-border",
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-fg-subtle uppercase">
        <MessageCircleQuestion aria-hidden="true" className="size-3.5" />
        <span className="truncate">{target}</span>
      </p>

      {applying ? (
        <>
          <p id={`${id}-question`} className="mt-2 text-sm font-medium break-words text-fg">
            {question.question}
          </p>
          {question.answer && (
            <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-sm break-words whitespace-pre-line text-fg-muted">
              {question.answer}
            </p>
          )}
          <p role="status" className="mt-3 flex items-center gap-2 text-sm text-primary-soft-fg">
            <Spinner size="sm" />
            Updating your CV with this answer…
          </p>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-2 space-y-3">
          <label id={`${id}-question`} htmlFor={answerId} className="block text-sm font-medium break-words text-fg">
            {question.question}
          </label>
          {failed && (
            <p className="flex gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                Your answer couldn&apos;t be applied. {describeJobError(question.error)} You can edit it and try again.
              </span>
            </p>
          )}
          <div className="space-y-1.5">
            <Textarea
              id={answerId}
              rows={2}
              placeholder="Your answer"
              className="min-h-20"
              invalid={Boolean(errors.answer)}
              aria-describedby={[errors.answer ? errorId : null, counterId].filter(Boolean).join(" ")}
              disabled={locked && !submitting}
              readOnly={submitting}
              {...register("answer")}
            />
            <FieldError id={errorId} message={errors.answer?.message} />
            <p
              id={counterId}
              className={cn("text-right text-xs tabular-nums", length > ANSWER_MAX ? "text-danger-soft-fg" : "text-fg-subtle")}
            >
              {length.toLocaleString("en")} / {ANSWER_MAX.toLocaleString("en")}
            </p>
          </div>
          {errors.root?.server?.message && (
            <p role="alert" className="text-sm text-danger-soft-fg">
              {errors.root.server.message}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onSkip} loading={skipping} disabled={locked || submitting}>
              Skip
            </Button>
            <Button type="submit" size="sm" loading={submitting} disabled={locked && !submitting}>
              {failed ? "Try again" : "Update CV"}
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}
