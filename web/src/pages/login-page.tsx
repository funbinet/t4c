import { zodResolver } from '@hookform/resolvers/zod'
import { LogIn } from 'lucide-react'
import { useEffect, type MouseEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '@/app/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { safeNext } from '@/lib/access'
import t4cLogo from '@/assets/t4c.png'

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { user, login } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: 'admin', password: '' },
  })

  useEffect(() => {
    if (user) navigate(safeNext(params.get('next')), { replace: true })
  }, [user, navigate, params])

  async function submit(values: FormValues) {
    try {
      const nextUser = await login(values.username, values.password)
      navigate(nextUser.mustChangePassword ? '/change-password' : safeNext(params.get('next')), { replace: true })
    } catch (error) {
      form.setError('root', { message: error instanceof Error ? error.message : 'Sign-in failed' })
    }
  }

  // The brand mark is a home affordance: signed-in users go to the Overview,
  // signed-out users get a clean reload of the login screen.
  function goHome(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    if (user) navigate('/')
    else window.location.assign('/login')
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        backgroundImage:
          'radial-gradient(120% 90% at 50% 0%, rgba(45,123,73,0.32), transparent 60%), linear-gradient(180deg, #0c1f13 0%, #090a08 55%)',
      }}
    >
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-10">
        <a
          href={user ? '/' : '/login'}
          onClick={goHome}
          aria-label="T4C home"
          className="flex flex-col items-center gap-4 text-center"
        >
          <img src={t4cLogo} alt="T4C logo" className="size-14 shrink-0 object-contain" />
          <div className="text-3xl font-semibold tracking-[0.35em] text-foreground">T4C</div>
        </a>

        <section className="mt-8 w-full border p-8 sm:p-10">
          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            <div className="space-y-1.5">
              <Label htmlFor="username" className="sr-only">
                Username
              </Label>
              <Input id="username" placeholder="Username" autoComplete="username" {...form.register('username')} />
              {form.formState.errors.username ? (
                <p className="text-[11px] text-destructive">{form.formState.errors.username.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="sr-only">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                {...form.register('password')}
              />
              {form.formState.errors.password ? (
                <p className="text-[11px] text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
            {form.formState.errors.root ? (
              <div className="border border-ring px-3 py-2 text-xs text-foreground">
                {form.formState.errors.root.message}
              </div>
            ) : null}
            <Button
              className="w-full"
              size="icon"
              type="submit"
              disabled={form.formState.isSubmitting}
              title="Sign In"
              aria-label="Sign In"
            >
              <LogIn />
              <span className="sr-only">Sign In</span>
            </Button>
          </form>
        </section>
      </main>
    </div>
  )
}
