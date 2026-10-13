"use client";

import { FileText, FileUp, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type RefCallback } from "react";

import { Button } from "@/components/ui/button";
import { API_LIMITS } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { formatFileSize } from "@/lib/utils/format";

type PdfDropzoneProps = {
  id: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  invalid?: boolean;
  "aria-describedby"?: string;
  disabled?: boolean;
  /** The file input (for react-hook-form focus management). */
  inputRef?: RefCallback<HTMLInputElement>;
};

const ACCEPT = "application/pdf,.pdf";

const hasFiles = (event: { dataTransfer: DataTransfer | null }) =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");

/**
 * File picker for the CV PDF: drag & drop, click/tap, or keyboard (the real, visually
 * hidden `<input type="file">` is focusable and its label is the drop zone). Validation
 * is left to the form so all messages live in one place.
 */
export function PdfDropzone({
  id,
  file,
  onFileChange,
  invalid = false,
  "aria-describedby": describedBy,
  disabled = false,
  inputRef,
}: PdfDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave also fire for every child element; count them to know when we really left.
  const dragDepth = useRef(0);
  const localInputRef = useRef<HTMLInputElement | null>(null);

  // A file dropped next to the zone would make the browser open it and leave the page.
  useEffect(() => {
    const preventFileDrop = (event: globalThis.DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    window.addEventListener("dragover", preventFileDrop);
    window.addEventListener("drop", preventFileDrop);
    return () => {
      window.removeEventListener("dragover", preventFileDrop);
      window.removeEventListener("drop", preventFileDrop);
    };
  }, []);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    // Reset so choosing the same file again still fires `change`.
    event.target.value = "";
    if (selected) onFileChange(selected);
  };

  const handleDragEnter = (event: DragEvent) => {
    if (disabled || !hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };

  const handleDragOver = (event: DragEvent) => {
    if (disabled || !hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files[0];
    if (dropped) onFileChange(dropped);
  };

  const removeFile = () => {
    onFileChange(null);
    localInputRef.current?.focus();
  };

  const setInputRef = (element: HTMLInputElement | null) => {
    localInputRef.current = element;
    inputRef?.(element);
  };

  return (
    <div className="relative">
      <label
        htmlFor={id}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-5 py-8 text-center",
          "transition-[border-color,background-color,box-shadow] duration-150",
          "has-[:focus-visible]:border-primary has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring",
          dragging
            ? "border-primary bg-primary-soft"
            : invalid
              ? "border-danger/60 bg-danger-soft/40 hover:border-danger"
              : "border-border-strong bg-surface-muted/50 hover:border-primary/60 hover:bg-primary-soft/40",
          file && !dragging && !invalid && "border-solid border-border bg-surface",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={setInputRef}
          id={id}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={handleChange}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
        {file ? (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "flex size-12 items-center justify-center rounded-xl",
                invalid ? "bg-danger-soft text-danger-soft-fg" : "bg-primary-soft text-primary-soft-fg",
              )}
            >
              <FileText className="size-6" />
            </span>
            <span className="flex max-w-full min-w-0 flex-col items-center gap-0.5 px-8">
              <span className="max-w-full truncate text-sm font-medium text-fg">{file.name}</span>
              <span className="text-xs text-fg-muted">
                {formatFileSize(file.size)} · <span className="text-primary">click or drop to replace</span>
              </span>
            </span>
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "flex size-12 items-center justify-center rounded-xl transition-transform",
                dragging ? "scale-110 bg-primary text-primary-fg" : "bg-primary-soft text-primary-soft-fg",
              )}
            >
              <FileUp className="size-6" />
            </span>
            <span className="text-sm text-fg">
              {dragging ? (
                "Drop your PDF here"
              ) : (
                <>
                  <span className="font-medium text-primary">Choose a PDF</span>
                  <span className="hidden sm:inline"> or drag it here</span>
                </>
              )}
            </span>
            <span className="text-xs text-fg-muted">
              Up to {formatFileSize(API_LIMITS.pdf.maxBytes)} and {API_LIMITS.pdf.maxPages} pages
            </span>
          </>
        )}
      </label>
      {file && (
        // Outside the <label>, so pressing it does not also open the file dialog.
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={removeFile}
          disabled={disabled}
          aria-label={`Remove ${file.name}`}
          className="absolute top-2 right-2"
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      )}
    </div>
  );
}
