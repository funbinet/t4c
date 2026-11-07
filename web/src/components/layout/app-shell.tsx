import { useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  Boxes,
  Building2,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Command as CommandIcon,
  Crosshair,
  FileKey2,
  FileText,
  Filter,
  Fingerprint,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Radar,
  RotateCcw,
  RotateCw,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  UserRound,
  Users,
  Workflow,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/app/auth'
import { STAGE_META, stageBase, useMode, type Stage } from '@/app/mode'
import t4cLogo from '@/assets/t4c.png'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { isAdmin } from '@/lib/access'
import { roleLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CommandPalette } from './command-palette'
import { ModeToggle } from './mode-toggle'

type NavItem = { to: string; label: string; icon: typeof Activity; end?: boolean }
type NavGroup = { label: string; items: NavItem[] }

const ranges = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'ALL' },
]

// Mode-scoped navigation (plan §8.1): the first group is relabeled per stage,
// paths are prefixed with the stage base for exploit/objectives, and the
// Intelligence group is only exposed in recon mode. Administration stays
// always-on with unchanged paths.
function buildGroups(mode: Stage): NavGroup[] {
  const base = stageBase(mode)
  const primaryGroup: NavGroup = {
    label: mode === 'recon' ? 'Attack Surface' : STAGE_META[mode].label,
    items: [
      { to: base || '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: `${base}/organizations`, label: 'Organizations', icon: Building2 },
      { to: `${base}/assets`, label: 'Assets', icon: Crosshair },
      { to: `${base}/findings`, label: 'Risks', icon: ShieldCheck },
      { to: `${base}/tasks`, label: 'Tasks', icon: Workflow },
    ],
  }
  const automationGroup: NavGroup = {
    label: 'Automation',
    items: [
      { to: `${base}/automation/monitors`, label: 'Monitors', icon: Activity },
      { to: `${base}/automation/schedules`, label: 'Schedules', icon: CalendarClock },
      { to: `${base}/automation/policies`, label: 'Scan Policies', icon: Settings2 },
      { to: `${base}/automation/groups`, label: 'Asset Groups', icon: Boxes },
    ],
  }
  const groups: NavGroup[] = [primaryGroup, automationGroup]
  if (mode === 'recon') {
    groups.push({
      label: 'Intelligence',
      items: [
        { to: '/intelligence/github', label: 'GitHub', icon: GitBranch },
        { to: '/intelligence/fingerprints', label: 'Fingerprints', icon: Fingerprint },
        { to: '/intelligence/poc', label: 'PoC Plugins', icon: Radar },
      ],
    })
  }
  return groups
}

const adminGroup: NavGroup = {
  label: 'Administration',
  items: [
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/api-keys', label: 'API Key', icon: FileKey2 },
    { to: '/admin/audit', label: 'Audit Log', icon: ScrollText },
    { to: '/admin/recycle-bin', label: 'Recycle Bin', icon: RotateCcw },
    { to: '/admin/system', label: 'System', icon: FileText },
  ],
}

function NavContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { role } = useAuth()
  const { mode } = useMode()
  const groups = buildGroups(mode)
  const allGroups = isAdmin(role) ? [...groups, adminGroup] : groups
  return (
    <nav
      className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto py-4 scrollbar-thin', collapsed && 'justify-evenly')}
      aria-label="Main navigation"
    >
      {allGroups.map((group) => (
        <Fragment key={group.label}>
          <div className={collapsed ? 'contents' : 'flex w-full flex-col gap-1 px-3'}>
            {!collapsed ? <div className="mono-label px-3 pb-1 text-left">{group.label}</div> : null}
            <div className={collapsed ? 'contents' : 'flex w-full flex-col gap-1'}>
              {group.items.map((item) => {
                const Icon = item.icon
                const link = (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        // Shared hitbox: 36px tall, uniform radius, no outline. The
                        // bottom collapse button is the reference for hover/active.
                        'flex h-9 items-center border border-transparent text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground',
                        collapsed ? 'w-9 justify-center' : 'w-full gap-2.5 px-3 text-left',
                        isActive && 'border-ring text-foreground',
                      )
                    }
                  >
                    <Icon className="size-4 shrink-0" />
                    {!collapsed ? (
                      <span className="truncate">{item.label}</span>
                    ) : (
                      <span className="sr-only">{item.label}</span>
                    )}
                  </NavLink>
                )
                if (!collapsed) return link
                // Collapsed: wrap in a full-width centering row so the icon is
                // always perfectly centered, and let the nav distribute the rows
                // evenly across the full height.
                return (
                  <div key={item.to} className="flex w-full justify-center">
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
          </div>
        </Fragment>
      ))}
    </nav>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const { mode } = useMode()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const isOverview = location.pathname === '/'
  const rangeParam = params.get('range') || '30d'

  function setRangeParam(value: string) {
    const next = new URLSearchParams(params)
    next.set('range', value)
    setParams(next, { replace: true })
  }

  function refresh() {
    if (refreshing) return
    setRefreshing(true)
    void queryClient.invalidateQueries()
    window.setTimeout(() => setRefreshing(false), 1000)
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => setMobileOpen(false), [location.pathname])

  const title = useMemo(() => {
    const all = [...buildGroups(mode).flatMap((group) => group.items), ...adminGroup.items]
    const exact = all.find((item) => item.to === location.pathname)
    if (exact) return exact.label
    if (/^\/(exploit|objectives)?\/?organizations\//.test(location.pathname)) return 'Organization Details'
    if (/^\/(exploit|objectives)?\/?tasks\//.test(location.pathname)) return 'Task Details'
    return 'T4C Console'
  }, [location.pathname, mode])

  async function signOut() {
    await logout()
    window.location.assign('/login')
  }

  return (
    <div className="min-h-screen xl:h-dvh xl:min-h-0 xl:overflow-hidden">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-background lg:flex',
          collapsed ? 'w-[68px]' : 'w-[236px]',
        )}
      >
        <Link
          to="/"
          aria-label="T4C home"
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-border',
            collapsed ? 'justify-center' : 'justify-center gap-3 px-4',
          )}
        >
          <img src={t4cLogo} alt="T4C logo" className="size-9 shrink-0 object-contain" />
          {!collapsed ? (
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-wide text-ink">T4C</div>
            </div>
          ) : null}
        </Link>
        <NavContent collapsed={collapsed} />
        {/* Stage toggle lives at the bottom of the rail, right above the
            collapse control, so the three modes are one deliberate motion. */}
        <div className="flex justify-center border-t border-border p-2">
          <ModeToggle collapsed={collapsed} />
        </div>
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="icon"
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="mx-auto flex text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
            <span className="sr-only">{collapsed ? 'Expand navigation' : 'Collapse navigation'}</span>
          </Button>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-popover"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-border bg-popover text-ink">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Link
                to="/"
                aria-label="T4C home"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3"
              >
                <img src={t4cLogo} alt="T4C logo" className="size-9 shrink-0 object-contain" />
                <div>
                  <div className="font-semibold">T4C</div>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                <X />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <NavContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
            <div className="flex justify-center border-t border-border p-2">
              <ModeToggle collapsed={false} />
            </div>
          </aside>
        </div>
      ) : null}

      <div
        className={cn(
          'min-h-screen xl:flex xl:h-dvh xl:min-h-0 xl:flex-col xl:overflow-hidden',
          collapsed ? 'lg:pl-[68px]' : 'lg:pl-[236px]',
        )}
      >
        <header className="sticky top-0 z-20 grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu />
              <span className="sr-only">Open navigation</span>
            </Button>
          </div>
          <div className="min-w-0 truncate text-center text-sm font-semibold uppercase tracking-[0.06em]">{title}</div>
          <div className="flex items-center gap-1.5 justify-self-end">
            <Button
              variant="ghost"
              size="icon"
              title="Refresh"
              aria-label="Refresh"
              className="text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={refresh}
            >
              <RotateCw className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Search (Ctrl/⌘ K)"
              aria-label="Search"
              className="text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-4" />
            </Button>
            {isOverview ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Time range"
                    aria-label="Time range"
                    className="text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Filter className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {ranges.map((item) => (
                    <DropdownMenuItem key={item.value} onSelect={() => setRangeParam(item.value)}>
                      <Check className={cn('size-3.5', rangeParam === item.value ? 'opacity-100' : 'opacity-0')} />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="Account" aria-label="Account">
                  <UserRound />
                  <span className="sr-only">Account</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2.5 py-2 text-xs">
                  <div className="font-medium">{user?.username}</div>
                  <div className="mt-0.5 text-muted-foreground">{roleLabel(user?.role)}</div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/change-password')}>
                  <CommandIcon />
                  Change Password
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col p-4 sm:p-6 xl:min-h-0 xl:overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
