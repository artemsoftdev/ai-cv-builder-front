import type { CvContent, CvQuestion } from "@/lib/api/types";
import { SECTION_LABELS } from "@/lib/cv/sections";

/** Which part of the CV a question is about: "Experience · Acme Corp", "Contact", ... */
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

/** Still waiting for the user (or being applied). */
export const isActiveQuestion = (question: Pick<CvQuestion, "status">) =>
  question.status === "open" || question.status === "failed" || question.status === "applying";

/** Questions the user should act on: shown as a count on tabs and badges. */
export const needsAnswer = (question: Pick<CvQuestion, "status">) =>
  question.status === "open" || question.status === "failed";
