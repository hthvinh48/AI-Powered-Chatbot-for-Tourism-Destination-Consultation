import { SignIn } from '@clerk/react'
import './signInPage.css'
import { useI18n } from '../../lib/useI18n'

const SignInPage = () => {
  const { t } = useI18n()

  return (
    <div className="authPage">
      <div className="authPanel">
        <div className="authCopy">
          <h1>{t('auth.signin_title')}</h1>
          <p>{t('auth.signin_text')}</p>
        </div>
        <div className="authCard">
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            forceRedirectUrl="/dashboard"
          />
        </div>
      </div>
    </div>
  )
}

export default SignInPage
