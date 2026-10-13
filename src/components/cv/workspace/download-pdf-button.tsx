"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api/error-messages";
import { pdfFilename } from "@/lib/cv/pdf-filename";
import { useDownloadCvPdf } from "@/lib/query/cv-hooks";

export type SaveCheck = "invalid" | "unsaved" | null;

type DownloadPdfButtonProps = {
  cvId: string;
  title: string;
  /** Saves pending edits first: the PDF is rendered from the server copy. */
  ensureSaved: () => Promise<SaveCheck>;
} & Pick<ButtonProps, "size" | "variant" | "className" | "disabled">;

/**
 * Saves pending edits, fetches the PDF and hands it to the browser as a download (an object
 * URL on a temporary `<a download>`, which also works on iOS Safari).
 */
export function DownloadPdfButton({ cvId, title, ensureSaved, ...buttonProps }: DownloadPdfButtonProps) {
  const download = useDownloadCvPdf(cvId);
  const [saving, setSaving] = useState(false);

  const handleClick = async () => {
    setSaving(true);
    const problem = await ensureSaved();
    setSaving(false);
    if (problem === "invalid") {
      toast.error("Fix the highlighted fields first", { description: "The PDF is made from your saved CV." });
      return;
    }
    if (problem === "unsaved") {
      toast.error("Your latest edits aren't saved yet", {
        description: "The PDF would miss them. Check your connection and try again.",
      });
      return;
    }
    download.mutate(pdfFilename(title), {
      onError: (error) => toast.error("Couldn't download the PDF", { description: getErrorMessage(error) }),
    });
  };

  return (
    <Button
      onClick={() => void handleClick()}
      loading={saving || download.isPending}
      leftIcon={<Download aria-hidden="true" className="size-4" />}
      {...buttonProps}
    >
      {download.isPending ? "Preparing PDF…" : "Download PDF"}
    </Button>
  );
}
