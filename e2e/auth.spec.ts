import { expect, test } from "@playwright/test";

import { PASSWORD, signUp, uniqueEmail } from "./support/test";

test.describe("authentication", () => {
  test("signs up, lands on the CV list and logs out", async ({ page }) => {
    const email = uniqueEmail("signup");
    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Repeat password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL("/cvs");
    await expect(page.getByRole("heading", { name: "Your CVs" })).toBeVisible();
    await expect(page.getByRole("banner").getByText(email)).toBeVisible();
    await expect(page.getByText("No CVs yet")).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL("/login");
    await page.goto("/cvs");
    await expect(page).toHaveURL("/login");
  });

  test("sends a signed-out visitor to log in and back to the page they asked for", async ({ page, request }) => {
    const email = await signUp(request);

    await page.goto("/cvs/new");
    await expect(page).toHaveURL("/login?next=%2Fcvs%2Fnew");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL("/cvs/new");
    await expect(page.getByRole("button", { name: "Generate my CV" })).toBeVisible();
  });

  test("rejects a wrong password without saying whether the account exists", async ({ page, request }) => {
    const email = await signUp(request);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(`${PASSWORD}-wrong`);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password." })).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("tells a new visitor that the email already has an account", async ({ page, request }) => {
    const email = await signUp(request);

    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Repeat password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("An account with this email already exists.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in instead" })).toBeVisible();
    await expect(page).toHaveURL("/signup");
  });
});
