import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: false,
    },
    queries: {
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => failureCount < 1 && !/401|403|Unauthorized|Forbidden/i.test(String(error)),
      staleTime: 30 * 1000,
    },
  },
});
