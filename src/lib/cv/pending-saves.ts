type Flush = () => Promise<boolean>;

const flushes = new Set<Flush>();

export function registerFlush(flush: Flush): () => void {
  flushes.add(flush);
  return () => {
    flushes.delete(flush);
  };
}

// Before ending the session: the API would reject anything sent afterwards.
export async function flushPendingSaves(): Promise<void> {
  await Promise.all([...flushes].map((flush) => flush()));
}
