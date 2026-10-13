import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { WIDE_PAGE } from "@/components/layout/wide-page";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 text-sm font-medium shadow-elevated focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <AppHeader />
      <main id="main" className={`mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-10 ${WIDE_PAGE}`}>
        {children}
      </main>
    </div>
  );
}
