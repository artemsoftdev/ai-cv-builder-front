import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Register our semantic shadows so shadow-card and shadow-elevated override each other.
const twMerge = extendTailwindMerge({
  extend: { theme: { shadow: ["card", "elevated"] } },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
