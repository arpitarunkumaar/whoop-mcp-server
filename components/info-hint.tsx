type InfoHintProps = {
  text: string
  widthClassName?: string
}

export function InfoHint({ text, widthClassName = "w-56" }: InfoHintProps) {
  return (
    <span className="group relative inline-flex items-center">
      <button
        type="button"
        aria-label={text}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] font-medium leading-none text-foreground-dim transition-colors hover:border-foreground-dim hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-dim"
      >
        i
      </button>
      <span
        className={`pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 rounded-md border border-border bg-background/95 px-3 py-2 text-[11px] leading-snug text-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${widthClassName}`}
      >
        {text}
      </span>
    </span>
  )
}
