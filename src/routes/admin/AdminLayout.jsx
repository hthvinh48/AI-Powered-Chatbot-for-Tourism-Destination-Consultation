import { useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Show, UserButton, useAuth } from '@clerk/react'
import { useBackendAuthSync } from '../../lib/useBackendAuthSync'
import { getBackendAuth } from '../../lib/backendAuth'
import { toggleTheme } from '../../lib/theme'
import { useI18n } from '../../lib/useI18n'
import AccessDeniedPage from '../accessDenied/AccessDeniedPage.jsx'

import '../../template/assets/scss/style.scss'
import './adminTheme.css'

const AdminLayout = () => {
  const location = useLocation()
  const { isLoaded, userId } = useAuth()
  const { syncing, error } = useBackendAuthSync()
  const { lang, toggleLang, t } = useI18n()

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'dark')

  useEffect(() => {
    const onChange = () => setTheme(document.documentElement.dataset.theme || 'dark')
    window.addEventListener('themechange', onChange)
    return () => window.removeEventListener('themechange', onChange)
  }, [])

  const me = getBackendAuth()?.user || null
  const role = me?.role
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'
  const redirectUrl = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)

  const currentPageLabel = useMemo(() => {
    if (location.pathname.startsWith('/admin/map')) return t('admin.map.nav')
    if (location.pathname.startsWith('/admin/users')) return t('admin.users')
    if (location.pathname.startsWith('/admin/tokens')) return t('admin.tokens')
    if (location.pathname.startsWith('/dashboard')) return t('admin.back')
    if (location.pathname.startsWith('/admin')) return t('admin.overview')
    return location.pathname
  }, [location.pathname, t])

  if (!isLoaded) return <div className="admin-loading">{t('common.loading')}</div>
  if (!userId) return <Navigate to={`/sign-in?redirect_url=${redirectUrl}`} replace />
  if (userId && syncing) return <div className="admin-loading">{t('common.syncing')}</div>
  if (userId && error) return <div className="admin-loading">{t('common.auth_error')}: {error}</div>
  if (!me) return <div className="admin-loading">{t('common.syncing')}</div>

  if (!isAdmin) {
    return <AccessDeniedPage title={t('admin.forbidden_title')} description={t('admin.forbidden_text')} showSignIn={false} />
  }

  const SIDEBAR_W = collapsed ? 76 : 248

  return (
    <div className="adminShell">
      {mobileOpen ? (
        <div
          className="admin-mobile-overlay"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`admin-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        style={{ width: SIDEBAR_W }}
      >
        <div className="admin-sidebar-logo">
          <div className="admin-brand-mark">
            <i className="ti ti-compass" />
          </div>
          {!collapsed ? (
            <div className="admin-brand-copy">
              <span className="admin-sidebar-logo-title">{t('admin.brand')}</span>
              <span className="admin-sidebar-logo-email">{me?.email}</span>
            </div>
          ) : null}
          {collapsed ? <i className="ti ti-shield-lock admin-sidebar-logo-icon" /> : null}
        </div>

        <nav className="admin-sidebar-nav">
          {!collapsed ? (
            <div className="admin-sidebar-section-label">{t('admin.control_center')}</div>
          ) : null}

          <NavLink
            end
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            to="/admin"
            onClick={() => setMobileOpen(false)}
            title={t('admin.overview')}
          >
            <i className="ti ti-layout-dashboard" />
            {!collapsed ? <span>{t('admin.overview')}</span> : null}
          </NavLink>

          <NavLink
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            to="/admin/map"
            onClick={() => setMobileOpen(false)}
            title={t('admin.map.nav')}
          >
            <i className="ti ti-map-2" />
            {!collapsed ? <span>{t('admin.map.nav')}</span> : null}
          </NavLink>

          <NavLink
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            to="/admin/users"
            onClick={() => setMobileOpen(false)}
            title={t('admin.users')}
          >
            <i className="ti ti-users" />
            {!collapsed ? <span>{t('admin.users')}</span> : null}
          </NavLink>

          <NavLink
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            to="/admin/tokens"
            onClick={() => setMobileOpen(false)}
            title={t('admin.tokens')}
          >
            <i className="ti ti-coins" />
            {!collapsed ? <span>{t('admin.tokens')}</span> : null}
          </NavLink>

          <div className="admin-sidebar-divider" />

          <NavLink
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            to="/dashboard"
            onClick={() => setMobileOpen(false)}
            title={t('admin.back')}
          >
            <i className="ti ti-arrow-back" />
            {!collapsed ? <span>{t('admin.back')}</span> : null}
          </NavLink>
        </nav>

        {!collapsed ? (
          <div className="admin-sidebar-footer">
            <span className={`admin-role-badge admin-role-badge--${role?.toLowerCase()}`}>
              {role}
            </span>
          </div>
        ) : null}
      </aside>

      <div className="admin-right">
        <header className="admin-topbar">
          <button
            className="admin-topbar-btn d-none d-lg-flex"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={t('admin.toggle_sidebar')}
          >
            <i className={`ti ${collapsed ? 'ti-layout-sidebar-left-expand' : 'ti-layout-sidebar-left-collapse'}`} />
          </button>

          <button
            className="admin-topbar-btn d-lg-none"
            onClick={() => setMobileOpen(true)}
            aria-label={t('admin.open_sidebar')}
          >
            <i className="ti ti-layout-sidebar-left-expand" />
          </button>

          <div className="admin-topbar-path">
            <span className="admin-topbar-path-main">{t('menu.admin')}</span>
            <span className="admin-topbar-path-sep">/</span>
            <span className="admin-topbar-path-sub">{currentPageLabel}</span>
          </div>

          <div className="admin-topbar-actions">
            <button
              className="admin-topbar-btn"
              onClick={() => setTheme(toggleTheme())}
              title={t('nav.toggle_theme')}
            >
              <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} />
            </button>
            <button
              className="admin-topbar-btn admin-topbar-btn--text"
              onClick={toggleLang}
              title={t('nav.toggle_language')}
            >
              {lang === 'en' ? 'EN' : 'VI'}
            </button>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </header>

        <main className="admin-main">
          <div className="admin-main-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
