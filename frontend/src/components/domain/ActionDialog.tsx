import { GitPullRequestArrow, Info } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ApiError, type Issue } from '@/api/client'
import * as E from '@/api/endpoints'
import { useRefreshAll } from '@/api/queries'
import type { ChangeAction, Permission } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useSession } from '@/lib/session'

export type WorkflowMode = 'direct' | 'propose' | 'none'

/** Whether the user applies this change directly, proposes it, or can't. */
export function useWorkflowMode(permission: Permission, action: ChangeAction): WorkflowMode {
  const { can, canPropose } = useSession()
  if (can(permission)) return 'direct'
  if (canPropose(action)) return 'propose'
  return 'none'
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Who may apply it directly; everyone else proposes it. */
  permission: Permission
  action: ChangeAction
  itemId?: number
  templateId?: number
  /** The change, as the API's command (also a proposal's payload). */
  payload: () => Record<string, unknown> | null
  /** Apply it directly. */
  apply: () => Promise<unknown>
  submitLabel: string
  successMessage?: string
  /** A reason already typed in the form (a move note…) pre-fills the proposal's. */
  reasonDefault?: string
  disabled?: boolean
  danger?: boolean
  onDone?: (result: unknown) => void
  onIssues?: (issues: Issue[]) => void
  children?: ReactNode
}

export function ActionDialog(props: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const refresh = useRefreshAll()
  const mode = useWorkflowMode(props.permission, props.action)
  const [reason, setReason] = useState('')
  const [reasonTouched, setReasonTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (props.open) {
      setReason('')
      setReasonTouched(false)
    }
  }, [props.open])
  useEffect(() => {
    if (!reasonTouched) setReason(props.reasonDefault ?? '')
  }, [props.reasonDefault, reasonTouched])

  const run = async () => {
    const payload = props.payload()
    if (payload === null) return
    setBusy(true)
    try {
      if (mode === 'direct') {
        const result = await props.apply()
        await refresh()
        if (props.successMessage) toast.success(props.successMessage)
        props.onOpenChange(false)
        props.onDone?.(result)
      } else {
        const cr = await E.changeRequests.submit({
          action: props.action,
          item_id: props.itemId ?? null,
          template_id: props.templateId ?? null,
          payload,
          reason: reason.trim(),
        })
        await refresh()
        toast.success(t('workflow.submitted'), {
          description: cr.description,
          action: { label: t('common.view'), onClick: () => navigate(`/change-requests/${cr.id}`) },
        })
        props.onOpenChange(false)
        props.onDone?.(cr)
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.issues.length && props.onIssues) props.onIssues(e.issues)
        else toast.error(e.message)
      } else {
        toast.error(t('errors.generic'))
      }
    } finally {
      setBusy(false)
    }
  }

  const proposing = mode === 'propose'
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        size={props.size}
        title={props.title}
        description={props.description}
        icon={proposing ? <GitPullRequestArrow /> : props.icon}
        footer={
          mode === 'none' ? (
            <Button variant="ghost" onClick={() => props.onOpenChange(false)}>{t('common.close')}</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => props.onOpenChange(false)}>{t('common.cancel')}</Button>
              <Button
                variant={props.danger && !proposing ? 'danger' : 'primary'}
                loading={busy}
                disabled={props.disabled || (proposing && !reason.trim())}
                onClick={() => void run()}
              >
                {proposing ? t('workflow.submitForApproval') : props.submitLabel}
              </Button>
            </>
          )
        }
      >
        <div className="flex flex-col gap-4">
          {props.children}
          {proposing && (
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary-soft/40 p-3.5">
              <div className="mb-2.5 flex items-start gap-2 text-[13px] text-primary-soft-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>{t('workflow.proposeHint')}</span>
              </div>
              <Field label={t('workflow.reason')} required>
                <Textarea
                  value={reason}
                  onChange={(e) => {
                    setReasonTouched(true)
                    setReason(e.target.value)
                  }}
                  placeholder={t('workflow.reasonPlaceholder')}
                  className="min-h-16 bg-card"
                />
              </Field>
            </div>
          )}
          {mode === 'none' && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{t('workflow.notAllowed')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
