import type { DailyDecisionViewModel } from "@/lib/dashboard-view-model"
import { InfoHint } from "./info-hint"

const stateToneClasses: Record<DailyDecisionViewModel["tone"], string> = {
  teal: "bg-teal-dim text-teal",
  blue: "bg-blue-dim text-blue",
  amber: "bg-amber-dim text-amber",
  purple: "bg-purple-dim text-purple",
  rose: "bg-rose-dim text-rose",
}

type DailyDecisionProps = DailyDecisionViewModel

export function DailyDecision({
  state,
  stateDetail,
  action,
  optimalStrain,
  recoveryScore,
  tone,
  correlations,
}: DailyDecisionProps) {
  return (
    <div className="rounded-[1.1rem] border border-border bg-surface p-6 backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Recovery Snapshot</h3>
            <InfoHint
              text="A plain-language summary of the latest WHOOP recovery, overnight sleep need, and current cycle strain."
              widthClassName="w-60"
            />
          </div>
          <p className="mt-1 text-xs text-foreground-muted">{stateDetail}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${stateToneClasses[tone]}`}>
          {state}
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-6 border-t border-border pt-6 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-widest text-foreground-dim">
              Current Context
            </p>
            <InfoHint
              text="This sentence sticks to what WHOOP measured or to simple comparisons such as sleep versus need."
              widthClassName="w-56"
            />
          </div>
          <p className="font-serif text-xl font-medium text-foreground">{action}</p>
        </div>

        <div className="flex items-center gap-8 md:border-l md:border-border md:pl-8">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-foreground-dim">
                Recovery
              </p>
              <InfoHint text="WHOOP recovery score from 0 to 100 based on the latest completed sleep and biomarker inputs." />
            </div>
            <p className="font-serif text-3xl font-medium text-teal">
              {recoveryScore == null ? "—" : `${recoveryScore}%`}
            </p>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-foreground-dim">
                Cycle Strain
              </p>
              <InfoHint text="WHOOP strain for the current physiological cycle. If the cycle is still open, this value can keep rising through the day." widthClassName="w-60" />
            </div>
            <p className="font-serif text-3xl font-medium text-foreground">{optimalStrain}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-foreground-dim">
            Personal Correlations
          </p>
          <InfoHint
            text="Pearson correlations on your paired WHOOP history. These are personal trend signals, not evidence of causation or a clinical relationship."
            widthClassName="w-72"
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {correlations.length > 0 ? (
            correlations.map((correlation) => (
              <div key={correlation.label} className="rounded-[1rem] border border-border bg-background/40 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{correlation.label}</p>
                    <p className="mt-1 text-xs text-foreground-muted">{correlation.description}</p>
                  </div>
                  <span className="font-serif text-lg font-medium text-teal">
                    {correlation.value == null ? "—" : `r=${correlation.value.toFixed(2)}`}
                  </span>
                </div>
                <p className="mt-2 text-[11px] uppercase tracking-wide text-foreground-dim">
                  {correlation.samples} paired days
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-foreground-dim">No paired correlation data yet.</p>
          )}
        </div>
        <p className="mt-3 text-xs text-foreground-muted">
          Correlation is a personal trend signal, not a causal model. The sample size is enough for your own history, not for clinical inference.
        </p>
      </div>
    </div>
  )
}
