import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ContradictionCard } from '@/components/ContradictionCard'
import { EmptyState } from '@/components/EmptyState'
import { useContradictions, useDocuments, useUpdateContradiction } from '@/api/hooks'
import { cn, truncate } from '@/lib/utils'

const ANY = '__any__'

const SEVERITY_OPTIONS = ['critical', 'warning', 'info']
const TYPE_OPTIONS = ['temporal', 'logical', 'numerical', 'factual']

export default function ContradictionsPage() {
  const [statusFilter, setStatusFilter] = useState('open')
  const [severityFilter, setSeverityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [documentFilter, setDocumentFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)

  const { data, isLoading } = useContradictions({
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
    type: typeFilter || undefined,
    document_id: documentFilter || undefined,
  })
  const { data: documents } = useDocuments()
  const updateMutation = useUpdateContradiction()

  const counts = data?.counts ?? {}
  const totalKnown = Object.values(counts).reduce((sum, n) => sum + n, 0)
  const contradictions = data?.contradictions ?? []

  function toggleSelected(groupId: string, isSelected: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (isSelected) next.add(groupId)
      else next.delete(groupId)
      return next
    })
  }

  async function handleBulkResolve() {
    const groups = contradictions.filter((g) => selected.has(g.group_id))
    setBulkRunning(true)
    for (const [index, group] of groups.entries()) {
      if (index > 0) await new Promise((r) => setTimeout(r, 250))
      try {
        await updateMutation.mutateAsync({
          evidenceIds: group.evidence.map((e) => e.id),
          status: 'resolved',
        })
      } catch {
      }
    }
    setBulkRunning(false)
    setSelected(new Set())
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Contradictions</h1>
      <p className="mt-1 text-sm text-muted-foreground">Review conflicts detected across your documents.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <SummaryChip
          label="open"
          count={counts.open ?? 0}
          active={statusFilter === 'open'}
          onClick={() => setStatusFilter('open')}
        />
        <SummaryChip
          label="resolved"
          count={counts.resolved ?? 0}
          active={statusFilter === 'resolved'}
          onClick={() => setStatusFilter('resolved')}
        />
        <SummaryChip
          label="false positive"
          count={counts.false_positive ?? 0}
          active={statusFilter === 'false_positive'}
          onClick={() => setStatusFilter('false_positive')}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Select value={severityFilter || ANY} onValueChange={(v) => setSeverityFilter(v === ANY ? '' : v)}>
          <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Filter by severity">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All severities</SelectItem>
            {SEVERITY_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter || ANY} onValueChange={(v) => setTypeFilter(v === ANY ? '' : v)}>
          <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Filter by type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All types</SelectItem>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={documentFilter || ANY} onValueChange={(v) => setDocumentFilter(v === ANY ? '' : v)}>
          <SelectTrigger className="h-8 w-[180px] text-xs" aria-label="Filter by document">
            <SelectValue placeholder="Document" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All documents</SelectItem>
            {documents?.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {truncate(d.original_filename, 30)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="mt-4 flex animate-in items-center gap-2 rounded-md border bg-secondary/50 px-3 py-2 fade-in slide-in-from-top-1 duration-200">
          <span className="text-sm">{selected.size} selected</span>
          <Button size="sm" onClick={handleBulkResolve} disabled={bulkRunning}>
            {bulkRunning ? 'Resolving…' : 'Mark all selected as resolved'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={bulkRunning}>
            Clear
          </Button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </>
        ) : contradictions.length === 0 ? (
          <ContradictionsEmptyState statusFilter={statusFilter} totalKnown={totalKnown} />
        ) : (
          contradictions.map((group, i) => (
            <div
              key={group.group_id}
              className="animate-in fade-in slide-in-from-bottom-1 duration-300"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms`, animationFillMode: 'backwards' }}
            >
              <ContradictionCard
                group={group}
                selectable
                selected={selected.has(group.group_id)}
                onSelectChange={(isSelected) => toggleSelected(group.group_id, isSelected)}
              />
            </div>
          ))
        )}
      </div>

      {data && data.total > contradictions.length && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Showing {contradictions.length} of {data.total} ·{' '}
          <button
            type="button"
            className="underline underline-offset-2 hover:no-underline"
            onClick={() => {
              setStatusFilter('')
              setSeverityFilter('')
              setTypeFilter('')
              setDocumentFilter('')
            }}
          >
            view all
          </button>
        </p>
      )}
    </div>
  )
}

function SummaryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150 active:scale-95',
        active ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary',
      )}
    >
      <span className="tabular-nums">{count}</span> {label}
    </button>
  )
}

function ContradictionsEmptyState({ statusFilter, totalKnown }: { statusFilter: string; totalKnown: number }) {
  if (totalKnown === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No contradictions found yet"
        description="Upload documents and ask questions to begin."
      />
    )
  }
  if (statusFilter === 'open') {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="All caught up"
        description="All contradictions have been reviewed."
      />
    )
  }
  if (statusFilter === 'false_positive') {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Nothing here"
        description="No pairs have been marked as false positives."
      />
    )
  }
  return (
    <EmptyState icon={AlertTriangle} title="No matches" description="No contradictions match the current filters." />
  )
}

