import { useCallback, useEffect, useState } from 'react';

import { normalizeError } from '@/src/services/errors';
import { useAppStore } from '@/src/state/appStore';

export function useReloadable<T>(loader: () => Promise<T>, initial: T) {
  const revision = useAppStore((state) => state.dbRevision);
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setData(await loader()); }
    catch (caught) { setError(normalizeError(caught).message); }
    finally { setLoading(false); }
  }, [loader]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) void reload(); });
    return () => { active = false; };
  }, [reload, revision]);
  return { data, loading, error, reload };
}
