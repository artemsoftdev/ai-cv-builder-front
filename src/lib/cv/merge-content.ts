import type { CvContact, CvContent } from "@/lib/api/types";

type ContactKey = keyof CvContact;
type SectionKey = Exclude<keyof CvContent, "contact">;

export type MergeUnit = `contact.${ContactKey}` | SectionKey;

const CONTACT_KEYS: readonly ContactKey[] = ["fullName", "headline", "email", "phone", "location", "links"];
const SECTION_KEYS: readonly SectionKey[] = ["summary", "experience", "education", "skills"];
const MERGE_UNITS: readonly MergeUnit[] = [...CONTACT_KEYS.map((key) => `contact.${key}` as const), ...SECTION_KEYS];

export const MERGE_UNIT_LABELS: Record<MergeUnit, string> = {
  "contact.fullName": "name",
  "contact.headline": "headline",
  "contact.email": "email",
  "contact.phone": "phone",
  "contact.location": "location",
  "contact.links": "links",
  summary: "summary",
  experience: "experience",
  education: "education",
  skills: "skills",
};

export type MergeResult = {
  content: CvContent;
  kept: MergeUnit[];
  dropped: MergeUnit[];
};

const CONTACT_PREFIX = "contact.";

function contactKey(unit: MergeUnit): ContactKey | null {
  return unit.startsWith(CONTACT_PREFIX) ? (unit.slice(CONTACT_PREFIX.length) as ContactKey) : null;
}

function read(content: CvContent, unit: MergeUnit): unknown {
  const key = contactKey(unit);
  return key ? content.contact[key] : content[unit as SectionKey];
}

function copy(target: CvContent, source: CvContent, unit: MergeUnit): void {
  const key = contactKey(unit);
  if (key) Object.assign(target.contact, { [key]: structuredClone(source.contact[key]) });
  else Object.assign(target, { [unit]: structuredClone(source[unit as SectionKey]) });
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Three-way merge after VERSION_CONFLICT: local edits win where the server did not change that part.
export function mergeContent(base: CvContent, local: CvContent, remote: CvContent): MergeResult {
  const content = structuredClone(remote);
  const kept: MergeUnit[] = [];
  const dropped: MergeUnit[] = [];

  for (const unit of MERGE_UNITS) {
    const mine = read(local, unit);
    const original = read(base, unit);
    if (same(mine, original)) continue;
    const theirs = read(remote, unit);
    if (same(mine, theirs)) continue;
    if (same(theirs, original)) {
      copy(content, local, unit);
      kept.push(unit);
    } else {
      dropped.push(unit);
    }
  }
  return { content, kept, dropped };
}
