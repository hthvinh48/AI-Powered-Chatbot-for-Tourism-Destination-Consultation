import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequestBackend } from '../../lib/apiClient'
import { useI18n } from '../../lib/useI18n'
import AdminDataTable from './AdminDataTable.jsx'

const TOKEN_TABLE_SORT_MAP = {
  username: 'username',
  email: 'email',
  tokens: 'tokens',
}

const AdminTokensPage = () => {
  const { t } = useI18n()
  const [stats, setStats] = useState({ totalTokens: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    q: '',
    sortBy: 'tokens',
    sortDir: 'desc',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filters.q) params.set('q', filters.q)
      if (filters.sortBy) params.set('sortBy', filters.sortBy)
      if (filters.sortDir) params.set('sortDir', filters.sortDir)
      const qs = params.toString()
      const res = await apiRequestBackend(`/api/admin/stats/tokens${qs ? `?${qs}` : ''}`)
      setStats(res || { totalTokens: 0, items: [] })
    } catch (err) {
      setError(err?.message || t('admin.load_tokens_fail'))
    } finally {
      setLoading(false)
    }
  }, [filters.q, filters.sortBy, filters.sortDir, t])

  useEffect(() => {
    load()
  }, [load])

  const summary = useMemo(() => {
    const items = stats?.items || []
    const userCount = items.length
    const total = stats?.totalTokens || 0
    const avg = userCount ? Math.round(total / userCount) : 0
    const max = items.reduce((acc, x) => Math.max(acc, x.tokens || 0), 0)
    return { userCount, total, avg, max }
  }, [stats])

  const activeTableSortBy = useMemo(
    () => Object.keys(TOKEN_TABLE_SORT_MAP).find((k) => TOKEN_TABLE_SORT_MAP[k] === filters.sortBy) || null,
    [filters.sortBy],
  )

  const tokenColumns = useMemo(
    () => [
      {
        key: 'username',
        header: t('admin.table.username'),
        sortable: true,
        minWidth: 170,
        render: (x) => <span className="admin-token-user">{x.username || x.userId}</span>,
      },
      {
        key: 'email',
        header: t('admin.table.email'),
        sortable: true,
        minWidth: 240,
        render: (x) => x.email,
      },
      {
        key: 'tokens',
        header: t('admin.table.tokens'),
        sortable: true,
        minWidth: 120,
        width: 130,
        render: (x) => x.tokens,
      },
      {
        key: 'usage',
        header: t('admin.table.usage'),
        sortable: false,
        minWidth: 220,
        width: 240,
        render: (x) => {
          const percent = summary.max > 0 ? Math.round(((x.tokens || 0) / summary.max) * 100) : 0
          return (
            <div className="admin-token-bar-wrap">
              <div className="admin-token-bar-bg">
                <div className="admin-token-bar-fill" style={{ width: `${percent}%` }} />
              </div>
              <span className="admin-token-bar-num">{percent}%</span>
            </div>
          )
        },
      },
    ],
    [summary.max, t],
  )

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{t('admin.tokens')}</h1>
          <p className="admin-page-subtitle">{t('admin.total_tokens')}: <b>{summary.total}</b></p>
        </div>
        <button className="admin-btn admin-btn--ghost" type="button" onClick={load} disabled={loading}>
          <i className="ti ti-refresh" />
          {t('admin.refresh')}
        </button>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon--blue">
            <i className="ti ti-coins" />
          </div>
          <span className="admin-stat-label">{t('admin.total_tokens')}</span>
          <span className="admin-stat-value">{summary.total}</span>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon--green">
            <i className="ti ti-users-group" />
          </div>
          <span className="admin-stat-label">{t('admin.tracked_users')}</span>
          <span className="admin-stat-value">{summary.userCount}</span>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon--amber">
            <i className="ti ti-chart-bar" />
          </div>
          <span className="admin-stat-label">{t('admin.avg_per_user')}</span>
          <span className="admin-stat-value">{summary.avg}</span>
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
              <label className="admin-filter-label">{t('admin.sort_by')}</label>
              <select
                className="admin-select"
                value={filters.sortBy}
                onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
              >
                <option value="tokens">{t('admin.sort.tokens')}</option>
                <option value="email">{t('admin.sort.email')}</option>
                <option value="username">{t('admin.sort.username')}</option>
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
              onClick={() => setFilters({ q: '', sortBy: 'tokens', sortDir: 'desc' })}
            >
              <i className="ti ti-filter-off" />
              {t('admin.clear')}
            </button>
          </div>

          <AdminDataTable
            columns={tokenColumns}
            rows={stats?.items || []}
            rowKey={(x) => x.userId}
            loading={loading}
            error={error ? `${t('common.error')}: ${error}` : ''}
            emptyText={t('admin.no_data')}
            defaultPageSize={10}
            pageSizeOptions={[10, 20, 50]}
            manualSort
            sortBy={activeTableSortBy}
            sortDir={filters.sortDir}
            onSortChange={({ sortBy, sortDir }) => {
              const mapped = TOKEN_TABLE_SORT_MAP[sortBy]
              if (!mapped) return
              setFilters((prev) => ({ ...prev, sortBy: mapped, sortDir }))
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default AdminTokensPage
