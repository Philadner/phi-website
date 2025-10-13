import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "../stylesheets/Changelog.css";
import changelog from "../content/changelog.md?raw";

export default function Changelog() {
  return (
    <main id="main-site">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h1 className="CenterTitle" {...props} />,
          h2: (props) => <h2 className="HeadingBigLeft" {...props} />,
          h3: (props) => <h3 className="HeadingLeft" {...props} />,
          p: (props) => <p className="BodyTextLeft" {...props} />,
          hr: () => <div className="BigSpaceDiv" />,
        }}
      >
        {changelog}
      </ReactMarkdown>
    </main>
  );
}
