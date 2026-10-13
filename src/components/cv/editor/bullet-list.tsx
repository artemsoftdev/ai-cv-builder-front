"use client";

import { Plus } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { useFieldArray, useFormContext, type UseFieldArrayInsert } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { API_LIMITS, type CvContent } from "@/lib/api/types";
import { newBullet } from "@/lib/cv/new-item";
import { isComposing } from "@/lib/utils/ime";

import { ItemReview } from "../review/item-review";
import { FormTextField } from "./form-text-field";
import { ItemActions } from "./item-actions";

type ExperienceIndex = number;

export function BulletList({ itemIndex }: { itemIndex: ExperienceIndex }) {
  const { control, setFocus } = useFormContext<CvContent>();
  const addRef = useRef<HTMLButtonElement>(null);
  const { fields, append, insert, remove, move } = useFieldArray({
    control,
    name: `experience.${itemIndex}.bullets`,
    keyName: "key",
  });
  const max = API_LIMITS.content.bulletsPerItem;
  const full = fields.length >= max;

  const removeAt = (index: number) => {
    remove(index);
    // The removed bullet took the focus with it: move to its neighbour, or to "Add".
    const remaining = fields.length - 1;
    requestAnimationFrame(() => {
      if (remaining > 0) setFocus(`experience.${itemIndex}.bullets.${Math.min(index, remaining - 1)}.text`);
      else addRef.current?.focus();
    });
  };

  return (
    <div className="space-y-2">
      {fields.length > 0 && (
        <ul className="space-y-3 sm:space-y-2">
          {fields.map((field, index) => (
            <li key={field.key} data-review-scope className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
              <FormTextField
                name={`experience.${itemIndex}.bullets.${index}.text`}
                label={`Highlight ${index + 1}`}
                hideLabel
                multiline
                rows={1}
                maxLength={API_LIMITS.content.bullet}
                placeholder="What you did and what changed because of it"
                className="flex-1"
                // Without field-sizing support (Firefox) a one-line box would hide most of the bullet.
                controlClassName="min-h-11 not-supports-[field-sizing:content]:min-h-24"
                onKeyDown={(event) => onBulletKeyDown(event, index, full, insert)}
              />
              <div className="flex items-center justify-end">
                <ItemReview itemId={field.id} label={`highlight ${index + 1}`} className="mr-auto sm:mr-0" />
                <ItemActions
                  itemId={field.id}
                  index={index}
                  count={fields.length}
                  label={`highlight ${index + 1}`}
                  onMove={move}
                  onRemove={() => removeAt(index)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button
        ref={addRef}
        variant="ghost"
        size="sm"
        leftIcon={<Plus aria-hidden="true" className="size-4" />}
        disabled={full}
        onClick={() => append(newBullet(), { shouldFocus: true })}
        className="-ml-2"
      >
        {full ? `Up to ${max} highlights` : "Add highlight"}
      </Button>
    </div>
  );
}

// Enter adds a bullet below: bullets are single lines on the CV.
function onBulletKeyDown(
  event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  index: number,
  full: boolean,
  insert: UseFieldArrayInsert<CvContent, `experience.${number}.bullets`>,
) {
  if (event.key !== "Enter" || event.shiftKey || isComposing(event)) return;
  event.preventDefault();
  if (!full) insert(index + 1, newBullet(), { shouldFocus: true });
}
