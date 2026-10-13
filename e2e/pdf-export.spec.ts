import { readFile } from "node:fs/promises";

import { extractText, getDocumentProxy } from "unpdf";

import { PDF_SOURCE } from "./support/sources";
import { createCv, expect, openCv, test } from "./support/test";

test("downloads the CV as a PDF with selectable text", async ({ page }) => {
  const cvId = await createCv(page.request, { targetRole: "Backend Engineer", pdf: PDF_SOURCE.file });
  await openCv(page, cvId);

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);

  const bytes = await readFile(await download.path());
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  const { text, totalPages } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: true });
  expect(totalPages).toBe(1);
  expect(text).toContain(PDF_SOURCE.name);
  expect(text).toContain("Volga Logistics");
});
