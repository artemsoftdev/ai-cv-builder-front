import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "CV" };

// Placeholder: the generation progress view and CV editor replace this page.
export default function CvPage() {
  return (
    <PlaceholderPage
      title="Your CV"
      description="Generation progress, questions, editing and PDF export will live here."
    />
  );
}
