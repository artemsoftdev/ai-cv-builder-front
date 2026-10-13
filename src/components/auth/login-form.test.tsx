import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query/query-client";
import { errorResponse, fetchCall, jsonResponse, mockFetch } from "@/test/http";

import { LoginForm } from "./login-form";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const onUnauthorized = vi.fn();

function renderForm(next = "/cvs") {
  const queryClient = createQueryClient({ onUnauthorized });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <LoginForm next={next} />
    </QueryClientProvider>,
  );
  return {
    user,
    email: screen.getByLabelText("Email"),
    password: screen.getByLabelText("Password"),
    submit: screen.getByRole("button", { name: "Log in" }),
  };
}

beforeEach(() => {
  router.replace.mockReset();
  onUnauthorized.mockReset();
});

describe("LoginForm validation", () => {
  it("shows field errors and does not call the API when the form is empty", async () => {
    const fetchMock = mockFetch();
    const { user, email, password, submit } = renderForm();

    await user.click(submit);

    expect(await screen.findByText("Enter your email address")).toBeInTheDocument();
    expect(screen.getByText("Use at least 8 characters")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Enter your email address");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const fetchMock = mockFetch();
    const { user, email, password, submit } = renderForm();

    await user.type(email, "not-an-email");
    await user.type(password, "long-enough-password");
    await user.click(submit);

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("LoginForm server errors", () => {
  it("shows a form-level error for wrong credentials without treating it as an expired session", async () => {
    mockFetch().mockResolvedValue(errorResponse(401, "INVALID_CREDENTIALS", "Invalid email or password"));
    const { user, email, password, submit } = renderForm();

    await user.type(email, "jane@example.com");
    await user.type(password, "wrong-password");
    await user.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(password).toHaveFocus();
    expect(router.replace).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("puts VALIDATION_ERROR issues on the matching field", async () => {
    mockFetch().mockResolvedValue(
      errorResponse(400, "VALIDATION_ERROR", "Invalid request", {
        issues: [{ path: "body.email", message: "Email domain is not allowed" }],
      }),
    );
    const { user, email, password, submit } = renderForm();

    await user.type(email, "jane@example.com");
    await user.type(password, "long-enough-password");
    await user.click(submit);

    expect(await screen.findByText("Email domain is not allowed")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
  });

  it("explains rate limiting using Retry-After", async () => {
    mockFetch().mockResolvedValue(
      errorResponse(429, "RATE_LIMITED", "Too many requests", undefined, { "Retry-After": "600" }),
    );
    const { user, email, password, submit } = renderForm();

    await user.type(email, "jane@example.com");
    await user.type(password, "long-enough-password");
    await user.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts. Please try again in 10 minutes.");
  });

  it("tells the user when the server can't be reached", async () => {
    mockFetch().mockRejectedValue(new TypeError("Failed to fetch"));
    const { user, email, password, submit } = renderForm();

    await user.type(email, "jane@example.com");
    await user.type(password, "long-enough-password");
    await user.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server");
  });
});

describe("LoginForm success", () => {
  it("logs in with the trimmed email and redirects to next", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(
      jsonResponse({ user: { id: "u1", email: "jane@example.com", createdAt: "2026-01-01T00:00:00.000Z" } }),
    );
    const { user, email, password, submit } = renderForm("/cvs/abc");

    await user.type(email, "  jane@example.com ");
    await user.type(password, "long-enough-password");
    await user.click(submit);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/cvs/abc"));
    const { url, init, headers } = fetchCall(fetchMock);
    expect(url).toBe("/api/auth/login");
    expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest");
    expect(JSON.parse(String(init.body))).toEqual({ email: "jane@example.com", password: "long-enough-password" });
  });
});
