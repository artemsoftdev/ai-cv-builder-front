import { afterEach, describe, expect, it, vi } from "vitest";

import { focusFirstInvalidField } from "./focus-invalid-field";

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("focusFirstInvalidField", () => {
  it("focuses the first invalid field in document order", () => {
    document.body.innerHTML = `
      <form id="editor">
        <input id="ok" />
        <textarea id="summary" aria-invalid="true"></textarea>
        <input id="bullet" aria-invalid="true" />
      </form>`;

    focusFirstInvalidField(document.getElementById("editor"));

    expect(document.activeElement?.id).toBe("summary");
  });

  it("waits for a hidden tab panel or section to open before focusing", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<form id="editor"><div id="panel" hidden><input id="field" aria-invalid="true" /></div></form>`;

    focusFirstInvalidField(document.getElementById("editor"));
    expect(document.activeElement).toBe(document.body);
    document.getElementById("panel")!.hidden = false;
    await vi.advanceTimersByTimeAsync(50);

    expect(document.activeElement?.id).toBe("field");
  });
});
