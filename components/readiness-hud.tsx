import { MetricCard } from "./metric-card"

// Sample data - would come from WHOOP API
const readinessData = {
  autonomicBalance: { value: 1.15, trend: "up", label: "Autonomic Balance Ratio" },
  biometricDeviation: { value: 0.2, trend: "stable", label: "Biometric Deviation" },
  sleepDebt: { value: 1.2, trend: "down", label: "Sleep Debt (hrs)" },
  nervousSystemState: { value: "Parasympathetic", trend: "up", label: "System State" },
}

export function ReadinessHUD() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label={readinessData.autonomicBalance.label}
        value={readinessData.autonomicBalance.value}
        unit=""
        trend={readinessData.autonomicBalance.trend as "up" | "down" | "stable"}
        description="HRV:RHR ratio - higher is better"
        color="teal"
      />
      <MetricCard
        label={readinessData.biometricDeviation.label}
        value={readinessData.biometricDeviation.value}
        unit="σ"
        trend={readinessData.biometricDeviation.trend as "up" | "down" | "stable"}
        description="Normal systemic state"
        color="blue"
      />
      <MetricCard
        label={readinessData.sleepDebt.label}
        value={`+${readinessData.sleepDebt.value}`}
        unit="h"
        trend={readinessData.sleepDebt.trend as "up" | "down" | "stable"}
        description="From recent strain"
        color="amber"
      />
      <MetricCard
        label={readinessData.nervousSystemState.label}
        value={readinessData.nervousSystemState.value}
        unit=""
        trend={readinessData.nervousSystemState.trend as "up" | "down" | "stable"}
        description="Adaptable and recovered"
        color="purple"
      />
    </div>
  )
}
