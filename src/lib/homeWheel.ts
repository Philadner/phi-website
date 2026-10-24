import { NAVIGATION, PROJECTS, SOCIALS } from './homeNavigation'
import type { Category, WheelItem } from './homeNavigation'
import { MODERATION_LABELS, MODERATION_PREFERENCE_CATEGORIES } from './phraseModeration'
import type { ModerationCategory, PhrasePreferences } from './phraseModeration'
import { themes } from './themes'

// Phrase rows rendered either side of the centre.
export const RADIUS = 10

export type WordRow = { item: WheelItem; index: number; scale: number; opacity: number; y: number; distance: number }
export type WordMetrics = { font: number; heights: number[] }

export function classNames(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(' ')
}

export function wordClassName(item: WheelItem, phrase: boolean, focused = false) {
  return classNames('home-word', phrase && 'home-word--phrase', item.small && 'home-word--setting-child', focused && 'is-focused')
}

export function shuffle<T>(items: T[]) {
  const deck = [...items]
  for (let index = deck.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[deck[index], deck[swap]] = [deck[swap], deck[index]]
  }
  return deck
}

function settingsItems(preferences: PhrasePreferences): WheelItem[] {
  const settings: WheelItem[] = [
    { id: 'show-offensive', label: 'Show generally offensive content', setting: 'show-offensive', settingValue: preferences.showOffensive, small: true },
    { id: 'show-filtered', label: 'Show sensitive content', setting: 'show-filtered', settingValue: preferences.showFiltered, small: true },
  ]
  if (!preferences.showFiltered) return settings
  return [...settings, ...MODERATION_PREFERENCE_CATEGORIES.map(setting => ({
    id: `filter-${setting}`,
    label: `Show ${MODERATION_LABELS[setting]}`,
    setting,
    settingValue: !preferences.moderated.includes(setting),
    small: true,
  }))]
}

function navigationItems(mobile: boolean): WheelItem[] {
  const destinations = NAVIGATION.filter(item => mobile || !item.game)
  return document.documentElement.dataset.themeDemo === 'true'
    ? [...destinations, { id: 'theme-lab', label: 'Theme lab', href: '/theme-lab' }]
    : destinations
}

// Items for every category except 'phi', whose rows come from the phrase tape.
export function getWheelItems({ category, themePicker, preferences, mobile }: {
  category: Category; themePicker: boolean; preferences: PhrasePreferences; mobile: boolean
}): WheelItem[] {
  if (category === 'Socials') return SOCIALS
  if (category === 'Projects') return PROJECTS
  if (themePicker) return themes.map(theme => ({ id: theme.id, label: theme.name, themeId: theme.id }))
  if (category === 'Settings') return settingsItems(preferences)
  if (category === 'Navigate') return navigationItems(mobile)
  return []
}

// Lays out the visible rows so the wheel's fractional position sits at y = 0.
export function layoutRows({ category, position, items, metrics, phraseTape }: {
  category: Category; position: number; items: WheelItem[]; metrics: WordMetrics; phraseTape: Map<number, string>
}): WordRow[] {
  const isPhrases = category === 'phi'
  const first = isPhrases ? Math.floor(position) - RADIUS : 0
  const last = isPhrases ? Math.ceil(position) + RADIUS : items.length - 1
  const lineHeight = metrics.font * .92
  const gap = Math.max(12, metrics.font * .12)
  const rows: WordRow[] = []
  let y = 0
  let previousHeight = 0
  for (let index = first; index <= last; index++) {
    const distance = Math.abs(index - position)
    // 1 at the centre, easing to 0 one row away.
    const focus = Math.pow(Math.max(0, 1 - distance), 2.45)
    const scale = .5 + .5 * focus
    const height = (isPhrases ? lineHeight : metrics.heights[index] ?? lineHeight) * scale
    if (index > first) y += (previousHeight + height) / 2 + gap
    previousHeight = height
    rows.push({
      item: isPhrases ? { id: `phrase-${index}`, label: phraseTape.get(index) ?? '' } : items[index],
      index, scale, distance, y,
      opacity: isPhrases
        ? Math.max(.08, .24 - distance * .018) + .76 * focus
        : Math.max(.28, .78 - distance * .09) + .22 * focus,
    })
  }
  // Interpolate between the two rows either side of the position.
  const floor = Math.floor(position)
  const lower = rows.find(row => row.index === floor)?.y ?? 0
  const upper = rows.find(row => row.index === floor + 1)?.y ?? lower
  const offset = lower + (upper - lower) * (position - floor)
  return rows.map(row => ({ ...row, y: row.y - offset }))
}

export function toggleSetting(preferences: PhrasePreferences, setting: string): { preferences: PhrasePreferences; message: string } {
  if (setting === 'show-offensive') return {
    preferences: { ...preferences, showOffensive: !preferences.showOffensive },
    message: preferences.showOffensive ? 'Generally offensive content is hidden.' : 'Showing generally offensive content.',
  }
  if (setting === 'show-filtered') return {
    preferences: { ...preferences, showFiltered: !preferences.showFiltered, moderated: [] },
    message: preferences.showFiltered ? 'Sensitive content is hidden by default.' : 'Showing sensitive content. All individual Show options start on.',
  }
  const category = setting as ModerationCategory
  const shown = !preferences.moderated.includes(category)
  return {
    preferences: {
      ...preferences,
      moderated: shown ? [...preferences.moderated, category] : preferences.moderated.filter(value => value !== category),
    },
    message: `${shown ? 'Hiding' : 'Showing'} ${MODERATION_LABELS[category]}.`,
  }
}
