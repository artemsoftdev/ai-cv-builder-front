import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NewCvForm } from "@/components/cv/new/new-cv-form";
import { FadeIn } from "@/components/motion/fade-in";
import { buttonVariants } from "@/components/ui/button";
import { HOME_PATH } from "@/lib/auth/paths";

export const metadata: Metadata = { title: "New CV" };

export default function NewCvPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={HOME_PATH} className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-3" })}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Your CVs
      </Link>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create a new CV</h1>
        <p className="text-sm text-fg-muted sm:text-base">
          Start from what you already have. You will get a focused draft you can review, edit and download as a PDF.
        </p>
      </div>
      <FadeIn className="rounded-xl border border-border bg-surface p-5 shadow-card sm:p-8">
        <NewCvForm />
      </FadeIn>
    </div>
  );
}
