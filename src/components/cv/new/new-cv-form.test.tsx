import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query/query-client";
import { errorResponse, fetchCall, jsonResponse, mockFetch } from "@/test/http";

import { NewCvForm } from "./new-cv-form";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function renderForm() {
  const user = userEvent.setup({ applyAccept: false });
  render(
    <QueryClientProvider client={createQueryClient({ onUnauthorized: vi.fn() })}>
      <NewCvForm />
    </QueryClientProvider>,
  );
  return {
    user,
    fileInput: () => screen.getByLabelText(/CV file \(PDF\)/),
    roleInput: () => screen.getByLabelText("Target role"),
    submit: () => screen.getByRole("button", { name: /Generate my CV/ }),
  };
}

const pdf = (name = "cv.pdf", size = 2_000) => new File([new Uint8Array(size)], name, { type: "application/pdf" });

beforeEach(() => {
  router.push.mockReset();
  sessionStorage.clear();
});

describe("NewCvForm validation", () => {
  it("asks for a file and a role without calling the API", async () => {
    const fetchMock = mockFetch();
    const { user, submit } = renderForm();

    await user.click(submit());

    expect(await screen.findByText("Choose your CV as a PDF file")).toBeInTheDocument();
    expect(screen.getByText("Enter the role you are applying for")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains a wrong file type as soon as it is picked", async () => {
    mockFetch();
    const { user, fileInput } = renderForm();

    await user.upload(fileInput(), new File(["x"], "cv.docx", { type: "application/msword" }));

    expect(await screen.findByText(/Choose a PDF file/)).toBeInTheDocument();
    expect(fileInput()).toHaveAttribute("aria-invalid", "true");
  });

  it("requires at least 50 characters of pasted text", async () => {
    mockFetch();
    const { user, roleInput, submit } = renderForm();

    await user.click(screen.getByRole("tab", { name: /Paste text/ }));
    await user.type(screen.getByLabelText("CV text"), "Too short");
    await user.type(roleInput(), "Data Analyst");
    await user.click(submit());

    expect(await screen.findByText(/Paste at least 50 characters/)).toBeInTheDocument();
    expect(screen.getByText(/9 \/ 20,000 characters/)).toBeInTheDocument();
  });
});

describe("NewCvForm submit", () => {
  it("uploads the PDF with the chosen role and opens the new CV", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse({ cv: { id: "cv-1", status: "generating" } }, { status: 202 }));
    const { user, fileInput, roleInput, submit } = renderForm();

    await user.upload(fileInput(), pdf("jane.pdf"));
    await user.click(screen.getByRole("button", { name: "Product Manager" }));
    expect(roleInput()).toHaveValue("Product Manager");
    await user.click(submit());

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/cvs/cv-1"));
    const { url, init } = fetchCall(fetchMock);
    expect(url).toBe("/api/cvs");
    const body = init.body as FormData;
    expect(body.get("targetRole")).toBe("Product Manager");
    expect((body.get("file") as File).name).toBe("jane.pdf");
    expect(body.has("text")).toBe(false);
  });

  it("shows FILE_TOO_LARGE on the file field", async () => {
    mockFetch().mockResolvedValue(errorResponse(413, "FILE_TOO_LARGE", "File too large"));
    const { user, fileInput, roleInput, submit } = renderForm();

    await user.upload(fileInput(), pdf());
    await user.type(roleInput(), "Engineer");
    await user.click(submit());

    expect(await screen.findByText(/This PDF is larger than 5 MB/)).toBeInTheDocument();
    expect(fileInput()).toHaveAttribute("aria-invalid", "true");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("explains rate limiting at form level", async () => {
    mockFetch().mockResolvedValue(
      errorResponse(429, "RATE_LIMITED", "Too many requests", undefined, { "Retry-After": "120" }),
    );
    const { user, fileInput, roleInput, submit } = renderForm();

    await user.upload(fileInput(), pdf());
    await user.type(roleInput(), "Engineer");
    await user.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /up to 10 CV generations per hour.*at most 3 running at the same time.*try again in 2 minutes/,
    );
  });

  it("sends pasted text as the `text` field, trimmed", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse({ cv: { id: "cv-2", status: "generating" } }, { status: 202 }));
    const { user, roleInput, submit } = renderForm();
    const source = "Jane Doe, backend engineer at Acme since 2021, Go and PostgreSQL, BSc from MIT.";

    await user.click(screen.getByRole("tab", { name: /Paste text/ }));
    await user.type(screen.getByLabelText("CV text"), `  ${source}  `);
    await user.type(roleInput(), " Senior Backend Engineer ");
    await user.click(submit());

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/cvs/cv-2"));
    const body = fetchCall(fetchMock).init.body as FormData;
    expect(body.get("text")).toBe(source);
    expect(body.get("targetRole")).toBe("Senior Backend Engineer");
    expect(body.has("file")).toBe(false);
  });

  it.each([
    ["UNSUPPORTED_FILE", 415, "Only PDF files are supported", /isn't a valid PDF/],
    [
      "UNPROCESSABLE_SOURCE",
      422,
      "This PDF has 11 pages; at most 10 are supported.",
      /This PDF has 11 pages; at most 10 are supported\. Try another export, or paste the text instead\./,
    ],
  ])("shows %s on the file field", async (code, status, message, expected) => {
    mockFetch().mockResolvedValue(errorResponse(status, code, message));
    const { user, fileInput, roleInput, submit } = renderForm();

    await user.upload(fileInput(), pdf());
    await user.type(roleInput(), "Engineer");
    await user.click(submit());

    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(fileInput()).toHaveAttribute("aria-invalid", "true");
  });
});

describe("NewCvForm sources", () => {
  it("sends only the selected source when both were filled in", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse({ cv: { id: "cv-3", status: "generating" } }, { status: 202 }));
    const { user, fileInput, roleInput, submit } = renderForm();

    await user.upload(fileInput(), pdf("old.pdf"));
    await user.click(screen.getByRole("tab", { name: /Paste text/ }));
    await user.type(
      screen.getByLabelText("CV text"),
      "Jane Doe, backend engineer at Acme since 2021, Go and PostgreSQL.",
    );
    await user.type(roleInput(), "Engineer");
    await user.click(submit());

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/cvs/cv-3"));
    const body = fetchCall(fetchMock).init.body as FormData;
    expect(body.has("file")).toBe(false);
    expect(body.get("text")).toMatch(/^Jane Doe/);
  });

  it("does not block submitting a PDF because of text typed in the other tab", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse({ cv: { id: "cv-4", status: "generating" } }, { status: 202 }));
    const { user, fileInput, roleInput, submit } = renderForm();

    await user.click(screen.getByRole("tab", { name: /Paste text/ }));
    await user.type(screen.getByLabelText("CV text"), "Too short");
    await user.click(screen.getByRole("tab", { name: /Upload PDF/ }));
    await user.upload(fileInput(), pdf("jane.pdf"));
    await user.type(roleInput(), "Engineer");
    await user.click(submit());

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/cvs/cv-4"));
    const body = fetchCall(fetchMock).init.body as FormData;
    expect(body.has("text")).toBe(false);
    expect((body.get("file") as File).name).toBe("jane.pdf");
  });

  it("rejects an oversized PDF before uploading it", async () => {
    const fetchMock = mockFetch();
    const { user, fileInput } = renderForm();

    await user.upload(fileInput(), pdf("huge.pdf", 6 * 1024 * 1024));

    expect(await screen.findByText(/This PDF is 6 MB; the limit is 5 MB/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps pasted text and the role across a reload, and forgets them once the CV is created", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse({ cv: { id: "cv-5", status: "generating" } }, { status: 202 }));
    const source = "Jane Doe, backend engineer at Acme since 2021, Go and PostgreSQL, BSc from MIT.";
    const first = renderForm();
    await first.user.click(screen.getByRole("tab", { name: /Paste text/ }));
    await first.user.type(screen.getByLabelText("CV text"), source);
    await first.user.type(first.roleInput(), "Data Analyst");
    cleanup();

    const second = renderForm();

    await waitFor(() => expect(screen.getByLabelText("CV text")).toHaveValue(source));
    expect(screen.getByRole("tab", { name: /Paste text/ })).toHaveAttribute("aria-selected", "true");
    expect(second.roleInput()).toHaveValue("Data Analyst");
    await second.user.click(second.submit());
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/cvs/cv-5"));
    expect(sessionStorage.getItem("cvb:draft:new-cv")).toBeNull();
  });
});
