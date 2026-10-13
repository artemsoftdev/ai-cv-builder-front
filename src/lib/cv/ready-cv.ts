import type { Cv, CvContent } from "@/lib/api/types";

/** A CV whose first generation succeeded: what the editor works with. */
export type ReadyCv = Cv & { content: CvContent };

export const hasContent = (cv: Cv): cv is ReadyCv => cv.content !== null;
