import { describe, expect, it } from "vitest";

import type { CvContent } from "@/lib/api/types";

import { describeRemovedField } from "../review/review-notice";
import { describeQuestionTarget } from "./question-target";

const content = {
  contact: { fullName: "", headline: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  experience: [
    { id: "e1", company: "Acme Corp", title: "Engineer", location: "", startDate: "", endDate: "", bullets: [] },
  ],
  education: [
    { id: "ed1", institution: "", degree: "BSc Physics", location: "", startDate: "", endDate: "", details: "" },
  ],
  skills: [],
} satisfies CvContent;

describe("describeQuestionTarget", () => {
  it("names the entry a question is about", () => {
    expect(describeQuestionTarget({ section: "experience", itemId: "e1" }, content)).toBe("Experience · Acme Corp");
    expect(describeQuestionTarget({ section: "education", itemId: "ed1" }, content)).toBe("Education · BSc Physics");
  });

  it("falls back to the section", () => {
    expect(describeQuestionTarget({ section: "contact", itemId: null }, content)).toBe("Contact");
    expect(describeQuestionTarget({ section: "experience", itemId: "deleted" }, content)).toBe("Experience");
  });
});

describe("describeRemovedField", () => {
  it("turns API field paths into labels", () => {
    expect(describeRemovedField("contact.phone")).toBe("Phone");
    expect(describeRemovedField("skills")).toBe("Skill");
    expect(describeRemovedField("experience.2.startDate")).toBe("Experience");
    expect(describeRemovedField("certifications.0.issuingBody")).toBe("Issuing Body");
  });
});
