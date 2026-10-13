"use client";

import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { useRef, type ReactNode } from "react";
import { useFieldArray, useFormContext, type FieldArray, type Path } from "react-hook-form";

import { Button } from "@/components/ui/button";
import type { CvContent } from "@/lib/api/types";

import { ItemReview } from "../review/item-review";
import { ItemActions } from "./item-actions";
import { removeWithUndo } from "./remove-with-undo";
import { SectionCard } from "./section-card";

type EntryName = "experience" | "education" | "skills";
type Entry<N extends EntryName> = CvContent[N][number];

type EntryControls = { index: number; itemId: string; actions: (label: string) => ReactNode };

type EntryListProps<N extends EntryName> = {
  name: N;
  title: string;
  icon: ReactNode;
  updated: boolean;
  max: number;
  emptyText: string;
  addLabel: string;
  removedMessage: string;
  firstField: keyof Entry<N> & string;
  newEntry: () => Entry<N>;
  children: (entry: EntryControls) => ReactNode;
};

// The section and list scaffolding shared by experience, education and skill groups.
export function EntryList<N extends EntryName>(props: EntryListProps<N>) {
  const { name, title, icon, updated, max, emptyText, addLabel, removedMessage, firstField, newEntry, children } = props;
  const { control, getValues, setFocus } = useFormContext<CvContent>();
  const { fields, append, insert, remove, move } = useFieldArray({ control, name, keyName: "key" });
  const addRef = useRef<HTMLButtonElement>(null);

  const removeAt = (index: number) => {
    removeWithUndo<Entry<N>>({
      index,
      items: () => getValues(name) as unknown as Entry<N>[],
      remove,
      insert: (at, entry) => insert(at, entry as FieldArray<CvContent, N>),
      message: removedMessage,
    });
    // The removed entry took the focus with it: move to its neighbour, or to "Add".
    const remaining = fields.length - 1;
    requestAnimationFrame(() => {
      if (remaining > 0) setFocus(`${name}.${Math.min(index, remaining - 1)}.${firstField}` as Path<CvContent>);
      else addRef.current?.focus();
    });
  };

  return (
    <SectionCard section={name} title={title} icon={icon} count={fields.length} updated={updated}>
      {fields.length === 0 ? (
        <p className="text-sm text-fg-muted">{emptyText}</p>
      ) : (
        <ol className="space-y-4">
          {fields.map((field, index) => {
            const itemId = (field as unknown as Entry<N>).id;
            const actions = (label: string) => (
              <ItemActions
                itemId={itemId}
                index={index}
                count={fields.length}
                label={label}
                onMove={move}
                onRemove={() => removeAt(index)}
                className="ml-auto"
              />
            );
            return (
              <motion.li
                key={field.key}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                data-review-scope
                className="rounded-lg border border-border bg-canvas/60 p-3 sm:p-4"
              >
                {children({ index, itemId, actions })}
              </motion.li>
            );
          })}
        </ol>
      )}
      <Button
        ref={addRef}
        variant="secondary"
        size="sm"
        className="mt-4"
        leftIcon={<Plus aria-hidden="true" className="size-4" />}
        disabled={fields.length >= max}
        onClick={() => append(newEntry() as FieldArray<CvContent, N>, { shouldFocus: true })}
      >
        {addLabel}
      </Button>
    </SectionCard>
  );
}

// On phones a "Check" badge would squeeze the heading into a narrow column: the actions wrap instead.
export function EntryHeader({ heading, itemId, actions }: { heading: string; itemId: string; actions: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
      <h3 className="min-w-0 flex-[1_1_8rem] pt-2 text-sm font-semibold break-words text-fg">{heading}</h3>
      <ItemReview itemId={itemId} label={`“${heading}”`} />
      {actions}
    </div>
  );
}
