import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequestBackend } from '../../lib/apiClient'
import { getBackendAuth } from '../../lib/backendAuth'
import { useNotify } from '../../components/notifications/useNotify'
import { useI18n } from '../../lib/useI18n'

const AdminUsersPage = () => {
  const me = useMemo(() => getBackendAuth()?.user || null, [])
  const canManageRoles = me?.role === 'SUPER_ADMIN'
  const notify = useNotify()
  const { t } = useI18n()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [pendingRoleById, setPendingRoleById] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiRequestBackend('/api/admin/users?page=1&pageSize=50')
      const items = res?.items || []
      setUsers(items)
      const nextPending = {}
      for (const u of items) nextPending[u.id] = u.role
      setPendingRoleById(nextPending)
    } catch (err) {
      const msg = err?.message || 'Failed to load users'
      setError(msg)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  const updateRole = async (id, role) => {
    setSavingId(id)
    setError('')
    try {
      await apiRequestBackend(`/api/admin/users/${id}`, { method: 'PATCH', body: { role } })
      await load()
      notify.success('Cập nhật role thành công.')
    } catch (err) {
      const msg = err?.message || 'Failed to update role'
      setError(msg)
      notify.error(msg)
    } finally {
      setSavingId(null)
    }
  }

  const confirmAndUpdateRole = async (u) => {
    const nextRole = pendingRoleById[u.id]
    if (!nextRole || nextRole === u.role) return

    const ok = window.confirm(`${t('admin.confirm_role')} ${u.email}: ${u.role} → ${nextRole}?`)
    if (!ok) {
      setPendingRoleById((prev) => ({ ...prev, [u.id]: u.role }))
      return
    }

    await updateRole(u.id, nextRole)
  }

  return (
    <div className="row g-3">
      <div className="col-12">
        <div className="d-flex align-items-center justify-content-between">
          <h3 className="mb-0">Users</h3>
          <button className="btn btn-light btn-sm" type="button" onClick={load} disabled={loading}>
            {t('admin.refresh')}
          </button>
        </div>
        <div className="text-secondary small mt-1">
          {t('admin.role_policy')}
        </div>
      </div>

      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            {loading ? <div>Loading...</div> : null}
            {error ? <div className="text-danger">Error: {error}</div> : null}

            {!loading && !error ? (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th style={{ width: 360 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.username}</td>
                        <td>{u.email}</td>
                        <td>
                          <span className="badge text-bg-light">{u.role}</span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <select
                              className="form-select form-select-sm"
                              style={{ maxWidth: 220 }}
                              value={pendingRoleById[u.id] ?? u.role}
                              disabled={!canManageRoles || savingId === u.id}
                              onChange={(e) =>
                                setPendingRoleById((prev) => ({ ...prev, [u.id]: e.target.value }))
                              }
                              aria-label={`Change role for ${u.email}`}
                            >
                              <option value="USER">USER</option>
                              <option value="ADMIN">ADMIN</option>
                              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                            </select>
                            {canManageRoles ? (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={
                                  savingId === u.id || (pendingRoleById[u.id] ?? u.role) === u.role
                                }
                                onClick={() => confirmAndUpdateRole(u)}
                              >
                                {t('admin.apply')}
                              </button>
                            ) : null}
                            {!canManageRoles ? (
                              <span className="text-secondary small">{t('admin.no_role_perm')}</span>
                            ) : null}
                            {savingId === u.id ? (
                              <span className="text-secondary small">{t('admin.saving')}</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-secondary">
                          No users
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminUsersPage
