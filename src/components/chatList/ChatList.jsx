import { Link } from 'react-router-dom'
import './chatList.css'
import { getBackendAuth } from '../../lib/backendAuth'
import { useI18n } from '../../lib/useI18n'

const ChatList = () => {
    const { t } = useI18n()
    const role = getBackendAuth()?.user?.role
    const canSeeAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'

    return (
        <div className="chatList">
            <span className="title">{t('menu.dashboard')}</span>
            <Link to="/dashboard">{t('menu.create_chat')}</Link>
            {canSeeAdmin ? <Link to="/admin">{t('menu.admin')}</Link> : null}
            <Link to="/explore">{t('menu.explore')}</Link>
            <Link to="/contact">{t('menu.contact')}</Link>
            <hr />
            <span className="title">{t('menu.recents')}</span>
            <div className="list">
                <Link to="/dashboard/chats/123">Testing conversation</Link>
            </div>
            <hr />
        </div>
    )
}

export default ChatList
