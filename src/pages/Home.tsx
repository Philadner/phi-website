import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useWheelMotion } from '../hooks/useWheelMotion'
import { usePhrases } from '../hooks/usePhrases'
import { savePhrasePreferences, usePhrasePreferences } from '../hooks/usePhrasePreferences'
import { MODERATION_PREFERENCE_CATEGORIES, MODERATION_LABELS } from '../lib/phraseModeration'
import type { ModerationCategory } from '../lib/phraseModeration'
import { CATEGORIES, HOME_RESET_EVENT, NAVIGATION, PROJECTS, SOCIALS, SETTINGS_SUBTABS, homeSwipeTarget, tick } from '../lib/homeNavigation'
import type { Category, HomeWheelSurface, WheelItem } from '../lib/homeNavigation'
import { getSavedTheme, paintTheme, themes, themeVisible, THEME_STORAGE_KEY } from '../lib/themes'
import '../stylesheets/home.css'

const RADIUS = 10
function shuffle<T>(items: T[]) {
  const deck = [...items]
  for (let index = deck.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[deck[index], deck[swap]] = [deck[swap], deck[index]]
  }
  return deck
}

type Layer = { id: number; category: Category; rows: WordRow[] }
type WordRow = { item: WheelItem; index: number; scale: number; opacity: number; y: number; distance: number }
type Gesture = { id: number; x: number; y: number; lastY: number; time: number; axis: 'x' | 'y' | null; dragged: boolean; surface: HomeWheelSurface }

export default function Home() {
  const navigate = useNavigate()
  const mobile = useMediaQuery('(max-width: 900px)')
  const compact = useMediaQuery('(max-width: 700px)')
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [categoryIndex, setCategoryIndex] = useState(2)
  const [keyboardFocus, setKeyboardFocus] = useState(false)
  const category = CATEGORIES[categoryIndex]
  const [generation, setGeneration] = useState(0)
  const sourcePhrases = usePhrases()
  const [phrases, setPhrases] = useState(sourcePhrases)
  const [phraseTape, setPhraseTape] = useState(new Map<number, string>())
  const deck = useRef<string[]>([])
  const lastPhrase = useRef('')
  const tape = useRef(new Map<number, string>())
  const wheelRef = useRef<HTMLDivElement>(null)
  const categoriesRef = useRef<HTMLDivElement>(null)
  const measurementRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)
  const [metrics, setMetrics] = useState({ font: 52, heights: [] as number[] })
  const applied = useRef(getSavedTheme())
  const themePickerRef = useRef(false)
  const [message, setMessage] = useState('')
  const [outgoing, setOutgoing] = useState<Layer[]>([])
  const layersRef = useRef<Layer[]>([])
  const timers = useRef(new Set<number>())
  const sequence = useRef(0)
  const gesture = useRef<Gesture | null>(null)
  const suppressClick = useRef(0)
  const wheelAccumulator = useRef({ x: 0, y: 0, time: 0, surface: 'items' as HomeWheelSurface })
  const [categoryDrag, setCategoryDrag] = useState(0)
  const preferences = usePhrasePreferences()
  const availableThemes = useMemo(() => themes.filter(theme => themeVisible(theme, preferences.showOffensive)), [preferences.showOffensive])
  const settingsTabsRef = useRef<HTMLDivElement>(null)
  const [settingsTabIndex, setSettingsTabIndex] = useState(0)
  const [subtabDrag, setSubtabDrag] = useState(0)
  const themePicker = category === 'Settings' && SETTINGS_SUBTABS[settingsTabIndex].id === 'theme'
  themePickerRef.current = themePicker

  const items = useMemo<WheelItem[]>(() => {
    if (category === 'Socials') return SOCIALS
    if (category === 'Projects') return PROJECTS
    if (themePicker) return availableThemes.map(theme => ({ id: theme.id, label: theme.name, themeId: theme.id }))
    if (category === 'Settings') {
      const settings: WheelItem[] = [
        { id: 'show-offensive', label: 'Show generally offensive content', setting: 'show-offensive', settingValue: preferences.showOffensive, small: true },
        { id: 'show-filtered', label: 'Show sensitive content', setting: 'show-filtered', settingValue: preferences.showFiltered, small: true },
      ]
      if (preferences.showFiltered) settings.push(...MODERATION_PREFERENCE_CATEGORIES.map(setting => ({ id: `filter-${setting}`, label: `Show ${MODERATION_LABELS[setting]}`, setting, settingValue: !preferences.moderated.includes(setting), small: true })))
      return settings
    }
    if (category === 'Navigate') {
      const destinations = NAVIGATION.filter(item => mobile || !item.game)
      return document.documentElement.dataset.themeDemo === 'true'
        ? [...destinations, { id: 'theme-lab', label: 'Theme lab', href: '/theme-lab' }]
        : destinations
    }
    return []
  }, [category, mobile, preferences, themePicker, availableThemes])
  const initial = themePicker ? Math.max(0, availableThemes.findIndex(theme => theme.id === applied.current.id)) : 0
  const motion = useWheelMotion({
    resetKey: `${category}:${generation}:${category === 'Settings' ? settingsTabIndex : ''}:${category === 'phi' ? phrases.join('\0') : items.map(item => item.id).join(',')}`,
    min: category === 'phi' ? -Infinity : 0,
    max: category === 'phi' ? Infinity : Math.max(0, items.length - 1),
    initial, auto: category === 'phi' && phrases.length > 1, reduced,
  })
  const { settle } = motion
  const selectedIndex = Math.round(motion.position)
  const selected = category === 'phi'
    ? { id: `phrase-${selectedIndex}`, label: phraseTape.get(selectedIndex) ?? phrases[0] ?? '' }
    : items[selectedIndex] ?? items[initial]

  useEffect(() => {
    document.body.classList.add('body--home-lock')
    const activeTimers = timers.current
    return () => {
      document.body.classList.remove('body--home-lock')
      activeTimers.forEach(clearTimeout)
      if (themePickerRef.current) paintTheme(applied.current)
    }
  }, [])

  // Measure at FULL size. Navigation wraps once at that width, then the entire
  // block scales; its line breaks cannot jump as it moves towards the centre.
  // Community phrases retain the original single-line width filtering.
  useLayoutEffect(() => {
    const measure = () => {
      const measurement = measurementRef.current
      const probe = probeRef.current
      if (!measurement || !probe) return
      const font = parseFloat(getComputedStyle(probe).fontSize)
      const nodes = [...measurement.children] as HTMLElement[]
      setMetrics(previous => {
        const heights = nodes.map(node => node.offsetHeight)
        return previous.font === font && previous.heights.join() === heights.join() ? previous : { font, heights }
      })
      if (category === 'phi') {
        const fitting = sourcePhrases.filter((_, index) => nodes[index]?.scrollWidth <= measurement.clientWidth)
        const next = fitting.length ? fitting : ['phi']
        setPhrases(previous => previous.join('\0') === next.join('\0') ? previous : next)
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (wheelRef.current) observer.observe(wheelRef.current)
    if (probeRef.current) observer.observe(probeRef.current)
    return () => observer.disconnect()
  }, [category, items, sourcePhrases])

  const draw = useCallback(() => {
    if (!deck.current.length) {
      deck.current = shuffle(phrases)
      if (deck.current.length > 1 && deck.current[deck.current.length - 1] === lastPhrase.current) {
        ;[deck.current[0], deck.current[deck.current.length - 1]] = [deck.current[deck.current.length - 1], deck.current[0]]
      }
    }
    const phrase = deck.current.pop() ?? 'phi'
    lastPhrase.current = phrase
    return phrase
  }, [phrases])
  useEffect(() => {
    deck.current = []
    lastPhrase.current = ''
    const next = new Map<number, string>()
    for (let index = -RADIUS - 4; index <= RADIUS + 4; index++) next.set(index, draw())
    tape.current = next
    setPhraseTape(next)
  }, [draw])
  useEffect(() => {
    if (category !== 'phi') return
    const next = new Map(tape.current)
    let changed = false
    for (let index = selectedIndex - RADIUS - 4; index <= selectedIndex + RADIUS + 4; index++) {
      if (!next.has(index)) { next.set(index, draw()); changed = true }
    }
    // Bound the infinite tape while retaining ample scroll history.
    for (const index of next.keys()) if (Math.abs(index - selectedIndex) > 100) next.delete(index)
    if (changed) { tape.current = next; setPhraseTape(next) }
  }, [category, selectedIndex, draw])

  const rows = useMemo<WordRow[]>(() => {
    const first = category === 'phi' ? Math.floor(motion.position) - RADIUS : 0
    const last = category === 'phi' ? Math.ceil(motion.position) + RADIUS : items.length - 1
    const result: WordRow[] = []
    let centre = 0
    let previousHeight = 0
    for (let index = first; index <= last; index++) {
      const distance = Math.abs(index - motion.position)
      const focus = Math.pow(Math.max(0, 1 - distance), 2.45)
      const scale = .5 + .5 * focus
      const item = category === 'phi' ? { id: `phrase-${index}`, label: phraseTape.get(index) ?? '' } : items[index]
      const height = (category === 'phi' ? metrics.font * .92 : metrics.heights[index] ?? metrics.font * .92) * scale
      if (index > first) centre += (previousHeight + height) / 2 + Math.max(12, metrics.font * .12)
      previousHeight = height
      result.push({ item, index, scale, distance, y: centre, opacity: category === 'phi' ? Math.max(.08, .24 - distance * .018) + .76 * focus : Math.max(.28, .78 - distance * .09) + .22 * focus })
    }
    const floor = Math.floor(motion.position)
    const lower = result.find(row => row.index === floor)?.y ?? 0
    const upper = result.find(row => row.index === floor + 1)?.y ?? lower
    const reference = lower + (upper - lower) * (motion.position - floor)
    return result.map(row => ({ ...row, y: row.y - reference }))
  }, [category, motion.position, items, metrics, phraseTape])
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  const changeCategory = useCallback((next: number, haptic = true, reset = false) => {
    const index = Math.max(0, Math.min(CATEGORIES.length - 1, next))
    if (index === categoryIndex && !reset) return
    if (haptic && index !== categoryIndex) tick(14)
    if (themePicker) paintTheme(applied.current)
    if (wheelRef.current?.contains(document.activeElement)) wheelRef.current.focus({ preventScroll: true })
    settle()
    if (!reduced && index !== categoryIndex) {
      const layer = { id: ++sequence.current, category, rows: rowsRef.current }
      // Keep only the newest outgoing waves; older waves are already transparent.
      layersRef.current = [...layersRef.current.slice(-2), layer]
      setOutgoing(layersRef.current)
      const timer = window.setTimeout(() => {
        layersRef.current = layersRef.current.filter(old => old.id !== layer.id)
        setOutgoing(layersRef.current)
        timers.current.delete(timer)
      }, 440)
      timers.current.add(timer)
    } else { layersRef.current = []; setOutgoing([]) }
    setMessage('')
    setSettingsTabIndex(0)
    setSubtabDrag(0)
    setCategoryDrag(0)
    setCategoryIndex(index)
    setGeneration(value => value + 1)
  }, [categoryIndex, category, settle, reduced, themePicker])

  function selectSettingsTab(index: number) {
    const next = Math.max(0, Math.min(SETTINGS_SUBTABS.length - 1, index))
    if (next !== settingsTabIndex) {
      if (themePicker) paintTheme(applied.current)
      tick(14)
      settle()
      setSettingsTabIndex(next)
      setGeneration(value => value + 1)
      setMessage('')
    }
  }
  function moveAcross(direction: number, surface: HomeWheelSurface) {
    const next = homeSwipeTarget({ surface, mainIndex: categoryIndex, mainCount: CATEGORIES.length, subIndex: settingsTabIndex, subCount: category === 'Settings' ? SETTINGS_SUBTABS.length : 0, direction })
    if (next.mainIndex !== categoryIndex) changeCategory(next.mainIndex)
    else selectSettingsTab(next.subIndex)
  }

  useEffect(() => {
    const reset = () => changeCategory(2, false, true)
    window.addEventListener(HOME_RESET_EVENT, reset)
    return () => window.removeEventListener(HOME_RESET_EVENT, reset)
  }, [changeCategory])

  useEffect(() => {
    if (!availableThemes.some(theme => theme.id === applied.current.id)) {
      applied.current = availableThemes[0]
      paintTheme(applied.current)
      try { localStorage.setItem(THEME_STORAGE_KEY, applied.current.id) } catch { /* Keep the fallback for this visit. */ }
    }
  }, [availableThemes])

  useEffect(() => {
    if (!themePicker) return
    const theme = availableThemes[Math.round(motion.positionRef.current)]
    if (theme) {
      paintTheme(theme)
      if (theme.id !== applied.current.id) setMessage('')
    }
  }, [themePicker, selectedIndex, generation, motion.positionRef, availableThemes])

  function activate(item: WheelItem) {
    if (performance.now() < suppressClick.current) return
    if (item.setting) {
      tick(18)
      if (item.setting === 'show-offensive') {
        savePhrasePreferences({ ...preferences, showOffensive: !preferences.showOffensive })
        setMessage(preferences.showOffensive ? 'Generally offensive content is hidden.' : 'Showing generally offensive content.')
      } else if (item.setting === 'show-filtered') {
        savePhrasePreferences({ ...preferences, showFiltered: !preferences.showFiltered, moderated: [] })
        setMessage(!preferences.showFiltered ? 'Showing sensitive content. All individual Show options start on.' : 'Sensitive content is hidden by default.')
      } else {
        const setting = item.setting as ModerationCategory
        const shown = !preferences.moderated.includes(setting)
        savePhrasePreferences({ ...preferences, moderated: shown ? [...preferences.moderated, setting] : preferences.moderated.filter(value => value !== setting) })
        setMessage(`${shown ? 'Hiding' : 'Showing'} ${MODERATION_LABELS[setting]}.`)
      }
    } else if (item.themeId) {
      const theme = availableThemes.find(value => value.id === item.themeId)
      if (!theme) return
      applied.current = theme
      paintTheme(theme)
      try { localStorage.setItem(THEME_STORAGE_KEY, theme.id); setMessage(`${theme.name} applied and saved.`) }
      catch { setMessage(`${theme.name} applied for this visit. Browser storage is unavailable.`) }
      tick(18)
    } else if (item.category) {
      tick(18)
      changeCategory(CATEGORIES.indexOf(item.category), false, true)
      if (item.settingsTab) setSettingsTabIndex(SETTINGS_SUBTABS.findIndex(tab => tab.id === item.settingsTab))
    }
    else if (item.href) {
      tick(18)
      if (item.external) window.location.assign(item.href)
      else navigate(item.href)
    }
  }

  function onKeyDown(event: globalThis.KeyboardEvent) {
    if (['Tab', 'Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) setKeyboardFocus(true)
    if (event.target instanceof HTMLElement && (event.target.matches('input, textarea, select') || event.target.isContentEditable)) return
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Node && !wheelRef.current?.contains(event.target) && !categoriesRef.current?.contains(event.target) && event.target !== document.body) return
    if (event.target instanceof Node && settingsTabsRef.current?.contains(event.target)) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
        moveAcross(event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1, 'subtabs')
      }
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const surface = event.target instanceof Node && categoriesRef.current?.contains(event.target) ? 'main' : 'items'
      event.preventDefault(); wheelRef.current?.focus({ preventScroll: true }); moveAcross(event.key === 'ArrowRight' ? 1 : -1, surface)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault(); wheelRef.current?.focus({ preventScroll: true }); motion.step(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      suppressClick.current = 0
      const item = items[Math.round(motion.positionRef.current)]
      if (item) activate(item)
    }
  }

  const keyboardHandler = useRef(onKeyDown)
  keyboardHandler.current = onKeyDown
  useEffect(() => {
    const handle = (event: globalThis.KeyboardEvent) => keyboardHandler.current(event)
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  const handlers = useRef({ moveAcross, step: motion.step })
  handlers.current = { moveAcross, step: motion.step }
  useEffect(() => {
    const upper = wheelRef.current
    const lower = categoriesRef.current
    if (!upper || !lower) return
    const subtabs = settingsTabsRef.current
    const scroll = (event: WheelEvent, surface: HomeWheelSurface) => {
      event.preventDefault()
      const state = wheelAccumulator.current
      const now = performance.now()
      if (now - state.time > 220 || state.surface !== surface) { state.x = 0; state.y = 0 }
      state.surface = surface
      state.time = now
      const multiplier = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 400 : 1
      const horizontal = surface !== 'items' || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)
      const axis = horizontal ? 'x' : 'y'
      state[axis] += (horizontal ? event.deltaX || event.deltaY : event.deltaY) * multiplier
      if (Math.abs(state[axis]) < (horizontal ? 70 : 80)) return
      const direction = Math.sign(state[axis])
      state[axis] = 0
      if (horizontal) handlers.current.moveAcross(direction, surface)
      else handlers.current.step(direction)
    }
    const verticalWheel = (event: WheelEvent) => scroll(event, 'items')
    const horizontalWheel = (event: WheelEvent) => scroll(event, 'main')
    const subtabWheel = (event: WheelEvent) => scroll(event, 'subtabs')
    upper.addEventListener('wheel', verticalWheel, { passive: false })
    lower.addEventListener('wheel', horizontalWheel, { passive: false })
    subtabs?.addEventListener('wheel', subtabWheel, { passive: false })
    return () => { upper.removeEventListener('wheel', verticalWheel); lower.removeEventListener('wheel', horizontalWheel); subtabs?.removeEventListener('wheel', subtabWheel) }
  }, [category])

  function pointerDown(event: ReactPointerEvent, surface: HomeWheelSurface) {
    setKeyboardFocus(false)
    if (event.pointerType === 'mouse' && event.button !== 0) return
    suppressClick.current = 0
    gesture.current = { dragged: false, id: event.pointerId, x: event.clientX, y: event.clientY, lastY: event.clientY, time: event.timeStamp, surface, axis: surface !== 'items' ? compact ? 'x' : 'y' : null }
  }
  function pointerMove(event: ReactPointerEvent) {
    const state = gesture.current
    if (!state || state.id !== event.pointerId) return
    const dx = event.clientX - state.x
    const dy = event.clientY - state.y
    if (!state.dragged && Math.max(Math.abs(dx), Math.abs(dy)) < 8) return
    if (!state.axis) state.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (!state.dragged) {
      event.currentTarget.setPointerCapture(event.pointerId)
      if (state.axis === 'y' && state.surface === 'items') motion.begin()
    }
    if (state.surface !== 'items' || state.axis === 'x') {
      const delta = state.axis === 'x' ? dx : dy
      const destination = homeSwipeTarget({ surface: state.surface, mainIndex: categoryIndex, mainCount: CATEGORIES.length, subIndex: settingsTabIndex, subCount: category === 'Settings' ? SETTINGS_SUBTABS.length : 0, direction: delta < 0 ? 1 : -1 })
      if (state.surface === 'main' || destination.mainIndex !== categoryIndex) setCategoryDrag(Math.max(-180, Math.min(180, delta)))
      else setSubtabDrag(Math.max(-120, Math.min(120, delta)))
    } else {
      motion.drag(-(event.clientY - state.lastY) / Math.max(52, metrics.font * .7), (event.timeStamp - state.time) / 1000)
    }
    state.dragged = true
    event.preventDefault()
    state.lastY = event.clientY
    state.time = event.timeStamp
  }
  function pointerEnd(event: ReactPointerEvent, cancel = false) {
    const state = gesture.current
    if (!state || state.id !== event.pointerId) return
    const moved = state.dragged
    if (moved) {
      suppressClick.current = performance.now() + 320
      if (state.axis === 'y' && state.surface === 'items') motion.end(cancel)
      else {
        const delta = state.axis === 'x' ? event.clientX - state.x : event.clientY - state.y
        if (!cancel && Math.abs(delta) >= 40) moveAcross(delta < 0 ? 1 : -1, state.surface)
      }
    }
    gesture.current = null
    setCategoryDrag(0)
    setSubtabDrag(0)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function activateCentred(event: ReactMouseEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    event.preventDefault()
    const item = items[Math.round(motion.positionRef.current)]
    if (item) activate(item)
  }

  function renderInk(item: WheelItem) {
    return <span className="home-item-ink">{item.settingValue === undefined ? <span>{item.label}</span> : <span className="home-setting-text" data-enabled={item.settingValue}>
        <span className="home-setting-outline">{item.label}</span>
        <span className="home-setting-fill" aria-hidden="true">{item.label}</span>
        <span className="home-setting-strike" aria-hidden="true">{item.label}</span>
      </span>}
        {item.themeId && <span className="home-theme-swatches" aria-hidden="true">{Object.entries(themes.find(theme => theme.id === item.themeId) ?? {}).filter(([key]) => ['background', 'primary', 'secondary', 'highlight'].includes(key)).map(([key, colour]) => <i key={key} style={{ backgroundColor: String(colour) }} />)}</span>}
        {item.id === 'jay' && <span className="gameshow-banner home-jay-banner" aria-hidden="true"><span className="gameshow-text">Jay Game</span><span className="gameshow-divider">Play in browser</span></span>}
      </span>
  }

  function renderRows(wordRows: WordRow[], group: Category, old = false) {
    const centreIndex = old
      ? wordRows.reduce<WordRow | undefined>((best, row) => !best || row.distance < best.distance ? row : best, undefined)?.index ?? 0
      : selectedIndex
    return wordRows.map(row => {
      const focused = !old && row.index === selectedIndex
      const style = {
        '--word-scale': row.scale, '--ripple-offset': `${Math.sign(row.y) * 18}px`,
        '--ripple-delay': `${Math.min(4, Math.abs(row.index - centreIndex)) * 22}ms`,
        opacity: row.opacity, transform: `translate3d(var(--home-phrase-x), ${row.y}px, 0)`, zIndex: focused ? 10 : 1,
      } as CSSProperties
      const word = renderInk(row.item)
      const className = `home-word ${group === 'phi' ? 'home-word--phrase' : ''} ${row.item.small ? 'home-word--setting-child' : ''} ${(old ? row.index === centreIndex : focused) ? 'is-focused' : ''}`
      return <div className={`home-wheel-row ${group === 'Settings' ? 'home-setting-row' : ''} ${row.item.small ? 'home-setting-child' : ''}`} key={row.item.id} style={style} aria-hidden={!focused}>
        {old || group === 'phi' ? <span className={className}>{word}</span>
          : row.item.href ? <a className={className} href={row.item.href} tabIndex={focused ? 0 : -1} aria-label={row.item.label}>{word}</a>
          : <button type="button" className={className} tabIndex={focused ? 0 : -1} aria-pressed={row.item.settingValue} aria-expanded={row.item.expanded} aria-label={row.item.themeId ? `Apply ${row.item.label} theme` : row.item.settingValue === undefined ? row.item.label : `${row.item.label}: ${row.item.settingValue ? 'on' : 'off'}`}>{word}</button>}
      </div>
    })
  }

  return <main className="home-stage home-navigation" data-category={category} data-input={keyboardFocus ? 'keyboard' : 'pointer'}>
    <p id="home-wheel-help" className="home-phrase-announcement">{compact ? 'Swipe left or right to choose a category.' : 'Scroll or swipe the right wheel vertically to choose a category.'} Scroll up or down to choose an item. Tap anywhere in the item wheel or press Enter to activate the centred item. Arrow keys move along both axes.</p>
    <div ref={wheelRef} id={category === 'Settings' ? 'home-settings-panel' : undefined} className={`home-phrase-wheel-zone ${category === 'phi' ? 'is-phrases' : 'is-navigation'}`} tabIndex={0} role={category === 'Settings' ? 'tabpanel' : 'region'} aria-labelledby={category === 'Settings' ? `home-${SETTINGS_SUBTABS[settingsTabIndex].id}-tab` : undefined} aria-label={`${category} word wheel`} aria-describedby="home-wheel-help"
      onClick={activateCentred} onPointerDown={event => pointerDown(event, 'items')} onPointerMove={event => pointerMove(event)} onPointerUp={event => pointerEnd(event)} onPointerCancel={event => pointerEnd(event, true)}>
      {outgoing.map(layer => <div className={`home-phrase-wall home-ripple-out ${layer.category === 'phi' ? 'home-phrase-wall--phrases' : ''}`} key={layer.id} aria-hidden="true" inert>{renderRows(layer.rows, layer.category, true)}</div>)}
      <div className={`home-phrase-wall ${category === 'phi' ? 'home-phrase-wall--phrases' : ''} ${generation && !reduced ? 'home-ripple-in' : ''}`} key={generation}>
        {renderRows(rows, category)}
      </div>
      {category === 'Settings' && <p className="home-wheel-feedback" aria-hidden="true">{message || (themePicker ? 'Scroll to preview · Tap anywhere to apply' : 'Scroll to focus · Tap anywhere to change · Outlined and crossed out means off')}</p>}
      <span ref={probeRef} className="home-size-probe" aria-hidden="true">phi</span>
      <div ref={measurementRef} className="home-word-measure" aria-hidden="true" inert>
        {(category === 'phi' ? sourcePhrases.map((label, index) => ({ id: String(index), label })) : items).map(item => <span key={item.id} className={`home-word ${category === 'phi' ? 'home-word--phrase' : ''} ${'small' in item && item.small ? 'home-word--setting-child' : ''}`}>{renderInk(item)}</span>)}
      </div>
    </div>
    {category === 'Settings' && <div ref={settingsTabsRef} className="home-settings-tabs" data-dragging={Boolean(subtabDrag)} role="tablist" aria-label="Settings submenus" aria-orientation={compact ? 'horizontal' : 'vertical'}
      onPointerDown={event => pointerDown(event, 'subtabs')} onPointerMove={pointerMove} onPointerUp={event => pointerEnd(event)} onPointerCancel={event => pointerEnd(event, true)}>
      {SETTINGS_SUBTABS.map((tab, index) => <button key={tab.id} id={`home-${tab.id}-tab`} type="button" role="tab" aria-selected={index === settingsTabIndex} tabIndex={index === settingsTabIndex ? 0 : -1} aria-controls="home-settings-panel" className="home-settings-tab" style={{ '--subtab-position': index - settingsTabIndex, '--subtab-drag': `${subtabDrag}px` } as CSSProperties} onClick={() => { if (performance.now() >= suppressClick.current) selectSettingsTab(index) }}>{tab.label}</button>)}
    </div>}
    <div ref={categoriesRef} className={`home-category-wheel ${categoryDrag ? 'is-dragging' : ''}`} role="group" aria-label="Homepage categories" aria-describedby="home-wheel-help"
      onPointerDown={event => pointerDown(event, 'main')} onPointerMove={event => pointerMove(event)} onPointerUp={event => pointerEnd(event)} onPointerCancel={event => pointerEnd(event, true)}>
      {CATEGORIES.map((name, index) => <button key={name} type="button" className="home-category" aria-pressed={index === categoryIndex} aria-label={`${name} category`} tabIndex={index === categoryIndex ? 0 : -1}
        style={{ '--category-position': index - categoryIndex, '--category-drag': `${categoryDrag}px`, '--category-opacity': Math.max(.24, .68 - Math.abs(index - categoryIndex) * .13) } as CSSProperties}
        onClick={() => { if (performance.now() >= suppressClick.current) changeCategory(index) }}>{name}</button>)}
    </div>
    <span className="home-phrase-announcement" role="status" aria-live={category === 'phi' ? 'off' : 'polite'}>{message || `${category}: ${selected?.label ?? ''}${themePicker ? '. Previewing; activate to save.' : ''}`}</span>
  </main>
}
