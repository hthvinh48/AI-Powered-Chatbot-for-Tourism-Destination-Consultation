import { Link, Outlet, useLocation } from 'react-router-dom'
import './rootLayout.css'
import { ClerkProvider, Show, UserButton } from '@clerk/react'
import { useEffect, useState } from 'react'
import { toggleTheme } from '../../lib/theme'
import { useI18n } from '../../lib/useI18n'
import { FiMoon, FiSun } from 'react-icons/fi'

const RootLayout = () => {
  const location = useLocation()
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'dark')
  const { lang, toggleLang, t } = useI18n()
  const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

  if (!PUBLISHABLE_KEY) {
    throw new Error('Add your Clerk Publishable Key to the .env file')
  }

  const isAdminRoute = location.pathname.startsWith('/admin')
  const isDashboardRoute = location.pathname.startsWith('/dashboard')
  const isAuthRoute =
    location.pathname.startsWith('/sign-in') || location.pathname.startsWith('/sign-up')

  useEffect(() => {
    const onChange = () => setTheme(document.documentElement.dataset.theme || 'dark')
    window.addEventListener('themechange', onChange)
    return () => window.removeEventListener('themechange', onChange)
  }, [])

  if (isAdminRoute) {
    return (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <Outlet />
      </ClerkProvider>
    )
  }

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <div className="rootLayout">
        <header className="rootHeader">
          <Link to="/" className="rootLogo">
            <img src="/logo.png" alt="TrAveI logo" />
            <span>TrAveI</span>
          </Link>

          <div className="rootHeaderActions">
            <button
              type="button"
              onClick={() => setTheme(toggleTheme())}
              aria-label={t('nav.toggle_theme')}
              title={t('nav.toggle_theme')}
              className="rootIconBtn"
            >
              {theme === 'dark' ? <FiSun /> : <FiMoon />}
            </button>

            <button
              type="button"
              onClick={toggleLang}
              aria-label={t('nav.toggle_language')}
              title={t('nav.toggle_language')}
              className="rootLangBtn"
            >
              {lang === 'en' ? 'EN' : 'VI'}
            </button>

            <Show when="signed-in">
              <div className="rootUserAvatar">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: {
                        width: '34px',
                        height: '34px',
                      },
                    },
                  }}
                />
              </div>
            </Show>

            <Show when="signed-out">
              {!isAuthRoute ? (
                <div className="rootAuthLinks">
                  <Link className="rootGhostLink" to="/sign-in">
                    {t('nav.sign_in')}
                  </Link>
                  <Link className="rootPrimaryLink" to="/sign-up">
                    {t('nav.sign_up')}
                  </Link>
                </div>
              ) : null}
            </Show>
          </div>
        </header>

        <main className={`rootMain ${isDashboardRoute ? 'rootMain--app' : 'rootMain--public'}`}>
          <Outlet />
        </main>
      </div>
    </ClerkProvider>
  )
}

export default RootLayout
