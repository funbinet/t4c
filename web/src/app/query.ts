import { QueryClient } from '@tanstack/react-query'

// Transient failures (network dropped, server restart window, 5xx) should be
// retried patiently with backoff so the console degrades gracefully instead of
// flashing "service temporarily unavailable" on every hiccup. Auth failures
// (401/403) are terminal and never retried.
function shouldRetry(count: number, error: unknown): boolean {
  const status = (error as { status?: number })?.status
  if (status === 401 || status === 403) return false
  if (status !== undefined && status >= 400 && status < 500) return false
  return count < 4
}

function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 15_000)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
      retryDelay,
    },
  },
})
