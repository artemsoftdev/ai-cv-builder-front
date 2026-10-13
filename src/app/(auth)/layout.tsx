import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center px-4 py-10 sm:justify-center sm:py-16">
      {/* Soft accent glow behind the card; purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,var(--color-primary-soft),transparent)]"
      />
      <Logo className="mb-8" />
      <main className="w-full max-w-sm">{children}</main>
    </div>
  );
}
