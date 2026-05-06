function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalize(value) {
  return stripAccents(value).toLowerCase()
}

function looksLikeStructuredPlanInput(value) {
  const text = String(value || '')
  return /(^|\n)\s*(origin|destination|duration|budget|group_size|interests|preferences)\s*[:=]/i.test(text)
}

function isQuickSuggestionIntent(value) {
  const text = normalize(value)
  if (!text) return false

  const suggestSignals = [
    'goi y',
    'de xuat',
    'nen di dau',
    'di dau',
    'an gi',
    'choi gi',
    'suggest',
    'recommend',
    'where to go',
    'travel spots',
    'places to visit',
  ]

  const citySignals = [
    'ha noi',
    'hanoi',
    'da nang',
    'ho chi minh',
    'sai gon',
    'can tho',
    'nha trang',
    'hue',
    'quang ninh',
    'da lat',
    'quy nhon',
  ]

  const hasSuggestSignal = suggestSignals.some((k) => text.includes(k))
  const hasCitySignal = citySignals.some((k) => text.includes(k))
  const hasPlacePattern = /\b(o|tai|in|at|near)\b\s+.{2,}/i.test(text)

  return hasSuggestSignal && (hasCitySignal || hasPlacePattern)
}

export function buildSmartAskPayload(message) {
  const raw = String(message || '').trim()
  if (!raw) return { message: '', guide: null }
  if (looksLikeStructuredPlanInput(raw)) return { message: raw, guide: null }
  if (isQuickSuggestionIntent(raw)) return { message: raw, guide: 'quick_suggestion' }
  return { message: raw, guide: null }
}

export function buildSmartAskMessage(message) {
  return String(message || '').trim()
}

export default buildSmartAskMessage
