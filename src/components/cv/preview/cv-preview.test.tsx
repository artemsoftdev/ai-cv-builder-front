import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeContent } from "@/test/fixtures";

import { CvDocument } from "./cv-document";
import { estimatePages } from "./cv-preview";

describe("CvDocument", () => {
  it("renders untrusted strings as text: no markup, no script, no links", () => {
    const content = makeContent({
      summary: '<img src="x" onerror="alert(1)"> <b>bold</b>',
      contact: {
        fullName: "<script>alert(1)</script>",
        headline: "Engineer",
        email: "jane@example.com",
        phone: "",
        location: "",
        links: [{ id: "l1", label: "Site", url: "javascript:alert(1)" }],
      },
    });

    const { container } = render(<CvDocument content={content} />);

    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(screen.getByText('<img src="x" onerror="alert(1)"> <b>bold</b>')).toBeInTheDocument();
    expect(container.querySelector("script, img, b, a")).toBeNull();
    expect(container).toHaveTextContent("javascript:alert(1)");
  });

  it("prints sections in the PDF's order and leaves empty ones out", () => {
    const { container } = render(<CvDocument content={makeContent({ education: [], summary: "" })} />);
    const text = container.textContent ?? "";

    expect(text.indexOf("Experience")).toBeLessThan(text.indexOf("Skills"));
    expect(text).not.toContain("Summary");
    expect(text).not.toContain("Education");
    expect(text).toContain("Engineer — Acme");
    expect(text).toContain("2021 – Present");
  });
});

describe("estimatePages", () => {
  it("counts pages with the PDF's padding repeated on every page", () => {
    expect(estimatePages(0)).toBe(1);
    expect(estimatePages(1123)).toBe(1);
    // Two pages of plain height, but the PDF needs a third once each page loses its padding.
    expect(estimatePages(2200)).toBe(3);
  });
});
