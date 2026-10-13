"use client";

import { useId, type HTMLAttributes, type HTMLInputTypeAttribute, type KeyboardEvent, type ReactNode } from "react";
import { useFormContext, useFormState, useWatch, type Path } from "react-hook-form";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CvContent } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";

type FormTextFieldProps = {
  name: Path<CvContent>;
  label: string;
  /** Visually hidden label (the context makes it obvious, e.g. a bullet). */
  hideLabel?: boolean;
  multiline?: boolean;
  rows?: number;
  /** Shows a character counter once the text gets close to this limit. */
  maxLength?: number;
  hint?: ReactNode;
  /** Rendered next to the label, outside it (e.g. review badges). */
  addon?: ReactNode;
  className?: string;
  controlClassName?: string;
  placeholder?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Input only. */
  type?: HTMLInputTypeAttribute;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
};

/** A text input or textarea registered with the editor form, with its error and hint wired up. */
export function FormTextField({
  name,
  label,
  hideLabel = false,
  multiline = false,
  rows,
  maxLength,
  hint,
  addon,
  className,
  controlClassName,
  placeholder,
  onKeyDown,
  type,
  inputMode,
  autoComplete,
}: FormTextFieldProps) {
  const { register, getFieldState, control } = useFormContext<CvContent>();
  const formState = useFormState({ control, name });
  const { error } = getFieldState(name, formState);
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error?.message ? `${id}-error` : undefined;
  const counterId = maxLength ? `${id}-counter` : undefined;
  const describedBy = [errorId, hintId, counterId].filter(Boolean).join(" ") || undefined;

  const controlProps = {
    id,
    placeholder,
    onKeyDown,
    "aria-describedby": describedBy,
    invalid: Boolean(error),
    ...register(name),
  };

  return (
    <div data-review-scope className={cn("min-w-0 space-y-1.5", className)}>
      <div className={cn("flex min-h-5 items-center justify-between gap-2", hideLabel && !addon && "sr-only")}>
        <Label htmlFor={id} className={cn(hideLabel && "sr-only")}>
          {label}
        </Label>
        {addon && <span className="-my-2 flex shrink-0 items-center gap-0.5">{addon}</span>}
      </div>
      {multiline ? (
        <Textarea rows={rows} className={controlClassName} {...controlProps} />
      ) : (
        <Input
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          className={controlClassName}
          {...controlProps}
        />
      )}
      {hint && !error && (
        <p id={hintId} className="text-sm text-fg-muted">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error?.message} />
      {maxLength && <CharacterCounter id={counterId} name={name} max={maxLength} />}
    </div>
  );
}

/** "1,234 / 1,500", only once the text uses most of its limit. */
function CharacterCounter({ id, name, max }: { id?: string; name: Path<CvContent>; max: number }) {
  const value = useWatch<CvContent>({ name });
  const length = typeof value === "string" ? value.length : 0;
  if (length < max * 0.8) return <span id={id} hidden />;
  return (
    <p id={id} className={cn("text-right text-xs tabular-nums", length > max ? "text-danger-soft-fg" : "text-fg-subtle")}>
      {length.toLocaleString("en")} / {max.toLocaleString("en")}
    </p>
  );
}
