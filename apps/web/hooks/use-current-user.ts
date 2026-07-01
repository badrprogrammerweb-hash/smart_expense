"use client";

import { useQuery } from "@tanstack/react-query";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useCurrentUserId() {
  return useQuery({
    queryKey: ["auth", "currentUserId"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      return session?.user.id ?? null;
    },
    staleTime: Infinity,
  });
}
