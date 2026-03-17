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
  const [filters, setFilters] = useState({
    q: '',
    role: '',
    banned: '',
    sortBy: 'createdAt',
    sortDir: 'desc',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('pageSize', '50')
      if (filters.q) params.set('q', filters.q)
      if (filters.role) params.set('role', filters.role)
      if (filters.banned) params.set('banned', filters.banned)
      if (filters.sortBy) params.set('sortBy', filters.sortBy)
      if (filters.sortDir) params.set('sortDir', filters.sortDir)

      const res = await apiRequestBackend(`/api/admin/users?${params.toString()}`)
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
  }, [filters, notify])

  useEffect(() => {
    load()
  }, [load])

  const updateRole = async (id, role) => {
    setSavingId(id)
    setError('')
    try {
      await apiRequestBackend(`/api/admin/users/${id}`, { method: 'PATCH', body: { role } })
      await load()
      notify.success(t('admin.updated_role'))
    } catch (err) {
      const msg = err?.message || 'Failed to update role'
      setError(msg)
      notify.error(msg)
    } finally {
      setSavingId(null)
    }
  }

  const setBan = async (u, ban) => {
    setSavingId(u.id)
    setError('')
    try {
      if (ban) {
        const reason = window.prompt(`Reason to ban ${u.email}? (optional)`) || ''
        const ok = window.confirm(`Ban ${u.email}?`)
        if (!ok) return
        await apiRequestBackend(`/api/admin/users/${u.id}/ban`, { method: 'POST', body: { reason } })
        notify.success('User banned.')
      } else {
        const ok = window.confirm(`Unban ${u.email}?`)
        if (!ok) return
        await apiRequestBackend(`/api/admin/users/${u.id}/unban`, { method: 'POST' })
        notify.success('User unbanned.')
      }
      await load()
    } catch (err) {
      const msg = err?.message || 'Failed to update ban status'
      setError(msg)
      notify.error(msg)
    } finally {
      setSavingId(null)
    }
  }

  const confirmAndUpdateRole = async (u) => {
    const nextRole = pendingRoleById[u.id]
    if (!nextRole || nextRole === u.role) return

    const ok = window.confirm(`${t('admin.confirm_role')} ${u.email}: ${u.role} -> ${nextRole}?`)
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
          <h3 className="mb-0">{t('admin.users')}</h3>
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
            <div className="row g-2 align-items-end mb-3">
              <div className="col-12 col-md-4">
                <label className="form-label small text-secondary mb-1">{t('admin.search')}</label>
                <input
                  className="form-control form-control-sm"
                  value={filters.q}
                  placeholder={t('admin.search_placeholder')}
                  onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
                />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small text-secondary mb-1">{t('admin.filter_role')}</label>
                <select
                  className="form-select form-select-sm"
                  value={filters.role}
                  onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="">{t('admin.all')}</option>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small text-secondary mb-1">{t('admin.filter_status')}</label>
                <select
                  className="form-select form-select-sm"
                  value={filters.banned}
                  onChange={(e) => setFilters((prev) => ({ ...prev, banned: e.target.value }))}
                >
                  <option value="">{t('admin.all')}</option>
                  <option value="false">{t('admin.status_active')}</option>
                  <option value="true">{t('admin.status_banned')}</option>
                </select>
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small text-secondary mb-1">{t('admin.sort_by')}</label>
                <select
                  className="form-select form-select-sm"
                  value={filters.sortBy}
                  onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
                >
                  <option value="createdAt">{t('admin.sort.createdAt')}</option>
                  <option value="email">{t('admin.sort.email')}</option>
                  <option value="username">{t('admin.sort.username')}</option>
                  <option value="role">{t('admin.sort.role')}</option>
                  <option value="bannedAt">{t('admin.sort.bannedAt')}</option>
                </select>
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small text-secondary mb-1">{t('admin.sort_dir')}</label>
                <select
                  className="form-select form-select-sm"
                  value={filters.sortDir}
                  onChange={(e) => setFilters((prev) => ({ ...prev, sortDir: e.target.value }))}
                >
                  <option value="desc">{t('admin.desc')}</option>
                  <option value="asc">{t('admin.asc')}</option>
                </select>
              </div>
              <div className="col-12">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() =>
                    setFilters({
                      q: '',
                      role: '',
                      banned: '',
                      sortBy: 'createdAt',
                      sortDir: 'desc',
                    })
                  }
                >
                  {t('admin.clear')}
                </button>
              </div>
            </div>

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
                      <th>Status</th>
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
                          {u.banned ? (
                            <span className="badge text-bg-danger">BANNED</span>
                          ) : (
                            <span className="badge text-bg-success">ACTIVE</span>
                          )}
                        </td>
                        <td>
                          {(() => {
                            const actorRole = me?.role
                            const canBanThisUser =
                              actorRole === 'SUPER_ADMIN' ? true : actorRole === 'ADMIN' ? u.role === 'USER' : false

                            return (
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
                            {savingId === u.id ? (
                              <span className="text-secondary small">{t('admin.saving')}</span>
                            ) : null}
                            {canBanThisUser ? (
                              <button
                                type="button"
                                className={`btn btn-sm ${u.banned ? 'btn-outline-success' : 'btn-outline-danger'}`}
                                disabled={savingId === u.id}
                                onClick={() => setBan(u, !u.banned)}
                              >
                                {u.banned ? 'Unban' : 'Ban'}
                              </button>
                            ) : null}
                          </div>
                            )
                          })()}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-secondary">
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
