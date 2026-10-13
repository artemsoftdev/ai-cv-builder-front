import type { Cv, CvContent } from "@/lib/api/types";

import { mergeContent, type MergeResult } from "./merge-content";

// Unsaved editor content, kept per tab so a reload, a killed tab or a re-login can restore it.
export type CvDraft = { version: number; base: CvContent; content: CvContent };

const DRAFT_PREFIX = "cvb:draft:";
const OWNER_KEY = "cvb:draft-owner";

// Storage can be missing or throw (private mode, quota, blocked site data): drafts are best effort.
function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function isContent(value: unknown): value is CvContent {
  return (
    isRecord(value) &&
    isRecord(value.contact) &&
    Array.isArray(value.contact.links) &&
    typeof value.summary === "string" &&
    Array.isArray(value.experience) &&
    Array.isArray(value.education) &&
    Array.isArray(value.skills)
  );
}

export function readDraft(cvId: string): CvDraft | null {
  try {
    const raw = storage()?.getItem(DRAFT_PREFIX + cvId);
    if (!raw) return null;
    const draft: unknown = JSON.parse(raw);
    if (!isRecord(draft) || typeof draft.version !== "number" || !isContent(draft.base) || !isContent(draft.content)) {
      return null;
    }
    return { version: draft.version, base: draft.base, content: draft.content };
  } catch {
    return null;
  }
}

export function writeDraft(cvId: string, draft: CvDraft): void {
  try {
    storage()?.setItem(DRAFT_PREFIX + cvId, JSON.stringify(draft));
  } catch {
    // Quota exceeded or storage blocked.
  }
}

export function removeDraft(cvId: string): void {
  try {
    storage()?.removeItem(DRAFT_PREFIX + cvId);
  } catch {
    // Storage blocked.
  }
}

// Plain text typed elsewhere (an answer, pasted CV text), under its own key next to the CV drafts.
export function readTextDraft(key: string): string | null {
  try {
    return storage()?.getItem(DRAFT_PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

export function writeTextDraft(key: string, value: string): void {
  try {
    if (value.trim()) storage()?.setItem(DRAFT_PREFIX + key, value);
    else storage()?.removeItem(DRAFT_PREFIX + key);
  } catch {
    // Quota exceeded or storage blocked.
  }
}

export function clearDrafts(): void {
  const store = storage();
  if (!store) return;
  try {
    const keys = Array.from({ length: store.length }, (_, index) => store.key(index));
    for (const key of keys) if (key?.startsWith(DRAFT_PREFIX)) store.removeItem(key);
    store.removeItem(OWNER_KEY);
  } catch {
    // Storage blocked.
  }
}

// Another account signing in on this tab must not inherit the previous one's drafts.
export function claimDrafts(userId: string): void {
  try {
    const store = storage();
    if (!store) return;
    const owner = store.getItem(OWNER_KEY);
    if (owner !== null && owner !== userId) clearDrafts();
    store.setItem(OWNER_KEY, userId);
  } catch {
    // Storage blocked.
  }
}

// The draft re-applied on top of the latest server copy (it may have moved on since), or null.
export function restoreDraft(cv: Cv & { content: CvContent }): MergeResult | null {
  const draft = readDraft(cv.id);
  if (!draft) return null;
  const merge = draft.version <= cv.version ? mergeContent(draft.base, draft.content, cv.content) : null;
  if (merge && JSON.stringify(merge.content) !== JSON.stringify(cv.content)) return merge;
  removeDraft(cv.id);
  return null;
}
