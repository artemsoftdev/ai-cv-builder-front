import { z } from "zod";

import { API_LIMITS, type CvContent } from "@/lib/api/types";

// Mirror of the API's content rules, so autosave never sends what the API would reject. No transforms.

const L = API_LIMITS.content;

const tooLong = (max: number) => `Use at most ${max.toLocaleString("en")} characters`;
const text = (max: number = L.string) => z.string().max(max, tooLong(max));

const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;
const LINK_SCHEMES = new Set(["http:", "https:", "mailto:"]);

export function isAllowedLinkUrl(value: string): boolean {
  const scheme = HAS_SCHEME.exec(value.trim())?.[0].toLowerCase();
  return scheme === undefined || LINK_SCHEMES.has(scheme);
}

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

function* itemIds(content: CvContent): Generator<{ id: string; path: (string | number)[] }> {
  for (const [i, link] of content.contact.links.entries()) yield { id: link.id, path: ["contact", "links", i, "id"] };
  for (const [i, item] of content.experience.entries()) {
    yield { id: item.id, path: ["experience", i, "id"] };
    for (const [j, bullet] of item.bullets.entries()) yield { id: bullet.id, path: ["experience", i, "bullets", j, "id"] };
  }
  for (const [i, item] of content.education.entries()) yield { id: item.id, path: ["education", i, "id"] };
  for (const [i, group] of content.skills.entries()) yield { id: group.id, path: ["skills", i, "id"] };
}

// Same rule as the API: flags, evidence and questions point at items by id, so ids are unique
// and never collide with the reserved review targets.
const RESERVED_IDS = ["summary", "headline"];

export const cvContentSchema = z
  .object({
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
  })
  .superRefine((content, ctx) => {
    const seen = new Set(RESERVED_IDS);
    for (const { id, path } of itemIds(content)) {
      if (seen.has(id)) ctx.addIssue({ code: "custom", path, message: "This entry appears twice. Remove one copy." });
      seen.add(id);
    }
  }) satisfies z.ZodType<CvContent, CvContent>;

export const CV_TITLE_MAX = 120;
export const cvTitleSchema = z
  .string()
  .trim()
  .min(1, "Give your CV a title")
  .max(CV_TITLE_MAX, tooLong(CV_TITLE_MAX));
