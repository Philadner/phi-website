import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getResearchPost } from '../lib/research'
import '../stylesheets/Research.css'

function formatDate(date: string) {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function ResearchPost() {
  const { slug = '' } = useParams()
  const post = getResearchPost(slug)

  if (!post) {
    return <Navigate to="/research" replace />
  }

  return (
    <main id="main-site" className="research-page">
      <article className="research-shell research-shell--post">
        <Link to="/research" className="research-back">
          Research
        </Link>

        <header className="research-post-header">
          <p className="research-kicker">Research</p>
          <h1>{post.title}</h1>
          {post.subtitle ? <p className="research-post-subtitle">{post.subtitle}</p> : null}

          <div className="research-post-meta">
            {post.author ? <span>{post.author}</span> : null}
            {post.date ? <span>{formatDate(post.date)}</span> : null}
          </div>

          {post.tags.length ? (
            <div className="research-tags">
              {post.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
        </header>

        <div className="research-prose">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: (props) => <h2 {...props} />,
              h2: (props) => <h3 {...props} />,
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>
      </article>
    </main>
  )
}
