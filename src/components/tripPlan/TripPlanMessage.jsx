import { useEffect, useMemo, useState } from 'react'
import './tripPlanMessage.css'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../notifications/useNotify'
import { useI18n } from '../../lib/useI18n'
import { extractJsonFromText, looksLikeTripPlan, safeJsonParse } from '../../lib/tolerantJson'
import { createTripPlanKey, emitTripPlansChanged } from '../../lib/tripPlanState'
import useActionDialog from '../dialogs/useActionDialog'

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
  const normalized = raw.replace(match[1], formatted)
  return normalized
    .replace(/(\d)([A-Za-zÂÀ-ỹ₫$€£¥])/g, '$1 $2')
    .replace(/([A-Za-zÂÀ-ỹ₫$€£¥])(\d)/g, '$1 $2')
}

function safeUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return ''
}

const TripPlanMessage = ({ chatId, content, allowSave = true, savedTripKeys = null }) => {
  const notify = useNotify()
  const { t, lang } = useI18n()
  const { askConfirm, dialogNode } = useActionDialog()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedLocally, setSavedLocally] = useState(false)
  const [brokenImages, setBrokenImages] = useState({})
  const [galleryOpen, setGalleryOpen] = useState(false)

  const [galleryImages, setGalleryImages] = useState([])

  const [galleryIndex, setGalleryIndex] = useState(0)

  const wrapper = useMemo(() => parseWrapper(content), [content])
  const tripPlan = useMemo(() => {
    if (wrapper?.tripPlan) return wrapper.tripPlan
    return parseTripPlan(content)
  }, [content, wrapper])
  const resp = useMemo(
    () => String(wrapper?.resp || extractPreambleText(content) || '').trim(),
    [content, wrapper],
  )
  const canSave = allowSave && Number.isFinite(chatId)
  const tripPlanKey = useMemo(() => createTripPlanKey(chatId, tripPlan), [chatId, tripPlan])
  const isSavedFromServer = useMemo(() => {
    if (!(savedTripKeys instanceof Set)) return false
    if (!tripPlanKey) return false
    return savedTripKeys.has(tripPlanKey)
  }, [savedTripKeys, tripPlanKey])
  const isSaved = savedLocally || isSavedFromServer

  useEffect(() => {
    setSavedLocally(false)
    setBrokenImages({})
  }, [chatId, content])

  useEffect(() => {
    if (!isSavedFromServer) setSavedLocally(false)
  }, [isSavedFromServer])

  if (!tripPlan) return null
  if (!isValidTripPlan(tripPlan)) {
    if (resp) {
      return (
        <article className="tripPlanCard">
          <p className="tripPlanResp">{resp}</p>
        </article>
      )
    }

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

  const infoItems = [
    {
      key: 'origin',
      icon: 'ti ti-map-pin',
      label: t('trip.field.origin'),
      value: tripPlan.origin,
    },
    {
      key: 'destination',
      icon: 'ti ti-route-2',
      label: t('trip.field.destination'),
      value: tripPlan.destination,
    },
    {
      key: 'duration',
      icon: 'ti ti-clock-hour-4',
      label: t('trip.field.duration'),
      value: tripPlan.duration,
    },
    {
      key: 'budget',
      icon: 'ti ti-wallet',
      label: t('trip.field.budget'),
      value: tripPlan.budget ? formatMoneyLike(tripPlan.budget, lang) : '',
    },
    {
      key: 'currency',
      icon: 'ti ti-currency-dollar',
      label: t('trip.field.currency'),
      value: tripPlan.currency,
    },
    {
      key: 'total',
      icon: 'ti ti-cash-banknote',
      label: t('trip.field.total'),
      value: tripPlan.total_estimated_cost ? formatMoneyLike(tripPlan.total_estimated_cost, lang) : '',
    },
    {
      key: 'group',
      icon: 'ti ti-users',
      label: t('trip.field.group'),
      value: tripPlan.group_size,
    },
  ].filter((item) => String(item.value || '').trim())

  const modalMetaItems = [
    {
      key: 'duration',
      icon: 'ti ti-clock-hour-4',
      value: tripPlan.duration,
    },
    tripPlan.group_size
      ? {
        key: 'group',
        icon: 'ti ti-users',
        value: tripPlan.group_size,
      }
      : null,
    tripPlan.total_estimated_cost
      ? {
        key: 'total',
        icon: 'ti ti-cash-banknote',
        value: formatMoneyLike(tripPlan.total_estimated_cost, lang),
      }
      : null,
  ].filter(Boolean)

  const markImageBroken = (key) => {
    setBrokenImages((prev) => {
      if (prev[key]) return prev
      return { ...prev, [key]: true }
    })
  }

  const savePlan = async () => {
    if (!canSave || saving || isSaved) return
    const ok = await askConfirm({
      title: t('common.confirm'),
      message: t('trip.confirm_save'),
      confirmText: t('trip.save'),
      tone: 'info',
      confirmVariant: 'primary',
    })
    if (!ok) return

    setSaving(true)
    try {
      const res = await apiRequestBackend(`/api/chat/${chatId}/trip-plans`, {
        method: 'POST',
        body: { resp, trip_plan: tripPlan },
      })
      setSavedLocally(true)
      emitTripPlansChanged({ type: 'saved', chatId, tripPlanId: res?.tripPlanId ?? null })
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
              disabled={saving || isSaved}
            >
              <i className="ti ti-device-floppy" />
              {isSaved ? t('trip.saved') : saving ? t('trip.saving') : t('trip.save')}
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
                <div className="tripPlanRouteLine">
                  <span>{tripPlan.origin}</span>
                  <i className="ti ti-arrow-right" />
                  <span>{tripPlan.destination}</span>
                </div>
                {modalMetaItems.length > 0 ? (
                  <div className="tripPlanModalMetaStrip">
                    {modalMetaItems.map((item) => (
                      <span key={item.key}>
                        <i className={item.icon} />
                        {item.value}
                      </span>
                    ))}
                  </div>
                ) : null}
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
                {infoItems.map((item) => (
                  <div key={item.key} className="tripPlanInfoItem">
                    <div className="tripPlanInfoLabel">
                      <i className={item.icon} />
                      <span>{item.label}</span>
                    </div>
                    <strong>{item.value}</strong>
                  </div>
                ))}
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
                    const images = Array.isArray(hotel.images)
                      ? hotel.images
                      : []

                    if (
                      images.length === 0 &&
                      (hotel.hotel_image_url ||
                        hotel.image_url)
                    ) {
                      images.push({
                        thumbnail:
                          hotel.hotel_image_url ||
                          hotel.image_url,
                        original:
                          hotel.hotel_image_url ||
                          hotel.image_url,
                      })
                    }

                    const cover =
                      images?.[0]?.thumbnail ||
                      images?.[0]?.original ||
                      ''

                    const imageUrl = safeUrl(cover)
                    const imageKey = `hotel-${idx}-${imageUrl || 'none'}`
                    const showImage = Boolean(imageUrl) && !brokenImages[imageKey]

                    return (
                      <article key={`hotel-${idx}`} className="tripPlanEntityCard">
                        <div className="tripPlanEntityMedia">
                          {showImage ? (
                            <>
                              <img
                                className="tripPlanEntityImg"
                                src={imageUrl}
                                alt={hotel.hotel_name || 'hotel'}
                                loading="lazy"
                                onError={() => markImageBroken(imageKey)}
                              />
                              {images.length > 1 ? (
                                <button
                                  type="button"
                                  className="tripPlanGalleryBtn"
                                  onClick={() => {
                                    setGalleryImages(images)
                                    setGalleryIndex(0)
                                    setGalleryOpen(true)
                                  }}
                                >
                                  +
                                  {images.length - 1} ảnh
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <div className="tripPlanEntityImg tripPlanEntityImgPlaceholder">
                              <i className="ti ti-photo-off" />
                              <span>{hotel.hotel_name || '-'}</span>
                            </div>
                          )}
                        </div>
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
                    /**
                     * support:
                     * images[]
                     * image_url
                     * place_image_url
                     */
                    const images = Array.isArray(place.images)
                      ? place.images
                      : []

                    if (
                      images.length === 0 &&
                      (place.image_url ||
                        place.place_image_url)
                    ) {
                      images.push({
                        thumbnail:
                          place.image_url ||
                          place.place_image_url,

                        original:
                          place.image_url ||
                          place.place_image_url,
                      })
                    }

                    const cover =
                      images?.[0]?.thumbnail ||
                      images?.[0]?.original ||
                      ''

                    const imageUrl =
                      safeUrl(cover)

                    const imageKey = `place-${idx}-${imageUrl || 'none'}`

                    const showImage =
                      Boolean(imageUrl) &&
                      !brokenImages[imageKey]

                    return (
                      <article
                        key={`place-${idx}`}
                        className="tripPlanEntityCard"
                      >
                        {/* IMAGE */}
                        <div className="tripPlanEntityMedia">
                          {showImage ? (
                            <>
                              <img
                                className="tripPlanEntityImg"
                                src={imageUrl}
                                alt={
                                  place.place_name ||
                                  'place'
                                }
                                loading="lazy"
                                onError={() =>
                                  markImageBroken(
                                    imageKey
                                  )
                                }
                              />

                              {/* MORE IMAGES */}
                              {images.length > 1 ? (
                                <button
                                  type="button"
                                  className="tripPlanGalleryBtn"
                                  onClick={() => {
                                    setGalleryImages(
                                      images
                                    )

                                    setGalleryIndex(
                                      0
                                    )

                                    setGalleryOpen(
                                      true
                                    )
                                  }}
                                >
                                  +
                                  {images.length - 1}{' '}
                                  ảnh
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <div className="tripPlanEntityImg tripPlanEntityImgPlaceholder">
                              <i className="ti ti-photo-off" />

                              <span>
                                {place.place_name ||
                                  '-'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* BODY */}
                        <div className="tripPlanEntityBody">
                          <h6>
                            {place.place_name ||
                              '-'}
                          </h6>

                          {place.place_address ? (
                            <div className="tripPlanEntityAddress">
                              <i className="ti ti-map-2" />

                              <span>
                                {
                                  place.place_address
                                }
                              </span>
                            </div>
                          ) : null}

                          {place.place_details ? (
                            <p className="tripPlanEntityDescription">
                              {
                                place.place_details
                              }
                            </p>
                          ) : null}

                          <div className="tripPlanEntityTags">
                            {place.ticket_pricing ? (
                              <span>
                                <i className="ti ti-ticket" />

                                {formatMoneyLike(
                                  place.ticket_pricing,
                                  lang
                                )}
                              </span>
                            ) : null}

                            {place.best_time_to_visit ? (
                              <span>
                                <i className="ti ti-sun" />

                                {
                                  place.best_time_to_visit
                                }
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
      {galleryOpen ? (
        <div
          className="tripPlanGalleryModal"
          onClick={() =>
            setGalleryOpen(false)
          }
        >
          <div
            className="tripPlanGalleryContent"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <button
              type="button"
              className="tripPlanGalleryClose"
              onClick={() =>
                setGalleryOpen(false)
              }
            >
              <i className="ti ti-x" />
            </button>

            {/* MAIN IMAGE */}
            <img
              className="tripPlanGalleryMainImg"
              src={
                galleryImages[
                  galleryIndex
                ]?.original ||
                galleryImages[
                  galleryIndex
                ]?.thumbnail
              }
              alt="gallery"
            />

            {/* THUMBS */}
            <div className="tripPlanGalleryThumbs">
              {galleryImages.map(
                (img, i) => (
                  <img
                    key={i}
                    className={`tripPlanGalleryThumb ${galleryIndex === i
                        ? 'active'
                        : ''
                      }`}
                    src={
                      img.thumbnail
                    }
                    alt=""
                    onClick={() =>
                      setGalleryIndex(
                        i
                      )
                    }
                  />
                )
              )}
            </div>
          </div>
        </div>
      ) : null}
      {dialogNode}
    </>
  )
}

export default TripPlanMessage
