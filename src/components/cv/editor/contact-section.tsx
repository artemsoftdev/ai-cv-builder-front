"use client";

import { Link2, Plus, Trash2, User } from "lucide-react";
import { useRef } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { API_LIMITS, type CvContent } from "@/lib/api/types";
import { newLink } from "@/lib/cv/new-item";

import { ItemReview } from "../review/item-review";
import { FormTextField } from "./form-text-field";
import { SectionCard } from "./section-card";

export function ContactSection({ updated }: { updated: boolean }) {
  return (
    <SectionCard section="contact" title="Contact" icon={<User />} updated={updated}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormTextField name="contact.fullName" label="Full name" autoComplete="name" className="sm:col-span-2" />
        <FormTextField
          name="contact.headline"
          label="Headline"
          hint="A short professional title, usually close to the target role."
          addon={<ItemReview itemId="headline" label="the headline" />}
          className="sm:col-span-2"
        />
        <FormTextField name="contact.email" label="Email" type="email" inputMode="email" autoComplete="email" />
        <FormTextField name="contact.phone" label="Phone" type="tel" inputMode="tel" autoComplete="tel" />
        <FormTextField
          name="contact.location"
          label="Location"
          placeholder="City, Country"
          autoComplete="address-level2"
          className="sm:col-span-2"
        />
      </div>
      <LinksEditor />
    </SectionCard>
  );
}

function LinksEditor() {
  const { control, setFocus } = useFormContext<CvContent>();
  const { fields, append, remove } = useFieldArray({ control, name: "contact.links", keyName: "key" });
  const max = API_LIMITS.content.links;
  const addRef = useRef<HTMLButtonElement>(null);

  const removeAt = (index: number) => {
    remove(index);
    const remaining = fields.length - 1;
    requestAnimationFrame(() => {
      if (remaining > 0) setFocus(`contact.links.${Math.min(index, remaining - 1)}.label`);
      else addRef.current?.focus();
    });
  };

  return (
    <div className="mt-6 space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-fg">
        <Link2 aria-hidden="true" className="size-4 text-fg-subtle" />
        Links
      </h3>
      {fields.length === 0 && <p className="text-sm text-fg-muted">LinkedIn, GitHub, portfolio…</p>}
      <ul className="space-y-3">
        {fields.map((field, index) => (
          <li key={field.key} className="flex items-start gap-2">
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <FormTextField name={`contact.links.${index}.label`} label={`Link ${index + 1} label`} hideLabel placeholder="Label, e.g. GitHub" />
              <FormTextField
                name={`contact.links.${index}.url`}
                label={`Link ${index + 1} address`}
                hideLabel
                type="url"
                inputMode="url"
                placeholder="github.com/you"
              />
            </div>
            <Button
              variant="danger-ghost"
              size="icon"
              aria-label={`Remove link ${index + 1}`}
              onClick={() => removeAt(index)}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        ref={addRef}
        variant="secondary"
        size="sm"
        leftIcon={<Plus aria-hidden="true" className="size-4" />}
        disabled={fields.length >= max}
        onClick={() => append(newLink(), { shouldFocus: true })}
      >
        {fields.length >= max ? `Up to ${max} links` : "Add link"}
      </Button>
    </div>
  );
}
