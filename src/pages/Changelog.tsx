import '../stylesheets/Changelog.css';

function About() {
    return (
      <main id="main-site">
        <h1 className="CenterTitle">The Changelogz</h1>

        <p className="BodyTextCentre">Most recent changes first</p>

        <div className="SpaceDiv"></div>

        {/* Add more changelog entries here */}
        
        <h2 className="HeadingBigLeft">The New hamburger menu</h2>

        <p>The top navbar was getting a bit cluttered so i made a new hamburger menu</p>
        <p>This website is now 10% epicer</p>
        <p>ok bye pookies</p>

        <div className='BigSpaceDiv'></div>

        <h2 className="HeadingBigLeft">The revamped music player!</h2>
        <p>The music player has gotten a massive facelift.</p>
        <p>Made it look better with seperate pages for each item</p>
        <p>It also shows a lot more results at once a lot less glitchy</p>

        <div className='BigSpaceDiv'></div>

        <h2 className="HeadingBigLeft">Some nerdy dev stuff that's kinda relavent to you</h2>
        <p>I've merged the labs and main branch so now labs.phi.me.uk and phi.me.uk are the same rn</p>
        <p>So much more new things happens on labs btw</p>
        <p>So check that changelog if you want to see new exciting things when im bothered to code.</p>

        <div className="BigSpaceDiv"></div>

        <h2 className="HeadingBigLeft">The Changelog gets added :)</h2>
        <p>I'm adding a thing so you can see what im making!</p>
        <p>Also added bounciness when you type in the add page</p>

        <div className="SpaceDiv"></div>

        <h2 className="HeadingLeft">AND BY THE WAY</h2>
        <p>Spam my email with suggestions at phil@phi.me.uk!!1</p>

        <div className="SpaceDiv"></div>

        <h2 className="HeadingLeft">That's all for now twin</h2>
        <p>Stay lubricated and epic and stuff</p>
      </main>
    );
  }
  
  export default About;
  