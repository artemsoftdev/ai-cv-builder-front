import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CvReview } from "@/lib/api/types";

import { ItemReview } from "./item-review";
import { ReviewProvider } from "./review-context";
import { ReviewNotice } from "./review-notice";

const review: CvReview = {
  flags: [
    { id: "f1", itemId: "b1", reason: 'Number "40%" does not appear in your source' },
    { id: "f2", itemId: "b1", reason: 'Company "Globex" does not appear in your source' },
    { id: "f3", itemId: "summary", reason: "Could not be verified" },
  ],
  removed: [{ field: "contact.phone", value: "+1 555 0100", reason: "Not found in your source" }],
  evidence: { b2: ["Led the billing rewrite at Acme"] },
};

function renderReview({ dismissed = new Set<string>(), disabled = false } = {}) {
  const onDismiss = vi.fn();
  render(
    <ReviewProvider review={review} dismissed={dismissed} onDismiss={onDismiss} disabled={disabled}>
      <ReviewNotice removed={review.removed} />
      <div data-review-scope>
        <textarea aria-label="Highlight 1" />
        <ItemReview itemId="b1" label="highlight 1" />
      </div>
      <div data-review-scope>
        <textarea aria-label="Highlight 2" />
        <ItemReview itemId="b2" label="highlight 2" />
      </div>
    </ReviewProvider>,
  );
  return { onDismiss, user: userEvent.setup() };
}

describe("ItemReview", () => {
  it("lists why an item was flagged and dismisses all of its flags, then returns focus to the field", async () => {
    const { user, onDismiss } = renderReview();

    await user.click(screen.getByRole("button", { name: "Check highlight 1: 2 warnings" }));
    const popover = screen.getByRole("dialog");
    expect(popover).toHaveTextContent('Number "40%" does not appear in your source');
    expect(popover).toHaveTextContent('Company "Globex" does not appear in your source');

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith(["f1", "f2"]);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Highlight 1" })).toHaveFocus());
  });

  it("shows the source quotes behind a verified item", async () => {
    const { user } = renderReview();

    await user.click(screen.getByRole("button", { name: "Where highlight 2 comes from in your source" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Found in your source");
    expect(screen.getByRole("dialog")).toHaveTextContent("“Led the billing rewrite at Acme”");
  });

  it("hides dismissed flags at once and can't dismiss while a job owns the CV", async () => {
    const { user } = renderReview({ dismissed: new Set(["f1"]), disabled: true });

    await user.click(screen.getByRole("button", { name: "Check highlight 1: 1 warning" }));

    expect(screen.getByRole("dialog")).not.toHaveTextContent("40%");
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeDisabled();
  });
});

describe("ReviewNotice", () => {
  it("counts the open flags, explains the quote mark and lists what was removed", async () => {
    const { user } = renderReview();

    expect(screen.getByText(/3 details could not be confirmed/)).toBeInTheDocument();
    expect(screen.getByText(/green quote mark/)).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /Removed because it wasn't in your source \(1\)/ });
    expect(screen.getByText("“+1 555 0100”")).not.toBeVisible();
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Phone:")).toBeInTheDocument();
    expect(screen.getByText("“+1 555 0100”")).toBeVisible();
  });

  it("stays hidden when there is nothing to report", () => {
    const { container } = render(
      <ReviewProvider
        review={{ flags: [], removed: [], evidence: {} }}
        dismissed={new Set()}
        onDismiss={vi.fn()}
        disabled={false}
      >
        <ReviewNotice removed={[]} />
      </ReviewProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
