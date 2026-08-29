import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import * as maplibregl from "maplibre-gl"
import type { Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import "../stylesheets/FilterMap.css"

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
  const [activeGroups, setActiveGroups] = useState<LayerGroup[]>(allGroups)
  const [coordinates, setCoordinates] = useState("ACQUIRING POSITION")
  const [zoom, setZoom] = useState("--")
  const [mapStatus, setMapStatus] = useState("INITIALISING VECTOR FEED")
  const [command, setCommand] = useState("")
  const [commandStatus, setCommandStatus] = useState("THE MAP IS LISTENING")
  const [isFiltering, setIsFiltering] = useState(false)

  const apiKey = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined
  const style = useMemo(() => (apiKey ? createMapStyle(apiKey) : null), [apiKey])

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

    map.on("load", () => {
      setMapStatus("VECTOR FEED ONLINE")
      updateReadout()
      applyVisibility(allGroups)
    })
    map.on("move", updateReadout)
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
      locationMarkerRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [applyVisibility, style])

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
    if (!cleanCommand || isFiltering) return

    setIsFiltering(true)
    setCommandStatus("LUNA IS DECODING THE SIGNAL…")

    try {
      const response = await fetch("/api/filter-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cleanCommand }),
      })
      const responseText = await response.text()
      let payload: { error?: string; layers?: unknown; message?: string }
      try {
        payload = JSON.parse(responseText) as { error?: string; layers?: unknown; message?: string }
      } catch {
        throw new Error("The neural link returned static")
      }
      if (!response.ok) throw new Error(payload?.error || "Unknown signal failure")

      const groups = Array.isArray(payload.layers)
        ? payload.layers.filter((group: string): group is LayerGroup => allGroups.includes(group as LayerGroup))
        : []
      setActiveGroups(groups)
      setCommandStatus((payload.message || "FILTER ACCEPTED").toUpperCase())
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
            <div className="filtermap-scanline" aria-hidden="true" />
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
              <span>UNKNOWN INPUT</span>
              <input
                id="filtermap-command-input"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="tell the map what should remain…"
                maxLength={180}
                autoComplete="off"
                spellCheck="false"
              />
            </label>
            <button type="submit" disabled={isFiltering || !command.trim()}>
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
          <div className="filtermap-telemetry-grid">
            <div><span>ZOOM</span><strong>{zoom}</strong></div>
            <div><span>PROJECTION</span><strong>WEB/M</strong></div>
            <div><span>VECTOR</span><strong>V3</strong></div>
            <div><span>AI CORE</span><strong>LUNA</strong></div>
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
