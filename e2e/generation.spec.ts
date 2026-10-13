import { PDF_SOURCE, TEXT_SOURCE } from "./support/sources";
import { experienceEntry, expectWorkspaceReady, test, expect } from "./support/test";

test.describe("generation", () => {
  test("drafts a CV from pasted text and keeps going through a reload", async ({ page }) => {
    await page.goto("/cvs/new");
    await page.getByRole("tab", { name: "Paste text" }).click();
    await page.getByLabel("CV text").fill(TEXT_SOURCE.text);
    await page.getByLabel("Target role").fill("Backend Engineer");
    await page.getByRole("button", { name: "Generate my CV" }).click();

    const progress = page.getByRole("list", { name: "Generation progress" });
    await expect(page.getByRole("heading", { name: "Creating your CV" })).toBeVisible();
    await expect(progress).toBeVisible();
    await expect(page).toHaveURL(/\/cvs\/[0-9a-f-]{36}$/);

    await page.reload();
    await expect(progress).toBeVisible();
    await expect(progress.locator('[aria-current="step"]')).toHaveCount(1);

    await expectWorkspaceReady(page);
    await expect(page.getByText("Your CV is ready")).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue(TEXT_SOURCE.name);
    await expect(page.getByLabel("Professional summary")).toHaveValue(TEXT_SOURCE.summary);
    await expect(experienceEntry(page, TEXT_SOURCE.latestRole)).toBeVisible();
    await expect(
      experienceEntry(page, TEXT_SOURCE.latestRole).getByRole("textbox", { name: "Highlight 1" }),
    ).toHaveValue(/card payments API/);
    await expect(page.getByRole("region", { name: /^Skills/ })).toContainText("PostgreSQL");
  });

  test("drafts a CV from an uploaded PDF", async ({ page }) => {
    await page.goto("/cvs/new");
    await expect(page.getByRole("tab", { name: "Upload PDF" })).toHaveAttribute("aria-selected", "true");
    await page.getByLabel("CV file (PDF)").setInputFiles(PDF_SOURCE.file);
    await expect(page.getByText(PDF_SOURCE.fileName)).toBeVisible();
    await page.getByLabel("Target role").fill("Backend Engineer");
    await page.getByRole("button", { name: "Generate my CV" }).click();

    await expect(page.getByRole("heading", { name: "Creating your CV" })).toBeVisible();
    await expect(page.getByText(PDF_SOURCE.fileName)).toBeVisible();

    await expectWorkspaceReady(page);
    await expect(page.getByLabel("Full name")).toHaveValue(PDF_SOURCE.name);
    await expect(experienceEntry(page, PDF_SOURCE.latestRole)).toBeVisible();
    await expect(page.getByRole("region", { name: /^Education/ }).getByLabel("Institution")).toHaveValue(
      /Ural Federal University/,
    );
  });
});
