import { Outlet } from 'react-router-dom'
import './dashboardLayout.css'
import { useAuth } from '@clerk/react';
import ChatList from '../../components/chatList/ChatList';
import { useBackendAuthSync } from '../../lib/useBackendAuthSync';
import AccessDeniedPage from '../../routes/accessDenied/AccessDeniedPage.jsx';

const DashboardLayout = () => {
    const { userId, isLoaded } = useAuth();
    const { syncing, error } = useBackendAuthSync();

    if (!isLoaded) return "Loading...";
    if (!userId) return <AccessDeniedPage />;
    if (userId && syncing) return "Syncing session...";
    if (userId && error) return `Auth error: ${error}`;

    return (
        <div className="dashboardLayout">
            <div className="menu"><ChatList /></div>
            <div className="content">
                <Outlet />
            </div>
        </div>
    )
}

export default DashboardLayout
