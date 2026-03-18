export function extractJsonFromText(text) {
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

export function normalizeJsonString(text) {
  // Accept common "almost JSON" from LLMs / manual tests (e.g. trailing commas).
  return String(text || '').replace(/,\s*([}\]])/g, '$1')
}

export function safeJsonParse(text) {
  const raw = String(text || '')
  try {
    return JSON.parse(raw)
  } catch {
    try {
      return JSON.parse(normalizeJsonString(raw))
    } catch {
      return null
    }
  }
}

export function looksLikeTripPlan(obj) {
  if (!obj || typeof obj !== 'object') return false
  if (typeof obj.destination !== 'string' || !obj.destination.trim()) return false
  if (typeof obj.origin !== 'string' || !obj.origin.trim()) return false
  if (typeof obj.duration !== 'string' || !obj.duration.trim()) return false
  if (!Array.isArray(obj.hotels)) return false
  if (!Array.isArray(obj.itinerary)) return false
  return true
}

export function parseTripPlanFromAny(text) {
  const s = String(text || '')
  const candidate = extractJsonFromText(s) || s
  const obj = safeJsonParse(candidate)
  if (!obj || typeof obj !== 'object') return null
  if (obj.trip_plan && typeof obj.trip_plan === 'object') return obj.trip_plan
  if (looksLikeTripPlan(obj)) return obj
  return null
}

export function hasTripPlanJson(text) {
  return Boolean(parseTripPlanFromAny(text))
}
