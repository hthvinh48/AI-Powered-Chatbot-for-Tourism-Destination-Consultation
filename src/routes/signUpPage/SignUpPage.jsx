import { SignUp } from '@clerk/react'
import './signUpPage.css'
import { useI18n } from '../../lib/useI18n'

const SignUpPage = () => {
  const { t } = useI18n()

  return (
    <div className="authPage">
      <div className="authPanel">
        <div className="authCopy">
          <h1>{t('auth.signup_title')}</h1>
          <p>{t('auth.signup_text')}</p>
        </div>
        <div className="authCard">
          <SignUp
            routing="path"
            appearance={{
              elements: {
                formFieldInputShowPasswordButton: {
                  color: 'inherit',
                  backgroundColor: 'transparent',
                },
              },
            }}
            path="/sign-up"
            signInUrl="/sign-in"
            forceRedirectUrl="/dashboard"
          />
        </div>
      </div>
    </div>
  )
}

export default SignUpPage
