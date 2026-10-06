import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'

const fonts = new Set(['sans', 'serif', 'mono', 'handwritten', 'display'])

function remarkChatFonts() {
  return (tree: Root) => {
    visit(tree, 'textDirective', (node) => {
      if (node.name !== 'font') return
      const font = node.attributes?.family || 'sans'
      if (!fonts.has(font)) return
      node.data = { ...node.data, hName: 'span', hProperties: { className: `chat-font-${font}` } }
    })
  }
}

export default function ChatMarkdown({ content }: { content: string }) {
  return <div className="chat-markdown">
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkDirective, remarkChatFonts]}
      skipHtml
      components={{
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
        // Uploads come next. Keep external images as links to avoid loading tracking pixels.
        img: ({ src, alt }) => <a href={src} target="_blank" rel="noopener noreferrer">{alt || 'Image link'}</a>,
      }}
    >{content}</ReactMarkdown>
  </div>
}
