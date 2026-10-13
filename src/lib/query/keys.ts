export const queryKeys = {
  me: ["me"] as const,
  cvs: ["cvs"] as const,
  cv: (id: string) => ["cv", id] as const,
};
