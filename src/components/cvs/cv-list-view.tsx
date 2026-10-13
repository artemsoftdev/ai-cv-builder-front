"use client";

import { CloudOff, FileText, Plus, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api/error-messages";
import type { CvSummary } from "@/lib/api/types";
import { NEW_CV_PATH } from "@/lib/auth/paths";
import { useCvs, useDeleteCv } from "@/lib/query/cv-hooks";

import { CvCard } from "./cv-card";

export function CvListView() {
  const cvs = useCvs();
  const deleteCv = useDeleteCv();
  // Kept after closing so the dialog text doesn't vanish during its exit transition.
  const [deleteTarget, setDeleteTarget] = useState<CvSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const requestDelete = (cv: CvSummary) => {
    setDeleteTarget(cv);
    setDeleteConfirmed(false);
    setConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const { id, title } = deleteTarget;
    setDeleteConfirmed(true);
    setConfirmOpen(false);
    deleteCv.mutate(id, {
      onSuccess: () => toast.success("CV deleted", { description: title }),
      onError: (error) => toast.error("Couldn't delete the CV", { description: getErrorMessage(error) }),
    });
  };

  const items = cvs.data ?? [];
  const showNewButton = !cvs.isPending && items.length > 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none sm:text-3xl">
            Your CVs
          </h1>
          <p className="mt-1 text-sm text-fg-muted sm:text-base">Drafts focused on the roles you are going for.</p>
        </div>
        {showNewButton && (
          <Link href={NEW_CV_PATH} className={buttonVariants()}>
            <Plus aria-hidden="true" className="size-4" />
            New CV
          </Link>
        )}
      </div>

      {cvs.isPending ? (
        <CvListSkeleton />
      ) : cvs.isError && !cvs.data ? (
        <EmptyState
          tone="danger"
          icon={<CloudOff />}
          title="Couldn't load your CVs"
          description={getErrorMessage(cvs.error)}
          action={
            <Button variant="secondary" onClick={() => void cvs.refetch()} loading={cvs.isFetching}>
              Try again
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No CVs yet"
          description="Upload your current CV as a PDF or paste its text, name the role you want, and get a focused draft in about a minute."
          action={
            <Link href={NEW_CV_PATH} className={buttonVariants({ size: "lg" })}>
              <Sparkles aria-hidden="true" className="size-4" />
              Create your first CV
            </Link>
          }
        />
      ) : (
        <>
          {cvs.isRefetchError && (
            <Alert
              tone="warning"
              title="Couldn't refresh the list"
              action={
                <Button size="sm" variant="secondary" onClick={() => void cvs.refetch()} loading={cvs.isFetching}>
                  Retry
                </Button>
              }
            >
              Showing what was loaded last. {getErrorMessage(cvs.error)}
            </Alert>
          )}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {items.map((cv, index) => (
                <motion.li
                  key={cv.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: Math.min(index, 8) * 0.04 } }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                  className="min-w-0"
                >
                  <CvCard cv={cv} onDelete={requestDelete} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="danger"
        title="Delete this CV?"
        description={
          <>
            <span className="font-medium text-fg">“{deleteTarget?.title.trim() || "Untitled CV"}”</span> and its
            questions will be deleted permanently. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        finalFocusRef={deleteConfirmed ? headingRef : undefined}
      />
    </div>
  );
}

function CvListSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only" role="status">
        Loading your CVs…
      </span>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex h-44 flex-col rounded-xl border border-border bg-surface p-5 shadow-card">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="mt-4 h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
          <Skeleton className="mt-auto h-3 w-28 self-end" />
        </div>
      ))}
    </div>
  );
}
