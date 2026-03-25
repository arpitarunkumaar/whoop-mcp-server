type MetricCardProps = {
  label: string
  value: string | number
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
  return (
    <div className="rounded-lg border border-border bg-surface p-5 backdrop-blur-sm transition-all hover:bg-surface-hover">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">
          {label}
        </span>
        <span className={`rounded-full p-1.5 ${colorClasses[color]}`}>
          {trendIcons[trend]}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-serif text-3xl font-medium text-foreground">
          {value}
        </span>
        {unit && (
          <span className="text-sm text-foreground-muted">{unit}</span>
        )}
      </div>
      <p className="mt-2 text-xs text-foreground-muted">{description}</p>
    </div>
  )
}
