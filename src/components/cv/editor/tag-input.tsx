"use client";

import { X } from "lucide-react";
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils/cn";

type TagInputProps = {
  id: string;
  value: string[];
  onChange: (items: string[]) => void;
  onBlur?: () => void;
  max: number;
  maxItemLength: number;
  invalid?: boolean;
  "aria-describedby"?: string;
  disabled?: boolean;
  placeholder?: string;
};

const SEPARATOR = /[,\n]/;

// Commas are handled on change, not keydown: Android keyboards report most keys as "Unidentified".
export function TagInput({
  id,
  value,
  onChange,
  onBlur,
  max,
  maxItemLength,
  invalid = false,
  "aria-describedby": describedBy,
  disabled = false,
  placeholder = "Type and press Enter",
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const full = value.length >= max;

  const add = (text: string) => {
    const next = [...value];
    for (const raw of text.split(SEPARATOR)) {
      const item = raw.trim().slice(0, maxItemLength);
      if (!item || next.length >= max) continue;
      if (!next.some((existing) => existing.toLowerCase() === item.toLowerCase())) next.push(item);
    }
    if (next.length !== value.length) onChange(next);
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    inputRef.current?.focus();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    if (!SEPARATOR.test(text)) {
      setDraft(text);
      return;
    }
    const lastSeparator = Math.max(text.lastIndexOf(","), text.lastIndexOf("\n"));
    add(text.slice(0, lastSeparator));
    setDraft(text.slice(lastSeparator + 1).trimStart());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      add(draft);
      setDraft("");
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      event.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (draft.trim()) {
      add(draft);
      setDraft("");
    }
    onBlur?.();
  };

  return (
    <div
      className={cn(
        "flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface p-1.5 shadow-card",
        "transition-[border-color,box-shadow] duration-150 hover:border-border-strong",
        "focus-within:border-primary focus-within:ring-4 focus-within:ring-ring",
        invalid && "border-danger focus-within:ring-danger/25",
        disabled && "cursor-not-allowed bg-surface-muted opacity-70",
      )}
    >
      {value.length > 0 && (
        <ul className="contents">
          {value.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className="inline-flex h-8 max-w-full min-w-0 items-center gap-1 rounded-md bg-surface-muted pr-1 pl-2.5 text-sm text-fg ring-1 ring-border ring-inset"
            >
              <span className="truncate">{item}</span>
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={disabled}
                aria-label={`Remove ${item}`}
                className="relative flex size-6 shrink-0 items-center justify-center rounded text-fg-subtle transition-colors after:absolute after:-inset-2 hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        id={id}
        value={draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={disabled || full}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        enterKeyHint="enter"
        autoComplete="off"
        placeholder={full ? `Limit of ${max} reached` : value.length > 0 ? "Add more…" : placeholder}
        className="h-8 min-w-32 flex-1 bg-transparent px-1.5 text-base text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed sm:text-sm"
      />
    </div>
  );
}
