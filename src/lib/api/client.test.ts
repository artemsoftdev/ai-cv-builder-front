import { describe, expect, it } from "vitest";

import { errorResponse, fetchCall, jsonResponse, mockFetch } from "@/test/http";

import { apiFetch, apiFetchBlob, parseContentDispositionFilename } from "./client";
import { cvsApi, toCreateCvFormData } from "./endpoints";
import { ApiError, getValidationIssues } from "./errors";

describe("apiFetch request", () => {
  it("sends the CSRF header and a JSON body on POST, with same-origin credentials", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse({ user: { id: "u1" } }));

    await apiFetch("/api/auth/login", { method: "POST", json: { email: "a@b.co", password: "secret123" } });

    const { url, init, headers } = fetchCall(fetchMock);
    expect(url).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ email: "a@b.co", password: "secret123" }));
  });

  it("sends the CSRF header on PATCH and DELETE too, but not on GET", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));

    await apiFetch("/api/cvs/1", { method: "PATCH", json: { version: 1 } });
    await apiFetch("/api/cvs/1", { method: "DELETE" });
    await apiFetch("/api/cvs");

    expect(fetchCall(fetchMock, 0).headers.get("X-Requested-With")).toBe("XMLHttpRequest");
    expect(fetchCall(fetchMock, 1).headers.get("X-Requested-With")).toBe("XMLHttpRequest");
    expect(fetchCall(fetchMock, 2).headers.has("X-Requested-With")).toBe(false);
  });

  it("sends FormData as is, letting the browser set the multipart boundary", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse({ cv: { id: "cv1" } }, { status: 202 }));
    const file = new File(["%PDF-1.7"], "me.pdf", { type: "application/pdf" });

    await cvsApi.create({ targetRole: "Backend Engineer", file });

    const { init, headers } = fetchCall(fetchMock);
    expect(headers.has("Content-Type")).toBe(false);
    expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest");
    const body = init.body as FormData;
    expect(body.get("targetRole")).toBe("Backend Engineer");
    expect((body.get("file") as File).name).toBe("me.pdf");
    expect(body.has("text")).toBe(false);
  });

  it("encodes ids in URL paths", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse({ cv: {} }));

    await cvsApi.get("../auth/me");

    expect(fetchCall(fetchMock).url).toBe("/api/cvs/..%2Fauth%2Fme");
  });
});

describe("apiFetch responses", () => {
  it("unwraps JSON and returns undefined for 204", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [{ id: "a" }] }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(cvsApi.list()).resolves.toEqual([{ id: "a" }]);
    await expect(cvsApi.remove("a")).resolves.toBeUndefined();
  });

  it("parses the error envelope into a typed ApiError", async () => {
    mockFetch().mockResolvedValue(
      errorResponse(409, "VERSION_CONFLICT", "Someone else changed this CV", { currentVersion: 7 }),
    );

    const error = await apiFetch("/api/cvs/1", { method: "PATCH", json: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "VERSION_CONFLICT",
      message: "Someone else changed this CV",
      details: { currentVersion: 7 },
    });
  });

  it("exposes validation issues and Retry-After", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(
      errorResponse(400, "VALIDATION_ERROR", "Invalid body", { issues: [{ path: "email", message: "Invalid email" }] }),
    );
    fetchMock.mockResolvedValueOnce(errorResponse(429, "RATE_LIMITED", "Slow down", undefined, { "Retry-After": "120" }));

    const validation = (await apiFetch("/api/auth/signup", { method: "POST", json: {} }).catch((e: unknown) => e)) as ApiError;
    const rateLimited = (await apiFetch("/api/auth/login", { method: "POST", json: {} }).catch((e: unknown) => e)) as ApiError;

    expect(getValidationIssues(validation)).toEqual([{ path: "email", message: "Invalid email" }]);
    expect(rateLimited.code).toBe("RATE_LIMITED");
    expect(rateLimited.retryAfterSeconds).toBe(120);
  });

  it("maps a non-JSON error body to INTERNAL with the HTTP status", async () => {
    mockFetch().mockResolvedValue(
      new Response("<html>Bad Gateway</html>", { status: 502, headers: { "Content-Type": "text/html" } }),
    );

    const error = await apiFetch("/api/cvs").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: "INTERNAL" });
  });

  it("treats a JSON body without the error envelope as INTERNAL", async () => {
    mockFetch().mockResolvedValue(jsonResponse({ message: "nope" }, { status: 500 }));

    await expect(apiFetch("/api/cvs")).rejects.toMatchObject({ status: 500, code: "INTERNAL" });
  });

  it("maps a network failure to NETWORK_ERROR with status 0", async () => {
    mockFetch().mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await apiFetch("/api/cvs").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });

  it("rethrows aborts untouched so React Query can treat them as cancellations", async () => {
    mockFetch().mockRejectedValue(new DOMException("The operation was aborted.", "AbortError"));

    const error = await apiFetch("/api/cvs").catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).name).toBe("AbortError");
  });

  it("rejects a 2xx response whose body is not JSON", async () => {
    mockFetch().mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(apiFetch("/api/cvs")).rejects.toMatchObject({ code: "INTERNAL" });
  });
});

describe("apiFetchBlob", () => {
  it("returns the blob and the filename from Content-Disposition", async () => {
    mockFetch().mockResolvedValue(
      new Response("%PDF", {
        status: 200,
        headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="Jane Doe.pdf"' },
      }),
    );

    const { blob, filename } = await apiFetchBlob("/api/cvs/1/pdf");

    expect(await blob.text()).toBe("%PDF");
    expect(filename).toBe("Jane Doe.pdf");
  });
});

describe("parseContentDispositionFilename", () => {
  it.each([
    [null, null],
    ["attachment", null],
    ['attachment; filename="cv.pdf"', "cv.pdf"],
    ["attachment; filename=cv.pdf", "cv.pdf"],
    ["attachment; filename=\"x.pdf\"; filename*=UTF-8''%D0%A0%D0%B5%D0%B7%D1%8E%D0%BC%D0%B5.pdf", "Резюме.pdf"],
    ['attachment; filename="../../etc/passwd"', ".._.._etc_passwd"],
  ])("%s -> %s", (header, expected) => {
    expect(parseContentDispositionFilename(header)).toBe(expected);
  });
});

describe("toCreateCvFormData", () => {
  it("sends text when no file is given", () => {
    const form = toCreateCvFormData({ targetRole: "PM", text: "My experience..." });
    expect(form.get("text")).toBe("My experience...");
    expect(form.has("file")).toBe(false);
  });
});
