import { useQuery } from '@tanstack/react-query'
import { Activity, Building2, CalendarClock, Crosshair, FileWarning, Globe2, Search, Workflow } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

const icons = {
  organization: Building2,
  domain: Globe2,
  asset: Crosshair,
  finding: FileWarning,
  task: Workflow,
  monitor: Activity,
  schedule: CalendarClock,
}
const labels = {
  organizations: 'Organizations',
  domains: 'Domains',
  assets: 'Assets',
  findings: 'Risks',
  tasks: 'Tasks',
  monitors: 'Monitors',
  schedules: 'Schedules',
}

function targetPath(type: string, id: string, organizationId?: string) {
  if (type === 'organization') return `/organizations/${id}`
  if (type === 'finding')
    return organizationId ? `/organizations/${organizationId}/findings?focus=${id}` : `/findings?focus=${id}`
  if (type === 'task') return `/tasks/${id}`
  if (type === 'monitor') return '/automation/monitors'
  if (type === 'schedule') return '/automation/schedules'
  if (organizationId) return `/organizations/${organizationId}/assets?focus=${id}`
  return `/assets?focus=${id}`
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const search = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search(query),
    enabled: open && query.trim().length >= 2,
    staleTime: 10_000,
  })
  const groups = (['organizations', 'domains', 'assets', 'findings', 'tasks', 'monitors', 'schedules'] as const).map(
    (key) => ({
      key,
      items: search.data?.[key] || [],
    }),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-20 max-w-2xl p-0">
        <DialogTitle className="sr-only">Global search</DialogTitle>
        <DialogDescription className="sr-only">
          Search organizations, domains, assets, risks, tasks, monitors, and schedules
        </DialogDescription>
        <Command shouldFilter={false} loop>
          <CommandInput
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search anything — organizations, domains, assets, risks, tasks, monitors…"
          />
          <CommandList>
            {query.trim().length < 2 ? (
              <div className="flex items-center gap-2 px-3 py-8 text-xs text-muted-foreground">
                <Search className="size-4" />
                Type at least 2 characters to search
              </div>
            ) : search.isLoading ? (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">Searching…</div>
            ) : (
              <CommandEmpty>No matching results</CommandEmpty>
            )}
            {groups.map(({ key, items }) => {
              if (!items.length) return null
              return (
                <CommandGroup key={key} heading={labels[key]}>
                  {items.map((item) => {
                    const Icon = icons[item.type as keyof typeof icons] || Search
                    return (
                      <CommandItem
                        key={`${key}-${item.id}`}
                        value={`${key}-${item.id}`}
                        onSelect={() => {
                          onOpenChange(false)
                          navigate(targetPath(item.type, item.id, item.organizationId))
                        }}
                      >
                        <Icon className="size-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{item.label}</div>
                          {item.detail ? (
                            <div className="truncate text-[11px] text-muted-foreground">{item.detail}</div>
                          ) : null}
                        </div>
                        {item.risk ? <span className={`text-[11px] risk-${item.risk}`}>{item.risk}</span> : null}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
