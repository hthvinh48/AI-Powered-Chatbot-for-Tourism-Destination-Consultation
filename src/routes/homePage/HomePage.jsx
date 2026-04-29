import { Link } from 'react-router-dom'
import './homePage.css'
import { useI18n } from '../../lib/useI18n'

const HomePage = () => {
  const { t } = useI18n()

  return (
    <div className="homePage">
      <section className="homeHero">
        <div className="homeHeroBackdrop" />
        <img className="homeHeroPattern" src="/bg.png" alt="" />

        <div className="homeHeroContent">
          <span className="homeHeroLabel">{t('home.badge')}</span>
          <h1 className="homeHeroTitle">{t('home.title')}</h1>
          <p className="homeHeroText">{t('home.subtitle')}</p>
          <div className="homeHeroActions">
            <Link className="homeBtn homeBtnPrimary" to="/dashboard">
              {t('home.cta_start')}
            </Link>
            <Link className="homeBtn homeBtnGhost" to="/explore">
              {t('home.cta_explore')}
            </Link>
          </div>
        </div>

        <img className="homeHeroBot" src="/bot.png" alt="Travel assistant bot" />
      </section>

      <section className="homeHighlights">
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
