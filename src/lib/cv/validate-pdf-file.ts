import { API_LIMITS } from "@/lib/api/types";
import { formatFileSize } from "@/lib/utils/format";

const PDF_EXTENSION = /\.pdf$/i;

/**
 * Quick client-side checks before uploading, so obvious mistakes get a clear message
 * without a round trip. The API still checks magic bytes and the page count (10).
 * Some systems report an empty MIME type for PDFs, so the extension is accepted too.
 */
export function validatePdfFile(file: Pick<File, "name" | "type" | "size">): string | null {
  if (file.type !== "application/pdf" && !PDF_EXTENSION.test(file.name)) {
    return "Choose a PDF file. For Word or other formats, save as PDF first or paste the text instead.";
  }
  if (file.size === 0) return "This file is empty. Choose another PDF.";
  if (file.size > API_LIMITS.pdf.maxBytes) {
    return `This PDF is ${formatFileSize(file.size)}; the limit is ${formatFileSize(API_LIMITS.pdf.maxBytes)}. Try a smaller export or paste the text instead.`;
  }
  return null;
}
