import type { GenerationStage } from "@/lib/api/types";

export type StepState = "complete" | "current" | "upcoming";

export type GenerationStep = {
  stage: GenerationStage;
  label: string;
  /** Shown under the current step. */
  description: string;
  state: StepState;
};

const STAGE_ORDER: readonly GenerationStage[] = ["queued", "extracting", "drafting", "verifying", "done"];

const STEP_COPY: Record<GenerationStage, { label: string; description: string }> = {
  queued: { label: "In queue", description: "Waiting for a free worker. This usually takes a few seconds." },
  extracting: {
    label: "Reading your scanned PDF",
    description: "Your PDF has no text layer, so Claude transcribes it first.",
  },
  drafting: {
    label: "Drafting with Claude",
    description: "Rewriting your experience as concise bullets for the role, most relevant first.",
  },
  verifying: {
    label: "Checking every fact against your source",
    description: "Names, dates, numbers and skills that are not in your source get flagged or removed.",
  },
  done: { label: "Ready to review", description: "Saving your draft…" },
};

/**
 * Steps of the generation stepper. "Reading your scanned PDF" only applies to scanned PDFs,
 * so it is listed only when the CV is (or was seen) in that stage.
 */
export function getGenerationSteps(stage: GenerationStage, sawExtracting: boolean): GenerationStep[] {
  const currentIndex = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER.filter((candidate) => candidate !== "extracting" || sawExtracting || stage === "extracting").map(
    (candidate) => {
      const index = STAGE_ORDER.indexOf(candidate);
      const state: StepState = index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
      return { stage: candidate, ...STEP_COPY[candidate], state };
    },
  );
}
