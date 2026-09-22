import { useCallback, useEffect, useRef, useState } from "react";

import { normalizeError } from "@/src/services/errors";
import { useAppStore } from "@/src/state/appStore";

export function useReloadable<T>(loader: () => Promise<T>, initial: T) {
  const revision = useAppStore((state) => state.dbRevision);
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const mounted = useRef(true);
  const requestId = useRef(0);
  const execute = useCallback(
    async (showLoading: boolean) => {
      const id = ++requestId.current;
      if (showLoading || !hasLoaded.current) setLoading(true);
      setError(null);
      try {
        const next = await loader();
        if (mounted.current && id === requestId.current) setData(next);
      } catch (caught) {
        if (mounted.current && id === requestId.current)
          setError(normalizeError(caught).message);
      } finally {
        if (mounted.current && id === requestId.current) {
          hasLoaded.current = true;
          setLoading(false);
        }
      }
    },
    [loader],
  );
  const reload = useCallback(() => execute(true), [execute]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, []);
  useEffect(() => {
    void execute(!hasLoaded.current);
  }, [execute, revision]);
  return { data, loading, error, reload };
}
