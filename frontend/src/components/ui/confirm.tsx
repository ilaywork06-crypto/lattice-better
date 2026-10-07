import { AlertTriangle } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './button'
import { Dialog, DialogContent } from './dialog'

interface ConfirmOptions {
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(async () => false)

/** ``const confirm = useConfirm(); if (await confirm({...})) …`` */
export function useConfirm() {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(v: boolean) => void>(() => {})

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (result: boolean) => {
    resolver.current(result)
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!options} onOpenChange={(o) => !o && close(false)}>
        {options && (
          <DialogContent
            size="sm"
            title={options.title}
            description={options.description}
            icon={options.danger ? <AlertTriangle /> : undefined}
            footer={
              <>
                <Button variant="ghost" onClick={() => close(false)}>
                  {t('common.cancel')}
                </Button>
                <Button variant={options.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
                  {options.confirmLabel ?? t('common.confirm')}
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </ConfirmContext.Provider>
  )
}
