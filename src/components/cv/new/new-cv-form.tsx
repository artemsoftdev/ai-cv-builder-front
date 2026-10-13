"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, FileUp, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId } from "react";
import { Controller, useForm, useWatch, type UseFormSetError } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { panelId, SegmentedTabs, tabId } from "@/components/ui/segmented-tabs";
import { Textarea } from "@/components/ui/textarea";
import { describeGenerationLimit, getErrorMessage } from "@/lib/api/error-messages";
import { isApiError } from "@/lib/api/errors";
import { API_LIMITS } from "@/lib/api/types";
import { readTextDraft, writeTextDraft } from "@/lib/cv/drafts";
import { applyServerError, SERVER_ERROR } from "@/lib/forms/apply-server-error";
import { useCreateCv } from "@/lib/query/cv-hooks";
import { cn } from "@/lib/utils/cn";
import { formatFileSize } from "@/lib/utils/format";
import {
  newCvSchema,
  sourceTextLength,
  type NewCvSubmitValues,
  type NewCvValues,
  type SourceMode,
} from "@/lib/validation/new-cv";

import { PdfDropzone } from "./pdf-dropzone";

const SOURCE_OPTIONS = [
  { value: "pdf", label: "Upload PDF", icon: <FileUp aria-hidden="true" className="size-4 shrink-0" /> },
  { value: "text", label: "Paste text", icon: <FileText aria-hidden="true" className="size-4 shrink-0" /> },
] as const;

const EXAMPLE_ROLES = [
  "Senior Backend Engineer",
  "Frontend Developer",
  "Product Manager",
  "Data Analyst",
  "Engineering Manager",
];

function showCreateError(error: unknown, source: SourceMode, setError: UseFormSetError<NewCvValues>): void {
  if (isApiError(error, "FILE_TOO_LARGE")) {
    setError("file", {
      type: "server",
      message: `This PDF is larger than ${formatFileSize(API_LIMITS.pdf.maxBytes)}. Try a smaller export or paste the text instead.`,
    });
  } else if (isApiError(error, "UNSUPPORTED_FILE")) {
    setError("file", {
      type: "server",
      message: "This file isn't a valid PDF. Export your CV to PDF again, or paste the text instead.",
    });
  } else if (isApiError(error, "UNPROCESSABLE_SOURCE")) {
    const message = getErrorMessage(error);
    setError(source === "pdf" ? "file" : "text", {
      type: "server",
      message: source === "pdf" ? `${message} Try another export, or paste the text instead.` : message,
    });
  } else if (isApiError(error, "RATE_LIMITED")) {
    setError(SERVER_ERROR, { type: "server", message: describeGenerationLimit(error) });
  } else {
    applyServerError(error, setError, ["targetRole", "text", "file"]);
  }
}

const DRAFT_KEY = "new-cv";

// Pasted text can be long: a reload or a discarded tab must not lose it (a picked file can't be kept).
function readNewCvDraft(): { source: SourceMode; targetRole: string; text: string } | null {
  try {
    const draft: unknown = JSON.parse(readTextDraft(DRAFT_KEY) ?? "null");
    if (typeof draft !== "object" || draft === null) return null;
    const { source, targetRole, text } = draft as Record<string, unknown>;
    if (typeof targetRole !== "string" || typeof text !== "string") return null;
    return { source: source === "text" ? "text" : "pdf", targetRole, text };
  } catch {
    return null;
  }
}

export function NewCvForm() {
  const router = useRouter();
  const createCv = useCreateCv();
  const tabsId = useId();
  const {
    control,
    register,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    clearErrors,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<NewCvValues, unknown, NewCvSubmitValues>({
    resolver: zodResolver(newCvSchema),
    defaultValues: { source: "pdf", targetRole: "", text: "", file: null },
    mode: "onTouched",
  });

  const source = useWatch({ control, name: "source" });
  const targetRole = useWatch({ control, name: "targetRole" });
  const text = useWatch({ control, name: "text" });
  const textLength = sourceTextLength(text);

  useEffect(() => {
    const draft = readNewCvDraft();
    if (!draft) return;
    setValue("source", draft.source);
    setValue("targetRole", draft.targetRole);
    setValue("text", draft.text);
  }, [setValue]);

  useEffect(() => {
    const empty = !targetRole.trim() && !text.trim();
    writeTextDraft(DRAFT_KEY, empty ? "" : JSON.stringify({ source, targetRole, text }));
  }, [source, targetRole, text]);

  const changeSource = (mode: SourceMode) => {
    setValue("source", mode);
    clearErrors(["file", "text"]);
    clearErrors(SERVER_ERROR);
  };

  const onSubmit = handleSubmit(async (values) => {
    const input =
      values.source === "pdf" && values.file
        ? { targetRole: values.targetRole, file: values.file }
        : { targetRole: values.targetRole, text: values.text.trim() };
    try {
      const cv = await createCv.mutateAsync(input);
      writeTextDraft(DRAFT_KEY, "");
      router.push(`/cvs/${encodeURIComponent(cv.id)}`);
    } catch (error) {
      showCreateError(error, values.source, setError);
      if (isApiError(error, "VALIDATION_ERROR") || isApiError(error, "RATE_LIMITED")) return;
      setFocus(values.source === "pdf" ? "file" : "text");
    }
  });

  const busy = isSubmitting || createCv.isSuccess;
  const fileErrorId = `${tabsId}-file-error`;
  const textCounterId = `${tabsId}-text-counter`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {errors.root?.server?.message && (
        <Alert tone="danger" title="Couldn't start the generation">
          {errors.root.server.message}
        </Alert>
      )}

      <section className="space-y-4" aria-labelledby={`${tabsId}-source-heading`}>
        <div className="space-y-1">
          <h2 id={`${tabsId}-source-heading`} className="text-base font-semibold text-fg">
            1. Your current CV
          </h2>
          <p className="text-sm text-fg-muted">A PDF export or the plain text of your CV, LinkedIn profile or notes.</p>
        </div>

        <SegmentedTabs
          label="How do you want to add your CV?"
          idPrefix={tabsId}
          options={SOURCE_OPTIONS}
          value={source}
          onChange={changeSource}
          className="sm:max-w-sm"
        />

        <div
          role="tabpanel"
          id={panelId(tabsId, "pdf")}
          aria-labelledby={tabId(tabsId, "pdf")}
          hidden={source !== "pdf"}
          className="space-y-1.5"
        >
          <Label htmlFor={`${tabsId}-file`} className="sr-only">
            CV file (PDF)
          </Label>
          <Controller
            control={control}
            name="file"
            render={({ field }) => (
              <PdfDropzone
                id={`${tabsId}-file`}
                file={field.value}
                inputRef={field.ref}
                onFileChange={(file) => {
                  field.onChange(file);
                  if (file) void trigger("file");
                  else clearErrors("file");
                }}
                invalid={Boolean(errors.file)}
                aria-describedby={errors.file ? fileErrorId : undefined}
                disabled={busy}
              />
            )}
          />
          <FieldError id={fileErrorId} message={errors.file?.message} />
        </div>

        <div
          role="tabpanel"
          id={panelId(tabsId, "text")}
          aria-labelledby={tabId(tabsId, "text")}
          hidden={source !== "text"}
        >
          <Field label="CV text" error={errors.text?.message}>
            {({ "aria-describedby": describedBy, ...control }) => (
              <Textarea
                rows={12}
                placeholder="Paste your experience, education, skills and contact details. Messy formatting is fine."
                className="max-h-[60dvh]"
                aria-describedby={[describedBy, textCounterId].filter(Boolean).join(" ")}
                disabled={busy}
                {...control}
                {...register("text")}
              />
            )}
          </Field>
          <p
            id={textCounterId}
            className={cn(
              "mt-1.5 text-right text-xs tabular-nums",
              textLength > API_LIMITS.sourceText.max ? "text-danger-soft-fg" : "text-fg-subtle",
            )}
          >
            {textLength.toLocaleString("en")} / {API_LIMITS.sourceText.max.toLocaleString("en")} characters
            {textLength < API_LIMITS.sourceText.min && ` (at least ${API_LIMITS.sourceText.min})`}
          </p>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby={`${tabsId}-role-heading`}>
        <div className="space-y-1">
          <h2 id={`${tabsId}-role-heading`} className="text-base font-semibold text-fg">
            2. The role you want
          </h2>
          <p className="text-sm text-fg-muted">
            The summary is written for this role and your most relevant experience goes first.
          </p>
        </div>
        <Field label="Target role" error={errors.targetRole?.message}>
          {(control) => (
            <Input
              placeholder="e.g. Senior Backend Engineer"
              autoComplete="off"
              enterKeyHint="go"
              disabled={busy}
              {...control}
              {...register("targetRole")}
            />
          )}
        </Field>
        <div role="group" aria-label="Example roles" className="flex flex-wrap gap-2">
          {EXAMPLE_ROLES.map((role) => {
            const selected = targetRole.trim() === role;
            return (
              <button
                key={role}
                type="button"
                aria-pressed={selected}
                disabled={busy}
                onClick={() => setValue("targetRole", role, { shouldValidate: true, shouldDirty: true, shouldTouch: true })}
                className={cn(
                  "inline-flex h-10 items-center rounded-full border px-3.5 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:opacity-55",
                  selected
                    ? "border-primary/30 bg-primary-soft text-primary-soft-fg"
                    : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
                )}
              >
                {role}
              </button>
            );
          })}
        </div>
      </section>

      <div className="space-y-3 border-t border-border pt-6">
        <Button
          type="submit"
          size="lg"
          loading={busy}
          leftIcon={<Sparkles aria-hidden="true" className="size-4" />}
          className="w-full sm:w-auto"
        >
          {busy ? "Starting…" : "Generate my CV"}
        </Button>
        <p className="text-sm text-fg-muted">
          Takes about a minute. Claude only rephrases what is in your source; anything missing becomes a question for
          you.
        </p>
      </div>
    </form>
  );
}
