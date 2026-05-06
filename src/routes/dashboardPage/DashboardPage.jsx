import './dashboardPage.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../lib/useI18n'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../../components/notifications/useNotify'
import TripPlanMessage from '../../components/tripPlan/TripPlanMessage'
import { emitTripPlansChanged } from '../../lib/tripPlanState'
import { emitChatsChanged } from '../../lib/chatState'
import { BACKEND_AUTH_CHANGED_EVENT } from '../../lib/backendAuth'
import useActionDialog from '../../components/dialogs/useActionDialog'
import { buildSmartAskPayload } from '../../lib/promptIntent'

function parseDateOrNull(value) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

function getEntityTime(entity) {
  if (!entity || typeof entity !== 'object') return null
  return (
    parseDateOrNull(entity.updatedAt) ??
    parseDateOrNull(entity.createdAt) ??
    parseDateOrNull(entity.savedAt) ??
    parseDateOrNull(entity.timestamp)
  )
}

function formatRelativeTime(time, lang) {
  if (!time) return '-'
  const diffMs = time - Date.now()
  const diffMinutes = Math.round(diffMs / 60000)
  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { numeric: 'auto' })
      .format(diffMinutes, 'minute')
  }

  const diffHours = Math.round(diffMs / (60 * 60000))
  if (Math.abs(diffHours) < 24) {
    return new Intl.RelativeTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { numeric: 'auto' })
      .format(diffHours, 'hour')
  }

  const diffDays = Math.round(diffMs / (24 * 60 * 60000))
  if (Math.abs(diffDays) < 8) {
    return new Intl.RelativeTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { numeric: 'auto' })
      .format(diffDays, 'day')
  }

  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(time))
}

const DashboardPage = () => {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const notify = useNotify()
  const { askConfirm, dialogNode } = useActionDialog()
  const [text, setText] = useState('')
  const inputRef = useRef(null)
  const mountedRef = useRef(true)
  const submitLockRef = useRef(false)
  const [composerPending, setComposerPending] = useState(false)
  const [chats, setChats] = useState([])
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState('')
  const [savedOpen, setSavedOpen] = useState(false)
  const [savedPlans, setSavedPlans] = useState([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [savedError, setSavedError] = useState('')

  const focusComposer = useCallback(() => {
    window.requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const pos = el.value.length
      el.setSelectionRange(pos, pos)
    })
  }, [])

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadSaved = useCallback(async () => {
    setSavedLoading(true)
    setSavedError('')
    try {
      const res = await apiRequestBackend('/api/trip-plans?include=true&limit=50')
      setSavedPlans(Array.isArray(res?.items) ? res.items : [])
    } catch (err) {
      setSavedError(err?.message || t('trip.load_saved_fail'))
      setSavedPlans([])
    } finally {
      setSavedLoading(false)
    }
  }, [t])

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true)
    setOverviewError('')
    try {
      const [chatRes, savedRes] = await Promise.all([
        apiRequestBackend('/api/chat'),
        apiRequestBackend('/api/trip-plans?include=true&limit=50'),
      ])
      setChats(Array.isArray(chatRes?.items) ? chatRes.items : [])
      setSavedPlans(Array.isArray(savedRes?.items) ? savedRes.items : [])
      setSavedError('')
    } catch (err) {
      const msg = err?.message || t('dashboard.load_overview_fail')
      setOverviewError(msg)
    } finally {
      setOverviewLoading(false)
    }
  }, [t])

  const deleteSavedPlan = useCallback(
    async (plan) => {
      const ok = await askConfirm({
        title: t('common.confirm'),
        message: t('chat.delete_saved_confirm'),
        confirmText: t('chat.delete_saved'),
        tone: 'danger',
        confirmVariant: 'danger',
      })
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
      emitTripPlansChanged({ type: 'deleted', chatId: Number(plan?.chatId), tripPlanId: plan.id })
      notify.success(t('chat.delete_saved_success'))
    },
    [askConfirm, notify, t],
  )

  useEffect(() => {
    const shouldFocus = searchParams.get('new') === '1'
    const prefill = searchParams.get('prefill')
    if (!shouldFocus && !prefill) return

    if (prefill) {
      setText(prefill)
    }
    focusComposer()

    const next = new URLSearchParams(searchParams)
    next.delete('new')
    next.delete('prefill')
    setSearchParams(next, { replace: true })
  }, [focusComposer, searchParams, setSearchParams])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    const onBackendAuthChanged = () => {
      loadOverview()
    }
    window.addEventListener(BACKEND_AUTH_CHANGED_EVENT, onBackendAuthChanged)
    return () => window.removeEventListener(BACKEND_AUTH_CHANGED_EVENT, onBackendAuthChanged)
  }, [loadOverview])

  const recentChats = useMemo(() => {
    const sorted = [...chats].sort((a, b) => (getEntityTime(b) || 0) - (getEntityTime(a) || 0))
    return sorted.slice(0, 6)
  }, [chats])

  const recentSavedPlans = useMemo(() => {
    const sorted = [...savedPlans].sort((a, b) => (getEntityTime(b) || 0) - (getEntityTime(a) || 0))
    return sorted.slice(0, 4)
  }, [savedPlans])

  const submit = async (e) => {
    e.preventDefault()
    if (composerPending || submitLockRef.current) return

    const msg = text.trim()
    if (!msg) return

    submitLockRef.current = true
    setComposerPending(true)
    try {
      const smartPayload = buildSmartAskPayload(msg, lang)
      const res = await apiRequestBackend('/api/chat/ask', { method: 'POST', body: smartPayload })
      if (res?.chatId) {
        emitChatsChanged({ type: 'created', chatId: Number(res.chatId), title: msg })
        navigate(`/dashboard/chats/${res.chatId}`)
        return
      }
      setText('')
    } catch (err) {
      notify.error(err?.message || t('prompt.request_failed'))
    } finally {
      submitLockRef.current = false
      if (mountedRef.current) {
        setComposerPending(false)
        focusComposer()
      }
    }
  }

  const handleComposerKeyDown = (e) => {
    if (e.key !== 'Enter') return
    if (e.shiftKey) return
    if (e.nativeEvent?.isComposing) return
    e.preventDefault()
    if (composerPending || submitLockRef.current) return
    e.currentTarget.form?.requestSubmit()
  }

  return (
    <div className="dashboardPage">
      <section className="dashboardHero">
        <div className="dashboardHeroCopy">
          <h1>{t('dashboard.hero_title')}</h1>
          <p>{t('dashboard.hero_text')}</p>
        </div>
        <div className="dashboardHeroActions">
          <button
            type="button"
            className="dashboardSavedBtn"
            onClick={loadOverview}
            disabled={overviewLoading}
          >
            <i className="ti ti-refresh" />
            {overviewLoading ? t('common.loading') : t('dashboard.refresh_overview')}
          </button>
          <button
            type="button"
            className="dashboardSavedBtn"
            onClick={() => setSavedOpen(true)}
            disabled={savedLoading}
          >
            <i className="ti ti-bookmarks" />
            {t('trip.saved_plans')} ({savedPlans.length})
          </button>
        </div>
      </section>

      {overviewError ? <div className="dashboardError">{t('common.error')}: {overviewError}</div> : null}

      <section className="dashboardStats">
        <article className="dashboardStatCard">
          <div className="dashboardStatIcon"><i className="ti ti-messages" /></div>
          <span className="dashboardStatLabel">{t('dashboard.stats.total_chats')}</span>
          <strong className="dashboardStatValue">{chats.length}</strong>
        </article>
        <article className="dashboardStatCard">
          <div className="dashboardStatIcon"><i className="ti ti-bookmarks" /></div>
          <span className="dashboardStatLabel">{t('dashboard.stats.saved_trips')}</span>
          <strong className="dashboardStatValue">{savedPlans.length}</strong>
        </article>
      </section>

      <section className="dashboardPanels">
        <article className="dashboardPanel">
          <div className="dashboardPanelTop">
            <h3>{t('dashboard.panel.recent_chats')}</h3>
          </div>
          <div className="dashboardPanelList">
            {recentChats.length === 0 ? (
              <p className="dashboardPanelEmpty">{t('dashboard.no_recent_chats')}</p>
            ) : (
              recentChats.map((chat) => (
                <button
                  type="button"
                  className="dashboardPanelItem"
                  key={chat.id}
                  onClick={() => navigate(`/dashboard/chats/${chat.id}`)}
                >
                  <div className="dashboardPanelItemTitle">{chat.title || `Chat #${chat.id}`}</div>
                  <div className="dashboardPanelItemMeta">{formatRelativeTime(getEntityTime(chat), lang)}</div>
                </button>
              ))
            )}
          </div>
        </article>

        <article className="dashboardPanel">
          <div className="dashboardPanelTop">
            <h3>{t('dashboard.panel.saved_preview')}</h3>
            <button type="button" className="dashboardMiniBtn" onClick={() => setSavedOpen(true)}>
              {t('dashboard.open')}
            </button>
          </div>
          <div className="dashboardPanelList">
            {recentSavedPlans.length === 0 ? (
              <p className="dashboardPanelEmpty">{t('dashboard.no_recent_saved')}</p>
            ) : (
              recentSavedPlans.map((plan) => (
                <button
                  type="button"
                  className="dashboardPanelItem"
                  key={plan.id}
                  onClick={() => navigate(`/dashboard/chats/${plan.chatId}`)}
                >
                  <div className="dashboardPanelItemTitle">{plan?.title || `${t('trip.trip_fallback')} #${plan.id}`}</div>
                  <div className="dashboardPanelItemMeta">{formatRelativeTime(getEntityTime(plan), lang)}</div>
                </button>
              ))
            )}
          </div>
        </article>
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
        <form className={composerPending ? 'is-pending' : ''} onSubmit={submit} aria-busy={composerPending}>
          <textarea
            autoComplete="off"
            name="text"
            placeholder={t('dashboard.ask_placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            ref={inputRef}
            rows={2}
            readOnly={composerPending}
          />
          <button
            type="submit"
            disabled={composerPending || !text.trim()}
            aria-label={composerPending ? t('prompt.sending') : t('prompt.send')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <i className={`ti ${composerPending ? 'ti-loader-2 dashboardComposerSpinner' : 'ti-arrow-up'}`} />
          </button>
        </form>
        {composerPending ? <div className="dashboardComposerStatus">{t('prompt.sending')}</div> : null}
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
                      <button
                        type="button"
                        className="savedItemDelete"
                        onClick={() => deleteSavedPlan(p)}
                      >
                        <i className="ti ti-trash" />
                        {t('chat.delete_saved')}
                      </button>
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

      {dialogNode}
    </div>
  )
}

export default DashboardPage
