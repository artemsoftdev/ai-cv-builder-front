import { ArrowLeft, Construction } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HOME_PATH } from "@/lib/auth/paths";

/** Temporary stand-in for routes that are not built yet, so links never 404. */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <Link href={HOME_PATH} className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-3" })}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to your CVs
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <EmptyState icon={<Construction />} title="Coming soon" description={description} />
    </div>
  );
}
