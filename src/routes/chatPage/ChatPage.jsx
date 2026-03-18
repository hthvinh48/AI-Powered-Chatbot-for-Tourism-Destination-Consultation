import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import './chatPage.css'
import NewPrompt from '../../components/newPrompt/NewPrompt'
import { apiRequestBackend } from '../../lib/apiClient'
import TripPlanMessage from '../../components/tripPlan/TripPlanMessage'
import { hasTripPlanJson } from '../../lib/tolerantJson'

const ChatPage = () => {
  const { id } = useParams()
  const chatId = useMemo(() => Number.parseInt(String(id || ''), 10), [id])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef(null)

  const scrollToEnd = useCallback(() => {
    const container = endRef.current?.parentElement
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [])

  useEffect(() => {
    scrollToEnd()
  }, [messages, scrollToEnd])

  const load = useCallback(async () => {
    if (!Number.isFinite(chatId)) {
      setError('Invalid chatId')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await apiRequestBackend(`/api/chat/${chatId}/messages?order=asc&limit=200`)
      setMessages(res?.items || [])
    } catch (err) {
      setError(err?.message || 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [chatId, scrollToEnd])

  useEffect(() => {
    load()
  }, [load])

  const appendMessages = useCallback(
    (newMessages) => {
      if (!Array.isArray(newMessages) || newMessages.length === 0) return
      setMessages((prev) => [...prev, ...newMessages])
    },
    [scrollToEnd],
  )

  return (
    <div className="chatPage">
      <div className="wrapper">
        <div className="chat">
          {loading ? <div className="message">Loading...</div> : null}
          {error ? <div className="message">Error: {error}</div> : null}

          {!loading && !error
            ? messages.map((m) => {
              const isUser = String(m.role || '').toLowerCase() === 'user'
              const isTrip = !isUser && hasTripPlanJson(m.content)
              return (
                <div className={`message ${isUser ? 'user' : ''}`} key={m.id}>
                  {isUser ? <div>{m.content}</div> : null}
                  {isTrip ? <TripPlanMessage chatId={chatId} content={m.content} /> : null}
                  {!isUser && !isTrip ? <div>{m.content}</div> : null}
                </div>
              )
            })
            : null}

          {thinking ? <div className="message">Đang suy nghĩ...</div> : null}

          <div className="endChat" ref={endRef} />
          <NewPrompt chatId={chatId} onNewMessages={appendMessages} onPendingChange={setThinking} />
        </div>
      </div>
    </div>
  )
}

export default ChatPage
