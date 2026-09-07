import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatSection } from '@/lib/utils'
import type { Citation } from '@/api/hooks'

interface CitationPanelProps {
  citation: Citation | null
  onOpenChange: (open: boolean) => void
}

/** Slide-in panel showing a cited chunk's full text and source. Only one is ever open. */
export function CitationPanel({ citation, onOpenChange }: CitationPanelProps) {
  const section = citation ? formatSection(citation.page, citation.section) : ''

  return (
    <Sheet open={!!citation} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {citation && (
          <>
            <SheetHeader>
              <SheetTitle>Source {citation.marker}</SheetTitle>
              <SheetDescription>
                {citation.document_name}
                {section ? ` · ${section}` : ''}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
              {citation.text}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
