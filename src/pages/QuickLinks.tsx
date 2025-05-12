import { useEffect, useState } from "react";

interface QuickLinksProps {
  initialShowGame?: boolean;
  forcegame?: boolean;
}

function QuickLinks({ initialShowGame = false, forcegame = false }: QuickLinksProps) {
  const [showGame, setShowGame] = useState(initialShowGame);
  const [showPapaGames, setshowPapaGames] = useState(false);
  const [currentGame, setCurrentGame] = useState("https://cdn.phi.me.uk/papasfreezeria[1].swf");
  const [panicUrl, setPanicUrl] = useState("https://thedeanery.schoolsynergy.co.uk");

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
      <main id="main-site" className="GamePage">
        <div style={{ width: "100%", maxWidth: "800px", margin: "0 auto" }} key={currentGame}>
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
        <p className="BodyTextLeft">Type the website you're supposed to be on here!</p>
        <input
          type="text"
          value={panicUrl}
          onChange={(e) => setPanicUrl(e.target.value)}
          placeholder="Enter panic URL"
          style={{ margin: "8px 0", padding: "5px", width: "80%" }}
        />

        <p className="HeadingLeft">Select another flash game:</p>
        <span className="FancyLink" onClick={() => setCurrentGame("https://cdn.phi.me.uk/HappyWheels.swf")}>
          Happy wheels
        </span>
        <span className="FancyLink" onClick={() => setCurrentGame("https://cdn.phi.me.uk/moto-x3m.swf")}>
          Moto X3M
        </span>
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
              onClick={() => setCurrentGame(Papagamenamelocations[index])}
            >
              {game}
            </span>
          ))
        )}

        {!forcegame ? (
          <p className="BodyTextLeft">Press <code>g</code> again to go back to your links.</p>
        ) : null}
      </main>
    );
  }

  return (
    <main id="main-site">
      <h1 className="CenterTitle">Quick links</h1>
      <p className="BodyTextLeft">
        Type the website you're supposed to be on here!
      </p>
      <input
        type="text"
        value={panicUrl}
        onChange={(e) => setPanicUrl(e.target.value)}
        placeholder="Enter panic URL"
        style={{ margin: "8px 0", padding: "5px", width: "80%" }}
      />
    </main>
  );
}

export default QuickLinks;
