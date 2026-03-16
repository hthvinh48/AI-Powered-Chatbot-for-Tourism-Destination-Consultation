import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Show, UserButton, useAuth } from '@clerk/react'
import { useBackendAuthSync } from '../../lib/useBackendAuthSync'
import { getBackendAuth } from '../../lib/backendAuth'
import { toggleTheme } from '../../lib/theme'
import { useI18n } from '../../lib/useI18n'

import '../../template/assets/scss/style.scss'
import './adminTheme.css'

const AdminLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoaded, userId } = useAuth()
  const { syncing, error } = useBackendAuthSync()
  const { lang, toggleLang, t } = useI18n()

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'dark')

  useEffect(() => {
    if (isLoaded && !userId) navigate('/sign-in')
  }, [isLoaded, userId, navigate])
  useEffect(() => {
    const onChange = () => setTheme(document.documentElement.dataset.theme || 'dark')
    window.addEventListener('themechange', onChange)
    return () => window.removeEventListener('themechange', onChange)
  }, [])

  const me = getBackendAuth()?.user || null
  const role = me?.role
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'

  if (!isLoaded) return 'Loading...'
  if (userId && syncing) return 'Syncing session...'
  if (userId && error) return `Auth error: ${error}`

  if (!isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <h2 className="mb-2">{t('admin.forbidden_title')}</h2>
        <div className="text-secondary">{t('admin.forbidden_text')}</div>
      </div>
    )
  }

  const overlayShown = mobileOpen

  return (
    <div className="adminShell">
      <div id="overlay" className={`overlay ${overlayShown ? 'show' : ''}`} onClick={() => setMobileOpen(false)} />

      <aside
        id="sidebar"
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-show' : ''}`}
      >
        <div className="logo-area">
          <span className="fw-bold">Admin</span>
          <span className="logo-text text-secondary small">{me?.email}</span>
        </div>

        <div className="px-2 pt-3">
          <div className="text-uppercase small text-secondary px-3 mb-2">Management</div>

          <NavLink
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            to="/admin/users"
            onClick={() => setMobileOpen(false)}
          >
            <i className="ti ti-users" />
            <span className="nav-text">{t('admin.users')}</span>
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            to="/admin/tokens"
            onClick={() => setMobileOpen(false)}
          >
            <i className="ti ti-activity" />
            <span className="nav-text">{t('admin.tokens')}</span>
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            to="/dashboard"
            onClick={() => setMobileOpen(false)}
          >
            <i className="ti ti-arrow-back" />
            <span className="nav-text">{t('admin.back')}</span>
          </NavLink>
        </div>
      </aside>

      <nav id="topbar" className={`navbar bg-body border-bottom fixed-top topbar px-3 ${collapsed ? 'full' : ''}`}>
        <button
          id="toggleBtn"
          type="button"
          className="d-none d-lg-inline-flex btn btn-light btn-icon btn-sm"
          onClick={() => setCollapsed((v) => !v)}
          aria-label="Toggle sidebar"
        >
          <i className="ti ti-layout-sidebar-left-expand" />
        </button>

        <button
          id="mobileBtn"
          type="button"
          className="btn btn-light btn-icon btn-sm d-lg-none me-2"
          onClick={() => setMobileOpen(true)}
          aria-label="Open sidebar"
        >
          <i className="ti ti-layout-sidebar-left-expand" />
        </button>

        <div className="ms-auto d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-light btn-sm"
            onClick={() => setTheme(toggleTheme())}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
          <button
            type="button"
            className="btn btn-light btn-sm"
            onClick={toggleLang}
            aria-label="Toggle language"
            title="Toggle language"
          >
            {lang === 'en' ? 'EN' : 'VI'}
          </button>
          <div className="small text-secondary d-none d-md-block">
            {location.pathname}
          </div>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </nav>

      <main id="content" className={`content pt-4 ${collapsed ? 'full' : ''}`}>
        <div style={{ paddingTop: 60 }} className="container-fluid">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default AdminLayout
