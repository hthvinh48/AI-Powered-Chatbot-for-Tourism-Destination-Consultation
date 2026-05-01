import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequestBackend } from '../../lib/apiClient'
import { useI18n } from '../../lib/useI18n'
import AdminDataTable from './AdminDataTable.jsx'

const AdminOverviewPage = () => {
    const { t } = useI18n()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [users, setUsers] = useState([])
    const [tokenItems, setTokenItems] = useState([])
    const [totalTokens, setTotalTokens] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const [usersRes, tokenRes] = await Promise.all([
                apiRequestBackend('/api/admin/users?page=1&pageSize=8&sortBy=createdAt&sortDir=desc'),
                apiRequestBackend('/api/admin/stats/tokens?sortBy=tokens&sortDir=desc'),
            ])

            const userRows = Array.isArray(usersRes?.items) ? usersRes.items : []
            const tokenRows = Array.isArray(tokenRes?.items) ? tokenRes.items : []
            setUsers(userRows)
            setTokenItems(tokenRows.slice(0, 8))
            setTotalTokens(Number(tokenRes?.totalTokens || 0))
        } catch (err) {
            setError(err?.message || t('admin.load_overview_fail'))
            setUsers([])
            setTokenItems([])
            setTotalTokens(0)
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        load()
    }, [load])

    const summary = useMemo(() => {
        const totalUsers = users.length
        const bannedUsers = users.filter((u) => u.banned).length
        const activeUsers = totalUsers - bannedUsers
        const adminUsers = users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length
        const trackedUsers = tokenItems.length
        const avgToken = trackedUsers > 0 ? Math.round(totalTokens / trackedUsers) : 0
        return { totalUsers, activeUsers, bannedUsers, adminUsers, trackedUsers, avgToken }
    }, [users, tokenItems, totalTokens])

    const recentUserColumns = [
        {
            key: 'username',
            header: t('admin.table.username'),
            minWidth: 150,
            render: (u) => u.username || '-',
        },
        {
            key: 'email',
            header: t('admin.table.email'),
            minWidth: 220,
            render: (u) => u.email,
        },
        {
            key: 'role',
            header: t('admin.table.role'),
            width: 140,
            render: (u) => <span className={`admin-badge admin-badge--${String(u.role).toLowerCase()}`}>{u.role}</span>,
        },
        {
            key: 'status',
            header: t('admin.table.status'),
            width: 130,
            render: (u) =>
                u.banned ? (
                    <span className="admin-badge admin-badge--banned">{t('admin.status_banned_short')}</span>
                ) : (
                    <span className="admin-badge admin-badge--active">{t('admin.status_active_short')}</span>
                ),
        },
    ]

    const tokenColumns = [
        {
            key: 'username',
            header: t('admin.table.username'),
            minWidth: 150,
            render: (x) => x.username || x.userId,
        },
        {
            key: 'email',
            header: t('admin.table.email'),
            minWidth: 220,
            render: (x) => x.email,
        },
        {
            key: 'tokens',
            header: t('admin.table.tokens'),
            width: 130,
            render: (x) => x.tokens,
        },
    ]

    return (
        <div>
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">{t('admin.overview')}</h1>
                    <p className="admin-page-subtitle">{t('admin.overview_subtitle')}</p>
                </div>
                <button className="admin-btn admin-btn--ghost" type="button" onClick={load} disabled={loading}>
                    <i className="ti ti-refresh" />
                    {t('admin.refresh')}
                </button>
            </div>

            {error ? <div className="admin-inline-error admin-overview-error">{t('common.error')}: {error}</div> : null}

            <div className="admin-stat-grid">
                <div className="admin-stat-card">
                    <div className="admin-stat-icon admin-stat-icon--blue"><i className="ti ti-users" /></div>
                    <span className="admin-stat-label">{t('admin.total_users')}</span>
                    <span className="admin-stat-value">{summary.totalUsers}</span>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-icon admin-stat-icon--green"><i className="ti ti-circle-check" /></div>
                    <span className="admin-stat-label">{t('admin.active_users')}</span>
                    <span className="admin-stat-value">{summary.activeUsers}</span>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-icon admin-stat-icon--amber"><i className="ti ti-user-x" /></div>
                    <span className="admin-stat-label">{t('admin.banned_users')}</span>
                    <span className="admin-stat-value">{summary.bannedUsers}</span>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-icon admin-stat-icon--purple"><i className="ti ti-coins" /></div>
                    <span className="admin-stat-label">{t('admin.total_tokens')}</span>
                    <span className="admin-stat-value">{totalTokens}</span>
                </div>
            </div>

            <div className="admin-overview-actions">
                <Link to="/admin/map" className="admin-btn admin-btn--ghost">
                    <i className="ti ti-map-2" />
                    {t('admin.map.nav')}
                </Link>
                <Link to="/admin/users" className="admin-btn admin-btn--ghost">
                    <i className="ti ti-users" />
                    {t('admin.users')}
                </Link>
                <Link to="/admin/tokens" className="admin-btn admin-btn--ghost">
                    <i className="ti ti-coins" />
                    {t('admin.tokens')}
                </Link>
            </div>

            <div className="admin-overview-grid">
                <div className="admin-card">
                    <div className="admin-card-body">
                        <h3 className="admin-overview-title">{t('admin.recent_users')}</h3>
                        <AdminDataTable
                            columns={recentUserColumns}
                            rows={users}
                            rowKey={(u) => u.id}
                            loading={loading}
                            error=""
                            emptyText={t('admin.no_users')}
                            defaultPageSize={5}
                            pageSizeOptions={[5, 8]}
                        />
                    </div>
                </div>

                <div className="admin-card">
                    <div className="admin-card-body">
                        <h3 className="admin-overview-title">{t('admin.top_token_users')}</h3>
                        <AdminDataTable
                            columns={tokenColumns}
                            rows={tokenItems}
                            rowKey={(x) => x.userId}
                            loading={loading}
                            error=""
                            emptyText={t('admin.no_data')}
                            defaultPageSize={5}
                            pageSizeOptions={[5, 8]}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AdminOverviewPage
