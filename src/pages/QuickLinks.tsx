import { useEffect, useState } from "react";

function QuickLinks() {
  const [showGame, setShowGame] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "g") {
        setShowGame((prev) => !prev);
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
      <main id="main-site">
        <h1 className="CenterTitle">Quick Links</h1>
        <div style={{ width: "100%", maxWidth: "800px", margin: "0 auto" }}>
          <object
            type="application/x-shockwave-flash"
            data="https://9db2752a411807f82aa44f25cdacce11.r2.cloudflarestorage.com/phi-me-uk/papasfreezeria_v2.swf"
            width="100%"
            height="600"
          >
            <p>Flash not supported</p>
          </object>
        </div>
        <p className="BodyTextLeft">Press <code>g</code> again to go back to your links.</p>
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
