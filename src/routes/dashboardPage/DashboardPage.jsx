import './dashboardPage.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../lib/useI18n'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../../components/notifications/useNotify'
import { emitChatsChanged } from '../../lib/chatState'
import { buildSmartAskPayload } from '../../lib/promptIntent'

const DashboardPage = () => {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const notify = useNotify()
  const [text, setText] = useState('')
  const inputRef = useRef(null)
  const mountedRef = useRef(true)
  const submitLockRef = useRef(false)
  const [composerPending, setComposerPending] = useState(false)

  const focusComposer = useCallback(() => {
    window.requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const pos = el.value.length
      el.setSelectionRange(pos, pos)
    })
  }, [])

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const shouldFocus = searchParams.get('new') === '1'
    const prefill = searchParams.get('prefill')
    if (!shouldFocus && !prefill) return

    if (prefill) {
      setText(prefill)
    }
    focusComposer()

    const next = new URLSearchParams(searchParams)
    next.delete('new')
    next.delete('prefill')
    setSearchParams(next, { replace: true })
  }, [focusComposer, searchParams, setSearchParams])

  const promptSuggestions = useMemo(
    () => [
      {
        icon: 'ti-route',
        title: t('dashboard.suggestion.plan_title'),
        prompt: t('dashboard.suggestion.plan_prompt'),
      },
      {
        icon: 'ti-wallet',
        title: t('dashboard.suggestion.budget_title'),
        prompt: t('dashboard.suggestion.budget_prompt'),
      },
      {
        icon: 'ti-tools-kitchen-2',
        title: t('dashboard.suggestion.food_title'),
        prompt: t('dashboard.suggestion.food_prompt'),
      },
      {
        icon: 'ti-sparkles',
        title: t('dashboard.suggestion.inspire_title'),
        prompt: t('dashboard.suggest_prompt'),
      },
    ],
    [t],
  )

  const useSuggestion = (prompt) => {
    setText(prompt)
    focusComposer()
  }

  const submit = async (e) => {
    e.preventDefault()
    if (composerPending || submitLockRef.current) return

    const msg = text.trim()
    if (!msg) return

    submitLockRef.current = true
    setComposerPending(true)
    try {
      const smartPayload = buildSmartAskPayload(msg, lang)
      const res = await apiRequestBackend('/api/chat/ask', { method: 'POST', body: smartPayload })
      if (res?.chatId) {
        emitChatsChanged({ type: 'created', chatId: Number(res.chatId), title: msg })
        navigate(`/dashboard/chats/${res.chatId}`)
        return
      }
      setText('')
    } catch (err) {
      notify.error(err?.message || t('prompt.request_failed'))
    } finally {
      submitLockRef.current = false
      if (mountedRef.current) {
        setComposerPending(false)
        focusComposer()
      }
    }
  }

  const handleComposerKeyDown = (e) => {
    if (e.key !== 'Enter') return
    if (e.shiftKey) return
    if (e.nativeEvent?.isComposing) return
    e.preventDefault()
    if (composerPending || submitLockRef.current) return
    e.currentTarget.form?.requestSubmit()
  }

  return (
    <div className="dashboardPage">
      <section className="dashboardChatStart">
        <div className="dashboardChatStartInner">
          <div className="dashboardChatMark">
            <i className="ti ti-message-chatbot" />
          </div>
          <div className="dashboardChatCopy">
            <h2>{t('dashboard.chat_start_title')}</h2>
            <p>{t('dashboard.chat_start_text')}</p>
          </div>
          <div className="dashboardSuggestionGrid" aria-label={t('dashboard.suggestions_label')}>
            {promptSuggestions.map((item) => (
              <button
                type="button"
                className="dashboardSuggestionCard"
                key={item.title}
                onClick={() => useSuggestion(item.prompt)}
              >
                <span className="dashboardSuggestionIcon">
                  <i className={`ti ${item.icon}`} />
                </span>
                <span className="dashboardSuggestionText">
                  <strong>{item.title}</strong>
                  <small>{item.prompt}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboardComposer dashboardComposer--chatStart">
        <form className={composerPending ? 'is-pending' : ''} onSubmit={submit} aria-busy={composerPending}>
          <textarea
            autoComplete="off"
            name="text"
            placeholder={t('dashboard.ask_placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            ref={inputRef}
            rows={2}
            readOnly={composerPending}
          />
          <button
            type="submit"
            disabled={composerPending || !text.trim()}
            aria-label={composerPending ? t('prompt.sending') : t('prompt.send')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <i className={`ti ${composerPending ? 'ti-loader-2 dashboardComposerSpinner' : 'ti-arrow-up'}`} />
          </button>
        </form>
        {composerPending ? <div className="dashboardComposerStatus">{t('prompt.sending')}</div> : null}
      </section>

    </div>
  )
}

export default DashboardPage
