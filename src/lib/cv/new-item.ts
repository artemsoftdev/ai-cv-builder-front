import type { Bullet, CvLink, EducationItem, ExperienceItem, SkillGroup } from "@/lib/api/types";

/**
 * Id for an item the user adds in the editor. Uses `crypto.getRandomValues` rather than
 * `crypto.randomUUID`, which only exists in secure contexts: opening the app over plain HTTP
 * on a LAN address (e.g. testing on a phone) must not break adding items.
 * Format matches the API's id rule (`[A-Za-z0-9_-]`, at most 64 chars).
 */
export function newItemId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `u_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export const newLink = (): CvLink => ({ id: newItemId(), label: "", url: "" });

export const newBullet = (): Bullet => ({ id: newItemId(), text: "" });

export const newExperienceItem = (): ExperienceItem => ({
  id: newItemId(),
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  bullets: [newBullet()],
});

export const newEducationItem = (): EducationItem => ({
  id: newItemId(),
  institution: "",
  degree: "",
  location: "",
  startDate: "",
  endDate: "",
  details: "",
});

export const newSkillGroup = (): SkillGroup => ({ id: newItemId(), name: "", items: [] });
