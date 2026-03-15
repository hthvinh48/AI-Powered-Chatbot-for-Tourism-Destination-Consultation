import { Outlet, useNavigate } from 'react-router-dom'
import './dashboardLayout.css'
import { useAuth } from '@clerk/react';
import { useEffect } from 'react';
import ChatList from '../../components/chatList/ChatList';
import { useBackendAuthSync } from '../../lib/useBackendAuthSync';

const DashboardLayout = () => {
    const { userId, isLoaded } = useAuth();
    const { syncing, error } = useBackendAuthSync();

    const navigate = useNavigate();

    useEffect(() => {
        if (isLoaded && !userId) {
            navigate("/sign-in");
        }
    }, [isLoaded, userId, navigate]);

    if (!isLoaded) return "Loading...";
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
