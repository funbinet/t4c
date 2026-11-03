import {
  Activity,
  Boxes,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Command as CommandIcon,
  Crosshair,
  FileKey2,
  FileText,
  Fingerprint,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Radar,
  RotateCcw,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Workflow,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
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
    <nav className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin" aria-label="Main navigation">
      {allGroups.map((group) => (
        <div key={group.label} className="mb-4">
          {!collapsed ? <div className="mono-label px-2 pb-1.5">{group.label}</div> : null}
          <div className="space-y-0.5">
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
                      'flex h-9 items-center gap-2.5 rounded-[4px] px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-[rgba(0,250,0,0.06)] hover:text-mint',
                      isActive && 'bg-[rgba(0,250,0,0.1)] text-mint shadow-[inset_2px_0_0_var(--primary)]',
                      collapsed && 'justify-center px-0',
                    )
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
                </NavLink>
              )
              return collapsed ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
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
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

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
    <div className="min-h-screen bg-background xl:h-dvh xl:min-h-0 xl:overflow-hidden">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-black/95 text-ink transition-[width] lg:flex',
          collapsed ? 'w-[68px]' : 'w-[236px]',
        )}
      >
        <div
          className={cn('flex h-16 items-center border-b border-border', collapsed ? 'justify-center' : 'gap-3 px-4')}
        >
          <img src={t4cLogo} alt="T4C logo" className="size-9 shrink-0 rounded-[4px] object-contain shadow-sm" />
          {!collapsed ? (
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-wide text-ink">T4C</div>
            </div>
          ) : null}
        </div>
        <NavContent collapsed={collapsed} />
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-dim hover:bg-[rgba(0,250,0,0.06)] hover:text-mint"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
            {!collapsed ? <span>Collapse navigation</span> : <span className="sr-only">Expand navigation</span>}
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
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-border bg-black text-ink shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-3">
                <img src={t4cLogo} alt="T4C logo" className="size-9 shrink-0 rounded-[4px] object-contain" />
                <div>
                  <div className="font-semibold">T4C</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-[rgba(0,250,0,0.06)] hover:text-mint"
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
        <header className="glass sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu />
              <span className="sr-only">Open navigation</span>
            </Button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{title}</div>
              <div className="mono-label hidden sm:block">Authorized external attack surface analysis</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="hidden min-w-52 justify-start text-muted-foreground sm:flex"
              onClick={() => setSearchOpen(true)}
            >
              <Search />
              Search<span className="ml-auto rounded border px-1.5 py-0.5 text-[10px]">⌘K</span>
            </Button>
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setSearchOpen(true)}>
              <Search />
              <span className="sr-only">Search</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="max-w-44">
                  <span className="grid size-6 place-items-center rounded-full bg-[rgba(0,250,0,0.12)] text-[11px] font-semibold text-mint">
                    {user?.username?.slice(0, 1).toUpperCase() || 'A'}
                  </span>
                  <span className="hidden truncate sm:inline">{user?.username || 'Account'}</span>
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
