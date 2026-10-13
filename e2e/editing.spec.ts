import { TEXT_SOURCE } from "./support/sources";
import { createTextCv, experienceEntry, expect, getCv, openCv, test } from "./support/test";

const SUMMARY = "Payments backend engineer who keeps card APIs fast and boring.";
const FIRST_BULLET = "Built and ran the card payments API in Node.js handling 3 million requests per day";
const ADDED_BULLET = "Wrote the incident runbooks for the payments on-call rotation";

test("edits are saved automatically and survive a reload", async ({ page, context }) => {
  const cvId = await createTextCv(page.request);
  await openCv(page, cvId);
  const latest = experienceEntry(page, TEXT_SOURCE.latestRole);
  const bullets = latest.getByRole("textbox", { name: /^Highlight \d+$/ });
  await expect(bullets).toHaveCount(2);

  await page.getByLabel("Professional summary").fill(SUMMARY);
  await latest.getByRole("textbox", { name: "Highlight 1" }).fill(FIRST_BULLET);
  await latest.getByRole("button", { name: "Add highlight" }).click();
  await expect(latest.getByRole("textbox", { name: "Highlight 3" })).toBeFocused();
  await page.keyboard.type(ADDED_BULLET);
  await latest.getByRole("button", { name: "Remove highlight 2" }).click();
  await expect(bullets).toHaveCount(2);

  await expect(page.getByText("All changes saved")).toBeVisible();
  await expect
    .poll(async () => {
      const { content } = await getCv(page.request, cvId);
      return { summary: content?.summary, bullets: content?.experience[0]?.bullets.map((bullet) => bullet.text) };
    })
    .toEqual({ summary: SUMMARY, bullets: [FIRST_BULLET, ADDED_BULLET] });

  await page.reload();
  await expect(page.getByLabel("Professional summary")).toHaveValue(SUMMARY);
  await expect(bullets).toHaveCount(2);
  await expect(latest.getByRole("textbox", { name: "Highlight 1" })).toHaveValue(FIRST_BULLET);
  await expect(latest.getByRole("textbox", { name: "Highlight 2" })).toHaveValue(ADDED_BULLET);

  // A new tab has no session-storage drafts, like another device.
  const otherTab = await context.newPage();
  await openCv(otherTab, cvId);
  await expect(otherTab.getByLabel("Professional summary")).toHaveValue(SUMMARY);
  await expect(
    experienceEntry(otherTab, TEXT_SOURCE.latestRole).getByRole("textbox", { name: "Highlight 2" }),
  ).toHaveValue(ADDED_BULLET);
});
