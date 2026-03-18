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
        <header>
          <Link to="/" className="logo">
            <img src="/logo.png" alt="" />
            <span>TrAveI</span>
          </Link>
          <div className="user">
            <button
              type="button"
              onClick={() => setTheme(toggleTheme())}
              style={{
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid var(--control-border)',
                background: 'var(--control-bg)',
                color: 'inherit',
                cursor: 'pointer',
                marginRight: 12,
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
              aria-label="Toggle theme"
              title="Toggle theme"
              className="headerBtn"
            >
              {theme === "dark" ? <FiMoon /> : <FiSun />}
            </button>

            <button
              type="button"
              onClick={toggleLang}
              style={{
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid var(--control-border)',
                background: 'var(--control-bg)',
                color: 'inherit',
                cursor: 'pointer',
                marginRight: 12,
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
              aria-label="Toggle language"
              title="Toggle language"
              className="langToggle"
            >
              {lang === "en" ? "EN" : "VI"}
            </button>

            <Show when="signed-in">
              <div className="userAvatar">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: {
                        width: "36px",
                        height: "36px",
                      },
                    },
                  }} />
              </div>
            </Show>
            <Show when="signed-out">
              {!isAuthRoute ? (
                <div style={{ display: 'flex', gap: 12 }}>
                  <Link to="/sign-in">{t('nav.sign_in')}</Link>
                  <Link to="/sign-up">{t('nav.sign_up')}</Link>
                </div>
              ) : null}
            </Show>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </ClerkProvider>
  )
}

export default RootLayout
