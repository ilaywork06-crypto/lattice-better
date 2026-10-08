import { KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as E from '@/api/endpoints'
import { useAction, useUsers } from '@/api/queries'
import type { User, UserRole } from '@/api/types'
import { RoleBadge } from '@/components/domain/badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { Segmented, Switch } from '@/components/ui/controls'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Avatar, PageHeader, Skeleton } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { ROLES } from '@/lib/domain'
import { timeAgo } from '@/lib/format'
import { useSession } from '@/lib/session'

function UserDialog({ user, open, onOpenChange }: { user: User | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const { user: me } = useSession()
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'viewer' as UserRole, is_active: true, hint: false, hintPassword: '' })
  useEffect(() => {
    if (open) setForm({ email: user?.email ?? '', full_name: user?.full_name ?? '', password: '', role: user?.role ?? 'viewer', is_active: user?.is_active ?? true, hint: user?.login_hint_visible ?? false, hintPassword: '' })
    // Not on every refetch of the same user, which would wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id])
  const self = user?.id === me?.id
  const save = useAction(() => user
    ? E.users.update(user.id, {
      full_name: form.full_name, role: self ? undefined : form.role, is_active: self ? undefined : form.is_active,
      password: form.password || undefined, login_hint_visible: form.hint,
      ...(form.hintPassword ? { login_hint_password: form.hintPassword } : {}),
    })
    : E.users.create({ email: form.email, full_name: form.full_name, password: form.password, role: form.role }), {
    success: user ? t('users.saved') : t('users.created'), onSuccess: () => onOpenChange(false),
  })
  const clearHint = useAction(() => E.users.update(user!.id, { login_hint_password: '' }), { success: t('users.hintCleared') })
  const valid = form.full_name.trim() && (user || (form.email && form.password.length >= 6))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" icon={user ? <Pencil /> : <UserPlus />} title={user ? user.full_name : t('users.new')} description={user?.email}
        footer={<>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!valid} loading={save.isPending} onClick={() => save.mutate(undefined)}>{t('common.save')}</Button>
        </>}>
        <div className="flex flex-col gap-4">
          {!user && <Field label={t('login.email')} required><Input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>}
          <Field label={t('users.fullName')} required><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label={user ? t('users.newPassword') : t('login.password')} required={!user} hint={user ? t('users.passwordHint') : t('users.passwordMin')}>
            <Input type="password" dir="ltr" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label={t('users.role')} hint={self ? t('users.ownRole') : t(`users.roleHints.${form.role}`)}>
            <Segmented value={form.role} disabled={self} onChange={(r) => setForm({ ...form, role: r })} options={ROLES.map((r) => ({ value: r, label: t(`enums.role.${r}`) }))} />
          </Field>
          {user && !self && (
            <label className="flex items-center gap-2.5 text-sm"><Switch checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} /> {t('users.active')}
              <span className="text-xs text-muted-foreground">— {t('users.activeHint')}</span></label>
          )}
          {user && (
            <div className="rounded-xl border border-warning/40 bg-warning-soft/40 p-3.5">
              <label className="flex items-center gap-2.5 text-sm font-medium"><Switch checked={form.hint} onChange={(v) => setForm({ ...form, hint: v })} /> <KeyRound className="size-4" /> {t('users.hint')}</label>
              <p className="mt-2 text-xs text-muted-foreground">{t('users.hintWarning')}</p>
              {form.hint && (
                <div className="mt-3 flex items-end gap-2">
                  <Field label={t('users.hintPassword')} className="flex-1" hint={user.login_hint_has_password ? t('users.hintPasswordSet') : t('users.hintPasswordNone')}>
                    <Input type="password" dir="ltr" value={form.hintPassword} onChange={(e) => setForm({ ...form, hintPassword: e.target.value })} />
                  </Field>
                  {user.login_hint_has_password && <Button variant="ghost" className="mb-5" onClick={() => clearHint.mutate(undefined)}>{t('users.stopPublishing')}</Button>}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function UsersPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const { user: me } = useSession()
  const users = useUsers()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const remove = useAction((id: number) => E.users.remove(id), { success: t('users.deleted') })
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (users.data ?? []).filter((u) => !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [users.data, search])
  const count = (r: UserRole) => (users.data ?? []).filter((u) => u.role === r && u.is_active).length

  return (
    <div>
      <PageHeader title={t('nav.users')} description={t('users.description')}
        actions={<Button variant="primary" onClick={() => { setEditing(null); setOpen(true) }}><Plus /> {t('users.new')}</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('users.search')} />
        </div>
        <div className="ms-auto flex gap-2 text-xs text-muted-foreground">
          {ROLES.map((r) => <span key={r} className="inline-flex items-center gap-1.5"><RoleBadge role={r} /> {count(r)}</span>)}
        </div>
      </div>
      <Card className="overflow-hidden">
        {users.isPending ? <Skeleton className="m-5 h-40" /> : (
          <Table>
            <THead><TR><TH>{t('users.user')}</TH><TH>{t('users.role')}</TH><TH>{t('users.status')}</TH><TH>{t('users.joined')}</TH><TH /></TR></THead>
            <TBody>
              {rows.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.full_name} size={32} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium">{u.full_name}{u.id === me?.id && <Badge tone="primary">{t('users.you')}</Badge>}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">{u.email}</div>
                      </div>
                    </div>
                  </TD>
                  <TD><RoleBadge role={u.role} /></TD>
                  <TD>
                    <div className="flex flex-wrap gap-1.5">
                      {u.is_active ? <Badge tone="success" dot>{t('users.active')}</Badge> : <Badge dot>{t('users.inactive')}</Badge>}
                      {u.login_hint_visible && <Badge tone="warning"><ShieldCheck /> {t('users.onLogin')}</Badge>}
                    </div>
                  </TD>
                  <TD className="text-xs text-muted-foreground">{timeAgo(u.created_at)}</TD>
                  <TD className="text-end">
                    <Button size="icon-sm" variant="ghost" onClick={() => { setEditing(u); setOpen(true) }}><Pencil /></Button>
                    {u.id !== me?.id && (
                      <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-danger"
                        onClick={async () => { if (await confirm({ title: t('users.deleteTitle', { name: u.full_name }), description: t('users.deleteHint'), danger: true, confirmLabel: t('common.delete') })) remove.mutate(u.id) }}>
                        <Trash2 />
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <UserDialog user={users.data?.find((u) => u.id === editing?.id) ?? editing} open={open} onOpenChange={setOpen} />
    </div>
  )
}
