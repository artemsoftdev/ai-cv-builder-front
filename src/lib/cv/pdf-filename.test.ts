import { describe, expect, it } from "vitest";

import { pdfFilename } from "./pdf-filename";

describe("pdfFilename", () => {
  it("keeps letters and digits of any script and joins the rest with dashes", () => {
    expect(pdfFilename("Jane Doe — Senior Backend Engineer")).toBe("Jane-Doe-Senior-Backend-Engineer.pdf");
    expect(pdfFilename("Иван Петров / CV 2026")).toBe("Иван-Петров-CV-2026.pdf");
  });

  it("never produces a path or an empty name", () => {
    expect(pdfFilename("../../etc/passwd")).toBe("etc-passwd.pdf");
    expect(pdfFilename("   ")).toBe("cv.pdf");
  });
});
