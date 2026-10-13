import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";

/**
 * Shell of every signed-in page. The proxy already turned away visitors without a session
 * cookie; the header's `useMe()` (and every other query) verifies the session with the API,
 * and a 401 redirects to /login. Children render in parallel with that check rather than
 * waiting for it, so the common (valid session) case is not slowed down.
 */
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
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        {children}
      </main>
    </div>
  );
}
