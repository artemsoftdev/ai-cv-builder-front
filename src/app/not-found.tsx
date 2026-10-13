import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HOME_PATH } from "@/lib/auth/paths";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4 py-16">
      <EmptyState
        className="w-full"
        icon={<FileQuestion />}
        title="Page not found"
        description="The page you are looking for doesn't exist or was moved."
        action={
          <Link href={HOME_PATH} className={buttonVariants()}>
            Go to your CVs
          </Link>
        }
      />
    </main>
  );
}
