import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AdminRoute, ProtectedRoute } from './auth'
import { ModeProvider } from './mode'
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

// Dedicated three-stage chain screens. Exploit and objectives use these
// instead of the recon pages: all data is pulled from /{stage}/* endpoints and
// the screens expose stage-only capabilities (shell console, produce, export).
const ChainOverviewPage = lazy(() =>
  import('@/pages/chain/chain-overview-page').then((module) => ({ default: module.ChainOverviewPage })),
)
const ChainOrganizationsPage = lazy(() =>
  import('@/pages/chain/chain-organizations-page').then((module) => ({ default: module.ChainOrganizationsPage })),
)
const ChainAssetsPage = lazy(() =>
  import('@/pages/chain/chain-assets-page').then((module) => ({ default: module.ChainAssetsPage })),
)
const ChainFindingsPage = lazy(() =>
  import('@/pages/chain/chain-findings-page').then((module) => ({ default: module.ChainFindingsPage })),
)
const ChainTasksPage = lazy(() =>
  import('@/pages/chain/chain-tasks-page').then((module) => ({ default: module.ChainTasksPage })),
)
const ChainMonitorsPage = lazy(() =>
  import('@/pages/chain/chain-automation-page').then((module) => ({ default: module.ChainMonitorsPage })),
)
const ChainSchedulesPage = lazy(() =>
  import('@/pages/chain/chain-automation-page').then((module) => ({ default: module.ChainSchedulesPage })),
)
const ChainPoliciesPage = lazy(() =>
  import('@/pages/chain/chain-automation-page').then((module) => ({ default: module.ChainPoliciesPage })),
)
const ChainGroupsPage = lazy(() =>
  import('@/pages/chain/chain-automation-page').then((module) => ({ default: module.ChainGroupsPage })),
)

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
        <ModeProvider>
          <AppShell />
        </ModeProvider>
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
      // Exploit stage: dedicated chain screens backed by /exploit/* and
      // /{stage}/* APIs. Org and task detail reuse the stage-aware recon pages.
      { path: 'exploit', ...screen(<ChainOverviewPage />) },
      { path: 'exploit/organizations', ...screen(<ChainOrganizationsPage />) },
      { path: 'exploit/organizations/:id', ...screen(<OrganizationDetailPage />) },
      { path: 'exploit/assets', ...screen(<ChainAssetsPage />) },
      { path: 'exploit/findings', ...screen(<ChainFindingsPage />) },
      { path: 'exploit/tasks', ...screen(<ChainTasksPage />) },
      { path: 'exploit/tasks/:id', ...screen(<TaskDetailPage />) },
      { path: 'exploit/automation/monitors', ...screen(<ChainMonitorsPage />) },
      { path: 'exploit/automation/schedules', ...screen(<ChainSchedulesPage />) },
      { path: 'exploit/automation/policies', ...screen(<ChainPoliciesPage />) },
      { path: 'exploit/automation/groups', ...screen(<ChainGroupsPage />) },
      // Objectives stage: the "Produce" surface. The Assets screen becomes the
      // produce view with objectives, artifacts, shell console and export drawer.
      { path: 'objectives', ...screen(<ChainOverviewPage />) },
      { path: 'objectives/organizations', ...screen(<ChainOrganizationsPage />) },
      { path: 'objectives/organizations/:id', ...screen(<OrganizationDetailPage />) },
      { path: 'objectives/assets', ...screen(<ChainAssetsPage />) },
      { path: 'objectives/findings', ...screen(<ChainFindingsPage />) },
      { path: 'objectives/tasks', ...screen(<ChainTasksPage />) },
      { path: 'objectives/tasks/:id', ...screen(<TaskDetailPage />) },
      { path: 'objectives/automation/monitors', ...screen(<ChainMonitorsPage />) },
      { path: 'objectives/automation/schedules', ...screen(<ChainSchedulesPage />) },
      { path: 'objectives/automation/policies', ...screen(<ChainPoliciesPage />) },
      { path: 'objectives/automation/groups', ...screen(<ChainGroupsPage />) },
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
