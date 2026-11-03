import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@radix-ui/react-alert-dialog'
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
          <AlertDialogTitle className="text-base font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-xs leading-5 text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <AlertDialogCancel className={buttonVariants({ variant: 'outline', size: 'sm' })}>Cancel</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: 'destructive', size: 'sm' })} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
