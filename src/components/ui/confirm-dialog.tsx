"use client";

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";

import { Button } from "./button";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" styles the confirm button red and puts initial focus on Cancel (the safe choice). */
  tone?: "primary" | "danger";
  /** While true the dialog cannot be dismissed and the confirm button shows a spinner. */
  loading?: boolean;
  onConfirm: () => void;
  /**
   * Where focus goes after closing. Defaults to the element that opened the dialog; pass
   * another target when confirming removes that element (e.g. deleting a list item).
   */
  finalFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * Modal confirmation built on the native `<dialog>`: the browser provides the top layer,
 * makes the rest of the page inert and handles Escape. We add initial focus, focus
 * restoration, backdrop click to dismiss and open/close transitions (see `.app-dialog`).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  loading = false,
  onConfirm,
  finalFocusRef,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      (tone === "danger" ? cancelRef : confirmRef).current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, tone]);

  const requestClose = () => {
    if (!loading) onOpenChange(false);
  };

  // Escape: keep the dialog under React's control instead of letting the browser close it.
  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    requestClose();
  };

  // Fired however the dialog ended up closed (including a browser-forced close).
  const handleClose = () => {
    if (open) onOpenChange(false);
    const target = finalFocusRef?.current ?? returnFocusRef.current;
    returnFocusRef.current = null;
    if (target?.isConnected) target.focus();
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    // The dialog box itself has no padding, so a click whose target is the <dialog> hit the backdrop.
    if (event.target === event.currentTarget) requestClose();
  };

  return (
    // Backdrop click is a pointer convenience; Escape (onCancel) is the keyboard equivalent.
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClose={handleClose}
      onClick={handleBackdropClick}
      className="app-dialog m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface p-0 text-fg shadow-elevated"
    >
      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <div id={descriptionId} className="mt-2 text-sm leading-relaxed text-fg-muted">
            {description}
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="secondary" onClick={requestClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
