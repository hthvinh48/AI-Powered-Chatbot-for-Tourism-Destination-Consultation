import { useEffect, useMemo, useRef, useState } from 'react'
import './newPrompt.css'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../notifications/useNotify'

function parsePlanInput(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const data = {}
  for (const line of lines) {
    const m = line.match(/^([a-zA-Z_]+)\s*[:=]\s*(.+)$/)
    if (!m) continue
    data[m[1].toLowerCase()] = m[2].trim()
  }

  if (!data.origin || !data.destination || !data.duration) return null

  return {
    origin: data.origin,
    destination: data.destination,
    duration: data.duration,
    budget: data.budget || '',
    group_size: data.group_size || data.groupsize || '',
    interests: data.interests || '',
    preferences: data.preferences || '',
  }
}

const NewPrompt = ({ chatId, onNewMessages, onPendingChange }) => {
  const endRef = useRef(null)
  const notify = useNotify()
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const planInput = useMemo(() => parsePlanInput(text), [text])

    useEffect(() => {
        endRef.current.scrollIntoView({ behavior: "smooth" })
    }, [])

    const submit = async (e) => {
      e.preventDefault()
      if (pending) return
      const msg = text.trim()
      if (!msg) return
      if (!Number.isFinite(chatId)) {
        notify.error('Invalid chatId')
        return
      }

      setPending(true)
      onPendingChange?.(true)
      try {
        if (planInput) {
          const res = await apiRequestBackend(`/api/chat/${chatId}/trip-plans/generate`, {
            method: 'POST',
            body: planInput,
          })
          const wrapper = JSON.stringify({
            resp: res?.resp || '',
            trip_plan: res?.trip_plan || null,
          })

          const msgs = Array.isArray(res?.messages) ? res.messages : []
          const patched = msgs.map((m) => {
            if (String(m?.role || '').toLowerCase() !== 'assistant') return m
            return { ...m, content: wrapper }
          })

          onNewMessages?.(patched)
        } else {
          const res = await apiRequestBackend('/api/chat/ask', {
            method: 'POST',
            body: { chatId, message: msg },
          })
          if (res?.trip_plan) {
            const wrapper = JSON.stringify({
              resp: res?.resp || res?.reply || '',
              trip_plan: res?.trip_plan || null,
            })
            const msgs = Array.isArray(res?.messages) ? res.messages : []
            const patched = msgs.map((m) => {
              if (String(m?.role || '').toLowerCase() !== 'assistant') return m
              return { ...m, content: wrapper }
            })
            onNewMessages?.(patched)
          } else {
            onNewMessages?.(res?.messages || [])
          }
        }
        setText('')
      } catch (err) {
        notify.error(err?.message || 'Request failed')
      } finally {
        setPending(false)
        onPendingChange?.(false)
      }
    }

    return (
        <>
            <div className="endChat" ref={endRef}></div>
            <div className="newPrompt">
                <form className="newForm" onSubmit={submit}>
                    <label htmlFor="file">
                        <img src="/attachment.png" alt="" />
                    </label>
                    <input id='file' type="file" multiple={false} hidden />
                    <textarea
                      name="text"
                      placeholder={
                        planInput
                          ? 'Plan input detected: will generate trip plan (origin/destination/duration...)'
                          : 'Ask anything...'
                      }
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={1}
                      disabled={pending}
                    />
                    <button disabled={pending} aria-label={pending ? 'Sending' : 'Send'}>
                        <img src="/arrow.png" alt="" />
                    </button>
                </form>
            </div>
        </>
    )
}

export default NewPrompt
