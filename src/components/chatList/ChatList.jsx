import { Link, useLocation, useNavigate } from 'react-router-dom'
import './chatList.css'
import { getBackendAuth } from '../../lib/backendAuth'
import { useI18n } from '../../lib/useI18n'
import { useEffect, useState } from 'react'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../notifications/useNotify'
import TripPlanMessage from '../tripPlan/TripPlanMessage'

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

    const load = async () => {
        const res = await apiRequestBackend('/api/chat')
        setItems(res?.items || [])
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
            {canSeeAdmin ? <Link to="/admin">{t('menu.admin')}</Link> : null}
            <Link to="/explore">{t('menu.explore')}</Link>
            <Link to="/contact">{t('menu.contact')}</Link>
            <hr />
            <span className="title">{t('menu.recents')}</span>
            <div className="list">
                {(items || []).map((c) => (
                    <div className="chatRow" key={c.id}>
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
                            aria-label={`Delete chat ${c.id}`}
                            title="Delete"
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
                        {jsonText.trim() ? (
                            <div className="jsonTestPreview">
                                <TripPlanMessage chatId={Number.NaN} content={jsonText} allowSave={false} />
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export default ChatList
