import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import { visit, SKIP } from 'unist-util-visit'
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

function remarkChatMentions() {
  return (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined || parent.type === 'link' || parent.type === 'linkReference') return
      const matches = [...node.value.matchAll(/(?:^|(?<=[\s(]))@(?:"[A-Za-z0-9_ -]{2,24}"|[A-Za-z0-9_-]{2,24})(?=$|[\s.,!?;:)\]])/g)]
      if (!matches.length) return
      const nodes: typeof parent.children = []
      let cursor = 0
      for (const match of matches) {
        if (match.index! > cursor) nodes.push({ type: 'text', value: node.value.slice(cursor, match.index) })
        nodes.push({ type: 'link', url: '', children: [{ type: 'text', value: match[0] }], data: { hName: 'span', hProperties: { className: 'chat-mention' } } })
        cursor = match.index! + match[0].length
      }
      if (cursor < node.value.length) nodes.push({ type: 'text', value: node.value.slice(cursor) })
      parent.children.splice(index, 1, ...nodes)
      return [SKIP, index + nodes.length]
    })
  }
}

export default function ChatMarkdown({ content }: { content: string }) {
  return <div className="chat-markdown">
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkDirective, remarkChatFonts, remarkChatMentions]}
      skipHtml
      components={{
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
        // Only verified attachments embed images; external Markdown images stay links.
        img: ({ src, alt }) => <a href={src} target="_blank" rel="noopener noreferrer">{alt || 'Image link'}</a>,
      }}
    >{content}</ReactMarkdown>
  </div>
}
