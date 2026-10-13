"use client";

import { Pencil } from "lucide-react";
import { useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { CV_TITLE_MAX, cvTitleSchema } from "@/lib/cv/content-schema";

type TitleEditorProps = {
  title: string;
  onSave: (title: string) => void;
  disabled: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

export function TitleEditor({ title, onSave, disabled, headingRef }: TitleEditorProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const editing = draft !== null;

  const finish = () => {
    setDraft(null);
    setError(null);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const commit = (fromBlur: boolean) => {
    if (draft === null) return;
    const result = cvTitleSchema.safeParse(draft);
    if (!result.success) {
      // Leaving the field with an invalid title just drops the edit.
      if (fromBlur) finish();
      else setError(result.error.issues[0]?.message ?? "Enter a title");
      return;
    }
    if (result.data !== title) onSave(result.data);
    finish();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    commit(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
    }
  };

  if (editing) {
    return (
      <form onSubmit={handleSubmit} noValidate className="space-y-1.5">
        <Input
          aria-label="CV title"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(true)}
          maxLength={CV_TITLE_MAX}
          invalid={Boolean(error)}
          aria-describedby={error ? "cv-title-error" : undefined}
          enterKeyHint="done"
          // The user just asked to edit this field.
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          className="h-12 text-xl font-semibold tracking-tight sm:text-2xl"
        />
        <FieldError id="cv-title-error" message={error ?? undefined} />
      </form>
    );
  }

  return (
    <h1 ref={headingRef} tabIndex={-1} className="min-w-0 outline-none">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setDraft(title)}
        disabled={disabled}
        className="group -mx-1.5 flex max-w-full items-start gap-2 rounded-lg px-1.5 text-left text-2xl font-semibold tracking-tight break-words text-fg transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:hover:bg-transparent sm:text-3xl"
      >
        <span className="min-w-0">{title}</span>
        <span className="sr-only">, rename</span>
        <Pencil
          aria-hidden="true"
          className="mt-2 size-4 shrink-0 text-fg-subtle opacity-70 transition-opacity group-hover:opacity-100 group-disabled:hidden sm:mt-3"
        />
      </button>
    </h1>
  );
}
