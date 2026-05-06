import { looksLikeTripPlan, safeJsonParse } from './tolerantJson'

export const TRIP_PLANS_CHANGED_EVENT = 'trip-plans:changed'

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (!value || typeof value !== 'object') return value

  const next = {}
  for (const key of Object.keys(value).sort()) {
    const v = value[key]
    if (v !== undefined) next[key] = sortDeep(v)
  }
  return next
}

function extractTripPlanFromUnknown(input) {
  if (!input) return null

  if (typeof input === 'string') {
    const parsed = safeJsonParse(input)
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.trip_plan && typeof parsed.trip_plan === 'object') return parsed.trip_plan
    if (parsed.tripPlan && typeof parsed.tripPlan === 'object') return parsed.tripPlan
    if (looksLikeTripPlan(parsed)) return parsed
    return null
  }

  if (typeof input !== 'object') return null
  if (input.trip_plan && typeof input.trip_plan === 'object') return input.trip_plan
  if (input.tripPlan && typeof input.tripPlan === 'object') return input.tripPlan
  if (looksLikeTripPlan(input)) return input
  return null
}

export function createTripPlanKey(chatId, tripPlan) {
  if (!tripPlan || typeof tripPlan !== 'object') return ''
  const stable = JSON.stringify(sortDeep(tripPlan))
  if (!stable) return ''
  return Number.isFinite(chatId) ? `chat:${chatId}|${stable}` : stable
}

export function createTripPlanKeyFromSavedItem(savedItem) {
  if (!savedItem || typeof savedItem !== 'object') return ''
  const tripPlan = extractTripPlanFromUnknown(savedItem.data)
  if (!tripPlan) return ''
  const chatId = Number.parseInt(String(savedItem.chatId ?? ''), 10)
  return createTripPlanKey(chatId, tripPlan)
}

export function emitTripPlansChanged(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TRIP_PLANS_CHANGED_EVENT, { detail }))
}
