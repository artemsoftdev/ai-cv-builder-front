/** Hands a downloaded Blob to the browser as a file download. */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke later: some browsers (Safari) are still reading the blob when click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
