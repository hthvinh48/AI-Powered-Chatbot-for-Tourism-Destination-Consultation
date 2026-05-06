import './dashboardPage.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../lib/useI18n'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../../components/notifications/useNotify'
import TripPlanMessage from '../../components/tripPlan/TripPlanMessage'
import TypingIndicator from '../../components/typing/TypingIndicator'

const DashboardPage = () => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const notify = useNotify()
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const inputRef = useRef(null)
  const [savedOpen, setSavedOpen] = useState(false)
  const [savedPlans, setSavedPlans] = useState([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [savedError, setSavedError] = useState('')
  const [savedTotal, setSavedTotal] = useState(0)
  const [savedPage, setSavedPage] = useState(1)
  const SAVED_LIMIT = 10

  const formatSavedAt = (value) => {
    if (!value) return ''
    const dt = value instanceof Date ? value : new Date(value)
    if (!Number.isFinite(dt.getTime())) return ''
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(dt)
  }

  const loadSaved = useCallback(async (nextPage = 1) => {
    setSavedLoading(true)
    setSavedError('')
    try {
      const res = await apiRequestBackend(`/api/trip-plans?include=true&page=${nextPage}&limit=${SAVED_LIMIT}`)
      setSavedPlans(Array.isArray(res?.items) ? res.items : [])
      setSavedTotal(Number(res?.total) || 0)
      setSavedPage(Number(res?.page) || nextPage)
    } catch (err) {
      setSavedError(err?.message || t('trip.load_saved_fail'))
      setSavedPlans([])
      setSavedTotal(0)
    } finally {
      setSavedLoading(false)
    }
  }, [t])

  const deleteSavedPlan = useCallback(
    async (plan) => {
      const ok = window.confirm(t('chat.delete_saved_confirm'))
      if (!ok) return

      try {
        await apiRequestBackend(`/api/trip-plans/${plan.id}`, { method: 'DELETE' })
      } catch {
        try {
          await apiRequestBackend(`/api/chat/${plan.chatId}/trip-plans/${plan.id}`, { method: 'DELETE' })
        } catch (err) {
          notify.error(err?.message || t('chat.delete_saved_fail'))
          return
        }
      }

      setSavedPlans((prev) => prev.filter((x) => x.id !== plan.id))
      notify.success(t('chat.delete_saved_success'))
    },
    [notify, t],
  )

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      inputRef.current?.focus?.()
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    loadSaved(1)
  }, [loadSaved])

  const submit = async (e) => {
    e.preventDefault()
    if (pending) return
    const msg = text.trim()
    if (!msg) return
    try {
      setPending(true)
      const res = await apiRequestBackend('/api/chat/ask', { method: 'POST', body: { message: msg } })
      if (res?.chatId) navigate(`/dashboard/chats/${res.chatId}`)
      setText('')
    } catch (err) {
      notify.error(err?.message || t('prompt.request_failed'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="dashboardPage">
      <section className="dashboardHero">
        <div className="dashboardHeroCopy">
          <h1>{t('dashboard.hero_title')}</h1>
          <p>{t('dashboard.hero_text')}</p>
        </div>
        <button
          type="button"
          className="dashboardSavedBtn"
          onClick={() => setSavedOpen(true)}
          disabled={savedLoading}
        >
          <i className="ti ti-bookmarks" />
          {t('trip.saved_plans')} ({savedPlans.length})
        </button>
      </section>

      <section className="dashboardQuickActions">
        <button
          type="button"
          className="dashboardQuickAction"
          onClick={() => {
            setText(
              'origin: \n' +
              'destination: \n' +
              'duration: \n' +
              'budget: \n' +
              'group_size: \n' +
              'interests: \n' +
              'preferences: ',
            )
            setTimeout(() => inputRef.current?.focus?.(), 0)
          }}
        >
          <i className="ti ti-map-search" />
          <span>{t('dashboard.create_trip')}</span>
        </button>

        <button
          type="button"
          className="dashboardQuickAction"
          onClick={() => {
            setText(t('dashboard.suggest_prompt'))
            setTimeout(() => inputRef.current?.focus?.(), 0)
          }}
        >
          <i className="ti ti-bulb" />
          <span>{t('dashboard.inspire')}</span>
        </button>
      </section>

      <section className="dashboardComposer">
        <form onSubmit={submit}>
          <textarea
            autoComplete="off"
            name="text"
            placeholder={t('dashboard.ask_placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            ref={inputRef}
            rows={2}
            disabled={pending}
          />
          <button type="submit" aria-label={pending ? t('prompt.sending') : t('prompt.send')} disabled={pending}>
            <i className="ti ti-arrow-up" />
          </button>
        </form>
        {pending ? (
          <div className="dashboardTyping">
            <TypingIndicator labelKey="chat.thinking" />
          </div>
        ) : null}
      </section>

      {savedOpen ? (
        <div className="savedOverlay" role="dialog" aria-modal="true" onClick={() => setSavedOpen(false)}>
          <div className="savedModal" onClick={(e) => e.stopPropagation()}>
            <div className="savedTop">
              <div className="savedTitle">{t('trip.saved_plans')}</div>
              <div className="savedTopActions">
                <button type="button" className="savedBtn" onClick={loadSaved} disabled={savedLoading}>
                  {savedLoading ? t('trip.loading') : t('trip.refresh')}
                </button>
                <button type="button" className="savedBtn savedBtnIcon" onClick={() => setSavedOpen(false)} aria-label={t('common.close')}>
                  <i className="ti ti-x" />
                </button>
              </div>
            </div>

            {savedError ? <div className="savedHint">{t('common.error')}: {savedError}</div> : null}
            {!savedLoading && savedPlans.length === 0 ? (
              <div className="savedHint">{t('trip.no_saved')}</div>
            ) : null}

            {savedTotal > 0 ? (
              <div className="savedPager">
                <button
                  type="button"
                  className="savedBtn"
                  onClick={() => loadSaved(Math.max(1, savedPage - 1))}
                  disabled={savedLoading || savedPage <= 1}
                  aria-label={t('chat.prev_page')}
                  title={t('chat.prev_page')}
                >
                  ‹
                </button>
                <div className="savedPagerText">
                  {t('chat.page')} {savedPage}/{Math.max(1, Math.ceil(savedTotal / SAVED_LIMIT))}
                </div>
                <button
                  type="button"
                  className="savedBtn"
                  onClick={() => loadSaved(savedPage + 1)}
                  disabled={savedLoading || savedPage >= Math.max(1, Math.ceil(savedTotal / SAVED_LIMIT))}
                  aria-label={t('chat.next_page')}
                  title={t('chat.next_page')}
                >
                  ›
                </button>
              </div>
            ) : null}

            <div className="savedList">
              {savedPlans.map((p) => {
                const wrapper = p?.data && typeof p.data === 'object' ? p.data : null
                const content = wrapper ? JSON.stringify(wrapper) : ''
                return (
                  <div className="savedItem" key={p.id}>
                    <div className="savedItemTop">
                      <button
                        type="button"
                        className="savedItemTitle"
                        onClick={() => {
                          setSavedOpen(false)
                          navigate(`/dashboard/chats/${p.chatId}`)
                        }}
                      >
                        {p?.title || `${t('trip.trip_fallback')} #${p.id}`}
                      </button>
                      <div className="savedItemMeta">
                        {p?.createdAt ? <span className="savedItemDate">{formatSavedAt(p.createdAt)}</span> : null}
                        <button
                          type="button"
                          className="savedItemDelete"
                          onClick={() => deleteSavedPlan(p)}
                        >
                          <i className="ti ti-trash" />
                          {t('chat.delete_saved')}
                        </button>
                      </div>
                    </div>
                    {content ? (
                      <TripPlanMessage chatId={Number.NaN} content={content} allowSave={false} />
                    ) : (
                      <div className="savedHint">{t('trip.saved_corrupt')}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default DashboardPage
