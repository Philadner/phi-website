import YTMusic from 'ytmusic-api'

const query = process.argv.slice(2).join(' ').trim()

if (!query) {
  console.error('Usage: node temp-ytmusic-videoid.mjs "<song query>"')
  process.exit(1)
}

const ytmusic = new YTMusic()
await ytmusic.initialize()

const songs = await ytmusic.searchSongs(query)
const first = songs[0]

if (!first) {
  console.error(`No song results found for: ${query}`)
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      query,
      videoId: first.videoId,
      title: first.name,
      artist: first.artist.name,
      album: first.album?.name ?? null,
      duration: first.duration
    },
    null,
    2
  )
)
