"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils/cn";

import { Input, type InputProps } from "./input";

/** Password field with a show/hide toggle (typing passwords on a phone is error-prone). */
export function PasswordInput({ className, ...props }: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-12", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        disabled={props.disabled}
        className="absolute inset-y-0.5 right-0.5 inline-flex w-11 items-center justify-center rounded-md text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
      >
        {visible ? <EyeOff aria-hidden="true" className="size-4.5" /> : <Eye aria-hidden="true" className="size-4.5" />}
      </button>
    </div>
  );
}
