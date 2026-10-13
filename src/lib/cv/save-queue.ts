import { isApiError, isTransientError } from "@/lib/api/errors";
import type { CvContent } from "@/lib/api/types";

export type CvPatch = { title?: string; content?: CvContent; dismissFlagIds?: string[] };

export type VersionedCvPatch = CvPatch & { version: number };

export type SaveState =
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

export type SendOptions = { keepalive: boolean };

export type SaveQueueHandlers = {
  send: (patch: VersionedCvPatch, options: SendOptions) => Promise<{ version: number }>;
  onStateChange?: (state: SaveState) => void;
  onSaved?: (patch: CvPatch) => void;
  onConflict?: () => void;
  onBusy?: () => void;
};

export type SaveQueueOptions = {
  debounceMs?: number;
  retryDelaysMs?: readonly number[];
};

export const AUTOSAVE_DEBOUNCE_MS = 1_000;
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000, 30_000] as const;
const MAX_FLUSH_ROUNDS = 3;

export function mergePatches(older: CvPatch | null, newer: CvPatch | null): CvPatch | null {
  if (!older) return newer;
  if (!newer) return older;
  const merged: CvPatch = { ...older, ...newer };
  if (older.dismissFlagIds || newer.dismissFlagIds) {
    merged.dismissFlagIds = [...new Set([...(older.dismissFlagIds ?? []), ...(newer.dismissFlagIds ?? [])])];
  }
  return merged;
}

// Serialised, debounced writer for one CV: one PATCH in flight, versions chained, failed edits kept.
export class SaveQueue {
  #version: number;
  #pending: CvPatch | null = null;
  #inFlight: Promise<void> | null = null;
  #debounceTimer: ReturnType<typeof setTimeout> | null = null;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #failures = 0;
  #blocked: "busy" | "conflict" | null = null;
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

  get version(): number {
    return this.#version;
  }

  get state(): SaveState {
    return this.#state;
  }

  get hasUnsavedChanges(): boolean {
    return this.#pending !== null || this.#inFlight !== null;
  }

  get blockedReason(): "busy" | "conflict" | null {
    return this.#blocked;
  }

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

  // keepalive: the page may be about to go away (hidden, unloaded), so the request must outlive it.
  async flush({ keepalive = false }: { keepalive?: boolean } = {}): Promise<boolean> {
    for (let round = 0; round < MAX_FLUSH_ROUNDS; round += 1) {
      while (this.#inFlight) await this.#inFlight;
      if (this.#blocked || !this.#pending) break;
      // An explicit flush retries once even after an error, but does not loop on it.
      if (round > 0 && this.#state.status === "error") break;
      this.#run({ keepalive });
    }
    return this.#pending === null && this.#blocked === null && this.#inFlight === null;
  }

  retry(): void {
    this.#run();
  }

  resume(): void {
    if (this.#blocked !== "busy") return;
    this.#blocked = null;
    if (this.#pending) this.#run();
    else this.#setState({ status: "saved" });
  }

  reset(version: number): void {
    this.#clearDebounceTimer();
    this.#clearRetryTimer();
    this.#pending = null;
    this.#blocked = null;
    this.#failures = 0;
    this.#version = version;
    if (!this.#inFlight) this.#setState({ status: "saved" });
  }

  #run(options: SendOptions = { keepalive: false }): void {
    this.#clearDebounceTimer();
    const handlers = this.#handlers;
    // Without handlers the change simply stays queued.
    if (this.#inFlight || this.#blocked || !this.#pending || !handlers) return;
    this.#clearRetryTimer();

    const patch = this.#pending;
    this.#pending = null;
    const request: VersionedCvPatch = { ...patch, version: this.#version };
    this.#setState({ status: "saving" });
    // From a microtask, so #inFlight is assigned before any handler runs.
    this.#inFlight = Promise.resolve()
      .then(() => handlers.send(request, options))
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
      this.#clearDebounceTimer();
      this.#clearRetryTimer();
      this.#pending = null;
      this.#blocked = "conflict";
      this.#setState({ status: "conflict" });
      this.#handlers?.onConflict?.();
      return;
    }

    // Keep the change: the failed patch first, anything typed since on top of it.
    this.#pending = mergePatches(patch, this.#pending);

    if (isApiError(error, "CV_BUSY")) {
      this.#clearDebounceTimer();
      this.#clearRetryTimer();
      this.#blocked = "busy";
      this.#setState({ status: "waiting" });
      this.#handlers?.onBusy?.();
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

  #clearDebounceTimer(): void {
    if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
    this.#debounceTimer = null;
  }

  #clearRetryTimer(): void {
    if (this.#retryTimer) clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
  }
}
