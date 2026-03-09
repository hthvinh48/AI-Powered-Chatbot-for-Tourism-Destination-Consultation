import './chatPage.css'
import NewPrompt from '../../components/newPrompt/NewPrompt'

const ChatPage = () => {
    return (
        <div className="chatPage">
            <div className="wrapper">
                <div className="chat">
                    <div className="message">test message AI</div>
                    <div className="message user">test message user</div>
                    <div className="message">test message AI</div>
                    <div className="message user">test message user</div>
                    <div className="message">test message AI</div>
                    <div className="message user">test message user</div>
                    <div className="message">test message AI</div>
                    <div className="message user">test message user</div>
                    <div className="message">test message AI</div>
                    <div className="message user">test message user</div>
                    <div className="message">test message AI</div>
                    <div className="message user">test message user</div>
                    <div className="message">test message AI</div>
                    <div className="message user">test message user</div>
                    <div className="message">test message AI</div>
                    <div className="message user">test message user</div>
                    <NewPrompt />
                </div>
            </div>
        </div>
    )
}

export default ChatPage