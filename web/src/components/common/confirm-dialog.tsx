import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@radix-ui/react-alert-dialog'
import { Trash2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
}: {
  trigger: ReactNode
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[4px] border border-border bg-card p-6 shadow-[0_0_40px_rgba(0,250,0,0.08)]">
        <div>
          <AlertDialogTitle className="text-sm font-semibold uppercase tracking-[0.06em]">{title}</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-xs leading-5 text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <AlertDialogCancel
            className={buttonVariants({ variant: 'outline', size: 'icon', className: 'size-8' })}
            title="Cancel"
          >
            <X />
            <span className="sr-only">Cancel</span>
          </AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: 'destructive', size: 'sm' })} onClick={onConfirm}>
            <Trash2 className="size-3.5" />
            {confirmLabel}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
