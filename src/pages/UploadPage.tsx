import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DocumentStatusRow } from '@/components/DocumentStatusRow'
import { UploadDropzone, type RejectedFile } from '@/components/UploadDropzone'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useDocuments, useRetryDocument, useUploadDocuments } from '@/api/hooks'
import { ApiError } from '@/api/client'

interface UploadRow {
  key: string
  file: File
  documentId?: string
  duplicate?: boolean
  dismissed: boolean
}

const isInFlight = (status: string) => status === 'pending' || status === 'processing'

export default function UploadPage() {
  const [rows, setRows] = useState<UploadRow[]>([])
  const [rejections, setRejections] = useState<RejectedFile[]>([])
  const [uploading, setUploading] = useState(false)

  const { toast } = useToast()
  const uploadMutation = useUploadDocuments()
  const retryMutation = useRetryDocument()
  const { data: documents } = useDocuments()

  const visibleRows = rows.filter((r) => !r.dismissed)

  const documentsById = useMemo(() => {
    const map = new Map(documents?.map((d) => [d.id, d]) ?? [])
    return map
  }, [documents])

  async function handleFilesAccepted(files: File[]) {
    setRejections([])
    const newRows: UploadRow[] = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      dismissed: false,
    }))
    setRows((prev) => [...prev, ...newRows])
    setUploading(true)

    for (const row of newRows) {
      try {
        const result = await uploadMutation.mutateAsync(row.file)
        setRows((prev) =>
          prev.map((r) => (r.key === row.key ? { ...r, documentId: result.id, duplicate: result.duplicate } : r)),
        )
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Upload failed. Check your connection and try again.'
        toast({ title: `Could not upload ${row.file.name}`, description: message, variant: 'destructive' })
        setRows((prev) => prev.filter((r) => r.key !== row.key))
      }
    }

    setUploading(false)
  }

  function handleFilesRejected(newRejections: RejectedFile[]) {
    setRejections(newRejections)
  }

  function handleDismiss(rowKey: string) {
    setRows((prev) => prev.map((r) => (r.key === rowKey ? { ...r, dismissed: true } : r)))
  }

  async function handleRetry(documentId: string) {
    try {
      await retryMutation.mutateAsync(documentId)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Retry failed.'
      toast({ title: 'Could not retry document', description: message, variant: 'destructive' })
    }
  }

  const resolvedRows = visibleRows.map((row) => ({
    row,
    document: row.documentId ? documentsById.get(row.documentId) : undefined,
  }))

  const allTerminal =
    resolvedRows.length > 0 &&
    resolvedRows.every(({ row, document }) => row.duplicate || (document && !isInFlight(document.status)))

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Upload documents</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload PDF, DOCX, MD, or TXT files to index them for search and chat.
      </p>

      <div className="mt-6">
        <UploadDropzone
          disabled={uploading}
          onFilesAccepted={handleFilesAccepted}
          onFilesRejected={handleFilesRejected}
        />
      </div>

      {rejections.length > 0 && (
        <div className="mt-3 space-y-1" role="alert">
          {rejections.map((r, i) => (
            <p key={`${r.fileName}-${i}`} className="text-sm text-severity-critical">
              {r.fileName} {r.reason}
            </p>
          ))}
        </div>
      )}

      {resolvedRows.length > 0 && (
        <div className="mt-6 space-y-2">
          {resolvedRows.map(({ row, document }) => (
            <DocumentStatusRow
              key={row.key}
              rowKey={row.key}
              document={document}
              pending={
                row.duplicate
                  ? { filename: row.file.name, sizeBytes: row.file.size, duplicate: true }
                  : !document
                    ? { filename: row.file.name, sizeBytes: row.file.size, duplicate: false }
                    : undefined
              }
              onRetry={handleRetry}
              onDismiss={handleDismiss}
              retrying={retryMutation.isPending && retryMutation.variables === document?.id}
            />
          ))}
        </div>
      )}

      {uploading && resolvedRows.length === 0 && (
        <div className="mt-6 space-y-2">
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {allTerminal && (
        <Link
          to="/chat"
          className="mt-6 flex items-center gap-2 rounded-md bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          Your documents are ready — start asking questions
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}
