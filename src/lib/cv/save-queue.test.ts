import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { CvContent } from "@/lib/api/types";

import { mergePatches, SaveQueue, type SaveState, type VersionedCvPatch } from "./save-queue";

const content = (summary: string): CvContent => ({
  contact: { fullName: "Jane", headline: "", email: "", phone: "", location: "", links: [] },
  summary,
  experience: [],
  education: [],
  skills: [],
});

const apiError = (status: number, code: string) => new ApiError({ status, code, message: code });

type Deferred = { resolve: (version: number) => void; reject: (error: unknown) => void };

/** A queue whose `send` calls stay pending until the test settles them. */
function setup(version = 1) {
  const requests: Array<VersionedCvPatch & Deferred> = [];
  const states: SaveState["status"][] = [];
  const onConflict = vi.fn();
  const onSaved = vi.fn();
  const queue = new SaveQueue(
    version,
    { debounceMs: 1_000, retryDelaysMs: [2_000] },
    {
      send: (patch) =>
        new Promise((resolve, reject) => {
          requests.push({ ...patch, resolve: (v) => resolve({ version: v }), reject });
        }),
      onStateChange: (state) => states.push(state.status),
      onConflict,
      onSaved,
    },
  );
  const request = (index: number) => {
    const found = requests[index];
    if (!found) throw new Error(`request #${index} was not sent (sent: ${requests.length})`);
    return found;
  };
  return { queue, requests, request, states, onConflict, onSaved };
}

/** Lets the queue's promise chains run. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SaveQueue debounce", () => {
  it("sends one PATCH with the latest content after the user pauses", async () => {
    const { queue, requests, request } = setup(4);

    queue.schedule({ content: content("a") });
    await vi.advanceTimersByTimeAsync(600);
    queue.schedule({ content: content("ab") });
    await vi.advanceTimersByTimeAsync(600);
    queue.schedule({ content: content("abc") });
    expect(queue.state.status).toBe("pending");
    await vi.advanceTimersByTimeAsync(999);
    expect(requests).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(requests).toHaveLength(1);
    expect(request(0).version).toBe(4);
    expect(request(0).content?.summary).toBe("abc");
    expect(queue.state.status).toBe("saving");
  });

  it("sends title changes and dismissed flags immediately", async () => {
    const { queue, request } = setup();

    queue.schedule({ title: "Backend CV" }, { immediate: true });
    await settle();

    expect(request(0)).toMatchObject({ title: "Backend CV", version: 1 });
  });
});

describe("SaveQueue serialisation", () => {
  it("never has two requests in flight and chains versions", async () => {
    const { queue, requests, request, onSaved } = setup(1);

    queue.schedule({ content: content("first") });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(requests).toHaveLength(1);

    // More edits while the first PATCH is still running.
    queue.schedule({ content: content("second") });
    queue.schedule({ title: "Renamed" }, { immediate: true });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(requests).toHaveLength(1);
    expect(queue.hasUnsavedChanges).toBe(true);

    request(0).resolve(2);
    await settle();

    expect(requests).toHaveLength(2);
    expect(request(1)).toMatchObject({ version: 2, title: "Renamed" });
    expect(request(1).content?.summary).toBe("second");
    expect(onSaved).toHaveBeenCalledWith({ content: content("first") });

    request(1).resolve(3);
    await settle();
    expect(queue.version).toBe(3);
    expect(queue.state.status).toBe("saved");
    expect(queue.hasUnsavedChanges).toBe(false);
  });

  it("merges unsent patches: newest title/content win, dismissed flags accumulate", () => {
    expect(
      mergePatches(
        { title: "Old", content: content("old"), dismissFlagIds: ["f1"] },
        { content: content("new"), dismissFlagIds: ["f2", "f1"] },
      ),
    ).toEqual({ title: "Old", content: content("new"), dismissFlagIds: ["f1", "f2"] });
  });
});

describe("SaveQueue failures", () => {
  it("drops local changes on VERSION_CONFLICT and waits for reset()", async () => {
    const { queue, requests, request, onConflict } = setup(5);

    queue.schedule({ content: content("mine") });
    await vi.advanceTimersByTimeAsync(1_000);
    request(0).reject(apiError(409, "VERSION_CONFLICT"));
    await settle();

    expect(queue.state.status).toBe("conflict");
    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(queue.hasUnsavedChanges).toBe(false);

    // Typing before the latest version is loaded must not overwrite it.
    queue.schedule({ content: content("typed meanwhile") });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(requests).toHaveLength(1);

    queue.reset(7);
    expect(queue.state.status).toBe("saved");
    queue.schedule({ content: content("after reload") });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(request(1)).toMatchObject({ version: 7 });
    expect(request(1).content?.summary).toBe("after reload");
  });

  it("keeps changes on CV_BUSY and sends them when resumed", async () => {
    const { queue, requests, request } = setup(2);

    queue.schedule({ content: content("edit") });
    await vi.advanceTimersByTimeAsync(1_000);
    request(0).reject(apiError(409, "CV_BUSY"));
    await settle();

    expect(queue.state.status).toBe("waiting");
    expect(queue.blockedReason).toBe("busy");
    queue.schedule({ content: content("edit 2") });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(requests).toHaveLength(1);

    queue.resume();
    await settle();
    expect(request(1)).toMatchObject({ version: 2 });
    expect(request(1).content?.summary).toBe("edit 2");
  });

  it("retries transient failures automatically, with backoff", async () => {
    const { queue, requests, request } = setup();

    queue.schedule({ content: content("x") });
    await vi.advanceTimersByTimeAsync(1_000);
    request(0).reject(apiError(0, "NETWORK_ERROR"));
    await settle();

    expect(queue.state).toMatchObject({ status: "error", willRetry: true });
    await vi.advanceTimersByTimeAsync(1_999);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(requests).toHaveLength(2);
    expect(request(1).content?.summary).toBe("x");

    // Out of automatic retries: stays in error until the user retries or edits again.
    request(1).reject(apiError(503, "INTERNAL"));
    await settle();
    expect(queue.state).toMatchObject({ status: "error", willRetry: false });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(requests).toHaveLength(2);

    queue.retry();
    await settle();
    expect(requests).toHaveLength(3);
  });

  it("does not retry client errors on its own", async () => {
    const { queue, requests, request } = setup();

    queue.schedule({ content: content("x") });
    await vi.advanceTimersByTimeAsync(1_000);
    request(0).reject(apiError(400, "VALIDATION_ERROR"));
    await settle();

    expect(queue.state).toMatchObject({ status: "error", willRetry: false });
    expect(queue.hasUnsavedChanges).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(requests).toHaveLength(1);
  });
});

describe("SaveQueue.flush", () => {
  it("sends debounced changes right away and resolves once saved", async () => {
    const { queue, request } = setup(1);
    queue.schedule({ content: content("draft") });

    const flushed = queue.flush();
    await settle();
    request(0).resolve(2);

    await expect(flushed).resolves.toBe(true);
    expect(queue.version).toBe(2);
  });

  it("resolves false when the changes cannot be saved", async () => {
    const { queue, request } = setup();
    queue.schedule({ content: content("draft") });

    const flushed = queue.flush();
    await settle();
    request(0).reject(apiError(409, "CV_BUSY"));

    await expect(flushed).resolves.toBe(false);
    expect(queue.hasUnsavedChanges).toBe(true);
  });

  it("resolves true immediately when nothing is pending", async () => {
    const { queue, requests } = setup();
    await expect(queue.flush()).resolves.toBe(true);
    expect(requests).toHaveLength(0);
  });
});

describe("SaveQueue.reset", () => {
  it("drops queued edits and continues from the server version", async () => {
    const { queue, requests } = setup(1);
    queue.schedule({ content: content("stale") });

    queue.reset(9);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(requests).toHaveLength(0);
    expect(queue.version).toBe(9);
    expect(queue.state.status).toBe("saved");
  });
});
