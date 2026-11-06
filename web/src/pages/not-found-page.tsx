import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center text-center">
      <div>
        <div className="text-6xl font-black tracking-tighter">404</div>
        <h1 className="mt-3 text-lg font-semibold uppercase tracking-[0.06em]">Page Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The requested page does not exist.</p>
        <Button asChild size="icon" className="mt-5" title="Overview" aria-label="Overview">
          <Link to="/">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Overview</span>
          </Link>
        </Button>
      </div>
    </div>
  )
}
