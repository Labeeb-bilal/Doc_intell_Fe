interface CitationChipProps {
  marker: string
  onClick: () => void
}

/** The small teal [Sn] pill rendered inline in answer prose and in the source strip. */
export function CitationChip({ marker, onClick }: CitationChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-0.5 inline-flex h-4 min-w-4 translate-y-[-1px] items-center justify-center rounded bg-citation-bg px-1 align-middle text-[10px] font-semibold leading-none text-citation transition-colors hover:bg-citation hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {marker}
    </button>
  )
}
