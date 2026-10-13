"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

type ItemActionsProps = {
  /** Stable DOM id prefix of the item (its content id), used to keep focus after moving. */
  itemId: string;
  index: number;
  count: number;
  /** Accessible description of the item, e.g. "position Senior Engineer". */
  label: string;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  className?: string;
};

const buttonId = (itemId: string, action: "up" | "down") => `item-${itemId}-${action}`;

/**
 * Move up / move down / remove buttons for one entry of a list. Each accessible name starts
 * with its tooltip text ("Move up, highlight 2"), so speech users can say what they see.
 */
export function ItemActions({ itemId, index, count, label, onMove, onRemove, className }: ItemActionsProps) {
  const move = (direction: "up" | "down") => {
    const to = direction === "up" ? index - 1 : index + 1;
    onMove(index, to);
    // The entry is re-rendered at its new position; keep focus on the same control (or the
    // other arrow when it reached the end of the list).
    requestAnimationFrame(() => {
      const atEdge = direction === "up" ? to === 0 : to === count - 1;
      const target = atEdge ? (direction === "up" ? "down" : "up") : direction;
      document.getElementById(buttonId(itemId, target))?.focus();
    });
  };

  return (
    <div className={cn("flex shrink-0 items-center", className)}>
      <Tooltip content="Move up">
        <Button
          id={buttonId(itemId, "up")}
          variant="ghost"
          size="icon-sm"
          aria-label={`Move up, ${label}`}
          disabled={index === 0}
          onClick={() => move("up")}
        >
          <ArrowUp aria-hidden="true" className="size-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Move down">
        <Button
          id={buttonId(itemId, "down")}
          variant="ghost"
          size="icon-sm"
          aria-label={`Move down, ${label}`}
          disabled={index === count - 1}
          onClick={() => move("down")}
        >
          <ArrowDown aria-hidden="true" className="size-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Remove" align="end">
        <Button variant="danger-ghost" size="icon-sm" aria-label={`Remove ${label}`} onClick={onRemove}>
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </Tooltip>
    </div>
  );
}
