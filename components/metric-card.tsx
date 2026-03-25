import { InfoHint } from "./info-hint"

export type MetricCardProps = {
  label: string
  value: string | number | null
  unit: string
  trend: "up" | "down" | "stable"
  description: string
  color: "teal" | "blue" | "amber" | "purple" | "rose"
}

const colorClasses = {
  teal: "bg-teal-dim text-teal",
  blue: "bg-blue-dim text-blue",
  amber: "bg-amber-dim text-amber",
  purple: "bg-purple-dim text-purple",
  rose: "bg-rose-dim text-rose",
}

const trendIcons = {
  up: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
  down: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  stable: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
}

export function MetricCard({ label, value, unit, trend, description, color }: MetricCardProps) {
  const displayValue = value ?? "—"

  return (
    <div className="rounded-[1.1rem] border border-border bg-surface p-4 backdrop-blur-sm transition-colors hover:bg-surface-hover">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-[0.67rem] font-medium uppercase tracking-[0.18em] text-foreground-dim">
          <span className="truncate">{label}</span>
          <InfoHint text={description} widthClassName="w-48" />
        </span>
        <span className={`shrink-0 rounded-full p-1.5 ${colorClasses[color]}`}>
          {trendIcons[trend]}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5">
        <span className="min-w-0 break-words font-serif text-[clamp(1.35rem,2vw,1.95rem)] font-medium leading-none tracking-tight text-foreground">
          {displayValue}
        </span>
        {unit && (
          <span className="text-xs text-foreground-muted sm:text-sm">{unit}</span>
        )}
      </div>
      <p className="mt-2 text-[0.78rem] leading-snug text-foreground-muted">{description}</p>
    </div>
  )
}
