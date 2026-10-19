export const MODEL = 'omni-moderation-latest'
export const CATEGORIES = [
  'hate', 'hate/threatening', 'harassment', 'harassment/threatening',
  'sexual', 'sexual/minors', 'violence', 'violence/graphic',
  'self-harm', 'self-harm/intent', 'self-harm/instructions',
  'illicit', 'illicit/violent',
]

export function parseSamples(value) {
  if (typeof value !== 'string') throw new Error('Enter sample text first.')
  let samples
  if (value.trim().startsWith('[')) {
    try { samples = JSON.parse(value) } catch { throw new Error('The JSON list is invalid.') }
  } else samples = value.split(/\r?\n/).filter(line => line.trim())
  if (!Array.isArray(samples) || samples.some(text => typeof text !== 'string')) {
    throw new Error('Use one phrase per line or a JSON array of strings.')
  }
  samples = samples.map(text => text.trim()).filter(Boolean)
  if (!samples.length || samples.length > 1000) throw new Error('Enter between 1 and 1,000 samples.')
  if (samples.some(text => text.length > 10000)) throw new Error('Each sample must be 10,000 characters or fewer.')
  if (samples.join('').length > 250000) throw new Error('The sample list is too large (250,000 characters maximum).')
  return samples
}

export function validateResult(result) {
  return result && typeof result.flagged === 'boolean' &&
    CATEGORIES.every(category => typeof result.categories?.[category] === 'boolean' &&
      Number.isFinite(result.category_scores?.[category]) &&
      result.category_scores[category] >= 0 && result.category_scores[category] <= 1)
}

export function matchedCategories(result, thresholds) {
  return CATEGORIES.filter(category => result.category_scores[category] >= thresholds[category])
}

export async function moderate(samples, key, fetcher = fetch) {
  const rows = []
  // Small batches keep large community lists within per-request input limits.
  for (let start = 0; start < samples.length; start += 32) {
    const batch = samples.slice(start, start + 32)
    const response = await fetcher('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input: batch }),
      signal: AbortSignal.timeout(60000),
    })
    if (!response.ok) {
      const messages = { 401: 'OpenAI rejected that API key.', 403: 'This key cannot access moderation.', 429: 'OpenAI rate limit reached. Wait a moment and try again.' }
      throw new Error(messages[response.status] ?? `OpenAI moderation failed (HTTP ${response.status}).`)
    }
    const data = await response.json()
    if (!Array.isArray(data.results) || data.results.length !== batch.length || !data.results.every(validateResult)) {
      throw new Error('OpenAI returned an incomplete moderation result. No results were accepted.')
    }
    rows.push(...data.results.map((result, index) => ({ text: batch[index], hatefulness: { model: data.model ?? MODEL, ...result } })))
  }
  return rows
}
