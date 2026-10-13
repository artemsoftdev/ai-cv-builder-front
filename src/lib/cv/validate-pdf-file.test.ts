import { describe, expect, it } from "vitest";

import { validatePdfFile } from "./validate-pdf-file";

const file = (name: string, type: string, size: number) => ({ name, type, size });
const MB = 1024 * 1024;

describe("validatePdfFile", () => {
  it("accepts a PDF up to 5 MB", () => {
    expect(validatePdfFile(file("cv.pdf", "application/pdf", 300 * 1024))).toBeNull();
    expect(validatePdfFile(file("cv.pdf", "application/pdf", 5 * MB))).toBeNull();
  });

  it("accepts a .pdf whose MIME type the system did not report", () => {
    expect(validatePdfFile(file("CV.PDF", "", 1_000))).toBeNull();
  });

  it("rejects other formats", () => {
    expect(validatePdfFile(file("cv.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 1_000))).toMatch(
      /Choose a PDF file/,
    );
    expect(validatePdfFile(file("photo.png", "image/png", 1_000))).toMatch(/Choose a PDF file/);
  });

  it("rejects empty and oversized files with the actual size", () => {
    expect(validatePdfFile(file("cv.pdf", "application/pdf", 0))).toMatch(/empty/);
    expect(validatePdfFile(file("cv.pdf", "application/pdf", 7.5 * MB))).toBe(
      "This PDF is 7.5 MB; the limit is 5 MB. Try a smaller export or paste the text instead.",
    );
  });
});
