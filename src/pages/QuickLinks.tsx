import { useEffect, useState } from "react";
import '../stylesheets/QuickLinks.css';

interface QuickLinksProps {
  initialShowGame?: boolean;
  forcegame?: boolean;
}

function QuickLinks({ initialShowGame = false, forcegame = false }: QuickLinksProps) {
  const [showGame, setShowGame] = useState(initialShowGame);
  //const [showPapaGames, setshowPapaGames] = useState(false);
  const [currentGame, setCurrentGame] = useState("https://cdn.phi.me.uk/papasfreezeria[1].swf");
  const [panicUrl, setPanicUrl] = useState("https://thedeanery.schoolsynergy.co.uk");
  //const [showPanicSites, setShowPanicSites] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(true);

  let Papagamenames = [
    "Papa's Freezeria",
    "Papa's Burgeria",
    "Papa's Cupcakeria",
    "Papa's Hot Doggeria",
    "Papa's Pancakeria",
    "Papa's Pastaria",
    "Papa's Pizzeria",
    "Papa's Scooperia",
    "Papa's Taco Mia",
    "Papa's Wingeria",
  ];

  let Papagamenamelocations = [
    "https://cdn.phi.me.uk/papasfreezeria[1].swf",
    "https://cdn.phi.me.uk/PapasBurgeria.swf",
    "https://cdn.phi.me.uk/PapasCupcakeria.swf",
    "https://cdn.phi.me.uk/PapasHotDoggeria.swf",
    "https://cdn.phi.me.uk/PapasPancakeria.swf",
    "https://cdn.phi.me.uk/PapasPastaria.swf",
    "https://cdn.phi.me.uk/PapasPizzeria.swf",
    "https://cdn.phi.me.uk/PapasScooperia.swf",
    "https://cdn.phi.me.uk/PapasTacoMia.swf",
    "https://cdn.phi.me.uk/PapasWingeria.swf",
  ];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "g" || (e.key === "G" && !forcegame)) {
        setShowGame((prev) => !prev);
      }
      if (e.key === "F1") {
        window.location.href = panicUrl;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [panicUrl]);

  useEffect(() => {
    if (showGame) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@ruffle-rs/ruffle";
      script.async = true;
      document.body.appendChild(script);
    }
  }, [showGame]);

    if (showGame) {
    return (
      <main id="main-site" className="GamePage quicklinks">
        <div className="pp-card gold">
          <div className="game-frame" key={currentGame}>
            <object
              key={currentGame}
              type="application/x-shockwave-flash"
              data={currentGame}
              width="100%"
              height="600"
            >
              <p>Flash not supported</p>
            </object>
          </div>
        </div>
        <div className="SpaceDiv"></div>
        <div className="pp-card">
          <h3 className="pp-card__headernomargin" onClick={() => setShowGameMenu(!showGameMenu)}>
            {showGameMenu ? "HIDE" : "SHOW"} GAME MENU AND PANIC SITES
            <span className="DropdownArrow">{showGameMenu ? "▲" : "▼"}</span>
          </h3>
        </div>
        {showGameMenu && (
          <section className="pp-dashboard">
            {/* Quick Panic Sites */}
            <article className="pp-card red">
              <header className="pp-card__header">
                <h3>Quick Panic Sites</h3>
              </header>
              <div className="pp-card__body">
                <div className="pp-chip-row">
                  <button className="pp-chip" onClick={() => setPanicUrl("https://thedeanery.schoolsynergy.co.uk")}>Synergy</button>
                  <button className="pp-chip" onClick={() => setPanicUrl("https://sparxmaths.uk")}>Sparx</button>
                  <button className="pp-chip" onClick={() => setPanicUrl("https://www.cyberexplorers.co.uk/main-menu")}>Cyber Explorers</button>
                  <button className="pp-chip" onClick={() => setPanicUrl("https://app.senecalearning.com/courses")}>Seneca</button>
                </div>
                <div className="pp-input-row">
                  <input
                    type="text"
                    value={panicUrl}
                    onChange={(e) => setPanicUrl(e.target.value)}
                    placeholder="Enter panic URL"
                    className="pp-input"
                  />
                </div>
                <p className="pp-muted">Press F1 to go to the panic site</p>
              </div>
            </article>

            {/* Featured Flash */}
            <article className="pp-card green">
              <header className="pp-card__header">
                <h3>Other games</h3>
              </header>
              <div className="pp-card__body">
                <div className="pp-chip-row">
                  <button className="pp-chip" onClick={() => setCurrentGame("https://cdn.phi.me.uk/HappyWheels.swf")}>Happy Wheels</button>
                  <button className="pp-chip" onClick={() => setCurrentGame("https://cdn.phi.me.uk/moto-x3m.swf")}>Moto X3M</button>
                </div>
              </div>
            </article>

            {/* Papa's Cooking */}
            <article className="pp-card blue">
              <header className="pp-card__header">
                <h3>Papa’s Cooking</h3>
              </header>
              <div className="pp-card__body pp-scroll">
                {Papagamenames.map((game, i) => (
                  <button
                    key={i}
                    className="pp-chip"
                    onClick={() => setCurrentGame(Papagamenamelocations[i])}
                  >
                    {game}
                  </button>
                ))}
              </div>
            </article>
          </section>
          
        )}
        <div className="SpaceDiv"></div>
        {!forcegame ? (
          <div className="pp-card gold">
            <p className="pp-card_header">Press <code>g</code> again to go back to your links.</p>
          </div>
        ) : null}
      </main>
    );
  }


  return (
    <main id="main-site" className="quicklinks">
      <h1 className="CenterTitle">Quick links</h1>

      <h2 className="HeadingLeft">Research & Homework Help</h2>
      <p className="BodyTextLeft">
        <a href="https://www.bbc.co.uk/bitesize" target="_blank">BBC Bitesize</a> — topic explainers for KS3–GCSE
      </p>
      <p className="BodyTextLeft">
        <a href="https://senecalearning.com/" target="_blank">Seneca Learning</a> — interactive revision courses
      </p>
      <p className="BodyTextLeft">
        <a href="https://www.khanacademy.org/" target="_blank">Khan Academy</a> — great for maths/science
      </p>
      <p className="BodyTextLeft">
        <a href="https://www.sparknotes.com/" target="_blank">SparkNotes</a> — book summaries + Shakespeare help
      </p>
      <p className="BodyTextLeft">
        <a href="https://scholar.google.com/" target="_blank">Google Scholar</a> — find real academic sources
      </p>

      <h2 className="HeadingLeft">Maths</h2>
      <p className="BodyTextLeft">
        <a href="https://www.drfrostmaths.com/" target="_blank">DrFrostMaths</a> — powerful for homework + quizzes
      </p>
      <p className="BodyTextLeft">
        <a href="https://corbettmaths.com/" target="_blank">Corbettmaths</a> — worksheets and exam prep
      </p>
      <p className="BodyTextLeft">
        <a href="https://www.mathsgenie.co.uk/" target="_blank">Maths Genie</a> — topic breakdown + past papers
      </p>

      <h2 className="HeadingLeft">English & Languages</h2>
      <p className="BodyTextLeft">
        <a href="https://www.sparknotes.com/nofear/shakespeare/" target="_blank">NoFear Shakespeare</a> — line-by-line translations
      </p>
      <p className="BodyTextLeft">
        <a href="https://quizlet.com/" target="_blank">Quizlet</a> — flashcards for everything
      </p>
      <p className="BodyTextLeft">
        <a href="https://context.reverso.net/translation/" target="_blank">Reverso Context</a> — smarter than Google Translate
      </p>

      <h2 className="HeadingLeft">Science</h2>
      <p className="BodyTextLeft">
        <a href="https://www.physicsandmathstutor.com/" target="_blank">Physics & Maths Tutor</a> — killer for exam prep
      </p>
      <p className="BodyTextLeft">
        <a href="https://isaacphysics.org/" target="_blank">Isaac Physics</a> — challenge questions for top grades
      </p>
      <p className="BodyTextLeft">
        <a href="https://www.gcse-science.com/" target="_blank">GCSE Science Revision</a> — old school, still useful
      </p>
    </main>
  );
}

export default QuickLinks;
