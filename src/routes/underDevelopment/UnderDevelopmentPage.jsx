import { Link, useLocation } from 'react-router-dom'
import './underDevelopment.css'
import { useI18n } from '../../lib/useI18n'

const UnderDevelopmentPage = ({ title = 'Trang đang phát triển', description }) => {
  const location = useLocation()
  const { t } = useI18n()
  const text =
    description ||
    `${t('under_dev.text')} (${location.pathname})`

  return (
    <div className="underDev">
      <div className="underDevCard">
        <h2 className="underDevTitle">{title || t('under_dev.title')}</h2>
        <p className="underDevText">{text}</p>
        <div className="underDevActions">
          <Link className="underDevBtn" to="/">
            {t('under_dev.home')}
          </Link>
          <Link className="underDevBtn" to="/dashboard">
            {t('under_dev.dashboard')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default UnderDevelopmentPage
