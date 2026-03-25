import { Header } from "@/components/header"
import { ReadinessHUD } from "@/components/readiness-hud"
import { DailyDecision } from "@/components/daily-decision"
import { NervousSystemTrends } from "@/components/nervous-system-trends"
import { MetabolicEfficiency } from "@/components/metabolic-efficiency"
import { SleepArchitecture } from "@/components/sleep-architecture"

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-medium text-foreground">
            Health Dashboard
          </h1>
          <p className="mt-1 text-foreground-muted">
            Advanced physiological analytics from your WHOOP data
          </p>
        </div>

        {/* Section 1: Readiness HUD */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-foreground-dim">
            Daily Readiness
          </h2>
          <ReadinessHUD />
        </section>

        {/* Section 1.5: Daily Decision */}
        <section className="mb-10 mt-6">
          <DailyDecision />
        </section>

        {/* Section 2: Nervous System Trends */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-foreground-dim">
            Nervous System Trends
          </h2>
          <NervousSystemTrends />
        </section>

        {/* Section 3: Sleep Architecture */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-foreground-dim">
            Sleep Architecture
          </h2>
          <SleepArchitecture />
        </section>

        {/* Section 4: Metabolic & Training Efficiency */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-foreground-dim">
            Metabolic & Training Efficiency
          </h2>
          <MetabolicEfficiency />
        </section>
      </div>
    </main>
  )
}
