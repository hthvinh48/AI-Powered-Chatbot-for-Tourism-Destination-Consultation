import { useEffect, useState } from 'react'
import { apiRequestBackend } from '../../lib/apiClient'
import { useI18n } from '../../lib/useI18n'

const AdminTokensPage = () => {
  const { t } = useI18n()
  const [stats, setStats] = useState({ totalTokens: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiRequestBackend('/api/admin/stats/tokens')
      setStats(res || { totalTokens: 0, items: [] })
    } catch (err) {
      setError(err?.message || 'Failed to load token stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

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
          Tổng tokens (AIUsage): <b>{stats?.totalTokens || 0}</b>
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
