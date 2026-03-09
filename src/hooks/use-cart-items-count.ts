import { useQuery } from "@tanstack/react-query";

export function useCartItemsCount() {
  return useQuery({
    queryKey: ["cart-items-count"],
    queryFn: async () => {
      const response = await fetch("/api/cart/count");
      if (!response.ok) throw new Error("Failed to fetch cart count");
      const data = await response.json();
      return data.count as number;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data fresh for 10 seconds
  });
}
