import { MarkdownProse } from '@/components/MarkdownProse'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatSection, getFileExtension } from '@/lib/utils'
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
            {/* min-h-0 is load-bearing here: without it a flex-1 child won't actually
                shrink below its content size, and overflow-y-auto never engages. */}
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              {getFileExtension(citation.document_name) === 'md' ? (
                // The source .md file's own markdown syntax (e.g. "**Issued:**")
                // is part of the chunk text verbatim — render it as markdown so
                // it actually renders bold, instead of showing literal asterisks.
                <MarkdownProse
                  content={citation.text}
                  className="rounded-md border bg-muted/30 p-4 text-sm leading-relaxed"
                />
              ) : (
                // pdf/docx/txt extraction isn't authored as markdown — asterisks,
                // underscores, "#" etc. there are just characters in the source
                // text, not formatting syntax, so this stays plain/pre-wrapped.
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
