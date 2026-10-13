import { CloudOff, FileQuestion } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api/error-messages";
import { HOME_PATH } from "@/lib/auth/paths";

import { CvPageShell } from "./cv-page-shell";

/** The CV does not exist, or belongs to someone else (the API answers 404 in both cases). */
export function CvNotFound() {
  return (
    <CvPageShell>
      <EmptyState
        icon={<FileQuestion />}
        title="CV not found"
        description="It may have been deleted, or the link is wrong."
        action={
          <Link href={HOME_PATH} className={buttonVariants()}>
            Go to your CVs
          </Link>
        }
      />
    </CvPageShell>
  );
}

export function CvLoadError({ error, onRetry, retrying }: { error: unknown; onRetry: () => void; retrying: boolean }) {
  return (
    <CvPageShell>
      <EmptyState
        tone="danger"
        icon={<CloudOff />}
        title="Couldn't load this CV"
        description={getErrorMessage(error)}
        action={
          <Button variant="secondary" onClick={onRetry} loading={retrying}>
            Try again
          </Button>
        }
      />
    </CvPageShell>
  );
}

export function CvSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <span role="status" className="sr-only">
        Loading your CV…
      </span>
      <Skeleton className="h-10 w-28" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-border bg-surface p-5 shadow-card">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="hidden aspect-[210/297] w-full rounded-xl lg:block" />
      </div>
    </div>
  );
}
