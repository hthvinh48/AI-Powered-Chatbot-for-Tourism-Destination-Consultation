import './dashboardPage.css'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../lib/useI18n'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../../components/notifications/useNotify'

const DashboardPage = () => {
    const { t } = useI18n()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const notify = useNotify()
    const [text, setText] = useState('')
    const inputRef = useRef(null)

    useEffect(() => {
        if (searchParams.get('new') === '1') {
            inputRef.current?.focus?.()
            const next = new URLSearchParams(searchParams)
            next.delete('new')
            setSearchParams(next, { replace: true })
        }
    }, [searchParams, setSearchParams])

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
        </div>
    )
}

export default DashboardPage
