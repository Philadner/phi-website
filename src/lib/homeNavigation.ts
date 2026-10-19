export const HOME_RESET_EVENT = 'phi:home'
export const CATEGORIES = ['Socials', 'Projects', 'phi', 'Navigate', 'Settings'] as const
export type Category = typeof CATEGORIES[number]
export const SETTINGS_SUBTABS = [{ id: 'theme', label: 'Theme' }, { id: 'hate-speech', label: 'Hate speech' }] as const
export type HomeWheelSurface = 'items' | 'main' | 'subtabs'
export function homeSwipeTarget({ surface, mainIndex, mainCount, subIndex, subCount, direction }: {
  surface: HomeWheelSurface; mainIndex: number; mainCount: number; subIndex: number; subCount: number; direction: number
}) {
  if (!direction) return { mainIndex, subIndex }
  const nextSub = subIndex + Math.sign(direction)
  if (surface === 'subtabs') return { mainIndex, subIndex: Math.max(0, Math.min(Math.max(0, subCount - 1), nextSub)) }
  if (surface === 'items' && subCount > 0 && nextSub >= 0 && nextSub < subCount) return { mainIndex, subIndex: nextSub }
  const nextMain = Math.max(0, Math.min(mainCount - 1, mainIndex + Math.sign(direction)))
  return { mainIndex: nextMain, subIndex: nextMain === mainIndex ? subIndex : 0 }
}
export type WheelItem = { id: string; label: string; href?: string; category?: Category; settingsTab?: typeof SETTINGS_SUBTABS[number]['id']; themeId?: string; game?: boolean; external?: boolean; setting?: string; settingValue?: boolean; expanded?: boolean; small?: boolean }

export const SOCIALS: WheelItem[] = [
  { id: 'tiktok', label: 'TikTok', href: 'https://tiktok.com/@philadner', external: true },
  { id: 'youtube', label: 'YouTube', href: 'https://youtube.com/@phil82.', external: true },
  { id: 'github', label: 'GitHub', href: 'https://github.com/philadner', external: true },
  { id: 'steam', label: 'Steam', href: 'https://steamcommunity.com/id/Philander82/', external: true },
]
export const PROJECTS: WheelItem[] = [{ id: 'history', label: 'History', href: 'https://history.phi.me.uk', external: true }]

// Shared destination list replaces the mobile sidebar. Game routes remain available
// directly, but games are offered in this wheel only on mobile.
export const NAVIGATION: WheelItem[] = [
  { id: 'home', label: 'Home', category: 'phi' },
  { id: 'about', label: 'About', href: '/about' },
  { id: 'chat', label: 'Chatroom', href: '/chat' },
  { id: 'changelog', label: 'Changelog', href: '/changelog' },
  { id: 'realchangelog', label: 'Real Changelog', href: '/realchangelog' },
  { id: 'quickl', label: 'Quick Links', href: '/quickl' },
  { id: 'news', label: 'News', href: '/news' },
  { id: 'dylan', label: 'Dylan Tightness', href: '/dylan' },
  { id: 'phil', label: 'Phil Tightness', href: '/phil-tightness' },
  { id: 'jay', label: 'Jay Game', href: '/jay', game: true },
  { id: 'music', label: 'Music', href: '/musicpl' },
  { id: 'games', label: 'Games', href: '/games', game: true },
  { id: 'add', label: 'Add', href: '/add' },
  { id: 'theme', label: 'Theme', category: 'Settings', settingsTab: 'theme' },
]

export function tick(duration: 8 | 14 | 18) {
  try { navigator.vibrate?.(duration) } catch { /* Unsupported or disabled haptics. */ }
}
