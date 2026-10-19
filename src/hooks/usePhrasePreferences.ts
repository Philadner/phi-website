import { useSyncExternalStore } from 'react'
import { DEFAULT_PHRASE_PREFERENCES, parsePhrasePreferences } from '../lib/phraseModeration'
import type { PhrasePreferences } from '../lib/phraseModeration'

const KEY = 'phi.phrase-moderation.v1'
const CHANGE = 'phi:phrase-moderation'
let cachedRaw: string | null | undefined
let cached = DEFAULT_PHRASE_PREFERENCES
function snapshot() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      try { cached = parsePhrasePreferences(raw ? JSON.parse(raw) : null) } catch { cached = DEFAULT_PHRASE_PREFERENCES }
    }
  } catch { /* Retain preferences for this visit if storage is unavailable. */ }
  return cached
}
function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => { if (!event.key || event.key === KEY) callback() }
  window.addEventListener('storage', onStorage)
  window.addEventListener(CHANGE, callback)
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(CHANGE, callback) }
}
export function savePhrasePreferences(preferences: PhrasePreferences) {
  const next = parsePhrasePreferences(preferences)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* Keep the in-memory value. */ }
  cached = next
  try { cachedRaw = localStorage.getItem(KEY) } catch { cachedRaw = undefined }
  window.dispatchEvent(new Event(CHANGE))
}
export function usePhrasePreferences() {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_PHRASE_PREFERENCES)
}
