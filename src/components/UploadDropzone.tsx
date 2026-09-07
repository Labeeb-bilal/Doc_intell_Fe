import { useCallback } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_SIZE_BYTES = 25 * 1024 * 1024
const MAX_FILES = 10
const ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/markdown': ['.md'],
  'text/plain': ['.txt'],
}

export interface RejectedFile {
  fileName: string
  reason: string
}

function describeRejection(rejection: FileRejection): RejectedFile {
  const codes = rejection.errors.map((e) => e.code)
  if (codes.includes('too-many-files')) {
    return {
      fileName: rejection.file.name,
      reason: `too many files in one drop — up to ${MAX_FILES} at a time`,
    }
  }
  if (codes.includes('file-too-large')) {
    return { fileName: rejection.file.name, reason: 'is larger than 25MB' }
  }
  if (codes.includes('file-invalid-type')) {
    return { fileName: rejection.file.name, reason: 'is not a supported format' }
  }
  return { fileName: rejection.file.name, reason: rejection.errors[0]?.message ?? 'was rejected' }
}

interface UploadDropzoneProps {
  disabled?: boolean
  onFilesAccepted: (files: File[]) => void
  onFilesRejected: (rejections: RejectedFile[]) => void
}

export function UploadDropzone({ disabled, onFilesAccepted, onFilesRejected }: UploadDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
        onFilesRejected(fileRejections.map(describeRejection))
      }
      if (acceptedFiles.length > 0) {
        onFilesAccepted(acceptedFiles)
      }
    },
    [onFilesAccepted, onFilesRejected],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_SIZE_BYTES,
    maxFiles: MAX_FILES,
    disabled,
    multiple: true,
  })

  return (
    <div
      {...getRootProps({
        role: 'button',
        'aria-disabled': disabled,
        className: cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled && 'cursor-not-allowed opacity-60',
          !disabled && isDragActive && 'border-primary bg-secondary',
          !disabled && !isDragActive && 'border-border hover:bg-secondary/40',
        ),
      })}
    >
      <input {...getInputProps()} />
      <UploadCloud className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      {disabled ? (
        <p className="text-sm font-medium text-muted-foreground">Uploading…</p>
      ) : isDragActive ? (
        <p className="text-sm font-medium">Release to upload</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Drop PDF, DOCX, MD, or TXT files here or{' '}
          <span className="font-medium text-foreground underline underline-offset-2">browse</span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">Up to {MAX_FILES} files, 25MB each</p>
    </div>
  )
}
