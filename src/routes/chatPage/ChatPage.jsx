import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import './chatPage.css'
import NewPrompt from '../../components/newPrompt/NewPrompt'
import { apiRequestBackend } from '../../lib/apiClient'
import TripPlanMessage from '../../components/tripPlan/TripPlanMessage'
import { extractJsonFromText, hasTripPlanJson, safeJsonParse } from '../../lib/tolerantJson'
import { useI18n } from '../../lib/useI18n'
import { TRIP_PLANS_CHANGED_EVENT, createTripPlanKeyFromSavedItem } from '../../lib/tripPlanState'
import { BACKEND_AUTH_CHANGED_EVENT } from '../../lib/backendAuth'

function getAssistantDisplayText(content) {
  const text = String(content || '')
  const candidate = extractJsonFromText(text) || text
  const parsed = safeJsonParse(candidate)
  if (!parsed || typeof parsed !== 'object') return text
  if (typeof parsed.resp === 'string' && parsed.resp.trim()) return parsed.resp.trim()
  if (typeof parsed.reply === 'string' && parsed.reply.trim()) return parsed.reply.trim()
  return text
}

function renderInlineMarkdown(text) {
  return String(text || '')
    .split(/(\*\*[^*]+?\*\*)/g)
    .map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
      }
      return part
    })
}

function renderAssistantMessage(content) {
  const text = getAssistantDisplayText(content)
  const lines = String(text || '').split(/\r?\n/)

  return (
    <div className="chatMarkdown">
      {lines.map((line, index) => {
        if (!line.trim()) return <div className="chatMarkdownSpacer" key={`spacer-${index}`} />

        return (
          <div
            className={`chatMarkdownLine ${/^\s*\d+\.\s/.test(line) ? 'chatMarkdownListLine' : ''}`}
            key={`${line}-${index}`}
          >
            {renderInlineMarkdown(line)}
          </div>
        )
      })}
    </div>
  )
}

const ChatPage = () => {
  const { t } = useI18n()
  const { id } = useParams()
  const chatId = useMemo(() => Number.parseInt(String(id || ''), 10), [id])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [thinking, setThinking] = useState(false)
  const [savedTripKeys, setSavedTripKeys] = useState(() => new Set())
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

  const loadSavedTripKeys = useCallback(async () => {
    if (!Number.isFinite(chatId)) {
      setSavedTripKeys(new Set())
      return
    }

    try {
      const res = await apiRequestBackend('/api/trip-plans?include=true&limit=200')
      const next = new Set()
      const items = Array.isArray(res?.items) ? res.items : []
      for (const item of items) {
        if (Number(item?.chatId) !== chatId) continue
        const key = createTripPlanKeyFromSavedItem(item)
        if (key) next.add(key)
      }
      setSavedTripKeys(next)
    } catch {
      setSavedTripKeys(new Set())
    }
  }, [chatId])

  useEffect(() => {
    loadSavedTripKeys()
  }, [loadSavedTripKeys])

  useEffect(() => {
    const onBackendAuthChanged = () => {
      load()
      loadSavedTripKeys()
    }
    window.addEventListener(BACKEND_AUTH_CHANGED_EVENT, onBackendAuthChanged)
    return () => window.removeEventListener(BACKEND_AUTH_CHANGED_EVENT, onBackendAuthChanged)
  }, [load, loadSavedTripKeys])

  useEffect(() => {
    const onTripPlansChanged = (event) => {
      const changedChatId = Number(event?.detail?.chatId)
      if (Number.isFinite(changedChatId) && changedChatId !== chatId) return
      loadSavedTripKeys()
    }
    window.addEventListener(TRIP_PLANS_CHANGED_EVENT, onTripPlansChanged)
    return () => window.removeEventListener(TRIP_PLANS_CHANGED_EVENT, onTripPlansChanged)
  }, [chatId, loadSavedTripKeys])

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
                {isTrip ? <TripPlanMessage chatId={chatId} content={m.content} savedTripKeys={savedTripKeys} /> : null}
                {!isUser && !isTrip ? renderAssistantMessage(m.content) : null}
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
