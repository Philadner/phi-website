import { Link } from 'react-router-dom'
import { getResearchPosts } from '../lib/research'
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

export default function Research() {
  const posts = getResearchPosts()

  return (
    <main id="main-site" className="research-page">
      <section className="research-shell">
        <header className="research-intro">
          <p className="research-kicker">Research</p>
          <h1>Writing and notes.</h1>
          <p className="research-copy">
            Posts live in <code>research posts/&lt;anything&gt;/</code> with a{' '}
            <code>post.md</code> and <code>meta.toml</code>.
          </p>
        </header>

        <div className="research-list">
          {posts.length ? (
            posts.map((post) => (
              <article key={post.slug} className="research-card">
                <Link to={`/research/${encodeURIComponent(post.slug)}`} className="research-card__link">
                  <div className="research-card__meta">
                    {post.date ? <span>{formatDate(post.date)}</span> : null}
                    {post.author ? <span>{post.author}</span> : null}
                  </div>
                  <h2>{post.title}</h2>
                  {post.subtitle ? <p className="research-card__subtitle">{post.subtitle}</p> : null}
                  {post.tags.length ? (
                    <div className="research-tags">
                      {post.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                </Link>
              </article>
            ))
          ) : (
            <article className="research-empty">
              <h2>No posts yet.</h2>
              <p>
                Create a folder inside <code>research posts</code>, then add <code>post.md</code> and{' '}
                <code>meta.toml</code>.
              </p>
            </article>
          )}
        </div>
      </section>
    </main>
  )
}
