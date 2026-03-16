import './dashboardPage.css'
import { useI18n } from '../../lib/useI18n'

const DashboardPage = () => {
    const { t } = useI18n()
    return (
        <div className="dashboardPage">
            <div className="texts">
                <div className="logo">
                    <h1>TrAveI</h1>
                </div>
                <div className="options">
                    <div className="option">
                        <img src="/chat.png" alt="" />
                        <span>{t('dashboard.create_trip')}</span>
                    </div>
                    <div className="option">
                        <img src="/image.png" alt="" />
                        <span>{t('dashboard.inspire')}</span>
                    </div>
                </div>
            </div>
            <div className="formContainer">
                <form>
                    <input autoComplete="off" type="text" name="text" placeholder={t('dashboard.ask_placeholder')} />
                    <button>
                        <img src="/arrow.png" alt="" />
                    </button>
                </form>
            </div>
        </div>
    )
}

export default DashboardPage
