"use client";

import { toast } from "sonner";

/**
 * Removes a list entry and offers "Undo" in a toast. Autosave persists the removal within a
 * second, so this is the safety net for a mis-tap on a whole job or education entry.
 */
export function removeWithUndo<T>({
  index,
  value,
  remove,
  insert,
  message,
}: {
  index: number;
  value: T;
  remove: (index: number) => void;
  insert: (index: number, value: T) => void;
  message: string;
}): void {
  // Detached copy: the form's value object is recycled after removal.
  const removed = structuredClone(value);
  remove(index);
  toast(message, { action: { label: "Undo", onClick: () => insert(index, removed) } });
}
