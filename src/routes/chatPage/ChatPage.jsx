import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import './chatPage.css'
import NewPrompt from '../../components/newPrompt/NewPrompt'
import { apiRequestBackend } from '../../lib/apiClient'
import TripPlanMessage from '../../components/tripPlan/TripPlanMessage'

function hasTripPlanJson(content) {
  try {
    const s = String(content || '')
    const fence =
      s.match(/```json\s*([\s\S]*?)```/i) ||
      s.match(/```\s*([\s\S]*?)```/i)
    const candidate = fence && fence[1] ? fence[1].trim() : s
    const obj = JSON.parse(candidate)
    return Boolean(obj && typeof obj === 'object' && obj.trip_plan)
  } catch {
    return false
  }
}

const ChatPage = () => {
  const { id } = useParams()
  const chatId = useMemo(() => Number.parseInt(String(id || ''), 10), [id])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef(null)

  const scrollToEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

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
      setTimeout(scrollToEnd, 0)
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
      setTimeout(scrollToEnd, 0)
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
                return (
                  <div className={`message ${isUser ? 'user' : ''}`} key={m.id}>
                    {isUser ? <div>{m.content}</div> : null}
                    {!isUser && hasTripPlanJson(m.content) ? (
                      <TripPlanMessage chatId={chatId} content={m.content} />
                    ) : null}
                    {!isUser && !hasTripPlanJson(m.content) ? <div>{m.content}</div> : null}
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
