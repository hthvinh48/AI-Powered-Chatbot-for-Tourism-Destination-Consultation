import { Link, useLocation, useNavigate } from 'react-router-dom'
import './chatList.css'
import { getBackendAuth } from '../../lib/backendAuth'
import { useI18n } from '../../lib/useI18n'
import { useEffect, useState } from 'react'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../notifications/useNotify'
import TripPlanMessage from '../tripPlan/TripPlanMessage'
import { hasTripPlanJson } from '../../lib/tolerantJson'
import { useParams } from 'react-router-dom'

const ChatList = () => {
    const { t } = useI18n()
    const notify = useNotify()
    const navigate = useNavigate()
    const location = useLocation()
    const role = getBackendAuth()?.user?.role
    const canSeeAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'
    const [items, setItems] = useState([])
    const [jsonDialogOpen, setJsonDialogOpen] = useState(false)
    const [jsonText, setJsonText] = useState('')
    const [savedOpen, setSavedOpen] = useState(false)
    const [savedPlans, setSavedPlans] = useState([])
    const [savedLoading, setSavedLoading] = useState(false)
    const [savedError, setSavedError] = useState('')
    const { id } = useParams()
    const activeChatId = Number(id)

    const load = async () => {
        const res = await apiRequestBackend('/api/chat')
        setItems(res?.items || [])
    }

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

    useEffect(() => {
        let active = true
        load()
            .catch(() => {
                if (!active) return
                setItems([])
            })
        return () => {
            active = false
        }
    }, [])

    const createChat = async () => {
        try {
            // Don't create a chat record until the user actually sends the first message.
            navigate('/dashboard?new=1')
        } catch (err) {
            notify.error(err?.message || 'Failed to create chat')
        }
    }

    const deleteChat = async (chatId) => {
        const ok = window.confirm('Xóa cuộc chat này?')
        if (!ok) return
        try {
            await apiRequestBackend(`/api/chat/${chatId}`, { method: 'DELETE' })
            await load()
            if (location.pathname === `/dashboard/chats/${chatId}`) {
                navigate('/dashboard')
            }
            notify.success('Đã xóa cuộc chat.')
        } catch (err) {
            notify.error(err?.message || 'Xóa chat thất bại')
        }
    }

    return (
        <div className="chatList">
            <span className="title">{t('menu.dashboard')}</span>
            <button type="button" className="linkLike" onClick={createChat}>
                {t('menu.create_chat')}
            </button>
            <button
                type="button"
                className="linkLike"
                onClick={() => {
                    setJsonDialogOpen(true)
                }}
            >
                Test JSON (Preview)
            </button>
            <button
                type="button"
                className="linkLike"
                onClick={async () => {
                    setSavedOpen(true)
                    await loadSaved()
                }}
            >
                {t('trip.saved_plans')}
            </button>
            {canSeeAdmin ? <Link to="/admin">{t('menu.admin')}</Link> : null}
            <Link to="/explore">{t('menu.explore')}</Link>
            <Link to="/contact">{t('menu.contact')}</Link>
            <hr />
            <span className="title">{t('menu.recents')}</span>
            <div className="list">
                {(items || []).map((c) => (
                    <div
                        className={`chatRow ${c.id === activeChatId ? 'active' : ''}`}
                        key={c.id}
                    >
                        <Link className="chatRowLink" to={`/dashboard/chats/${c.id}`}>
                            {c.title || `Chat #${c.id}`}
                        </Link>

                        <button
                            type="button"
                            className="chatRowDelete"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                deleteChat(c.id)
                            }}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
            <hr />

            {jsonDialogOpen ? (
                <div className="jsonTestOverlay" role="dialog" aria-modal="true" onClick={() => setJsonDialogOpen(false)}>
                    <div className="jsonTestModal" onClick={(e) => e.stopPropagation()}>
                        <div className="jsonTestTop">
                            <div className="jsonTestTitle">Test JSON (không lưu)</div>
                            <button
                                type="button"
                                className="jsonTestClose"
                                onClick={() => setJsonDialogOpen(false)}
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>
                        <textarea
                            className="jsonTestTextarea"
                            placeholder="Dán JSON trip_plan hoặc wrapper { resp, trip_plan } vào đây..."
                            value={jsonText}
                            onChange={(e) => setJsonText(e.target.value)}
                            rows={10}
                        />
                        <div className="jsonTestHint">
                            Gợi ý: bạn có thể dán cả đoạn có ```json ... ``` — hệ thống sẽ tự tách JSON.
                        </div>
                        {jsonText.trim() && !hasTripPlanJson(jsonText) ? (
                            <div className="jsonTestHint" style={{ marginTop: 10 }}>
                                JSON không hợp lệ hoặc thiếu `trip_plan` (hoặc thiếu các field cơ bản như `destination`, `origin`, `duration`, `hotels`, `itinerary`).
                            </div>
                        ) : null}
                        {jsonText.trim() && hasTripPlanJson(jsonText) ? (
                            <div className="jsonTestPreview">
                                <TripPlanMessage chatId={Number.NaN} content={jsonText} allowSave={false} />
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {savedOpen ? (
                <div className="jsonTestOverlay" role="dialog" aria-modal="true" onClick={() => setSavedOpen(false)}>
                    <div className="jsonTestModal" onClick={(e) => e.stopPropagation()}>
                        <div className="jsonTestTop">
                            <div className="jsonTestTitle">{t('trip.saved_plans')}</div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <button
                                    type="button"
                                    className="jsonTestClose"
                                    onClick={loadSaved}
                                    aria-label="Refresh"
                                    title={t('trip.refresh')}
                                    disabled={savedLoading}
                                    style={{ width: 'auto', padding: '0 12px' }}
                                >
                                    {savedLoading ? t('trip.loading') : t('trip.refresh')}
                                </button>
                                <button
                                    type="button"
                                    className="jsonTestClose"
                                    onClick={() => setSavedOpen(false)}
                                    aria-label="Close"
                                >
                                    ✖
                                </button>
                            </div>
                        </div>

                        {savedError ? <div className="jsonTestHint">{t('common.error')}: {savedError}</div> : null}
                        {!savedLoading && savedPlans.length === 0 ? (
                            <div className="jsonTestHint">{t('trip.no_saved')}</div>
                        ) : null}

                        <div className="jsonTestPreview">
                            {(savedPlans || []).map((p) => {
                                const wrapper = p?.data && typeof p.data === 'object' ? p.data : null
                                const content = wrapper ? JSON.stringify(wrapper) : ''
                                return (
                                    <div key={p.id} style={{ marginTop: 12 }}>
                                        <div className="jsonTestHint" style={{ marginTop: 0 }}>
                                            <button
                                                type="button"
                                                className="linkLike"
                                                onClick={() => {
                                                    setSavedOpen(false)
                                                    navigate(`/dashboard/chats/${p.chatId}`)
                                                }}
                                                style={{ padding: 0 }}
                                            >
                                                {p?.title || `${t('trip.trip_fallback')} #${p.id}`}
                                            </button>
                                        </div>
                                        {content ? (
                                            <TripPlanMessage chatId={Number.NaN} content={content} allowSave={false} />
                                        ) : (
                                            <div className="jsonTestHint">{t('trip.saved_corrupt')}</div>
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

export default ChatList
