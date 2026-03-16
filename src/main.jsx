import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { initTheme } from './lib/theme.js'
import NotificationsProvider from './components/notifications/NotificationsProvider.jsx'
import I18nProvider from './lib/I18nProvider.jsx'
import ChatPage from './routes/chatPage/ChatPage.jsx'
import DashboardPage from './routes/dashboardPage/DashboardPage.jsx'
import HomePage from './routes/homePage/HomePage.jsx'
import RootLayout from './layouts/rootLayout/RootLayout.jsx'
import DashboardLayout from './layouts/dashboardLayout/DashboardLayout.jsx'
import SignInPage from './routes/signInPage/SignInPage.jsx'
import SignUpPage from './routes/signUpPage/SignUpPage.jsx'
import AdminLayout from './routes/admin/AdminLayout.jsx'
import AdminUsersPage from './routes/admin/AdminUsersPage.jsx'
import AdminTokensPage from './routes/admin/AdminTokensPage.jsx'
import UnderDevelopmentPage from './routes/underDevelopment/UnderDevelopmentPage.jsx'

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/",
        element: <HomePage />,
      },
      {
        path: "/sign-in/*",
        element: <SignInPage />,
      },
      {
        path: "/sign-up/*",
        element: <SignUpPage />,
      },
      {
        path: "/explore",
        element: <UnderDevelopmentPage title="Explore đang phát triển" />,
      },
      {
        path: "/contact",
        element: <UnderDevelopmentPage title="Contact đang phát triển" />,
      },
      {
        path: "/terms",
        element: <UnderDevelopmentPage title="Terms đang phát triển" />,
      },
      {
        path: "/privacy",
        element: <UnderDevelopmentPage title="Privacy đang phát triển" />,
      },
      {
        element: <DashboardLayout />,
        children: [
          {
            path: "/dashboard",
            element: <DashboardPage />,
          },
          {
            path: "/dashboard/chats/:id",
            element: <ChatPage />,
          },
        ],
      },
      {
        path: "/admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/users" replace /> },
          { path: "users", element: <AdminUsersPage /> },
          { path: "tokens", element: <AdminTokensPage /> },
        ],
      },
      {
        path: "*",
        element: <UnderDevelopmentPage title="Không tìm thấy trang" description="Trang bạn truy cập chưa tồn tại hoặc đang được phát triển." />,
      },
    ]
  }
])

initTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NotificationsProvider>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </NotificationsProvider>
  </React.StrictMode>,
)
