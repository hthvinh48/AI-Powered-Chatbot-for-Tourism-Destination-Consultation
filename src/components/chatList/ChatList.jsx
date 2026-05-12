import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import './chatList.css'
import { BACKEND_AUTH_CHANGED_EVENT, getBackendAuth } from '../../lib/backendAuth'
import { useI18n } from '../../lib/useI18n'
import { useCallback, useEffect, useState } from 'react'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../notifications/useNotify'
import TripPlanMessage from '../tripPlan/TripPlanMessage'
import { hasTripPlanJson } from '../../lib/tolerantJson'
import { emitTripPlansChanged } from '../../lib/tripPlanState'
import { CHATS_CHANGED_EVENT, emitChatsChanged } from '../../lib/chatState'
import useActionDialog from '../dialogs/useActionDialog'

const ChatList = () => {
  const { t } = useI18n()
  const notify = useNotify()
  const navigate = useNavigate()
  const location = useLocation()
  const role = getBackendAuth()?.user?.role
  const canSeeAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'
  const { askConfirm, dialogNode } = useActionDialog()

  const [items, setItems] = useState([])
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [savedOpen, setSavedOpen] = useState(false)
  const [savedPlans, setSavedPlans] = useState([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [savedError, setSavedError] = useState('')

  const { id } = useParams()
  const activeChatId = Number(id)
  const isExploreRoute = location.pathname === '/explore'
  const isContactRoute = location.pathname === '/contact'
  const isBillingRoute = location.pathname === '/billing'
  const isTripMapRoute = location.pathname === '/dashboard/trip-map'
  const isNewChatRoute = location.pathname === '/dashboard'

  const load = useCallback(async () => {
    const res = await apiRequestBackend('/api/chat')
    setItems(res?.items || [])
  }, [])

  const loadSaved = async () => {
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
  }

  const deleteSavedPlan = async (plan) => {
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
  }

  useEffect(() => {
    let active = true
    load().catch(() => {
      if (!active) return
      setItems([])
    })
    return () => {
      active = false
    }
  }, [load, location.pathname, location.search])

  useEffect(() => {
    const onChatsChanged = () => {
      load().catch(() => setItems([]))
    }
    window.addEventListener(CHATS_CHANGED_EVENT, onChatsChanged)
    return () => window.removeEventListener(CHATS_CHANGED_EVENT, onChatsChanged)
  }, [load])

  useEffect(() => {
    const onBackendAuthChanged = () => {
      load().catch(() => setItems([]))
    }
    window.addEventListener(BACKEND_AUTH_CHANGED_EVENT, onBackendAuthChanged)
    return () => window.removeEventListener(BACKEND_AUTH_CHANGED_EVENT, onBackendAuthChanged)
  }, [load])

  const createChat = async () => {
    try {
      navigate('/dashboard?new=1')
    } catch (err) {
      notify.error(err?.message || t('prompt.request_failed'))
    }
  }

  const deleteChat = async (chatId) => {
    const ok = await askConfirm({
      title: t('common.confirm'),
      message: t('chat.delete_chat_confirm'),
      confirmText: t('chat.delete_saved'),
      tone: 'danger',
      confirmVariant: 'danger',
    })
    if (!ok) return
    try {
      await apiRequestBackend(`/api/chat/${chatId}`, { method: 'DELETE' })
      await load()
      emitChatsChanged({ type: 'deleted', chatId })
      if (location.pathname === `/dashboard/chats/${chatId}`) {
        navigate('/dashboard')
      }
      notify.success(t('chat.delete_chat_success'))
    } catch (err) {
      notify.error(err?.message || t('chat.delete_chat_fail'))
    }
  }

  return (
    <div className="chatList">
      <div className="chatListScroll">
        <div className="chatListSection">
          <span className="chatListTitle">{t('menu.dashboard')}</span>
          <button
            type="button"
            className={`chatListActionBtn chatListActionBtn--primary ${isNewChatRoute ? 'active' : ''}`}
            onClick={createChat}
          >
            <i className="ti ti-plus" />
            {t('menu.create_chat')}
          </button>
          <button
            type="button"
            className="chatListActionBtn"
            onClick={() => setJsonDialogOpen(true)}
          >
            <i className="ti ti-brackets" />
            {t('chat.json_preview')}
          </button>
          <button
            type="button"
            className="chatListActionBtn"
            onClick={async () => {
              setSavedOpen(true)
              await loadSaved()
            }}
          >
            <i className="ti ti-bookmarks" />
            {t('trip.saved_plans')}
          </button>
          <Link className={`chatListActionBtn chatListActionBtn--map ${isTripMapRoute ? 'active' : ''}`} to="/dashboard/trip-map">
            <i className="ti ti-map-2" />
            {t('menu.trip_map')}
          </Link>
        </div>

        <div className="chatListDivider" />

        <div className="chatListSection">
          <span className="chatListTitle">{t('menu.recents')}</span>
          <div className="chatListItems">
            {(items || []).map((c) => (
              <div className={`chatListRow ${c.id === activeChatId ? 'active' : ''}`} key={c.id}>
                <Link className="chatListRowLink" to={`/dashboard/chats/${c.id}`}>
                  {c.title || `Chat #${c.id}`}
                </Link>
                <button
                  type="button"
                  className="chatListDelete"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    deleteChat(c.id)
                  }}
                  title={t('chat.delete_chat_confirm')}
                  aria-label={t('chat.delete_chat_confirm')}
                >
                  <i className="ti ti-trash" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="chatListDivider" />

        <div className="chatListSection chatListSection--links">
          {canSeeAdmin ? (
            <Link className="chatListNavLink" to="/admin">
              <i className="ti ti-settings" />
              {t('menu.admin')}
            </Link>
          ) : null}
          <Link className={`chatListNavLink ${isExploreRoute ? 'active' : ''}`} to="/explore">
            <i className="ti ti-compass" />
            {t('menu.explore')}
          </Link>
          <Link className={`chatListNavLink ${isBillingRoute ? 'active' : ''}`} to="/billing">
            <i className="ti ti-credit-card" />
            {t('menu.billing')}
          </Link>
          <Link className={`chatListNavLink ${isContactRoute ? 'active' : ''}`} to="/contact">
            <i className="ti ti-address-book" />
            {t('menu.contact')}
          </Link>
        </div>
      </div>

      {jsonDialogOpen ? (
        <div className="chatOverlay" role="dialog" aria-modal="true" onClick={() => setJsonDialogOpen(false)}>
          <div className="chatModal" onClick={(e) => e.stopPropagation()}>
            <div className="chatModalTop">
              <div className="chatModalTitle">{t('chat.json_preview')}</div>
              <button
                type="button"
                className="chatModalIconBtn"
                onClick={() => setJsonDialogOpen(false)}
                aria-label={t('common.close')}
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <textarea
              className="chatModalTextarea"
              placeholder={t('chat.json_placeholder')}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={10}
            />
            <div className="chatModalHint">{t('chat.json_hint')}</div>
            {jsonText.trim() && !hasTripPlanJson(jsonText) ? (
              <div className="chatModalHint">{t('chat.json_invalid')}</div>
            ) : null}
            {jsonText.trim() && hasTripPlanJson(jsonText) ? (
              <div className="chatModalPreview">
                <TripPlanMessage chatId={Number.NaN} content={jsonText} allowSave={false} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {savedOpen ? (
        <div className="chatOverlay" role="dialog" aria-modal="true" onClick={() => setSavedOpen(false)}>
          <div className="chatModal" onClick={(e) => e.stopPropagation()}>
            <div className="chatModalTop">
              <div className="chatModalTitle">{t('trip.saved_plans')}</div>
              <div className="chatModalActions">
                <button
                  type="button"
                  className="chatModalBtn"
                  onClick={loadSaved}
                  disabled={savedLoading}
                >
                  {savedLoading ? t('trip.loading') : t('trip.refresh')}
                </button>
                <button
                  type="button"
                  className="chatModalIconBtn"
                  onClick={() => setSavedOpen(false)}
                  aria-label={t('common.close')}
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            </div>

            {savedError ? <div className="chatModalHint">{t('common.error')}: {savedError}</div> : null}
            {!savedLoading && savedPlans.length === 0 ? (
              <div className="chatModalHint">{t('trip.no_saved')}</div>
            ) : null}

            <div className="chatModalPreview">
              {(savedPlans || []).map((p) => {
                const wrapper = p?.data && typeof p.data === 'object' ? p.data : null
                const content = wrapper ? JSON.stringify(wrapper) : ''
                return (
                  <div key={p.id} className="savedPlanCard">
                    <div className="savedPlanTop">
                      <button
                        type="button"
                        className="savedPlanLink"
                        onClick={() => {
                          setSavedOpen(false)
                          navigate(`/dashboard/chats/${p.chatId}`)
                        }}
                      >
                        {p?.title || `${t('trip.trip_fallback')} #${p.id}`}
                      </button>
                      <button
                        type="button"
                        className="savedPlanDelete"
                        onClick={() => deleteSavedPlan(p)}
                      >
                        <i className="ti ti-trash" />
                        {t('chat.delete_saved')}
                      </button>
                    </div>
                    {content ? (
                      <TripPlanMessage chatId={Number.NaN} content={content} allowSave={false} />
                    ) : (
                      <div className="chatModalHint">{t('trip.saved_corrupt')}</div>
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

export default ChatList
