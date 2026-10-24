import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { WheelInk, WheelRows } from '../components/HomeWheelRows'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useOutgoingLayers } from '../hooks/useOutgoingLayers'
import { usePhrases } from '../hooks/usePhrases'
import { savePhrasePreferences, usePhrasePreferences } from '../hooks/usePhrasePreferences'
import { usePhraseTape } from '../hooks/usePhraseTape'
import { useWheelMotion } from '../hooks/useWheelMotion'
import { useWheelScroll } from '../hooks/useWheelScroll'
import { useWordMetrics } from '../hooks/useWordMetrics'
import { CATEGORIES, HOME_RESET_EVENT, SETTINGS_SUBTABS, homeSwipeTarget, tick } from '../lib/homeNavigation'
import type { HomeWheelSurface, WheelItem } from '../lib/homeNavigation'
import { classNames, getWheelItems, layoutRows, toggleSetting, wordClassName } from '../lib/homeWheel'
import { getSavedTheme, paintTheme, themes, THEME_STORAGE_KEY } from '../lib/themes'
import '../stylesheets/home.css'

const DEFAULT_CATEGORY = CATEGORIES.indexOf('phi')
const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
const KEYBOARD_NAVIGATION_KEYS = ['Tab', 'Enter', ' ', ...ARROW_KEYS]
// Pointer travel before a press becomes a drag, and before a drag counts as a swipe.
const DRAG_THRESHOLD = 8
const SWIPE_THRESHOLD = 40
// Ignore the click the browser fires when a drag is released.
const CLICK_SUPPRESS_MS = 320

type Gesture = {
  id: number; x: number; y: number; lastY: number; time: number
  axis: 'x' | 'y' | null; dragged: boolean; surface: HomeWheelSurface
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function isTextEntry(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)
}

export default function Home() {
  const navigate = useNavigate()
  const mobile = useMediaQuery('(max-width: 900px)')
  const compact = useMediaQuery('(max-width: 700px)')
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const preferences = usePhrasePreferences()
  const sourcePhrases = usePhrases()

  const [categoryIndex, setCategoryIndex] = useState(DEFAULT_CATEGORY)
  const [settingsTabIndex, setSettingsTabIndex] = useState(0)
  // Bumped on every category or tab change to restart the wheel and its ripple-in.
  const [generation, setGeneration] = useState(0)
  const [message, setMessage] = useState('')
  const [keyboardFocus, setKeyboardFocus] = useState(false)
  const [categoryDrag, setCategoryDrag] = useState(0)
  const [subtabDrag, setSubtabDrag] = useState(0)

  const wheelRef = useRef<HTMLDivElement>(null)
  const categoriesRef = useRef<HTMLDivElement>(null)
  const settingsTabsRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const suppressClick = useRef(0)
  // The saved theme. The theme picker previews others without saving them.
  const applied = useRef(getSavedTheme())
  const themePickerRef = useRef(false)

  const category = CATEGORIES[categoryIndex]
  const isPhrases = category === 'phi'
  const isSettings = category === 'Settings'
  const settingsTab = SETTINGS_SUBTABS[settingsTabIndex]
  const themePicker = isSettings && settingsTab.id === 'theme'
  themePickerRef.current = themePicker

  const items = useMemo(
    () => getWheelItems({ category, themePicker, preferences, mobile }),
    [category, mobile, preferences, themePicker],
  )
  const { metrics, phrases, measurementRef, probeRef } = useWordMetrics({ category, items, sourcePhrases, wheelRef })

  const initial = themePicker ? Math.max(0, themes.findIndex(theme => theme.id === applied.current.id)) : 0
  const contentKey = isPhrases ? phrases.join('\0') : items.map(item => item.id).join(',')
  const motion = useWheelMotion({
    resetKey: `${category}:${generation}:${isSettings ? settingsTabIndex : ''}:${contentKey}`,
    min: isPhrases ? -Infinity : 0,
    max: isPhrases ? Infinity : Math.max(0, items.length - 1),
    initial,
    auto: isPhrases && phrases.length > 1,
    reduced,
  })
  const { settle } = motion
  const selectedIndex = Math.round(motion.position)
  const phraseTape = usePhraseTape(phrases, isPhrases, selectedIndex)
  const selected = isPhrases
    ? { id: `phrase-${selectedIndex}`, label: phraseTape.get(selectedIndex) ?? phrases[0] ?? '' }
    : items[selectedIndex] ?? items[initial]

  const rows = useMemo(
    () => layoutRows({ category, position: motion.position, items, metrics, phraseTape }),
    [category, motion.position, items, metrics, phraseTape],
  )
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const { layers: outgoing, push: pushOutgoing, clear: clearOutgoing } = useOutgoingLayers()

  useEffect(() => {
    document.body.classList.add('body--home-lock')
    return () => {
      document.body.classList.remove('body--home-lock')
      if (themePickerRef.current) paintTheme(applied.current)
    }
  }, [])

  const clickAllowed = () => performance.now() >= suppressClick.current
  const focusWheel = () => wheelRef.current?.focus({ preventScroll: true })

  // ---- Navigation between categories and settings tabs ----

  const changeCategory = useCallback((next: number, haptic = true, reset = false) => {
    const index = clamp(next, 0, CATEGORIES.length - 1)
    const changed = index !== categoryIndex
    if (!changed && !reset) return
    if (haptic && changed) tick(14)
    if (themePicker) paintTheme(applied.current)
    if (wheelRef.current?.contains(document.activeElement)) wheelRef.current.focus({ preventScroll: true })
    settle()
    if (!reduced && changed) pushOutgoing(category, rowsRef.current)
    else clearOutgoing()
    setMessage('')
    setSettingsTabIndex(0)
    setSubtabDrag(0)
    setCategoryDrag(0)
    setCategoryIndex(index)
    setGeneration(value => value + 1)
  }, [categoryIndex, category, settle, reduced, themePicker, pushOutgoing, clearOutgoing])

  function selectSettingsTab(index: number) {
    const next = clamp(index, 0, SETTINGS_SUBTABS.length - 1)
    if (next === settingsTabIndex) return
    if (themePicker) paintTheme(applied.current)
    tick(14)
    settle()
    setSettingsTabIndex(next)
    setGeneration(value => value + 1)
    setMessage('')
  }

  function swipeTarget(surface: HomeWheelSurface, direction: number) {
    return homeSwipeTarget({
      surface, direction,
      mainIndex: categoryIndex, mainCount: CATEGORIES.length,
      subIndex: settingsTabIndex, subCount: isSettings ? SETTINGS_SUBTABS.length : 0,
    })
  }

  function moveAcross(direction: number, surface: HomeWheelSurface) {
    const next = swipeTarget(surface, direction)
    if (next.mainIndex !== categoryIndex) changeCategory(next.mainIndex)
    else selectSettingsTab(next.subIndex)
  }

  useEffect(() => {
    const reset = () => changeCategory(DEFAULT_CATEGORY, false, true)
    window.addEventListener(HOME_RESET_EVENT, reset)
    return () => window.removeEventListener(HOME_RESET_EVENT, reset)
  }, [changeCategory])

  // Preview whichever theme is centred in the theme picker.
  useEffect(() => {
    if (!themePicker) return
    const theme = themes[Math.round(motion.positionRef.current)]
    if (!theme) return
    paintTheme(theme)
    if (theme.id !== applied.current.id) setMessage('')
  }, [themePicker, selectedIndex, generation, motion.positionRef])

  // ---- Activating items ----

  function applyTheme(themeId: string) {
    const theme = themes.find(value => value.id === themeId)!
    applied.current = theme
    paintTheme(theme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme.id)
      setMessage(`${theme.name} applied and saved.`)
    } catch {
      setMessage(`${theme.name} applied for this visit. Browser storage is unavailable.`)
    }
    tick(18)
  }

  function activate(item: WheelItem) {
    if (!clickAllowed()) return
    if (item.setting) {
      tick(18)
      const result = toggleSetting(preferences, item.setting)
      savePhrasePreferences(result.preferences)
      setMessage(result.message)
    } else if (item.themeId) {
      applyTheme(item.themeId)
    } else if (item.category) {
      tick(18)
      changeCategory(CATEGORIES.indexOf(item.category), false, true)
      if (item.settingsTab) setSettingsTabIndex(SETTINGS_SUBTABS.findIndex(tab => tab.id === item.settingsTab))
    } else if (item.href) {
      tick(18)
      if (item.external) window.location.assign(item.href)
      else navigate(item.href)
    }
  }

  function activateCentredItem() {
    const item = items[Math.round(motion.positionRef.current)]
    if (item) activate(item)
  }

  // Taps anywhere in the item wheel activate the centred item.
  function onWheelClick(event: ReactMouseEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    event.preventDefault()
    activateCentredItem()
  }

  // ---- Keyboard ----

  function onKeyDown(event: KeyboardEvent) {
    if (KEYBOARD_NAVIGATION_KEYS.includes(event.key)) setKeyboardFocus(true)
    if (isTextEntry(event.target) || event.altKey || event.ctrlKey || event.metaKey) return

    const target = event.target instanceof Node ? event.target : null
    const inWheel = !!target && !!wheelRef.current?.contains(target)
    const inCategories = !!target && !!categoriesRef.current?.contains(target)
    const activateKey = event.key === 'Enter' || event.key === ' '
    // Leave Enter/Space to whatever else has focus on the page.
    if (activateKey && target && !inWheel && !inCategories && target !== document.body) return

    if (target && settingsTabsRef.current?.contains(target)) {
      if (ARROW_KEYS.includes(event.key)) {
        event.preventDefault()
        moveAcross(event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1, 'subtabs')
      }
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      focusWheel()
      moveAcross(event.key === 'ArrowRight' ? 1 : -1, inCategories ? 'main' : 'items')
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      focusWheel()
      motion.step(event.key === 'ArrowDown' ? 1 : -1)
    } else if (activateKey) {
      event.preventDefault()
      suppressClick.current = 0
      activateCentredItem()
    }
  }

  const keyDownRef = useRef(onKeyDown)
  keyDownRef.current = onKeyDown
  useEffect(() => {
    const handle = (event: KeyboardEvent) => keyDownRef.current(event)
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  // ---- Mouse wheel and pointer gestures ----

  useWheelScroll({
    itemsRef: wheelRef,
    mainRef: categoriesRef,
    subtabsRef: settingsTabsRef,
    rebindKey: category,
    onMoveAcross: moveAcross,
    onStep: motion.step,
  })

  function pointerDown(event: ReactPointerEvent, surface: HomeWheelSurface) {
    setKeyboardFocus(false)
    if (event.pointerType === 'mouse' && event.button !== 0) return
    suppressClick.current = 0
    gesture.current = {
      id: event.pointerId, x: event.clientX, y: event.clientY, lastY: event.clientY, time: event.timeStamp,
      surface, dragged: false,
      // The category and subtab wheels run horizontally on compact screens.
      axis: surface === 'items' ? null : compact ? 'x' : 'y',
    }
  }

  // Shows a swipe in progress on the wheel it would change.
  function previewSwipe(surface: HomeWheelSurface, delta: number) {
    const destination = swipeTarget(surface, delta < 0 ? 1 : -1)
    if (surface === 'main' || destination.mainIndex !== categoryIndex) setCategoryDrag(clamp(delta, -180, 180))
    else setSubtabDrag(clamp(delta, -120, 120))
  }

  function pointerMove(event: ReactPointerEvent) {
    const state = gesture.current
    if (!state || state.id !== event.pointerId) return
    const dx = event.clientX - state.x
    const dy = event.clientY - state.y
    if (!state.dragged && Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_THRESHOLD) return
    if (!state.axis) state.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'

    const scrollingItems = state.surface === 'items' && state.axis === 'y'
    if (!state.dragged) {
      event.currentTarget.setPointerCapture(event.pointerId)
      if (scrollingItems) motion.begin()
    }
    if (scrollingItems) {
      motion.drag(-(event.clientY - state.lastY) / Math.max(52, metrics.font * .7), (event.timeStamp - state.time) / 1000)
    } else {
      previewSwipe(state.surface, state.axis === 'x' ? dx : dy)
    }
    state.dragged = true
    event.preventDefault()
    state.lastY = event.clientY
    state.time = event.timeStamp
  }

  function pointerEnd(event: ReactPointerEvent, cancel = false) {
    const state = gesture.current
    if (!state || state.id !== event.pointerId) return
    if (state.dragged) {
      suppressClick.current = performance.now() + CLICK_SUPPRESS_MS
      if (state.surface === 'items' && state.axis === 'y') motion.end(cancel)
      else {
        const delta = state.axis === 'x' ? event.clientX - state.x : event.clientY - state.y
        if (!cancel && Math.abs(delta) >= SWIPE_THRESHOLD) moveAcross(delta < 0 ? 1 : -1, state.surface)
      }
    }
    gesture.current = null
    setCategoryDrag(0)
    setSubtabDrag(0)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const pointerHandlers = (surface: HomeWheelSurface) => ({
    onPointerDown: (event: ReactPointerEvent) => pointerDown(event, surface),
    onPointerMove: pointerMove,
    onPointerUp: (event: ReactPointerEvent) => pointerEnd(event),
    onPointerCancel: (event: ReactPointerEvent) => pointerEnd(event, true),
  })

  // ---- Render ----

  const helpText = `${compact ? 'Swipe left or right to choose a category.' : 'Scroll or swipe the right wheel vertically to choose a category.'} `
    + 'Scroll up or down to choose an item. Tap anywhere in the item wheel or press Enter to activate the centred item. Arrow keys move along both axes.'
  const settingsHint = themePicker
    ? 'Scroll to preview · Tap anywhere to apply'
    : 'Scroll to focus · Tap anywhere to change · Outlined and crossed out means off'
  const announcement = message || `${category}: ${selected?.label ?? ''}${themePicker ? '. Previewing; activate to save.' : ''}`
  const measuredItems: WheelItem[] = isPhrases ? sourcePhrases.map((label, index) => ({ id: String(index), label })) : items

  return <main className="home-stage home-navigation" data-category={category} data-input={keyboardFocus ? 'keyboard' : 'pointer'}>
    <p id="home-wheel-help" className="home-phrase-announcement">{helpText}</p>

    <div ref={wheelRef} tabIndex={0} {...pointerHandlers('items')} onClick={onWheelClick}
      className={classNames('home-phrase-wheel-zone', isPhrases ? 'is-phrases' : 'is-navigation')}
      id={isSettings ? 'home-settings-panel' : undefined}
      role={isSettings ? 'tabpanel' : 'region'}
      aria-labelledby={isSettings ? `home-${settingsTab.id}-tab` : undefined}
      aria-label={`${category} word wheel`}
      aria-describedby="home-wheel-help">
      {outgoing.map(layer =>
        <div key={layer.id} className={classNames('home-phrase-wall home-ripple-out', layer.category === 'phi' && 'home-phrase-wall--phrases')} aria-hidden="true" inert>
          <WheelRows rows={layer.rows} group={layer.category} selectedIndex={selectedIndex} outgoing />
        </div>)}
      <div key={generation} className={classNames('home-phrase-wall', isPhrases && 'home-phrase-wall--phrases', generation > 0 && !reduced && 'home-ripple-in')}>
        <WheelRows rows={rows} group={category} selectedIndex={selectedIndex} />
      </div>
      {isSettings && <p className="home-wheel-feedback" aria-hidden="true">{message || settingsHint}</p>}
      <span ref={probeRef} className="home-size-probe" aria-hidden="true">phi</span>
      <div ref={measurementRef} className="home-word-measure" aria-hidden="true" inert>
        {measuredItems.map(item => <span key={item.id} className={wordClassName(item, isPhrases)}><WheelInk item={item} /></span>)}
      </div>
    </div>

    {isSettings && <div ref={settingsTabsRef} className="home-settings-tabs" data-dragging={Boolean(subtabDrag)} {...pointerHandlers('subtabs')}
      role="tablist" aria-label="Settings submenus" aria-orientation={compact ? 'horizontal' : 'vertical'}>
      {SETTINGS_SUBTABS.map((tab, index) =>
        <button key={tab.id} id={`home-${tab.id}-tab`} type="button" role="tab" className="home-settings-tab"
          aria-selected={index === settingsTabIndex} aria-controls="home-settings-panel" tabIndex={index === settingsTabIndex ? 0 : -1}
          style={{ '--subtab-position': index - settingsTabIndex, '--subtab-drag': `${subtabDrag}px` } as CSSProperties}
          onClick={() => { if (clickAllowed()) selectSettingsTab(index) }}>
          {tab.label}
        </button>)}
    </div>}

    <div ref={categoriesRef} className={classNames('home-category-wheel', categoryDrag !== 0 && 'is-dragging')} {...pointerHandlers('main')}
      role="group" aria-label="Homepage categories" aria-describedby="home-wheel-help">
      {CATEGORIES.map((name, index) => {
        const offset = index - categoryIndex
        const style = {
          '--category-position': offset,
          '--category-drag': `${categoryDrag}px`,
          '--category-opacity': Math.max(.24, .68 - Math.abs(offset) * .13),
        } as CSSProperties
        return <button key={name} type="button" className="home-category" style={style}
          aria-pressed={index === categoryIndex} aria-label={`${name} category`} tabIndex={index === categoryIndex ? 0 : -1}
          onClick={() => { if (clickAllowed()) changeCategory(index) }}>
          {name}
        </button>
      })}
    </div>

    <span className="home-phrase-announcement" role="status" aria-live={isPhrases ? 'off' : 'polite'}>{announcement}</span>
  </main>
}
