import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { CvSummary } from "@/lib/api/types";

import {
  CV_LIST_POLL_INTERVAL_MS,
  CV_POLL_INTERVAL_MS,
  getCvListRefetchInterval,
  getCvRefetchInterval,
} from "./polling";

const cv = (status: CvSummary["status"], busy = false) => ({ status, busy });

describe("getCvRefetchInterval", () => {
  it("polls every 1.5 s while generating", () => {
    expect(CV_POLL_INTERVAL_MS).toBe(1_500);
    expect(getCvRefetchInterval(cv("generating"))).toBe(1_500);
  });

  it("polls while a ready CV is busy (an answer is being applied)", () => {
    expect(getCvRefetchInterval(cv("ready", true))).toBe(1_500);
  });

  it("stops once the CV settles", () => {
    expect(getCvRefetchInterval(cv("ready"))).toBe(false);
    expect(getCvRefetchInterval(cv("failed"))).toBe(false);
  });

  it("does not poll before the first response", () => {
    expect(getCvRefetchInterval(undefined)).toBe(false);
  });

  it("keeps polling through transient errors but stops on 4xx", () => {
    const network = new ApiError({ status: 0, code: "NETWORK_ERROR", message: "offline" });
    const server = new ApiError({ status: 503, code: "INTERNAL", message: "down" });
    const notFound = new ApiError({ status: 404, code: "NOT_FOUND", message: "gone" });

    expect(getCvRefetchInterval(cv("generating"), network)).toBe(1_500);
    expect(getCvRefetchInterval(cv("generating"), server)).toBe(1_500);
    expect(getCvRefetchInterval(cv("generating"), notFound)).toBe(false);
  });
});

describe("getCvListRefetchInterval", () => {
  const summary = (status: CvSummary["status"], busy = false): CvSummary => ({
    id: crypto.randomUUID(),
    title: "CV",
    targetRole: "Engineer",
    status,
    stage: status === "generating" ? "drafting" : "done",
    busy,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    openQuestions: 0,
  });

  it("polls while any CV in the list is in progress", () => {
    expect(getCvListRefetchInterval([summary("ready"), summary("generating")])).toBe(CV_LIST_POLL_INTERVAL_MS);
    expect(getCvListRefetchInterval([summary("ready", true)])).toBe(CV_LIST_POLL_INTERVAL_MS);
  });

  it("stays idle when everything is settled or nothing is loaded", () => {
    expect(getCvListRefetchInterval([summary("ready"), summary("failed")])).toBe(false);
    expect(getCvListRefetchInterval([])).toBe(false);
    expect(getCvListRefetchInterval(undefined)).toBe(false);
  });
});
