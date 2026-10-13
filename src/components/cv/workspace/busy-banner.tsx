import { Spinner } from "@/components/ui/spinner";

export function BusyBanner({ connectionLost }: { connectionLost: boolean }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary-soft px-4 py-3 text-sm text-primary-soft-fg"
    >
      <Spinner size="sm" className="mt-0.5" />
      <div className="min-w-0">
        <p className="font-medium">Updating your CV with your answer…</p>
        <p className="mt-0.5 text-primary-soft-fg/80">
          {connectionLost
            ? "Connection lost. The update continues on the server; we'll pick it up when you're back online."
            : "Editing is paused until Claude is done, so your changes and Claude's don't collide."}
        </p>
      </div>
    </div>
  );
}
