import { useEffect, useMemo, useState } from 'react'
import { isModerationResult, phraseVisible } from '../lib/phraseModeration'
import type { PhraseRecord } from '../lib/phraseModeration'
import { usePhrasePreferences } from './usePhrasePreferences'

const FALLBACK = ['welcome', 'epic website', 'the system knows', 'with much effort', 'we love you', '2763']
export function usePhrases() {
  const preferences = usePhrasePreferences()
  const [records, setRecords] = useState<PhraseRecord[] | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/phrases?includeFiltered=1', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Phrases could not load.')
        const data: unknown = await response.json()
        if (!data || typeof data !== 'object' || !('phrases' in data) || !Array.isArray(data.phrases)) throw new Error('Invalid phrase list.')
        setRecords(data.phrases.filter((row): row is PhraseRecord => Boolean(row && typeof row === 'object' && Number.isSafeInteger(row.id) && typeof row.text === 'string' && row.text.trim() && isModerationResult(row.hatefulness))))
      })
      .catch(() => { /* Safe built-in phrases remain available on API failure. */ })
    return () => controller.abort()
  }, [])
  return useMemo(() => records === null ? FALLBACK : records.filter(phrase => phraseVisible(phrase, preferences)).map(phrase => phrase.text), [records, preferences])
}
