import { useState } from "react";

function jACOB() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [vel, setVel] = useState({ vx: 5, vy: 7 });

  const handleClick = () => {
    let x = pos.x;
    let y = pos.y;
    let vx = vel.vx;
    let vy = vel.vy;
  
    const interval = setInterval(() => {
      const img = document.getElementById("bouncyImg") as HTMLImageElement | null;
      if (!img) return;
  
      const maxX = window.innerWidth - img.width;
      const maxY = window.innerHeight - img.height;
  
      x += vx;
      y += vy;
  
      if (x <= 0 || x >= maxX) vx *= -1;
      if (y <= 0 || y >= maxY) vy *= -1;
  
      setPos({ x, y });
      setVel({ vx, vy });
    }, 16); // ~60fps
  
    // Stop after 10 seconds
    setTimeout(() => clearInterval(interval), 10000);
  };
  

  return (
    <main id="main-site" style={{ textAlign: "center" }}>
      <h1 className="CenterTitle">jACOB dungeon</h1>
      <div className="SpaceDiv"></div>
      <img
        id="bouncyImg"
        src="https://cdn.phi.me.uk/im very hard.png"
        alt="Sexy men"
        onClick={handleClick}
        style={{
          maxWidth: "100%",
          maxHeight: "100vh",
          position: "absolute",
          left: pos.x,
          top: pos.y,
          cursor: "pointer"
        }}
      />
    </main>
  );
}

export default jACOB;
