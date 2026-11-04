import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, type Policy } from '@/api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Field } from '@/components/common/form'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { policySummary } from '@/lib/format'
import { canWrite } from '@/lib/access'
import { useAuth } from '@/app/auth'

const capabilityLabels: Record<keyof typeof defaults, string> = {
  domainBrute: 'Domain Brute',
  portScan: 'Port Scan',
  serviceDetection: 'Service Detection',
  siteIdentify: 'Site Identify',
  fileLeak: 'File Leak',
  webInfoHunter: 'Web Info Hunter',
  nucleiScan: 'Nuclei Scan',
}

const defaults = {
  domainBrute: true,
  portScan: true,
  serviceDetection: true,
  siteIdentify: true,
  fileLeak: false,
  webInfoHunter: false,
  nucleiScan: false,
}
export function PoliciesPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState(defaults)
  const [configBase, setConfigBase] = useState<Record<string, any>>({})
  const policies = useQuery({ queryKey: ['policies'], queryFn: () => api.policies() })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['policies'] })
  const create = useMutation({
    mutationFn: () =>
      api.createPolicy({
        name,
        description,
        config: mergePolicyConfig(configBase, options),
      }),
    onSuccess: () => {
      toast.success('Policy created')
      setOpen(false)
      setName('')
      setDescription('')
      setConfigBase({})
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deletePolicy(id),
    onSuccess: () => {
      toast.success('Policy deleted')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const update = useMutation({
    mutationFn: () =>
      api.updatePolicy(editingId, {
        name,
        description,
        config: mergePolicyConfig(configBase, options),
      }),
    onSuccess: () => {
      toast.success('Policy updated')
      setOpen(false)
      setEditingId('')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  function edit(row: Policy) {
    const config = (row.config || {}) as Record<string, any>
    setEditingId(row.id || '')
    setName(row.name || '')
    setDescription(row.description || '')
    setConfigBase(config)
    setOptions({
      domainBrute: Boolean(config.domain?.domainBrute),
      portScan: Boolean(config.ip?.portScan),
      serviceDetection: Boolean(config.ip?.serviceDetection),
      siteIdentify: Boolean(config.site?.siteIdentify),
      fileLeak: Boolean(config.site?.fileLeak),
      webInfoHunter: Boolean(config.site?.webInfoHunter),
      nucleiScan: Boolean(config.site?.nucleiScan),
    })
    setOpen(true)
  }
  const rows = (policies.data?.items || []) as Policy[]
  return (
    <div>
      <PageHeader
        title="Scan Policies"
        actions={
          canWrite(role) ? (
            <Button
              size="icon"
              title="New Policy"
              onClick={() => {
                setEditingId('')
                setName('')
                setDescription('')
                setOptions(defaults)
                setConfigBase({})
                setOpen(true)
              }}
            >
              <Plus />
              <span className="sr-only">New Policy</span>
            </Button>
          ) : null
        }
      />
      {policies.isLoading ? (
        <LoadingBlock />
      ) : policies.error ? (
        <ErrorState error={policies.error} retry={() => policies.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id || row.name || ''}
          empty={<EmptyState title="No scan policies" />}
          columns={[
            { key: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.name}</span> },
            { key: 'description', header: 'Description', cell: (row) => row.description || '—', hideOnTablet: true },
            {
              key: 'config',
              header: 'Capabilities',
              cell: (row) => (
                <span className="text-muted-foreground">{policySummary(row.config as Record<string, any>)}</span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              cell: (row) =>
                canWrite(role) ? (
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="outline" className="size-8" title="Edit" onClick={() => edit(row)}>
                      <Pencil />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <ConfirmDialog
                      title="Delete scan policy"
                      description="Moved to the recycle bin. Blocked while referenced by active monitors or schedules."
                      confirmLabel="Move To Recycle Bin"
                      onConfirm={() => remove.mutate(row.id || '')}
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Scan Policy' : 'New Scan Policy'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Description">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-16" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(capabilityLabels).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-[4px] border px-3 py-2.5 text-xs uppercase tracking-[0.04em]"
                >
                  <Checkbox
                    checked={options[key as keyof typeof options]}
                    onCheckedChange={(value) => setOptions({ ...options, [key]: Boolean(value) })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" className="size-8" title="Cancel" onClick={() => setOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button
              disabled={!name.trim() || create.isPending || update.isPending}
              onClick={() => (editingId ? update.mutate() : create.mutate())}
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

function mergePolicyConfig(base: Record<string, any>, options: typeof defaults) {
  return {
    ...base,
    domain: { ...(base.domain || {}), domainBrute: options.domainBrute },
    ip: {
      ...(base.ip || {}),
      portScan: options.portScan,
      serviceDetection: options.serviceDetection,
    },
    site: {
      ...(base.site || {}),
      siteIdentify: options.siteIdentify,
      fileLeak: options.fileLeak,
      webInfoHunter: options.webInfoHunter,
      nucleiScan: options.nucleiScan,
    },
    poc: base.poc || [],
    brute: base.brute || [],
  }
}
