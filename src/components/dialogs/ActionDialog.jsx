import { useEffect, useRef, useState } from 'react'
import './actionDialog.css'
import { useI18n } from '../../lib/useI18n'

const ActionDialog = ({
  mode = 'confirm',
  tone = 'info',
  title = '',
  message = '',
  confirmText = '',
  cancelText = '',
  confirmVariant = 'primary',
  promptLabel = '',
  promptPlaceholder = '',
  initialValue = '',
  requireInput = false,
  onCancel,
  onConfirm,
}) => {
  const { t, lang } = useI18n()
  const [value, setValue] = useState(String(initialValue || ''))
  const inputRef = useRef(null)
  const cancelBtnRef = useRef(null)
  const titleId = useRef(`action-dialog-title-${Math.random().toString(16).slice(2)}`)
  const messageId = useRef(`action-dialog-message-${Math.random().toString(16).slice(2)}`)

  const toneIconClass = {
    danger: 'ti ti-alert-triangle',
    warning: 'ti ti-alert-circle',
    info: 'ti ti-info-circle',
    success: 'ti ti-circle-check',
  }[tone] || 'ti ti-info-circle'

  useEffect(() => {
    setValue(String(initialValue || ''))
  }, [initialValue, mode, title, message])

  useEffect(() => {
    window.requestAnimationFrame(() => {
      if (mode === 'prompt') {
        inputRef.current?.focus()
        const pos = inputRef.current?.value?.length || 0
        inputRef.current?.setSelectionRange?.(pos, pos)
        return
      }
      cancelBtnRef.current?.focus()
    })
  }, [mode])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const canConfirm = !requireInput || Boolean(value.trim())
  const defaultCancelLabel = lang === 'vi' ? 'Hủy' : 'Cancel'
  const defaultConfirmLabel = lang === 'vi' ? 'Xác nhận' : 'Confirm'
  const translatedCancel = t('common.cancel')
  const translatedConfirm = t('common.confirm')
  const cancelLabel =
    cancelText || (lang === 'vi' && translatedCancel === 'Cancel' ? defaultCancelLabel : translatedCancel || defaultCancelLabel)
  const confirmLabel =
    confirmText || (lang === 'vi' && translatedConfirm === 'Confirm' ? defaultConfirmLabel : translatedConfirm || defaultConfirmLabel)

  return (
    <div
      className="actionDialogBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId.current : undefined}
      aria-describedby={message ? messageId.current : undefined}
      onClick={onCancel}
    >
      <div className={`actionDialogCard actionDialogCard--${tone}`} onClick={(e) => e.stopPropagation()}>
        {title ? (
          <h3 id={titleId.current} className="actionDialogTitle">
            <span className={`actionDialogToneIcon actionDialogToneIcon--${tone}`}>
              <i className={toneIconClass} />
            </span>
            <span>{title}</span>
          </h3>
        ) : null}
        {message ? <p id={messageId.current} className="actionDialogMessage">{message}</p> : null}

        {mode === 'prompt' ? (
          <label className="actionDialogField">
            {promptLabel ? <span>{promptLabel}</span> : null}
            <input
              ref={inputRef}
              className="actionDialogInput"
              value={value}
              placeholder={promptPlaceholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (!canConfirm) return
                e.preventDefault()
                onConfirm?.(value)
              }}
            />
          </label>
        ) : null}

        <div className="actionDialogActions">
          <button
            type="button"
            ref={cancelBtnRef}
            className="actionDialogBtn actionDialogBtn--ghost"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`actionDialogBtn actionDialogBtn--${confirmVariant}`}
            onClick={() => onConfirm?.(mode === 'prompt' ? value : true)}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ActionDialog
