import type { Bullet, CvLink, EducationItem, ExperienceItem, SkillGroup } from "@/lib/api/types";

// crypto.randomUUID needs a secure context, which a phone opening the app over plain HTTP is not.
function newItemId(): string {
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
