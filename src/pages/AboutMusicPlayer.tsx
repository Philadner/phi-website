import ImageModal from "../components/ImageModal";

// src/pages/AboutMusicPlayer.tsx
function AboutMusicPlayer() {
  return (
    <main id="main-site">
      <h1 className="CenterTitle">How the new music search works</h1>
      <h2 className="HeadingBigLeft">The why</h2>
      <h2 className="HeadingLeft">Why was the old one bad?</h2>
      <p>The old music search only found things that were named on archive.org.<br />
      Archive.org isn't really a music hosting service, it's more a big store of everything humanity has ever made. <br />
      Now i wanted to play music in places where youtube and spotify were blocked for some reason, so i made a music player. <br />
      Now it was fine for me, but when i watched other people use it, they searched for their fav songs it didn't really work.</p>
      <div className="SpaceDiv"></div>
      <h2 className="HeadingLeft">The perfect solution</h2>
      <p>At first i thought about just getting all the music from a different source like youtube music, <br />
      Then i realised that that would be very difficult to make, and it would be against youtube TOS. <br />
      So i had to keep using archive.org, but the search was still lobotomised.</p>
      <div className="SpaceDiv"></div>
      <h2 className="HeadingLeft">A good middle ground</h2>
      <p>I decided that i should keep using archive.org, but i found out i can still get the metadata of the music <br />
      From youtube music using this package called <a href="https://www.npmjs.com/package/ytmusic-api">ytmusic-api</a>, so i decided to use that data to make my search better. <br />
      Use the youtube music api to search for the song name, find what album the song is in, and pull the song out of that album.</p>

      <h2 className="HeadingBigLeft">The how</h2>
      <p>
        In short: I use YouTube Music to understand what you're searching for,
        then find the actual playable version on Archive.org.
      </p>
      <p>Here's a fun diagram!</p>
      <ImageModal src="https://cdn.phi.me.uk/NewMusicSearch.png" alt="Search breakdown" />
      <p>Yes it's a confusing ass diagram. It's 2AM.</p>
    </main>
  );
}

export default AboutMusicPlayer;
