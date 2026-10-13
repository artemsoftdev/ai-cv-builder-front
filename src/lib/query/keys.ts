/** Query keys. `["cvs"]` (the list) and `["cv", id]` (one CV) are deliberately disjoint prefixes. */
export const queryKeys = {
  me: ["me"] as const,
  cvs: ["cvs"] as const,
  cv: (id: string) => ["cv", id] as const,
};
