import { SignUp } from '@clerk/react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import './signUpPage.css'
import { useI18n } from '../../lib/useI18n'

const SignUpPage = () => {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const redirectUrl = useMemo(() => {
    const next = searchParams.get('redirect_url')
    if (!next || !next.startsWith('/')) return '/dashboard'
    return next
  }, [searchParams])
  const signInUrl = useMemo(
    () => `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`,
    [redirectUrl],
  )

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
            signInUrl={signInUrl}
            forceRedirectUrl={redirectUrl}
            fallbackRedirectUrl={redirectUrl}
          />
        </div>
      </div>
    </div>
  )
}

export default SignUpPage
