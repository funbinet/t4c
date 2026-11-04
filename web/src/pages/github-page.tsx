import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Field } from '@/components/common/form'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTime } from '@/lib/format'
import { canWrite } from '@/lib/access'
import { useAuth } from '@/app/auth'

export function GitHubPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('findings')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [name, setName] = useState('')
  const [intervalSec, setIntervalSec] = useState(21600)
  const tasks = useQuery({ queryKey: ['github-tasks'], queryFn: () => api.githubTasks(), enabled: tab === 'tasks' })
  const monitors = useQuery({
    queryKey: ['github-monitors'],
    queryFn: () => api.githubMonitors(),
    enabled: tab === 'monitors',
  })
  const findings = useQuery({
    queryKey: ['github-findings'],
    queryFn: () => api.githubFindings(),
    enabled: tab === 'findings',
  })
  const createTask = useMutation({
    mutationFn: () => api.createGitHubTask(keyword),
    onSuccess: () => {
      toast.success('Code search task created')
      setOpen(false)
      setKeyword('')
      void queryClient.invalidateQueries({ queryKey: ['github-tasks'] })
    },
    onError: (error) => toast.error(error.message),
  })
  const createMonitor = useMutation({
    mutationFn: () => api.createGitHubMonitor({ keyword, name, intervalSec }),
    onSuccess: () => {
      toast.success('GitHub monitor created')
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['github-monitors'] })
    },
    onError: (error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteGitHubMonitor(id),
    onSuccess: () => {
      toast.success('Monitor deleted')
      void queryClient.invalidateQueries({ queryKey: ['github-monitors'] })
    },
    onError: (error) => toast.error(error.message),
  })
  const update = useMutation({
    mutationFn: () => api.updateGitHubMonitor(editingId, { keyword, name, intervalSec }),
    onSuccess: () => {
      toast.success('GitHub monitor updated')
      setOpen(false)
      setEditingId('')
      void queryClient.invalidateQueries({ queryKey: ['github-monitors'] })
    },
    onError: (error) => toast.error(error.message),
  })
  function editMonitor(row: any) {
    setEditingId(row.id)
    setKeyword(row.keyword || '')
    setName(row.name || '')
    setIntervalSec(row.intervalSec || 21600)
    setOpen(true)
  }
  return (
    <div>
      <PageHeader
        title="GitHub"
        actions={
          canWrite(role) ? (
            <Button
              size="icon"
              title={tab === 'monitors' ? 'New Monitor' : 'New Search'}
              onClick={() => {
                setEditingId('')
                setKeyword('')
                setName('')
                setIntervalSec(21600)
                setOpen(true)
              }}
            >
              <Plus />
              <span className="sr-only">{tab === 'monitors' ? 'New Monitor' : 'New Search'}</span>
            </Button>
          ) : null
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="findings">Leak Results</TabsTrigger>
          <TabsTrigger value="tasks">Search Tasks</TabsTrigger>
          <TabsTrigger value="monitors">Monitors</TabsTrigger>
        </TabsList>
        <TabsContent value="findings">
          {findings.isLoading ? (
            <LoadingBlock />
          ) : findings.error ? (
            <ErrorState error={findings.error} retry={() => findings.refetch()} />
          ) : (
            <DataTable
              rows={findings.data?.items || []}
              rowKey={(row: any) => row.id || row.hashMd5}
              empty={<EmptyState title="No leak results" />}
              columns={[
                {
                  key: 'repo',
                  header: 'Repository',
                  cell: (row: any) =>
                    row.htmlUrl ? (
                      <a className="text-primary hover:underline" href={row.htmlUrl} target="_blank" rel="noreferrer">
                        {row.repo}
                      </a>
                    ) : (
                      row.repo
                    ),
                },
                { key: 'path', header: 'File', cell: (row: any) => <span className="mono">{row.path}</span> },
                { key: 'keyword', header: 'Keyword', cell: (row: any) => row.keyword },
                { key: 'time', header: 'Found At', cell: (row: any) => formatTime(row.createdAt) },
              ]}
            />
          )}
        </TabsContent>
        <TabsContent value="tasks">
          {tasks.isLoading ? (
            <LoadingBlock />
          ) : (
            <DataTable
              rows={tasks.data?.items || []}
              rowKey={(row: any) => row.id}
              empty={<EmptyState title="No GitHub search tasks" />}
              columns={[
                { key: 'keyword', header: 'Keyword', cell: (row: any) => row.keyword },
                { key: 'status', header: 'Status', cell: (row: any) => row.status },
                { key: 'results', header: 'Results', cell: (row: any) => row.resultCount || 0 },
                { key: 'time', header: 'Created', cell: (row: any) => formatTime(row.createdAt) },
              ]}
            />
          )}
        </TabsContent>
        <TabsContent value="monitors">
          {monitors.isLoading ? (
            <LoadingBlock />
          ) : (
            <DataTable
              rows={monitors.data?.items || []}
              rowKey={(row: any) => row.id}
              empty={<EmptyState title="No GitHub monitors" />}
              columns={[
                { key: 'name', header: 'Name', cell: (row: any) => row.name },
                { key: 'keyword', header: 'Keyword', cell: (row: any) => row.keyword },
                { key: 'status', header: 'Status', cell: (row: any) => row.status },
                { key: 'interval', header: 'Interval', cell: (row: any) => `${row.intervalSec || 0}s` },
                {
                  key: 'actions',
                  header: 'Actions',
                  cell: (row: any) =>
                    canWrite(role) ? (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="outline" className="size-8" title="Edit" onClick={() => editMonitor(row)}>
                          <Pencil />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <ConfirmDialog
                          title="Delete GitHub monitor"
                          description="Moved to the recycle bin. Historical findings are kept."
                          confirmLabel="Move To Recycle Bin"
                          onConfirm={() => remove.mutate(row.id)}
                          trigger={
                            <Button size="icon" variant="outline" className="size-8 text-destructive hover:text-destructive" title="Delete">
                              <Trash2 />
                              <span className="sr-only">Delete</span>
                            </Button>
                          }
                        />
                      </div>
                    ) : null,
                },
              ]}
            />
          )}
        </TabsContent>
      </Tabs>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit GitHub Monitor' : tab === 'monitors' ? 'New GitHub Monitor' : 'New Code Search'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Keyword">
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="example.com password" />
            </Field>
            {tab === 'monitors' ? (
              <>
                <Field label="Name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Interval (seconds)">
                  <Input type="number" value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))} />
                </Field>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" className="size-8" title="Cancel" onClick={() => setOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button
              disabled={!keyword.trim()}
              onClick={() =>
                editingId ? update.mutate() : tab === 'monitors' ? createMonitor.mutate() : createTask.mutate()
              }
            >
              <Save className="size-4" />
              {editingId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
