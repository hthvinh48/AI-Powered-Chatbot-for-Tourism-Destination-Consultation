import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { apiRequestBackend } from '../../lib/apiClient'
import { useI18n } from '../../lib/useI18n'
import { TRIP_PLANS_CHANGED_EVENT } from '../../lib/tripPlanState'
import './AdminTripMapPage.css'

const GEO_CACHE_KEY = 'admin_trip_map_geo_cache_v1'
const MAP_DEFAULT_CENTER = [16.047079, 108.20623]
const MAP_DEFAULT_ZOOM = 5
const STOP_COLORS = {
    activity: '#2f78ee',
    place: '#0ea5a4',
    hotel: '#f59e0b',
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function normalizeText(value) {
    return String(value || '').trim()
}

function makeStopKey(value) {
    return normalizeText(value).toLowerCase().replace(/\s+/g, ' ')
}

function makeStopIdentityKey(stop) {
    const nameKey = makeStopKey(stop?.name)
    const addressKey = makeStopKey(stop?.address)
    const queryKey = makeStopKey(stop?.query)

    if (nameKey && addressKey) return `${nameKey}::${addressKey}`
    if (queryKey) return queryKey
    return `${nameKey || 'stop'}::${addressKey || ''}`
}

function makeCoordKey(coord) {
    if (!isValidCoord(coord)) return ''
    return `coord:${Number(coord.lat).toFixed(5)},${Number(coord.lng).toFixed(5)}`
}

function makeStopGroupKey(stop, cache) {
    const coord = getCachedCoordForStop(stop, cache)
    const coordKey = makeCoordKey(coord)
    if (coordKey) return coordKey
    return makeStopIdentityKey(stop)
}

function buildGeoQueries(name, address, destination) {
    const raw = [
        [address, destination].filter(Boolean).join(', '),
        [name, destination].filter(Boolean).join(', '),
        address,
        name,
        destination ? `${name}, ${destination}` : '',
    ]
    const queries = []
    const seen = new Set()

    for (const candidate of raw) {
        const query = normalizeText(candidate)
        const key = makeStopKey(query)
        if (!key || seen.has(key)) continue
        seen.add(key)
        queries.push(query)
    }

    return queries
}

function isValidCoord(coord) {
    return Boolean(coord) && Number.isFinite(coord.lat) && Number.isFinite(coord.lng)
}

function getStopQueries(stop) {
    if (Array.isArray(stop?.queries) && stop.queries.length > 0) return stop.queries
    return normalizeText(stop?.query) ? [normalizeText(stop.query)] : []
}

function getCachedCoordForStop(stop, cache) {
    const queries = getStopQueries(stop)
    for (const query of queries) {
        const key = makeStopKey(query)
        const coord = cache?.[key]
        if (isValidCoord(coord)) return coord
    }
    return null
}

function formatDateTime(value, lang) {
    if (!value) return '-'
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return '-'
    return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date)
}

function formatShortDate(value, lang) {
    if (!value) return '-'
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return '-'
    return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
    }).format(date)
}

function loadGeocodeCache() {
    try {
        const raw = localStorage.getItem(GEO_CACHE_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return {}

        const normalized = {}
        for (const [key, value] of Object.entries(parsed)) {
            const normalizedKey = makeStopKey(key)
            if (!normalizedKey || !isValidCoord(value)) continue
            normalized[normalizedKey] = value
        }
        return normalized
    } catch {
        return {}
    }
}

function saveGeocodeCache(nextCache) {
    try {
        localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(nextCache))
    } catch {
        // ignore storage errors
    }
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
}

function parseTripData(data) {
    if (!data) return null
    let source = data

    if (typeof data === 'string') {
        try {
            source = JSON.parse(data)
        } catch {
            return null
        }
    }

    if (!source || typeof source !== 'object') return null
    if (source.trip_plan && typeof source.trip_plan === 'object') return source.trip_plan
    if (Array.isArray(source.itinerary)) return source
    return null
}

function collectStops(tripPlan) {
    const result = []
    const itinerary = Array.isArray(tripPlan?.itinerary) ? tripPlan.itinerary : []
    const places = Array.isArray(tripPlan?.places_to_visit) ? tripPlan.places_to_visit : []
    const hotels = Array.isArray(tripPlan?.hotels) ? tripPlan.hotels : []
    const destination = normalizeText(tripPlan?.destination)
    const itineraryKeys = new Set()
    const extraKeys = new Set()
    const itinerarySeenByDay = new Set()

    itinerary.forEach((dayBlock, dayIndex) => {
        const day = Number(dayBlock?.day) || dayIndex + 1
        const acts = Array.isArray(dayBlock?.activities) ? dayBlock.activities : []
        acts.forEach((act, actIndex) => {
            const name = normalizeText(act?.place_name) || `Stop ${actIndex + 1}`
            const address = normalizeText(act?.place_address)
            const details = normalizeText(act?.place_details)
            const queries = buildGeoQueries(name, address, destination)
            const query = queries[0] || ''
            result.push({
                id: `day-${day}-act-${actIndex}`,
                type: 'activity',
                day,
                name,
                address,
                details,
                query,
                queries,
            })

            const queryKey = makeStopKey(query)
            if (!queryKey) return
            itineraryKeys.add(queryKey)
            itinerarySeenByDay.add(`${day}::${queryKey}`)
        })
    })

    places.forEach((place, index) => {
        const name = normalizeText(place?.place_name) || `Place ${index + 1}`
        const address = normalizeText(place?.place_address)
        const queries = buildGeoQueries(name, address, destination)
        const query = queries[0] || ''
        const queryKey = makeStopKey(query)
        if (!queryKey) return
        if (itineraryKeys.has(queryKey) || extraKeys.has(queryKey)) return
        extraKeys.add(queryKey)

        result.push({
            id: `place-${index}`,

            type: 'place',

            day: null,

            name,

            address,

            details: normalizeText(
                place?.place_details
            ),

            image:
                place?.image_url ||
                place?.place_image_url ||
                place?.images?.[0]
                    ?.thumbnail ||
                place?.images?.[0]
                    ?.original ||
                '',

            images: Array.isArray(
                place?.images
            )
                ? place.images
                : [],

            query,

            queries,
        })
    })

    hotels.forEach((hotel, index) => {
        const name = normalizeText(hotel?.hotel_name) || `Hotel ${index + 1}`
        const address = normalizeText(hotel?.hotel_address)
        const queries = buildGeoQueries(name, address, destination)
        const query = queries[0] || ''
        const queryKey = makeStopKey(query)
        if (!queryKey) return
        if (itineraryKeys.has(queryKey) || extraKeys.has(queryKey)) return
        extraKeys.add(queryKey)

        result.push({
            id: `hotel-${index}`,

            type: 'hotel',

            day: null,

            name,

            address,

            details: normalizeText(
                hotel?.description
            ),

            image:
                hotel?.image_url ||
                hotel?.hotel_image_url ||
                hotel?.images?.[0]
                    ?.thumbnail ||
                hotel?.images?.[0]
                    ?.original ||
                '',

            images: Array.isArray(
                hotel?.images
            )
                ? hotel.images
                : [],

            query,

            queries,
        })
    })

    const deduped = []
    const seen = new Set()
    for (const stop of result) {
        const queryKey = makeStopKey(stop.query)
        if (!queryKey) continue

        if (stop.type === 'activity') {
            const dayKey = `${stop.day ?? 'all'}::${queryKey}`
            if (!itinerarySeenByDay.has(dayKey) || seen.has(dayKey)) continue
            seen.add(dayKey)
            deduped.push(stop)
            continue
        }

        const key = `extra::${queryKey}`
        if (seen.has(key)) continue
        seen.add(key)
        deduped.push(stop)
    }

    return deduped
}

const AdminTripMapPage = ({ userView = false }) => {
    const { t, lang } = useI18n()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [items, setItems] = useState([])
    const [search, setSearch] = useState('')
    const [selectedTripId, setSelectedTripId] = useState('')
    const [selectedDay, setSelectedDay] = useState('all')
    const [focusedStopId, setFocusedStopId] = useState('')
    const [coordsByQuery, setCoordsByQuery] = useState(() => loadGeocodeCache())
    const [geoLoading, setGeoLoading] = useState(false)
    const [geoError, setGeoError] = useState('')
    const [geoProgress, setGeoProgress] = useState({ done: 0, total: 0 })

    const mapElRef = useRef(null)
    const mapRef = useRef(null)
    const layerGroupRef = useRef(null)
    const markerByStopIdRef = useRef({})
    const coordsRef = useRef(coordsByQuery)
    const geoBusyRef = useRef(false)
    const autoResolveKeyRef = useRef('')

    const mapText = useCallback((suffix) => {
        if (userView) {
            const userKey = `user.map.${suffix}`
            const userValue = t(userKey)
            if (userValue !== userKey) return userValue
        }
        return t(`admin.map.${suffix}`)
    }, [t, userView])

    useEffect(() => {
        coordsRef.current = coordsByQuery
    }, [coordsByQuery])

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await apiRequestBackend('/api/trip-plans?include=true&limit=100')
            setItems(Array.isArray(res?.items) ? res.items : [])
        } catch (err) {
            setError(err?.message || mapText('load_fail'))
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [mapText])

    useEffect(() => {
        load()
    }, [load])

    useEffect(() => {
        const onTripPlansChanged = () => {
            load()
        }

        window.addEventListener(TRIP_PLANS_CHANGED_EVENT, onTripPlansChanged)
        return () => window.removeEventListener(TRIP_PLANS_CHANGED_EVENT, onTripPlansChanged)
    }, [load])

    const tripRecords = useMemo(() => {
        return items
            .map((item) => {
                const plan = parseTripData(item?.data)
                if (!plan) return null
                const destination = normalizeText(plan.destination)
                const origin = normalizeText(plan.origin)
                const title = normalizeText(item?.title) || destination || `${t('trip.trip_fallback')} #${item.id}`
                const createdAt = item?.createdAt || null
                const updatedAt = item?.updatedAt || createdAt || null
                const dayCount = Array.isArray(plan.itinerary) ? plan.itinerary.length : 0
                const stopCount = collectStops(plan).length
                const createdShortDate = formatShortDate(createdAt, lang)
                const optionLabel = `${title} - #${item.id} - C${item?.chatId ?? '-'} - ${dayCount}d/${stopCount}s - ${createdShortDate}`
                return {
                    id: String(item.id),
                    chatId: item?.chatId,
                    createdAt,
                    title,
                    optionLabel,
                    destination,
                    origin,
                    updatedAt,
                    tripPlan: plan,
                    dayCount,
                    stopCount,
                }
            })
            .filter(Boolean)
    }, [items, t, lang])

    const filteredTrips = useMemo(() => {
        const keyword = normalizeText(search).toLowerCase()
        if (!keyword) return tripRecords
        return tripRecords.filter((trip) =>
            [trip.title, trip.destination, trip.origin, trip.id, trip.chatId]
                .some((x) => String(x || '').toLowerCase().includes(keyword)),
        )
    }, [tripRecords, search])

    useEffect(() => {
        if (filteredTrips.length === 0) {
            setSelectedTripId('')
            return
        }
        const exists = filteredTrips.some((trip) => trip.id === selectedTripId)
        if (!exists) {
            setSelectedTripId(filteredTrips[0].id)
            setSelectedDay('all')
        }
    }, [filteredTrips, selectedTripId])

    const selectedTrip = useMemo(
        () => filteredTrips.find((trip) => trip.id === selectedTripId) || null,
        [filteredTrips, selectedTripId],
    )
    const showUserEmptyState = userView && !loading && !error && (items.length === 0 || tripRecords.length === 0)

    useEffect(() => {
        if (showUserEmptyState) {
            if (mapRef.current) {
                mapRef.current.remove()
                mapRef.current = null
                layerGroupRef.current = null
                markerByStopIdRef.current = {}
            }
            return
        }

        if (!mapElRef.current || mapRef.current) return
        const map = L.map(mapElRef.current, { zoomControl: true }).setView(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map)

        mapRef.current = map
        layerGroupRef.current = L.layerGroup().addTo(map)

        return () => {
            map.remove()
            mapRef.current = null
            layerGroupRef.current = null
        }
    }, [showUserEmptyState])

    const allStops = useMemo(
        () => (selectedTrip ? collectStops(selectedTrip.tripPlan) : []),
        [selectedTrip],
    )

    const availableDays = useMemo(() => {
        const set = new Set()
        allStops.forEach((stop) => {
            if (Number.isFinite(stop.day) && stop.day !== null) set.add(stop.day)
        })
        return [...set].sort((a, b) => a - b)
    }, [allStops])

    useEffect(() => {
        if (selectedDay === 'all') return
        const dayNum = Number(selectedDay)
        if (!availableDays.includes(dayNum)) setSelectedDay('all')
    }, [selectedDay, availableDays])

    const filteredStops = useMemo(() => {
        if (selectedDay === 'all') return allStops
        const dayNum = Number(selectedDay)
        return allStops.filter((stop) => stop.day === dayNum)
    }, [allStops, selectedDay])

    const visitOrderByStopId = useMemo(() => {
        const next = {}
        allStops.forEach((stop, index) => {
            next[stop.id] = index + 1
        })
        return next
    }, [allStops])

    const stopMetaById = useMemo(() => {
        const firstOrderByIdentity = new Map()
        const visibleOrdersByIdentity = new Map()
        const metaById = {}

        filteredStops.forEach((stop, index) => {
            const visitOrder = visitOrderByStopId[stop.id] ?? index + 1
            const groupKey = makeStopGroupKey(stop, coordsByQuery)
            if (!firstOrderByIdentity.has(groupKey)) {
                firstOrderByIdentity.set(groupKey, visitOrder)
            }
            if (!visibleOrdersByIdentity.has(groupKey)) {
                visibleOrdersByIdentity.set(groupKey, [])
            }
            visibleOrdersByIdentity.get(groupKey).push(visitOrder)
        })

        filteredStops.forEach((stop, index) => {
            const visitOrder = visitOrderByStopId[stop.id] ?? index + 1
            const groupKey = makeStopGroupKey(stop, coordsByQuery)
            const rawOrders = visibleOrdersByIdentity.get(groupKey) || [visitOrder]
            const orderList = [...new Set(rawOrders)].sort((a, b) => a - b)
            const orderLabel = orderList.length > 1 ? orderList.join('/') : String(visitOrder)
            metaById[stop.id] = {
                identityKey: groupKey,
                visitOrder,
                markerOrder: firstOrderByIdentity.get(groupKey) ?? visitOrder,
                orderList,
                orderLabel,
            }
        })

        return metaById
    }, [filteredStops, visitOrderByStopId, coordsByQuery])

    useEffect(() => {
        if (!focusedStopId) return
        const exists = filteredStops.some((stop) => stop.id === focusedStopId)
        if (!exists) setFocusedStopId('')
    }, [filteredStops, focusedStopId])

    const geocodeStops = useCallback(
        async (stopsToResolve) => {
            if (!Array.isArray(stopsToResolve) || stopsToResolve.length === 0 || geoBusyRef.current) return
            geoBusyRef.current = true
            setGeoLoading(true)
            setGeoError('')
            setGeoProgress({ done: 0, total: stopsToResolve.length })

            const nextCache = { ...coordsByQuery }
            let done = 0
            try {
                for (const stop of stopsToResolve) {
                    const stopQueries = getStopQueries(stop)
                    if (stopQueries.length === 0) {
                        done += 1
                        setGeoProgress({ done, total: stopsToResolve.length })
                        continue
                    }

                    let foundCoord = getCachedCoordForStop(stop, nextCache)

                    if (!foundCoord) {
                        for (const query of stopQueries) {
                            const queryKey = makeStopKey(query)
                            const cached = nextCache[queryKey]
                            if (isValidCoord(cached)) {
                                foundCoord = cached
                                break
                            }

                            try {
                                const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
                                const response = await fetch(url, {
                                    headers: { Accept: 'application/json' },
                                })
                                if (response.ok) {
                                    const rows = await response.json()
                                    const top = Array.isArray(rows) ? rows[0] : null
                                    const lat = Number(top?.lat)
                                    const lng = Number(top?.lon)
                                    if (Number.isFinite(lat) && Number.isFinite(lng)) {
                                        foundCoord = { lat, lng, label: normalizeText(top?.display_name) }
                                        nextCache[queryKey] = foundCoord
                                        break
                                    }
                                }
                            } catch {
                                // ignore geocode failures per query
                            }

                            await delay(650)
                        }
                    }

                    if (foundCoord) {
                        for (const query of stopQueries) {
                            const key = makeStopKey(query)
                            if (key && !nextCache[key]) nextCache[key] = foundCoord
                        }
                    }

                    done += 1
                    setGeoProgress({ done, total: stopsToResolve.length })
                }
            } catch (err) {
                setGeoError(err?.message || mapText('geocode_fail'))
            } finally {
                setCoordsByQuery(nextCache)
                saveGeocodeCache(nextCache)
                setGeoLoading(false)
                geoBusyRef.current = false
            }
        },
        [coordsByQuery, mapText],
    )

    useEffect(() => {
        if (!selectedTrip || filteredStops.length === 0) return
        const key = `${selectedTrip.id}:${selectedDay}`
        if (autoResolveKeyRef.current === key) return
        autoResolveKeyRef.current = key

        const missing = filteredStops
            .filter((stop) => !getCachedCoordForStop(stop, coordsByQuery))
            .slice(0, 12)

        if (missing.length > 0) {
            void geocodeStops(missing)
        }
    }, [selectedTrip, selectedDay, filteredStops, coordsByQuery, geocodeStops])

    const mappableStops = useMemo(() => {
        return filteredStops
            .map((stop) => {
                const meta = stopMetaById[stop.id]
                return {
                    ...stop,
                    identityKey: meta?.identityKey || makeStopIdentityKey(stop),
                    visitOrder: meta?.visitOrder ?? 0,
                    markerOrder: meta?.markerOrder ?? 0,
                    orderList: meta?.orderList || [],
                    orderLabel: meta?.orderLabel || '',
                    coord: getCachedCoordForStop(stop, coordsByQuery),
                }
            })
            .filter((stop) => isValidCoord(stop.coord))
    }, [filteredStops, stopMetaById, coordsByQuery])

    const markerStops = useMemo(() => {
        const grouped = new Map()
        mappableStops.forEach((stop) => {
            const key = stop.identityKey || makeStopIdentityKey(stop)
            const existing = grouped.get(key)
            if (!existing) {
                grouped.set(key, {
                    ...stop,
                    visits: [stop],
                })
                return
            }

            existing.visits.push(stop)
            const mergedOrderSet = new Set([
                ...(Array.isArray(existing.orderList) ? existing.orderList : []),
                ...(Array.isArray(stop.orderList) ? stop.orderList : []),
            ])
            existing.orderList = [...mergedOrderSet].sort((a, b) => a - b)
            existing.orderLabel = existing.orderList.length > 1 ? existing.orderList.join('/') : String(existing.visitOrder || stop.visitOrder || '')
        })
        return [...grouped.values()]
    }, [mappableStops])

    const unmappedStops = useMemo(
        () => filteredStops.filter((stop) => !getCachedCoordForStop(stop, coordsByQuery)),
        [filteredStops, coordsByQuery],
    )

    useEffect(() => {
        const map = mapRef.current
        const layerGroup = layerGroupRef.current
        if (!map || !layerGroup) return

        layerGroup.clearLayers()
        markerByStopIdRef.current = {}
        if (mappableStops.length === 0) {
            map.setView(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM)
            return
        }

        const markerLatLngs = []
        markerStops.forEach((stop, index) => {
            const latLng = [stop.coord.lat, stop.coord.lng]
            markerLatLngs.push(latLng)
            const color = STOP_COLORS[stop.type] || '#2f78ee'
            const marker = L.circleMarker(latLng, {
                radius: 7,
                color,
                fillColor: color,
                fillOpacity: 0.7,
                weight: 2,
            })

            const visitDayLabels = [...new Set(
                stop.visits
                    .map((visit) => (Number.isFinite(visit.day) ? `${mapText('day_prefix')} ${visit.day}` : ''))
                    .filter(Boolean),
            )]

            const imageHtml = stop.image
                ? `
    <div class="admin-map-popup-image-wrap">
      <img
        src="${escapeHtml(
                    stop.image
                )}"
        class="admin-map-popup-image"
      />
    </div>
  `
                : ''

            const popup = `
  <div class="admin-map-popup">
    ${imageHtml}

    <b>
      ${escapeHtml(stop.name)}
    </b><br/>

    ${stop.orderLabel
                    ? `#${escapeHtml(
                        stop.orderLabel
                    )}<br/>`
                    : ''
                }

    ${visitDayLabels.length > 0
                    ? `${escapeHtml(
                        visitDayLabels.join(
                            ', '
                        )
                    )}<br/>`
                    : ''
                }

    ${stop.address
                    ? `${escapeHtml(
                        stop.address
                    )}<br/>`
                    : ''
                }

    ${stop.details
                    ? `<span>${escapeHtml(
                        stop.details
                    )}</span>`
                    : ''
                }
  </div>
`

            marker.bindPopup(popup)
            marker.addTo(layerGroup)
            stop.visits.forEach((visit) => {
                markerByStopIdRef.current[visit.id] = { marker, latLng }
            })

            L.tooltip({
                permanent: true,
                direction: 'top',
                className: 'admin-map-order',
            })
                .setContent(String(stop.orderLabel || stop.markerOrder || index + 1))
                .setLatLng(latLng)
                .addTo(layerGroup)
        })

        const routeLatLngs = mappableStops.map((stop) => [stop.coord.lat, stop.coord.lng])

        if (routeLatLngs.length > 1) {
            L.polyline(routeLatLngs, {
                color: '#4d8ff7',
                opacity: 0.8,
                weight: 3,
            }).addTo(layerGroup)
        }

        map.fitBounds(L.latLngBounds(markerLatLngs), {
            padding: [30, 30],
            maxZoom: 13,
        })
    }, [mappableStops, markerStops, mapText])

    const onResolveAll = async () => {
        const missing = filteredStops.filter((stop) => !getCachedCoordForStop(stop, coordsByQuery))
        if (missing.length === 0) return
        await geocodeStops(missing.slice(0, 40))
    }

    const onResetMapView = useCallback(() => {
        const map = mapRef.current
        if (!map) return

        setFocusedStopId('')
        if (mappableStops.length === 0) {
            map.setView(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM)
            return
        }

        const latLngs = mappableStops.map((stop) => [stop.coord.lat, stop.coord.lng])
        map.fitBounds(L.latLngBounds(latLngs), {
            padding: [30, 30],
            maxZoom: 13,
        })
    }, [mappableStops])

    const focusStopOnMap = useCallback((stop) => {
        const map = mapRef.current
        if (!map) return false

        const markerEntry = markerByStopIdRef.current[stop.id]
        if (markerEntry) {
            map.flyTo(markerEntry.latLng, Math.max(map.getZoom(), 15), { duration: 0.45 })
            markerEntry.marker.openPopup()
            return true
        }

        const coord = getCachedCoordForStop(stop, coordsRef.current)
        if (!coord) return false

        const latLng = [coord.lat, coord.lng]
        map.flyTo(latLng, Math.max(map.getZoom(), 15), { duration: 0.45 })
        return true
    }, [])

    const onStopClick = useCallback(
        async (stop) => {
            setFocusedStopId(stop.id)
            if (focusStopOnMap(stop)) return
            await geocodeStops([stop])
            focusStopOnMap(stop)
        },
        [focusStopOnMap, geocodeStops],
    )

    return (
        <div className={showUserEmptyState ? 'admin-trip-map-page admin-trip-map-page--empty' : 'admin-trip-map-page'}>
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">{mapText('title')}</h1>
                    <p className="admin-page-subtitle">{mapText('subtitle')}</p>
                </div>
                {!showUserEmptyState ? (
                    <button className="admin-btn admin-btn--ghost" type="button" onClick={load} disabled={loading}>
                        <i className="ti ti-refresh" />
                        {t('admin.refresh')}
                    </button>
                ) : null}
            </div>

            {error ? <div className="admin-inline-error admin-map-error">{t('common.error')}: {error}</div> : null}

            {showUserEmptyState ? (
                <section className="admin-card user-trip-map-empty">
                    <div className="user-trip-map-empty-icon">
                        <i className="ti ti-map-route" />
                    </div>
                    <div className="user-trip-map-empty-copy">
                        <h2>{mapText('empty_title')}</h2>
                        <p>{mapText('empty_text')}</p>
                    </div>
                    <div className="user-trip-map-empty-steps">
                        <div>
                            <span>1</span>
                            <p>{mapText('empty_step_1')}</p>
                        </div>
                        <div>
                            <span>2</span>
                            <p>{mapText('empty_step_2')}</p>
                        </div>
                        <div>
                            <span>3</span>
                            <p>{mapText('empty_step_3')}</p>
                        </div>
                    </div>
                    <div className="user-trip-map-empty-actions">
                        <Link className="admin-btn admin-btn--primary" to="/dashboard">
                            <i className="ti ti-message-plus" />
                            {mapText('empty_cta')}
                        </Link>
                    </div>
                </section>
            ) : null}

            {!showUserEmptyState ? <div className="admin-map-layout">
                <aside className="admin-card admin-map-sidebar">
                    <div className="admin-card-body">
                        <div className="admin-map-controls">
                            <div className="admin-filter-group">
                                <label className="admin-filter-label">{t('admin.search')}</label>
                                <input
                                    className="admin-input"
                                    value={search}
                                    placeholder={mapText('search_placeholder')}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            <div className="admin-filter-group">
                                <div className="admin-map-label-row">
                                    <label className="admin-filter-label">{mapText('trip')}</label>
                                    <div className="admin-map-field-hint">{mapText('trip_hint')}</div>
                                </div>
                                <select
                                    className="admin-select"
                                    value={selectedTripId}
                                    onChange={(e) => {
                                        setSelectedTripId(e.target.value)
                                        setSelectedDay('all')
                                    }}
                                >
                                    {filteredTrips.map((trip) => (
                                        <option key={trip.id} value={trip.id}>
                                            {trip.optionLabel || trip.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="admin-filter-group">
                                <label className="admin-filter-label">{mapText('day')}</label>
                                <select className="admin-select" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
                                    <option value="all">{mapText('day_all')}</option>
                                    {availableDays.map((day) => (
                                        <option key={day} value={day}>{`${mapText('day_prefix')} ${day}`}</option>
                                    ))}
                                </select>
                            </div>

                            <button type="button" className="admin-btn admin-btn--primary" onClick={onResolveAll} disabled={geoLoading || filteredStops.length === 0}>
                                <i className="ti ti-map-search" />
                                {geoLoading ? `${geoProgress.done}/${geoProgress.total}` : mapText('resolve_points')}
                            </button>

                            <button
                                type="button"
                                className="admin-btn admin-btn--ghost"
                                onClick={onResetMapView}
                                disabled={mappableStops.length === 0}
                            >
                                <i className="ti ti-arrows-maximize" />
                                {mapText('reset_view')}
                            </button>
                        </div>

                        {geoError ? <div className="admin-inline-error admin-map-inline-error">{t('common.error')}: {geoError}</div> : null}

                        {selectedTrip ? (
                            <div className="admin-map-meta">
                                <div className="admin-map-meta-title">{mapText('meta_title')}</div>
                                <div className="admin-map-meta-grid">
                                    <div className="admin-map-meta-item">
                                        <span>{mapText('trip_id')}</span>
                                        <b>#{selectedTrip.id}</b>
                                    </div>
                                    <div className="admin-map-meta-item">
                                        <span>{mapText('chat_id')}</span>
                                        <b>{selectedTrip.chatId ?? '-'}</b>
                                    </div>
                                    <div className="admin-map-meta-item">
                                        <span>{mapText('created_at')}</span>
                                        <b>{formatDateTime(selectedTrip.createdAt, lang)}</b>
                                    </div>
                                    <div className="admin-map-meta-item">
                                        <span>{mapText('updated_at')}</span>
                                        <b>{formatDateTime(selectedTrip.updatedAt, lang)}</b>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div className="admin-map-summary">
                            <div className="admin-map-summary-item">
                                <span>{mapText('total_stops')}</span>
                                <b>{filteredStops.length}</b>
                            </div>
                            <div className="admin-map-summary-item">
                                <span>{mapText('mapped_stops')}</span>
                                <b>{mappableStops.length}</b>
                            </div>
                            <div className="admin-map-summary-item">
                                <span>{mapText('unmapped_stops')}</span>
                                <b>{unmappedStops.length}</b>
                            </div>
                        </div>

                        {unmappedStops.length > 0 ? (
                            <div className="admin-map-warning">
                                <i className="ti ti-alert-triangle" />
                                <span>{mapText('unmapped_hint')}</span>
                            </div>
                        ) : null}

                        <div className="admin-map-stop-list">
                            {filteredStops.length === 0 ? (
                                <div className="admin-empty-inline">{mapText('no_stops')}</div>
                            ) : (
                                filteredStops.map((stop, index) => {
                                    const mapped = Boolean(getCachedCoordForStop(stop, coordsByQuery))
                                    return (
                                        <button
                                            key={stop.id}
                                            type="button"
                                            className={`admin-map-stop ${mapped
                                                ? 'is-mapped'
                                                : ''
                                                } ${focusedStopId ===
                                                    stop.id
                                                    ? 'is-focused'
                                                    : ''
                                                }`}
                                            onClick={() =>
                                                onStopClick(stop)
                                            }
                                        >
                                            {/* IMAGE */}
                                            <div className="admin-map-stop-image-wrap">
                                                {stop.image ? (
                                                    <img
                                                        src={stop.image}
                                                        alt={stop.name}
                                                        className="admin-map-stop-image"
                                                    />
                                                ) : (
                                                    <div className="admin-map-stop-placeholder">
                                                        <i className="ti ti-photo" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* ORDER */}
                                            <div className="admin-map-stop-order">
                                                {index + 1}
                                            </div>

                                            {/* TEXT */}
                                            <div className="admin-map-stop-copy">
                                                <div className="admin-map-stop-title">
                                                    {stop.name}

                                                    {stop.day ? (
                                                        <span>
                                                            {` • ${mapText(
                                                                'day_prefix'
                                                            )} ${stop.day}`}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <div className="admin-map-stop-meta">
                                                    {stop.address ||
                                                        stop.query}
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })
                            )}
                        </div>

                        {unmappedStops.length > 0 ? (
                            <div className="admin-map-unmapped">
                                <div className="admin-map-unmapped-title">{mapText('unmapped_list')}</div>
                                <div className="admin-map-unmapped-list">
                                    {unmappedStops.map((stop, index) => {
                                        return (
                                            <div key={stop.id} className="admin-map-unmapped-item">
                                                <span>{index + 1}.</span>
                                                <div>
                                                    <b>{stop.name}</b>
                                                    <small>{stop.address || stop.query}</small>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </aside>

                <section className="admin-card admin-map-stage">
                    <div className="admin-card-body">
                        <div className="admin-map-canvas" ref={mapElRef} />
                    </div>
                </section>
            </div> : null}
        </div>
    )
}

export default AdminTripMapPage
