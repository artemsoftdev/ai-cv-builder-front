import { readFile } from "node:fs/promises";

import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";

import { TEXT_SOURCE } from "./sources";

export { expect };

export const PASSWORD = "e2e-Correct-Horse-42";
export const GENERATION_TIMEOUT = 30_000;
const CSRF = { "X-Requested-With": "XMLHttpRequest" };

export function uniqueEmail(tag: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `e2e-${tag}-${Date.now().toString(36)}-${random}@example.com`;
}

/** Sets the session cookie on whatever context `request` belongs to. */
export async function signUp(request: APIRequestContext, email = uniqueEmail("user")): Promise<string> {
  const response = await request.post("/api/auth/signup", { headers: CSRF, data: { email, password: PASSWORD } });
  expect(response.status(), await response.text()).toBe(201);
  return email;
}

type FilePart = { name: string; mimeType: string; buffer: Buffer };

export async function createCv(
  request: APIRequestContext,
  input: { targetRole: string } & ({ text: string } | { pdf: string }),
): Promise<string> {
  const source: Record<string, string | FilePart> =
    "pdf" in input
      ? { file: { name: "cv.pdf", mimeType: "application/pdf", buffer: await readFile(input.pdf) } }
      : { text: input.text };
  const response = await request.post("/api/cvs", {
    headers: CSRF,
    multipart: { targetRole: input.targetRole, ...source },
  });
  expect(response.status(), await response.text()).toBe(202);
  const { cv } = (await response.json()) as { cv: { id: string } };
  return cv.id;
}

type CvDto = {
  content: { summary: string; experience: { bullets: { text: string }[] }[] } | null;
  review: { flags: unknown[] } | null;
};

export async function getCv(request: APIRequestContext, cvId: string): Promise<CvDto> {
  const response = await request.get(`/api/cvs/${cvId}`);
  expect(response.status()).toBe(200);
  return ((await response.json()) as { cv: CvDto }).cv;
}

export async function createTextCv(request: APIRequestContext, targetRole = "Backend Engineer"): Promise<string> {
  return createCv(request, { targetRole, text: TEXT_SOURCE.text });
}

export async function expectWorkspaceReady(page: Page): Promise<void> {
  await expect(page.getByLabel("Professional summary")).toBeVisible({ timeout: GENERATION_TIMEOUT });
}

export async function openCv(page: Page, cvId: string): Promise<void> {
  await page.goto(`/cvs/${cvId}`);
  await expectWorkspaceReady(page);
}

export function experienceEntry(page: Page, heading: string) {
  return page
    .getByRole("region", { name: /^Experience/ })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: heading, exact: true }) });
}

/** Every test starts signed in as a new user. */
export const test = base.extend<{ account: { email: string } }>({
  account: [
    async ({ page }, provide, testInfo) => {
      await provide({ email: await signUp(page.request, uniqueEmail(testInfo.project.name)) });
    },
    { auto: true },
  ],
});
