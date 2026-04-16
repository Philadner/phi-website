import { Link } from "react-router-dom";

type TopicCard = {
  title: string;
  description: string;
  href?: string;
  cta?: string;
};

const topics: TopicCard[] = [
  {
    title: "Atomic Structure",
    description:
      "Protons, neutrons, electrons, ions, and isotopes. This will be one of the first interactive diagram topics.",
  },
  {
    title: "Bonding",
    description:
      "Ionic, covalent, and metallic bonding with room for smoother visual explanations later on.",
  },
  {
    title: "Periodic Table",
    description:
      "A place for groups, periods, and trends so the table starts making sense instead of feeling random.",
  },
  {
    title: "Reactions",
    description:
      "Balancing equations, energy changes, and reaction ideas that can grow into proper animations.",
  },
  {
    title: "Electrolysis",
    description:
      "A full simulator page for following ions, products at each electrode, and the logic behind the half equations.",
    href: "/revise/electrolysis",
    cta: "Open simulator",
  },
  {
    title: "Acids and Alkalis",
    description:
      "pH, neutralisation, salts, and indicators in one spot so revision stays organised.",
  },
];

export default function Revise() {
  return (
    <main id="main-site">
      <h1 className="CenterTitle">Chemistry Revision</h1>
      <div className="SpaceDiv" />

      <p className="BodyTextCentre">
        This is the chemistry revision page. Proper interactive diagrams and animations will go in
        here later, but this is the base page to build from.
      </p>

      <div className="BigSpaceDiv" />

      <section
        style={{
          width: "min(960px, 100%)",
          margin: "0 auto",
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
        aria-label="Chemistry topics"
      >
        {topics.map((topic) => (
          <article
            key={topic.title}
            style={{
              border: "1px solid rgba(255, 215, 0, 0.25)",
              borderRadius: "16px",
              padding: "1rem",
              background: "rgba(255, 255, 255, 0.03)",
            }}
          >
            <h2 className="HeadingLeft" style={{ fontSize: "1.4rem", marginBottom: "0.75rem" }}>
              {topic.title}
            </h2>
            <p className="BodyTextLeft" style={{ fontSize: "1rem" }}>
              {topic.description}
            </p>
            {topic.href ? (
              <div className="SpaceDiv">
                <Link
                  to={topic.href}
                  className="FancyLink"
                  style={{ fontSize: "1rem", display: "inline-flex" }}
                >
                  {topic.cta ?? "Open"}
                </Link>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
