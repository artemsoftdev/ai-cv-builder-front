import type { Metadata } from "next";

import { CvListView } from "@/components/cvs/cv-list-view";

export const metadata: Metadata = { title: "Your CVs" };

export default function CvsPage() {
  return <CvListView />;
}
