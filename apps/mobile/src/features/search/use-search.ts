import type { SearchResponse } from "@transit/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { SEARCH_DEBOUNCE_MS } from "@/shared/config";
import { useDebouncedValue } from "@/shared/time/use-debounced-value";
import { normalizeSearchQuery } from "./normalize-search-query";

interface SearchState {
  query: string;
  data: SearchResponse | undefined;
  error: unknown;
}

/** Debounced one-shot search (no polling). Only the latest request is applied. */
export function useSearch(rawQuery: string) {
  const query = normalizeSearchQuery(useDebouncedValue(rawQuery, SEARCH_DEBOUNCE_MS));
  const [state, setState] = useState<SearchState | undefined>(undefined);
  const latestRequest = useRef(0);

  const run = useCallback((text: string) => {
    latestRequest.current += 1;
    const requestId = latestRequest.current;
    apiClient.search(text).then(
      (data) => {
        if (requestId === latestRequest.current) setState({ query: text, data, error: undefined });
      },
      (error: unknown) => {
        if (requestId === latestRequest.current) setState({ query: text, data: undefined, error });
      },
    );
  }, []);

  useEffect(() => {
    if (query === undefined) {
      latestRequest.current += 1;
      return;
    }
    run(query);
  }, [query, run]);

  const current = query !== undefined && state?.query === query ? state : undefined;
  return {
    query,
    data: current?.data,
    error: current?.error,
    isLoading: query !== undefined && current === undefined,
    retry: () => {
      if (query !== undefined) run(query);
    },
  };
}
