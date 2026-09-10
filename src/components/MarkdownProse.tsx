import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * One shared set of styled markdown elements, reused everywhere source-
 * document text can legitimately contain markdown syntax (bold, lists,
 * tables, ...): the assistant's own answer (ChatMessage's AnswerProse,
 * which overrides `a` for citation chips), a raw .md source excerpt
 * (CitationPanel), and a quoted .md contradiction statement
 * (ContradictionCard). Centralised so all three render `**bold**` the
 * same way instead of each reimplementing (or forgetting to implement)
 * the same style map.
 */
export const baseMarkdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  p: ({ children }) => <p className="mb-2 break-words leading-relaxed last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-muted-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-muted-foreground">{children}</ol>,
  li: ({ children }) => <li className="break-words leading-relaxed">{children}</li>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  tr: ({ children }) => <tr className="border-b last:border-b-0">{children}</tr>,
  th: ({ children }) => <th className="px-2 py-1.5 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="break-words px-2 py-1.5 align-top">{children}</td>,
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground">{children}</blockquote>
  ),
  h1: ({ children }) => <h3 className="mb-1 mt-3 font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-1 mt-3 font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h3 className="mb-1 mt-3 font-semibold first:mt-0">{children}</h3>,
  hr: () => <hr className="my-3 border-border" />,
}

/** Renders `content` as markdown using baseMarkdownComponents, optionally
 * overridden (e.g. ChatMessage.tsx overrides `a` to render citation chips). */
export function MarkdownProse({
  content,
  components,
  className,
}: {
  content: string
  components?: Components
  className?: string
}) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ...baseMarkdownComponents, ...components }}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
