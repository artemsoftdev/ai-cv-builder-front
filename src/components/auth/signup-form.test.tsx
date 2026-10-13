import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query/query-client";
import { errorResponse, fetchCall, jsonResponse, mockFetch } from "@/test/http";

import { SignupForm } from "./signup-form";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function renderForm(next = "/cvs/abc") {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient({ onUnauthorized: vi.fn() })}>
      <SignupForm next={next} />
    </QueryClientProvider>,
  );
  const fill = async (email: string, password: string, repeat = password) => {
    await user.type(screen.getByLabelText("Email"), email);
    await user.type(screen.getByLabelText("Password"), password);
    await user.type(screen.getByLabelText("Repeat password"), repeat);
    await user.click(screen.getByRole("button", { name: "Create account" }));
  };
  return { user, fill };
}

beforeEach(() => {
  router.replace.mockReset();
  sessionStorage.clear();
});

describe("SignupForm", () => {
  it("checks that the passwords match before calling the API", async () => {
    const fetchMock = mockFetch();
    const { fill } = renderForm();

    await fill("jane@example.com", "long-enough-password", "something-else");

    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates the account without sending the repeated password and continues to next", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(
      jsonResponse(
        { user: { id: "u1", email: "jane@example.com", createdAt: "2026-01-01T00:00:00.000Z" } },
        { status: 201 },
      ),
    );
    const { fill } = renderForm();

    await fill("jane@example.com", "long-enough-password");

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/cvs/abc"));
    const { url, init } = fetchCall(fetchMock);
    expect(url).toBe("/api/auth/signup");
    expect(JSON.parse(String(init.body))).toEqual({ email: "jane@example.com", password: "long-enough-password" });
  });

  it("offers to log in instead when the email is taken, keeping next", async () => {
    mockFetch().mockResolvedValue(errorResponse(409, "EMAIL_TAKEN", "Email already registered"));
    const { fill } = renderForm();

    await fill("jane@example.com", "long-enough-password");

    expect(await screen.findByText("An account with this email already exists.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(screen.getByRole("link", { name: "Log in instead" })).toHaveAttribute("href", "/login?next=%2Fcvs%2Fabc");
    expect(router.replace).not.toHaveBeenCalled();
  });
});
