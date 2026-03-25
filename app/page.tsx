import { Header } from "@/components/header"
import { DailyDecision } from "@/components/daily-decision"
import { MetabolicEfficiency } from "@/components/metabolic-efficiency"
import { NervousSystemTrends } from "@/components/nervous-system-trends"
import { ReadinessHUD } from "@/components/readiness-hud"
import { SleepArchitecture } from "@/components/sleep-architecture"
import { buildDashboardViewModel, fetchDashboardSnapshot } from "@/lib/dashboard-view-model"

export const dynamic = "force-dynamic"

export default async function Dashboard() {
  const { payload, error } = await fetchDashboardSnapshot()
  const viewModel = buildDashboardViewModel(payload, error)

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-medium text-foreground">Health Dashboard</h1>
          <p className="mt-1 text-foreground-muted">
            Advanced physiological analytics from your WHOOP data
          </p>
          <p className="mt-1 text-xs text-foreground-dim">
            {viewModel.generatedAtLabel === "Waiting for live WHOOP data"
              ? "Live data will appear once the backend responds."
              : `Last synced ${viewModel.generatedAtLabel} UTC`}
          </p>
        </div>

        {viewModel.notice && (
          <div className="mb-6 rounded-[1.1rem] border border-amber-dim bg-amber-dim px-4 py-3 text-sm text-foreground">
            <p className="font-medium">{viewModel.notice.title}</p>
            <p className="mt-1 text-foreground-muted">{viewModel.notice.message}</p>
          </div>
        )}

        {/* Section 1: Readiness HUD */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-foreground-dim">
            Daily Readiness
          </h2>
          <ReadinessHUD cards={viewModel.readinessCards} />
        </section>

        {/* Section 1.5: Recovery Snapshot */}
        <section className="mb-10 mt-6">
          <DailyDecision {...viewModel.dailyDecision} />
        </section>

        {/* Section 2: Recovery Biomarkers */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-foreground-dim">
            Recovery Biomarkers
          </h2>
          <NervousSystemTrends {...viewModel.nervousSystemTrends} />
        </section>

        {/* Section 3: Sleep Architecture */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-foreground-dim">
            Sleep Architecture
          </h2>
          <SleepArchitecture {...viewModel.sleepArchitecture} />
        </section>

        {/* Section 4: Cycle & Training Load */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-foreground-dim">
            Cycle & Training Load
          </h2>
          <MetabolicEfficiency {...viewModel.metabolicEfficiency} />
        </section>
      </div>
    </main>
  )
}
