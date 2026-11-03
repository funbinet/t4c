import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center text-center">
      <div>
        <div className="text-6xl font-black tracking-tighter text-gradient">404</div>
        <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The legacy EASM and Dashboard paths have been retired. Use the new attack surface navigation.
        </p>
        <Button asChild className="mt-5">
          <Link to="/">Back to overview</Link>
        </Button>
      </div>
    </div>
  )
}
