import type { CvContent, QuestionSection } from "@/lib/api/types";

/** Top-level sections of a CV, in document order. Same names as `QuestionSection`. */
export type CvSectionKey = QuestionSection;

export const CV_SECTIONS: readonly CvSectionKey[] = ["contact", "summary", "experience", "education", "skills"];

export const SECTION_LABELS: Record<CvSectionKey, string> = {
  contact: "Contact",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
};

/** Sections whose content differs between two versions (used to highlight AI updates). */
export function changedSections(previous: CvContent, next: CvContent): CvSectionKey[] {
  return CV_SECTIONS.filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]));
}

/** Join of the non-empty parts of a date range: "Mar 2021 – Present", "2019", "". */
export function formatDateRange(start: string, end: string): string {
  return [start.trim(), end.trim()].filter(Boolean).join(" – ");
}
