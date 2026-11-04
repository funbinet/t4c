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
import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/app/auth'
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
import { ScrollProgress } from '@/components/common/scroll-progress'

type NavItem = { to: string; label: string; icon: typeof Activity; end?: boolean }
type NavGroup = { label: string; items: NavItem[] }

const ranges = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'ALL' },
]

const groups: NavGroup[] = [
  {
    label: 'Attack Surface',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/organizations', label: 'Organizations', icon: Building2 },
      { to: '/assets', label: 'Assets', icon: Crosshair },
      { to: '/findings', label: 'Risks', icon: ShieldCheck },
      { to: '/tasks', label: 'Tasks', icon: Workflow },
    ],
  },
  {
    label: 'Automation',
    items: [
      { to: '/automation/monitors', label: 'Monitors', icon: Activity },
      { to: '/automation/schedules', label: 'Schedules', icon: CalendarClock },
      { to: '/automation/policies', label: 'Scan Policies', icon: Settings2 },
      { to: '/automation/groups', label: 'Asset Groups', icon: Boxes },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/intelligence/github', label: 'GitHub', icon: GitBranch },
      { to: '/intelligence/fingerprints', label: 'Fingerprints', icon: Fingerprint },
      { to: '/intelligence/poc', label: 'PoC Plugins', icon: Radar },
    ],
  },
]

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
  const allGroups = isAdmin(role) ? [...groups, adminGroup] : groups
  return (
    <nav
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-y-auto py-4 scrollbar-thin',
        collapsed && 'justify-evenly',
      )}
      aria-label="Main navigation"
    >
      {allGroups.map((group) => (
        <div key={group.label} className={collapsed ? 'contents' : 'flex w-full flex-col gap-1 px-3'}>
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
                      'flex h-9 items-center rounded-[4px] text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-[rgba(0,250,0,0.06)] hover:text-white',
                      collapsed ? 'w-9 justify-center' : 'w-full gap-2.5 px-3 text-left',
                      isActive && 'bg-[rgba(0,250,0,0.1)] text-mint hover:bg-[rgba(0,250,0,0.12)]',
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
      ))}
    </nav>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
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
    const all = [...groups.flatMap((group) => group.items), ...adminGroup.items]
    const exact = all.find((item) => item.to === location.pathname)
    if (exact) return exact.label
    if (location.pathname.startsWith('/organizations/')) return 'Organization Details'
    if (location.pathname.startsWith('/tasks/')) return 'Task Details'
    return 'T4C Console'
  }, [location.pathname])

  async function signOut() {
    await logout()
    window.location.assign('/login')
  }

  return (
    <div className="min-h-screen xl:h-dvh xl:min-h-0 xl:overflow-hidden">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-black/65 text-ink backdrop-blur-md transition-[width] lg:flex',
          collapsed ? 'w-[68px]' : 'w-[236px]',
        )}
      >
        <Link
          to="/"
          aria-label="T4C home"
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-border transition-opacity hover:opacity-80',
            collapsed ? 'justify-center' : 'justify-center gap-3 px-4',
          )}
        >
          <img src={t4cLogo} alt="T4C logo" className="size-9 shrink-0 rounded-[4px] object-contain shadow-sm" />
          {!collapsed ? (
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-wide text-ink">T4C</div>
            </div>
          ) : null}
        </Link>
        <NavContent collapsed={collapsed} />
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="icon"
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="mx-auto flex text-muted-foreground hover:bg-[rgba(0,250,0,0.06)] hover:text-white"
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
            className="absolute inset-0 bg-black/70"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-border bg-black/85 text-ink shadow-2xl backdrop-blur-md">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Link
                to="/"
                aria-label="T4C home"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 transition-opacity hover:opacity-80"
              >
                <img src={t4cLogo} alt="T4C logo" className="size-9 shrink-0 rounded-[4px] object-contain" />
                <div>
                  <div className="font-semibold">T4C</div>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-[rgba(0,250,0,0.06)] hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                <X />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <NavContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div
        className={cn(
          'min-h-screen transition-[padding] xl:flex xl:h-dvh xl:min-h-0 xl:flex-col xl:overflow-hidden',
          collapsed ? 'lg:pl-[68px]' : 'lg:pl-[236px]',
        )}
      >
        <header className="glass sticky top-0 z-20 grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border px-4 sm:px-6">
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
              className="text-muted-foreground hover:bg-[rgba(0,250,0,0.06)] hover:text-white"
              onClick={refresh}
            >
              <RotateCw className={cn('size-4', refreshing && 'refresh-spin')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Search (Ctrl/⌘ K)"
              aria-label="Search"
              className="text-muted-foreground hover:bg-[rgba(0,250,0,0.06)] hover:text-white"
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
                    className="text-muted-foreground hover:bg-[rgba(0,250,0,0.06)] hover:text-white"
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
                <Button variant="ghost" size="sm" className="group max-w-44" title="Account">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-[rgba(0,250,0,0.28)] bg-[rgba(0,250,0,0.06)] text-mint transition-colors group-hover:text-white">
                    <UserRound className="size-3.5" />
                  </span>
                  <span className="hidden truncate normal-case sm:inline">{user?.username || 'Account'}</span>
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
      <ScrollProgress />
    </div>
  )
}
