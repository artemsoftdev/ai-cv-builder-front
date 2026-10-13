"use client";

import { toast } from "sonner";

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
  // Detached copy: RHF recycles the removed value object.
  const removed = structuredClone(value);
  remove(index);
  toast(message, { action: { label: "Undo", onClick: () => insert(index, removed) } });
}
