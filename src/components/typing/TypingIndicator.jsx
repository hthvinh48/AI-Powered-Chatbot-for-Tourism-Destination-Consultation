import './typingIndicator.css'
import { useI18n } from '../../lib/useI18n'

const TypingIndicator = ({ labelKey = 'chat.thinking' }) => {
  const { t } = useI18n()
  return (
    <span className="typingIndicator" aria-live="polite">
      <span className="typingIndicatorLabel">{t(labelKey)}</span>
      <span className="typingIndicatorDots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </span>
  )
}

export default TypingIndicator

