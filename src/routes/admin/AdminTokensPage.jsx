import { useCallback, useEffect, useState } from 'react'
import { apiRequestBackend } from '../../lib/apiClient'
import { useI18n } from '../../lib/useI18n'

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
      setError(err?.message || 'Failed to load token stats')
    } finally {
      setLoading(false)
    }
  }, [filters.q, filters.sortBy, filters.sortDir])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="row g-3">
      <div className="col-12">
        <div className="d-flex align-items-center justify-content-between">
          <h3 className="mb-0">{t('admin.tokens')}</h3>
          <button className="btn btn-light btn-sm" type="button" onClick={load} disabled={loading}>
            {t('admin.refresh')}
          </button>
        </div>
        <div className="text-secondary small mt-1">
          {t('admin.total_tokens')}: <b>{stats?.totalTokens || 0}</b>
        </div>
      </div>

      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="row g-2 align-items-end mb-3">
              <div className="col-12 col-md-6">
                <label className="form-label small text-secondary mb-1">{t('admin.search')}</label>
                <input
                  className="form-control form-control-sm"
                  value={filters.q}
                  placeholder={t('admin.search_placeholder')}
                  onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
                />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small text-secondary mb-1">{t('admin.sort_by')}</label>
                <select
                  className="form-select form-select-sm"
                  value={filters.sortBy}
                  onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
                >
                  <option value="tokens">{t('admin.sort.tokens')}</option>
                  <option value="email">{t('admin.sort.email')}</option>
                  <option value="username">{t('admin.sort.username')}</option>
                </select>
              </div>
              <div className="col-6 col-md-3">
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
                  onClick={() => setFilters({ q: '', sortBy: 'tokens', sortDir: 'desc' })}
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
                      <th>Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.items || []).map((x) => (
                      <tr key={x.userId}>
                        <td>{x.username || x.userId}</td>
                        <td>{x.email}</td>
                        <td>{x.tokens}</td>
                      </tr>
                    ))}
                    {(stats?.items || []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-secondary">
                          No data yet
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

export default AdminTokensPage
