import './dashboardPage.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../lib/useI18n'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../../components/notifications/useNotify'
import TripPlanMessage from '../../components/tripPlan/TripPlanMessage'

const DashboardPage = () => {
    const { t } = useI18n()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const notify = useNotify()
    const [text, setText] = useState('')
    const inputRef = useRef(null)
    const [savedOpen, setSavedOpen] = useState(false)
    const [savedPlans, setSavedPlans] = useState([])
    const [savedLoading, setSavedLoading] = useState(false)
    const [savedError, setSavedError] = useState('')

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

    useEffect(() => {
        if (searchParams.get('new') === '1') {
            inputRef.current?.focus?.()
            const next = new URLSearchParams(searchParams)
            next.delete('new')
            setSearchParams(next, { replace: true })
        }
    }, [searchParams, setSearchParams])

    useEffect(() => {
        loadSaved()
    }, [loadSaved])

    const submit = async (e) => {
        e.preventDefault()
        const msg = text.trim()
        if (!msg) return
        try {
            const res = await apiRequestBackend('/api/chat/ask', { method: 'POST', body: { message: msg } })
            if (res?.chatId) navigate(`/dashboard/chats/${res.chatId}`)
            setText('')
        } catch (err) {
            notify.error(err?.message || 'Failed to send message')
        }
    }

    return (
        <div className="dashboardPage">
            <div className="texts">
                <div className="logo">
                    <h1>TrAveI</h1>
                </div>
                <div className="options">
                    <button
                        type="button"
                        className="option"
                        onClick={() => {
                            setText('origin: \ndestination: \nduration: \nbudget: \ngroup_size: \ninterests: \npreferences: ')
                            setTimeout(() => inputRef.current?.focus?.(), 0)
                        }}
                    >
                        <img src="/chat.png" alt="" />
                        <span>{t('dashboard.create_trip')}</span>
                    </button>
                    <button
                        type="button"
                        className="option"
                        onClick={() => {
                            setText('Gợi ý giúp tôi một điểm đến thú vị trong tầm ngân sách trung bình.')
                            setTimeout(() => inputRef.current?.focus?.(), 0)
                        }}
                    >
                        <img src="/image.png" alt="" />
                        <span>{t('dashboard.inspire')}</span>
                    </button>
                </div>
                <button
                    type="button"
                    className="savedTripsLink"
                    onClick={() => setSavedOpen(true)}
                    disabled={savedLoading}
                >
                    {t('trip.saved_plans')} [{savedPlans.length}]
                </button>
            </div>
            <div className="formContainer">
                <form onSubmit={submit}>
                    <textarea
                        autoComplete="off"
                        name="text"
                        placeholder={t('dashboard.ask_placeholder')}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        ref={inputRef}
                        rows={2}
                    />
                    <button>
                        <img src="/arrow.png" alt="" />
                    </button>
                </form>
            </div>

            {savedOpen ? (
                <div className="savedOverlay" role="dialog" aria-modal="true" onClick={() => setSavedOpen(false)}>
                    <div className="savedModal" onClick={(e) => e.stopPropagation()}>
                        <div className="savedTop">
                            <div className="savedTitle">{t('trip.saved_plans')}</div>
                            <div className="savedTopActions">
                                <button type="button" className="savedBtn" onClick={loadSaved} disabled={savedLoading}>
                                    {savedLoading ? t('trip.loading') : t('trip.refresh')}
                                </button>
                                <button type="button" className="savedBtn" onClick={() => setSavedOpen(false)} aria-label="Close">
                                    ✖
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
