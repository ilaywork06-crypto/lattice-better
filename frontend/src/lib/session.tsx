import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { onUnauthorized, tokenStore } from '@/api/client'
import * as endpoints from '@/api/endpoints'
import type { ChangeAction, Me, Permission } from '@/api/types'

interface Session {
  user: Me | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<Me>
  signOut: () => void
  /** Whether the signed-in user holds a permission. */
  can: (permission: Permission) => boolean
  /** Whether they may *propose* this change (approval workflow). */
  canPropose: (action: ChangeAction) => boolean
}

const Ctx = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const hasToken = !!tokenStore.get()
  const me = useQuery({
    queryKey: ['me'],
    queryFn: endpoints.auth.me,
    enabled: hasToken,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const signOut = useCallback(() => {
    tokenStore.set(null)
    qc.clear()
    qc.setQueryData(['me'], null)
  }, [qc])

  useEffect(() => onUnauthorized(signOut), [signOut])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const out = await endpoints.auth.signIn(email, password)
      tokenStore.set(out.access_token)
      qc.setQueryData(['me'], out.user)
      return out.user
    },
    [qc],
  )

  const user = (hasToken ? me.data : null) ?? null
  const value = useMemo<Session>(
    () => ({
      user,
      loading: hasToken && me.isPending,
      signIn,
      signOut,
      can: (p) => !!user?.permissions.includes(p),
      canPropose: (a) => !!user?.proposable_actions.includes(a),
    }),
    [user, hasToken, me.isPending, signIn, signOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSession outside SessionProvider')
  return ctx
}
