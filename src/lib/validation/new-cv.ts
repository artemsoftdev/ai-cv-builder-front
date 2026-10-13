import { z } from "zod";

import { API_LIMITS } from "@/lib/api/types";
import { validatePdfFile } from "@/lib/cv/validate-pdf-file";

const { targetRole: ROLE, sourceText: TEXT } = API_LIMITS;

export type SourceMode = "pdf" | "text";

/** Number of characters that count towards the source text limits (the API trims). */
export const sourceTextLength = (text: string) => text.trim().length;

/**
 * Both sources live in the form so switching tabs keeps what was entered; only the
 * selected one is validated and sent.
 */
export const newCvSchema = z
  .object({
    source: z.enum(["pdf", "text"]),
    targetRole: z
      .string()
      .trim()
      .min(ROLE.min, "Enter the role you are applying for")
      .max(ROLE.max, `Keep the role under ${ROLE.max} characters`),
    text: z.string(),
    file: z.custom<File | null>((value) => value === null || (typeof File !== "undefined" && value instanceof File)),
  })
  .superRefine((values, ctx) => {
    if (values.source === "pdf") {
      const message = values.file ? validatePdfFile(values.file) : "Choose your CV as a PDF file";
      if (message) ctx.addIssue({ code: "custom", path: ["file"], message });
      return;
    }
    const length = sourceTextLength(values.text);
    if (length < TEXT.min) {
      ctx.addIssue({
        code: "custom",
        path: ["text"],
        message: `Paste at least ${TEXT.min} characters: your experience, education and skills.`,
      });
    } else if (length > TEXT.max) {
      ctx.addIssue({
        code: "custom",
        path: ["text"],
        message: `That's ${length.toLocaleString("en")} characters; the limit is ${TEXT.max.toLocaleString("en")}. Remove anything that isn't part of your CV.`,
      });
    }
  });

export type NewCvValues = z.input<typeof newCvSchema>;
export type NewCvSubmitValues = z.output<typeof newCvSchema>;
