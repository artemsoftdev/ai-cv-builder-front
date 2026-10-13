import type { ReactNode } from "react";

/**
 * Phone layout: save status and the main action stay reachable at the bottom of the screen
 * (inside the safe area of notched phones).
 */
export function MobileActionBar({ status, action }: { status: ReactNode; action: ReactNode }) {
  return (
    <>
      {/* Keeps the end of the page clear of the fixed bar. */}
      <div aria-hidden="true" className="h-[calc(1rem+env(safe-area-inset-bottom))]" />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">{status}</div>
          <div className="shrink-0">{action}</div>
        </div>
      </div>
    </>
  );
}
