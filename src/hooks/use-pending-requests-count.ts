import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

const PENDING_REQUESTS_COUNT_KEY = ["pending-requests-count"] as const;

export function usePendingRequestsCount() {
  return useQuery({
    queryKey: PENDING_REQUESTS_COUNT_KEY,
    queryFn: async () => {
      const response = await fetch("/api/validation-requests/count");
      if (!response.ok) throw new Error("Failed to fetch pending requests count");
      const data = await response.json();
      return data.count as number;
    },
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}

export function useInvalidatePendingRequestsCount() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: PENDING_REQUESTS_COUNT_KEY });
  }, [queryClient]);
}
