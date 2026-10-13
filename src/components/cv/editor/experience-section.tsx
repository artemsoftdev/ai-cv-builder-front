"use client";

import { Briefcase, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { API_LIMITS, type CvContent } from "@/lib/api/types";
import { newExperienceItem } from "@/lib/cv/new-item";

import { BulletList } from "./bullet-list";
import { ItemReview } from "../review/item-review";
import { FormTextField } from "./form-text-field";
import { ItemActions } from "./item-actions";
import { SectionCard } from "./section-card";
import { removeWithUndo } from "./use-undoable-remove";

export function ExperienceSection({ updated }: { updated: boolean }) {
  const { control, getValues } = useFormContext<CvContent>();
  const { fields, append, insert, remove, move } = useFieldArray({ control, name: "experience", keyName: "key" });
  const max = API_LIMITS.content.experienceItems;

  return (
    <SectionCard section="experience" title="Experience" icon={<Briefcase />} count={fields.length} updated={updated}>
      {fields.length === 0 ? (
        <p className="text-sm text-fg-muted">No positions yet.</p>
      ) : (
        <ol className="space-y-4">
          {fields.map((field, index) => (
            <motion.li
              key={field.key}
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              data-review-scope
              className="rounded-lg border border-border bg-canvas/60 p-3 sm:p-4"
            >
              <ExperienceItemEditor
                index={index}
                itemId={field.id}
                count={fields.length}
                onMove={move}
                onRemove={() =>
                  removeWithUndo({
                    index,
                    value: getValues(`experience.${index}`),
                    remove,
                    insert: (at, item) => insert(at, item),
                    message: "Position removed",
                  })
                }
              />
            </motion.li>
          ))}
        </ol>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="mt-4"
        leftIcon={<Plus aria-hidden="true" className="size-4" />}
        disabled={fields.length >= max}
        onClick={() => append(newExperienceItem(), { shouldFocus: true })}
      >
        Add position
      </Button>
    </SectionCard>
  );
}

type ExperienceItemEditorProps = {
  index: number;
  itemId: string;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
};

function ExperienceItemEditor({ index, itemId, count, onMove, onRemove }: ExperienceItemEditorProps) {
  const [title, company] = useWatch<CvContent, [`experience.${number}.title`, `experience.${number}.company`]>({
    name: [`experience.${index}.title`, `experience.${index}.company`],
  });
  const heading = [title, company].map((part) => part.trim()).filter(Boolean).join(" · ") || "New position";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 pt-2 text-sm font-semibold break-words text-fg">{heading}</h3>
        <ItemReview itemId={itemId} label={`“${heading}”`} />
        <ItemActions itemId={itemId} index={index} count={count} label={`position ${heading}`} onMove={onMove} onRemove={onRemove} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormTextField name={`experience.${index}.title`} label="Job title" />
        <FormTextField name={`experience.${index}.company`} label="Company" />
        <FormTextField name={`experience.${index}.location`} label="Location" className="sm:col-span-2" />
        <FormTextField name={`experience.${index}.startDate`} label="Start" placeholder="e.g. Mar 2021" />
        <FormTextField name={`experience.${index}.endDate`} label="End" placeholder="e.g. Present" />
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-fg">Highlights</h4>
        <BulletList itemIndex={index} />
      </div>
    </div>
  );
}
