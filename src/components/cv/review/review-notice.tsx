"use client";

import { ChevronDown, ShieldCheck } from "lucide-react";
import { useId, useState } from "react";

import type { RemovedClaim } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";

import { useReview } from "./review-context";

const FIELD_LABELS: Record<string, string> = {
  "contact.fullName": "Name",
  "contact.headline": "Headline",
  "contact.email": "Email",
  "contact.phone": "Phone",
  "contact.location": "Location",
  "contact.links": "Link",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skill",
};

export function describeRemovedField(field: string): string {
  const known = FIELD_LABELS[field] ?? FIELD_LABELS[field.split(".").slice(0, 2).join(".")] ?? FIELD_LABELS[field.split(".")[0] ?? ""];
  if (known) return known;
  const last = field.split(".").filter((part) => !/^\d+$/.test(part)).at(-1) ?? field;
  return last.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase());
}

export function ReviewNotice({ removed }: { removed: RemovedClaim[] }) {
  const { openFlagCount } = useReview();
  const [showRemoved, setShowRemoved] = useState(false);
  const listId = useId();
  if (openFlagCount === 0 && removed.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 text-sm shadow-card">
      <div className="flex gap-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-fg">Every detail was checked against your source</p>
          <p className="text-fg-muted">
            {openFlagCount > 0
              ? `${openFlagCount === 1 ? "1 detail" : `${openFlagCount} details`} could not be confirmed. Look for the amber “Check” badges: edit the text or dismiss the warning.`
              : "Nothing left to double-check."}
          </p>
        </div>
      </div>
      {removed.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <button
            type="button"
            aria-expanded={showRemoved}
            aria-controls={listId}
            onClick={() => setShowRemoved((value) => !value)}
            className="flex min-h-10 w-full items-center gap-2 rounded-lg text-left font-medium text-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
          >
            Removed because it wasn&apos;t in your source ({removed.length})
            <ChevronDown
              aria-hidden="true"
              className={cn("ml-auto size-4 shrink-0 text-fg-subtle transition-transform", showRemoved && "rotate-180")}
            />
          </button>
          <ul id={listId} hidden={!showRemoved} className="mt-1 space-y-2">
            {removed.map((claim, index) => (
              <li key={index} className="rounded-lg bg-surface-muted px-3 py-2 break-words">
                <span className="font-medium text-fg">{describeRemovedField(claim.field)}: </span>
                <span className="text-fg">“{claim.value}”</span>
                <span className="mt-0.5 block text-fg-muted">{claim.reason}</span>
              </li>
            ))}
          </ul>
          <p hidden={!showRemoved} className="mt-2 text-fg-muted">
            If something here is correct, add it back by hand or mention it when answering a question.
          </p>
        </div>
      )}
    </div>
  );
}
