import type { Metadata } from "next";

import { CvView } from "@/components/cv/cv-view";

export const metadata: Metadata = { title: "CV" };

export default async function CvPage({ params }: PageProps<"/cvs/[id]">) {
  const { id } = await params;
  // Keyed by id: moving between CVs must not carry over editor or progress state.
  return <CvView key={id} cvId={id} />;
}
