import { useEffect, useState } from 'react'
import { giphyFetch } from '../lib/chatGifs'
import type { ChatGifRef, GiphyGif } from '../lib/chatGifs'

export default function ChatGif({ gif }: { gif: ChatGifRef }) {
  const [media, setMedia] = useState<GiphyGif | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setMedia(null); setError(false)
    void giphyFetch(gif.id, {}, controller.signal).then(result => { if (!controller.signal.aborted) setMedia(result.data) }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [gif.id])
  const image = media?.images.downsized_medium || media?.images.original
  return <figure className="chat-gif"><a href={media?.url || `https://giphy.com/gifs/${gif.id}`} target="_blank" rel="noopener noreferrer">{image ? <img src={image.url} alt={gif.title || 'GIPHY GIF'} width={Number(image.width)} height={Number(image.height)} /> : <span>{error ? 'Open GIF on GIPHY' : 'Loading GIF…'}</span>}</a><figcaption>GIPHY{media?.user && ` · ${media.user.display_name || media.user.username}`}</figcaption></figure>
}
