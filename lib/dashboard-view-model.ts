import type { MetricCardProps } from "@/components/metric-card"

export type DashboardRecentDay = {
  date: string
  recoveryScore: number | null
  hrv: number | null
  restingHeartRate: number | null
  sleepHours: number | null
  sleepNeedHours: number | null
  sleepDebtHours: number | null
  sleepGapHours: number | null
  sleepPerformance: number | null
  workoutSessions: number
  workoutStrain: number | null
  workoutMinutes: number | null
  skinTempC: number | null
  spo2: number | null
  respiratoryRate: number | null
  cycleStrain: number | null
}

export type DashboardRecoveryEntry = {
  date: string
  recoveryScore: number | null
  hrv: number | null
  restingHeartRate: number | null
  spo2: number | null
  skinTempC: number | null
}

export type DashboardSleepEntry = {
  date: string
  isNap?: boolean
  sleepPerformance: number | null
  sleepEfficiency: number | null
  sleepConsistency: number | null
  actualHours: number | null
  needHours: number | null
  debtHours: number | null
  gapHours: number | null
  respiratoryRate: number | null
  inBedHours: number | null
  awakeHours: number | null
  lightSleepHours: number | null
  slowWaveSleepHours: number | null
  remSleepHours: number | null
  sleepCycleCount: number | null
  disturbanceCount: number | null
}

export type DashboardWorkoutSession = {
  date: string
  durationMinutes: number | null
  strain: number | null
  zoneDurationsMinutes?: {
    zone0?: number | null
    zone1?: number | null
    zone2?: number | null
    zone3?: number | null
    zone4?: number | null
    zone5?: number | null
  }
}

export type DashboardCycleEntry = {
  date: string
  strain: number | null
  kilojoule: number | null
  averageHeartRate: number | null
  maxHeartRate: number | null
}

export type DashboardCorrelation = {
  label: string
  value: number | null
  description: string
  samples: number
}

export type ZoneDistribution = {
  z0: number
  z1z2: number
  z3: number
  z4z5: number
}

export type WeeklyZoneDistribution = ZoneDistribution & {
  label: string
  focusLabel: string
}

type RawSleepRecord = {
  start?: string
  end?: string
  nap?: boolean
  timezone_offset?: string
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number | null
      total_awake_time_milli?: number | null
      total_no_data_time_milli?: number | null
      total_light_sleep_time_milli?: number | null
      total_slow_wave_sleep_time_milli?: number | null
      total_rem_sleep_time_milli?: number | null
      sleep_cycle_count?: number | null
      disturbance_count?: number | null
    }
    sleep_needed?: {
      baseline_milli?: number | null
      need_from_sleep_debt_milli?: number | null
      need_from_recent_strain_milli?: number | null
      need_from_recent_nap_milli?: number | null
    }
    respiratory_rate?: number | null
    sleep_performance_percentage?: number | null
    sleep_consistency_percentage?: number | null
    sleep_efficiency_percentage?: number | null
  }
}

type RawCycleRecord = {
  start?: string
  end?: string | null
  timezone_offset?: string
  score?: {
    strain?: number | null
    kilojoule?: number | null
    average_heart_rate?: number | null
    max_heart_rate?: number | null
  }
}

export type DashboardPayload = {
  generatedAt?: string
  errorState?: { title: string; message: string } | null
  recentDays?: DashboardRecentDay[]
  metrics?: {
    recovery?: {
      average?: number | null
      median?: number | null
      highDays?: number
      lowDays?: number
      averageHrv?: number | null
      averageRestingHeartRate?: number | null
      averageSpo2?: number | null
      averageSkinTempC?: number | null
    }
    sleep?: {
      averagePerformance?: number | null
      averageEfficiency?: number | null
      averageConsistency?: number | null
      averageHours?: number | null
      averageNeedHours?: number | null
      averageDebtHours?: number | null
      averageGapHours?: number | null
      currentDebtHours?: number | null
      averageRespiratoryRate?: number | null
    }
    workouts?: {
      count?: number
      averageDurationMinutes?: number | null
      totalDurationHours?: number | null
      averageStrain?: number | null
      averageHeartRate?: number | null
      averageMaxHeartRate?: number | null
      sports?: Array<[string, number]>
    }
    cycles?: {
      count?: number
      averageStrain?: number | null
      averageKilojoule?: number | null
      averageHeartRate?: number | null
      averageMaxHeartRate?: number | null
    }
    correlations?: DashboardCorrelation[]
  }
  advancedInsights?: {
    nervousSystemState?: string
    dailyDecision?: {
      action?: string
      optimalStrain?: string
    }
    baselines?: {
      hrvMean?: number | null
      hrvStdev?: number | null
      rhrMean?: number | null
      rhrStdev?: number | null
    }
  }
  series?: {
    recovery?: DashboardRecoveryEntry[]
    sleep?: DashboardSleepEntry[]
    workouts?: unknown[]
    workoutSessions?: DashboardWorkoutSession[]
    cycles?: DashboardCycleEntry[]
  }
  rawData?: {
    sleep?: RawSleepRecord[]
    cycles?: RawCycleRecord[]
  }
}

export type ReadinessCardViewModel = {
  label: string
  value: string | number | null
  unit: string
  trend: "up" | "down" | "stable"
  description: string
  color: MetricCardProps["color"]
}

export type DailyDecisionViewModel = {
  state: string
  stateDetail: string
  action: string
  optimalStrain: string
  recoveryScore: number | null
  tone: MetricCardProps["color"]
  correlations: DashboardCorrelation[]
}

export type NervousSystemTrendPoint = {
  day: string
  hrv: number | null
  rhr: number | null
  recoveryScore: number | null
}

export type NervousSystemTrendsViewModel = {
  divergenceSeries: NervousSystemTrendPoint[]
  divergenceTrendLabel: string
  divergenceTrendDirection: "up" | "down" | "stable"
  recoveryScoreAverage: number | null
  fragmentationSeries: Array<{ day: string; value: number | null }>
  fragmentationCurrent: number | null
  hrvCoefficientOfVariation: number | null
}

export type SleepArchitectureViewModel = {
  totalTime: number | null
  efficiency: number | null
  consistency: number | null
  stages: {
    deep: number | null
    light: number | null
    rem: number | null
    awake: number | null
  }
  cycles: number | null
  respiratoryRate: number | null
  restorativeDensity: number | null
  spo2: number | null
  needBreakdown: {
    total: number | null
    baseline: number | null
    debt: number | null
    strain: number | null
    nap: number | null
  }
  gapHours: number | null
  respiratoryRateDelta: number | null
  respiratoryRateBaseline: number | null
  sleepDebtTrendSeries: Array<{ day: string; value: number | null }>
  sleepDebtTrendDirection: "up" | "down" | "stable"
  sleepDebtTrendLabel: string
}

export type MetabolicEfficiencyViewModel = {
  cardioTrend: Array<number | null>
  cardioEfficiency: number | null
  zoneDistribution: {
    z0: number
    z1z2: number
    z3: number
    z4z5: number
  }
  weeklyZoneDistribution: WeeklyZoneDistribution[]
  weeklyZoneShiftLabel: string
  polarizationStatus: string
  polarizationTone: MetricCardProps["color"]
  strainRecovery: Array<{ strain: number; recovery: number }>
  optimalStrain: string
  cycleContextLabel: string
}

export type DashboardViewModel = {
  generatedAtLabel: string
  notice: { title: string; message: string } | null
  readinessCards: ReadinessCardViewModel[]
  dailyDecision: DailyDecisionViewModel
  nervousSystemTrends: NervousSystemTrendsViewModel
  sleepArchitecture: SleepArchitectureViewModel
  metabolicEfficiency: MetabolicEfficiencyViewModel
}

export type DashboardFetchResult = {
  payload: DashboardPayload | null
  error: string | null
}

const DEFAULT_DASHBOARD_API_URL = "http://127.0.0.1:8765/api/dashboard"

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function round(value: number | null | undefined, digits = 1): number | null {
  if (!isFiniteNumber(value)) return null
  return Number(value.toFixed(digits))
}

function average(values: Array<number | null | undefined>, digits = 2): number | null {
  const clean = values.filter(isFiniteNumber)
  if (!clean.length) return null
  return Number((clean.reduce((sum, value) => sum + value, 0) / clean.length).toFixed(digits))
}

function stdDeviation(values: Array<number | null | undefined>, digits = 2): number | null {
  const clean = values.filter(isFiniteNumber)
  if (clean.length < 2) return null
  const meanValue = clean.reduce((sum, value) => sum + value, 0) / clean.length
  const variance =
    clean.reduce((sum, value) => sum + (value - meanValue) ** 2, 0) / (clean.length - 1)
  return Number(Math.sqrt(variance).toFixed(digits))
}

function coefficientOfVariation(values: Array<number | null | undefined>, digits = 1): number | null {
  const clean = values.filter(isFiniteNumber)
  if (clean.length < 2) return null
  const meanValue = clean.reduce((sum, value) => sum + value, 0) / clean.length
  if (!meanValue) return null
  const deviation = stdDeviation(clean, 4)
  if (!isFiniteNumber(deviation)) return null
  return Number(((deviation / meanValue) * 100).toFixed(digits))
}

function last<T>(items: T[]): T | null {
  return items.length ? items[items.length - 1] : null
}

function recentWindow<T>(items: T[], count: number): T[] {
  return items.slice(-count)
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatGeneratedAt(value: string | undefined): string {
  if (!value) return "Waiting for live WHOOP data"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Waiting for live WHOOP data"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date)
}

function formatWeekday(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date)
}

function formatSigned(value: number | null, digits = 1): string {
  if (!isFiniteNumber(value)) return "—"
  const formatted = value.toFixed(digits)
  return value > 0 ? `+${formatted}` : formatted
}

function numberDelta(
  current: number | null | undefined,
  baseline: number | null | undefined,
  digits = 1,
): number | null {
  if (!isFiniteNumber(current) || !isFiniteNumber(baseline)) return null
  return round(current - baseline, digits)
}

function latestRecoveryEntry(entries: DashboardRecoveryEntry[]): DashboardRecoveryEntry | null {
  const valid = entries.filter(
    (entry) =>
      isFiniteNumber(entry.recoveryScore) ||
      isFiniteNumber(entry.hrv) ||
      isFiniteNumber(entry.restingHeartRate),
  )
  return last(valid)
}

function latestNonNapSleep(entries: DashboardSleepEntry[]): DashboardSleepEntry | null {
  const nonNap = entries.filter((entry) => !entry.isNap)
  return last(nonNap.length ? nonNap : entries)
}

function latestNonNapRawSleep(entries: RawSleepRecord[]): RawSleepRecord | null {
  const nonNap = entries.filter((entry) => !entry.nap)
  return last(nonNap.length ? nonNap : entries)
}

function computeDisturbancesPerHour(entry: DashboardSleepEntry | null): number | null {
  if (!entry || !isFiniteNumber(entry.actualHours) || entry.actualHours <= 0) return null
  const disturbances = isFiniteNumber(entry.disturbanceCount) ? entry.disturbanceCount : null
  if (!isFiniteNumber(disturbances)) return null
  return round(disturbances / entry.actualHours, 1)
}

function computeZoneDistribution(
  workoutSessions: DashboardWorkoutSession[],
): { z0: number; z1z2: number; z3: number; z4z5: number } {
  const recentWorkouts = recentWindow(workoutSessions, 14)
  const totals = recentWorkouts.reduce(
    (acc, session) => {
      const zones = session.zoneDurationsMinutes || {}
      acc.z0 += zones.zone0 || 0
      acc.z1z2 += (zones.zone1 || 0) + (zones.zone2 || 0)
      acc.z3 += zones.zone3 || 0
      acc.z4z5 += (zones.zone4 || 0) + (zones.zone5 || 0)
      return acc
    },
    { z0: 0, z1z2: 0, z3: 0, z4z5: 0 },
  )

  const total = totals.z0 + totals.z1z2 + totals.z3 + totals.z4z5
  if (!total) {
    return { z0: 0, z1z2: 0, z3: 0, z4z5: 0 }
  }

  return {
    z0: Math.round((totals.z0 / total) * 100),
    z1z2: Math.round((totals.z1z2 / total) * 100),
    z3: Math.round((totals.z3 / total) * 100),
    z4z5: Math.round((totals.z4z5 / total) * 100),
  }
}

function computeRecoveryLoadPoints(days: DashboardRecentDay[]) {
  return recentWindow(days, 7)
    .map((day) => {
      const strain = isFiniteNumber(day.workoutStrain)
        ? day.workoutStrain
        : isFiniteNumber(day.cycleStrain)
          ? day.cycleStrain
          : null
      if (!isFiniteNumber(day.recoveryScore) || !isFiniteNumber(strain)) {
        return null
      }
      return {
        strain: round(strain, 1) ?? 0,
        recovery: round(day.recoveryScore, 0) ?? 0,
      }
    })
    .filter((point): point is { strain: number; recovery: number } => point !== null)
}

function recoveryBand(score: number | null | undefined): {
  label: string
  detail: string
  tone: MetricCardProps["color"]
} {
  if (!isFiniteNumber(score)) {
    return {
      label: "Unknown",
      detail: "Waiting for WHOOP recovery data",
      tone: "purple",
    }
  }

  if (score >= 67) {
    return {
      label: "Green",
      detail: "WHOOP recovery band",
      tone: "teal",
    }
  }

  if (score >= 34) {
    return {
      label: "Yellow",
      detail: "WHOOP recovery band",
      tone: "amber",
    }
  }

  return {
    label: "Red",
    detail: "WHOOP recovery band",
    tone: "rose",
  }
}

function trendFromDelta(deltaValue: number | null, invert = false): "up" | "down" | "stable" {
  if (!isFiniteNumber(deltaValue) || deltaValue === 0) return "stable"
  if (invert) {
    return deltaValue < 0 ? "up" : "down"
  }
  return deltaValue > 0 ? "up" : "down"
}

function styleFromBand(score: number | null | undefined): MetricCardProps["color"] {
  return recoveryBand(score).tone
}

function recentBaselineDescription(
  label: string,
  current: number | null | undefined,
  baseline: number | null | undefined,
  unit: string,
  digits = 1,
): string {
  if (!isFiniteNumber(current) || !isFiniteNumber(baseline)) {
    return `${label} baseline unavailable`
  }
  return `${label} ${current.toFixed(digits)} ${unit} vs 30-day mean ${baseline.toFixed(digits)} ${unit}`
}

function sleepNeedBreakdown(record: RawSleepRecord | null) {
  const sleepNeeded = record?.score?.sleep_needed
  const baseline = round(
    isFiniteNumber(sleepNeeded?.baseline_milli) ? sleepNeeded.baseline_milli / 3_600_000 : null,
    2,
  )
  const debt = round(
    isFiniteNumber(sleepNeeded?.need_from_sleep_debt_milli)
      ? sleepNeeded.need_from_sleep_debt_milli / 3_600_000
      : null,
    2,
  )
  const strain = round(
    isFiniteNumber(sleepNeeded?.need_from_recent_strain_milli)
      ? sleepNeeded.need_from_recent_strain_milli / 3_600_000
      : null,
    2,
  )
  const nap = round(
    isFiniteNumber(sleepNeeded?.need_from_recent_nap_milli)
      ? sleepNeeded.need_from_recent_nap_milli / 3_600_000
      : null,
    2,
  )

  return {
    baseline,
    debt,
    strain,
    nap,
    total: round(
      [baseline, debt, strain, nap].filter(isFiniteNumber).reduce((sum, value) => sum + value, 0),
      2,
    ),
  }
}

function deepRemShare(entry: DashboardSleepEntry | null): number | null {
  if (!entry) return null
  const deep = entry.slowWaveSleepHours
  const light = entry.lightSleepHours
  const rem = entry.remSleepHours
  if (!isFiniteNumber(deep) || !isFiniteNumber(light) || !isFiniteNumber(rem)) return null
  const asleep = deep + light + rem
  if (asleep <= 0) return null
  return round(((deep + rem) / asleep) * 100, 0)
}

function cycleContextLabel(rawCycle: RawCycleRecord | null, cycleEntry: DashboardCycleEntry | null): string {
  const kilojoule = cycleEntry?.kilojoule
  const averageHeartRate = cycleEntry?.averageHeartRate
  const parts: string[] = []
  parts.push(rawCycle?.end ? "Latest closed cycle" : "Open cycle in progress")
  if (isFiniteNumber(kilojoule)) parts.push(`${kilojoule.toFixed(0)} kJ`)
  if (isFiniteNumber(averageHeartRate)) parts.push(`avg HR ${averageHeartRate}`)
  return parts.join(" • ")
}

function cycleStrainLabel(rawCycle: RawCycleRecord | null, cycleEntry: DashboardCycleEntry | null): string {
  if (!isFiniteNumber(cycleEntry?.strain)) return "—"
  return `${cycleEntry.strain.toFixed(1)}${rawCycle?.end ? "" : " open"}`
}

function zoneDistributionFromSessions(
  workoutSessions: DashboardWorkoutSession[],
): ZoneDistribution {
  const totals = workoutSessions.reduce(
    (acc, session) => {
      const zones = session.zoneDurationsMinutes || {}
      acc.z0 += zones.zone0 || 0
      acc.z1z2 += (zones.zone1 || 0) + (zones.zone2 || 0)
      acc.z3 += zones.zone3 || 0
      acc.z4z5 += (zones.zone4 || 0) + (zones.zone5 || 0)
      return acc
    },
    { z0: 0, z1z2: 0, z3: 0, z4z5: 0 },
  )

  const total = totals.z0 + totals.z1z2 + totals.z3 + totals.z4z5
  if (!total) {
    return { z0: 0, z1z2: 0, z3: 0, z4z5: 0 }
  }

  return {
    z0: Math.round((totals.z0 / total) * 100),
    z1z2: Math.round((totals.z1z2 / total) * 100),
    z3: Math.round((totals.z3 / total) * 100),
    z4z5: Math.round((totals.z4z5 / total) * 100),
  }
}

function computeWeeklyZoneDistribution(
  workoutSessions: DashboardWorkoutSession[],
  latestDate: string | null,
): WeeklyZoneDistribution[] {
  if (!latestDate) return []

  const currentStart = shiftDate(latestDate, -6)
  const previousEnd = shiftDate(currentStart, -1)
  const previousStart = shiftDate(previousEnd, -6)

  const windows = [
    { label: "This week", start: currentStart, end: latestDate },
    { label: "Last week", start: previousStart, end: previousEnd },
  ]

  const distributions = windows.map((window) => {
    const sessions = workoutSessions.filter(
      (session) => session.date >= window.start && session.date <= window.end,
    )
    const distribution = zoneDistributionFromSessions(sessions)
    return {
      label: window.label,
      ...distribution,
      focusLabel: `${distribution.z1z2}% Z1-2`,
    }
  })

  if (!distributions.some((entry) => entry.z0 + entry.z1z2 + entry.z3 + entry.z4z5 > 0)) {
    return []
  }

  return distributions
}

function fallbackViewModel(fetchError: string | null): DashboardViewModel {
  return {
    generatedAtLabel: "Waiting for live WHOOP data",
    notice: fetchError
      ? { title: "Live WHOOP data unavailable", message: fetchError }
      : null,
    readinessCards: [
      {
        label: "Recovery Score",
        value: null,
        unit: "%",
        trend: "stable",
        description: "Latest WHOOP recovery score",
        color: "teal",
      },
      {
        label: "HRV vs 30d",
        value: null,
        unit: "ms",
        trend: "stable",
        description: "Latest HRV relative to your trailing baseline",
        color: "blue",
      },
      {
        label: "RHR vs 30d",
        value: null,
        unit: "bpm",
        trend: "stable",
        description: "Latest resting heart rate relative to your trailing baseline",
        color: "amber",
      },
      {
        label: "SpO₂ vs 30d",
        value: null,
        unit: "pp",
        trend: "stable",
        description: "Latest overnight oxygen saturation relative to baseline",
        color: "blue",
      },
      {
        label: "Skin Temp vs 30d",
        value: null,
        unit: "°C",
        trend: "stable",
        description: "Latest overnight skin temperature relative to baseline",
        color: "rose",
      },
    ],
    dailyDecision: {
      state: "—",
      stateDetail: "WHOOP recovery band",
      action: "Waiting for live WHOOP data.",
      optimalStrain: "—",
      recoveryScore: null,
      tone: "blue",
      correlations: [],
    },
    nervousSystemTrends: {
      divergenceSeries: [],
      divergenceTrendLabel: "Waiting for recovery history",
      divergenceTrendDirection: "stable",
      recoveryScoreAverage: null,
      fragmentationSeries: [],
      fragmentationCurrent: null,
      hrvCoefficientOfVariation: null,
    },
    sleepArchitecture: {
      totalTime: null,
      efficiency: null,
      consistency: null,
      stages: {
        deep: null,
        light: null,
        rem: null,
        awake: null,
      },
      cycles: null,
      respiratoryRate: null,
      restorativeDensity: null,
      spo2: null,
      needBreakdown: {
        total: null,
        baseline: null,
        debt: null,
        strain: null,
        nap: null,
      },
      gapHours: null,
      respiratoryRateDelta: null,
      respiratoryRateBaseline: null,
      sleepDebtTrendSeries: [],
      sleepDebtTrendDirection: "stable",
      sleepDebtTrendLabel: "Waiting for sleep history",
    },
    metabolicEfficiency: {
      cardioTrend: [],
      cardioEfficiency: null,
      zoneDistribution: {
        z0: 0,
        z1z2: 0,
        z3: 0,
        z4z5: 0,
      },
      weeklyZoneDistribution: [],
      weeklyZoneShiftLabel: "Waiting for workout history",
      polarizationStatus: "No workout zones yet",
      polarizationTone: "blue",
      strainRecovery: [],
      optimalStrain: "—",
      cycleContextLabel: "Waiting for cycle data",
    },
  }
}

export async function fetchDashboardSnapshot(refresh = false): Promise<DashboardFetchResult> {
  try {
    const configuredUrl =
      process.env.WHOOP_DASHBOARD_API_URL ||
      process.env.NEXT_PUBLIC_WHOOP_DASHBOARD_API_URL ||
      DEFAULT_DASHBOARD_API_URL

    const url = configuredUrl.startsWith("http://") || configuredUrl.startsWith("https://")
      ? new URL(configuredUrl)
      : new URL(configuredUrl, "http://127.0.0.1:8765")

    if (refresh) {
      url.searchParams.set("refresh", "1")
    }

    const response = await fetch(url.toString(), {
      cache: "no-store",
    })

    const payload = (await response.json()) as DashboardPayload

    if (!response.ok) {
      return {
        payload,
        error: payload?.errorState?.message || `Dashboard API returned HTTP ${response.status}`,
      }
    }

    return {
      payload,
      error: payload?.errorState?.message || null,
    }
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : "Unable to reach the WHOOP dashboard API.",
    }
  }
}

export function buildDashboardViewModel(
  payload: DashboardPayload | null,
  fetchError: string | null = null,
): DashboardViewModel {
  if (!payload) {
    return fallbackViewModel(fetchError)
  }

  const recoveryEntries = payload.series?.recovery ?? []
  const sleepEntries = payload.series?.sleep ?? []
  const workoutSessions = payload.series?.workoutSessions ?? []
  const cycleEntries = payload.series?.cycles ?? []
  const recentDays = payload.recentDays ?? []
  const rawSleepEntries = payload.rawData?.sleep ?? []
  const rawCycleEntries = payload.rawData?.cycles ?? []
  const latestRecentDay = last(recentDays)
  const latestDateKey = latestRecentDay?.date ?? last(recoveryEntries)?.date ?? last(sleepEntries)?.date ?? last(workoutSessions)?.date ?? last(cycleEntries)?.date ?? null
  const nightlySleepEntries = sleepEntries.filter((entry) => !entry.isNap)
  const nonNapSleepEntries = nightlySleepEntries.length ? nightlySleepEntries : sleepEntries

  const latestRecovery = latestRecoveryEntry(recoveryEntries)
  const latestSleep = latestNonNapSleep(sleepEntries)
  const latestRawSleep = latestNonNapRawSleep(rawSleepEntries)
  const latestCycle = last(cycleEntries)
  const latestRawCycle = last(rawCycleEntries)
  const recentRecovery = recentWindow(recoveryEntries, 7)
  const advancedBaselines = payload.advancedInsights?.baselines

  const hrvBaseline = average(recentWindow(recoveryEntries.map((entry) => entry.hrv), 30), 2)
  const rhrBaseline = average(recentWindow(recoveryEntries.map((entry) => entry.restingHeartRate), 30), 2)
  const spo2Baseline = average(recentWindow(recoveryEntries.map((entry) => entry.spo2), 30), 2)
  const skinTempBaseline = average(recentWindow(recoveryEntries.map((entry) => entry.skinTempC), 30), 2)
  const respiratoryRateBaseline = average(recentWindow(nonNapSleepEntries.map((entry) => entry.respiratoryRate), 30), 1)
  const baselineHrvMean = advancedBaselines?.hrvMean
  const baselineHrvStdev = advancedBaselines?.hrvStdev

  const hrvDelta = numberDelta(latestRecovery?.hrv, hrvBaseline, 1)
  const rhrDelta = numberDelta(latestRecovery?.restingHeartRate, rhrBaseline, 1)
  const spo2Delta = numberDelta(latestRecovery?.spo2, spo2Baseline, 1)
  const skinTempDelta = numberDelta(latestRecovery?.skinTempC, skinTempBaseline, 1)
  const hrvCoefficientOfVariation =
    isFiniteNumber(baselineHrvMean) && isFiniteNumber(baselineHrvStdev) && baselineHrvMean !== 0
      ? round((baselineHrvStdev / baselineHrvMean) * 100, 1)
      : coefficientOfVariation(recentWindow(recoveryEntries.map((entry) => entry.hrv), 30), 1)
  const respiratoryRateDelta = numberDelta(latestSleep?.respiratoryRate, respiratoryRateBaseline, 1)

  const recoveryAverage = average(recentRecovery.map((entry) => entry.recoveryScore), 1)
  const band = recoveryBand(latestRecovery?.recoveryScore)
  const currentCycleLabel = cycleStrainLabel(latestRawCycle, latestCycle)
  const currentCycleContextLabel = cycleContextLabel(latestRawCycle, latestCycle)
  const needBreakdown = sleepNeedBreakdown(latestRawSleep)
  const disturbancesPerHourCurrent = computeDisturbancesPerHour(latestSleep)
  const sleepDebtValues = nonNapSleepEntries.map((entry) => entry.debtHours)
  const sleepDebtSeries = recentWindow(nonNapSleepEntries, 7).map((entry) => ({
    day: formatWeekday(entry.date),
    value: entry.debtHours,
  }))
  const sleepDebtRecentAverage = average(recentWindow(sleepDebtValues, 7), 2)
  const sleepDebtPreviousAverage = average(sleepDebtValues.slice(-14, -7), 2)
  const sleepDebtTrendDelta = numberDelta(sleepDebtRecentAverage, sleepDebtPreviousAverage, 2)
  const sleepDebtTrendDirection = trendFromDelta(sleepDebtTrendDelta)
  const sleepDebtTrendLabel =
    sleepDebtTrendDelta == null
      ? "Waiting for enough sleep history"
      : sleepDebtTrendDirection === "down"
        ? `Down ${Math.abs(sleepDebtTrendDelta).toFixed(2)}h vs prior week`
        : sleepDebtTrendDirection === "up"
          ? `Up ${Math.abs(sleepDebtTrendDelta).toFixed(2)}h vs prior week`
          : "Flat vs prior week"

  const divergenceSeries = recentRecovery.map((entry) => ({
    day: formatWeekday(entry.date),
    hrv: entry.hrv,
    rhr: entry.restingHeartRate,
    recoveryScore: round(entry.recoveryScore, 0),
  }))

  const divergenceTrendDirection: "up" | "down" | "stable" =
    isFiniteNumber(hrvDelta) && isFiniteNumber(rhrDelta)
      ? hrvDelta > 0 && rhrDelta < 0
        ? "up"
        : hrvDelta < 0 && rhrDelta > 0
          ? "down"
          : "stable"
      : "stable"
  const weeklyZoneDistribution = computeWeeklyZoneDistribution(workoutSessions, latestDateKey)
  const weeklyZoneShiftLabel =
    weeklyZoneDistribution.length === 2
      ? (() => {
          const current = weeklyZoneDistribution[0]
          const previous = weeklyZoneDistribution[1]
          const deltaValue = current.z1z2 - previous.z1z2
          if (deltaValue === 0) {
            return "Z1-2 share unchanged vs last week"
          }
          return deltaValue > 0
            ? `Z1-2 share up ${Math.abs(deltaValue)} pts vs last week`
            : `Z1-2 share down ${Math.abs(deltaValue)} pts vs last week`
        })()
      : "Waiting for enough workout history"
  const correlations = (payload.metrics?.correlations ?? []).map((item) => ({
    label: item.label,
    value: isFiniteNumber(item.value) ? item.value : null,
    description: item.description ?? "Personal correlation",
    samples: item.samples ?? 0,
  }))

  const readinessCards: ReadinessCardViewModel[] = [
    {
      label: "Recovery Score",
      value: round(latestRecovery?.recoveryScore, 0),
      unit: "%",
      trend:
        isFiniteNumber(latestRecovery?.recoveryScore) && isFiniteNumber(recoveryAverage)
          ? latestRecovery.recoveryScore! >= recoveryAverage!
            ? "up"
            : "down"
          : "stable",
      description: isFiniteNumber(recoveryAverage)
        ? `Latest WHOOP recovery score • 7-day mean ${recoveryAverage}%`
        : "Latest WHOOP recovery score",
      color: styleFromBand(latestRecovery?.recoveryScore),
    },
    {
      label: "HRV vs 30d",
      value: formatSigned(hrvDelta, 1),
      unit: "ms",
      trend: trendFromDelta(hrvDelta),
      description: recentBaselineDescription("HRV", latestRecovery?.hrv, hrvBaseline, "ms", 1),
      color: "teal",
    },
    {
      label: "RHR vs 30d",
      value: formatSigned(rhrDelta, 1),
      unit: "bpm",
      trend: trendFromDelta(rhrDelta, true),
      description: recentBaselineDescription(
        "RHR",
        latestRecovery?.restingHeartRate,
        rhrBaseline,
        "bpm",
        1,
      ),
      color: "amber",
    },
    {
      label: "SpO₂ vs 30d",
      value: formatSigned(spo2Delta, 1),
      unit: "pp",
      trend: trendFromDelta(spo2Delta),
      description: recentBaselineDescription("SpO₂", latestRecovery?.spo2, spo2Baseline, "%", 1),
      color: "blue",
    },
    {
      label: "Skin Temp vs 30d",
      value: formatSigned(skinTempDelta, 1),
      unit: "°C",
      trend: trendFromDelta(skinTempDelta),
      description: recentBaselineDescription(
        "Skin temp",
        latestRecovery?.skinTempC,
        skinTempBaseline,
        "°C",
        1,
      ),
      color: "rose",
    },
  ]

  const summaryParts = [
    isFiniteNumber(latestSleep?.actualHours) && isFiniteNumber(needBreakdown.total)
      ? `${latestSleep.actualHours.toFixed(2)}h asleep against ${needBreakdown.total!.toFixed(2)}h needed`
      : null,
    isFiniteNumber(latestSleep?.gapHours)
      ? `${latestSleep.gapHours > 0 ? "+" : ""}${latestSleep.gapHours.toFixed(2)}h gap`
      : null,
    isFiniteNumber(latestCycle?.strain) ? `current cycle ${currentCycleLabel}` : null,
  ].filter(Boolean)

  return {
    generatedAtLabel: formatGeneratedAt(payload.generatedAt),
    notice:
      payload.errorState ||
      (fetchError ? { title: "Live WHOOP data unavailable", message: fetchError } : null),
    readinessCards,
    dailyDecision: {
      state: band.label,
      stateDetail: band.detail,
      action: summaryParts.length ? summaryParts.join(" • ") : "Waiting for live WHOOP data.",
      optimalStrain: currentCycleLabel,
      recoveryScore: latestRecovery?.recoveryScore ?? null,
      tone: band.tone,
      correlations,
    },
    nervousSystemTrends: {
      divergenceSeries,
      divergenceTrendLabel:
        isFiniteNumber(hrvDelta) && isFiniteNumber(rhrDelta)
          ? `HRV ${formatSigned(hrvDelta, 1)} ms • RHR ${formatSigned(rhrDelta, 1)} bpm vs 30-day mean`
          : "Latest 7 scored recoveries",
      divergenceTrendDirection,
      recoveryScoreAverage: recoveryAverage,
      fragmentationSeries: recentWindow(sleepEntries.filter((entry) => !entry.isNap), 7).map((entry) => ({
        day: formatWeekday(entry.date),
        value: computeDisturbancesPerHour(entry),
      })),
      fragmentationCurrent: disturbancesPerHourCurrent,
      hrvCoefficientOfVariation,
    },
    sleepArchitecture: {
      totalTime: round(
        [latestSleep?.slowWaveSleepHours, latestSleep?.lightSleepHours, latestSleep?.remSleepHours, latestSleep?.awakeHours]
          .filter(isFiniteNumber)
          .reduce((sum, value) => sum + value, 0),
        2,
      ),
      efficiency: latestSleep?.sleepEfficiency ?? null,
      consistency: latestSleep?.sleepConsistency ?? null,
      stages: {
        deep: latestSleep?.slowWaveSleepHours ?? null,
        light: latestSleep?.lightSleepHours ?? null,
        rem: latestSleep?.remSleepHours ?? null,
        awake: latestSleep?.awakeHours ?? null,
      },
      cycles: latestSleep?.sleepCycleCount ?? null,
      respiratoryRate: latestSleep?.respiratoryRate ?? null,
      restorativeDensity: deepRemShare(latestSleep),
      spo2: latestRecovery?.spo2 ?? null,
      needBreakdown,
      gapHours: latestSleep?.gapHours ?? null,
      respiratoryRateDelta,
      respiratoryRateBaseline,
      sleepDebtTrendSeries: sleepDebtSeries,
      sleepDebtTrendDirection,
      sleepDebtTrendLabel,
    },
    metabolicEfficiency: {
      cardioTrend: recentWindow(cycleEntries, 7).map((entry) => round(entry.strain, 1)),
      cardioEfficiency: round(latestCycle?.strain, 1),
      zoneDistribution: computeZoneDistribution(workoutSessions),
      weeklyZoneDistribution,
      weeklyZoneShiftLabel,
      polarizationStatus: workoutSessions.length
        ? `Last ${Math.min(workoutSessions.length, 14)} scored workouts`
        : "No workout zones yet",
      polarizationTone: "blue",
      strainRecovery: computeRecoveryLoadPoints(recentDays),
      optimalStrain: `${computeRecoveryLoadPoints(recentDays).length} matched days`,
      cycleContextLabel: currentCycleContextLabel,
    },
  }
}
