import { createTextCv, expect, signUp, test } from "./support/test";

test("a user never sees another user's CVs", async ({ page, browser }) => {
  const ownCvId = await createTextCv(page.request, "Site Reliability Engineer");

  const otherContext = await browser.newContext();
  try {
    await signUp(otherContext.request);
    const otherCvId = await createTextCv(otherContext.request, "Data Platform Engineer");

    await page.goto("/cvs");
    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(1);
    await expect(cards.getByRole("link", { name: "Site Reliability Engineer" })).toBeVisible();
    await expect(page.getByText("Data Platform Engineer")).toHaveCount(0);

    await page.goto(`/cvs/${otherCvId}`);
    await expect(page.getByRole("heading", { name: "CV not found" })).toBeVisible();
    await expect(page.getByText("Data Platform Engineer")).toHaveCount(0);
    expect((await page.request.get(`/api/cvs/${otherCvId}`)).status()).toBe(404);
    expect((await page.request.get(`/api/cvs/${otherCvId}/pdf`)).status()).toBe(404);

    const otherPage = await otherContext.newPage();
    await otherPage.goto(`/cvs/${ownCvId}`);
    await expect(otherPage.getByRole("heading", { name: "CV not found" })).toBeVisible();
  } finally {
    await otherContext.close();
  }
});
