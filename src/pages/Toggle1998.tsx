import { useEffect } from "react";
import use1998Mode from "../hooks/use1998Mode";


export default function Toggle1998() {
  const [mode1998, setMode1998] = use1998Mode();
  useEffect(() => {
    console.log("Current mode:", mode1998);
    console.log("Seinding you to 1998");
    () => setMode1998((v) => !v);
  }, []);

  return (
    <div>
      <button
        className="mode-1998-btn"
        type="button"
        aria-pressed={mode1998}
        onClick={() => setMode1998((v) => !v)}
        title="Toggle 1998 mode"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "75%",
          height: "75vh",
          fontSize: "48px",
          padding: "40px",
        }}
      >
        {mode1998 ? "BRING ME BACK" : "TAKE ME TO 1998"}
      </button>
    </div>
  );
}
