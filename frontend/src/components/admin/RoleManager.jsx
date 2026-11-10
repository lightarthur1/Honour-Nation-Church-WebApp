import { endpoints } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../ui/Toast'

export default function RoleManager({ users, onChange }) {
  const { user: me } = useAuth()
  const toast = useToast()
  const change = async (u, role) => {
    try { await endpoints.setRole(u.id, role); toast(`${u.full_name} is now ${role}`); onChange() } catch (e) { toast(e.message, 'error') }
  }
  return (
    <div className="card divide-y divide-ink-900/10 overflow-hidden dark:divide-white/10">
      {users.map((u) => (
        <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">{u.full_name}{u.id === me.id && <span className="ml-2 text-xs opacity-50">(you)</span>}</p>
            <p className="truncate text-xs opacity-60">{u.email}</p>
          </div>
          <select aria-label={`Role for ${u.full_name}`} className="input !w-auto" value={u.role} disabled={u.id === me.id} onChange={(e) => change(u, e.target.value)}>
            <option value="user">Common User</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      ))}
    </div>
  )
}
