import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api, type User } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/common/data-table'
import { ExpandableSearch, ScreenToolbar } from '@/components/common/screen-toolbar'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Field } from '@/components/common/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatTime, roleLabel } from '@/lib/format'

export function UsersPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({ username: '', password: '', role: 'viewer' })
  const [editForm, setEditForm] = useState({ role: 'viewer', disabled: false, password: '' })
  const [search, setSearch] = useState('')
  const users = useQuery({ queryKey: ['users'], queryFn: () => api.users() })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] })
  const create = useMutation({
    mutationFn: () => api.createUser(form),
    onSuccess: () => {
      toast.success('User created')
      setOpen(false)
      setForm({ username: '', password: '', role: 'viewer' })
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      toast.success('User deleted')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const update = useMutation({
    mutationFn: () =>
      api.updateUser(editingId, {
        role: editForm.role,
        disabled: editForm.disabled,
        ...(editForm.password ? { password: editForm.password } : {}),
      }),
    onSuccess: () => {
      toast.success('User updated')
      setEditOpen(false)
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  function edit(row: User) {
    setEditingId(row.id || '')
    setEditForm({ role: row.role || 'viewer', disabled: Boolean(row.disabled), password: '' })
    setEditOpen(true)
  }
  const rows = useMemo(
    () =>
      ((users.data?.items || []) as User[]).filter(
        (row) => !search || `${row.username} ${row.role}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [users.data, search],
  )
  return (
    <div>
      <ScreenToolbar
        left={
          <ExpandableSearch
            value={search}
            onChange={setSearch}
            placeholder="Search username or role…"
            title="Search users"
          />
        }
        center={users.isLoading ? 'Loading…' : `${rows.length} users`}
        right={
          <Button size="icon" title="New User" aria-label="New User" onClick={() => setOpen(true)}>
            <Plus />
            <span className="sr-only">New User</span>
          </Button>
        }
      />
      {users.isLoading ? (
        <LoadingBlock />
      ) : users.error ? (
        <ErrorState error={users.error} retry={() => users.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id || row.username || ''}
          empty={<EmptyState title="No users" />}
          columns={[
            { key: 'username', header: 'Username', cell: (row) => <span className="font-medium">{row.username}</span> },
            {
              key: 'role',
              header: 'Role',
              cell: (row) => (
                <Badge variant={row.role === 'admin' ? 'danger' : row.role === 'operator' ? 'info' : 'outline'}>
                  {roleLabel(row.role)}
                </Badge>
              ),
            },
            {
              key: 'mustChange',
              header: 'Must Change Password',
              cell: (row) => (row.mustChangePassword ? 'Yes' : 'No'),
            },
            {
              key: 'disabled',
              header: 'Status',
              cell: (row) => (
                <span className="uppercase tracking-[0.04em]">{row.disabled ? 'Disabled' : 'Active'}</span>
              ),
            },
            { key: 'created', header: 'Created', cell: (row) => formatTime(row.createdAt), hideOnTablet: true },
            {
              key: 'actions',
              header: 'Actions',
              cell: (row) => (
                <div className="flex justify-end gap-1">
                  <Button size="icon" variant="outline" className="size-8" title="Edit" onClick={() => edit(row)}>
                    <Pencil />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <ConfirmDialog
                    title="Delete user"
                    description="Moved to the recycle bin; sessions are revoked. The current user and the last active administrator cannot be deleted."
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
              ),
            },
          ]}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Username">
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
            <Field label="Initial password">
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" className="size-8" title="Cancel" onClick={() => setOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button disabled={!form.username.trim() || form.password.length < 8} onClick={() => create.mutate()}>
              <Plus />
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Role">
              <Select value={editForm.role} onValueChange={(value) => setEditForm({ ...editForm, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-2 rounded-[4px] border px-3 py-2.5 text-xs uppercase tracking-[0.04em]">
              <Checkbox
                checked={editForm.disabled}
                onCheckedChange={(value) => setEditForm({ ...editForm, disabled: Boolean(value) })}
              />
              Disable this user
            </label>
            <Field label="Temporary Password" hint="The user must change it at next sign-in.">
              <Input
                type="password"
                value={editForm.password}
                onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" className="size-8" title="Cancel" onClick={() => setEditOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button
              disabled={update.isPending || (editForm.password.length > 0 && editForm.password.length < 10)}
              onClick={() => update.mutate()}
            >
              <Save />
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
