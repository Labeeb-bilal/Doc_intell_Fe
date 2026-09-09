import { Fragment, useState } from 'react'
import { ChevronRight, ChevronLeft, FolderOpen, Trash2 } from 'lucide-react'
import { FileTypeIcon, StatusPill } from '@/components/DocumentStatusRow'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { useDeleteDocument, useDocumentChunks, useDocuments, type DocumentOut } from '@/api/hooks'
import { ApiError } from '@/api/client'
import { cn, formatAbsoluteDate, formatBytes, formatDate, getFileExtension, truncate } from '@/lib/utils'

export default function LibraryPage() {
  const { data: documents, isLoading } = useDocuments()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocumentOut | null>(null)

  function toggleExpanded(id: string) {
    setExpandedId((current) => (current === id ? null : id))
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Library</h1>
      <p className="mt-1 text-sm text-muted-foreground">All documents indexed for search and chat.</p>

      <div className="mt-6">
        {isLoading ? (
          <LibrarySkeleton />
        ) : !documents || documents.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No documents yet"
            description="Upload your first document to get started."
            action={{ label: 'Go to upload', href: '/upload' }}
          />
        ) : (
          <>
            <DesktopTable
              documents={documents}
              expandedId={expandedId}
              onToggle={toggleExpanded}
              onDelete={setDeleteTarget}
            />
            <MobileCards
              documents={documents}
              expandedId={expandedId}
              onToggle={toggleExpanded}
              onDelete={setDeleteTarget}
            />
          </>
        )}
      </div>

      <DeleteDialog document={deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} />
    </div>
  )
}

function LibrarySkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Desktop table
// ---------------------------------------------------------------------------

interface TableProps {
  documents: DocumentOut[]
  expandedId: string | null
  onToggle: (id: string) => void
  onDelete: (document: DocumentOut) => void
}

function DesktopTable({ documents, expandedId, onToggle, onDelete }: TableProps) {
  return (
    <div className="hidden overflow-x-auto rounded-md border md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <th className="w-8 px-3 py-2" />
            <th className="px-3 py-2">Filename</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Size</th>
            <th className="px-3 py-2">Pages</th>
            <th className="px-3 py-2">Chunks</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Effective date</th>
            <th className="px-3 py-2">Uploaded</th>
            <th className="w-10 px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const isExpanded = expandedId === doc.id
            return (
              <Fragment key={doc.id}>
                <tr
                  className="cursor-pointer border-b transition-colors duration-150 last:border-b-0 hover:bg-secondary/40"
                  onClick={() => onToggle(doc.id)}
                >
                  <td className="px-3 py-2 text-muted-foreground">
                    <ChevronRight
                      className={cn('h-4 w-4 transition-transform duration-200', isExpanded && 'rotate-90')}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileTypeIcon type={getFileExtension(doc.original_filename)} className="h-4 w-4" />
                      <FilenameCell doc={doc} />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="uppercase">
                      {doc.file_type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{formatBytes(doc.size_bytes)}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{doc.page_count ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{doc.chunk_count ?? '—'}</td>
                  <td className="px-3 py-2">
                    {doc.status === 'failed' && doc.error_message ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <StatusPill status={doc.status} chunkCount={doc.chunk_count} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{doc.error_message}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span key={doc.status} className="inline-block animate-in fade-in zoom-in-95 duration-300">
                        <StatusPill status={doc.status} chunkCount={doc.chunk_count} />
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatAbsoluteDate(doc.effective_date)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(doc.created_at)}</td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(doc)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Delete {doc.original_filename}</span>
                    </Button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b bg-muted/20">
                    <td colSpan={10} className="px-3 py-4">
                      <div className="animate-in fade-in duration-200">
                        <DocumentDetailPanel document={doc} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FilenameCell({ doc }: { doc: DocumentOut }) {
  const name = doc.original_filename
  if (name.length <= 40) return <span className="font-medium">{name}</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-medium">{truncate(name, 40)}</span>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// Mobile cards
// ---------------------------------------------------------------------------

function MobileCards({ documents, expandedId, onToggle, onDelete }: TableProps) {
  return (
    <div className="space-y-3 md:hidden">
      {documents.map((doc) => {
        const isExpanded = expandedId === doc.id
        return (
          <div key={doc.id} className="rounded-md border p-3 transition-colors duration-150 hover:bg-secondary/20">
            <div className="flex items-center gap-2" onClick={() => onToggle(doc.id)} role="button" tabIndex={0}>
              <FileTypeIcon type={getFileExtension(doc.original_filename)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{truncate(doc.original_filename, 40)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(doc.size_bytes)} · {formatDate(doc.created_at)}
                </p>
              </div>
              <span key={doc.status} className="inline-block animate-in fade-in zoom-in-95 duration-300">
                <StatusPill status={doc.status} chunkCount={doc.chunk_count} />
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(doc)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Delete {doc.original_filename}</span>
              </Button>
            </div>
            {doc.status === 'failed' && doc.error_message && (
              <p className="mt-2 text-xs text-severity-critical">{doc.error_message}</p>
            )}
            {isExpanded && (
              <div className="mt-3 animate-in border-t pt-3 fade-in duration-200">
                <DocumentDetailPanel document={doc} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Expanded detail — effective date, embedding model, attempts, chunk table
// ---------------------------------------------------------------------------

function DocumentDetailPanel({ document }: { document: DocumentOut }) {
  const [page, setPage] = useState(1)
  const { data: chunksResponse, isLoading } = useDocumentChunks(document.id, page)

  const totalPages = chunksResponse ? Math.max(1, Math.ceil(chunksResponse.total / chunksResponse.limit)) : 1

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
        <DetailField label="Effective date" value={formatAbsoluteDate(document.effective_date)} />
        <DetailField label="Embedding model" value={document.embedding_model ?? '—'} />
        <DetailField label="Attempts" value={String(document.attempts)} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Chunks</p>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !chunksResponse || chunksResponse.chunks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chunks indexed yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-background">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-1.5">Ordinal</th>
                  <th className="px-2 py-1.5">Page</th>
                  <th className="px-2 py-1.5">Section</th>
                </tr>
              </thead>
              <tbody>
                {chunksResponse.chunks.map((chunk) => (
                  <tr key={chunk.chunk_id} className="border-b last:border-b-0">
                    <td className="px-2 py-1.5 tabular-nums">{chunk.ordinal}</td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {chunk.page_start ? (chunk.page_end && chunk.page_end !== chunk.page_start ? `${chunk.page_start}–${chunk.page_end}` : chunk.page_start) : '—'}
                    </td>
                    <td className="px-2 py-1.5">{chunk.section_path.join(' > ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-2 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3 w-3" /> Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------

function DeleteDialog({ document, onOpenChange }: { document: DocumentOut | null; onOpenChange: (open: boolean) => void }) {
  const deleteMutation = useDeleteDocument()
  const { toast } = useToast()

  async function handleDelete() {
    if (!document) return
    try {
      await deleteMutation.mutateAsync(document.id)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not delete document.'
      toast({ title: 'Delete failed', description: message, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={!!document} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {document?.original_filename}?</DialogTitle>
          <DialogDescription>
            This will remove {document?.chunk_count ?? 0} chunks and any associated contradictions. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className={cn(deleteMutation.isPending && 'opacity-70')}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
