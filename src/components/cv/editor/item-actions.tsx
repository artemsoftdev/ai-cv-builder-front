"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

type ItemActionsProps = {
  itemId: string;
  index: number;
  count: number;
  label: string;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  className?: string;
};

const buttonId = (itemId: string, action: "up" | "down") => `item-${itemId}-${action}`;

export function ItemActions({ itemId, index, count, label, onMove, onRemove, className }: ItemActionsProps) {
  const move = (direction: "up" | "down") => {
    const to = direction === "up" ? index - 1 : index + 1;
    onMove(index, to);
    // Refocus the same arrow at the new position, or the other one at the end of the list.
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
