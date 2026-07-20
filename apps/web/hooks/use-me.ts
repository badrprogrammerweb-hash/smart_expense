"use client";

import { useQuery } from "@tanstack/react-query";

import { getMe } from "@/lib/api/me";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });
}
