import { createTextCv, expect, getCv, openCv, test } from "./support/test";

// The fake LLM adds keywords of the target role the source lacks (React here); the verifier must catch them.
test("unverified content is flagged and can be dismissed, removed content is listed", async ({ page }) => {
  const cvId = await createTextCv(page.request, "Senior React Developer");
  await openCv(page, cvId);

  await expect(page.getByText("1 detail could not be confirmed.")).toBeVisible();
  const removedToggle = page.getByRole("button", { name: "Removed because it wasn't in your source (1)" });
  await expect(removedToggle).toHaveAttribute("aria-expanded", "false");
  await removedToggle.click();
  const removedItem = page.getByRole("listitem").filter({ hasText: "Skill not mentioned in your source" });
  await expect(removedItem).toContainText("Skill: “React”");
  await expect(page.getByRole("region", { name: /^Skills/ })).not.toContainText("React");

  const badge = page.getByRole("button", { name: "Check the summary: 1 warning" });
  await expect(badge).toBeVisible();
  await expect(page.getByRole("button", { name: "Where the summary comes from in your source" })).toBeVisible();
  await badge.click();
  await expect(page.getByText("Please double-check the summary")).toBeVisible();
  await expect(page.getByText('"React" does not appear in your source')).toBeVisible();
  await page.getByRole("button", { name: "Dismiss" }).click();

  await expect(badge).toBeHidden();
  await expect(page.getByText("Nothing left to double-check.")).toBeVisible();
  await expect.poll(async () => (await getCv(page.request, cvId)).review?.flags.length).toBe(0);

  await page.reload();
  await expect(page.getByText("Nothing left to double-check.")).toBeVisible();
  await expect(badge).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Removed because it wasn't in your source (1)" })).toBeVisible();
});
