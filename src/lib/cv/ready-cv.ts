import type { Cv, CvContent } from "@/lib/api/types";

export type ReadyCv = Cv & { content: CvContent };

export const hasContent = (cv: Cv): cv is ReadyCv => cv.content !== null;
