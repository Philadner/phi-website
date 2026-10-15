import '../stylesheets/ThemeLab.css'

export default function ThemeLab() {
  return <main className="theme-lab">
    <h1>Theme lab</h1>
    <p>Try the real pages with sample data. Music playback, chat messages and game moves stay in this browser.</p>
    <div className="theme-lab__links">
      <a href="/chat?theme-demo=1">Chatroom: conversation, replies and game card</a>
      <a href="/chat?theme-demo=1&demo-guest=1">Chatroom: join form</a>
      <a href="/chat?theme-demo=1&demo-state=empty">Chatroom: empty room</a>
      <a href="/chat?theme-demo=1&demo-state=error">Chatroom: error state</a>
      <a href="/musicpl/demo-album?theme-demo=1">Music: album, track list and playback</a>
      <a href="/musicpl/artist/demo-artist?theme-demo=1">Music: artist, songs and albums</a>
      <a href="/musicpl?theme-demo=1">Music: search for anything</a>
      <a href="/musicpl?theme-demo=1&demo-state=empty">Music: empty search results</a>
      <a href="/musicpl/demo-album?theme-demo=1&demo-state=error">Music: error state</a>
      <a href="/news?theme-demo=1">News: sample article and form</a>
      <a href="/stats?theme-demo=1">Stats: sample deployment data</a>
      <a href="/dylan?theme-demo=1">Dylan: sample tracker data</a>
      <a href="/phil?theme-demo=1">Phil: sample tracker data</a>
    </div>
    <p>Choose any theme in the sidebar. Apply keeps it when you switch between demos.</p>
    <a href="/">Return to phi</a>
  </main>
}
