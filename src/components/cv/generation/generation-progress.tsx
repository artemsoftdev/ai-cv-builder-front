"use client";

import { Check, Clock, Info, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import type { Cv } from "@/lib/api/types";
import { useFocusOnMount } from "@/lib/hooks/use-focus-on-mount";
import { useNow } from "@/lib/hooks/use-now";
import { cn } from "@/lib/utils/cn";
import { formatElapsed } from "@/lib/utils/format";

import { CvPageShell } from "../cv-page-shell";
import { getGenerationSteps, type GenerationStep } from "./generation-steps";

const SLOW_AFTER_MS = 3 * 60_000;

type GenerationProgressProps = {
  cv: Cv;
  connectionLost: boolean;
  startedAt?: number | null;
  autoFocus?: boolean;
};

export function GenerationProgress({ cv, connectionLost, startedAt, autoFocus = false }: GenerationProgressProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useFocusOnMount(headingRef, autoFocus);

  const [sawExtracting, setSawExtracting] = useState(cv.stage === "extracting");
  if (cv.stage === "extracting" && !sawExtracting) setSawExtracting(true);

  const steps = getGenerationSteps(cv.stage, sawExtracting);
  const currentIndex = steps.findIndex((step) => step.state === "current");
  const current = steps[currentIndex];

  const now = useNow(1_000);
  const start = startedAt ?? Date.parse(cv.createdAt);
  const elapsedMs = Number.isNaN(start) ? 0 : Math.max(0, now - start);

  return (
    <CvPageShell>
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg"
            >
              <Sparkles className="size-5 motion-safe:animate-pulse" />
            </span>
            <div className="min-w-0">
              <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none sm:text-2xl">
                Creating your CV
              </h1>
              <p className="mt-1 text-sm break-words text-fg-muted">
                For <span className="font-medium text-fg">{cv.targetRole}</span>
                {" · "}
                {cv.sourceType === "pdf" ? (cv.sourceFilename ?? "your PDF") : "pasted text"}
              </p>
            </div>
          </div>

          <ol aria-label="Generation progress" className="mt-8">
            {steps.map((step, index) => (
              <StepItem key={step.stage} step={step} last={index === steps.length - 1} />
            ))}
          </ol>

          <p aria-live="polite" className="sr-only">
            {current ? `Step ${currentIndex + 1} of ${steps.length}: ${current.label}` : ""}
          </p>

          <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
            <Clock aria-hidden="true" className="size-4 shrink-0" />
            <span>
              Elapsed <span className="font-medium text-fg tabular-nums">{formatElapsed(elapsedMs)}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>usually about a minute</span>
          </p>

          {elapsedMs > SLOW_AFTER_MS && !connectionLost && (
            <p className="mt-3 text-sm text-fg-muted">
              This is taking longer than usual, often because the AI service is busy. It keeps running and retries by
              itself; feel free to come back later.
            </p>
          )}

          {connectionLost && (
            <Alert tone="warning" title="Connection lost" className="mt-5">
              We can&apos;t check the progress right now. The generation continues on the server and this page updates
              as soon as the connection is back.
            </Alert>
          )}
        </div>
        <div className="flex gap-2.5 border-t border-border bg-surface-muted/60 px-5 py-4 text-sm text-fg-muted sm:px-8">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>You can close this tab — progress is saved and you can come back any time.</p>
        </div>
      </div>
    </CvPageShell>
  );
}

const STATE_TEXT = { complete: "done", current: "in progress", upcoming: "not started" } as const;

function StepItem({ step, last }: { step: GenerationStep; last: boolean }) {
  const { state } = step;
  return (
    <motion.li layout="position" aria-current={state === "current" ? "step" : undefined} className="relative flex gap-4">
      {!last && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-8 bottom-0 left-[0.9375rem] w-px transition-colors duration-500",
            state === "complete" ? "bg-success" : "bg-border",
          )}
        />
      )}
      <span
        aria-hidden="true"
        className={cn(
          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300",
          state === "complete" && "border-success bg-success text-primary-fg",
          state === "current" && "border-primary bg-primary-soft text-primary",
          state === "upcoming" && "border-border bg-surface text-fg-subtle",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={state}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex"
          >
            {state === "complete" ? (
              <Check className="size-4" strokeWidth={3} />
            ) : state === "current" ? (
              <Spinner size="sm" />
            ) : (
              <span className="size-2 rounded-full bg-current" />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <div className={cn("min-w-0 pt-1", last ? "pb-0" : "pb-6")}>
        <p
          className={cn(
            "text-sm font-medium transition-colors",
            state === "upcoming" ? "text-fg-subtle" : "text-fg",
          )}
        >
          {step.label}
          <span className="sr-only"> ({STATE_TEXT[state]})</span>
        </p>
        <AnimatePresence initial={false}>
          {state === "current" && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden text-sm text-fg-muted"
            >
              <span className="block pt-1">{step.description}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}
