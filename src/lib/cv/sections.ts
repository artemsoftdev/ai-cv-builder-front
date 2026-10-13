import type { CvContent, QuestionSection } from "@/lib/api/types";

export type CvSectionKey = QuestionSection;

export const CV_SECTIONS: readonly CvSectionKey[] = ["contact", "summary", "experience", "education", "skills"];

export const SECTION_LABELS: Record<CvSectionKey, string> = {
  contact: "Contact",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
};

export function changedSections(previous: CvContent, next: CvContent): CvSectionKey[] {
  return CV_SECTIONS.filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]));
}

export function formatDateRange(start: string, end: string): string {
  return [start.trim(), end.trim()].filter(Boolean).join(" – ");
}
