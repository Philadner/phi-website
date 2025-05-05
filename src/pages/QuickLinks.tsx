import { useEffect, useState } from 'react';

function QuickLinks() {
  const [showGames, setShowGames] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'g') {
        setShowGames(prev => !prev); // press 'g' to toggle
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (showGames) {
    return (
      <main id="main-site">
        <h1 className="CenterTitle">Totally Normal Learning Page 😇</h1>
        <p className="BodyTextLeft">Definitely not full of distractions.</p>
        <iframe
          src="https://2048game.com/"
          width="100%"
          height="600px"
          style={{ border: 'none', borderRadius: '8px' }}
        ></iframe>
        <p className="BodyTextLeft">Press <code>g</code> again to go back.</p>
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
