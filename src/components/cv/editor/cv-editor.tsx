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
  readOnly: boolean;
  updatedSections: ReadonlySet<CvSectionKey>;
};

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
