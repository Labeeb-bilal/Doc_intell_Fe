import { CheckCircle2, Clock, FileCode, FileText, FileType, Loader2, RotateCcw, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn, formatBytes, getFileExtension, truncate, type SupportedFileType } from '@/lib/utils'
import type { DocumentOut } from '@/api/hooks'

// ---------------------------------------------------------------------------
// File type icon — shared with LibraryPage
// ---------------------------------------------------------------------------

const FILE_TYPE_STYLES: Record<SupportedFileType | 'other', { icon: typeof FileText; className: string }> = {
  pdf: { icon: FileText, className: 'text-red-600 dark:text-red-400' },
  docx: { icon: FileType, className: 'text-blue-600 dark:text-blue-400' },
  md: { icon: FileCode, className: 'text-violet-600 dark:text-violet-400' },
  txt: { icon: FileText, className: 'text-muted-foreground' },
  other: { icon: FileText, className: 'text-muted-foreground' },
}

export function FileTypeIcon({ type, className }: { type: SupportedFileType | 'other'; className?: string }) {
  const { icon: Icon, className: colorClassName } = FILE_TYPE_STYLES[type]
  return <Icon className={cn('h-5 w-5 shrink-0', colorClassName, className)} aria-hidden="true" />
}

// ---------------------------------------------------------------------------
// Status pill — shared with LibraryPage
// ---------------------------------------------------------------------------

export function StatusPill({ status, chunkCount }: { status: string; chunkCount?: number | null }) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Queued
        </span>
      )
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-severity-info-bg px-2.5 py-0.5 text-xs font-medium text-severity-info">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Processing…
        </span>
      )
    case 'ready':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Ready{chunkCount ? ` · ${chunkCount} chunks` : ''}
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-severity-critical-bg px-2.5 py-0.5 text-xs font-medium text-severity-critical">
          <XCircle className="h-3 w-3" aria-hidden="true" />
          Failed
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {status}
        </span>
      )
  }
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

export interface PendingUpload {
  /** Local-only row before the server document record resolves (or duplicate). */
  filename: string
  sizeBytes: number
  duplicate: boolean
}

interface DocumentStatusRowProps {
  rowKey: string
  document: DocumentOut | undefined
  pending?: PendingUpload
  onRetry: (id: string) => void
  onDismiss: (rowKey: string) => void
  retrying?: boolean
}

export function DocumentStatusRow({ rowKey, document, pending, onRetry, onDismiss, retrying }: DocumentStatusRowProps) {
  if (pending?.duplicate) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-dashed px-4 py-3 text-muted-foreground">
        <FileTypeIcon type={getFileExtension(pending.filename)} className="opacity-60" />
        <span className="min-w-0 flex-1 truncate text-sm">
          Already uploaded · {truncate(pending.filename, 40)}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDismiss(rowKey)}>
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    )
  }

  const filename = document?.original_filename ?? pending?.filename ?? 'Uploading…'
  const sizeBytes = document?.size_bytes ?? pending?.sizeBytes
  const fileType = document ? (getFileExtension(document.original_filename)) : getFileExtension(filename)
  const status = document?.status ?? 'pending'
  const showProgress = status === 'processing'
  const percent =
    showProgress && document?.chunk_count ? Math.min(100, (document.chunks_done / document.chunk_count) * 100) : null

  return (
    <div className="rounded-md border px-4 py-3">
      <div className="flex items-center gap-3">
        <FileTypeIcon type={fileType} />

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{truncate(filename, 40)}</span>
          </TooltipTrigger>
          {filename.length > 40 && <TooltipContent>{filename}</TooltipContent>}
        </Tooltip>

        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatBytes(sizeBytes)}</span>
        <StatusPill status={status} chunkCount={document?.chunk_count} />

        {status === 'failed' && document && (
          <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => onRetry(document.id)} disabled={retrying}>
            <RotateCcw className={cn('h-3 w-3', retrying && 'animate-spin')} />
            Retry
          </Button>
        )}
        {(status === 'ready' || status === 'failed') && document && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDismiss(rowKey)}>
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Dismiss</span>
          </Button>
        )}
      </div>

      {showProgress && (
        <Progress value={percent ?? undefined} className={cn('mt-2 h-1.5', percent === null && 'animate-pulse')} />
      )}

      {status === 'failed' && document?.error_message && (
        <p className="mt-2 pl-8 text-xs text-severity-critical">{document.error_message}</p>
      )}
    </div>
  )
}
