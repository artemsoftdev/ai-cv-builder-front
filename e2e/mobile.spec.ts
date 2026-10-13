import type { Page } from "@playwright/test";

import { createTextCv, expect, getCv, openCv, test } from "./support/test";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth);
  expect(overflow, `page is ${overflow}px wider than the viewport`).toBeLessThanOrEqual(0);
}

test("the workspace on a phone: tabs, bottom action bar and no sideways scrolling", async ({ page }) => {
  await page.goto("/cvs/new");
  await expect(page.getByRole("button", { name: "Generate my CV" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  const cvId = await createTextCv(page.request);
  await page.goto("/cvs");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expectNoHorizontalScroll(page);

  await openCv(page, cvId);
  const tabs = page.getByRole("tablist", { name: "CV workspace" });
  const editTab = tabs.getByRole("tab", { name: "Edit" });
  const previewTab = tabs.getByRole("tab", { name: "Preview" });
  const questionsTab = tabs.getByRole("tab", { name: /^Questions/ });
  await expect(editTab).toHaveAttribute("aria-selected", "true");
  await expect(questionsTab).toContainText("2");
  await expect(page.getByText("Claude has 2 questions that can improve your CV.")).toBeVisible();
  await expectNoHorizontalScroll(page);

  const downloadButton = page.getByRole("button", { name: "Download PDF" });
  await expect(downloadButton).toBeInViewport();
  const summary = "Backend developer focused on fast, reliable payment APIs.";
  await page.getByLabel("Professional summary").fill(summary);
  await expect.poll(async () => (await getCv(page.request, cvId)).content?.summary).toBe(summary);
  await expect(page.getByText("All changes saved")).toBeInViewport();

  await previewTab.click();
  await expect(page).toHaveURL(/\?tab=preview$/);
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(page.getByLabel("Professional summary")).toBeHidden();
  await expectNoHorizontalScroll(page);

  await questionsTab.click();
  await expect(page).toHaveURL(/\?tab=questions$/);
  await expect(page.getByRole("heading", { name: /Claude needs a few details/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preview" })).toBeHidden();
  await expectNoHorizontalScroll(page);

  await page.reload();
  await expect(questionsTab).toHaveAttribute("aria-selected", "true");

  await editTab.click();
  await expect(page.getByText("Claude has 2 questions that can improve your CV.")).toBeVisible();
  await page.getByRole("button", { name: "Answer" }).click();
  await expect(questionsTab).toHaveAttribute("aria-selected", "true");
  await expect(questionsTab).toBeFocused();

  const downloading = page.waitForEvent("download");
  await downloadButton.click();
  expect((await downloading).suggestedFilename()).toMatch(/\.pdf$/);
});
