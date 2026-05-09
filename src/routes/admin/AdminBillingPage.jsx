import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequestBackend } from '../../lib/apiClient'
import { useI18n } from '../../lib/useI18n'
import { useNotify } from '../../components/notifications/useNotify'

function monthToInputValue(d) {
  const dt = d instanceof Date ? d : new Date()
  if (!Number.isFinite(dt.getTime())) return ''
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatNumber(value, lang) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(Math.trunc(n))
}

function formatMoney(amount, currency, lang) {
  const n = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(n)) return '-'
  const formatted = new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(n)
  return currency ? `${formatted} ${currency}` : formatted
}

const AdminBillingPage = () => {
  const { t, lang } = useI18n()
  const notify = useNotify()

  const [freeTokens, setFreeTokens] = useState(100000)
  const [savingFree, setSavingFree] = useState(false)

  const [month, setMonth] = useState(monthToInputValue(new Date()))
  const [q, setQ] = useState('')
  const [sortBy, setSortBy] = useState('used')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [invoiceMonth, setInvoiceMonth] = useState(monthToInputValue(new Date()))
  const [invoiceQ, setInvoiceQ] = useState('')
  const [invoicePage, setInvoicePage] = useState(1)
  const [invoiceTotal, setInvoiceTotal] = useState(0)
  const [invoiceItems, setInvoiceItems] = useState([])
  const [invoiceLoading, setInvoiceLoading] = useState(true)
  const [invoiceError, setInvoiceError] = useState('')

  const limit = 10
  const maxPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / limit)), [total])
  const invoiceMaxPages = useMemo(() => Math.max(1, Math.ceil((invoiceTotal || 0) / limit)), [invoiceTotal])

  const loadSetting = useCallback(async () => {
    const res = await apiRequestBackend('/api/admin/billing/free-tokens')
    if (res?.freeTokensPerMonth != null) setFreeTokens(Number(res.freeTokensPerMonth) || 0)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (month) params.set('month', month)
      if (q) params.set('q', q)
      params.set('sortBy', sortBy)
      params.set('sortDir', sortDir)
      params.set('page', String(page))
      params.set('limit', String(limit))
      const res = await apiRequestBackend(`/api/admin/billing/monthly?${params.toString()}`)
      setItems(Array.isArray(res?.items) ? res.items : [])
      setTotal(Number(res?.total) || 0)
    } catch (err) {
      setError(err?.message || t('admin.load_fail'))
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [month, page, q, sortBy, sortDir, t])

  useEffect(() => {
    loadSetting().catch(() => {})
  }, [loadSetting])

  useEffect(() => {
    load()
  }, [load])

  const loadInvoices = useCallback(async () => {
    setInvoiceLoading(true)
    setInvoiceError('')
    try {
      const params = new URLSearchParams()
      if (invoiceMonth) params.set('month', invoiceMonth)
      if (invoiceQ) params.set('q', invoiceQ)
      params.set('page', String(invoicePage))
      params.set('limit', String(limit))
      const res = await apiRequestBackend(`/api/admin/billing/invoices?${params.toString()}`)
      setInvoiceItems(Array.isArray(res?.items) ? res.items : [])
      setInvoiceTotal(Number(res?.total) || 0)
    } catch (err) {
      setInvoiceError(err?.message || t('admin.load_fail'))
      setInvoiceItems([])
      setInvoiceTotal(0)
    } finally {
      setInvoiceLoading(false)
    }
  }, [invoiceMonth, invoicePage, invoiceQ, t])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const saveFree = async () => {
    if (savingFree) return
    const n = Number.parseInt(String(freeTokens || ''), 10)
    if (!Number.isFinite(n) || n < 0) {
      notify.error(t('admin.billing.invalid_free'))
      return
    }
    setSavingFree(true)
    try {
      const res = await apiRequestBackend('/api/admin/billing/free-tokens', {
        method: 'PATCH',
        body: { freeTokensPerMonth: n },
      })
      setFreeTokens(Number(res?.freeTokensPerMonth) || n)
      notify.success(t('admin.billing.saved_free'))
      await load()
    } catch (err) {
      notify.error(err?.message || t('admin.billing.save_free_fail'))
    } finally {
      setSavingFree(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{t('admin.billing.title')}</h1>
          <p className="admin-page-subtitle">{t('admin.billing.subtitle')}</p>
        </div>
      </div>

      <div className="admin-card admin-card--padded">
        <div className="admin-card-head">
          <h3>{t('admin.billing.free_title')}</h3>
        </div>
        <div className="admin-form-row">
          <label className="admin-label">
            {t('admin.billing.free_label')}
            <input
              className="admin-input"
              value={String(freeTokens)}
              onChange={(e) => setFreeTokens(e.target.value)}
              style={{ maxWidth: 220 }}
            />
          </label>
          <button className="admin-btn" type="button" onClick={saveFree} disabled={savingFree}>
            {savingFree ? t('admin.saving') : t('admin.apply')}
          </button>
        </div>
      </div>

      <div className="admin-card admin-card--padded" style={{ marginTop: 12 }}>
        <div className="admin-card-head">
          <h3>{t('admin.billing.monthly_title')}</h3>
        </div>

        <div className="admin-filters">
          <label className="admin-label">
            {t('admin.billing.month')}
            <input className="admin-input" type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1) }} />
          </label>
          <label className="admin-label">
            {t('admin.search')}
            <input className="admin-input" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder={t('admin.search_placeholder')} />
          </label>
          <label className="admin-label">
            {t('admin.sort_by')}
            <select className="admin-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="used">{t('admin.billing.col.used')}</option>
              <option value="purchased">{t('admin.billing.col.purchased')}</option>
              <option value="remaining">{t('admin.billing.col.remaining')}</option>
              <option value="email">{t('admin.sort.email')}</option>
              <option value="username">{t('admin.sort.username')}</option>
            </select>
          </label>
          <label className="admin-label">
            {t('admin.sort_dir')}
            <select className="admin-input" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
              <option value="desc">{t('admin.desc')}</option>
              <option value="asc">{t('admin.asc')}</option>
            </select>
          </label>
          <button className="admin-btn admin-btn--ghost" type="button" onClick={load}>
            {t('admin.refresh')}
          </button>
        </div>

        {error ? <div className="admin-error">{error}</div> : null}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.table.email')}</th>
                <th>{t('admin.table.username')}</th>
                <th>{t('admin.billing.col.free')}</th>
                <th>{t('admin.billing.col.purchased')}</th>
                <th>{t('admin.billing.col.used')}</th>
                <th>{t('admin.billing.col.remaining')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="admin-empty">{t('trip.loading')}</td>
                </tr>
              ) : null}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-empty">{t('admin.no_data')}</td>
                </tr>
              ) : null}
              {items.map((x) => (
                <tr key={x.userId}>
                  <td>{x.email}</td>
                  <td>{x.username}</td>
                  <td>{formatNumber(x.freeTokens, lang)}</td>
                  <td>{formatNumber(x.purchasedTokens, lang)}</td>
                  <td>{formatNumber(x.usedTokens, lang)}</td>
                  <td>{formatNumber(x.remainingTokens, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-pager">
          <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <i className="ti ti-chevron-left" /> {t('chat.prev_page')}
          </button>
          <div className="admin-pager-text">{t('chat.page')} {page}/{maxPages}</div>
          <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setPage((p) => Math.min(maxPages, p + 1))} disabled={page >= maxPages}>
            {t('chat.next_page')} <i className="ti ti-chevron-right" />
          </button>
        </div>
      </div>

      <div className="admin-card admin-card--padded" style={{ marginTop: 12 }}>
        <div className="admin-card-head">
          <h3>{t('billing.invoices')}</h3>
        </div>

        <div className="admin-filters">
          <label className="admin-label">
            {t('admin.billing.month')}
            <input
              className="admin-input"
              type="month"
              value={invoiceMonth}
              onChange={(e) => {
                setInvoiceMonth(e.target.value)
                setInvoicePage(1)
              }}
            />
          </label>
          <label className="admin-label">
            {t('admin.search')}
            <input
              className="admin-input"
              value={invoiceQ}
              onChange={(e) => {
                setInvoiceQ(e.target.value)
                setInvoicePage(1)
              }}
              placeholder={t('admin.search_placeholder')}
            />
          </label>
          <button className="admin-btn admin-btn--ghost" type="button" onClick={loadInvoices}>
            {t('admin.refresh')}
          </button>
        </div>

        {invoiceError ? <div className="admin-error">{invoiceError}</div> : null}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('billing.col.invoice')}</th>
                <th>{t('admin.table.email')}</th>
                <th>{t('billing.col.tokens')}</th>
                <th>{t('billing.col.amount')}</th>
                <th>{t('billing.col.status')}</th>
                <th>{t('billing.col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {invoiceLoading ? (
                <tr>
                  <td colSpan={6} className="admin-empty">{t('trip.loading')}</td>
                </tr>
              ) : null}
              {!invoiceLoading && invoiceItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-empty">{t('admin.no_data')}</td>
                </tr>
              ) : null}
              {invoiceItems.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.number}</td>
                  <td>{inv.user?.email || '-'}</td>
                  <td>{formatNumber(inv.tokens, lang)}</td>
                  <td>{inv.amount != null ? formatMoney(inv.amount, inv.currency, lang) : '-'}</td>
                  <td>{inv.status || '-'}</td>
                  <td>{inv.issuedAt ? new Date(inv.issuedAt).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-pager">
          <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setInvoicePage((p) => Math.max(1, p - 1))} disabled={invoicePage <= 1}>
            <i className="ti ti-chevron-left" /> {t('chat.prev_page')}
          </button>
          <div className="admin-pager-text">{t('chat.page')} {invoicePage}/{invoiceMaxPages}</div>
          <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setInvoicePage((p) => Math.min(invoiceMaxPages, p + 1))} disabled={invoicePage >= invoiceMaxPages}>
            {t('chat.next_page')} <i className="ti ti-chevron-right" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminBillingPage
