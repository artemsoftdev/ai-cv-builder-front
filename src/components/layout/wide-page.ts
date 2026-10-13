/**
 * Pages that need more room (the CV workspace: editor + preview side by side) mark their root
 * with `data-layout="wide"`; the shell's containers then widen together from `lg`.
 * Plain module (not "use client"), so server and client components can both import it.
 */
export const WIDE_PAGE = "lg:[body:has([data-layout=wide])_&]:max-w-7xl";
