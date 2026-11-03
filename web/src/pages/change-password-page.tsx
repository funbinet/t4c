import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAuth } from '@/app/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z
  .object({
    oldPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Re-enter the new password'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The new passwords do not match',
  })
type Values = z.infer<typeof schema>

export function ChangePasswordPage() {
  const { user, changePassword } = useAuth()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  })

  async function submit(values: Values) {
    try {
      await changePassword(values.oldPassword, values.newPassword)
      window.location.assign('/login')
    } catch (error) {
      form.setError('root', { message: error instanceof Error ? error.message : 'Failed to change password' })
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-5">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Change Sign-In Password</CardTitle>
          <CardDescription>
            {user?.mustChangePassword
              ? 'Sign-in is required again after the change.'
              : 'All sessions are invalidated after the change.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            <div className="space-y-1.5">
              <Label htmlFor="oldPassword">Current password</Label>
              <Input
                id="oldPassword"
                type="password"
                autoComplete="current-password"
                {...form.register('oldPassword')}
              />
              {form.formState.errors.oldPassword ? (
                <p className="text-[11px] text-destructive">{form.formState.errors.oldPassword.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" type="password" autoComplete="new-password" {...form.register('newPassword')} />
              {form.formState.errors.newPassword ? (
                <p className="text-[11px] text-destructive">{form.formState.errors.newPassword.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...form.register('confirmPassword')}
              />
              {form.formState.errors.confirmPassword ? (
                <p className="text-[11px] text-destructive">{form.formState.errors.confirmPassword.message}</p>
              ) : null}
            </div>
            {form.formState.errors.root ? (
              <div className="rounded-[4px] border border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.06)] px-3 py-2 text-xs text-destructive">
                {form.formState.errors.root.message}
              </div>
            ) : null}
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving…' : 'Change password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
