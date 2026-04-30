// src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data considered fresh for 30 seconds before background refetch
      staleTime: 30_000,
      // Retry failed requests twice before showing error
      retry: 2,
      // Refetch when user returns to the tab
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
