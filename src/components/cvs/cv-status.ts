import type { BadgeTone } from "@/components/ui/badge";
import type { CvSummary, GenerationStage } from "@/lib/api/types";

/** Human wording of the generation stages (docs/API.md `GenerationStage`). */
export const STAGE_LABELS: Record<GenerationStage, string> = {
  queued: "Queued",
  extracting: "Reading your PDF",
  drafting: "Drafting",
  verifying: "Checking facts",
  done: "Finishing up",
};

export type CvStatusDisplay = { label: string; tone: BadgeTone; pulse: boolean };

/** How a CV's state is shown in badges: generation stage, background update, ready, failed. */
export function getCvStatusDisplay(cv: Pick<CvSummary, "status" | "stage" | "busy">): CvStatusDisplay {
  switch (cv.status) {
    case "generating":
      return { label: `Generating · ${STAGE_LABELS[cv.stage]}`, tone: "primary", pulse: true };
    case "failed":
      return { label: "Failed", tone: "danger", pulse: false };
    case "ready":
      return cv.busy
        ? { label: "Updating", tone: "primary", pulse: true }
        : { label: "Ready", tone: "success", pulse: false };
  }
}
