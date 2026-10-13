import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type AlertTone = "info" | "success" | "warning" | "danger";

const tones: Record<AlertTone, { box: string; Icon: typeof Info }> = {
  info: { box: "bg-primary-soft text-primary-soft-fg border-primary/15", Icon: Info },
  success: { box: "bg-success-soft text-success-soft-fg border-success/20", Icon: CircleCheck },
  warning: { box: "bg-warning-soft text-warning-soft-fg border-warning/25", Icon: TriangleAlert },
  danger: { box: "bg-danger-soft text-danger-soft-fg border-danger/15", Icon: CircleAlert },
};

type AlertProps = {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
};

// danger and warning use role="alert", so a message appearing after an action is announced.
export function Alert({ tone = "info", title, children, action, className }: AlertProps) {
  const { box, Icon } = tones[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-start",
        box,
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 gap-2.5">
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 space-y-0.5">
          {title && <p className="font-medium">{title}</p>}
          {children && <div className="break-words">{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0 sm:ml-auto">{action}</div>}
    </div>
  );
}
