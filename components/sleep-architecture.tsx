"use client"

const sleepData = {
  totalTime: 7.5,
  efficiency: 92,
  stages: {
    deep: 1.8,
    light: 3.2,
    rem: 1.9,
    awake: 0.6,
  },
  cycles: 5,
  respiratoryRate: 14.2,
}

const stageColors = {
  deep: "bg-deep",
  light: "bg-light",
  rem: "bg-rem",
  awake: "bg-awake",
}

const stageLabels = {
  deep: "Deep (SWS)",
  light: "Light",
  rem: "REM",
  awake: "Awake",
}

export function SleepArchitecture() {
  const totalStageTime = Object.values(sleepData.stages).reduce((a, b) => a + b, 0)
  const restorativeDensity = ((sleepData.stages.deep + sleepData.stages.rem) / sleepData.totalTime * 100).toFixed(0)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Sleep Stage Breakdown */}
      <div className="rounded-lg border border-border bg-surface p-5 backdrop-blur-sm lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Sleep Stage Distribution</h3>
            <p className="mt-0.5 text-xs text-foreground-muted">
              Last night&apos;s architecture
            </p>
          </div>
          <span className="font-serif text-2xl font-medium text-foreground">
            {sleepData.totalTime}h
          </span>
        </div>

        {/* Stage bar */}
        <div className="mb-4 flex h-8 overflow-hidden rounded-lg">
          {Object.entries(sleepData.stages).map(([stage, hours]) => (
            <div
              key={stage}
              className={`${stageColors[stage as keyof typeof stageColors]} transition-all`}
              style={{ width: `${(hours / totalStageTime) * 100}%` }}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(sleepData.stages).map(([stage, hours]) => (
            <div key={stage} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded ${stageColors[stage as keyof typeof stageColors]}`} />
              <div className="flex flex-col">
                <span className="text-xs text-foreground-muted">
                  {stageLabels[stage as keyof typeof stageLabels]}
                </span>
                <span className="text-sm font-medium text-foreground">{hours}h</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">Restorative Density</span>
          <span className="font-serif text-lg font-medium text-teal">{restorativeDensity}%</span>
        </div>
      </div>

      {/* Sleep Metrics Sidebar */}
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-surface p-4 backdrop-blur-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">
            Sleep Efficiency
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-serif text-3xl font-medium text-foreground">
              {sleepData.efficiency}
            </span>
            <span className="text-sm text-foreground-muted">%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-teal"
              style={{ width: `${sleepData.efficiency}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 backdrop-blur-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">
            Sleep Cycles
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-serif text-3xl font-medium text-foreground">
              {sleepData.cycles}
            </span>
            <span className="text-sm text-foreground-muted">cycles</span>
          </div>
          <p className="mt-1 text-xs text-foreground-muted">Optimal: 4-6</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 backdrop-blur-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">
            Respiratory Rate
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-serif text-3xl font-medium text-foreground">
              {sleepData.respiratoryRate}
            </span>
            <span className="text-sm text-foreground-muted">br/min</span>
          </div>
          <p className="mt-1 text-xs text-foreground-muted">Normal range</p>
        </div>
      </div>
    </div>
  )
}
