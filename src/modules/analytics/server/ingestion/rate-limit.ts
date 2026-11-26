/**
 * Einfaches Rate-Limit im Speicher (Fenster je Schlüssel).
 * Gilt pro Server-Instanz – ein Schutz gegen Ausreißer, kein globales Limit.
 * Für globale Limits: Upstash Redis (Architektur §2.4), sobald der Traffic es erfordert.
 */
type Window = { count: number; resetAt: number };

export const createRateLimiter = ({ limit, windowMs, maxKeys = 10_000 }: { limit: number; windowMs: number; maxKeys?: number }) => {
  const windows = new Map<string, Window>();
  return (key: string, now = Date.now()): boolean => {
    const current = windows.get(key);
    if (!current || current.resetAt <= now) {
      if (windows.size >= maxKeys) {
        for (const [entryKey, entry] of windows) if (entry.resetAt <= now) windows.delete(entryKey);
        if (windows.size >= maxKeys) windows.clear();
      }
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    current.count += 1;
    return current.count <= limit;
  };
};
