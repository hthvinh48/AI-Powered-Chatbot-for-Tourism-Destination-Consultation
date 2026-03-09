import { Link } from 'react-router-dom'
import './chatList.css'

const ChatList = () => {
    return (
        <div className="chatList">
            <span className="title">DASHBOARD</span>
            <Link to="/dashboard">Create a new Chat</Link>
            <Link to="/">Explore TrAveI</Link>
            <Link to="/">Contact</Link>
            <hr />
            <span className="title">RECENTS</span>
            <div className="list">
                <Link to="/dashboard/chats/123">Testing conversation</Link>
            </div>
            <hr />
        </div>
    )
}

export default ChatList