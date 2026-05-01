import { SignIn } from '@clerk/react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import './signInPage.css'
import { useI18n } from '../../lib/useI18n'

const SignInPage = () => {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const redirectUrl = useMemo(() => {
    const next = searchParams.get('redirect_url')
    if (!next || !next.startsWith('/')) return '/dashboard'
    return next
  }, [searchParams])
  const signUpUrl = useMemo(
    () => `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`,
    [redirectUrl],
  )

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
            signUpUrl={signUpUrl}
            forceRedirectUrl={redirectUrl}
            fallbackRedirectUrl={redirectUrl}
          />
        </div>
      </div>
    </div>
  )
}

export default SignInPage
