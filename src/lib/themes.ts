/// <reference lib="dom" />
import palettes from './themes.json'

export const themes = palettes
export type Theme = typeof themes[number]
export const THEME_STORAGE_KEY = 'phi.theme'

export function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  const first = luminance(a)
  const second = luminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

// Self-contained so Vite can also inline this exact function before first paint.
export function paintTheme(theme: Theme, contrastRatio = contrast) {
  const root = document.documentElement
  for (const token of ['background', 'primary', 'secondary', 'highlight'] as const) {
    root.style.setProperty(`--${token}`, theme[token])
  }
  const candidates = [theme.background, theme.primary, theme.secondary, theme.highlight, theme.text]
  const buttonText = candidates.reduce((best, color) =>
    contrastRatio(color, theme.highlight) > contrastRatio(best, theme.highlight) ? color : best)
  root.style.setProperty('--highlight-text', buttonText)
  const bestOn = (background: string) => candidates.reduce((best, color) =>
    contrastRatio(color, background) > contrastRatio(best, background) ? color : best)
  const text = contrastRatio(theme.text, theme.background) >= 4.5 ? theme.text : bestOn(theme.background)
  root.style.setProperty('--theme-text', text)
  root.style.setProperty('--theme-muted', contrastRatio(theme.secondary, theme.background) >= 4.5 ? theme.secondary : text)
  root.style.setProperty('--theme-border', contrastRatio(theme.secondary, theme.background) >= 3 ? theme.secondary : text)
  root.style.setProperty('--theme-accent', contrastRatio(theme.highlight, theme.background) >= 4.5 ? theme.highlight : text)
  const action = contrastRatio(buttonText, theme.highlight) >= 4.5 ? theme.highlight : theme.primary
  root.style.setProperty('--action-background', action)
  root.style.setProperty('--action-text', bestOn(action))
  if (theme.id === 'phi') {
    root.style.removeProperty('--loader-background')
    root.style.removeProperty('--loader-highlight')
    root.style.removeProperty('color-scheme')
    root.style.removeProperty('background-color')
    root.style.removeProperty('color')
  } else {
    root.style.setProperty('--loader-background', theme.background)
    root.style.setProperty('--loader-highlight', theme.highlight)
    root.style.colorScheme = theme.mode
    root.style.backgroundColor = "var(--background)"
    root.style.color = "var(--theme-text)"
  }
  root.dataset.theme = theme.id
}

export function getSavedTheme() {
  try {
    return themes.find((theme) => theme.id === (document.documentElement.dataset.theme ?? localStorage.getItem(THEME_STORAGE_KEY))) ?? themes[0]
  } catch {
    return themes[0]
  }
}
