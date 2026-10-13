import { describe, expect, it } from "vitest";

import type { CvContent } from "@/lib/api/types";

import { mergeContent } from "./merge-content";

const base = (): CvContent => ({
  contact: {
    fullName: "Jane Doe",
    headline: "Backend Engineer",
    email: "jane@example.com",
    phone: "+44 7700 900123",
    location: "London",
    links: [{ id: "l1", label: "GitHub", url: "github.com/jane" }],
  },
  summary: "Original summary.",
  experience: [
    { id: "e1", company: "Acme", title: "Engineer", location: "", startDate: "2021", endDate: "Present", bullets: [{ id: "b1", text: "Built billing." }] },
  ],
  education: [],
  skills: [{ id: "s1", name: "Languages", items: ["Go"] }],
});

function edit(mutate: (content: CvContent) => void): CvContent {
  const content = base();
  mutate(content);
  return content;
}

describe("mergeContent", () => {
  it("keeps local edits to parts the server did not change", () => {
    const local = edit((c) => {
      c.contact.phone = "+44 7700 900999";
      c.summary = "My summary.";
    });
    const remote = edit((c) => {
      c.contact.location = "London, UK";
      c.experience[0]!.bullets[0]!.text = "Built the billing service.";
    });

    const result = mergeContent(base(), local, remote);

    expect(result.kept).toEqual(["contact.phone", "summary"]);
    expect(result.dropped).toEqual([]);
    expect(result.content.contact).toMatchObject({ phone: "+44 7700 900999", location: "London, UK" });
    expect(result.content.summary).toBe("My summary.");
    expect(result.content.experience[0]!.bullets[0]!.text).toBe("Built the billing service.");
  });

  it("lets the server win where both sides changed the same part", () => {
    const local = edit((c) => {
      c.summary = "Mine.";
      c.skills[0]!.items.push("Rust");
    });
    const remote = edit((c) => {
      c.summary = "Rewritten by Claude.";
    });

    const result = mergeContent(base(), local, remote);

    expect(result.content.summary).toBe("Rewritten by Claude.");
    expect(result.content.skills[0]!.items).toEqual(["Go", "Rust"]);
    expect(result.kept).toEqual(["skills"]);
    expect(result.dropped).toEqual(["summary"]);
  });

  it("treats identical changes on both sides as no conflict", () => {
    const both = edit((c) => {
      c.contact.headline = "Senior Backend Engineer";
    });

    const result = mergeContent(base(), both, structuredClone(both));

    expect(result).toMatchObject({ kept: [], dropped: [] });
    expect(result.content.contact.headline).toBe("Senior Backend Engineer");
  });

  it("merges lists as a whole and never shares objects with its inputs", () => {
    const local = edit((c) => {
      c.experience.reverse();
      c.experience.push({ id: "e2", company: "Globex", title: "Developer", location: "", startDate: "", endDate: "", bullets: [] });
    });
    const remote = base();

    const result = mergeContent(base(), local, remote);

    expect(result.content.experience.map((item) => item.id)).toEqual(["e1", "e2"]);
    expect(result.content.experience).not.toBe(local.experience);
    expect(result.content).not.toBe(remote);
  });

  it("does not count whitespace the server normalised away as a local edit", () => {
    const saved = edit((c) => {
      c.summary = "Led the team.";
    });
    const local = edit((c) => {
      c.summary = "Led the team. ";
      c.contact.location = "  London ";
    });
    const remote = edit((c) => {
      c.summary = "Led a team of five.";
    });

    const result = mergeContent(saved, local, remote);

    expect(result).toMatchObject({ kept: [], dropped: [] });
    expect(result.content.summary).toBe("Led a team of five.");
  });
});
