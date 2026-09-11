import { useMemo, type ReactNode } from 'react'
import { ArrowRight, Info } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDocuments, useMessageTrace, type Citation, type ContradictionGroupOut, type PairDecision } from '@/api/hooks'
import { cn, formatAbsoluteDate, formatSection, truncate } from '@/lib/utils'

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-severity-critical-bg text-severity-critical',
  warning: 'bg-severity-warning-bg text-severity-warning',
  info: 'bg-severity-info-bg text-severity-info',
}

interface TraceViewerProps {
  conversationId: string
  messageId: string
  citations: Citation[]
  contradictions?: ContradictionGroupOut[]
  enabled: boolean
}

export function TraceViewer({ conversationId, messageId, citations, contradictions = [], enabled }: TraceViewerProps) {
  const { data: trace, isLoading, isError } = useMessageTrace(conversationId, messageId, enabled)

  if (!enabled) return null

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (isError || !trace) {
    return <p className="p-3 text-sm text-muted-foreground">Could not load the full trace for this answer.</p>
  }

  const docNameByChunkId = new Map(trace.retrieval.candidates.map((c) => [c.chunk_id, c]))
  const textByChunkId = new Map(citations.map((c) => [c.chunk_id, c.text]))
  const usedChunkIds = new Set(trace.context?.chunks_used ?? [])

  return (
    <Tabs defaultValue="retrieved" className="p-3">
      <TabsList>
        <TabsTrigger value="retrieved">Retrieved</TabsTrigger>
        <TabsTrigger value="reranked">Reranked</TabsTrigger>
        <TabsTrigger value="used">Used in answer</TabsTrigger>
        <TabsTrigger value="contradictions">Contradiction analysis</TabsTrigger>
      </TabsList>

      <TabsContent value="retrieved" className="mt-3">
        <RetrievedTab
          candidates={trace.retrieval.candidates}
          usedChunkIds={usedChunkIds}
          textByChunkId={textByChunkId}
        />
      </TabsContent>

      <TabsContent value="reranked" className="mt-3">
        <RerankedTab rerank={trace.rerank} docNameByChunkId={docNameByChunkId} />
      </TabsContent>

      <TabsContent value="used" className="mt-3">
        <UsedTab
          chunksUsed={trace.context?.chunks_used ?? []}
          neighbourExpansion={!!trace.context?.neighbour_expansion}
          citations={citations}
          docNameByChunkId={docNameByChunkId}
        />
      </TabsContent>

      <TabsContent value="contradictions" className="mt-3">
        <ContradictionAnalysisTab
          stage={trace.contradiction_check}
          docNameByChunkId={docNameByChunkId}
          contradictions={contradictions}
        />
      </TabsContent>
    </Tabs>
  )
}

const RETRIEVED_WIDTHS = ['w-12', 'w-[190px]', 'w-[90px]', '', 'w-[60px]']

function RetrievedTab({
  candidates,
  usedChunkIds,
  textByChunkId,
}: {
  candidates: NonNullable<ReturnType<typeof useMessageTrace>['data']>['retrieval']['candidates']
  usedChunkIds: Set<string>
  textByChunkId: Map<string, string>
}) {
  const sorted = useMemo(() => [...candidates].sort((a, b) => b.vector_score - a.vector_score), [candidates])

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">No candidates retrieved.</p>
  }

  return (
    <TraceTable
      headers={['Rank', 'Source', 'Vector score', 'Snippet', '']}
      columnWidths={RETRIEVED_WIDTHS}
      rows={sorted.map((c, i) => [
        <span key="rank" className="tabular-nums">
          {i + 1}
        </span>,
        <SourceCell key="source" name={c.document_name} page={c.page_start} section={c.section_path.join(' > ')} />,
        <span key="score" className="tabular-nums">
          {c.vector_score.toFixed(2)}
        </span>,
        <span key="snippet" className="break-words text-muted-foreground">
          {textByChunkId.has(c.chunk_id) ? (
            truncate(textByChunkId.get(c.chunk_id)!, 120)
          ) : (
            <span className="text-muted-foreground/60">No preview</span>
          )}
        </span>,
        usedChunkIds.has(c.chunk_id) ? <UsedTag key="tag" /> : null,
      ])}
    />
  )
}

function RerankedTab({
  rerank,
  docNameByChunkId,
}: {
  rerank: NonNullable<ReturnType<typeof useMessageTrace>['data']>['rerank']
  docNameByChunkId: Map<string, { document_name: string; page_start: number | null; section_path: string[] }>
}) {
  if (!rerank || !rerank.enabled) {
    return <p className="text-sm text-muted-foreground">Reranking was disabled for this query.</p>
  }

  const sorted = [...rerank.results].sort((a, b) => a.rank_after - b.rank_after)

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">No reranking results recorded.</p>
  }

  return (
    <div className="space-y-2">
      <TraceTable
        headers={[
          'Rank before → after',
          'Δ',
          'Source',
          <Tooltip key="score-header">
            <TooltipTrigger asChild>
              <span className="cursor-help underline decoration-dotted underline-offset-2">Vector → rerank score</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Cosine similarity score from Qdrant → cross-encoder relevance score after reranking.
            </TooltipContent>
          </Tooltip>,
          '',
        ]}
        columnWidths={['w-[130px]', 'w-10', '', 'w-[150px]', 'w-[70px]']}
        rows={sorted.map((r) => {
          const doc = docNameByChunkId.get(r.chunk_id)
          const highlight = r.rank_delta >= 3
          const dim = !r.used_in_answer
          return {
            highlight,
            dim,
            cells: [
              <span key="ranks" className="tabular-nums">
                {r.rank_before + 1} <ArrowRight className="inline h-3 w-3" /> {r.rank_after + 1}
              </span>,
              <DeltaBadge key="delta" delta={r.rank_delta} />,
              doc ? (
                <SourceCell
                  key="source"
                  name={doc.document_name}
                  page={doc.page_start}
                  section={doc.section_path.join(' > ')}
                />
              ) : (
                <span key="source" className="text-muted-foreground">
                  {r.chunk_id.slice(0, 8)}…
                </span>
              ),
              <span key="scores" className="tabular-nums">
                {r.vector_score.toFixed(2)} <ArrowRight className="inline h-3 w-3" /> {r.rerank_score.toFixed(2)}
              </span>,
              r.used_in_answer ? <UsedTag key="tag" /> : <DroppedTag key="tag" />,
            ],
          }
        })}
      />
      <p className="text-xs text-muted-foreground">
        Reranker re-scores all candidates together with the query. Higher score = more relevant.
      </p>
    </div>
  )
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn('font-medium tabular-nums', delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-severity-critical')}>
      {delta > 0 ? `+${delta}` : delta}
    </span>
  )
}

function UsedTab({
  chunksUsed,
  neighbourExpansion,
  citations,
  docNameByChunkId,
}: {
  chunksUsed: string[]
  neighbourExpansion: boolean
  citations: Citation[]
  docNameByChunkId: Map<string, { document_name: string; page_start: number | null; section_path: string[] }>
}) {
  const { data: documents } = useDocuments()
  const effectiveDateByDocId = useMemo(
    () => new Map((documents ?? []).map((d) => [d.id, d.effective_date])),
    [documents],
  )

  if (chunksUsed.length === 0) {
    return <p className="text-sm text-muted-foreground">No chunks were used to build this answer.</p>
  }

  const citationByChunkId = new Map(citations.map((c) => [c.chunk_id, c]))

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Neighbour expansion: <span className="font-medium text-foreground">{neighbourExpansion ? 'on' : 'off'}</span>
      </p>
      <div className="space-y-2">
        {chunksUsed.map((chunkId) => {
          const citation = citationByChunkId.get(chunkId)
          const candidate = docNameByChunkId.get(chunkId)
          const docName = citation?.document_name ?? candidate?.document_name ?? chunkId.slice(0, 8)
          const section = citation
            ? formatSection(citation.page, citation.section)
            : candidate
              ? formatSection(candidate.page_start, candidate.section_path.join(' > '))
              : ''
          const documentId = citation?.document_id
          const effectiveDate = documentId ? effectiveDateByDocId.get(documentId) : undefined
          return (
            <div key={chunkId} className="rounded-md border p-3 text-sm">
              <div className="flex items-center gap-2">
                {citation && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-citation-bg px-1 text-[10px] font-semibold text-citation">
                    {citation.marker}
                  </span>
                )}
                <span className="font-medium">{docName}</span>
                {section && <span className="text-xs text-muted-foreground">{section}</span>}
              </div>
              {effectiveDate && (
                <p className="mt-0.5 text-xs text-muted-foreground">Effective: {formatAbsoluteDate(effectiveDate)}</p>
              )}
              <p className="mt-1.5 break-words text-muted-foreground">
                {citation ? citation.text : 'Chunk text unavailable outside of cited sources.'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type PairState = 'rejected' | 'cosine_passed' | 'sent_to_llm' | 'cached'

function getPairState(reason: string): PairState {
  if (reason === 'cached_verdict') return 'cached'
  if (reason === 'accepted' || reason === 'numeric_exempt') return 'sent_to_llm'
  return 'rejected'
}

const PAIR_ROW_TINT: Record<PairState, string> = {
  cached: 'bg-blue-600/[0.06] dark:bg-blue-500/10',
  sent_to_llm: 'bg-green-600/[0.06] dark:bg-green-500/10',
  cosine_passed: 'bg-green-600/[0.06] dark:bg-green-500/10',
  rejected: '',
}

function PairStateBadge({ state }: { state: PairState }) {
  if (state === 'sent_to_llm') {
    return (
      <span className="inline-flex items-center rounded-md border border-green-700/40 bg-green-600/10 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:border-green-400/40 dark:bg-green-400/10 dark:text-green-400">
        Accepted
      </span>
    )
  }
  if (state === 'cached') {
    return (
      <span className="inline-flex items-center rounded-md border border-blue-300 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:border-blue-400/40 dark:bg-blue-400/10 dark:text-blue-400">
        Cached
      </span>
    )
  }
  return null
}

function sortPairsForDisplay(filterLog: PairDecision[]): PairDecision[] {
  const byState = (state: PairState) => filterLog.filter((p) => getPairState(p.reason) === state)
  return [
    ...byState('cached'),
    ...byState('sent_to_llm').sort((a, b) => (b.cosine ?? 0) - (a.cosine ?? 0)),
    ...byState('rejected'),
  ]
}

function PairFilterTable({
  filterLog,
  docNameByChunkId,
}: {
  filterLog: PairDecision[]
  docNameByChunkId: Map<string, { document_name: string }>
}) {
  const sorted = useMemo(() => sortPairsForDisplay(filterLog), [filterLog])

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">Pair</th>
            <th className="w-[70px] px-3 py-2 text-right">Cosine</th>
            <th className="w-[90px] px-3 py-2 text-right"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((pair, i) => {
            const state = getPairState(pair.reason)
            const nameA = docNameByChunkId.get(pair.chunk_a_id)?.document_name ?? pair.chunk_a_id.slice(0, 8)
            const nameB = docNameByChunkId.get(pair.chunk_b_id)?.document_name ?? pair.chunk_b_id.slice(0, 8)
            return (
              <tr key={i} className={cn('border-t first:border-t-0', PAIR_ROW_TINT[state])}>
                <td className="break-words px-3 py-2 align-top">
                  {nameA} ↔ {nameB}
                </td>
                <td className="break-words px-3 py-2 text-right align-top tabular-nums text-muted-foreground">
                  {state === 'sent_to_llm' || state === 'cosine_passed' ? (
                    pair.cosine?.toFixed(2)
                  ) : state === 'cached' ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted underline-offset-2">—</span>
                      </TooltipTrigger>
                      <TooltipContent>Score not computed — verdict retrieved from cache.</TooltipContent>
                    </Tooltip>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-right align-top">
                  <PairStateBadge state={state} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ContradictionAnalysisTab({
  stage,
  docNameByChunkId,
  contradictions,
}: {
  stage: NonNullable<ReturnType<typeof useMessageTrace>['data']>['contradiction_check']
  docNameByChunkId: Map<string, { document_name: string }>
  contradictions: ContradictionGroupOut[]
}) {
  if (!stage || !stage.enabled) {
    return <p className="text-sm text-muted-foreground">Contradiction checking was disabled for this query.</p>
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Pair filtering</p>
        {stage.filter_log.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pairs were evaluated.</p>
        ) : (
          <PairFilterTable filterLog={stage.filter_log} docNameByChunkId={docNameByChunkId} />
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Verdict</p>
        {stage.llm_calls === 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500 dark:text-slate-400" aria-hidden="true" />
            <span>No LLM call made — all pairs resolved from cache.</span>
          </div>
        ) : (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
              <DetailStat label="LLM calls" value={stage.llm_calls} />
              <DetailStat label="Verdicts returned" value={stage.verdicts_returned} />
              <DetailStat label="Rejected · span check" value={stage.verdicts_rejected_span_check} />
              <DetailStat label="Rejected · low confidence" value={stage.verdicts_below_confidence} />
            </dl>
            {contradictions.length > 0 && (
              <div className="space-y-1.5">
                {contradictions.map((group) => (
                  <div key={group.group_id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-medium capitalize',
                        SEVERITY_BADGE[group.severity] ?? SEVERITY_BADGE.info,
                      )}
                    >
                      {group.type}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {Math.round(group.confidence * 100)}%
                    </span>
                    <span className="truncate text-muted-foreground">{group.explanation}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function SourceCell({ name, page, section }: { name: string; page: number | null; section: string }) {
  const meta = formatSection(page, section)
  return (
    <div>
      <p className="break-words font-medium">{name}</p>
      {meta && <p className="break-words text-xs text-muted-foreground">{meta}</p>}
    </div>
  )
}

function UsedTag() {
  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
      Used
    </span>
  )
}

function DroppedTag() {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Dropped
    </span>
  )
}

interface TraceTableRow {
  highlight?: boolean
  dim?: boolean
  cells: ReactNode[]
}

function TraceTable({
  headers,
  rows,
  columnWidths,
}: {
  headers: ReactNode[]
  rows: (ReactNode[] | TraceTableRow)[]
  columnWidths?: string[]
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {headers.map((h, i) => (
              <th key={i} className={cn('px-3 py-2', columnWidths?.[i])}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const cells = Array.isArray(row) ? row : row.cells
            const highlight = !Array.isArray(row) && row.highlight
            const dim = !Array.isArray(row) && row.dim
            return (
              <tr
                key={i}
                className={cn(
                  'border-t first:border-t-0',
                  highlight && 'bg-severity-warning-bg/40',
                  dim && 'text-muted-foreground',
                )}
              >
                {cells.map((cell, j) => (
                  <td key={j} className={cn('break-words px-3 py-2 align-top', columnWidths?.[j])}>
                    {cell}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
