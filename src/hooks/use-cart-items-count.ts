import { useQuery } from "@tanstack/react-query";

import { getCartCount } from "@/components/booking/actions";

export function useCartItemsCount() {
  return useQuery({
    queryKey: ["cart-items-count"],
    queryFn: () => getCartCount(),
    refetchInterval: 30000,
    staleTime: 10000,
  });
}
