import { describe, expect, it } from "vitest";

import type { CvContent } from "@/lib/api/types";

import { cvContentSchema, cvTitleSchema, isAllowedLinkUrl } from "./content-schema";

const content = (): CvContent => ({
  contact: { fullName: "Jane", headline: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  experience: [
    {
      id: "e1",
      company: "Acme",
      title: "Engineer",
      location: "",
      startDate: "",
      endDate: "",
      bullets: [{ id: "b1", text: "Shipped things" }],
    },
  ],
  education: [],
  skills: [{ id: "s1", name: "Languages", items: ["Go"] }],
});

const issuePaths = (value: unknown) => {
  const result = cvContentSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("cvContentSchema", () => {
  it("accepts valid content, including empty optional fields", () => {
    expect(issuePaths(content())).toEqual([]);
  });

  it("enforces the API's length limits", () => {
    const value = content();
    value.summary = "x".repeat(1_501);
    value.experience[0]!.bullets[0]!.text = "x".repeat(401);
    value.contact.fullName = "x".repeat(301);
    expect(issuePaths(value)).toEqual(["contact.fullName", "summary", "experience.0.bullets.0.text"]);
  });

  it("enforces the API's count limits", () => {
    const value = content();
    value.skills[0]!.items = Array.from({ length: 41 }, (_, i) => `Skill ${i}`);
    value.experience[0]!.bullets = Array.from({ length: 16 }, (_, i) => ({ id: `b${i}`, text: "x" }));
    expect(issuePaths(value)).toEqual(["experience.0.bullets", "skills.0.items"]);
  });
});

describe("cvContentSchema ids", () => {
  it("rejects an id used twice anywhere in the document, like the API", () => {
    const value = content();
    value.education = [
      { id: "e1", institution: "MIT", degree: "", location: "", startDate: "", endDate: "", details: "" },
    ];
    value.experience[0]!.bullets.push({ id: "b1", text: "Copy" });
    expect(issuePaths(value)).toEqual(["experience.0.bullets.1.id", "education.0.id"]);
  });

  it("reserves the ids of the summary and headline review targets", () => {
    const value = content();
    value.skills[0]!.id = "summary";
    expect(issuePaths(value)).toEqual(["skills.0.id"]);
  });
});

describe("isAllowedLinkUrl", () => {
  it.each(["github.com/jane", "https://jane.dev", "http://x.y", "mailto:jane@example.com", "", " HTTPS://X.Y "])(
    "allows %j",
    (url) => expect(isAllowedLinkUrl(url)).toBe(true),
  );

  it.each(["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,x", "tel:+491234", "file:///etc/passwd"])(
    "rejects %j like the API does",
    (url) => expect(isAllowedLinkUrl(url)).toBe(false),
  );
});

describe("cvTitleSchema", () => {
  it("trims and requires 1-120 characters", () => {
    expect(cvTitleSchema.parse("  Backend CV ")).toBe("Backend CV");
    expect(cvTitleSchema.safeParse("   ").success).toBe(false);
    expect(cvTitleSchema.safeParse("x".repeat(121)).success).toBe(false);
  });
});
