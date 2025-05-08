import { useState } from 'react';
function Games() {
    const [showPapaGames, setshowPapaGames] = useState(false);
    const [currentGame, setCurrentGame] = useState("https://cdn.phi.me.uk/papasfreezeria[1].swf");
  
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


    {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/@ruffle-rs/ruffle";
        script.async = true;
        document.body.appendChild(script);
        }
    
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
              
              
              <p className="BodyTextLeft">Plese don't use this on the school computers so school can't detect the website!</p>
              <p className="BodyTextLeft">Instead, go to quick links and press <code>G</code></p>
            </main>
          );   
   
}

export default Games
