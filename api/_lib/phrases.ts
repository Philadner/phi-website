import { createClient } from '@supabase/supabase-js'
import { isModerationResult, MODERATION_MODEL, MODERATION_VERSION } from '../../src/lib/phraseModeration.js'
import type { ModerationResult } from '../../src/lib/phraseModeration.js'

export function phraseDatabase() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('Phrase storage is not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
export async function moderatePhrase(text: string): Promise<ModerationResult> {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) throw new Error('Phrase moderation is not configured.')
  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODERATION_MODEL, input: text }), signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error('Moderation is temporarily unavailable.')
  const data = await response.json() as { model?: string; results?: unknown[] }
  if (data.results?.length !== 1 || !isModerationResult(data.results[0])) throw new Error('Moderation returned an incomplete result.')
  return { ...data.results[0], model: data.model ?? MODERATION_MODEL, reviewed_at: new Date().toISOString(), threshold_version: MODERATION_VERSION }
}
