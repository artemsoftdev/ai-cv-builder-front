import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "New CV" };

// Placeholder: the create-CV flow (upload/paste + target role) replaces this page.
export default function NewCvPage() {
  return (
    <PlaceholderPage
      title="New CV"
      description="Upload a PDF or paste your CV, choose a target role and we'll draft a focused CV for it."
    />
  );
}
