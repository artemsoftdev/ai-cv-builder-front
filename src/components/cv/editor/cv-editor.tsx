"use client";

import type { CvSectionKey } from "@/lib/cv/sections";

import { ContactSection } from "./contact-section";
import { EditorProvider } from "./editor-context";
import { EducationSection } from "./education-section";
import { ExperienceSection } from "./experience-section";
import { SkillsSection } from "./skills-section";
import { SummarySection } from "./summary-section";

type CvEditorProps = {
  targetRole: string;
  /** Inputs are disabled (a background job is rewriting the CV). */
  readOnly: boolean;
  /** Sections the AI just changed, highlighted for a moment. */
  updatedSections: ReadonlySet<CvSectionKey>;
};

/** All CV sections as editable cards. Must be rendered inside the workspace's `FormProvider`. */
export function CvEditor({ targetRole, readOnly, updatedSections }: CvEditorProps) {
  return (
    <EditorProvider readOnly={readOnly}>
      <div className="space-y-4">
        <ContactSection updated={updatedSections.has("contact")} />
        <SummarySection targetRole={targetRole} updated={updatedSections.has("summary")} />
        <ExperienceSection updated={updatedSections.has("experience")} />
        <EducationSection updated={updatedSections.has("education")} />
        <SkillsSection updated={updatedSections.has("skills")} />
      </div>
    </EditorProvider>
  );
}
