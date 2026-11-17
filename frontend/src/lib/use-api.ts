"use client";

import { useCallback, useEffect, useState } from "react";

import { api, errorMessage } from "./api";

interface State<T> {
  key: string | null;
  data: T | null;
  error: string | null;
}

/**
 * Minimal GET hook: { data, error, loading, reload, setData }.
 * Pass `null` as the endpoint to skip fetching.
 *
 * `loading` is derived (the latest request key has not resolved yet) rather
 * than set inside the effect, which avoids cascading renders.
 */
export function useApi<T>(endpoint: string | null) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<State<T>>({ key: null, data: null, error: null });
  const key = endpoint ? `${endpoint}#${tick}` : null;

  useEffect(() => {
    if (!key || !endpoint) return;
    const controller = new AbortController();
    api
      .get<T>(endpoint, { signal: controller.signal })
      .then((res) => setState({ key, data: res.data ?? null, error: null }))
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setState((s) => ({ key, data: s.data, error: errorMessage(err) }));
      });
    return () => controller.abort();
  }, [key, endpoint]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback(
    (updater: T | null | ((prev: T | null) => T | null)) =>
      setState((s) => ({ ...s, data: typeof updater === "function" ? (updater as (p: T | null) => T | null)(s.data) : updater })),
    [],
  );

  return {
    data: state.data,
    error: key && state.key === key ? state.error : null,
    loading: key !== null && state.key !== key,
    reload,
    setData,
  };
}
