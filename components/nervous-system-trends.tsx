"use client"

// Sample 7-day data
const trendData = [
  { day: "Mon", hrv: 42, rhr: 52, resilience: 0.78 },
  { day: "Tue", hrv: 48, rhr: 50, resilience: 0.82 },
  { day: "Wed", hrv: 45, rhr: 51, resilience: 0.75 },
  { day: "Thu", hrv: 52, rhr: 49, resilience: 0.88 },
  { day: "Fri", hrv: 38, rhr: 54, resilience: 0.65 },
  { day: "Sat", hrv: 55, rhr: 48, resilience: 0.92 },
  { day: "Sun", hrv: 58, rhr: 47, resilience: 0.95 },
]

const maxHRV = Math.max(...trendData.map((d) => d.hrv))
const maxRHR = Math.max(...trendData.map((d) => d.rhr))

export function NervousSystemTrends() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* HRV vs RHR Divergence Chart */}
      <div className="rounded-lg border border-border bg-surface p-5 backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">HRV vs RHR Divergence</h3>
            <p className="mt-0.5 text-xs text-foreground-muted">
              Parasympathetic vs sympathetic balance
            </p>
          </div>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal" />
              HRV
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose" />
              RHR
            </span>
          </div>
        </div>
        <div className="flex h-40 items-end gap-2">
          {trendData.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="relative flex w-full flex-col items-center gap-1">
                <div
                  className="w-3 rounded-t bg-teal transition-all"
                  style={{ height: `${(d.hrv / maxHRV) * 100}px` }}
                />
                <div
                  className="w-3 rounded-t bg-rose transition-all"
                  style={{ height: `${(d.rhr / maxRHR) * 80}px` }}
                />
              </div>
              <span className="text-[10px] text-foreground-dim">{d.day}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">7-day trend</span>
          <span className="flex items-center gap-1 text-xs font-medium text-teal">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            Diverging (Good)
          </span>
        </div>
      </div>

      {/* Resilience Index */}
      <div className="rounded-lg border border-border bg-surface p-5 backdrop-blur-sm">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-foreground">Resilience Index</h3>
          <p className="mt-0.5 text-xs text-foreground-muted">
            Recovery / Previous day strain ratio
          </p>
        </div>
        <div className="flex h-40 items-end justify-between gap-3">
          {trendData.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-gradient-to-t from-blue to-teal transition-all"
                style={{ height: `${d.resilience * 140}px` }}
              />
              <span className="text-[10px] text-foreground-dim">{d.day}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">7-day rolling avg</span>
          <span className="font-serif text-lg font-medium text-foreground">0.82</span>
        </div>
      </div>

      {/* Sleep Fragmentation Trend */}
      <div className="rounded-lg border border-border bg-surface p-5 backdrop-blur-sm lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Sleep Fragmentation Index</h3>
            <p className="mt-0.5 text-xs text-foreground-muted">
              Disturbances per hour - lower is better
            </p>
          </div>
          <span className="rounded-full bg-teal-dim px-2.5 py-1 text-xs font-medium text-teal">
            Optimal Range: &lt; 2.0
          </span>
        </div>
        <div className="relative h-24">
          {/* Optimal zone background */}
          <div className="absolute inset-x-0 bottom-0 h-12 rounded bg-teal-dim opacity-30" />
          {/* Line chart simulation */}
          <svg className="h-full w-full" viewBox="0 0 700 96" preserveAspectRatio="none">
            <path
              d="M 0 60 Q 100 50, 200 55 T 400 45 T 600 35 T 700 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-amber"
            />
            {[0, 100, 200, 300, 400, 500, 600, 700].map((x, i) => (
              <circle key={i} cx={x} cy={60 - i * 3} r="4" className="fill-amber" />
            ))}
          </svg>
        </div>
        <div className="mt-3 flex justify-between text-[10px] text-foreground-dim">
          <span>7 days ago</span>
          <span>Today</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">Current SFI</span>
          <span className="font-serif text-lg font-medium text-teal">1.4</span>
        </div>
      </div>
    </div>
  )
}
