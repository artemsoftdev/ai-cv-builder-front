"use client";

import { AlignLeft } from "lucide-react";

import { API_LIMITS } from "@/lib/api/types";

import { FormTextField } from "./form-text-field";
import { SectionCard } from "./section-card";

export function SummarySection({ targetRole, updated }: { targetRole: string; updated: boolean }) {
  return (
    <SectionCard section="summary" title="Summary" icon={<AlignLeft />} updated={updated}>
      <FormTextField
        name="summary"
        label="Professional summary"
        multiline
        rows={5}
        maxLength={API_LIMITS.content.summary}
        hint={`Two to four sentences on why you fit a ${targetRole} role.`}
      />
    </SectionCard>
  );
}
