import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '@/app/auth'
import { useGlowFollow } from '@/components/common/glow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ParticleField } from '@/components/visuals/particle-field'
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
  const glowRef = useGlowFollow<HTMLElement>()
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

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section
        ref={glowRef}
        className="glow-fx liquid-border relative hidden overflow-hidden p-12 text-ink lg:flex lg:flex-col lg:justify-between"
      >
        {/* hero backdrop + green data grid + particle field (back.md layer stack) */}
        <div className="absolute inset-0" style={{ background: 'var(--grad-hero)' }} />
        <div className="data-grid absolute inset-0 opacity-40" />
        <ParticleField className="absolute inset-0 size-full" />
        <div className="relative flex items-center gap-3">
          <img src={t4cLogo} alt="T4C logo" className="size-11 shrink-0 rounded-[4px] object-contain" />
          <div>
            <div className="text-lg font-semibold tracking-wide">T4C</div>
          </div>
        </div>
        <div className="relative max-w-xl">
          <div className="mono-label mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-[rgba(0,250,0,0.06)] px-3 py-1 !text-[11px]">
            <ShieldCheck className="size-3.5" />
            For authorized security testing only
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Start from the <span className="text-gradient">organization</span> and see every layer of external exposure.
          </h1>
          <div className="rule-dark mt-5 h-px w-24" />
          <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">
            Bring organizations, ICP root domains, assets, risks, and scan tasks into a single investigation path. The
            map and graph share selections, while evidence and actions stay traceable.
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-4 border-t border-border pt-5 text-[11px] text-dim">
          <span>
            <b className="mb-1 block text-base text-ink">Organizations</b> Ownership and domain governance
          </span>
          <span>
            <b className="mb-1 block text-base text-ink">Assets</b> DNS / IP / services
          </span>
          <span>
            <b className="mb-1 block text-base text-ink">Risks</b> Current findings and history
          </span>
        </div>
      </section>
      <section className="data-grid relative flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="glass w-full max-w-md rounded-[4px] p-8 sm:p-10">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <img src={t4cLogo} alt="T4C logo" className="size-10 shrink-0 rounded-[4px] object-contain" />
              <div>
                <div className="font-semibold">T4C</div>
              </div>
            </div>
          </div>
          <div className="mb-7">
            <div className="mono-label mb-2 !text-[11px] !text-mint">Console Sign-In</div>
            <h2 className="text-2xl font-semibold uppercase tracking-[0.06em]">Enter The Attack Surface Workspace</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You must change the initial password after your first sign-in.
            </p>
          </div>
          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" autoComplete="username" {...form.register('username')} />
              {form.formState.errors.username ? (
                <p className="text-[11px] text-destructive">{form.formState.errors.username.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
              {form.formState.errors.password ? (
                <p className="text-[11px] text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
            {form.formState.errors.root ? (
              <div className="rounded-[4px] border border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.06)] px-3 py-2 text-xs text-destructive">
                {form.formState.errors.root.message}
              </div>
            ) : null}
            <Button className="w-full" size="lg" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Signing In…' : 'Sign In'}
            </Button>
          </form>
          <p className="mt-6 text-center text-[11px] leading-5 text-dim">
            The initial administrator password is printed to the service log only once. Do not use this system against
            unauthorized targets.
          </p>
        </div>
      </section>
    </div>
  )
}
