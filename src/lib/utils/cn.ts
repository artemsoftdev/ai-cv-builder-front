import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's t-shirt shadow sizes; register our semantic ones
// (see globals.css) so `shadow-card` and `shadow-elevated` override each other correctly.
const twMerge = extendTailwindMerge({
  extend: { theme: { shadow: ["card", "elevated"] } },
});

/** Joins class names and resolves Tailwind conflicts (the last one wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
