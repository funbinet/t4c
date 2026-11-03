import { QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { Toaster } from 'sonner'
import type { ReactNode } from 'react'
import { AuthProvider } from './auth'
import { queryClient } from './query'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            closeButton
            toastOptions={{
              style: {
                background: 'rgba(10, 10, 10, 0.9)',
                border: '1px solid rgba(0, 250, 0, 0.2)',
                color: '#eaffea',
                backdropFilter: 'blur(10px)',
                borderRadius: '4px',
              },
            }}
          />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
