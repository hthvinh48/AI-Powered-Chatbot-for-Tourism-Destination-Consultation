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

function parseMonthValue(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/)
  if (match) {
    return { year: match[1], month: match[2] }
  }
  const fallback = monthToInputValue(new Date())
  const [year, month] = fallback.split('-')
  return { year, month }
}

function buildMonthValue(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

const CURRENT_YEAR = new Date().getFullYear()
const BILLING_YEARS = Array.from({ length: 7 }, (_, index) => String(CURRENT_YEAR - 3 + index))
const BILLING_MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))

const AdminMonthPicker = ({ value, onChange, lang }) => {
  const { year, month } = parseMonthValue(value)
  const monthFormatter = new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'short' })

  const onYearChange = (nextYear) => onChange(buildMonthValue(nextYear, month))
  const onMonthChange = (nextMonth) => onChange(buildMonthValue(year, nextMonth))

  return (
    <div className="admin-billing-month-picker">
      <select className="admin-select admin-billing-input" value={month} onChange={(e) => onMonthChange(e.target.value)}>
        {BILLING_MONTHS.map((m) => (
          <option key={m} value={m}>
            {monthFormatter.format(new Date(Number(year), Number(m) - 1, 1))}
          </option>
        ))}
      </select>
      <select className="admin-select admin-billing-input" value={year} onChange={(e) => onYearChange(e.target.value)}>
        {BILLING_YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
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

function formatDateTime(value, lang) {
  if (!value) return '-'
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return '-'
  return d.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusClass(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'paid' || value === 'active') return 'admin-billing-status--paid'
  if (value === 'pending') return 'admin-billing-status--pending'
  if (value === 'failed' || value === 'refunded') return 'admin-billing-status--failed'
  return ''
}

const AdminBillingPage = () => {
  const { t, lang } = useI18n()
  const notify = useNotify()

  const [freeTokens, setFreeTokens] = useState(100000)
  const [savingFree, setSavingFree] = useState(false)

  const [invoiceMonth, setInvoiceMonth] = useState(monthToInputValue(new Date()))
  const [invoiceQ, setInvoiceQ] = useState('')
  const [invoicePage, setInvoicePage] = useState(1)
  const [invoiceTotal, setInvoiceTotal] = useState(0)
  const [invoiceItems, setInvoiceItems] = useState([])
  const [invoiceLoading, setInvoiceLoading] = useState(true)
  const [invoiceError, setInvoiceError] = useState('')

  const limit = 10
  const invoiceMaxPages = useMemo(() => Math.max(1, Math.ceil((invoiceTotal || 0) / limit)), [invoiceTotal])

  const loadSetting = useCallback(async () => {
    const res = await apiRequestBackend('/api/admin/billing/free-tokens')
    if (res?.freeTokensPerMonth != null) setFreeTokens(Number(res.freeTokensPerMonth) || 0)
  }, [])

  useEffect(() => {
    loadSetting().catch(() => {})
  }, [loadSetting])

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
    } catch (err) {
      notify.error(err?.message || t('admin.billing.save_free_fail'))
    } finally {
      setSavingFree(false)
    }
  }

  return (
    <div className="admin-page admin-billing-page">
      <div className="admin-page-header admin-billing-header">
        <div>
          <h1 className="admin-page-title">{t('admin.billing.title')}</h1>
          <p className="admin-page-subtitle">{t('admin.billing.subtitle')}</p>
        </div>
      </div>

      <section className="admin-billing-hero">
        <div className="admin-billing-hero-card admin-billing-hero-card--accent">
          <span>{t('admin.billing.free_title')}</span>
          <strong>{formatNumber(freeTokens, lang)}</strong>
          <small>{t('admin.billing.free_label')}</small>
        </div>
        <div className="admin-billing-hero-card">
          <span>{t('billing.invoices')}</span>
          <strong>{formatNumber(invoiceTotal, lang)}</strong>
          <small>{invoiceMonth}</small>
        </div>
      </section>

      <section className="admin-card admin-billing-card">
        <div className="admin-billing-card-head">
          <div>
            <h3>{t('admin.billing.free_title')}</h3>
            <p>{t('admin.billing.subtitle')}</p>
          </div>
        </div>
        <div className="admin-billing-quota-row">
          <label className="admin-billing-field admin-billing-field--quota">
            <span>{t('admin.billing.free_label')}</span>
            <input
              className="admin-input admin-billing-input"
              value={String(freeTokens)}
              onChange={(e) => setFreeTokens(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <button className="admin-btn admin-btn--primary admin-billing-apply" type="button" onClick={saveFree} disabled={savingFree}>
            <i className="ti ti-device-floppy" />
            {savingFree ? t('admin.saving') : t('admin.apply')}
          </button>
        </div>
      </section>

      <section className="admin-card admin-billing-card">
        <div className="admin-billing-card-head">
          <div>
            <h3>{t('billing.invoices')}</h3>
            <p>{t('admin.billing.month')} {invoiceMonth}</p>
          </div>
          <button className="admin-btn admin-btn--ghost" type="button" onClick={loadInvoices} disabled={invoiceLoading}>
            <i className="ti ti-refresh" />
            {t('admin.refresh')}
          </button>
        </div>

        <div className="admin-billing-filters">
          <label className="admin-billing-field">
            <span>{t('admin.billing.month')}</span>
            <AdminMonthPicker
              value={invoiceMonth}
              lang={lang}
              onChange={(nextMonth) => {
                setInvoiceMonth(nextMonth)
                setInvoicePage(1)
              }}
            />
          </label>
          <label className="admin-billing-field admin-billing-field--search">
            <span>{t('admin.search')}</span>
            <input
              className="admin-input admin-billing-input"
              value={invoiceQ}
              onChange={(e) => {
                setInvoiceQ(e.target.value)
                setInvoicePage(1)
              }}
              placeholder={t('admin.search_placeholder')}
            />
          </label>
        </div>

        {invoiceError ? (
          <div className="admin-billing-alert">
            <i className="ti ti-alert-circle" />
            <span>{invoiceError}</span>
          </div>
        ) : null}

        <div className="admin-billing-table-wrap">
          <table className="admin-table admin-billing-table">
            <thead>
              <tr>
                <th>{t('admin.table.email')}</th>
                <th>{t('billing.col.transactionNo')}</th>
                <th>{t('billing.col.invoiceNo')}</th>
                <th>{t('billing.col.description')}</th>
                <th>{t('billing.col.tokens')}</th>
                <th>{t('billing.col.amount')}</th>
                <th>{t('billing.col.status')}</th>
                <th>{t('billing.col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {invoiceLoading ? (
                <tr>
                  <td colSpan={8} className="admin-empty">{t('trip.loading')}</td>
                </tr>
              ) : null}
              {!invoiceLoading && invoiceItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-empty">{t('admin.no_data')}</td>
                </tr>
              ) : null}
              {invoiceItems.map((inv) => (
                <tr key={inv.id}>
                  <td><span className="admin-billing-strong">{inv.user?.email || '-'}</span></td>
                  <td>{inv.transactionNo || '-'}</td>
                  <td>{inv.invoiceNo || '-'}</td>
                  <td>{inv.description || '-'}</td>
                  <td>{formatNumber(inv.tokens, lang)}</td>
                  <td>{inv.amount != null ? formatMoney(inv.amount, inv.currency, lang) : '-'}</td>
                  <td>
                    <span className={`admin-billing-status ${statusClass(inv.status)}`}>
                      {inv.status || '-'}
                    </span>
                  </td>
                  <td>{formatDateTime(inv.issuedAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-billing-pager">
          <span>{formatNumber(invoiceTotal, lang)} {t('billing.invoices')}</span>
          <div>
            <button className="admin-page-btn" type="button" onClick={() => setInvoicePage((p) => Math.max(1, p - 1))} disabled={invoicePage <= 1}>
              <i className="ti ti-chevron-left" />
            </button>
            <span className="admin-page-index">{invoicePage}/{invoiceMaxPages}</span>
            <button className="admin-page-btn" type="button" onClick={() => setInvoicePage((p) => Math.min(invoiceMaxPages, p + 1))} disabled={invoicePage >= invoiceMaxPages}>
              <i className="ti ti-chevron-right" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AdminBillingPage
