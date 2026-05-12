import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import './newPrompt.css'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../notifications/useNotify'
import { useI18n } from '../../lib/useI18n'
import { looksLikeTripPlan } from '../../lib/tolerantJson'
import { buildSmartAskPayload } from '../../lib/promptIntent'

function normalizeFieldKey(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function mapPlanFieldKey(rawKey) {
  const key = normalizeFieldKey(rawKey)
  if (!key) return ''

  if (['origin', 'departure', 'diemxuatphat', 'diemkhoihanh', 'khoihanh', 'xuatphat'].includes(key)) return 'origin'
  if (['destination', 'diemden', 'den', 'noiden'].includes(key)) return 'destination'
  if (['duration', 'songay', 'thoiluong'].includes(key)) return 'duration'
  if (['budget', 'ngansach', 'chiphi'].includes(key)) return 'budget'
  if (['groupsize', 'group', 'songuoi', 'soluongnguoi', 'nhom'].includes(key)) return 'group_size'
  if (['interests', 'sothich', 'yeuthich'].includes(key)) return 'interests'
  if (['preferences', 'yeucaudacbiet', 'ghichu', 'note'].includes(key)) return 'preferences'

  return key
}

function parsePlanInput(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const data = {}
  for (const line of lines) {
    const m = line.match(/^([^:=]+)\s*[:=]\s*(.+)$/)
    if (!m) continue
    const canonicalKey = mapPlanFieldKey(m[1])
    if (!canonicalKey) continue
    data[canonicalKey] = m[2].trim()
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

const NewPrompt = forwardRef(({ chatId, onNewMessages, onPendingChange }, ref) => {
  const notify = useNotify()
  const { t, lang } = useI18n()
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const textareaRef = useRef(null)
  const formRef = useRef(null)
  const submittingRef = useRef(false)
  const planInput = useMemo(() => parsePlanInput(text), [text])

  const focusTextarea = useCallback(() => {
    window.requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      const pos = el.value.length
      el.setSelectionRange(pos, pos)
    })
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      setText: (nextText, options = {}) => {
        const shouldSubmit = Boolean(options?.submit)
        setText(String(nextText || ''))
        focusTextarea()
        if (shouldSubmit) {
          window.setTimeout(() => {
            formRef.current?.requestSubmit?.()
          }, 0)
        }
      },
      focus: () => focusTextarea(),
    }),
    [focusTextarea],
  )

  const submit = async (e) => {
    e.preventDefault()
    if (pending || submittingRef.current) return
    const msg = text.trim()
    if (!msg) return
    if (!Number.isFinite(chatId)) {
      notify.error(t('prompt.invalid_chat'))
      return
    }

    submittingRef.current = true

    const optimisticUser = {
      id: `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: 'USER',
      content: msg,
      createdAt: new Date().toISOString(),
      _temp: true,
    }
    onNewMessages?.([optimisticUser])
    setText('')
    focusTextarea()

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
        const assistant = msgs.find((m) => String(m?.role || '').toLowerCase() === 'assistant')
        if (assistant) onNewMessages?.([{ ...assistant, content: wrapper }])
      } else {
        const smartPayload = buildSmartAskPayload(msg, lang)
        const res = await apiRequestBackend('/api/chat/ask', {
          method: 'POST',
          body: { chatId, ...smartPayload },
        })
        if (res?.trip_plan && looksLikeTripPlan(res.trip_plan)) {
          const wrapper = JSON.stringify({
            resp: res?.resp || res?.reply || '',
            trip_plan: res?.trip_plan || null,
          })
          const msgs = Array.isArray(res?.messages) ? res.messages : []
          const assistant = msgs.find((m) => String(m?.role || '').toLowerCase() === 'assistant')
          if (assistant) onNewMessages?.([{ ...assistant, content: wrapper }])
        } else {
          const msgs = Array.isArray(res?.messages) ? res.messages : []
          const assistant = msgs.find((m) => String(m?.role || '').toLowerCase() === 'assistant')
          if (assistant) onNewMessages?.([assistant])
        }
      }
    } catch (err) {
      notify.error(err?.message || t('prompt.request_failed'))
      setText(msg)
    } finally {
      submittingRef.current = false
      setPending(false)
      onPendingChange?.(false)
      focusTextarea()
    }
  }

  const handleTextareaKeyDown = (e) => {
    if (e.key !== 'Enter') return
    if (e.shiftKey) return
    if (e.nativeEvent?.isComposing) return
    e.preventDefault()
    if (pending || submittingRef.current) return
    e.currentTarget.form?.requestSubmit()
  }

  return (
    <div className="newPrompt">
      <form
        ref={formRef}
        className={`newForm ${pending ? 'is-pending' : ''}`}
        onSubmit={submit}
        aria-busy={pending}
      >
        <textarea
          ref={textareaRef}
          name="text"
          placeholder={
            planInput
              ? t('prompt.plan_detected')
              : t('prompt.ask_anything')
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          rows={2}
          readOnly={pending}
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          aria-label={pending ? t('prompt.sending') : t('prompt.send')}
          onMouseDown={(e) => e.preventDefault()}
        >
          <i className={`ti ${pending ? 'ti-loader-2 newFormSpinner' : 'ti-arrow-up'}`} />
        </button>
      </form>
      {pending ? <div className="newPromptStatus">{t('prompt.sending')}</div> : null}
    </div>
  )
})

NewPrompt.displayName = 'NewPrompt'

export default NewPrompt
