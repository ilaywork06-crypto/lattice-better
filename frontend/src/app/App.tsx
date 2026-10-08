import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Direction } from 'radix-ui'
import { Fragment, lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { Toaster } from 'sonner'
import { ApiError } from '@/api/client'
import type { Permission } from '@/api/types'
import { ConfirmProvider } from '@/components/ui/confirm'
import { Spinner } from '@/components/ui/misc'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PreferencesProvider, usePreferences } from '@/lib/preferences'
import { SessionProvider, useSession } from '@/lib/session'
import { AppShell } from './AppShell'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
})

const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const ItemsPage = lazy(() => import('@/features/items/ItemsPage'))
const ItemPage = lazy(() => import('@/features/items/ItemPage'))
const TemplatesPage = lazy(() => import('@/features/templates/TemplatesPage'))
const TemplatePage = lazy(() => import('@/features/templates/TemplatePage'))
const TemplateEditorPage = lazy(() => import('@/features/templates/TemplateEditorPage'))
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage'))
const HierarchyPage = lazy(() => import('@/features/hierarchy/HierarchyPage'))
const LocationsPage = lazy(() => import('@/features/locations/LocationsPage'))
const ChangeRequestsPage = lazy(() => import('@/features/workflow/ChangeRequestsPage'))
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'))
const AuditPage = lazy(() => import('@/features/audit/AuditPage'))
const DataPage = lazy(() => import('@/features/data/DataPage'))
const CatalogPage = lazy(() => import('@/features/admin/CatalogPage'))
const UsersPage = lazy(() => import('@/features/admin/UsersPage'))
const NotFoundPage = lazy(() => import('@/features/NotFoundPage'))

function PageFallback() {
  return (
    <div className="grid h-[60vh] place-items-center">
      <Spinner />
    </div>
  )
}

/** Remounts its page when the route's :id changes, so no state leaks between records. */
function ByParam({ children }: { children: ReactNode }) {
  const { id } = useParams()
  return <Fragment key={id ?? 'new'}>{children}</Fragment>
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useSession()
  const location = useLocation()
  if (loading) return <PageFallback />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useSession()
  return can(permission) ? <>{children}</> : <Navigate to="/" replace />
}

function Themed({ children }: { children: ReactNode }) {
  const { isDark, dir } = usePreferences()
  return (
    <Direction.Provider dir={dir}>
      <TooltipProvider delayDuration={300}>
        <ConfirmProvider>
          {children}
          <Toaster position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'} theme={isDark ? 'dark' : 'light'} richColors closeButton dir={dir} />
        </ConfirmProvider>
      </TooltipProvider>
    </Direction.Provider>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <SessionProvider>
          <Themed>
            <BrowserRouter>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                    <Route index element={<DashboardPage />} />
                    <Route path="cards" element={<ItemsPage key="card" type="card" />} />
                    <Route path="assemblies" element={<ItemsPage key="assembly" type="assembly" />} />
                    <Route path="setups" element={<ItemsPage key="setup" type="setup" />} />
                    <Route path="items/:id" element={<ItemPage />} />
                    <Route path="templates" element={<TemplatesPage />} />
                    <Route path="templates/new" element={<ByParam key="create"><TemplateEditorPage mode="create" /></ByParam>} />
                    <Route path="templates/:id" element={<ByParam><TemplatePage /></ByParam>} />
                    <Route path="templates/:id/edit" element={<ByParam key="edit"><TemplateEditorPage mode="edit" /></ByParam>} />
                    <Route path="templates/:id/duplicate" element={<ByParam key="duplicate"><TemplateEditorPage mode="duplicate" /></ByParam>} />
                    <Route path="inventory" element={<InventoryPage />} />
                    <Route path="hierarchy" element={<HierarchyPage />} />
                    <Route path="locations" element={<LocationsPage />} />
                    <Route path="change-requests" element={<ChangeRequestsPage />} />
                    <Route path="change-requests/:id" element={<ChangeRequestsPage />} />
                    <Route path="notifications" element={<NotificationsPage />} />
                    <Route path="audit" element={<AuditPage />} />
                    <Route path="data" element={<DataPage />} />
                    <Route path="admin/catalog" element={<RequirePermission permission="manage_catalog"><CatalogPage /></RequirePermission>} />
                    <Route path="admin/users" element={<RequirePermission permission="manage_users"><UsersPage /></RequirePermission>} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </Themed>
        </SessionProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  )
}
