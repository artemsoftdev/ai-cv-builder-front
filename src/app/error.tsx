"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ErrorBoundary({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-lg items-center px-4 py-16">
      <EmptyState
        className="w-full"
        tone="danger"
        icon={<TriangleAlert />}
        title="Something went wrong"
        description="An unexpected error occurred. Your work is saved on the server, so it is safe to try again."
        action={<Button onClick={retry}>Try again</Button>}
      />
    </main>
  );
}
