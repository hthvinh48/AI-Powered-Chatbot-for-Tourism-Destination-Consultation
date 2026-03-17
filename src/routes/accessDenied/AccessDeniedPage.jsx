import { Link, useLocation } from 'react-router-dom'
import './accessDenied.css'
import { useI18n } from '../../lib/useI18n'

const AccessDeniedPage = ({ title, description, showSignIn = true }) => {
  const { t } = useI18n()
  const location = useLocation()

  return (
    <div className="accessDenied">
      <div className="accessDeniedCard">
        <h2 className="accessDeniedTitle">{title || t('access.denied_title')}</h2>
        <p className="accessDeniedText">
          {description || `${t('access.denied_text')} (${location.pathname})`}
        </p>
        <div className="accessDeniedActions">
          <Link className="accessDeniedBtn" to="/">
            {t('access.go_home')}
          </Link>
          {showSignIn ? (
            <Link className="accessDeniedBtn" to="/sign-in">
              {t('access.sign_in')}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default AccessDeniedPage

