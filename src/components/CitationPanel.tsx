import { MarkdownProse } from '@/components/MarkdownProse'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatSection, getFileExtension } from '@/lib/utils'
import type { Citation } from '@/api/hooks'

interface CitationPanelProps {
  citation: Citation | null
  onOpenChange: (open: boolean) => void
}

export function CitationPanel({ citation, onOpenChange }: CitationPanelProps) {
  const section = citation ? formatSection(citation.page, citation.section) : ''

  return (
    <Sheet open={!!citation} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col md:max-w-md">
        {citation && (
          <>
            <SheetHeader className="shrink-0">
              <SheetTitle>Source {citation.marker}</SheetTitle>
              <SheetDescription>
                {citation.document_name}
                {section ? ` · ${section}` : ''}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              {getFileExtension(citation.document_name) === 'md' ? (
                <MarkdownProse
                  content={citation.text}
                  className="rounded-md border bg-muted/30 p-4 text-sm leading-relaxed"
                />
              ) : (
                <div className="whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
                  {citation.text}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
