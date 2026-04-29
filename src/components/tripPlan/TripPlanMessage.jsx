import { useMemo, useState } from 'react'
import './tripPlanMessage.css'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../notifications/useNotify'
import { useI18n } from '../../lib/useI18n'
import { extractJsonFromText, looksLikeTripPlan, safeJsonParse } from '../../lib/tolerantJson'

function extractPreambleText(text) {
  const value = String(text || '').trim()
  if (!value) return ''
  const fenceIndex = value.search(/```json/i)
  if (fenceIndex >= 0) return value.slice(0, fenceIndex).trim()
  const anyFenceIndex = value.indexOf('```')
  if (anyFenceIndex >= 0) return value.slice(0, anyFenceIndex).trim()
  return ''
}

function parseWrapper(content) {
  if (!content || typeof content !== 'string') return null
  const raw = extractJsonFromText(content) || content
  const parsed = safeJsonParse(raw)
  if (!parsed || typeof parsed !== 'object') return null
  if (!parsed.trip_plan || typeof parsed.trip_plan !== 'object') return null
  return {
    resp: typeof parsed.resp === 'string' ? parsed.resp : '',
    tripPlan: parsed.trip_plan,
  }
}

function parseTripPlan(content) {
  if (!content || typeof content !== 'string') return null
  const raw = extractJsonFromText(content) || content
  const parsed = safeJsonParse(raw)
  if (!parsed || typeof parsed !== 'object') return null
  if (parsed.trip_plan && typeof parsed.trip_plan === 'object') return parsed.trip_plan
  if (looksLikeTripPlan(parsed)) return parsed
  return null
}

function isValidTripPlan(plan) {
  if (!plan || typeof plan !== 'object') return false
  if (!String(plan.origin || '').trim()) return false
  if (!String(plan.destination || '').trim()) return false
  if (!String(plan.duration || '').trim()) return false
  if (!Array.isArray(plan.hotels)) return false
  if (!Array.isArray(plan.itinerary)) return false
  return true
}

function formatNumberString(value, lang) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const normalized = raw.replace(/[.\s]/g, '').replace(/,/g, '')
  if (!/^\d+$/.test(normalized)) return raw
  const n = Number.parseInt(normalized, 10)
  if (!Number.isFinite(n)) return raw
  return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(n)
}

function formatMoneyLike(value, lang) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const match = raw.match(/(\d[\d.,\s]*)/)
  if (!match) return raw
  const formatted = formatNumberString(match[1], lang)
  if (!formatted) return raw
  return raw.replace(match[1], formatted)
}

function safeUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return ''
}

const TripPlanMessage = ({ chatId, content, allowSave = true }) => {
  const notify = useNotify()
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)

  const wrapper = useMemo(() => parseWrapper(content), [content])
  const tripPlan = useMemo(() => {
    if (wrapper?.tripPlan) return wrapper.tripPlan
    return parseTripPlan(content)
  }, [content, wrapper])
  const resp = useMemo(
    () => String(wrapper?.resp || extractPreambleText(content) || '').trim(),
    [content, wrapper],
  )

  if (!tripPlan) return null
  if (!isValidTripPlan(tripPlan)) {
    return (
      <div className="tripPlanCard">
        <div className="tripPlanTitle">{t('trip.invalid')}</div>
        <p className="tripPlanInlineError">{t('trip.try_again')}</p>
      </div>
    )
  }

  const hotels = Array.isArray(tripPlan.hotels) ? tripPlan.hotels : []
  const places = Array.isArray(tripPlan.places_to_visit) ? tripPlan.places_to_visit : []
  const itinerary = Array.isArray(tripPlan.itinerary) ? tripPlan.itinerary : []
  const canSave = allowSave && Number.isFinite(chatId)

  const savePlan = async () => {
    if (!canSave || saving || savedId) return
    const ok = window.confirm(t('trip.confirm_save'))
    if (!ok) return

    setSaving(true)
    try {
      const res = await apiRequestBackend(`/api/chat/${chatId}/trip-plans`, {
        method: 'POST',
        body: { resp, trip_plan: tripPlan },
      })
      setSavedId(res?.tripPlanId || true)
      notify.success(t('trip.saved_ok'))
    } catch (err) {
      notify.error(err?.message || t('trip.saved_fail'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <article className="tripPlanCard">
        {resp ? <p className="tripPlanResp">{resp}</p> : null}

        <div className="tripPlanHeader">
          <h3 className="tripPlanTitle">{tripPlan.destination}</h3>
          <div className="tripPlanMetaChips">
            <span className="tripPlanChip">
              <i className="ti ti-map-pin" />
              {tripPlan.origin}
            </span>
            <span className="tripPlanChip">
              <i className="ti ti-clock-hour-4" />
              {tripPlan.duration}
            </span>
            {tripPlan.budget ? (
              <span className="tripPlanChip">
                <i className="ti ti-wallet" />
                {formatMoneyLike(tripPlan.budget, lang)}
              </span>
            ) : null}
            {tripPlan.group_size ? (
              <span className="tripPlanChip">
                <i className="ti ti-users" />
                {tripPlan.group_size}
              </span>
            ) : null}
            <span className="tripPlanChip">
              <i className="ti ti-building-skyscraper" />
              {hotels.length} {t('trip.meta.hotels')}
            </span>
            <span className="tripPlanChip">
              <i className="ti ti-map-2" />
              {places.length} {t('trip.meta.places')}
            </span>
            <span className="tripPlanChip">
              <i className="ti ti-calendar-week" />
              {itinerary.length} {t('trip.meta.days')}
            </span>
          </div>
        </div>

        <div className="tripPlanActions">
          <button type="button" className="tripPlanBtn" onClick={() => setOpen(true)}>
            <i className="ti ti-eye" />
            {t('trip.view')}
          </button>
          {canSave ? (
            <button
              type="button"
              className="tripPlanBtn tripPlanBtnPrimary"
              onClick={savePlan}
              disabled={saving || Boolean(savedId)}
            >
              <i className="ti ti-device-floppy" />
              {savedId ? t('trip.saved') : saving ? t('trip.saving') : t('trip.save')}
            </button>
          ) : null}
        </div>
      </article>

      {open ? (
        <div className="tripPlanModal" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="tripPlanModalBody" onClick={(e) => e.stopPropagation()}>
            <header className="tripPlanModalTop">
              <div className="tripPlanModalTitleWrap">
                <span className="tripPlanModalLabel">{t('trip.window_title')}</span>
                <h4 className="tripPlanModalTitle">{tripPlan.destination}</h4>
              </div>
              <button type="button" className="tripPlanClose" onClick={() => setOpen(false)} aria-label={t('common.close')}>
                <i className="ti ti-x" />
              </button>
            </header>

            <section className="tripPlanSection">
              <div className="tripPlanSectionHead">
                <i className="ti ti-route-2" />
                <h5>{t('trip.section.info')}</h5>
              </div>
              <div className="tripPlanInfoGrid">
                <div className="tripPlanInfoItem">
                  <span>{t('trip.field.origin')}</span>
                  <strong>{tripPlan.origin}</strong>
                </div>
                <div className="tripPlanInfoItem">
                  <span>{t('trip.field.destination')}</span>
                  <strong>{tripPlan.destination}</strong>
                </div>
                <div className="tripPlanInfoItem">
                  <span>{t('trip.field.duration')}</span>
                  <strong>{tripPlan.duration}</strong>
                </div>
                {tripPlan.budget ? (
                  <div className="tripPlanInfoItem">
                    <span>{t('trip.field.budget')}</span>
                    <strong>{formatMoneyLike(tripPlan.budget, lang)}</strong>
                  </div>
                ) : null}
                {tripPlan.currency ? (
                  <div className="tripPlanInfoItem">
                    <span>{t('trip.field.currency')}</span>
                    <strong>{tripPlan.currency}</strong>
                  </div>
                ) : null}
                {tripPlan.total_estimated_cost ? (
                  <div className="tripPlanInfoItem">
                    <span>{t('trip.field.total')}</span>
                    <strong>{formatMoneyLike(tripPlan.total_estimated_cost, lang)}</strong>
                  </div>
                ) : null}
                {tripPlan.group_size ? (
                  <div className="tripPlanInfoItem">
                    <span>{t('trip.field.group')}</span>
                    <strong>{tripPlan.group_size}</strong>
                  </div>
                ) : null}
              </div>
            </section>

            {hotels.length > 0 ? (
              <section className="tripPlanSection">
                <div className="tripPlanSectionHead">
                  <i className="ti ti-building-skyscraper" />
                  <h5>{t('trip.section.hotels')}</h5>
                </div>
                <div className="tripPlanEntityGrid">
                  {hotels.map((hotel, idx) => {
                    const imageUrl = safeUrl(hotel.hotel_image_url)
                    return (
                      <article key={`hotel-${idx}`} className="tripPlanEntityCard">
                        {imageUrl ? (
                          <img className="tripPlanEntityImg" src={imageUrl} alt={hotel.hotel_name || 'hotel'} />
                        ) : (
                          <div className="tripPlanEntityImg tripPlanEntityImgPlaceholder">
                            <i className="ti ti-photo-off" />
                          </div>
                        )}
                        <div className="tripPlanEntityBody">
                          <h6>{hotel.hotel_name || '-'}</h6>
                          {hotel.hotel_address ? <p>{hotel.hotel_address}</p> : null}
                          {hotel.description ? <p>{hotel.description}</p> : null}
                          <div className="tripPlanEntityTags">
                            {hotel.price_per_night ? (
                              <span>
                                <i className="ti ti-cash" />
                                {formatMoneyLike(hotel.price_per_night, lang)}
                              </span>
                            ) : null}
                            {hotel.rating != null ? (
                              <span>
                                <i className="ti ti-star-filled" />
                                {hotel.rating}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {places.length > 0 ? (
              <section className="tripPlanSection">
                <div className="tripPlanSectionHead">
                  <i className="ti ti-map-pin" />
                  <h5>{t('trip.section.places')}</h5>
                </div>
                <div className="tripPlanEntityGrid">
                  {places.map((place, idx) => {
                    const imageUrl = safeUrl(place.place_image_url)
                    return (
                      <article key={`place-${idx}`} className="tripPlanEntityCard">
                        {imageUrl ? (
                          <img className="tripPlanEntityImg" src={imageUrl} alt={place.place_name || 'place'} />
                        ) : (
                          <div className="tripPlanEntityImg tripPlanEntityImgPlaceholder">
                            <i className="ti ti-photo-off" />
                          </div>
                        )}
                        <div className="tripPlanEntityBody">
                          <h6>{place.place_name || '-'}</h6>
                          {place.place_address ? <p>{place.place_address}</p> : null}
                          {place.place_details ? <p>{place.place_details}</p> : null}
                          <div className="tripPlanEntityTags">
                            {place.ticket_pricing ? (
                              <span>
                                <i className="ti ti-ticket" />
                                {formatMoneyLike(place.ticket_pricing, lang)}
                              </span>
                            ) : null}
                            {place.best_time_to_visit ? (
                              <span>
                                <i className="ti ti-sun" />
                                {place.best_time_to_visit}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ) : null}

            <section className="tripPlanSection">
              <div className="tripPlanSectionHead">
                <i className="ti ti-calendar-event" />
                <h5>{t('trip.section.itinerary')}</h5>
              </div>
              <div className="tripPlanDays">
                {itinerary.map((day, idx) => {
                  const activities = Array.isArray(day.activities) ? day.activities : []
                  return (
                    <article key={`day-${day.day || idx}`} className="tripPlanDayCard">
                      <header className="tripPlanDayHead">
                        <div className="tripPlanDayBadge">D{day.day || idx + 1}</div>
                        <div className="tripPlanDayTitleWrap">
                          <h6>{day.day_plan || `${t('trip.meta.days')} ${day.day || idx + 1}`}</h6>
                          <div className="tripPlanDayMeta">
                            {day.best_time_to_visit_day ? (
                              <span>
                                <i className="ti ti-clock-hour-4" />
                                {day.best_time_to_visit_day}
                              </span>
                            ) : null}
                            {day.estimated_cost ? (
                              <span>
                                <i className="ti ti-cash" />
                                {formatMoneyLike(day.estimated_cost, lang)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </header>

                      {activities.length > 0 ? (
                        <div className="tripPlanActivityList">
                          {activities.map((activity, actIndex) => (
                            <div key={`act-${actIndex}`} className="tripPlanActivityItem">
                              <div className="tripPlanActivityDot" />
                              <div className="tripPlanActivityBody">
                                <strong>{activity.place_name || '-'}</strong>
                                {activity.place_details ? <p>{activity.place_details}</p> : null}
                                <div className="tripPlanActivityTags">
                                  {activity.place_address ? (
                                    <span>
                                      <i className="ti ti-map-pin" />
                                      {activity.place_address}
                                    </span>
                                  ) : null}
                                  {activity.ticket_pricing ? (
                                    <span>
                                      <i className="ti ti-ticket" />
                                      {formatMoneyLike(activity.ticket_pricing, lang)}
                                    </span>
                                  ) : null}
                                  {activity.time_travel_each_location ? (
                                    <span>
                                      <i className="ti ti-route" />
                                      {activity.time_travel_each_location}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="tripPlanEmpty">{t('trip.empty_acts')}</p>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default TripPlanMessage
