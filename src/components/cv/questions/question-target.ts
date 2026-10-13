import type { CvContent, CvQuestion } from "@/lib/api/types";
import { SECTION_LABELS } from "@/lib/cv/sections";

export function describeQuestionTarget(question: Pick<CvQuestion, "section" | "itemId">, content: CvContent): string {
  const section = SECTION_LABELS[question.section];
  if (!question.itemId) return section;
  let name: string | undefined;
  if (question.section === "experience") {
    const item = content.experience.find((entry) => entry.id === question.itemId);
    name = item && (item.company.trim() || item.title.trim());
  } else if (question.section === "education") {
    const item = content.education.find((entry) => entry.id === question.itemId);
    name = item && (item.institution.trim() || item.degree.trim());
  }
  return name ? `${section} · ${name}` : section;
}

export const isActiveQuestion = (question: Pick<CvQuestion, "status">) =>
  question.status === "open" || question.status === "failed" || question.status === "applying";

export const needsAnswer = (question: Pick<CvQuestion, "status">) =>
  question.status === "open" || question.status === "failed";

// The API refuses answers about an entry that no longer exists; only skipping is left.
export function isEntryRemoved(question: Pick<CvQuestion, "section" | "itemId">, content: CvContent): boolean {
  if (question.itemId === null) return false;
  if (question.section === "experience") return !content.experience.some((entry) => entry.id === question.itemId);
  if (question.section === "education") return !content.education.some((entry) => entry.id === question.itemId);
  return false;
}
