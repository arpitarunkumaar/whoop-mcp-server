import type { SleepArchitectureViewModel } from "@/lib/dashboard-view-model"
import { InfoHint } from "./info-hint"

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

type SleepArchitectureProps = SleepArchitectureViewModel

function formatHours(value: number | null, digits = 1) {
  return value == null ? "—" : `${value.toFixed(digits)}h`
}

function formatSigned(value: number | null, digits = 1) {
  if (value == null) return "—"
  const formatted = value.toFixed(digits)
  return value > 0 ? `+${formatted}` : formatted
}

export function SleepArchitecture({
  totalTime,
  efficiency,
  consistency,
  stages,
  cycles,
  respiratoryRate,
  restorativeDensity,
  spo2,
  needBreakdown,
  gapHours,
  respiratoryRateDelta,
  respiratoryRateBaseline,
  sleepDebtTrendSeries,
  sleepDebtTrendDirection,
  sleepDebtTrendLabel,
}: SleepArchitectureProps) {
  const stageEntries = Object.entries(stages) as Array<[
    keyof SleepArchitectureViewModel["stages"],
    number | null,
  ]>
  const totalStageTime = stageEntries.reduce((sum, [, hours]) => sum + (hours || 0), 0)
  const maxSleepDebt = Math.max(...sleepDebtTrendSeries.map((point) => point.value ?? 0), 1)
  const sleepDebtBarTone = sleepDebtTrendDirection === "up" ? "bg-amber" : "bg-teal"
  const sleepDebtTextTone = sleepDebtTrendDirection === "up" ? "text-amber" : "text-teal"
  const sleepDebtValues = sleepDebtTrendSeries.filter((point) => point.value != null)
  const sleepDebtAverage =
    sleepDebtValues.length > 0
      ? sleepDebtValues.reduce((sum, point) => sum + (point.value ?? 0), 0) / sleepDebtValues.length
      : null

  return (
    <div className="flex flex-col gap-4">
      {/* Sleep Stage Distribution — full width */}
      <div className="rounded-[1.1rem] border border-border bg-surface p-5 backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">Sleep Stage Distribution</h3>
              <InfoHint text="These stage values come directly from WHOOP's overnight stage summary. Awake time is shown alongside deep, light, and REM for context." widthClassName="w-64" />
            </div>
            <p className="mt-0.5 text-xs text-foreground-muted">Last night&apos;s architecture</p>
          </div>
          <span className="font-serif text-2xl font-medium text-foreground">
            {formatHours(totalTime)}
          </span>
        </div>

        {/* Stage bar */}
        <div className="mb-4 flex h-8 overflow-hidden rounded-lg">
          {stageEntries.map(([stage, hours]) => (
            <div
              key={stage}
              className={`${stageColors[stage]} transition-all`}
              style={{ width: `${totalStageTime > 0 ? ((hours || 0) / totalStageTime) * 100 : 0}%` }}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stageEntries.map(([stage, hours]) => (
            <div key={stage} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded ${stageColors[stage]}`} />
              <div className="flex flex-col">
                <span className="text-xs text-foreground-muted">{stageLabels[stage]}</span>
                <span className="text-sm font-medium text-foreground">{formatHours(hours)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">Deep + REM Share</span>
          <span className="font-serif text-lg font-medium text-teal">
            {restorativeDensity == null ? "—" : `${restorativeDensity}%`}
          </span>
        </div>
      </div>

      {/* Sleep Metrics — 5 cards in a horizontal row */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-[1.1rem] border border-border bg-surface p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">
              Sleep Need
            </span>
            <InfoHint text="WHOOP sleep need is the sum of baseline need, debt carryover, recent strain, and nap adjustment from the latest overnight sleep record." widthClassName="w-64" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-serif text-3xl font-medium text-foreground">
              {needBreakdown.total == null ? "—" : needBreakdown.total.toFixed(2)}
            </span>
            <span className="text-sm text-foreground-muted">h</span>
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
            Base {needBreakdown.baseline == null ? "—" : `${needBreakdown.baseline.toFixed(2)}h`}
            {" • "}
            Debt {needBreakdown.debt == null ? "—" : `${needBreakdown.debt.toFixed(2)}h`}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            Strain {needBreakdown.strain == null ? "—" : `${needBreakdown.strain.toFixed(2)}h`}
            {" • "}
            Nap {needBreakdown.nap == null ? "—" : `${needBreakdown.nap.toFixed(2)}h`}
          </p>
        </div>

        <div className="rounded-[1.1rem] border border-border bg-surface p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">
              Sleep Gap
            </span>
            <InfoHint text="This is simply sleep need minus actual overnight sleep. A positive value means you slept less than WHOOP estimated you needed." widthClassName="w-60" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-serif text-3xl font-medium text-foreground">
              {gapHours == null ? "—" : `${gapHours > 0 ? "+" : ""}${gapHours.toFixed(2)}`}
            </span>
            <span className="text-sm text-foreground-muted">h</span>
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
            {cycles == null ? "Sleep cycles unavailable" : `${cycles} sleep cycles recorded`}
          </p>
        </div>

        <div className="rounded-[1.1rem] border border-border bg-surface p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">
              Sleep Efficiency
            </span>
            <InfoHint text="WHOOP sleep efficiency reflects how much of your in-bed time was spent asleep rather than awake." widthClassName="w-56" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-serif text-3xl font-medium text-foreground">
              {efficiency == null ? "—" : efficiency}
            </span>
            <span className="text-sm text-foreground-muted">%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-teal"
              style={{ width: `${efficiency ?? 0}%` }}
            />
          </div>
        </div>

        <div className="rounded-[1.1rem] border border-border bg-surface p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">
              Sleep Consistency
            </span>
            <InfoHint text="WHOOP sleep consistency reflects how closely your sleep timing matched your recent sleep schedule." widthClassName="w-56" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-serif text-3xl font-medium text-foreground">
              {consistency == null ? "—" : consistency}
            </span>
            <span className="text-sm text-foreground-muted">%</span>
          </div>
          <p className="mt-1 text-xs text-foreground-muted">Circadian rhythm adherence</p>
        </div>

        <div className="rounded-[1.1rem] border border-border bg-surface p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">
              Respiratory Rate
            </span>
            <InfoHint text="This is the overnight breathing rate WHOOP recorded for the latest completed sleep." widthClassName="w-52" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-serif text-3xl font-medium text-foreground">
              {respiratoryRate == null ? "—" : respiratoryRate}
            </span>
            <span className="text-sm text-foreground-muted">br/min</span>
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
            {respiratoryRateDelta == null
              ? respiratoryRateBaseline == null
                ? "30-day baseline unavailable"
                : `30-day mean ${respiratoryRateBaseline.toFixed(1)} br/min`
              : `vs 30-day mean ${formatSigned(respiratoryRateDelta, 1)} br/min`}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            {spo2 == null ? "Overnight SpO₂ unavailable" : `Overnight SpO₂ ${spo2.toFixed(1)}%`}
          </p>
        </div>
      </div>

      <div className="rounded-[1.1rem] border border-border bg-surface p-5 backdrop-blur-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">Sleep Debt Trend</h3>
              <InfoHint
                text="WHOOP's sleep debt bucket (need_from_sleep_debt_milli) shown as a 7-night series so you can see whether recovery debt is shrinking or building."
                widthClassName="w-72"
              />
            </div>
            <p className="mt-0.5 text-xs text-foreground-muted">
              Seven-night trajectory of WHOOP sleep debt
            </p>
          </div>
          <span className="font-serif text-2xl font-medium text-foreground">
            {sleepDebtAverage == null ? "—" : `${sleepDebtAverage.toFixed(2)}h`}
          </span>
        </div>

        <div className="flex gap-1">
          <div className="relative h-28 w-8 flex-shrink-0">
            <span className="absolute right-1 text-[9px] leading-none text-foreground-dim" style={{ top: "8px" }}>
              {maxSleepDebt.toFixed(1)}
            </span>
            <span className="absolute right-1 bottom-0 text-[9px] leading-none text-foreground-dim">0</span>
          </div>
          <div className="flex h-28 flex-1 items-end gap-2">
            {sleepDebtTrendSeries.length === 0 ? (
              <p className="self-center text-xs text-foreground-dim">No sleep debt history yet</p>
            ) : (
              sleepDebtTrendSeries.map((point) => (
                <div key={point.day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-24 w-full items-end">
                    <div
                      className={`w-full rounded-t transition-all ${sleepDebtBarTone}`}
                      style={{
                        height: `${maxSleepDebt > 0 ? ((point.value ?? 0) / maxSleepDebt) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-foreground-dim">{point.day}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-3 flex justify-between pl-8 text-[10px] text-foreground-dim">
          <span>7 nights ago</span>
          <span>Tonight</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">7-night trend</span>
          <span className={`font-serif text-lg font-medium ${sleepDebtTextTone}`}>{sleepDebtTrendLabel}</span>
        </div>
      </div>
    </div>
  )
}
