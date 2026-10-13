import { describe, expect, it } from "vitest";

import type { CvContent } from "@/lib/api/types";

import { isEmptyPrintable, linkText, toPrintableCv } from "./printable-cv";

const empty = (): CvContent => ({
  contact: { fullName: "", headline: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  experience: [],
  education: [],
  skills: [],
});

describe("linkText", () => {
  it.each([
    [{ label: "GitHub", url: "https://github.com/jane/" }, "github.com/jane"],
    [{ label: "Site", url: "HTTP://jane.dev" }, "jane.dev"],
    [{ label: "Mail", url: "mailto:jane@example.com" }, "jane@example.com"],
    [{ label: "Portfolio", url: "  " }, "Portfolio"],
  ])("prints %j as %s", (link, expected) => {
    expect(linkText(link)).toBe(expected);
  });
});

describe("toPrintableCv", () => {
  it("drops empty fields, bullets, entries and skill groups like the PDF does", () => {
    const content = empty();
    content.contact = {
      fullName: " Jane Doe ",
      headline: "Backend Engineer",
      email: "jane@example.com",
      phone: "",
      location: "London",
      links: [
        { id: "l1", label: "GitHub", url: "https://github.com/jane" },
        { id: "l2", label: "", url: "" },
      ],
    };
    content.experience = [
      {
        id: "e1",
        company: "Acme",
        title: "Engineer",
        location: "",
        startDate: "2021",
        endDate: "Present",
        bullets: [
          { id: "b1", text: " Built billing. " },
          { id: "b2", text: "  " },
        ],
      },
      { id: "e2", company: "", title: "", location: "", startDate: "", endDate: "", bullets: [{ id: "b3", text: "" }] },
      { id: "e3", company: "", title: "", location: "Berlin", startDate: "", endDate: "", bullets: [] },
    ];
    content.education = [
      { id: "d1", institution: "MIT", degree: "BSc", location: "", startDate: "", endDate: "2014", details: "Thesis\non queues" },
    ];
    content.skills = [
      { id: "s1", name: "Languages", items: ["Go", " ", "SQL"] },
      { id: "s2", name: "Empty", items: [""] },
    ];

    const cv = toPrintableCv(content);

    expect(cv.name).toBe("Jane Doe");
    expect(cv.contact).toEqual(["jane@example.com", "London", "github.com/jane"]);
    expect(cv.experience.map((entry) => entry.id)).toEqual(["e1", "e3"]);
    expect(cv.experience[0]).toMatchObject({ title: "Engineer", subtitle: "Acme", dates: "2021 – Present" });
    expect(cv.experience[0]?.bullets).toEqual([{ id: "b1", text: "Built billing." }]);
    expect(cv.education[0]).toMatchObject({ title: "BSc", subtitle: "MIT", dates: "2014", details: "Thesis\non queues" });
    expect(cv.skills).toEqual([{ id: "s1", name: "Languages", items: "Go, SQL" }]);
    expect(isEmptyPrintable(cv)).toBe(false);
  });

  it("reports a CV with nothing to print", () => {
    const content = empty();
    content.experience = [{ id: "e1", company: " ", title: "", location: "", startDate: "", endDate: "", bullets: [] }];
    expect(isEmptyPrintable(toPrintableCv(content))).toBe(true);
  });
});
