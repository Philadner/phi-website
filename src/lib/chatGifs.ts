export type ChatGifRef = { id: string; title: string }
export type GiphyGif = { id: string; title: string; url: string; images: Record<string, { url: string; width: string; height: string }>; user?: { display_name?: string; username?: string } }
export function gifReference(value: unknown): ChatGifRef | null {
  if (!value || typeof value !== 'object') return null
  const gif = value as Record<string, unknown>
  if (typeof gif.id !== 'string' || !/^[a-zA-Z0-9]{1,64}$/.test(gif.id) || typeof gif.title !== 'string' || gif.title.length > 200) return null
  return { id: gif.id, title: gif.title }
}
export async function giphyFetch(path: string, query: Record<string, string> = {}, signal?: AbortSignal) {
  const key = (import.meta as { env?: { VITE_GIPHY_API_KEY?: string } }).env?.VITE_GIPHY_API_KEY?.trim()
  if (!key) throw new Error('GIF search is not configured yet.')
  const url = new URL(`https://api.giphy.com/v1/gifs/${path}`)
  url.search = new URLSearchParams({ api_key: key, ...query }).toString()
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(response.status === 429 ? 'GIPHY search limit reached. Try again later.' : 'GIPHY could not load. Try again.')
  return response.json()
}
