import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { FadeIn } from "@/components/motion/fade-in";
import { buttonVariants } from "@/components/ui/button";
import { HOME_PATH } from "@/lib/auth/paths";
import { cn } from "@/lib/utils/cn";

export function BackToCvsLink({ className }: { className?: string }) {
  return (
    <Link href={HOME_PATH} className={buttonVariants({ variant: "ghost", size: "sm", className: cn("-ml-3", className) })}>
      <ArrowLeft aria-hidden="true" className="size-4" />
      Your CVs
    </Link>
  );
}

export function CvPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <BackToCvsLink />
      <FadeIn>{children}</FadeIn>
    </div>
  );
}
