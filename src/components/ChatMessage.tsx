import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, FileText, RotateCcw } from 'lucide-react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { baseMarkdownComponents } from '@/components/MarkdownProse'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CitationChip } from '@/components/CitationChip'
import { ContradictionCard } from '@/components/ContradictionCard'
import { TraceViewer } from '@/components/TraceViewer'
import { cn, truncate } from '@/lib/utils'
import type { Citation, ContradictionGroupOut } from '@/api/hooks'

const CITATION_TOKEN = /\[S(\d+)\]/g

function toCitationLinks(content: string): string {
  return content.replace(CITATION_TOKEN, (_match, num: string) => `[S${num}](#cite-${num})`)
}

export interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  contradictions?: ContradictionGroupOut[]
  contradictionsTotal?: number
  conversationId?: string
  messageId?: string
  onCitationClick?: (citation: Citation) => void
  errorMessage?: string
  onRetry?: () => void
}

export function ChatMessage({
  role,
  content,
  citations = [],
  contradictions = [],
  contradictionsTotal = 0,
  conversationId,
  messageId,
  onCitationClick,
  errorMessage,
  onRetry,
}: ChatMessageProps) {
  if (role === 'user') {
    return (
      <div className="flex animate-in justify-end fade-in slide-in-from-bottom-2 duration-300">
        <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
          {content}
        </div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="flex animate-in justify-start fade-in slide-in-from-bottom-2 duration-300">
        <div className="max-w-[80%] rounded-2xl border border-severity-critical-bg bg-severity-critical-bg/50 px-4 py-3 text-sm">
          <p className="text-severity-critical">{errorMessage}</p>
          {onRetry && (
            <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={onRetry}>
              <RotateCcw className="h-3 w-3" /> Retry
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex animate-in justify-start fade-in slide-in-from-bottom-2 duration-300">
      <div className="w-full rounded-2xl border bg-card px-4 py-3 text-sm shadow-sm transition-shadow duration-200 hover:shadow-md">
        <AnswerProse content={content} citations={citations} onCitationClick={onCitationClick} />

        {citations.length > 0 && (
          <SourceStrip citations={citations} onCitationClick={onCitationClick} />
        )}

        {contradictions.length > 0 && (
          <ContradictionAlert contradictions={contradictions} total={contradictionsTotal} />
        )}

        {conversationId && messageId && (
          <TraceDisclosure
            conversationId={conversationId}
            messageId={messageId}
            citations={citations}
            contradictions={contradictions}
          />
        )}
      </div>
    </div>
  )
}

export function TypingIndicator({ stage }: { stage?: string }) {
  return (
    <div className="flex animate-in justify-start fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm shadow-sm">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
        </span>
        {stage && <span className="text-muted-foreground">{stage}</span>}
      </div>
    </div>
  )
}

function AnswerProse({
  content,
  citations,
  onCitationClick,
}: {
  content: string
  citations: Citation[]
  onCitationClick?: (citation: Citation) => void
}) {
  const citationByNumber = useMemo(() => {
    const map = new Map<string, Citation>()
    for (const c of citations) {
      const num = c.marker.match(/\d+/)?.[0]
      if (num) map.set(num, c)
    }
    return map
  }, [citations])

  const linked = useMemo(() => toCitationLinks(content), [content])

  const components: Components = useMemo(
    () => ({
      ...baseMarkdownComponents,
      a: ({ href, children }) => {
        if (href?.startsWith('#cite-')) {
          const num = href.slice('#cite-'.length)
          const citation = citationByNumber.get(num)
          return (
            <CitationChip
              marker={citation?.marker ?? `S${num}`}
              onClick={() => citation && onCitationClick?.(citation)}
            />
          )
        }
        return (
          <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {children}
          </a>
        )
      },
    }),
    [citationByNumber, onCitationClick],
  )

  return (
    <div className="text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {linked}
      </ReactMarkdown>
    </div>
  )
}

function SourceStrip({
  citations,
  onCitationClick,
}: {
  citations: Citation[]
  onCitationClick?: (citation: Citation) => void
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
      {citations.map((c) => (
        <button
          key={c.chunk_id}
          type="button"
          onClick={() => onCitationClick?.(c)}
          className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:border-citation hover:bg-secondary/60 hover:text-foreground"
        >
          <FileText className="h-3 w-3" aria-hidden="true" />
          <span className="font-medium text-foreground">{c.marker}</span>
          <span className="max-w-[10rem] truncate">{c.document_name}</span>
          {c.page && <span>· p.{c.page}</span>}
          {c.section && <span>· {truncate(c.section, 20)}</span>}
        </button>
      ))}
    </div>
  )
}

function ContradictionAlert({ contradictions, total }: { contradictions: ContradictionGroupOut[]; total: number }) {
  const [expanded, setExpanded] = useState(false)
  const count = total || contradictions.length

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 rounded-md border border-l-4 border-amber-500 bg-severity-warning-bg px-3 py-2 text-left text-sm font-medium text-severity-warning transition-[filter] duration-150 hover:brightness-95 active:brightness-90"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">
          {count} contradiction{count === 1 ? '' : 's'} found
        </span>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform duration-200', expanded && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <div className="mt-2 animate-in space-y-2 fade-in slide-in-from-top-1 duration-200">
          {contradictions.map((group) => (
            <ContradictionCard key={group.group_id} group={group} />
          ))}
        </div>
      )}
    </div>
  )
}

function TraceDisclosure({
  conversationId,
  messageId,
  citations,
  contradictions,
}: {
  conversationId: string
  messageId: string
  citations: Citation[]
  contradictions: ContradictionGroupOut[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3 border-t pt-2">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground">
          Show how this answer was built
          <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <TraceViewer
          conversationId={conversationId}
          messageId={messageId}
          citations={citations}
          contradictions={contradictions}
          enabled={open}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}
