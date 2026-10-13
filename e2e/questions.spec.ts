import { TEXT_SOURCE } from "./support/sources";
import { createTextCv, expect, GENERATION_TIMEOUT, openCv, test } from "./support/test";

const { degree, result } = TEXT_SOURCE.questions;
const DEGREE_ANSWER = "I have a BSc in Computer Science from the Technical University of Munich, 2012 - 2016.";

test("an answer updates the CV while the editor waits, and a skipped question is resolved", async ({ page }) => {
  const cvId = await createTextCv(page.request);
  await openCv(page, cvId);
  await expect(page.getByRole("heading", { name: /Claude needs a few details/ })).toContainText("2");
  await expect(page.getByRole("region", { name: /^Education/ })).toContainText("No education entries yet.");

  const degreeCard = page.getByRole("article", { name: degree });
  await degreeCard.getByRole("textbox", { name: degree }).fill(DEGREE_ANSWER);
  await degreeCard.getByRole("button", { name: "Update CV" }).click();

  const busyBanner = page.getByRole("status").filter({ hasText: "Updating your CV with your answer…" });
  await expect(busyBanner).toBeVisible();
  await expect(page.getByLabel("Professional summary")).toBeDisabled();
  await expect(degreeCard.getByRole("status")).toHaveText("Updating your CV with this answer…");

  await expect(busyBanner).toBeHidden({ timeout: GENERATION_TIMEOUT });
  await expect(page.getByLabel("Professional summary")).toBeEnabled();
  await expect(page.getByRole("region", { name: /^Education/ }).getByLabel("Institution")).toHaveValue(
    /Technical University of Munich/,
  );
  await expect(degreeCard).toBeHidden();

  const resolvedToggle = page.getByRole("button", { name: "Resolved (1)" });
  await resolvedToggle.click();
  const resolved = page.getByRole("listitem").filter({ hasText: degree });
  await expect(resolved).toContainText("Applied");
  await expect(resolved).toContainText(DEGREE_ANSWER);

  // Skipping is sent once its Undo toast has gone.
  const dismissed = page.waitForResponse(
    (response) => response.request().method() === "POST" && /\/questions\/[^/]+\/dismiss$/.test(response.url()),
    { timeout: 20_000 },
  );
  await page.getByRole("article", { name: result }).getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("Question skipped")).toBeVisible();
  expect((await dismissed).ok()).toBe(true);

  await expect(page.getByRole("button", { name: "Resolved (2)" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: result })).toContainText("Skipped");
  await expect(page.getByRole("heading", { name: "Questions", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("All questions are answered or skipped.")).toBeVisible({ timeout: GENERATION_TIMEOUT });
});
