import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './homePage.css'
import { useI18n } from '../../lib/useI18n'
import { useAuth } from '@clerk/react'

const HomePage = () => {
  const { t } = useI18n()
  const { userId } = useAuth()
  const getStartedTo = userId ? '/dashboard' : '/sign-in?redirect_url=%2Fdashboard'
  const featureSectionRef = useRef(null)
  const flashTimerRef = useRef(null)
  const [featureFlash, setFeatureFlash] = useState(false)

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
    }
  }, [])

  const exploreFeatures = () => {
    const featureSection = featureSectionRef.current
    if (!featureSection) return

    featureSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setFeatureFlash(true)

    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
    flashTimerRef.current = window.setTimeout(() => {
      setFeatureFlash(false)
      flashTimerRef.current = null
    }, 900)
  }

  return (
    <div className="homePage">
      <section className="homeHero">
        <div className="homeHeroBackdrop" />
        <img className="homeHeroPattern" src="/bg.png" alt="" />

        <div className="homeHeroContent">
          <span className="homeHeroLabel">{t('home.badge')}</span>
          <h1 className="homeHeroTitle" data-title={t('home.title')}>
            {t('home.title')}
          </h1>
          <p className="homeHeroText">{t('home.subtitle')}</p>
          <div className="homeHeroActions">
            <Link className="homeBtn homeBtnPrimary" to={getStartedTo}>
              {t('home.cta_start')}
            </Link>
            <button type="button" className="homeBtn homeBtnGhost" onClick={exploreFeatures}>
              {t('home.cta_explore')}
            </button>
          </div>
        </div>

        <div className="homeHeroBotWrap" aria-hidden="true">
          <span className="homeHeroBotGlow" />
          <img className="homeHeroBot" src="/bot.png" alt="" />
        </div>
      </section>

      <section
        ref={featureSectionRef}
        id="features"
        className={`homeHighlights ${featureFlash ? 'homeHighlights--flash' : ''}`}
      >
        <article className="homeHighlightItem">
          <h3>{t('home.highlight.plan.title')}</h3>
          <p>{t('home.highlight.plan.text')}</p>
        </article>
        <article className="homeHighlightItem">
          <h3>{t('home.highlight.budget.title')}</h3>
          <p>{t('home.highlight.budget.text')}</p>
        </article>
        <article className="homeHighlightItem">
          <h3>{t('home.highlight.saved.title')}</h3>
          <p>{t('home.highlight.saved.text')}</p>
        </article>
      </section>

      <footer className="homeFooter">
        <div className="homeFooterLinks">
          <Link to="/terms">{t('home.footer_terms')}</Link>
          <span>/</span>
          <Link to="/privacy">{t('home.footer_privacy')}</Link>
        </div>
      </footer>
    </div>
  )
}

export default HomePage
