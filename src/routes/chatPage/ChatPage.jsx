import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import './chatPage.css'
import NewPrompt from '../../components/newPrompt/NewPrompt'
import { apiRequestBackend } from '../../lib/apiClient'
import TripPlanMessage from '../../components/tripPlan/TripPlanMessage'
import { hasTripPlanJson } from '../../lib/tolerantJson'
import { useI18n } from '../../lib/useI18n'

const ChatPage = () => {
  const { t } = useI18n()
  const { id } = useParams()
  const chatId = useMemo(() => Number.parseInt(String(id || ''), 10), [id])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef(null)

  const scrollToEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [])

  useEffect(() => {
    scrollToEnd()
  }, [messages, thinking, scrollToEnd])

  const load = useCallback(async () => {
    if (!Number.isFinite(chatId)) {
      setError(t('prompt.invalid_chat'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await apiRequestBackend(`/api/chat/${chatId}/messages?order=asc&limit=200`)
      setMessages(res?.items || [])
    } catch (err) {
      setError(err?.message || t('chat.load_fail'))
    } finally {
      setLoading(false)
    }
  }, [chatId, t])

  useEffect(() => {
    load()
  }, [load])

  const appendMessages = useCallback((newMessages) => {
    if (!Array.isArray(newMessages) || newMessages.length === 0) return
    setMessages((prev) => [...prev, ...newMessages])
  }, [])

  return (
    <div className="chatPage">
      <div className="chatThread">
        {loading ? <div className="chatSystemMsg">{t('chat.loading')}</div> : null}
        {error ? <div className="chatSystemMsg chatSystemMsgError">{t('chat.error_prefix')}: {error}</div> : null}

        {!loading && !error
          ? messages.map((m) => {
            const isUser = String(m.role || '').toLowerCase() === 'user'
            const isTrip = !isUser && hasTripPlanJson(m.content)
            return (
              <div className={`chatBubble ${isUser ? 'chatBubbleUser' : 'chatBubbleBot'}`} key={m.id}>
                {isUser ? <div>{m.content}</div> : null}
                {isTrip ? <TripPlanMessage chatId={chatId} content={m.content} /> : null}
                {!isUser && !isTrip ? <div>{m.content}</div> : null}
              </div>
            )
          })
          : null}

        {thinking ? <div className="chatSystemMsg">{t('chat.thinking')}</div> : null}
        <div ref={endRef} />
      </div>

      <NewPrompt chatId={chatId} onNewMessages={appendMessages} onPendingChange={setThinking} />
    </div>
  )
}

export default ChatPage
