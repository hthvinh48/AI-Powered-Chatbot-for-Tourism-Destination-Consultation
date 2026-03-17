import { useMemo, useState } from 'react'
import './tripPlanMessage.css'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../notifications/useNotify'

function extractJsonFromText(text) {
  const s = String(text || '')
  const fence =
    s.match(/```json\s*([\s\S]*?)```/i) ||
    s.match(/```\s*([\s\S]*?)```/i)
  if (fence && fence[1]) return fence[1].trim()

  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first >= 0 && last > first) return s.slice(first, last + 1).trim()
  return null
}

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
  try {
    const obj = JSON.parse(content)
    if (!obj || typeof obj !== 'object') return null
    if (!obj.trip_plan || typeof obj.trip_plan !== 'object') return null
    return obj.trip_plan
  } catch {
    return null
  }
}

function tryParseTripWrapper(content) {
  if (!content || typeof content !== 'string') return null
  try {
    const rawJson = extractJsonFromText(content) || content
    const obj = JSON.parse(rawJson)
    if (!obj || typeof obj !== 'object') return null
    if (!obj.trip_plan || typeof obj.trip_plan !== 'object') return null
    const resp = typeof obj.resp === 'string' ? obj.resp : ''
    return { resp, tripPlan: obj.trip_plan }
  } catch {
    return null
  }
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

function safeUrl(url) {
  const s = String(url || '').trim()
  if (!s) return ''
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  return ''
}

const TripPlanMessage = ({ chatId, content, allowSave = true }) => {
  const notify = useNotify()
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
        <div className="tripPlanTitle">Trip plan JSON không hợp lệ</div>
        <div className="tripPlanSmall">Vui lòng thử generate lại.</div>
      </div>
    )
  }

  const days = Array.isArray(tripPlan.itinerary) ? tripPlan.itinerary.length : 0
  const hotelCount = Array.isArray(tripPlan.hotels) ? tripPlan.hotels.length : 0
  const placesCount = Array.isArray(tripPlan.places_to_visit) ? tripPlan.places_to_visit.length : 0

  const save = async () => {
    if (!canSave || saving || savedId) return
    const ok = window.confirm('Lưu trip plan vào database?')
    if (!ok) return

    setSaving(true)
    try {
      const res = await apiRequestBackend(`/api/chat/${chatId}/trip-plans`, {
        method: 'POST',
        body: { trip_plan: tripPlan },
      })
      setSavedId(res?.tripPlanId || true)
      notify.success('Đã lưu trip plan.')
    } catch (err) {
      notify.error(err?.message || 'Lưu trip plan thất bại')
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
          {tripPlan.origin ? <span>From: {tripPlan.origin}</span> : null}
          {tripPlan.duration ? <span>Duration: {tripPlan.duration}</span> : null}
          {tripPlan.budget ? <span>Budget: {tripPlan.budget}</span> : null}
          {tripPlan.group_size ? <span>Group: {tripPlan.group_size}</span> : null}
          {tripPlan.total_estimated_cost ? <span>Total: {tripPlan.total_estimated_cost}</span> : null}
          <span>Hotels: {hotelCount}</span>
          <span>Places: {placesCount}</span>
          <span>Days: {days}</span>
        </div>
      </div>

      <div className="tripPlanActions">
        <button type="button" className="tripPlanBtn" onClick={() => setOpen(true)}>
          Xem chuyến đi
        </button>
        {canSave ? (
          <button
            type="button"
            className="tripPlanBtn primary"
            onClick={save}
            disabled={saving || Boolean(savedId)}
            title={savedId ? 'Đã lưu' : 'Lưu vào database'}
          >
            {savedId ? 'Đã lưu' : saving ? 'Đang lưu...' : 'Lưu plan'}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="tripPlanModal" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="tripPlanModalBody" onClick={(e) => e.stopPropagation()}>
            <div className="tripPlanModalTop">
              <div className="tripPlanModalTitle">{tripPlan.destination}</div>
              <button className="tripPlanClose" type="button" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="tripPlanSection">
              <div className="tripPlanSectionTitle">Thông tin chuyến đi</div>
              <div className="tripPlanTableWrap">
                <table className="tripPlanTable">
                  <tbody>
                    <tr>
                      <th>Origin</th>
                      <td>{tripPlan.origin}</td>
                    </tr>
                    <tr>
                      <th>Destination</th>
                      <td>{tripPlan.destination}</td>
                    </tr>
                    <tr>
                      <th>Duration</th>
                      <td>{tripPlan.duration}</td>
                    </tr>
                    <tr>
                      <th>Budget</th>
                      <td>{tripPlan.budget || '-'}</td>
                    </tr>
                    <tr>
                      <th>Currency</th>
                      <td>{tripPlan.currency || '-'}</td>
                    </tr>
                    <tr>
                      <th>Total estimated</th>
                      <td>{tripPlan.total_estimated_cost || '-'}</td>
                    </tr>
                    <tr>
                      <th>Group size</th>
                      <td>{tripPlan.group_size || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="tripPlanSection">
              <div className="tripPlanSectionTitle">Hotels</div>
              <div className="tripPlanTableWrap">
                <table className="tripPlanTable">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Hotel</th>
                      <th>Address</th>
                      <th>Price/night</th>
                      <th>Rating</th>
                      <th>Geo</th>
                      <th>Description</th>
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
                        <td>{h.price_per_night || '-'}</td>
                        <td>{h.rating ?? '-'}</td>
                        <td>{geoToText(h.geo_coordinates || h.geo_cordinates) || '-'}</td>
                        <td className="tripPlanClamp">{h.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {Array.isArray(tripPlan.places_to_visit) && tripPlan.places_to_visit.length ? (
              <div className="tripPlanSection">
              <div className="tripPlanSectionTitle">Địa điểm nên đi</div>
              <div className="tripPlanTableWrap">
                <table className="tripPlanTable">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Place</th>
                      <th>Address</th>
                      <th>Ticket</th>
                      <th>Best time</th>
                      <th>Geo</th>
                      <th>Details</th>
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
                        <td>{p.place_address || '-'}</td>
                        <td>{p.ticket_pricing || '-'}</td>
                        <td>{p.best_time_to_visit || '-'}</td>
                        <td>{geoToText(p.geo_coordinates) || '-'}</td>
                        <td className="tripPlanClamp">{p.place_details || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            ) : null}

            <div className="tripPlanSection">
              <div className="tripPlanSectionTitle">Itinerary</div>
              <div className="tripPlanTableWrap">
                <table className="tripPlanTable">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Day plan</th>
                      <th>Best time (day)</th>
                      <th>Estimated cost</th>
                      <th>Place</th>
                      <th>Address</th>
                      <th>Ticket</th>
                      <th>Travel time</th>
                      <th>Best time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tripPlan.itinerary || []).flatMap((d) => {
                      const acts = Array.isArray(d.activities) && d.activities.length ? d.activities : [{}]
                      return acts.map((a, idx) => (
                        <tr key={`day-${d.day}-act-${idx}`}>
                          <td>{d.day ?? '-'}</td>
                          <td className="tripPlanClamp">{d.day_plan || '-'}</td>
                          <td>{d.best_time_to_visit_day || '-'}</td>
                          <td>{d.estimated_cost || '-'}</td>
                          <td>{a.place_name || '-'}</td>
                          <td>{a.place_address || '-'}</td>
                          <td>{a.ticket_pricing || '-'}</td>
                          <td>{a.time_travel_each_location || '-'}</td>
                          <td>{a.best_time_to_visit || '-'}</td>
                        </tr>
                      ))
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
