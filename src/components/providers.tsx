"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import { handleSessionExpired } from "@/lib/auth/session";
import { createQueryClient } from "@/lib/query/query-client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = createQueryClient({
      // Drop everything cached for the old session, then go to /login?next=<here>.
      onUnauthorized: () => void handleSessionExpired(() => client.clear()),
    });
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster position="top-center" closeButton richColors toastOptions={{ className: "font-sans" }} />
      </MotionConfig>
    </QueryClientProvider>
  );
}
