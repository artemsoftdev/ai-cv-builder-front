import { isApiError, isTransientError } from "@/lib/api/errors";
import type { CvContent } from "@/lib/api/types";

/** Everything the editor saves through `PATCH /api/cvs/:id`; the queue adds `version`. */
export type CvPatch = { title?: string; content?: CvContent; dismissFlagIds?: string[] };

export type VersionedCvPatch = CvPatch & { version: number };

export type SaveState =
  /** Nothing unsaved. */
  | { status: "saved" }
  /** Changes are waiting for the debounce. */
  | { status: "pending" }
  | { status: "saving" }
  /** `CV_BUSY`: a background job owns the CV; changes are kept and sent by `resume()`. */
  | { status: "waiting" }
  /** `VERSION_CONFLICT`: changes were dropped; waiting for `reset()` with the server's version. */
  | { status: "conflict" }
  /** Any other failure; changes are kept. `willRetry` when an automatic retry is scheduled. */
  | { status: "error"; error: unknown; willRetry: boolean };

/** Callbacks; replaceable with `setHandlers` (a React component passes fresh closures). */
export type SaveQueueHandlers = {
  send: (patch: VersionedCvPatch) => Promise<{ version: number }>;
  onStateChange?: (state: SaveState) => void;
  /** After a successful PATCH, with what it contained. */
  onSaved?: (patch: CvPatch) => void;
  onConflict?: () => void;
};

export type SaveQueueOptions = {
  debounceMs?: number;
  /** Backoff for automatic retries of transient failures (network, 5xx); one entry per attempt. */
  retryDelaysMs?: readonly number[];
  now?: () => number;
};

export const AUTOSAVE_DEBOUNCE_MS = 1_000;
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000, 30_000] as const;
const MAX_FLUSH_ROUNDS = 3;

/** Combines two unsent patches: the newer title/content wins, dismissed flags accumulate. */
export function mergePatches(older: CvPatch | null, newer: CvPatch | null): CvPatch | null {
  if (!older) return newer;
  if (!newer) return older;
  const merged: CvPatch = { ...older, ...newer };
  if (older.dismissFlagIds || newer.dismissFlagIds) {
    merged.dismissFlagIds = [...new Set([...(older.dismissFlagIds ?? []), ...(newer.dismissFlagIds ?? [])])];
  }
  return merged;
}

/**
 * Serialised, debounced writer for one CV. Guarantees:
 * - at most one PATCH in flight; edits made meanwhile are merged and sent next;
 * - every PATCH carries the version returned by the previous one (optimistic locking);
 * - nothing typed is lost on a failed request: it stays queued (except on a version conflict,
 *   where the server copy wins and the caller reloads it).
 *
 * Plain class (no React) so the timing rules can be unit-tested with fake timers.
 */
export class SaveQueue {
  #version: number;
  #pending: CvPatch | null = null;
  #inFlight: Promise<void> | null = null;
  #debounceTimer: ReturnType<typeof setTimeout> | null = null;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #failures = 0;
  #blocked: { reason: "busy" | "conflict"; since: number } | null = null;
  #state: SaveState = { status: "saved" };
  #handlers: SaveQueueHandlers | null;
  readonly #options: SaveQueueOptions;

  constructor(version: number, options: SaveQueueOptions = {}, handlers: SaveQueueHandlers | null = null) {
    this.#version = version;
    this.#options = options;
    this.#handlers = handlers;
  }

  setHandlers(handlers: SaveQueueHandlers): void {
    this.#handlers = handlers;
  }

  /** Server version the next PATCH is based on. */
  get version(): number {
    return this.#version;
  }

  get state(): SaveState {
    return this.#state;
  }

  /** Something is queued or being sent. */
  get hasUnsavedChanges(): boolean {
    return this.#pending !== null || this.#inFlight !== null;
  }

  get blockedReason(): "busy" | "conflict" | null {
    return this.#blocked?.reason ?? null;
  }

  /** When the queue got blocked (ms timestamp), to wait for server data newer than that. */
  get blockedSince(): number | null {
    return this.#blocked?.since ?? null;
  }

  /** Queues a change. Content edits are debounced; `immediate` (title, dismiss) sends right away. */
  schedule(patch: CvPatch, { immediate = false }: { immediate?: boolean } = {}): void {
    this.#pending = mergePatches(this.#pending, patch);
    // Busy: sent by resume(). Conflict: dropped by reset(), the server copy wins.
    if (this.#blocked) return;
    this.#clearRetryTimer();
    if (immediate) {
      this.#run();
      return;
    }
    this.#clearDebounceTimer();
    this.#debounceTimer = setTimeout(() => {
      this.#debounceTimer = null;
      this.#run();
    }, this.#options.debounceMs ?? AUTOSAVE_DEBOUNCE_MS);
    if (!this.#inFlight) this.#setState({ status: "pending" });
  }

  /**
   * Sends whatever is queued now and waits for it. Resolves `true` once everything is saved,
   * `false` if that is not possible right now (blocked or the request failed).
   */
  async flush(): Promise<boolean> {
    for (let round = 0; round < MAX_FLUSH_ROUNDS; round += 1) {
      while (this.#inFlight) await this.#inFlight;
      if (this.#blocked || !this.#pending) break;
      // An explicit flush retries once even after an error, but does not loop on it.
      if (round > 0 && this.#state.status === "error") break;
      this.#run();
    }
    return this.#pending === null && this.#blocked === null && this.#inFlight === null;
  }

  /** Manual "retry" after an error. */
  retry(): void {
    this.#run();
  }

  /** The background job that caused `CV_BUSY` has finished: send the queued changes. */
  resume(): void {
    if (this.#blocked?.reason !== "busy") return;
    this.#blocked = null;
    if (this.#pending) this.#run();
    else this.#setState({ status: "saved" });
  }

  /**
   * The editor now shows the server's content at `version` (initial load, an AI update, or
   * recovery from a conflict): drop anything queued and continue from there.
   */
  reset(version: number): void {
    this.#clearDebounceTimer();
    this.#clearRetryTimer();
    this.#pending = null;
    this.#blocked = null;
    this.#failures = 0;
    this.#version = version;
    if (!this.#inFlight) this.#setState({ status: "saved" });
  }

  /** Stops timers (pending changes stay queued; call `flush()` first to send them). */
  dispose(): void {
    this.#clearDebounceTimer();
    this.#clearRetryTimer();
  }

  #run(): void {
    this.#clearDebounceTimer();
    const handlers = this.#handlers;
    // Without handlers (not connected yet) the change simply stays queued.
    if (this.#inFlight || this.#blocked || !this.#pending || !handlers) return;
    this.#clearRetryTimer();

    const patch = this.#pending;
    this.#pending = null;
    const request: VersionedCvPatch = { ...patch, version: this.#version };
    this.#setState({ status: "saving" });
    // Started from a microtask so `#inFlight` is always assigned before any handler runs.
    this.#inFlight = Promise.resolve()
      .then(() => handlers.send(request))
      .then(
        ({ version }) => this.#handleSuccess(patch, version),
        (error: unknown) => this.#handleFailure(patch, error),
      );
  }

  #handleSuccess(patch: CvPatch, version: number): void {
    this.#inFlight = null;
    this.#version = version;
    this.#failures = 0;
    if (this.#pending) {
      // Edits arrived while saving: send them now, unless their debounce is still running.
      if (this.#debounceTimer) this.#setState({ status: "pending" });
      else this.#run();
    } else {
      this.#setState({ status: "saved" });
    }
    this.#handlers?.onSaved?.(patch);
  }

  #handleFailure(patch: CvPatch, error: unknown): void {
    this.#inFlight = null;

    if (isApiError(error, "VERSION_CONFLICT")) {
      // The CV changed elsewhere; our patch is based on stale content. The server copy wins.
      this.#clearDebounceTimer();
      this.#clearRetryTimer();
      this.#pending = null;
      this.#blocked = { reason: "conflict", since: this.#now() };
      this.#setState({ status: "conflict" });
      this.#handlers?.onConflict?.();
      return;
    }

    // Keep the change: the failed patch first, anything typed since on top of it.
    this.#pending = mergePatches(patch, this.#pending);

    if (isApiError(error, "CV_BUSY")) {
      this.#clearDebounceTimer();
      this.#clearRetryTimer();
      this.#blocked = { reason: "busy", since: this.#now() };
      this.#setState({ status: "waiting" });
      return;
    }

    const delays = this.#options.retryDelaysMs ?? RETRY_DELAYS_MS;
    const delay = isTransientError(error) ? delays[this.#failures] : undefined;
    this.#failures += 1;
    if (delay !== undefined && !this.#debounceTimer) {
      this.#retryTimer = setTimeout(() => {
        this.#retryTimer = null;
        this.#run();
      }, delay);
    }
    this.#setState({ status: "error", error, willRetry: this.#retryTimer !== null || this.#debounceTimer !== null });
  }

  #setState(state: SaveState): void {
    this.#state = state;
    this.#handlers?.onStateChange?.(state);
  }

  #now(): number {
    return this.#options.now?.() ?? Date.now();
  }

  #clearDebounceTimer(): void {
    if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
    this.#debounceTimer = null;
  }

  #clearRetryTimer(): void {
    if (this.#retryTimer) clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
  }
}
