// TripPlanMessage.jsx — redesigned layout
// Drop-in replacement. Keeps all logic; rewrites only the JSX + inlined styles.
// External deps: same as before (apiRequestBackend, useNotify, useI18n, tolerantJson)

import { Fragment, useMemo, useState } from 'react'
import { apiRequestBackend } from '../../lib/apiClient'
import { useNotify } from '../notifications/useNotify'
import { useI18n } from '../../lib/useI18n'
import { extractJsonFromText, safeJsonParse, looksLikeTripPlan } from '../../lib/tolerantJson'

/* ─── helpers (unchanged) ─────────────────────────────────────────── */
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
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
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

/* ─── icon helpers ────────────────────────────────────────────────── */
const Icon = ({ d, size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}>
    <path d={d} />
  </svg>
)
const icons = {
  pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  clock: 'M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-14v4l3 3',
  wallet: 'M21 12V7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a2 2 0 0 0 0 4h4v-4h-4z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  hotel: 'M3 22V10l9-7 9 7v12 M9 22V14h6v8',
  map: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zm7-4v16m8-12v16',
  ticket: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-13v2m0 14v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  close: 'M18 6 6 18M6 6l12 12',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  road: 'M3 17h2l2-8h10l2 8h2 M8 17l1-4h6l1 4',
}

/* ─── CSS ─────────────────────────────────────────────────────────── */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:ital,wght@0,400;0,500;1,400&display=swap');

.tp-root * { box-sizing: border-box; }

/* ── Preview card ── */
.tp-card {
  font-family: 'DM Sans', sans-serif;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  padding: 22px 24px 20px;
  position: relative;
  overflow: hidden;
}
.tp-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, #f97316, #ec4899, #8b5cf6);
  border-radius: 20px 20px 0 0;
}
.tp-resp {
  font-size: 14px;
  line-height: 1.55;
  margin-bottom: 14px;
  opacity: .9;
}
.tp-dest {
  font-family: 'Sora', sans-serif;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -.4px;
  margin-bottom: 14px;
}
.tp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.tp-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--surface-3);
  border: 1px solid var(--glass-border);
  opacity: .9;
}
.tp-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.tp-btn {
  font-family: 'DM Sans', sans-serif;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--control-border);
  background: var(--control-bg);
  color: inherit;
  transition: transform .15s, opacity .15s;
}
.tp-btn:hover { transform: translateY(-1px); opacity: .85; }
.tp-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }
.tp-btn.primary {
  background: linear-gradient(135deg, #f97316, #ec4899);
  border-color: transparent;
  color: #fff;
}

/* ── Modal ── */
.tp-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 9999;
  animation: tp-fade-in .2s ease;
}
@keyframes tp-fade-in { from { opacity:0 } to { opacity:1 } }

.tp-modal {
  font-family: 'DM Sans', sans-serif;
  width: min(900px, 94vw);
  max-height: 90vh;
  overflow-y: auto;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  padding: 0;
  box-shadow: 0 30px 80px rgba(0,0,0,.4);
  animation: tp-slide-up .22s cubic-bezier(.22,.68,0,1.2);
}
@keyframes tp-slide-up { from { transform: translateY(24px); opacity:0 } to { transform:none; opacity:1 } }

/* Modal header */
.tp-mhead {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--surface-2);
  border-bottom: 1px solid var(--glass-border);
  padding: 18px 20px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 24px 24px 0 0;
}
.tp-mhead-left { display: flex; flex-direction: column; gap: 2px; }
.tp-mlabel {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .8px;
  text-transform: uppercase;
  opacity: .5;
}
.tp-mtitle {
  font-family: 'Sora', sans-serif;
  font-size: 18px;
  font-weight: 800;
}
.tp-close {
  width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--control-border);
  background: var(--control-bg);
  color: inherit;
  border-radius: 10px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background .15s;
}
.tp-close:hover { background: var(--surface-3); }

.tp-mbody { padding: 24px; display: flex; flex-direction: column; gap: 36px; }

/* Section */
.tp-section {}
.tp-section-hd {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.tp-section-icon {
  width: 30px; height: 30px;
  border-radius: 8px;
  background: linear-gradient(135deg, #f97316, #ec4899);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.tp-section-title {
  font-family: 'Sora', sans-serif;
  font-size: 15px;
  font-weight: 700;
}

/* Info grid */
.tp-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}
.tp-info-cell {
  background: var(--surface-3);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 14px 16px;
}
.tp-info-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .5px;
  text-transform: uppercase;
  opacity: .5;
  margin-bottom: 6px;
}
.tp-info-val {
  font-size: 14px;
  font-weight: 600;
}

/* Hotel / place cards */
.tp-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
}
.tp-item-card {
  background: var(--surface-3);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.tp-item-img {
  width: 100%;
  height: 130px;
  object-fit: cover;
  background: var(--surface-2);
}
.tp-item-img-placeholder {
  width: 100%;
  height: 130px;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: .3;
}
.tp-item-body { padding: 14px 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
.tp-item-name {
  font-family: 'Sora', sans-serif;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
}
.tp-item-row {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 12px;
  opacity: .75;
  line-height: 1.4;
}
.tp-item-row svg { margin-top: 1px; }
.tp-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(249,115,22,.15);
  color: #f97316;
  margin-top: auto;
  align-self: flex-start;
}

/* Itinerary */
.tp-day-block {
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  overflow: hidden;
}
.tp-day-hd {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: var(--surface-3);
  border-bottom: 1px solid var(--glass-border);
}
.tp-day-num {
  font-family: 'Sora', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .5px;
  text-transform: uppercase;
  width: 44px; height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f97316, #ec4899);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.tp-day-info { flex: 1; }
.tp-day-plan {
  font-size: 13px;
  line-height: 1.5;
  margin-top: 2px;
  opacity: .8;
}
.tp-day-metas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.tp-day-meta-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  opacity: .85;
}
.tp-acts { padding: 0; }
.tp-act-item {
  display: flex;
  gap: 14px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--glass-border);
  align-items: flex-start;
}
.tp-act-item:last-child { border-bottom: none; }
.tp-act-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #f97316;
  flex-shrink: 0;
  margin-top: 6px;
}
.tp-act-content { flex: 1; min-width: 0; }
.tp-act-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 5px;
}
.tp-act-detail {
  font-size: 12px;
  opacity: .7;
  line-height: 1.5;
  margin-bottom: 8px;
  white-space: pre-wrap;
  word-break: break-word;
}
.tp-act-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tp-act-tag {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  opacity: .8;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.tp-empty-acts {
  padding: 16px;
  font-size: 13px;
  opacity: .5;
  text-align: center;
}
`

/* ─── sub-components ──────────────────────────────────────────────── */
function InfoGrid({ tripPlan, lang, t }) {
  const fields = [
    { label: t('trip.field.origin'), value: tripPlan.origin, icon: icons.pin },
    { label: t('trip.field.destination'), value: tripPlan.destination, icon: icons.map },
    { label: t('trip.field.duration'), value: tripPlan.duration, icon: icons.clock },
    { label: t('trip.field.budget'), value: tripPlan.budget ? formatMoneyLike(tripPlan.budget, lang) : null, icon: icons.wallet },
    { label: t('trip.field.currency'), value: tripPlan.currency, icon: null },
    { label: t('trip.field.total'), value: tripPlan.total_estimated_cost ? formatMoneyLike(tripPlan.total_estimated_cost, lang) : null, icon: icons.wallet },
    { label: t('trip.field.group'), value: tripPlan.group_size, icon: icons.users },
  ].filter(f => f.value)

  return (
    <div className="tp-info-grid">
      {fields.map(f => (
        <div className="tp-info-cell" key={f.label}>
          <div className="tp-info-label">{f.label}</div>
          <div className="tp-info-val">{f.value}</div>
        </div>
      ))}
    </div>
  )
}

function HotelCard({ h, lang, t }) {
  const img = safeUrl(h.hotel_image_url)
  return (
    <div className="tp-item-card">
      {img
        ? <img className="tp-item-img" src={img} alt={h.hotel_name || 'hotel'} />
        : <div className="tp-item-img-placeholder"><Icon d={icons.hotel} size={32} /></div>
      }
      <div className="tp-item-body">
        <div className="tp-item-name">{h.hotel_name || '—'}</div>
        {h.hotel_address && (
          <div className="tp-item-row">
            <Icon d={icons.pin} size={12} />
            <span>{h.hotel_address}</span>
          </div>
        )}
        {h.description && (
          <div className="tp-item-row" style={{ opacity: .65 }}>{h.description}</div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {h.price_per_night && (
            <span className="tp-badge">
              <Icon d={icons.wallet} size={10} />
              {formatMoneyLike(h.price_per_night, lang)}
            </span>
          )}
          {h.rating != null && (
            <span className="tp-badge" style={{ background: 'rgba(234,179,8,.15)', color: '#ca8a04' }}>
              <Icon d={icons.star} size={10} />
              {h.rating}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function PlaceCard({ p, lang, t }) {
  const img = safeUrl(p.place_image_url)
  return (
    <div className="tp-item-card">
      {img
        ? <img className="tp-item-img" src={img} alt={p.place_name || 'place'} />
        : <div className="tp-item-img-placeholder"><Icon d={icons.map} size={32} /></div>
      }
      <div className="tp-item-body">
        <div className="tp-item-name">{p.place_name || '—'}</div>
        {p.place_address && (
          <div className="tp-item-row">
            <Icon d={icons.pin} size={12} />
            <span>{p.place_address}</span>
          </div>
        )}
        {p.place_details && (
          <div className="tp-item-row" style={{ opacity: .65 }}>{p.place_details}</div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {p.ticket_pricing && (
            <span className="tp-badge">
              <Icon d={icons.ticket} size={10} />
              {formatMoneyLike(p.ticket_pricing, lang)}
            </span>
          )}
          {p.best_time_to_visit && (
            <span className="tp-badge" style={{ background: 'rgba(139,92,246,.15)', color: '#7c3aed' }}>
              <Icon d={icons.sun} size={10} />
              {p.best_time_to_visit}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function DayBlock({ d, lang, t }) {
  const acts = Array.isArray(d.activities) ? d.activities : []
  return (
    <div className="tp-day-block">
      <div className="tp-day-hd">
        <div className="tp-day-num">D{d.day}</div>
        <div className="tp-day-info">
          {d.day_plan && <div className="tp-day-plan">{d.day_plan}</div>}
          <div className="tp-day-metas">
            {d.best_time_to_visit_day && (
              <span className="tp-day-meta-chip">⏰ {d.best_time_to_visit_day}</span>
            )}
            {d.estimated_cost && (
              <span className="tp-day-meta-chip">💰 {formatMoneyLike(d.estimated_cost, lang)}</span>
            )}
          </div>
        </div>
      </div>
      <div className="tp-acts">
        {acts.length ? acts.map((a, idx) => (
          <div className="tp-act-item" key={`act-${idx}`}>
            <div className="tp-act-dot" />
            <div className="tp-act-content">
              <div className="tp-act-name">{a.place_name || '—'}</div>
              {a.place_details && <div className="tp-act-detail">{a.place_details}</div>}
              <div className="tp-act-tags">
                {a.place_address && (
                  <span className="tp-act-tag"><Icon d={icons.pin} size={10} />{a.place_address}</span>
                )}
                {a.ticket_pricing && (
                  <span className="tp-act-tag"><Icon d={icons.ticket} size={10} />{formatMoneyLike(a.ticket_pricing, lang)}</span>
                )}
                {a.time_travel_each_location && (
                  <span className="tp-act-tag"><Icon d={icons.road} size={10} />{a.time_travel_each_location}</span>
                )}
                {a.best_time_to_visit && (
                  <span className="tp-act-tag"><Icon d={icons.clock} size={10} />{a.best_time_to_visit}</span>
                )}
              </div>
            </div>
          </div>
        )) : (
          <div className="tp-empty-acts">{t('trip.empty_acts')}</div>
        )}
      </div>
    </div>
  )
}

function SectionHead({ iconPath, title }) {
  return (
    <div className="tp-section-hd">
      <div className="tp-section-icon">
        <Icon d={iconPath} size={15} color="#fff" />
      </div>
      <span className="tp-section-title">{title}</span>
    </div>
  )
}

/* ─── main component ──────────────────────────────────────────────── */
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
      <div className="tp-root tp-card">
        <style>{css}</style>
        <div className="tp-dest">{t('trip.invalid')}</div>
        <div style={{ fontSize: 13, opacity: .7 }}>{t('trip.try_again')}</div>
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
    <div className="tp-root">
      <style>{css}</style>

      {/* ── preview card ── */}
      <div className="tp-card">
        {resp && <div className="tp-resp">{resp}</div>}
        <div className="tp-dest">{tripPlan.destination}</div>

        <div className="tp-chips">
          {tripPlan.origin && <span className="tp-chip"><Icon d={icons.pin} size={12} />{tripPlan.origin}</span>}
          {tripPlan.duration && <span className="tp-chip"><Icon d={icons.clock} size={12} />{tripPlan.duration}</span>}
          {tripPlan.budget && <span className="tp-chip"><Icon d={icons.wallet} size={12} />{formatMoneyLike(tripPlan.budget, lang)}</span>}
          {tripPlan.group_size && <span className="tp-chip"><Icon d={icons.users} size={12} />{tripPlan.group_size}</span>}
          {hotelCount > 0 && <span className="tp-chip"><Icon d={icons.hotel} size={12} />{hotelCount} {t('trip.meta.hotels')}</span>}
          {placesCount > 0 && <span className="tp-chip"><Icon d={icons.map} size={12} />{placesCount} {t('trip.meta.places')}</span>}
          {days > 0 && <span className="tp-chip"><Icon d={icons.sun} size={12} />{days} {t('trip.meta.days')}</span>}
        </div>

        <div className="tp-actions">
          <button type="button" className="tp-btn" onClick={() => setOpen(true)}>
            <Icon d={icons.eye} size={14} />
            {t('trip.view')}
          </button>
          {canSave && (
            <button
              type="button"
              className="tp-btn primary"
              onClick={save}
              disabled={saving || Boolean(savedId)}
            >
              <Icon d={icons.save} size={14} color="#fff" />
              {savedId ? t('trip.saved') : saving ? t('trip.saving') : t('trip.save')}
            </button>
          )}
        </div>
      </div>

      {/* ── modal ── */}
      {open && (
        <div className="tp-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="tp-modal" onClick={e => e.stopPropagation()}>

            {/* sticky header */}
            <div className="tp-mhead">
              <div className="tp-mhead-left">
                <span className="tp-mlabel">{t('trip.window_title')}</span>
                <span className="tp-mtitle">{tripPlan.destination}</span>
              </div>
              <button className="tp-close" type="button" onClick={() => setOpen(false)} aria-label="Close">
                <Icon d={icons.close} size={16} />
              </button>
            </div>

            <div className="tp-mbody">

              {/* trip info */}
              <div className="tp-section">
                <SectionHead iconPath={icons.map} title={t('trip.section.info')} />
                <InfoGrid tripPlan={tripPlan} lang={lang} t={t} />
              </div>

              {/* hotels */}
              {hotelCount > 0 && (
                <div className="tp-section">
                  <SectionHead iconPath={icons.hotel} title={t('trip.section.hotels')} />
                  <div className="tp-card-grid">
                    {tripPlan.hotels.map((h, idx) => (
                      <HotelCard key={`hotel-${idx}`} h={h} lang={lang} t={t} />
                    ))}
                  </div>
                </div>
              )}

              {/* places to visit */}
              {placesCount > 0 && (
                <div className="tp-section">
                  <SectionHead iconPath={icons.pin} title={t('trip.section.places')} />
                  <div className="tp-card-grid">
                    {tripPlan.places_to_visit.map((p, idx) => (
                      <PlaceCard key={`place-${idx}`} p={p} lang={lang} t={t} />
                    ))}
                  </div>
                </div>
              )}

              {/* itinerary */}
              <div className="tp-section">
                <SectionHead iconPath={icons.road} title={t('trip.section.itinerary')} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(tripPlan.itinerary || []).map(d => (
                    <DayBlock key={`day-${d.day}`} d={d} lang={lang} t={t} />
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TripPlanMessage