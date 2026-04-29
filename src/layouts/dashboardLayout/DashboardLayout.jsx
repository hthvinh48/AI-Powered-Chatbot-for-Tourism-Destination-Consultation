import { Outlet } from 'react-router-dom'
import './dashboardLayout.css'
import { useAuth } from '@clerk/react'
import ChatList from '../../components/chatList/ChatList'
import { useBackendAuthSync } from '../../lib/useBackendAuthSync'
import AccessDeniedPage from '../../routes/accessDenied/AccessDeniedPage.jsx'
import { useI18n } from '../../lib/useI18n'

const DashboardLayout = () => {
  const { userId, isLoaded } = useAuth()
  const { syncing, error } = useBackendAuthSync()
  const { t } = useI18n()

  if (!isLoaded) return <div className="dashboardStatus">{t('common.loading')}</div>
  if (!userId) return <AccessDeniedPage />
  if (userId && syncing) return <div className="dashboardStatus">{t('common.syncing')}</div>
  if (userId && error) return <div className="dashboardStatus">{t('common.auth_error')}: {error}</div>

  return (
    <div className="dashboardLayout">
      <aside className="dashboardSidebar">
        <ChatList />
      </aside>
      <section className="dashboardContent">
        <Outlet />
      </section>
    </div>
  )
}

export default DashboardLayout
