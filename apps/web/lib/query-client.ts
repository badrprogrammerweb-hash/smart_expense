import type { QueryClient } from "@tanstack/react-query";

let activeQueryClient: QueryClient | null = null;

export function registerQueryClient(queryClient: QueryClient) {
  activeQueryClient = queryClient;
  return () => {
    if (activeQueryClient === queryClient) activeQueryClient = null;
  };
}

export function clearInMemoryQueryCache() {
  activeQueryClient?.clear();
}
