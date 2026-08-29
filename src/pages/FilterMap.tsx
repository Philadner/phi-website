import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import * as maplibregl from "maplibre-gl"
import type { Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl"
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url&no-inline"
import mapLibreSharedUrl from "maplibre-gl/dist/maplibre-gl-shared.mjs?url&no-inline"
import "maplibre-gl/dist/maplibre-gl.css"
import "../stylesheets/FilterMap.css"

maplibregl.setWorkerUrl(mapLibreWorkerUrl)
void mapLibreSharedUrl

const layerGroups = {
  buildings: ["buildings"],
  streets: ["street-glow", "streets"],
  motorways: ["motorway-glow", "motorways"],
  borders: ["border-glow", "borders"],
  water: ["water", "waterways"],
  parks: ["landcover", "parks"],
  rail: ["rail"],
  labels: ["place-labels", "road-labels"],
} as const

type LayerGroup = keyof typeof layerGroups

type MarkerTarget = {
  targetType: "address" | "coordinates"
  address: string
  longitude: number
  latitude: number
  label: string
}

type MarkerRecord = {
  id: string
  address: string
  longitude: number
  latitude: number
  label: string
}

type MapActionPlan = {
  error?: string
  filters?: { change: boolean; layers: unknown }
  camera?: {
    targetType: "none" | "address" | "coordinates" | "current"
    address: string
    longitude: number
    latitude: number
    zoom: number
  }
  pins?: MarkerTarget[]
  pings?: MarkerTarget[]
  clearPins?: boolean
  clearPings?: boolean
  message?: string
}

type GeocodingFeature = {
  center?: [number, number]
  geometry?: { coordinates?: [number, number] }
  place_name?: string
  text?: string
}

async function geocodeAddress(address: string, apiKey: string, proximity: [number, number]) {
  const params = new URLSearchParams({
    key: apiKey,
    limit: "1",
    language: "en",
    proximity: proximity.join(","),
  })
  const response = await fetch(
    `https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json?${params}`,
  )
  if (!response.ok) return null
  const payload = await response.json() as { features?: GeocodingFeature[] }
  const feature = payload.features?.[0]
  const coordinates = feature?.center || feature?.geometry?.coordinates
  if (!coordinates || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) return null
  return {
    coordinates,
    placeName: feature.place_name || feature.text || address,
  }
}

async function reverseGeocode(longitude: number, latitude: number, apiKey: string) {
  const params = new URLSearchParams({ key: apiKey, limit: "1", language: "en" })
  const response = await fetch(
    `https://api.maptiler.com/geocoding/${longitude},${latitude}.json?${params}`,
  )
  if (!response.ok) return "AREA UNRESOLVED"
  const payload = await response.json() as { features?: GeocodingFeature[] }
  const feature = payload.features?.[0]
  return feature?.place_name || feature?.text || "AREA UNRESOLVED"
}

const allGroups = Object.keys(layerGroups) as LayerGroup[]

const layerLabels: Record<LayerGroup, string> = {
  buildings: "Structures",
  streets: "Street grid",
  motorways: "Arteries",
  borders: "Borders",
  water: "Water",
  parks: "Terrain",
  rail: "Rail",
  labels: "Labels",
}

function createMapStyle(apiKey: string): StyleSpecification {
  const key = encodeURIComponent(apiKey)

  return {
    version: 8,
    name: "FILTERMAP // NIGHT SIGNAL",
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${key}`,
    sources: {
      openmaptiles: {
        type: "vector",
        url: `https://api.maptiler.com/tiles/v4/tiles.json?key=${key}`,
      },
    },
    layers: [
      {
        id: "void",
        type: "background",
        paint: { "background-color": "#010603" },
      },
      {
        id: "landcover",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        paint: {
          "fill-color": [
            "match",
            ["get", "class"],
            "wood",
            "#062516",
            "grass",
            "#082014",
            "scrub",
            "#07190f",
            "#031009",
          ],
          "fill-opacity": 0.72,
        },
      },
      {
        id: "parks",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "park",
        paint: {
          "fill-color": "#09341d",
          "fill-opacity": 0.62,
          "fill-outline-color": "#18ff7a",
        },
      },
      {
        id: "water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        paint: {
          "fill-color": "#01090b",
          "fill-outline-color": "#00d9a3",
        },
      },
      {
        id: "waterways",
        type: "line",
        source: "openmaptiles",
        "source-layer": "waterway",
        paint: {
          "line-color": "#00d9a3",
          "line-opacity": 0.7,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 16, 1.6],
        },
      },
      {
        id: "buildings",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13,
        paint: {
          "fill-color": "#0cbd5b",
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.28, 17, 0.66],
          "fill-outline-color": "#35ff8d",
        },
      },
      {
        id: "street-glow",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["!", ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]]],
        paint: {
          "line-color": "#00ff66",
          "line-opacity": 0.13,
          "line-blur": 2.5,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.6, 18, 5],
        },
      },
      {
        id: "streets",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["!", ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]]],
        paint: {
          "line-color": [
            "match",
            ["get", "class"],
            "primary",
            "#27ff78",
            "secondary",
            "#16d95b",
            "tertiary",
            "#0cad49",
            "#087c36",
          ],
          "line-opacity": 0.88,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.25, 13, 0.8, 18, 1.55],
        },
      },
      {
        id: "motorway-glow",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]],
        paint: {
          "line-color": "#35ff78",
          "line-opacity": 0.36,
          "line-blur": 4,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 2, 16, 10],
        },
      },
      {
        id: "motorways",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#52ff8b",
          "line-opacity": 0.98,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.9, 11, 2.5, 16, 5.2],
        },
      },
      {
        id: "rail",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["==", ["get", "class"], "rail"],
        paint: {
          "line-color": "#a1ffbd",
          "line-opacity": 0.7,
          "line-width": 0.8,
          "line-dasharray": [2, 2.5],
        },
      },
      {
        id: "border-glow",
        type: "line",
        source: "openmaptiles",
        "source-layer": "boundary",
        filter: ["any", ["==", ["get", "admin_level"], 2], ["==", ["get", "admin_level"], "2"]],
        paint: {
          "line-color": "#ffffff",
          "line-opacity": 0.34,
          "line-blur": 5,
          "line-width": ["interpolate", ["linear"], ["zoom"], 2, 4, 10, 8],
        },
      },
      {
        id: "borders",
        type: "line",
        source: "openmaptiles",
        "source-layer": "boundary",
        filter: ["any", ["==", ["get", "admin_level"], 2], ["==", ["get", "admin_level"], "2"]],
        paint: {
          "line-color": "#f2fff7",
          "line-opacity": 0.94,
          "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1.5, 10, 3.2],
        },
      },
      {
        id: "place-labels",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        minzoom: 3,
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 9, 12, 13],
          "text-letter-spacing": 0.12,
          "text-transform": "uppercase",
        },
        paint: {
          "text-color": "#b8ffd0",
          "text-halo-color": "#010603",
          "text-halo-width": 1.5,
          "text-opacity": 0.8,
        },
      },
      {
        id: "road-labels",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        minzoom: 13,
        layout: {
          "symbol-placement": "line",
          "text-field": ["coalesce", ["get", "ref"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 9,
          "text-letter-spacing": 0.08,
        },
        paint: {
          "text-color": "#5aff8d",
          "text-halo-color": "#010603",
          "text-halo-width": 1.2,
          "text-opacity": 0.66,
        },
      },
    ],
  }
}

function formatCoordinates(longitude: number, latitude: number) {
  return `${latitude.toFixed(5)} / ${longitude.toFixed(5)}`
}

export default function FilterMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const locationMarkerRef = useRef<Marker | null>(null)
  const pinMarkersRef = useRef<Marker[]>([])
  const pingMarkersRef = useRef<Marker[]>([])
  const areaRequestRef = useRef(0)
  const [activeGroups, setActiveGroups] = useState<LayerGroup[]>(allGroups)
  const [coordinates, setCoordinates] = useState("ACQUIRING POSITION")
  const [zoom, setZoom] = useState("--")
  const [areaLabel, setAreaLabel] = useState("RESOLVING LOCAL AREA")
  const [pinRecords, setPinRecords] = useState<MarkerRecord[]>([])
  const [pingRecords, setPingRecords] = useState<MarkerRecord[]>([])
  const [mapStatus, setMapStatus] = useState("INITIALISING VECTOR FEED")
  const [command, setCommand] = useState("")
  const [commandStatus, setCommandStatus] = useState("THE MAP IS LISTENING")
  const [isFiltering, setIsFiltering] = useState(false)

  const apiKey = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined
  const style = useMemo(() => (apiKey ? createMapStyle(apiKey) : null), [apiKey])

  const clearPinMarkers = useCallback(() => {
    pinMarkersRef.current.forEach((marker) => marker.remove())
    pinMarkersRef.current = []
    setPinRecords([])
  }, [])

  const clearPingMarkers = useCallback(() => {
    pingMarkersRef.current.forEach((marker) => marker.remove())
    pingMarkersRef.current = []
    setPingRecords([])
  }, [])

  const addMapMarker = useCallback((kind: "pin" | "ping", record: MarkerRecord) => {
    const map = mapRef.current
    if (!map) return

    const markerNode = document.createElement("div")
    markerNode.className = `filtermap-marker-node filtermap-marker-node--${kind}`
    markerNode.setAttribute("aria-label", `${kind === "pin" ? "Pinned" : "Pinged"}: ${record.label}`)
    const markerVisual = document.createElement("div")
    markerVisual.className = kind === "pin" ? "filtermap-address-pin" : "filtermap-coordinate-ping"
    if (kind === "pin") {
      const label = document.createElement("span")
      label.textContent = record.label
      markerVisual.appendChild(label)
    }
    markerNode.appendChild(markerVisual)

    const popup = new maplibregl.Popup({ offset: kind === "pin" ? 26 : 18, closeButton: false })
      .setText(`${record.label} // ${record.latitude.toFixed(5)}, ${record.longitude.toFixed(5)}`)
    const marker = new maplibregl.Marker({
      element: markerNode,
      anchor: kind === "pin" ? "bottom" : "center",
    })
      .setLngLat([record.longitude, record.latitude])
      .setPopup(popup)
      .addTo(map)

    if (kind === "pin") pinMarkersRef.current.push(marker)
    else pingMarkersRef.current.push(marker)
  }, [])

  const applyVisibility = useCallback((groups: LayerGroup[]) => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return

    for (const group of allGroups) {
      const visibility = groups.includes(group) ? "visible" : "none"
      for (const layerId of layerGroups[group]) {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visibility)
      }
    }
  }, [])

  useEffect(() => {
    applyVisibility(activeGroups)
  }, [activeGroups, applyVisibility])

  useEffect(() => {
    if (!mapContainerRef.current || !style) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style,
      center: [-2.3, 54.4],
      zoom: 4.8,
      minZoom: 2,
      maxZoom: 19,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    })

    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right")

    const updateReadout = () => {
      const center = map.getCenter()
      setCoordinates(formatCoordinates(center.lng, center.lat))
      setZoom(map.getZoom().toFixed(1))
    }

    let disposed = false
    const updateArea = async () => {
      if (!apiKey) return
      const requestId = ++areaRequestRef.current
      const center = map.getCenter()
      try {
        const area = await reverseGeocode(center.lng, center.lat, apiKey)
        if (!disposed && requestId === areaRequestRef.current) setAreaLabel(area.toUpperCase())
      } catch {
        if (!disposed && requestId === areaRequestRef.current) setAreaLabel("AREA SIGNAL MASKED")
      }
    }

    map.on("load", () => {
      setMapStatus("VECTOR FEED ONLINE")
      updateReadout()
      void updateArea()
      applyVisibility(allGroups)
    })
    map.on("move", updateReadout)
    map.on("moveend", updateArea)
    map.on("error", () => setMapStatus("SIGNAL DEGRADED"))

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const position: [number, number] = [coords.longitude, coords.latitude]
          const markerNode = document.createElement("div")
          markerNode.className = "filtermap-location-marker"
          markerNode.setAttribute("aria-label", "Your current location")
          locationMarkerRef.current = new maplibregl.Marker({ element: markerNode })
            .setLngLat(position)
            .addTo(map)
          map.flyTo({ center: position, zoom: 15.4, speed: 1.4, curve: 1.2, essential: true })
          setMapStatus("LOCAL NODE ACQUIRED")
        },
        () => setMapStatus("LOCATION MASKED // UK FALLBACK"),
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
      )
    } else {
      setMapStatus("LOCATION MODULE ABSENT")
    }

    return () => {
      disposed = true
      locationMarkerRef.current?.remove()
      pinMarkersRef.current.forEach((marker) => marker.remove())
      pingMarkersRef.current.forEach((marker) => marker.remove())
      pinMarkersRef.current = []
      pingMarkersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [apiKey, applyVisibility, style])

  const toggleGroup = (group: LayerGroup) => {
    setActiveGroups((current) =>
      current.includes(group) ? current.filter((item) => item !== group) : [...current, group],
    )
  }

  const locateUser = () => {
    if (!navigator.geolocation) return
    setMapStatus("TRIANGULATING")
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position: [number, number] = [coords.longitude, coords.latitude]
        locationMarkerRef.current?.setLngLat(position)
        mapRef.current?.flyTo({ center: position, zoom: 16, essential: true })
        setMapStatus("LOCAL NODE ACQUIRED")
      },
      () => setMapStatus("LOCATION ACCESS DENIED"),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const submitCommand = async (event: FormEvent) => {
    event.preventDefault()
    const cleanCommand = command.trim()
    const map = mapRef.current
    if (!cleanCommand || isFiltering || !map || !apiKey) return

    setIsFiltering(true)
    setCommandStatus("LUNA IS DECODING THE SIGNAL…")

    try {
      const currentCenter = map.getCenter()
      const response = await fetch("/api/filter-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: cleanCommand,
          context: {
            center: { longitude: currentCenter.lng, latitude: currentCenter.lat },
            zoom: map.getZoom(),
            area: areaLabel,
            visibleLayers: activeGroups,
            pins: pinRecords,
            pings: pingRecords,
          },
        }),
      })
      const responseText = await response.text()
      let payload: MapActionPlan
      try {
        payload = JSON.parse(responseText) as MapActionPlan
      } catch {
        throw new Error("The neural link returned static")
      }
      if (!response.ok) throw new Error(payload?.error || "Unknown signal failure")

      if (payload.filters?.change) {
        const groups = Array.isArray(payload.filters.layers)
          ? payload.filters.layers.filter(
              (group: unknown): group is LayerGroup =>
                typeof group === "string" && allGroups.includes(group as LayerGroup),
            )
          : []
        setActiveGroups(groups)
      }

      if (payload.clearPins) clearPinMarkers()
      if (payload.clearPings) clearPingMarkers()

      const addressCache = new Map<string, ReturnType<typeof geocodeAddress>>()
      const locateAddress = (address: string) => {
        const key = address.trim().toLowerCase()
        const existing = addressCache.get(key)
        if (existing) return existing
        const request = geocodeAddress(address, apiKey, [currentCenter.lng, currentCenter.lat])
        addressCache.set(key, request)
        return request
      }

      const resolveTarget = async (target: MarkerTarget) => {
        if (target.targetType === "coordinates") {
          if (
            !Number.isFinite(target.longitude) || !Number.isFinite(target.latitude) ||
            target.longitude < -180 || target.longitude > 180 ||
            target.latitude < -90 || target.latitude > 90
          ) return null
          return {
            coordinates: [target.longitude, target.latitude] as [number, number],
            placeName: target.label,
          }
        }
        return locateAddress(target.address)
      }

      const pinTargets = Array.isArray(payload.pins) ? payload.pins : []
      const pingTargets = Array.isArray(payload.pings) ? payload.pings : []
      const cameraAddressPromise = payload.camera?.targetType === "address" && payload.camera.address
        ? locateAddress(payload.camera.address)
        : Promise.resolve(null)
      const [resolvedPins, resolvedPings, cameraAddress] = await Promise.all([
        Promise.all(pinTargets.map(async (target) => ({ target, location: await resolveTarget(target) }))),
        Promise.all(pingTargets.map(async (target) => ({ target, location: await resolveTarget(target) }))),
        cameraAddressPromise,
      ])

      const newPinRecords = resolvedPins.flatMap(({ target, location }) => {
        if (!location) return []
        const record: MarkerRecord = {
          id: `pin-${Date.now()}-${Math.random()}`,
          address: target.address || location.placeName,
          longitude: location.coordinates[0],
          latitude: location.coordinates[1],
          label: target.label || location.placeName,
        }
        addMapMarker("pin", record)
        return [record]
      })
      const newPingRecords = resolvedPings.flatMap(({ target, location }) => {
        if (!location) return []
        const record: MarkerRecord = {
          id: `ping-${Date.now()}-${Math.random()}`,
          address: target.address || location.placeName,
          longitude: location.coordinates[0],
          latitude: location.coordinates[1],
          label: target.label || location.placeName,
        }
        addMapMarker("ping", record)
        return [record]
      })

      if (newPinRecords.length) {
        setPinRecords((current) => payload.clearPins ? newPinRecords : [...current, ...newPinRecords])
      }
      if (newPingRecords.length) {
        setPingRecords((current) => payload.clearPings ? newPingRecords : [...current, ...newPingRecords])
      }

      const camera = payload.camera
      const cameraZoom = camera && camera.zoom > 0 ? Math.min(19, Math.max(2, camera.zoom)) : map.getZoom()
      let cameraTarget: [number, number] | null = null
      if (camera?.targetType === "address" && cameraAddress) cameraTarget = cameraAddress.coordinates
      if (
        camera?.targetType === "coordinates" &&
        Number.isFinite(camera.longitude) && Number.isFinite(camera.latitude) &&
        camera.longitude >= -180 && camera.longitude <= 180 &&
        camera.latitude >= -90 && camera.latitude <= 90
      ) cameraTarget = [camera.longitude, camera.latitude]
      if (camera?.targetType === "current") cameraTarget = [currentCenter.lng, currentCenter.lat]

      if (cameraTarget) {
        map.flyTo({ center: cameraTarget, zoom: cameraZoom, duration: 1900, curve: 1.35, essential: true })
      } else if (camera && camera.zoom > 0) {
        map.easeTo({ zoom: cameraZoom, duration: 1500, essential: true })
      } else {
        const newTargets = [...newPinRecords, ...newPingRecords]
        if (newTargets.length > 1) {
          const bounds = new maplibregl.LngLatBounds()
          newTargets.forEach((target) => bounds.extend([target.longitude, target.latitude]))
          map.fitBounds(bounds, { padding: 90, maxZoom: 15, duration: 1900 })
        }
      }

      const missedTargets = pinTargets.length + pingTargets.length - newPinRecords.length - newPingRecords.length
      const status = payload.message || "ACTION PLAN ACCEPTED"
      setCommandStatus(`${status}${missedTargets ? ` // ${missedTargets} TARGET${missedTargets === 1 ? "" : "S"} UNRESOLVED` : ""}`.toUpperCase())
      setCommand("")
    } catch (error) {
      setCommandStatus(error instanceof Error ? error.message.toUpperCase() : "THE SIGNAL WENT DARK")
    } finally {
      setIsFiltering(false)
    }
  }

  return (
    <main className="filtermap-shell">
      <div className="filtermap-noise" aria-hidden="true" />

      <header className="filtermap-header">
        <Link to="/" className="filtermap-back" aria-label="Return home">
          <span aria-hidden="true">←</span> ESC
        </Link>
        <div className="filtermap-brand">
          <span className="filtermap-brand-index">07</span>
          <div>
            <p>PHI SIGNAL DIVISION</p>
            <h1>FILTER<span>MAP</span></h1>
          </div>
        </div>
        <div className="filtermap-clock" aria-live="polite">
          <span className="filtermap-pulse" /> {mapStatus}
        </div>
      </header>

      <section className="filtermap-workspace" aria-label="Interactive map filter">
        <aside className="filtermap-sidebar">
          <div className="filtermap-sidebar-heading">
            <span>DISPLAY CHANNELS</span>
            <span>{activeGroups.length.toString().padStart(2, "0")}/08</span>
          </div>
          <div className="filtermap-layer-list">
            {allGroups.map((group, index) => {
              const active = activeGroups.includes(group)
              return (
                <button
                  type="button"
                  className={active ? "is-active" : ""}
                  aria-pressed={active}
                  onClick={() => toggleGroup(group)}
                  key={group}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {layerLabels[group]}
                  <i aria-hidden="true" />
                </button>
              )
            })}
          </div>
          <button type="button" className="filtermap-reset" onClick={() => setActiveGroups(allGroups)}>
            RESTORE ALL CHANNELS
          </button>
        </aside>

        <div className="filtermap-stage">
          <div className="filtermap-viewport-frame">
            <div className="filtermap-corner filtermap-corner--tl" aria-hidden="true" />
            <div className="filtermap-corner filtermap-corner--tr" aria-hidden="true" />
            <div className="filtermap-corner filtermap-corner--bl" aria-hidden="true" />
            <div className="filtermap-corner filtermap-corner--br" aria-hidden="true" />
            {style ? (
              <div className="filtermap-map" ref={mapContainerRef} />
            ) : (
              <div className="filtermap-key-error">
                <span>NO VECTOR CREDENTIAL</span>
                VITE_MAPTILER_API_KEY was not detected.
              </div>
            )}
            <div className="filtermap-map-label filtermap-map-label--top">LIVE // EPSG:3857</div>
            <div className="filtermap-map-label filtermap-map-label--bottom">{coordinates}</div>
          </div>

          <form className="filtermap-command" onSubmit={submitCommand}>
            <div className="filtermap-command-mark" aria-hidden="true">⌁</div>
            <label htmlFor="filtermap-command-input">
              <span>LUNA MAP OPERATOR</span>
              <input
                id="filtermap-command-input"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="move, zoom, filter, pin, ping…"
                maxLength={500}
                autoComplete="off"
                spellCheck="false"
              />
            </label>
            <button type="submit" disabled={isFiltering || !command.trim() || !apiKey}>
              {isFiltering ? "…" : "EXECUTE"}
            </button>
          </form>
          <p className="filtermap-command-status" aria-live="polite">{commandStatus}</p>
        </div>

        <aside className="filtermap-telemetry">
          <div className="filtermap-telemetry-block">
            <span>COORDINATES</span>
            <strong>{coordinates}</strong>
          </div>
          <div className="filtermap-telemetry-block">
            <span>GENERAL AREA</span>
            <strong title={areaLabel}>{areaLabel}</strong>
          </div>
          <div className="filtermap-telemetry-grid">
            <div><span>ZOOM</span><strong>{zoom}</strong></div>
            <div><span>PROJECTION</span><strong>WEB/M</strong></div>
            <div><span>VECTOR</span><strong>V4</strong></div>
            <div><span>AI CORE</span><strong>LUNA</strong></div>
            <div><span>PINS</span><strong>{pinRecords.length.toString().padStart(2, "0")}</strong></div>
            <div><span>PINGS</span><strong>{pingRecords.length.toString().padStart(2, "0")}</strong></div>
          </div>
          <div className="filtermap-signal-bars" aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 17) % 66)}%` }} />)}
          </div>
          <button type="button" className="filtermap-locate" onClick={locateUser}>
            <span aria-hidden="true">◎</span>
            RECENTER LOCAL NODE
          </button>
          <p className="filtermap-telemetry-note">
            VECTOR CARTOGRAPHY<br />
            MAPTILER // OSM<br />
            <span>ENCRYPTED VISUAL LAYER</span>
          </p>
        </aside>
      </section>
    </main>
  )
}
