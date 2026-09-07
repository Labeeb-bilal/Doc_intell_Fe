import { useState } from 'react'
import { ChevronDown, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useUpdateContradiction, type ContradictionGroupOut, type ContradictionStatus } from '@/api/hooks'
import { ApiError } from '@/api/client'
import { cn, formatAbsoluteDate, formatSection } from '@/lib/utils'

const SEVERITY_STYLES: Record<string, { badge: string }> = {
  critical: { badge: 'bg-severity-critical-bg text-severity-critical' },
  warning: { badge: 'bg-severity-warning-bg text-severity-warning' },
  info: { badge: 'bg-severity-info-bg text-severity-info' },
}

interface ContradictionCardProps {
  group: ContradictionGroupOut
  selectable?: boolean
  selected?: boolean
  onSelectChange?: (selected: boolean) => void
}

export function ContradictionCard({ group, selectable, selected, onSelectChange }: ContradictionCardProps) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  // Own optimistic copy of status, seeded from the prop. Needed because this card
  // is used inline in chat with `group` sourced from local component state (a chat
  // turn's response), not from the `contradictions` query cache — so the mutation's
  // cache-level optimistic update alone wouldn't make THIS card flip instantly.
  const [status, setStatus] = useState(group.status)
  const updateMutation = useUpdateContradiction()
  const { toast } = useToast()

  const evidenceIds = group.evidence.map((e) => e.id)
  const severity = SEVERITY_STYLES[group.severity] ?? SEVERITY_STYLES.info
  const isOpen = status === 'open'

  async function updateStatus(newStatus: ContradictionStatus) {
    const previous = status
    setStatus(newStatus)
    try {
      await updateMutation.mutateAsync({ evidenceIds, status: newStatus, note: note || undefined })
    } catch (err) {
      setStatus(previous)
      const message = err instanceof ApiError ? err.message : 'Could not update this contradiction.'
      toast({ title: 'Update failed', description: message, variant: 'destructive' })
    }
  }

  return (
    <div className={cn('rounded-lg border p-4', !isOpen && 'bg-muted/30')}>
      <div className="flex flex-wrap items-center gap-2">
        {selectable && (
          <Checkbox
            checked={!!selected}
            onCheckedChange={(c) => onSelectChange?.(c === true)}
            aria-label={`Select contradiction: ${group.explanation.slice(0, 40)}`}
          />
        )}
        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium capitalize text-secondary-foreground">
          {group.type}
        </span>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize', severity.badge)}>
          <span aria-hidden="true">●</span> {group.severity}
        </span>
        <span className="text-xs text-muted-foreground">{Math.round(group.confidence * 100)}% confidence</span>
        {!isOpen && (
          <span className="ml-auto text-xs font-medium text-muted-foreground">
            {status === 'resolved' ? 'Resolved ✓' : 'Marked as false positive'}
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <StatementBlock statement={group.statement_a} />
        <div>
          <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground md:hidden">
            <span className="h-px flex-1 bg-border" /> vs <span className="h-px flex-1 bg-border" />
          </div>
          <StatementBlock statement={group.statement_b} />
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{group.explanation}</p>

      {group.reconciliation === 'supersedes' && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Supersedes · the more recent document appears to supersede the other.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isOpen ? (
          <>
            <Button size="sm" onClick={() => updateStatus('resolved')} disabled={updateMutation.isPending}>
              Mark resolved
            </Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus('false_positive')} disabled={updateMutation.isPending}>
              False positive
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => updateStatus('open')} disabled={updateMutation.isPending}>
            Reopen
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 text-muted-foreground"
          onClick={() => setNoteOpen((o) => !o)}
        >
          note
          <ChevronDown className={cn('h-3 w-3 transition-transform', noteOpen && 'rotate-180')} aria-hidden="true" />
        </Button>
      </div>

      {noteOpen && (
        <Textarea
          className="mt-2"
          placeholder="Add a note (optional)"
          aria-label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      )}
    </div>
  )
}

function StatementBlock({ statement }: { statement: ContradictionGroupOut['statement_a'] }) {
  const section = formatSection(statement.page, statement.section)
  return (
    <div className="rounded-md border bg-background p-3 text-sm">
      <p>&ldquo;{statement.text}&rdquo;</p>
      <div className="mt-2 space-y-0.5 border-t pt-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{statement.document_name}</p>
        {section && <p>{section}</p>}
        {statement.effective_date && <p>eff. {formatAbsoluteDate(statement.effective_date)}</p>}
      </div>
    </div>
  )
}
