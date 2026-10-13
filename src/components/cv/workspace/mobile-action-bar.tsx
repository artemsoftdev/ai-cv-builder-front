import type { ReactNode } from "react";

export function MobileActionBar({ status, action }: { status: ReactNode; action: ReactNode }) {
  return (
    <>
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
