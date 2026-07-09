"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { listHistory } from "@/lib/api/history";

export function useHistory(workspaceId: string, limit = 50) {
  return useInfiniteQuery({
    queryKey: ["history", workspaceId, limit],
    queryFn: ({ pageParam }) =>
      listHistory(workspaceId, { limit, before: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_before ?? undefined,
    enabled: Boolean(workspaceId),
  });
}
