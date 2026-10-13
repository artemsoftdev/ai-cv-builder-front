"use client";

import { toast } from "sonner";

type RemoveWithUndoOptions<T extends { id: string }> = {
  index: number;
  items: () => readonly T[];
  remove: (index: number) => void;
  insert: (index: number, value: T) => void;
  message: string;
};

export function removeWithUndo<T extends { id: string }>({ index, items, remove, insert, message }: RemoveWithUndoOptions<T>) {
  const before = items();
  const target = before[index];
  if (!target) return;
  // Detached copy: RHF recycles the removed value object.
  const removed = structuredClone(target);
  const nextId = before[index + 1]?.id;
  remove(index);
  toast(message, {
    action: {
      label: "Undo",
      onClick: () => {
        const current = items();
        // Already back (e.g. a newer version from the server has it): a second copy would duplicate its id.
        if (current.some((item) => item.id === removed.id)) return;
        // Other entries may have moved or gone since: go back in front of the same neighbour.
        const at = nextId === undefined ? -1 : current.findIndex((item) => item.id === nextId);
        insert(at >= 0 ? at : Math.min(index, current.length), removed);
      },
    },
  });
}
