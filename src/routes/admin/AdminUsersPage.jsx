import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequestBackend } from '../../lib/apiClient'
import { getBackendAuth } from '../../lib/backendAuth'
import { useNotify } from '../../components/notifications/useNotify'
import { useI18n } from '../../lib/useI18n'
import AdminDataTable from './AdminDataTable.jsx'

const USER_TABLE_SORT_MAP = {
  username: 'username',
  email: 'email',
  role: 'role',
  status: 'bannedAt',
}

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
      const msg = err?.message || t('admin.load_users_fail')
      setError(msg)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }, [filters, notify, t])

  useEffect(() => {
    load()
  }, [load])

  const summary = useMemo(() => {
    const total = users.length
    const banned = users.filter((u) => u.banned).length
    const admins = users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length
    return {
      total,
      banned,
      active: total - banned,
      admins,
    }
  }, [users])

  const activeTableSortBy = useMemo(
    () => Object.keys(USER_TABLE_SORT_MAP).find((k) => USER_TABLE_SORT_MAP[k] === filters.sortBy) || null,
    [filters.sortBy],
  )

  const updateRole = async (id, role) => {
    setSavingId(id)
    setError('')
    try {
      await apiRequestBackend(`/api/admin/users/${id}`, { method: 'PATCH', body: { role } })
      await load()
      notify.success(t('admin.updated_role'))
    } catch (err) {
      const msg = err?.message || t('admin.update_role_fail')
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
        const reason = window.prompt(`${t('admin.ban_prompt_reason')} ${u.email}?`) || ''
        const ok = window.confirm(`${t('admin.ban_confirm')} ${u.email}?`)
        if (!ok) return
        await apiRequestBackend(`/api/admin/users/${u.id}/ban`, { method: 'POST', body: { reason } })
        notify.success(t('admin.user_banned'))
      } else {
        const ok = window.confirm(`${t('admin.unban_confirm')} ${u.email}?`)
        if (!ok) return
        await apiRequestBackend(`/api/admin/users/${u.id}/unban`, { method: 'POST' })
        notify.success(t('admin.user_unbanned'))
      }
      await load()
    } catch (err) {
      const msg = err?.message || t('admin.update_ban_fail')
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

  const userColumns = [
    {
      key: 'username',
      header: t('admin.table.username'),
      sortable: true,
      minWidth: 160,
      render: (u) => u.username,
    },
    {
      key: 'email',
      header: t('admin.table.email'),
      sortable: true,
      minWidth: 240,
      render: (u) => u.email,
    },
    {
      key: 'role',
      header: t('admin.table.role'),
      sortable: true,
      width: 150,
      minWidth: 140,
      render: (u) => (
        <span className={`admin-badge admin-badge--${String(u.role).toLowerCase()}`}>
          {u.role}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('admin.table.status'),
      sortable: true,
      width: 120,
      minWidth: 120,
      sortValue: (u) => (u.banned ? 1 : 0),
      render: (u) =>
        u.banned ? (
          <span className="admin-badge admin-badge--banned">{t('admin.status_banned_short')}</span>
        ) : (
          <span className="admin-badge admin-badge--active">{t('admin.status_active_short')}</span>
        ),
    },
    {
      key: 'actions',
      header: t('admin.table.actions'),
      sortable: false,
      minWidth: 360,
      width: 390,
      render: (u) => {
        const actorRole = me?.role
        const canBanThisUser =
          actorRole === 'SUPER_ADMIN' ? true : actorRole === 'ADMIN' ? u.role === 'USER' : false

        return (
          <div className="admin-row-actions">
            <select
              className="admin-role-select"
              style={{ maxWidth: 200 }}
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
                className="admin-btn admin-btn--primary admin-btn--sm"
                disabled={savingId === u.id || (pendingRoleById[u.id] ?? u.role) === u.role}
                onClick={() => confirmAndUpdateRole(u)}
              >
                {t('admin.apply')}
              </button>
            ) : null}
            {savingId === u.id ? <span className="admin-action-note">{t('admin.saving')}</span> : null}
            {canBanThisUser ? (
              <button
                type="button"
                className={`admin-btn admin-btn--sm ${u.banned ? 'admin-btn--success' : 'admin-btn--danger'}`}
                disabled={savingId === u.id}
                onClick={() => setBan(u, !u.banned)}
              >
                {u.banned ? t('admin.unban') : t('admin.ban')}
              </button>
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{t('admin.users')}</h1>
          <p className="admin-page-subtitle">{t('admin.role_policy')}</p>
        </div>
        <button className="admin-btn admin-btn--ghost" type="button" onClick={load} disabled={loading}>
          <i className="ti ti-refresh" />
          {t('admin.refresh')}
        </button>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon--blue">
            <i className="ti ti-users" />
          </div>
          <span className="admin-stat-label">{t('admin.total_users')}</span>
          <span className="admin-stat-value">{summary.total}</span>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon--green">
            <i className="ti ti-circle-check" />
          </div>
          <span className="admin-stat-label">{t('admin.active_users')}</span>
          <span className="admin-stat-value">{summary.active}</span>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon--amber">
            <i className="ti ti-user-star" />
          </div>
          <span className="admin-stat-label">{t('admin.admin_accounts')}</span>
          <span className="admin-stat-value">{summary.admins}</span>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-body">
          <div className="admin-filter-bar">
            <div className="admin-filter-group">
              <label className="admin-filter-label">{t('admin.search')}</label>
              <input
                className="admin-input admin-input--search"
                value={filters.q}
                placeholder={t('admin.search_placeholder')}
                onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
              />
            </div>

            <div className="admin-filter-group">
              <label className="admin-filter-label">{t('admin.filter_role')}</label>
              <select
                className="admin-select"
                value={filters.role}
                onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="">{t('admin.all')}</option>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
            </div>

            <div className="admin-filter-group">
              <label className="admin-filter-label">{t('admin.filter_status')}</label>
              <select
                className="admin-select"
                value={filters.banned}
                onChange={(e) => setFilters((prev) => ({ ...prev, banned: e.target.value }))}
              >
                <option value="">{t('admin.all')}</option>
                <option value="false">{t('admin.status_active')}</option>
                <option value="true">{t('admin.status_banned')}</option>
              </select>
            </div>

            <div className="admin-filter-group">
              <label className="admin-filter-label">{t('admin.sort_by')}</label>
              <select
                className="admin-select"
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

            <div className="admin-filter-group">
              <label className="admin-filter-label">{t('admin.sort_dir')}</label>
              <select
                className="admin-select"
                value={filters.sortDir}
                onChange={(e) => setFilters((prev) => ({ ...prev, sortDir: e.target.value }))}
              >
                <option value="desc">{t('admin.desc')}</option>
                <option value="asc">{t('admin.asc')}</option>
              </select>
            </div>

            <button
              type="button"
              className="admin-btn admin-btn--ghost"
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
              <i className="ti ti-filter-off" />
              {t('admin.clear')}
            </button>
          </div>

          <AdminDataTable
            columns={userColumns}
            rows={users}
            rowKey={(u) => u.id}
            loading={loading}
            error={error ? `${t('common.error')}: ${error}` : ''}
            emptyText={t('admin.no_users')}
            defaultPageSize={10}
            pageSizeOptions={[10, 20, 50]}
            manualSort
            sortBy={activeTableSortBy}
            sortDir={filters.sortDir}
            onSortChange={({ sortBy, sortDir }) => {
              const mapped = USER_TABLE_SORT_MAP[sortBy]
              if (!mapped) return
              setFilters((prev) => ({ ...prev, sortBy: mapped, sortDir }))
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default AdminUsersPage
