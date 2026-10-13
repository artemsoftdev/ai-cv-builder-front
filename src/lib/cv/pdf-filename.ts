/** Fallback download name when the server sends no usable `Content-Disposition`. */
export function pdfFilename(title: string): string {
  const base = title
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "cv"}.pdf`;
}
