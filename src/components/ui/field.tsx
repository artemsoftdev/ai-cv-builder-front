"use client";

import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

import { FieldError } from "./field-error";
import { Label } from "./label";

/** Props to spread onto the control so label, hint and error are wired for assistive tech. */
export type FieldControlProps = {
  id: string;
  "aria-describedby": string | undefined;
  invalid: boolean;
};

type FieldProps = {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  /** Use a fixed id (e.g. to link to the field); generated otherwise. */
  id?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

/**
 * Label + control + hint + error with correct `htmlFor` / `aria-describedby` wiring.
 *
 * @example
 * <Field label="Email" error={errors.email?.message}>
 *   {(control) => <Input type="email" {...control} {...register("email")} />}
 * </Field>
 */
export function Field({ label, error, hint, optional, id, className, children }: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  // The error replaces the hint, so only one of them is ever described.
  const hintId = hint && !error ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={controlId} optional={optional}>
        {label}
      </Label>
      {children({ id: controlId, "aria-describedby": describedBy, invalid: Boolean(error) })}
      {hintId && (
        <p id={hintId} className="text-sm text-fg-muted">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}
