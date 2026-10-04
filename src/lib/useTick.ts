import { useEffect, useState } from 'react';

/** Re-render every `ms` (for gentle countdowns / day rollover). */
export function useTick(ms = 30_000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}
