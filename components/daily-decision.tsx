export function DailyDecision() {
  // Sample data - would come from WHOOP API / advancedInsights
  const decisionData = {
    state: "Parasympathetic Dominant",
    action: "Prime for high strain. Push intensity.",
    optimalStrain: "14.0 - 18.0",
    recoveryScore: 82,
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6 backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Daily Optimization Engine</h3>
          <p className="mt-1 text-xs text-foreground-muted">
            Prescriptive strain target based on your current recovery and nervous system state.
          </p>
        </div>
        <span className="rounded-full bg-teal-dim px-3 py-1 text-xs font-semibold tracking-wide text-teal">
          {decisionData.state}
        </span>
      </div>

      <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-t border-border pt-6">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-foreground-dim mb-2">Recommended Action</p>
          <p className="font-serif text-xl font-medium text-foreground">{decisionData.action}</p>
        </div>
        
        <div className="flex items-center gap-8 border-l border-border pl-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-foreground-dim mb-2">Recovery</p>
            <p className="font-serif text-3xl font-medium text-teal">{decisionData.recoveryScore}%</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-foreground-dim mb-2">Target Strain</p>
            <p className="font-serif text-3xl font-medium text-foreground">{decisionData.optimalStrain}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
