import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Boxes, GitPullRequestArrow, Languages, Network, Warehouse } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { ApiError } from '@/api/client'
import * as E from '@/api/endpoints'
import { RoleBadge } from '@/components/domain/badges'
import { Logo } from '@/components/domain/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Avatar } from '@/components/ui/misc'
import { usePreferences } from '@/lib/preferences'
import { useSession } from '@/lib/session'

export default function LoginPage() {
  const { t } = useTranslation()
  const { user, signIn } = useSession()
  const { language, setLanguage } = usePreferences()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const hints = useQuery({ queryKey: ['login-hints'], queryFn: E.auth.loginHints, retry: false })

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (user) return <Navigate to={from} replace />

  const submit = async (e?: FormEvent, creds?: { email: string; password: string }) => {
    e?.preventDefault()
    const c = creds ?? { email, password }
    setBusy(true)
    setError(null)
    try {
      await signIn(c.email, c.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  const features = [
    { icon: Network, title: t('login.f1'), text: t('login.f1Text') },
    { icon: Warehouse, title: t('login.f2'), text: t('login.f2Text') },
    { icon: GitPullRequestArrow, title: t('login.f3'), text: t('login.f3Text') },
  ]

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* brand panel */}
      <div className="relative hidden overflow-hidden bg-[oklch(0.2_0.05_275)] p-12 text-white lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse at 30% 40%, black, transparent 75%)',
          }}
        />
        <div className="pointer-events-none absolute -end-40 -top-40 size-[520px] rounded-full bg-[var(--primary)] opacity-40 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-48 -start-24 size-[420px] rounded-full bg-[oklch(0.6_0.15_200)] opacity-25 blur-[120px]" />
        <div className="relative flex items-center gap-3">
          <Logo size={36} />
          <span className="text-xl font-semibold tracking-tight">Lattice</span>
        </div>
        <div className="relative mt-auto max-w-lg">
          <h1 className="text-[40px] font-semibold leading-[1.1] tracking-tight">{t('login.headline')}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">{t('login.subhead')}</p>
          <div className="mt-10 grid gap-5">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <f.icon className="size-5" />
                </div>
                <div>
                  <div className="font-medium">{f.title}</div>
                  <div className="text-sm text-white/60">{f.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-12 flex items-center gap-2 text-xs text-white/40">
          <Boxes className="size-3.5" /> {t('login.footer')}
        </div>
      </div>

      {/* form */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <Logo size={30} />
            <span className="font-semibold">Lattice</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLanguage(language === 'he' ? 'en' : 'he')}>
            <Languages /> {language === 'he' ? 'English' : 'עברית'}
          </Button>
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h2 className="text-2xl font-semibold tracking-tight">{t('login.title')}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('login.subtitle')}</p>
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <Field label={t('login.email')} htmlFor="email">
              <Input id="email" type="email" autoComplete="username" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="h-10" dir="ltr" />
            </Field>
            <Field label={t('login.password')} htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} className="h-10" dir="ltr" />
            </Field>
            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>
            )}
            <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-2">
              {t('login.submit')} <ArrowRight className="rtl:rotate-180" />
            </Button>
          </form>

          {hints.data && hints.data.length > 0 && (
            <div className="mt-10">
              <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                {t('login.quick')}
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid gap-2">
                {hints.data.map((h) => (
                  <button
                    key={h.email}
                    type="button"
                    onClick={() => {
                      setEmail(h.email)
                      if (h.password) {
                        setPassword(h.password)
                        void submit(undefined, { email: h.email, password: h.password })
                      } else {
                        setPassword('')
                        document.getElementById('password')?.focus()
                      }
                    }}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-start shadow-soft transition-all hover:-translate-y-px hover:border-input hover:shadow-pop"
                  >
                    <Avatar name={h.full_name} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{h.full_name}</div>
                      <div className="truncate text-xs text-muted-foreground" dir="ltr">{h.email}</div>
                    </div>
                    <RoleBadge role={h.role} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
