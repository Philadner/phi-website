import { useEffect, useState } from "react";

interface QuickLinksProps {
  initialShowGame?: boolean;
  forcegame?: boolean;
}

function QuickLinks( { initialShowGame = false, forcegame = false }: QuickLinksProps ) {
  const [showGame, setShowGame] = useState(initialShowGame);
  const [showPapaGames, setshowPapaGames] = useState(false);
  const [currentGame, setCurrentGame] = useState("https://cdn.phi.me.uk/papasfreezeria[1].swf");
  // list to store game names and server locations to auto create game select elements because i am lazy
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
      if (e.key === "g" || e.key === "G" && !forcegame) {
        setShowGame((prev) => !prev);
      }
      if (e.key === "F1") {
        window.location.href = "https://www.thedeanery.schoolsynergy.co.uk";
      }
      
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

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
      <main id="main-site" className="GamePage">
        <h1 className="CenterTitle">Quick Links</h1>
        <div style={{ width: "100%", maxWidth: "800px", margin: "0 auto" }} key={currentGame}>
          <object
            key={currentGame}
            type="application/x-shockwave-flash"
            data= {currentGame}
            width="100%"
            height="600"
          >
            <p>Flash not supported</p>
          </object>
        </div>
        <p className="HeadingLeft">Select another flash game:</p>
        <span className = "FancyLink" onClick={() => {
          console.log("clicked");
          setCurrentGame("https://cdn.phi.me.uk/HappyWheels.swf");
          }} >Happy wheels</span>
        <span className = "FancyLink" onClick={() => {
          console.log("clicked");
          setCurrentGame("https://cdn.phi.me.uk/moto-x3m.swf");
          }} >Moto X3M</span>
        <p 
          className="ClickableHeadingLeft" 
          onClick={() => setshowPapaGames(!showPapaGames)}
        >
          Papa's Cooking games 
          <span className="DropdownArrow">{showPapaGames ? "▲" : "▼"}</span>
        </p>
        {showPapaGames && (
          Papagamenames.map((game, index) => (
            <span 
              key={index} 
              className="FancyLink" 
              onClick={() => {
                console.log("clicked");
                setCurrentGame(Papagamenamelocations[index]);
              }}
            >
              {game}
            </span>
          ))
        )}
        
        {!forcegame ? (
          <p className="BodyTextLeft">Press <code>g</code> again to go back to your links.</p>
        ) : null
        }
        
      </main>
    );
  }

  return (
    <main id="main-site">
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
