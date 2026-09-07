import { Fragment, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, FileText, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CitationChip } from '@/components/CitationChip'
import { ContradictionCard } from '@/components/ContradictionCard'
import { TraceViewer } from '@/components/TraceViewer'
import { cn } from '@/lib/utils'
import type { Citation, ContradictionGroupOut } from '@/api/hooks'

const CITATION_TOKEN = /\[S(\d+)\]/g

export interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  contradictions?: ContradictionGroupOut[]
  contradictionsTotal?: number
  conversationId?: string
  messageId?: string
  onCitationClick?: (citation: Citation) => void
  /** Assistant-side error turn: renders the message as an error with a retry action. */
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
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
          {content}
        </div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="flex justify-start">
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
    <div className="flex justify-start">
      <div className="w-full max-w-[85%] rounded-2xl border bg-card px-4 py-3 text-sm shadow-sm">
        <AnswerProse content={content} citations={citations} onCitationClick={onCitationClick} />

        {citations.length > 0 && (
          <SourceStrip citations={citations} onCitationClick={onCitationClick} />
        )}

        {contradictions.length > 0 && (
          <ContradictionAlert contradictions={contradictions} total={contradictionsTotal} />
        )}

        {conversationId && messageId && (
          <TraceDisclosure conversationId={conversationId} messageId={messageId} citations={citations} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Prose with inline [Sn] chips
// ---------------------------------------------------------------------------

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

  const parts = useMemo(() => {
    const result: { text?: string; citation?: Citation; marker?: string }[] = []
    let lastIndex = 0
    for (const match of content.matchAll(CITATION_TOKEN)) {
      const [token, num] = match
      const index = match.index ?? 0
      if (index > lastIndex) result.push({ text: content.slice(lastIndex, index) })
      const citation = citationByNumber.get(num)
      result.push({ citation, marker: citation?.marker ?? `S${num}` })
      lastIndex = index + token.length
    }
    if (lastIndex < content.length) result.push({ text: content.slice(lastIndex) })
    return result
  }, [content, citationByNumber])

  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) =>
        part.text !== undefined ? (
          <Fragment key={i}>{part.text}</Fragment>
        ) : (
          <CitationChip
            key={i}
            marker={part.marker!}
            onClick={() => part.citation && onCitationClick?.(part.citation)}
          />
        ),
      )}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Source strip
// ---------------------------------------------------------------------------

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
          className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          <FileText className="h-3 w-3" aria-hidden="true" />
          <span className="font-medium text-foreground">{c.marker}</span>
          <span className="max-w-[10rem] truncate">{c.document_name}</span>
          {c.page && <span>· p.{c.page}</span>}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contradiction alert
// ---------------------------------------------------------------------------

function ContradictionAlert({ contradictions, total }: { contradictions: ContradictionGroupOut[]; total: number }) {
  const [expanded, setExpanded] = useState(false)
  const count = total || contradictions.length

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 rounded-md border border-severity-warning-bg bg-severity-warning-bg px-3 py-2 text-left text-sm font-medium text-severity-warning hover:brightness-95"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">
          {count} contradiction{count === 1 ? '' : 's'} found
        </span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {contradictions.map((group) => (
            <ContradictionCard key={group.group_id} group={group} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trace disclosure
// ---------------------------------------------------------------------------

function TraceDisclosure({
  conversationId,
  messageId,
  citations,
}: {
  conversationId: string
  messageId: string
  citations: Citation[]
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
        <TraceViewer conversationId={conversationId} messageId={messageId} citations={citations} enabled={open} />
      </CollapsibleContent>
    </Collapsible>
  )
}
