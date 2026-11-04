import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AdminRoute, ProtectedRoute } from './auth'
import { AppShell } from '@/components/layout/app-shell'
import { AppBackground } from '@/components/layout/app-background'
import { RouteError } from '@/components/common/route-error'
import { LoadingBlock } from '@/components/common/states'

const LoginPage = lazy(() => import('@/pages/login-page').then((module) => ({ default: module.LoginPage })))
const ChangePasswordPage = lazy(() =>
  import('@/pages/change-password-page').then((module) => ({ default: module.ChangePasswordPage })),
)
const OverviewPage = lazy(() => import('@/pages/overview-page').then((module) => ({ default: module.OverviewPage })))
const OrganizationsPage = lazy(() =>
  import('@/pages/organizations-page').then((module) => ({ default: module.OrganizationsPage })),
)
const OrganizationDetailPage = lazy(() =>
  import('@/pages/organization-detail-page').then((module) => ({ default: module.OrganizationDetailPage })),
)
const AssetsPage = lazy(() => import('@/pages/assets-page').then((module) => ({ default: module.AssetsPage })))
const FindingsPage = lazy(() => import('@/pages/findings-page').then((module) => ({ default: module.FindingsPage })))
const TasksPage = lazy(() => import('@/pages/tasks-page').then((module) => ({ default: module.TasksPage })))
const TaskDetailPage = lazy(() =>
  import('@/pages/task-detail-page').then((module) => ({ default: module.TaskDetailPage })),
)
const MonitorsPage = lazy(() => import('@/pages/monitors-page').then((module) => ({ default: module.MonitorsPage })))
const SchedulesPage = lazy(() => import('@/pages/schedules-page').then((module) => ({ default: module.SchedulesPage })))
const PoliciesPage = lazy(() => import('@/pages/policies-page').then((module) => ({ default: module.PoliciesPage })))
const ScopesPage = lazy(() => import('@/pages/scopes-page').then((module) => ({ default: module.ScopesPage })))
const GitHubPage = lazy(() => import('@/pages/github-page').then((module) => ({ default: module.GitHubPage })))
const FingerprintsPage = lazy(() =>
  import('@/pages/fingerprints-page').then((module) => ({ default: module.FingerprintsPage })),
)
const PocPage = lazy(() => import('@/pages/poc-page').then((module) => ({ default: module.PocPage })))
const UsersPage = lazy(() => import('@/pages/users-page').then((module) => ({ default: module.UsersPage })))
const APIKeysPage = lazy(() => import('@/pages/api-keys-page').then((module) => ({ default: module.APIKeysPage })))
const AuditPage = lazy(() => import('@/pages/audit-page').then((module) => ({ default: module.AuditPage })))
const RecycleBinPage = lazy(() =>
  import('@/pages/recycle-bin-page').then((module) => ({ default: module.RecycleBinPage })),
)
const SystemPage = lazy(() => import('@/pages/system-page').then((module) => ({ default: module.SystemPage })))
const NotFoundPage = lazy(() => import('@/pages/not-found-page').then((module) => ({ default: module.NotFoundPage })))

function page(element: ReactNode) {
  return <Suspense fallback={<LoadingBlock />}>{element}</Suspense>
}

// Every route gets its own boundary so a crashing screen never takes down the
// whole console with react-router's default error page.
function screen(element: ReactNode) {
  return { element: page(element), errorElement: <RouteError /> }
}

const router = createBrowserRouter([
  { path: '/login', ...screen(<LoginPage />) },
  { path: '/change-password', errorElement: <RouteError />, element: <ProtectedRoute>{page(<ChangePasswordPage />)}</ProtectedRoute> },
  {
    path: '/',
    errorElement: <RouteError />,
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, ...screen(<OverviewPage />) },
      { path: 'organizations', ...screen(<OrganizationsPage />) },
      { path: 'organizations/:id', ...screen(<OrganizationDetailPage />) },
      { path: 'assets', ...screen(<AssetsPage />) },
      { path: 'findings', ...screen(<FindingsPage />) },
      { path: 'tasks', ...screen(<TasksPage />) },
      { path: 'tasks/:id', ...screen(<TaskDetailPage />) },
      { path: 'automation/monitors', ...screen(<MonitorsPage />) },
      { path: 'automation/schedules', ...screen(<SchedulesPage />) },
      { path: 'automation/policies', ...screen(<PoliciesPage />) },
      { path: 'automation/groups', ...screen(<ScopesPage />) },
      { path: 'intelligence/github', ...screen(<GitHubPage />) },
      { path: 'intelligence/fingerprints', ...screen(<FingerprintsPage />) },
      { path: 'intelligence/poc', ...screen(<PocPage />) },
      { path: 'admin/users', errorElement: <RouteError />, element: <AdminRoute>{page(<UsersPage />)}</AdminRoute> },
      { path: 'admin/api-keys', errorElement: <RouteError />, element: <AdminRoute>{page(<APIKeysPage />)}</AdminRoute> },
      { path: 'admin/audit', errorElement: <RouteError />, element: <AdminRoute>{page(<AuditPage />)}</AdminRoute> },
      { path: 'admin/recycle-bin', errorElement: <RouteError />, element: <AdminRoute>{page(<RecycleBinPage />)}</AdminRoute> },
      { path: 'admin/system', errorElement: <RouteError />, element: <AdminRoute>{page(<SystemPage />)}</AdminRoute> },
      { path: '*', ...screen(<NotFoundPage />) },
    ],
  },
])

export function AppRouter() {
  return (
    <>
      <AppBackground />
      <RouterProvider router={router} />
    </>
  )
}
