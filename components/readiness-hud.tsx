import { MetricCard } from "./metric-card"
import type { ReadinessCardViewModel } from "@/lib/dashboard-view-model"

type ReadinessHUDProps = {
  cards: ReadinessCardViewModel[]
}

export function ReadinessHUD({ cards }: ReadinessHUDProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <MetricCard
          key={card.label}
          label={card.label}
          value={card.value}
          unit={card.unit}
          trend={card.trend}
          description={card.description}
          color={card.color}
        />
      ))}
    </div>
  )
}
