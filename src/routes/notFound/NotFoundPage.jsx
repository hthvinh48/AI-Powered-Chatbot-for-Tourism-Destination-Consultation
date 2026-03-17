import UnderDevelopmentPage from '../underDevelopment/UnderDevelopmentPage.jsx'
import { useI18n } from '../../lib/useI18n'

const NotFoundPage = () => {
  const { t } = useI18n()
  return <UnderDevelopmentPage title={t('not_found.title')} description={t('not_found.text')} />
}

export default NotFoundPage

