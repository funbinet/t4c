import { AlertTriangle, RotateCcw } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/button'

// Route-level boundary: any render error inside a screen shows this panel
// instead of react-router's raw "Unexpected Application Error" page.
export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Something went wrong while rendering this screen.'

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md rounded-[4px] border border-border bg-black/55 p-8 text-center backdrop-blur-md">
        <AlertTriangle className="mx-auto size-8 text-destructive" />
        <h1 className="mt-4 text-lg font-semibold uppercase tracking-[0.06em]">Screen error</h1>
        <p className="mt-2 break-words text-xs text-muted-foreground">{message}</p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <RotateCcw />
              Back to Overview
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    </div>
  )
}
