import type { MetabolicEfficiencyViewModel } from "@/lib/dashboard-view-model"
import { InfoHint } from "./info-hint"

type MetabolicEfficiencyProps = MetabolicEfficiencyViewModel

const toneClasses = {
  teal: "bg-teal-dim text-teal",
  blue: "bg-blue-dim text-blue",
  amber: "bg-amber-dim text-amber",
  purple: "bg-purple-dim text-purple",
  rose: "bg-rose-dim text-rose",
}

function formatValue(value: number | null, digits = 1) {
  return value == null ? "—" : value.toFixed(digits)
}

export function MetabolicEfficiency({
  cardioTrend,
  cardioEfficiency,
  zoneDistribution,
  weeklyZoneDistribution,
  weeklyZoneShiftLabel,
  polarizationStatus,
  polarizationTone,
  strainRecovery,
  optimalStrain,
  cycleContextLabel,
}: MetabolicEfficiencyProps) {
  const maxEfficiency = Math.max(...cardioTrend.map((value) => value ?? 0), 1)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-[1.1rem] border border-border bg-surface p-5 backdrop-blur-sm">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Cycle Strain</h3>
            <InfoHint text="This is the direct WHOOP cycle strain value. If the latest cycle is still open, the current value can continue to rise." widthClassName="w-60" />
          </div>
          <p className="mt-0.5 text-xs text-foreground-muted">Latest 7 physiological cycles</p>
        </div>
        <div className="flex gap-1">
          {/* Y-axis */}
          <div className="relative h-32 w-7 flex-shrink-0">
            <span className="absolute right-1 text-[9px] leading-none text-foreground-dim" style={{ bottom: "98px" }}>{maxEfficiency.toFixed(0)}</span>
            <span className="absolute right-1 text-[9px] leading-none text-foreground-dim" style={{ bottom: "48px" }}>{(maxEfficiency / 2).toFixed(0)}</span>
            <span className="absolute right-1 bottom-0 text-[9px] leading-none text-foreground-dim">0</span>
          </div>
          <div className="flex h-32 flex-1 items-end gap-2">
            {cardioTrend.length === 0 ? (
              <p className="self-center text-xs text-foreground-dim">No cycle data yet</p>
            ) : (
              cardioTrend.map((value, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-teal transition-all hover:bg-teal-light"
                    style={{ height: `${maxEfficiency > 0 ? ((value ?? 0) / maxEfficiency) * 100 : 0}px` }}
                  />
                </div>
              ))
            )}
          </div>
        </div>
        <p className="mt-1 text-right text-[9px] text-foreground-dim">WHOOP strain</p>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">Current / open cycle</span>
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-xl font-medium text-foreground">
              {formatValue(cardioEfficiency, 1)}
            </span>
            <span className="text-xs text-foreground-muted">strain</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-foreground-muted">{cycleContextLabel}</p>
      </div>

      <div className="rounded-[1.1rem] border border-border bg-surface p-5 backdrop-blur-sm">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Recent Zone Distribution</h3>
            <InfoHint text="These percentages summarize WHOOP zone-duration time across recent workouts. They are raw time shares, not a coaching grade." widthClassName="w-64" />
          </div>
          <p className="mt-0.5 text-xs text-foreground-muted">
            Share of recorded time across recent workouts
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-foreground-muted">Below Z1 (sub-threshold)</span>
              <span className="font-medium text-foreground-dim">{zoneDistribution.z0}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-foreground-dim opacity-40"
                style={{ width: `${zoneDistribution.z0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-foreground-muted">Zone 1-2 (Aerobic base)</span>
              <span className="font-medium text-teal">{zoneDistribution.z1z2}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-teal"
                style={{ width: `${zoneDistribution.z1z2}%` }}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-foreground-muted">Zone 3 (Threshold)</span>
              <span className="font-medium text-amber">{zoneDistribution.z3}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-amber"
                style={{ width: `${zoneDistribution.z3}%` }}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-foreground-muted">Zone 4-5 (Anaerobic)</span>
              <span className="font-medium text-rose">{zoneDistribution.z4z5}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-rose"
                style={{ width: `${zoneDistribution.z4z5}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">Window</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses[polarizationTone]}`}>
            {polarizationStatus}
          </span>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">
              Weekly Shift
            </span>
            <span className="text-xs text-foreground-muted">{weeklyZoneShiftLabel}</span>
          </div>

          <div className="space-y-3">
            {weeklyZoneDistribution.length > 0 ? (
              weeklyZoneDistribution.map((window) => (
                <div key={window.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-foreground-muted">{window.label}</span>
                    <span className="font-medium text-foreground-dim">{window.focusLabel}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-border">
                    <div className="flex h-full w-full">
                      <div className="bg-foreground-dim opacity-35" style={{ width: `${window.z0}%` }} />
                      <div className="bg-teal" style={{ width: `${window.z1z2}%` }} />
                      <div className="bg-amber" style={{ width: `${window.z3}%` }} />
                      <div className="bg-rose" style={{ width: `${window.z4z5}%` }} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-foreground-dim">No weekly workout data yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[1.1rem] border border-border bg-surface p-5 backdrop-blur-sm">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Recent Load Context</h3>
            <InfoHint text="This scatter keeps the existing visual, but it only shows recent recorded strain beside recovery. It does not prescribe an optimal target." widthClassName="w-64" />
          </div>
          <p className="mt-0.5 text-xs text-foreground-muted">
            Recent daily recovery paired with recorded strain
          </p>
        </div>

        <div className="flex gap-1">
          {/* Y-axis: Recovery % */}
          <div className="relative h-32 w-7 flex-shrink-0">
            <span className="absolute top-0 right-1 text-[9px] leading-none text-foreground-dim">100</span>
            <span className="absolute right-1 text-[9px] leading-none text-foreground-dim" style={{ top: "calc(50% - 5px)" }}>50</span>
            <span className="absolute bottom-0 right-1 text-[9px] leading-none text-foreground-dim">0</span>
            <span className="absolute left-0 text-[8px] leading-none text-foreground-dim" style={{ top: "calc(50% - 14px)", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Rec%</span>
          </div>
          {/* Chart area */}
          <div className="relative h-32 flex-1">
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="border-b border-r border-border opacity-30" />
              ))}
            </div>

            {strainRecovery.length === 0 ? (
              <p className="absolute inset-0 flex items-center justify-center text-xs text-foreground-dim">
                No data yet
              </p>
            ) : (
              <>
                {strainRecovery.map((point, i) => (
                  <div
                    key={i}
                    className="absolute h-2.5 w-2.5 rounded-full bg-blue transition-all hover:scale-150"
                    style={{
                      left: `${Math.min(100, Math.max(0, (point.strain / 20) * 100))}%`,
                      bottom: `${Math.min(100, Math.max(0, point.recovery))}%`,
                      transform: "translate(-50%, 50%)",
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex justify-between pl-8 text-[10px] text-foreground-dim">
          <span>Low strain</span>
          <span>High strain</span>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-foreground-muted">Matched days</span>
          <span className="font-serif text-lg font-medium text-foreground">{optimalStrain}</span>
        </div>
      </div>
    </div>
  )
}
