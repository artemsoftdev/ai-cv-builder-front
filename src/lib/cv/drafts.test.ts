import { beforeEach, describe, expect, it } from "vitest";

import { CV_ID, makeContent, makeReadyCv } from "@/test/fixtures";

import { claimDrafts, clearDrafts, readDraft, restoreDraft, writeDraft } from "./drafts";

beforeEach(() => {
  sessionStorage.clear();
});

describe("drafts", () => {
  it("round-trips through sessionStorage and ignores anything malformed", () => {
    const draft = { version: 3, base: makeContent(), content: makeContent({ summary: "Mine" }) };
    writeDraft(CV_ID, draft);
    expect(readDraft(CV_ID)).toEqual(draft);

    sessionStorage.setItem(`cvb:draft:${CV_ID}`, "{not json");
    expect(readDraft(CV_ID)).toBeNull();
    sessionStorage.setItem(`cvb:draft:${CV_ID}`, JSON.stringify({ version: 3, base: {}, content: "x" }));
    expect(readDraft(CV_ID)).toBeNull();
  });

  it("restores edits made on the version the server still has", () => {
    writeDraft(CV_ID, { version: 3, base: makeContent(), content: makeContent({ summary: "Mine" }) });

    const restored = restoreDraft(makeReadyCv({ version: 3 }));

    expect(restored?.content.summary).toBe("Mine");
    expect(restored?.kept).toEqual(["summary"]);
  });

  it("re-applies a draft on top of a newer server version, letting the server win where both changed", () => {
    const base = makeContent();
    const local = makeContent({ summary: "Mine", skills: [{ id: "s1", name: "Languages", items: ["Go", "SQL"] }] });
    writeDraft(CV_ID, { version: 3, base, content: local });
    const server = makeReadyCv({ version: 5, content: makeContent({ summary: "Rewritten by Claude" }) });

    const restored = restoreDraft(server);

    expect(restored?.content.summary).toBe("Rewritten by Claude");
    expect(restored?.content.skills[0]?.items).toEqual(["Go", "SQL"]);
    expect(restored).toMatchObject({ kept: ["skills"], dropped: ["summary"] });
  });

  it("drops a draft that the server copy already contains", () => {
    writeDraft(CV_ID, { version: 3, base: makeContent(), content: makeContent({ summary: "Saved" }) });

    expect(restoreDraft(makeReadyCv({ version: 4, content: makeContent({ summary: "Saved" }) }))).toBeNull();
    expect(readDraft(CV_ID)).toBeNull();
  });

  it("never hands one account's drafts to another one signing in on the same tab", () => {
    const draft = { version: 3, base: makeContent(), content: makeContent({ summary: "Mine" }) };
    writeDraft(CV_ID, draft);
    claimDrafts("user-a");
    expect(readDraft(CV_ID)).toEqual(draft);

    claimDrafts("user-a");
    expect(readDraft(CV_ID)).toEqual(draft);

    claimDrafts("user-b");
    expect(readDraft(CV_ID)).toBeNull();
  });

  it("clears every draft on logout", () => {
    writeDraft(CV_ID, { version: 3, base: makeContent(), content: makeContent() });
    writeDraft("other", { version: 1, base: makeContent(), content: makeContent() });
    sessionStorage.setItem("unrelated", "kept");

    clearDrafts();

    expect(readDraft(CV_ID)).toBeNull();
    expect(readDraft("other")).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("kept");
  });
});
