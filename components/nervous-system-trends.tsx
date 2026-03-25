import type { NervousSystemTrendsViewModel } from "@/lib/dashboard-view-model"
import { InfoHint } from "./info-hint"

type NervousSystemTrendsProps = NervousSystemTrendsViewModel

function formatValue(value: number | null, digits = 1) {
  return value == null ? "—" : value.toFixed(digits)
}

function TrendIcon({ direction }: { direction: NervousSystemTrendsViewModel["divergenceTrendDirection"] }) {
  if (direction === "down") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    )
  }

  if (direction === "stable") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    )
  }

  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}

export function NervousSystemTrends({
  divergenceSeries,
  divergenceTrendLabel,
  divergenceTrendDirection,
  recoveryScoreAverage,
  fragmentationSeries,
  fragmentationCurrent,
  hrvCoefficientOfVariation,
}: NervousSystemTrendsProps) {
  const maxHRV = Math.max(...divergenceSeries.map((point) => point.hrv ?? 0), 1)
  const maxRHR = Math.max(...divergenceSeries.map((point) => point.rhr ?? 0), 1)
  const fragmentationValues = fragmentationSeries.filter(
    (point): point is { day: string; value: number } => point.value != null,
  )
  const maxFragmentation = Math.max(
    ...fragmentationValues.map((point) => point.value),
    fragmentationCurrent ?? 0,
    2,
  )
  const fragmentationPath =
    fragmentationValues.length > 1
      ? fragmentationValues
          .map((point, index) => {
            const x = (index / (fragmentationValues.length - 1)) * 700
            const normalized = Math.min(point.value / maxFragmentation, 1)
            const y = 84 - normalized * 54
            return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`
          })
          .join(" ")
      : "M 0 60 Q 100 50, 200 55 T 400 45 T 600 35 T 700 40"
  const fragmentationTone =
    fragmentationCurrent != null && fragmentationCurrent > 2 ? "text-amber" : "text-teal"

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* HRV vs RHR Divergence Chart */}
      <div className="rounded-[1.1rem] border border-border bg-surface p-5 backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">HRV & Resting HR</h3>
              <InfoHint text="HRV and resting heart rate are shown as raw WHOOP biomarker trends. The footer compares the latest values with your trailing 30-day mean." widthClassName="w-64" />
            </div>
            <p className="mt-0.5 text-xs text-foreground-muted">Latest 7 scored recoveries</p>
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

        {divergenceSeries.length > 0 && (
          <div className="mb-1 flex justify-between text-[9px]">
            <span className="text-teal">↑ {maxHRV}ms HRV</span>
            <span className="text-rose">↑ {maxRHR}bpm RHR</span>
          </div>
        )}
        <div className="flex h-40 items-end gap-2 overflow-hidden">
          {divergenceSeries.length === 0 ? (
            <p className="self-center text-xs text-foreground-dim">No recovery data yet</p>
          ) : divergenceSeries.map((point) => (
            <div key={point.day} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-end justify-center gap-1">
                <div
                  className="w-3 rounded-full bg-teal transition-all"
                  style={{ height: `${maxHRV > 0 ? ((point.hrv ?? 0) / maxHRV) * 100 : 0}px` }}
                />
                <div
                  className="w-3 rounded-full bg-rose transition-all"
                  style={{ height: `${maxRHR > 0 ? ((point.rhr ?? 0) / maxRHR) * 100 : 0}px` }}
                />
              </div>
              <span className="text-[10px] text-foreground-dim">{point.day}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs text-foreground-muted">Latest vs 30-day mean</span>
            <p
              className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                divergenceTrendDirection === "down" ? "text-amber" : "text-teal"
              }`}
            >
              <TrendIcon direction={divergenceTrendDirection} />
              {divergenceTrendLabel}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-foreground-dim">
                HRV CV 30d
              </span>
              <InfoHint
                text="Coefficient of variation = HRV standard deviation divided by the 30-day mean, shown as a percent. Lower is steadier."
                widthClassName="w-64"
              />
            </div>
            <p className="font-serif text-lg font-medium text-foreground">
              {hrvCoefficientOfVariation == null ? "—" : `${formatValue(hrvCoefficientOfVariation, 1)}%`}
            </p>
            <p className="text-[10px] text-foreground-dim">Lower is steadier</p>
          </div>
        </div>
      </div>

      {/* Recovery Score */}
      <div className="rounded-[1.1rem] border border-border bg-surface p-5 backdrop-blur-sm">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Recovery Score</h3>
            <InfoHint text="WHOOP recovery is the direct 0-100 score returned for each completed recovery record." widthClassName="w-56" />
          </div>
          <p className="mt-0.5 text-xs text-foreground-muted">WHOOP daily recovery (0–100)</p>
        </div>
        <div className="flex gap-1">
          {/* Y-axis with WHOOP recovery zones */}
          <div className="relative h-40 w-8 flex-shrink-0">
            <span className="absolute right-1 text-[9px] leading-none text-foreground-dim" style={{ bottom: "152px" }}>100%</span>
            <span className="absolute right-1 text-[9px] font-medium leading-none text-teal" style={{ bottom: "106px" }}>67%</span>
            <span className="absolute right-1 text-[9px] font-medium leading-none text-amber" style={{ bottom: "59px" }}>34%</span>
            <span className="absolute right-1 text-[9px] leading-none text-foreground-dim" style={{ bottom: "12px" }}>0%</span>
          </div>
          <div className="relative flex h-40 flex-1 items-end justify-between gap-3">
            {/* WHOOP zone threshold lines */}
            <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-teal opacity-30" style={{ bottom: "93.8px" }} />
            <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-rose opacity-30" style={{ bottom: "47.6px" }} />
            {divergenceSeries.length === 0 ? (
              <p className="self-center text-xs text-foreground-dim">No recovery data yet</p>
            ) : (
              divergenceSeries.map((point) => (
                <div key={point.day} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-full bg-gradient-to-t from-blue to-teal transition-all"
                    style={{ height: `${((point.recoveryScore ?? 0) / 100) * 140}px` }}
                  />
                  <span className="text-[10px] text-foreground-dim">{point.day}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">7-day avg</span>
          <span className="font-serif text-lg font-medium text-foreground">
            {recoveryScoreAverage == null ? "—" : `${formatValue(recoveryScoreAverage, 0)}%`}
          </span>
        </div>
      </div>

      {/* Sleep Fragmentation Trend */}
      <div className="rounded-[1.1rem] border border-border bg-surface p-5 backdrop-blur-sm lg:col-span-2">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">Sleep Disturbances / Hour</h3>
              <InfoHint text="This is a bounded transformation: WHOOP disturbance count divided by overnight sleep hours. It is not a separate WHOOP score." widthClassName="w-64" />
            </div>
            <p className="mt-0.5 text-xs text-foreground-muted">
              WHOOP disturbance count divided by overnight sleep duration
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {/* Y-axis */}
          <div className="relative h-24 w-8 flex-shrink-0">
            <span className="absolute right-1 text-[9px] leading-none text-foreground-dim" style={{ top: "26px" }}>
              {maxFragmentation.toFixed(1)}
            </span>
            <span className="absolute right-1 text-[9px] leading-none text-foreground-dim" style={{ top: "80px" }}>0</span>
          </div>
          <div className="relative h-24 flex-1">
            <svg className="h-full w-full" viewBox="0 0 700 96" preserveAspectRatio="none">
              <path
                d={fragmentationPath}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={fragmentationTone}
              />
              {fragmentationValues.map((point, index) => {
                const x = fragmentationValues.length > 1 ? (index / (fragmentationValues.length - 1)) * 700 : 0
                const normalized = Math.min(point.value / maxFragmentation, 1)
                const y = 84 - normalized * 54
                return <circle key={point.day} cx={x} cy={y} r="4" className="fill-amber" />
              })}
            </svg>
          </div>
        </div>
        <div className="mt-3 flex justify-between pl-9 text-[10px] text-foreground-dim">
          <span>7 days ago</span>
          <span>Today</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">Current derived value</span>
          <span className={`font-serif text-lg font-medium ${fragmentationTone}`}>
            {formatValue(fragmentationCurrent, 1)}
          </span>
        </div>
      </div>
    </div>
  )
}
