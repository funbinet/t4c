import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, type User } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatTime, roleLabel } from '@/lib/format'

export function UsersPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({ username: '', password: '', role: 'viewer' })
  const [editForm, setEditForm] = useState({ role: 'viewer', disabled: false, password: '' })
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
  const rows = (users.data?.items || []) as User[]
  return (
    <div>
      <PageHeader
        title="User management"
        description="Manage viewer, operator, and admin accounts. Require users to change the initial password at first sign-in."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus />
            New user
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
          empty={
            <EmptyState title="No users" action={<Users className="mx-auto mt-2 size-5 text-muted-foreground" />} />
          }
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
            { key: 'mustChange', header: 'Must change password', cell: (row) => (row.mustChangePassword ? 'Yes' : 'No') },
            { key: 'disabled', header: 'Status', cell: (row) => (row.disabled ? 'Disabled' : 'Active') },
            { key: 'created', header: 'Created', cell: (row) => formatTime(row.createdAt), hideOnTablet: true },
            {
              key: 'actions',
              header: 'Actions',
              cell: (row) => (
                <div className="flex justify-end">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => edit(row)}>
                      <Pencil />
                      Edit
                    </Button>
                    <ConfirmDialog
                      title="Delete user"
                      description="The user will be moved to the recycle bin and all sessions revoked immediately. You cannot delete the current user or the last active administrator."
                      confirmLabel="Move to recycle bin"
                      onConfirm={() => remove.mutate(row.id || '')}
                      trigger={
                        <Button size="sm" variant="ghost" className="text-destructive">
                          <Trash2 />
                          Delete
                        </Button>
                      }
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New user</DialogTitle>
            <DialogDescription>Share the initial password through a secure channel after creation.</DialogDescription>
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!form.username.trim() || form.password.length < 8} onClick={() => create.mutate()}>
              Create user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Usernames cannot be changed. If you set a temporary password, the user must change it at next sign-in.</DialogDescription>
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
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={editForm.disabled}
                onChange={(event) => setEditForm({ ...editForm, disabled: event.target.checked })}
              />
              Disable this user
            </label>
            <Field label="Temporary password (optional)">
              <Input
                type="password"
                value={editForm.password}
                onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={update.isPending || (editForm.password.length > 0 && editForm.password.length < 10)}
              onClick={() => update.mutate()}
            >
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
