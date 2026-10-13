import { createTextCv, expect, test } from "./support/test";

test("deletes a CV from the list after confirmation", async ({ page }) => {
  await createTextCv(page.request, "Platform Engineer");
  await createTextCv(page.request, "Payments Engineer");
  await page.goto("/cvs");
  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(2);

  const deleteButton = page.getByRole("button", { name: "Delete CV “Payments Engineer”" });
  const dialog = page.getByRole("alertdialog", { name: "Delete this CV?" });
  await deleteButton.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("“Payments Engineer” and its questions will be deleted permanently.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(cards).toHaveCount(2);

  await deleteButton.click();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("CV deleted")).toBeVisible();
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Payments Engineer" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Platform Engineer" })).toBeVisible();

  await page.reload();
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Platform Engineer" })).toBeVisible();
});
