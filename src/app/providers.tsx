import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthListener } from './AuthListener'
import { SessionGuard } from './SessionGuard'
import { LangSync } from './LangSync'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthListener />
      <SessionGuard />
      <LangSync />
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )
}
