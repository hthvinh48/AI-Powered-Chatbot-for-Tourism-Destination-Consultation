import { Fragment, useMemo, useState } from 'react'
import './tripPlanMessage.css'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../notifications/useNotify'
import { useI18n } from '../../lib/useI18n'
import { extractJsonFromText, safeJsonParse, looksLikeTripPlan } from '../../lib/tolerantJson'

function extractPreambleText(text) {
  const s = String(text || '').trim()
  if (!s) return ''
  const idx = s.search(/```json/i)
  if (idx >= 0) return s.slice(0, idx).trim()
  const idx2 = s.indexOf('```')
  if (idx2 >= 0) return s.slice(0, idx2).trim()
  return ''
}

function tryParseTripPlan(content) {
  if (!content || typeof content !== 'string') return null
  const obj = safeJsonParse(content)
  if (!obj || typeof obj !== 'object') return null
  if (obj.trip_plan && typeof obj.trip_plan === 'object') return obj.trip_plan
  if (looksLikeTripPlan(obj)) return obj
  return null
}

function tryParseTripWrapper(content) {
  if (!content || typeof content !== 'string') return null
  const rawJson = extractJsonFromText(content) || content
  const obj = safeJsonParse(rawJson)
  if (!obj || typeof obj !== 'object') return null
  if (!obj.trip_plan || typeof obj.trip_plan !== 'object') return null
  const resp = typeof obj.resp === 'string' ? obj.resp : ''
  return { resp, tripPlan: obj.trip_plan }
}

function isValidTripPlan(tripPlan) {
  if (!tripPlan || typeof tripPlan !== 'object') return false
  if (typeof tripPlan.destination !== 'string' || !tripPlan.destination.trim()) return false
  if (typeof tripPlan.origin !== 'string' || !tripPlan.origin.trim()) return false
  if (typeof tripPlan.duration !== 'string' || !tripPlan.duration.trim()) return false
  if (!Array.isArray(tripPlan.hotels)) return false
  if (!Array.isArray(tripPlan.itinerary)) return false
  return true
}

function geoToText(geo) {
  if (!geo || typeof geo !== 'object') return ''
  const lat = typeof geo.latitude === 'number' ? geo.latitude : null
  const lng = typeof geo.longitude === 'number' ? geo.longitude : null
  if (lat === null || lng === null) return ''
  return `${lat}, ${lng}`
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

function safeUrl(url) {
  const s = String(url || '').trim()
  if (!s) return ''
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  return ''
}

const TripPlanMessage = ({ chatId, content, allowSave = true }) => {
  const notify = useNotify()
  const { t, lang } = useI18n()
  const wrapper = useMemo(() => tryParseTripWrapper(content), [content])
  const preamble = useMemo(() => extractPreambleText(content), [content])
  const tripPlan = useMemo(() => {
    if (wrapper?.tripPlan) return wrapper.tripPlan
    const rawJson = extractJsonFromText(content)
    if (rawJson) {
      const parsed = tryParseTripPlan(rawJson)
      if (parsed) return parsed
    }
    return tryParseTripPlan(content)
  }, [content, wrapper])
  const resp = (wrapper?.resp || preamble || '').trim()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const canSave = allowSave && Number.isFinite(chatId)

  if (!tripPlan) return null
  if (!isValidTripPlan(tripPlan)) {
    return (
      <div className="tripPlanCard">
        <div className="tripPlanTitle">{t('trip.invalid')}</div>
        <div className="tripPlanSmall">{t('trip.try_again')}</div>
      </div>
    )
  }

  const days = Array.isArray(tripPlan.itinerary) ? tripPlan.itinerary.length : 0
  const hotelCount = Array.isArray(tripPlan.hotels) ? tripPlan.hotels.length : 0
  const placesCount = Array.isArray(tripPlan.places_to_visit) ? tripPlan.places_to_visit.length : 0

  const save = async () => {
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
    <div className="tripPlanCard">
      {resp ? <div className="tripPlanResp">{resp}</div> : null}
      <div className="tripPlanHeader">
        <div className="tripPlanTitle">{tripPlan.destination}</div>
        <div className="tripPlanMeta">
          {tripPlan.origin ? <span>{t('trip.field.origin')}: {tripPlan.origin}</span> : null}
          {tripPlan.duration ? <span>{t('trip.field.duration')}: {tripPlan.duration}</span> : null}
          {tripPlan.budget ? <span>{t('trip.field.budget')}: {formatMoneyLike(tripPlan.budget, lang)}</span> : null}
          {tripPlan.group_size ? <span>{t('trip.field.group')}: {tripPlan.group_size}</span> : null}
          {tripPlan.total_estimated_cost ? (
            <span>{t('trip.field.total')}: {formatMoneyLike(tripPlan.total_estimated_cost, lang)}</span>
          ) : null}
          <span>{t('trip.meta.hotels')}: {hotelCount}</span>
          <span>{t('trip.meta.places')}: {placesCount}</span>
          <span>{t('trip.meta.days')}: {days}</span>
        </div>
      </div>

      <div className="tripPlanActions">
        <button type="button" className="tripPlanBtn" onClick={() => setOpen(true)}>
          {t('trip.view')}
        </button>
        {canSave ? (
          <button
            type="button"
            className="tripPlanBtn primary"
            onClick={save}
            disabled={saving || Boolean(savedId)}
            title={savedId ? t('trip.saved') : t('trip.save')}
          >
            {savedId ? t('trip.saved') : saving ? t('trip.saving') : t('trip.save')}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="tripPlanModal" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="tripPlanModalBody" onClick={(e) => e.stopPropagation()}>
            <div className="tripPlanModalTop">
              <div className="tripPlanModalTitle">{t('trip.window_title')}: {tripPlan.destination}</div>
              <button className="tripPlanClose" type="button" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="tripPlanSection">
              <div className="tripPlanSectionTitle">{t('trip.section.info')}</div>
              <div className="tripPlanTableWrap">
                <table className="tripPlanTable tripPlanKv">
                  <tbody>
                    <tr>
                      <th>{t('trip.field.origin')}</th>
                      <td>{tripPlan.origin}</td>
                    </tr>
                    <tr>
                      <th>{t('trip.field.destination')}</th>
                      <td>{tripPlan.destination}</td>
                    </tr>
                    <tr>
                      <th>{t('trip.field.duration')}</th>
                      <td>{tripPlan.duration}</td>
                    </tr>
                    <tr>
                      <th>{t('trip.field.budget')}</th>
                      <td>{tripPlan.budget ? formatMoneyLike(tripPlan.budget, lang) : '-'}</td>
                    </tr>
                    <tr>
                      <th>{t('trip.field.currency')}</th>
                      <td>{tripPlan.currency || '-'}</td>
                    </tr>
                    <tr>
                      <th>{t('trip.field.total')}</th>
                      <td>{tripPlan.total_estimated_cost ? formatMoneyLike(tripPlan.total_estimated_cost, lang) : '-'}</td>
                    </tr>
                    <tr>
                      <th>{t('trip.field.group')}</th>
                      <td>{tripPlan.group_size || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="tripPlanSection">
              <div className="tripPlanSectionTitle">{t('trip.section.hotels')}</div>
              <div className="tripPlanTableWrap">
                <table className="tripPlanTable">
                  <thead>
                    <tr>
                      <th>{t('trip.table.image')}</th>
                      <th>{t('trip.table.hotel')}</th>
                      <th>{t('trip.table.address')}</th>
                      <th>{t('trip.table.price')}</th>
                      <th>{t('trip.table.rating')}</th>
                      <th>{t('trip.table.geo')}</th>
                      <th>{t('trip.table.desc')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tripPlan.hotels || []).map((h, idx) => (
                      <tr key={`${h.hotel_name || 'hotel'}-${idx}`}>
                        <td>
                          {safeUrl(h.hotel_image_url) ? (
                            <img className="tripPlanThumb" src={safeUrl(h.hotel_image_url)} alt={h.hotel_name || 'hotel'} />
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{h.hotel_name || '-'}</td>
                        <td>{h.hotel_address || '-'}</td>
                        <td>{h.price_per_night ? formatMoneyLike(h.price_per_night, lang) : '-'}</td>
                        <td>{h.rating ?? '-'}</td>
                        <td>{geoToText(h.geo_coordinates || h.geo_cordinates) || '-'}</td>
                        <td className="tripPlanWrap">{h.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {Array.isArray(tripPlan.places_to_visit) && tripPlan.places_to_visit.length ? (
              <div className="tripPlanSection">
                <div className="tripPlanSectionTitle">{t('trip.section.places')}</div>
                <div className="tripPlanTableWrap">
                  <table className="tripPlanTable">
                    <thead>
                      <tr>
                        <th>{t('trip.table.image')}</th>
                        <th>{t('trip.table.place')}</th>
                        <th>{t('trip.table.address')}</th>
                        <th>{t('trip.table.ticket')}</th>
                        <th>{t('trip.table.best_time')}</th>
                        <th>{t('trip.table.geo')}</th>
                        <th>{t('trip.table.details')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tripPlan.places_to_visit || []).map((p, idx) => (
                        <tr key={`${p.place_name || 'place'}-${idx}`}>
                          <td>
                            {safeUrl(p.place_image_url) ? (
                              <img className="tripPlanThumb" src={safeUrl(p.place_image_url)} alt={p.place_name || 'place'} />
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>{p.place_name || '-'}</td>
                          <td className="tripPlanWrap">{p.place_address || '-'}</td>
                          <td>{p.ticket_pricing ? formatMoneyLike(p.ticket_pricing, lang) : '-'}</td>
                          <td>{p.best_time_to_visit || '-'}</td>
                          <td>{geoToText(p.geo_coordinates) || '-'}</td>
                          <td className="tripPlanWrap">{p.place_details || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="tripPlanSection">
              <div className="tripPlanSectionTitle">{t('trip.section.itinerary')}</div>
              <div className="tripPlanTableWrap">
                <table className="tripPlanTable">
                  <thead>
                    <tr>
                      <th>{t('trip.table.place')}</th>
                      <th>{t('trip.table.details')}</th>
                      <th>{t('trip.table.address')}</th>
                      <th>{t('trip.table.ticket')}</th>
                      <th>{t('trip.table.travel')}</th>
                      <th>{t('trip.table.best_time')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tripPlan.itinerary || []).map((d) => {
                      const acts = Array.isArray(d.activities) ? d.activities : []
                      const metaParts = [
                        d.best_time_to_visit_day ? `${t('trip.day.best_time')}: ${d.best_time_to_visit_day}` : null,
                        d.estimated_cost ? `${t('trip.day.cost')}: ${formatMoneyLike(d.estimated_cost, lang)}` : null,
                      ].filter(Boolean)

                      return (
                        <Fragment key={`day-${d.day}`}>
                          <tr className="tripPlanDayRow">
                            <td colSpan={6}>
                              <div className="tripPlanDayHeader">
                                Day {d.day}
                                {metaParts.length ? <span className="tripPlanDayMeta"> — {metaParts.join(' • ')}</span> : null}
                              </div>
                              {d.day_plan ? <div className="tripPlanWrap">{d.day_plan}</div> : null}
                            </td>
                          </tr>

                          {acts.length ? (
                            acts.map((a, idx) => (
                              <tr key={`day-${d.day}-act-${idx}`}>
                                <td>{a.place_name || '-'}</td>
                                <td className="tripPlanWrap">{a.place_details || '-'}</td>
                                <td className="tripPlanWrap">{a.place_address || '-'}</td>
                                <td>{a.ticket_pricing ? formatMoneyLike(a.ticket_pricing, lang) : '-'}</td>
                                <td>{a.time_travel_each_location || '-'}</td>
                                <td>{a.best_time_to_visit || '-'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="tripPlanEmpty">
                                {t('trip.empty_acts')}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default TripPlanMessage
