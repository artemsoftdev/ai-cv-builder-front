import { z } from "zod";

import { API_LIMITS, type CvContent } from "@/lib/api/types";

/**
 * Client-side mirror of the API's content rules (docs/API.md "Content limits", and
 * `cv-content.schema.ts` in the API). Autosave only sends content that passes this schema,
 * so a typo never turns into a 400 from the server. No transforms: the editor keeps exactly
 * what the user typed and the server does the trimming/normalising.
 */

const L = API_LIMITS.content;

const tooLong = (max: number) => `Use at most ${max.toLocaleString("en")} characters`;
const text = (max: number = L.string) => z.string().max(max, tooLong(max));

const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;
const LINK_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/** Same rule as the API: either no scheme ("github.com/jane") or http(s)/mailto. */
export function isAllowedLinkUrl(value: string): boolean {
  const scheme = HAS_SCHEME.exec(value.trim())?.[0].toLowerCase();
  return scheme === undefined || LINK_SCHEMES.has(scheme);
}

/** Ids are referenced by review flags, evidence and questions; the API enforces this format. */
const itemId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

const linkSchema = z.object({
  id: itemId,
  label: text(),
  url: text().refine(isAllowedLinkUrl, "Use a web address (like github.com/you) or a mailto: link"),
});

const bulletSchema = z.object({ id: itemId, text: text(L.bullet) });

const experienceItemSchema = z.object({
  id: itemId,
  company: text(),
  title: text(),
  location: text(),
  startDate: text(),
  endDate: text(),
  bullets: z.array(bulletSchema).max(L.bulletsPerItem, `Keep at most ${L.bulletsPerItem} bullets per job`),
});

const educationItemSchema = z.object({
  id: itemId,
  institution: text(),
  degree: text(),
  location: text(),
  startDate: text(),
  endDate: text(),
  details: text(L.educationDetails),
});

const skillGroupSchema = z.object({
  id: itemId,
  name: text(),
  items: z.array(text()).max(L.skillsPerGroup, `Keep at most ${L.skillsPerGroup} skills per group`),
});

export const cvContentSchema = z.object({
  contact: z.object({
    fullName: text(),
    headline: text(),
    email: text(),
    phone: text(),
    location: text(),
    links: z.array(linkSchema).max(L.links, `Add at most ${L.links} links`),
  }),
  summary: text(L.summary),
  experience: z.array(experienceItemSchema).max(L.experienceItems),
  education: z.array(educationItemSchema).max(L.educationItems),
  skills: z.array(skillGroupSchema).max(L.skillGroups),
}) satisfies z.ZodType<CvContent, CvContent>;

/** PATCH `title`: 1-120 characters after trimming (same as the API). */
export const CV_TITLE_MAX = 120;
export const cvTitleSchema = z
  .string()
  .trim()
  .min(1, "Give your CV a title")
  .max(CV_TITLE_MAX, tooLong(CV_TITLE_MAX));
