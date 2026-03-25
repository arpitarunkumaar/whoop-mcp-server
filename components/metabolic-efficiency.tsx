"use client"

const metabolicData = {
  cardioEfficiency: 142, // kJ per strain unit
  cardioTrend: [128, 132, 138, 135, 140, 145, 142],
  zoneDistribution: {
    z1z2: 78,
    z3: 14,
    z4z5: 8,
  },
  strainRecovery: [
    { strain: 8.2, recovery: 72 },
    { strain: 12.5, recovery: 58 },
    { strain: 6.8, recovery: 85 },
    { strain: 14.2, recovery: 45 },
    { strain: 10.1, recovery: 68 },
    { strain: 9.5, recovery: 74 },
    { strain: 11.8, recovery: 62 },
  ],
}

export function MetabolicEfficiency() {
  const maxEfficiency = Math.max(...metabolicData.cardioTrend)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Cardio-Metabolic Efficiency Trend */}
      <div className="rounded-lg border border-border bg-surface p-5 backdrop-blur-sm">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-foreground">Cardio-Metabolic Efficiency</h3>
          <p className="mt-0.5 text-xs text-foreground-muted">kJ output per strain unit</p>
        </div>
        <div className="flex h-32 items-end gap-2">
          {metabolicData.cardioTrend.map((val, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-teal transition-all hover:bg-teal-light"
                style={{ height: `${(val / maxEfficiency) * 100}px` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">Current</span>
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-xl font-medium text-foreground">
              {metabolicData.cardioEfficiency}
            </span>
            <span className="text-xs text-foreground-muted">kJ/strain</span>
          </div>
        </div>
      </div>

      {/* Intensity Zone Distribution */}
      <div className="rounded-lg border border-border bg-surface p-5 backdrop-blur-sm">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-foreground">Training Polarization</h3>
          <p className="mt-0.5 text-xs text-foreground-muted">Intensity zone distribution</p>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-foreground-muted">Zone 1-2 (Aerobic)</span>
              <span className="font-medium text-teal">{metabolicData.zoneDistribution.z1z2}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-teal"
                style={{ width: `${metabolicData.zoneDistribution.z1z2}%` }}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-foreground-muted">Zone 3 (Threshold)</span>
              <span className="font-medium text-amber">{metabolicData.zoneDistribution.z3}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-amber"
                style={{ width: `${metabolicData.zoneDistribution.z3}%` }}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-foreground-muted">Zone 4-5 (Anaerobic)</span>
              <span className="font-medium text-rose">{metabolicData.zoneDistribution.z4z5}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-rose"
                style={{ width: `${metabolicData.zoneDistribution.z4z5}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">Polarization status</span>
          <span className="rounded-full bg-teal-dim px-2 py-0.5 text-xs font-medium text-teal">
            Well Polarized
          </span>
        </div>
      </div>

      {/* Strain/Recovery Matrix */}
      <div className="rounded-lg border border-border bg-surface p-5 backdrop-blur-sm">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-foreground">Strain vs Recovery</h3>
          <p className="mt-0.5 text-xs text-foreground-muted">Find your sweet spot</p>
        </div>

        <div className="relative h-32">
          {/* Grid background */}
          <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
            {[...Array(16)].map((_, i) => (
              <div key={i} className="border-b border-r border-border opacity-30" />
            ))}
          </div>

          {/* Optimal zone */}
          <div className="absolute bottom-4 right-4 h-16 w-20 rounded bg-teal-dim opacity-40" />

          {/* Data points */}
          {metabolicData.strainRecovery.map((point, i) => (
            <div
              key={i}
              className="absolute h-2.5 w-2.5 rounded-full bg-blue transition-all hover:scale-150"
              style={{
                left: `${(point.strain / 20) * 100}%`,
                bottom: `${point.recovery}%`,
                transform: "translate(-50%, 50%)",
              }}
            />
          ))}
        </div>

        <div className="mt-3 flex justify-between text-[10px] text-foreground-dim">
          <span>Low Strain</span>
          <span>High Strain</span>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">Optimal strain</span>
          <span className="font-serif text-lg font-medium text-foreground">8-11</span>
        </div>
      </div>
    </div>
  )
}
