import type { CvContent, CvLink } from "@/lib/api/types";

import { formatDateRange } from "./sections";

// Mirrors toPrintableCv in the API (modules/pdf/printable-cv.ts): keep the two in sync.
export type PrintableCv = {
  name: string;
  headline: string;
  contact: string[];
  summary: string;
  experience: PrintableEntry[];
  education: PrintableEntry[];
  skills: { id: string; name: string; items: string }[];
};

export type PrintableEntry = {
  id: string;
  title: string;
  subtitle: string;
  dates: string;
  location: string;
  details: string;
  bullets: { id: string; text: string }[];
};

// Paper is not clickable: print the address without the protocol (or the label).
export function linkText(link: Pick<CvLink, "label" | "url">): string {
  const url = link.url
    .trim()
    .replace(/^(https?:\/\/|mailto:)/i, "")
    .replace(/\/$/, "");
  return url || link.label.trim();
}

const hasText = (entry: PrintableEntry) =>
  [entry.title, entry.subtitle, entry.dates, entry.location, entry.details].some(Boolean) || entry.bullets.length > 0;

export function toPrintableCv(content: CvContent): PrintableCv {
  const { contact } = content;

  const experience = content.experience
    .map((item) => ({
      id: item.id,
      title: item.title.trim(),
      subtitle: item.company.trim(),
      dates: formatDateRange(item.startDate, item.endDate),
      location: item.location.trim(),
      details: "",
      bullets: item.bullets
        .map((bullet) => ({ id: bullet.id, text: bullet.text.trim() }))
        .filter((bullet) => bullet.text !== ""),
    }))
    .filter(hasText);

  const education = content.education
    .map((item) => ({
      id: item.id,
      title: item.degree.trim(),
      subtitle: item.institution.trim(),
      dates: formatDateRange(item.startDate, item.endDate),
      location: item.location.trim(),
      details: item.details.trim(),
      bullets: [],
    }))
    .filter(hasText);

  const skills = content.skills
    .map((group) => ({
      id: group.id,
      name: group.name.trim(),
      items: group.items
        .map((skill) => skill.trim())
        .filter(Boolean)
        .join(", "),
    }))
    .filter((group) => group.items !== "");

  return {
    name: contact.fullName.trim(),
    headline: contact.headline.trim(),
    contact: [contact.email, contact.phone, contact.location, ...contact.links.map(linkText)]
      .map((value) => value.trim())
      .filter(Boolean),
    summary: content.summary.trim(),
    experience,
    education,
    skills,
  };
}

export function isEmptyPrintable(cv: PrintableCv): boolean {
  return (
    !cv.name &&
    !cv.headline &&
    cv.contact.length === 0 &&
    !cv.summary &&
    cv.experience.length === 0 &&
    cv.education.length === 0 &&
    cv.skills.length === 0
  );
}
