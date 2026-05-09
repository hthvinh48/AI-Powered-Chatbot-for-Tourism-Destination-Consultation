import { useCallback, useEffect, useMemo, useState } from 'react'
import './billingPage.css'
import { apiRequestBackend } from '../../lib/apiClient'
import { useI18n } from '../../lib/useI18n'
import { useNotify } from '../../components/notifications/useNotify'
import { useSearchParams } from 'react-router-dom'

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

const BillingPage = () => {
  const { t, lang } = useI18n()
  const notify = useNotify()
  const [searchParams, setSearchParams] = useSearchParams()

  const [summary, setSummary] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(true)

  const [membership, setMembership] = useState(null)
  const [loadingMembership, setLoadingMembership] = useState(true)
  const [joining, setJoining] = useState(false)

  const [invoices, setInvoices] = useState([])
  const [invoicesTotal, setInvoicesTotal] = useState(0)
  const [invoicesPage, setInvoicesPage] = useState(1)
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [activeInvoice, setActiveInvoice] = useState(null)

  const INVOICE_LIMIT = 10
  const maxInvoicePages = useMemo(
    () => Math.max(1, Math.ceil((invoicesTotal || 0) / INVOICE_LIMIT)),
    [invoicesTotal],
  )

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      const res = await apiRequestBackend('/api/billing/summary')
      setSummary(res || null)
    } catch (err) {
      notify.error(err?.message || t('billing.load_fail'))
      setSummary(null)
    } finally {
      setLoadingSummary(false)
    }
  }, [notify, t])

  const loadMembership = useCallback(async () => {
    setLoadingMembership(true)
    try {
      const res = await apiRequestBackend('/api/billing/membership')
      setMembership(res?.active || null)
    } catch (err) {
      notify.error(err?.message || t('billing.load_fail'))
      setMembership(null)
    } finally {
      setLoadingMembership(false)
    }
  }, [notify, t])

  const loadInvoices = useCallback(
    async (page = 1) => {
      setLoadingInvoices(true)
      try {
        const res = await apiRequestBackend(`/api/billing/invoices?page=${page}&limit=${INVOICE_LIMIT}`)
        setInvoices(Array.isArray(res?.items) ? res.items : [])
        setInvoicesTotal(Number(res?.total) || 0)
        setInvoicesPage(Number(res?.page) || page)
      } catch (err) {
        notify.error(err?.message || t('billing.load_fail'))
        setInvoices([])
        setInvoicesTotal(0)
      } finally {
        setLoadingInvoices(false)
      }
    },
    [notify, t],
  )

  useEffect(() => {
    loadSummary()
    loadMembership()
    loadInvoices(1)
  }, [loadInvoices, loadMembership, loadSummary])

  useEffect(() => {
    const pay = searchParams.get('pay')
    if (!pay) return
    if (pay === 'success') notify.success(t('billing.pay_success'))
    if (pay === 'fail') notify.error(t('billing.pay_fail'))
    const next = new URLSearchParams(searchParams)
    next.delete('pay')
    setSearchParams(next, { replace: true })
  }, [notify, searchParams, setSearchParams, t])

  const joinMembership = async () => {
    if (joining) return
    setJoining(true)
    try {
      const res = await apiRequestBackend('/api/billing/membership/vnpay/create', {
        method: 'POST',
        body: {},
      })
      if (res?.paymentUrl) {
        window.location.href = res.paymentUrl
        return
      }
      notify.error(t('billing.pay_fail'))
    } catch (err) {
      notify.error(err?.message || t('billing.join_fail'))
    } finally {
      setJoining(false)
    }
  }

  const memberEndsAtText = membership?.endsAt ? new Date(membership.endsAt).toLocaleString() : ''

  return (
    <div className="billingPage">
      <header className="billingHeader">
        <div>
          <h1>{t('billing.title')}</h1>
          <p>{t('billing.subtitle')}</p>
        </div>
        {loadingMembership ? (
          <div className="billingBadge">{t('trip.loading')}</div>
        ) : membership ? (
          <div className="billingBadge" title={memberEndsAtText}>
            <i className="ti ti-crown" />
            {t('billing.member_active')}
          </div>
        ) : (
          <button type="button" className="billingBtn billingBtnPrimary" onClick={joinMembership} disabled={joining}>
            <i className="ti ti-crown" />
            {joining ? t('trip.loading') : t('billing.join')}
          </button>
        )}
      </header>

      <section className="billingGrid">
        <article className="billingCard">
          <div className="billingLabel">{t('billing.used_all')}</div>
          <div className="billingValue">{loadingSummary ? '…' : formatNumber(summary?.totalUsedTokens || 0, lang)}</div>
        </article>
        <article className="billingCard">
          <div className="billingLabel">{t('billing.used_30d')}</div>
          <div className="billingValue">{loadingSummary ? '…' : formatNumber(summary?.usedTokens30d || 0, lang)}</div>
        </article>
        <article className="billingCard">
          <div className="billingLabel">{t('billing.free_month')}</div>
          <div className="billingValue">{loadingSummary ? '…' : formatNumber(summary?.freeTokensPerMonth || 0, lang)}</div>
        </article>
        <article className="billingCard">
          <div className="billingLabel">{t('billing.used_month')}</div>
          <div className="billingValue">{loadingSummary ? '…' : formatNumber(summary?.month?.usedTokens || 0, lang)}</div>
        </article>
        <article className="billingCard">
          <div className="billingLabel">{t('billing.balance')}</div>
          <div className="billingValue">{loadingSummary ? '…' : formatNumber(summary?.month?.remainingTokens || 0, lang)}</div>
        </article>
      </section>

      <section className="billingSection">
        <div className="billingSectionTop">
          <h2>{t('billing.invoices')}</h2>
          <div className="billingPager">
            <button
              type="button"
              className="billingPagerBtn"
              onClick={() => loadInvoices(Math.max(1, invoicesPage - 1))}
              disabled={loadingInvoices || invoicesPage <= 1}
              aria-label={t('chat.prev_page')}
              title={t('chat.prev_page')}
            >
              <i className="ti ti-chevron-left" />
            </button>
            <div className="billingPagerText">
              {t('chat.page')} {invoicesPage}/{maxInvoicePages}
            </div>
            <button
              type="button"
              className="billingPagerBtn"
              onClick={() => loadInvoices(invoicesPage + 1)}
              disabled={loadingInvoices || invoicesPage >= maxInvoicePages}
              aria-label={t('chat.next_page')}
              title={t('chat.next_page')}
            >
              <i className="ti ti-chevron-right" />
            </button>
          </div>
        </div>

        <div className="billingTableWrap">
          <table className="billingTable">
            <thead>
              <tr>
                <th>{t('billing.col.invoice')}</th>
                <th>{t('billing.col.date')}</th>
                <th>{t('billing.col.amount')}</th>
                <th>{t('billing.col.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loadingInvoices ? (
                <tr>
                  <td colSpan={5} className="billingEmpty">
                    {t('trip.loading')}
                  </td>
                </tr>
              ) : null}
              {!loadingInvoices && invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="billingEmpty">
                    {t('billing.empty_invoices')}
                  </td>
                </tr>
              ) : null}
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.number || `#${inv.id}`}</td>
                  <td>{inv.issuedAt ? new Date(inv.issuedAt).toLocaleString() : '-'}</td>
                  <td>{inv.amount != null ? formatMoney(inv.amount, inv.currency, lang) : '-'}</td>
                  <td>{inv.status || '-'}</td>
                  <td className="billingActions">
                    <button
                      type="button"
                      className="billingIconBtn"
                      onClick={() => {
                        setActiveInvoice(inv)
                        setInvoiceOpen(true)
                      }}
                      title={t('billing.view_invoice')}
                    >
                      <i className="ti ti-receipt" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {invoiceOpen && activeInvoice ? (
        <div className="billingOverlay" role="dialog" aria-modal="true" onClick={() => setInvoiceOpen(false)}>
          <div className="billingModal" onClick={(e) => e.stopPropagation()}>
            <div className="billingModalTop">
              <div className="billingModalTitle">{t('billing.invoice')}</div>
              <button type="button" className="billingIconBtn" onClick={() => setInvoiceOpen(false)} aria-label={t('common.close')}>
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="billingInvoiceGrid">
              <div>
                <div className="billingLabel">{t('billing.col.invoice')}</div>
                <div className="billingValueSmall">{activeInvoice.number || `#${activeInvoice.id}`}</div>
              </div>
              <div>
                <div className="billingLabel">{t('billing.col.date')}</div>
                <div className="billingValueSmall">{activeInvoice.issuedAt ? new Date(activeInvoice.issuedAt).toLocaleString() : '-'}</div>
              </div>
              <div>
                <div className="billingLabel">{t('billing.col.amount')}</div>
                <div className="billingValueSmall">{activeInvoice.amount != null ? formatMoney(activeInvoice.amount, activeInvoice.currency, lang) : '-'}</div>
              </div>
              <div>
                <div className="billingLabel">{t('billing.col.status')}</div>
                <div className="billingValueSmall">{activeInvoice.status || '-'}</div>
              </div>
              <div>
                <div className="billingLabel">{t('billing.col.provider')}</div>
                <div className="billingValueSmall">{activeInvoice.provider || '-'}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default BillingPage
