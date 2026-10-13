import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Auto-cleanup needs test globals, which are off.
afterEach(() => {
  cleanup();
});
