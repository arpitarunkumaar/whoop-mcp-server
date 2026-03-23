const state = {
  data: null,
  rangeDays: 90,
  payloadView: "dashboard",
  signalMetric: "recoveryScore",
  loading: false,
};

const PAYLOAD_VIEWS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "profile", label: "Raw Profile" },
  { key: "bodyMeasurements", label: "Raw Body" },
  { key: "recovery", label: "Raw Recovery" },
  { key: "sleep", label: "Raw Sleep" },
  { key: "workouts", label: "Raw Workouts" },
  { key: "cycles", label: "Raw Cycles" },
];

const el = {
  heroTitle: document.getElementById("hero-title"),
  heroMeta: document.getElementById("hero-meta"),
  kpiRow: document.getElementById("kpi-row"),
  recoveryChart: document.getElementById("recovery-chart"),
  recoveryMonths: document.getElementById("recovery-months"),
  sleepTargetChart: document.getElementById("sleep-target-chart"),
  sleepTargetMonths: document.getElementById("sleep-target-months"),
  sleepTargetPill: document.getElementById("sleep-target-pill"),
  attentionList: document.getElementById("attention-list"),
  avgInBed: document.getElementById("avg-in-bed"),
  avgAsleep: document.getElementById("avg-asleep"),
  sleepBarsWrap: document.getElementById("sleep-bars-wrap"),
  sleepDays: document.getElementById("sleep-days"),
  workoutLoadChart: document.getElementById("workout-load-chart"),
  workoutLoadLabels: document.getElementById("workout-load-labels"),
  zoneList: document.getElementById("zone-list"),
  workoutSplitList: document.getElementById("workout-split-list"),
  recordMetrics: document.getElementById("record-metrics"),
  recordCards: document.getElementById("record-cards"),
  correlationList: document.getElementById("correlation-list"),
  signalsSummaryPill: document.getElementById("signals-summary-pill"),
  signalsMetricBar: document.getElementById("signals-metric-bar"),
  signalsChartMeta: document.getElementById("signals-chart-meta"),
  signalsChart: document.getElementById("signals-chart"),
  payloadTabBar: document.getElementById("payload-tab-bar"),
  payloadSummary: document.getElementById("payload-summary"),
  payloadJson: document.getElementById("payload-json"),
  refreshButton: document.getElementById("refresh-button"),
  exportButton: document.getElementById("export-button"),
  overlayBackdrop: document.getElementById("sleep-overlay-backdrop"),
  overlayAvgInBed: document.getElementById("overlay-avg-in-bed"),
  overlayAvgAsleep: document.getElementById("overlay-avg-asleep"),
  overlayNightDate: document.getElementById("overlay-night-date"),
  overlayCompBar: document.getElementById("overlay-composition-bar"),
  overlayCompLegend: document.getElementById("overlay-composition-legend"),
  overlayStageRows: document.getElementById("overlay-stage-rows"),
  overlayFactRows: document.getElementById("overlay-fact-rows"),
  sleepDetailsBtn: document.getElementById("sleep-details-button"),
  collapseBtn: document.getElementById("sleep-collapse-button"),
};

const PALETTE = {
  green: "#00f0c8",
  teal: "#19e0c1",
  blue: "#6ea7ff",
  amber: "#eca126",
  rose: "#f27cab",
  purple: "#a685ff",
  whiteMuted: "rgba(255,255,255,0.22)",
};

const SPARKLINE_COLORS = {
  positive: PALETTE.green,
  warning: PALETTE.rose,
  neutral: PALETTE.blue,
};

const ZONE_COLORS = [
  PALETTE.whiteMuted,
  PALETTE.teal,
  PALETTE.blue,
  PALETTE.amber,
  PALETTE.rose,
  PALETTE.purple,
];

const ZONE_LABELS = [
  "Zone 0",
  "Zone 1",
  "Zone 2",
  "Zone 3",
  "Zone 4",
  "Zone 5",
];

const chartTooltipEl = document.createElement("div");
chartTooltipEl.className = "chart-hover-tooltip";
chartTooltipEl.hidden = true;
document.body.append(chartTooltipEl);

const SIGNAL_METRICS = [
  {
    key: "recoveryScore",
    label: "Recovery",
    description: "Daily recovery score",
    color: PALETTE.green,
    fixedDomain: [0, 100],
    formatter: (value) => fmt(value, 0),
  },
  {
    key: "hrv",
    label: "HRV",
    description: "Heart-rate variability",
    color: PALETTE.blue,
    minFloor: 0,
    formatter: (value) => (isNum(value) ? `${fmt(value, 2)} ms` : "—"),
  },
  {
    key: "sleepHours",
    label: "Sleep Hours",
    description: "Actual overnight sleep",
    color: PALETTE.blue,
    minFloor: 0,
    formatter: (value) => fmtHm(value),
  },
  {
    key: "sleepPerformance",
    label: "Sleep %",
    description: "WHOOP sleep performance",
    color: PALETTE.purple,
    fixedDomain: [0, 100],
    formatter: (value) => fmtPct(value, 0),
  },
  {
    key: "sleepGapHours",
    label: "Sleep Gap",
    description: "Difference between need and actual sleep",
    color: PALETTE.rose,
    minFloor: -1,
    formatter: (value) => fmtHm(value),
  },
  {
    key: "totalWorkoutStrain",
    label: "Workout Strain",
    description: "Total training strain per day",
    color: PALETTE.amber,
    minFloor: 0,
    formatter: (value) => fmt(value, 2),
  },
  {
    key: "workoutMinutes",
    label: "Workout Min",
    description: "Minutes trained",
    color: PALETTE.amber,
    minFloor: 0,
    formatter: (value) => (isNum(value) ? `${fmt(value, 0)} min` : "—"),
  },
  {
    key: "cycleStrain",
    label: "Cycle Strain",
    description: "WHOOP cycle strain",
    color: PALETTE.teal,
    minFloor: 0,
    formatter: (value) => fmt(value, 2),
  },
  {
    key: "restingHeartRate",
    label: "RHR",
    description: "Resting heart rate",
    color: PALETTE.rose,
    minFloor: 0,
    formatter: (value) => (isNum(value) ? `${fmt(value, 0)} bpm` : "—"),
  },
  {
    key: "spo2",
    label: "SpO2",
    description: "Blood oxygen saturation",
    color: PALETTE.teal,
    fixedDomain: [90, 100],
    formatter: (value) => fmtPct(value, 2),
  },
  {
    key: "respiratoryRate",
    label: "Respiratory",
    description: "Respiratory rate during sleep",
    color: PALETTE.purple,
    minFloor: 0,
    formatter: (value) => (isNum(value) ? `${fmt(value, 2)} rpm` : "—"),
  },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isNum(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

function avg(values) {
  const clean = values.filter(isNum);
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function sum(values) {
  return values.filter(isNum).reduce((total, value) => total + value, 0);
}

function fmt(value, digits = 1, fallback = "—") {
  if (!isNum(value)) return fallback;
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function fmtPct(value, digits = 0, fallback = "—") {
  if (!isNum(value)) return fallback;
  return `${fmt(value, digits, fallback)}%`;
}

function fmtHm(hours, fallback = "—") {
  if (!isNum(hours)) return fallback;
  const negative = hours < 0;
  const totalMinutes = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const body = h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
  return negative ? `-${body}` : body;
}

function parseDate(value) {
  if (!value) return null;
  if (value.length === 10) return new Date(`${value}T12:00:00`);
  return new Date(value);
}

function fmtDate(value, fallback = "—") {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtDateTime(value, fallback = "—") {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtShortDate(value) {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtTableDay(value) {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtWeekday(value) {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function fmtClock(value, fallback = "—") {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function emptyState(message = "No data in selected range.") {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function chartTipAttrs(label, accent = "") {
  return `data-chart-tip="${escapeHtml(label)}"${accent ? ` data-chart-accent="${escapeHtml(accent)}"` : ""}`;
}

function hideChartTooltip() {
  chartTooltipEl.hidden = true;
}

function showChartTooltip(event, text, accent) {
  chartTooltipEl.textContent = text;
  if (accent) {
    chartTooltipEl.style.setProperty("--tooltip-accent", accent);
  } else {
    chartTooltipEl.style.removeProperty("--tooltip-accent");
  }
  chartTooltipEl.hidden = false;
  chartTooltipEl.style.left = `${event.clientX + 14}px`;
  chartTooltipEl.style.top = `${event.clientY - 18}px`;
}

function toneFromStatus(status) {
  if (!status) return "neutral";
  const normalized = String(status).toLowerCase();
  if (normalized.includes("valid") || normalized.includes("ok") || normalized.includes("available")) return "positive";
  if (normalized.includes("expired") || normalized.includes("error") || normalized.includes("invalid")) return "warning";
  return "neutral";
}

function filterDatedSeries(series, days, getDate = (row) => row?.date) {
  if (!series?.length) return [];
  const sorted = [...series].sort((a, b) => String(getDate(a) || "").localeCompare(String(getDate(b) || "")));
  const latest = getDate(sorted[sorted.length - 1]);
  if (!latest || !days) return sorted;

  const cutoff = new Date(`${latest}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  return sorted.filter((row) => {
    const rowDate = getDate(row);
    return rowDate && rowDate >= cutoffKey;
  });
}

function filterByRange(series, days) {
  return filterDatedSeries(series, days, (row) => row?.date);
}

function filterSleepByRange(series, days) {
  return filterDatedSeries(
    (series || []).filter((row) => !row?.isNap),
    days,
    (row) => row?.date,
  );
}

function filterSleepAllByRange(series, days) {
  return filterDatedSeries(series || [], days, (row) => row?.date);
}

function filterMonthlyByRange(monthly, latestDate, days) {
  if (!monthly?.length || !latestDate || !days) return monthly || [];
  const cutoff = new Date(`${latestDate}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffMonth = cutoff.toISOString().slice(0, 7);
  return (monthly || []).filter((row) => row?.month >= cutoffMonth);
}

function buildDailyRows(recoverySeries, sleepSeries, workoutSessions, cycleSeries) {
  const recoveryByDate = new Map((recoverySeries || []).map((row) => [row.date, row]));
  const cycleByDate = new Map((cycleSeries || []).map((row) => [row.date, row]));
  const sleepByDate = new Map();
  const workoutByDate = new Map();

  (sleepSeries || []).forEach((row) => {
    if (!row?.date) return;
    const bucket = sleepByDate.get(row.date) || {
      night: null,
      naps: 0,
      napHours: 0,
    };
    if (row.isNap) {
      bucket.naps += 1;
      bucket.napHours += row.actualHours || 0;
    } else {
      bucket.night = row;
    }
    sleepByDate.set(row.date, bucket);
  });

  (workoutSessions || []).forEach((row) => {
    if (!row?.date) return;
    const bucket = workoutByDate.get(row.date) || {
      sessions: 0,
      totalStrain: 0,
      strainCount: 0,
      totalMinutes: 0,
    };
    bucket.sessions += 1;
    if (isNum(row.strain)) {
      bucket.totalStrain += row.strain;
      bucket.strainCount += 1;
    }
    if (isNum(row.durationMinutes)) {
      bucket.totalMinutes += row.durationMinutes;
    }
    workoutByDate.set(row.date, bucket);
  });

  const dates = [...new Set([
    ...recoveryByDate.keys(),
    ...sleepByDate.keys(),
    ...workoutByDate.keys(),
    ...cycleByDate.keys(),
  ])].sort((a, b) => b.localeCompare(a));

  return dates.map((date) => {
    const recovery = recoveryByDate.get(date);
    const sleep = sleepByDate.get(date);
    const workout = workoutByDate.get(date);
    const cycle = cycleByDate.get(date);
    const night = sleep?.night;
    return {
      date,
      recoveryScore: recovery?.recoveryScore ?? null,
      hrv: recovery?.hrv ?? null,
      restingHeartRate: recovery?.restingHeartRate ?? null,
      spo2: recovery?.spo2 ?? null,
      skinTempC: recovery?.skinTempC ?? null,
      sleepPerformance: night?.sleepPerformance ?? null,
      sleepEfficiency: night?.sleepEfficiency ?? null,
      sleepConsistency: night?.sleepConsistency ?? null,
      sleepHours: night?.actualHours ?? null,
      sleepNeedHours: night?.needHours ?? null,
      sleepGapHours: night?.gapHours ?? null,
      sleepDebtHours: night?.debtHours ?? null,
      respiratoryRate: night?.respiratoryRate ?? null,
      naps: sleep?.naps ?? 0,
      napHours: sleep?.napHours ?? 0,
      workoutSessions: workout?.sessions ?? 0,
      workoutMinutes: workout?.totalMinutes ?? 0,
      avgWorkoutStrain: workout?.strainCount ? workout.totalStrain / workout.strainCount : null,
      cycleStrain: cycle?.strain ?? null,
      cycleKilojoule: cycle?.kilojoule ?? null,
    };
  });
}

function averageHeartRate(rows) {
  const values = rows.map((row) => row?.averageHeartRate).filter(isNum);
  return values.length ? avg(values) : null;
}

function maxHeartRate(rows) {
  const values = rows.map((row) => row?.maxHeartRate).filter(isNum);
  return values.length ? Math.max(...values) : null;
}

function buildSignalRows(dailyRows, recentDays, recoverySeries, sleepSeries, workoutSessions, cycleSeries) {
  const dailyByDate = new Map((dailyRows || []).map((row) => [row.date, row]));
  const recentByDate = new Map((recentDays || []).map((row) => [row.date, row]));
  const recoveryByDate = new Map((recoverySeries || []).map((row) => [row.date, row]));
  const cycleByDate = new Map((cycleSeries || []).map((row) => [row.date, row]));
  const sleepByDate = new Map();
  const workoutByDate = new Map();

  (sleepSeries || []).forEach((row) => {
    if (!row?.date) return;
    const bucket = sleepByDate.get(row.date) || {
      night: null,
      records: [],
      naps: 0,
      napHours: 0,
    };
    bucket.records.push(row);
    if (row.isNap) {
      bucket.naps += 1;
      bucket.napHours += row.actualHours || 0;
    } else {
      bucket.night = row;
    }
    sleepByDate.set(row.date, bucket);
  });

  (workoutSessions || []).forEach((row) => {
    if (!row?.date) return;
    const bucket = workoutByDate.get(row.date) || {
      sessions: [],
      totalStrain: 0,
      totalMinutes: 0,
      sports: new Map(),
    };
    bucket.sessions.push(row);
    if (isNum(row.strain)) bucket.totalStrain += row.strain;
    if (isNum(row.durationMinutes)) bucket.totalMinutes += row.durationMinutes;
    if (row.sport) bucket.sports.set(row.sport, (bucket.sports.get(row.sport) || 0) + 1);
    workoutByDate.set(row.date, bucket);
  });

  const dates = [...new Set([
    ...dailyByDate.keys(),
    ...recentByDate.keys(),
    ...recoveryByDate.keys(),
    ...sleepByDate.keys(),
    ...workoutByDate.keys(),
    ...cycleByDate.keys(),
  ])].sort((a, b) => a.localeCompare(b));

  return dates.map((date) => {
    const daily = dailyByDate.get(date) || {};
    const recent = recentByDate.get(date) || {};
    const recovery = recoveryByDate.get(date) || {};
    const sleep = sleepByDate.get(date) || { records: [], naps: 0, napHours: 0, night: null };
    const night = sleep.night || {};
    const workout = workoutByDate.get(date) || { sessions: [], totalStrain: 0, totalMinutes: 0, sports: new Map() };
    const cycle = cycleByDate.get(date) || {};
    const topSport = [...(workout.sports?.entries() || [])].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      date,
      recoveryScore: daily.recoveryScore ?? recent.recoveryScore ?? recovery.recoveryScore ?? null,
      hrv: daily.hrv ?? recent.hrv ?? recovery.hrv ?? null,
      restingHeartRate: daily.restingHeartRate ?? recent.restingHeartRate ?? recovery.restingHeartRate ?? null,
      spo2: daily.spo2 ?? recent.spo2 ?? recovery.spo2 ?? null,
      skinTempC: daily.skinTempC ?? recent.skinTempC ?? recovery.skinTempC ?? null,
      sleepPerformance: daily.sleepPerformance ?? recent.sleepPerformance ?? night.sleepPerformance ?? null,
      sleepEfficiency: daily.sleepEfficiency ?? night.sleepEfficiency ?? null,
      sleepConsistency: daily.sleepConsistency ?? night.sleepConsistency ?? null,
      sleepHours: daily.sleepHours ?? recent.sleepHours ?? night.actualHours ?? null,
      sleepNeedHours: daily.sleepNeedHours ?? recent.sleepNeedHours ?? night.needHours ?? null,
      sleepGapHours: daily.sleepGapHours ?? recent.sleepGapHours ?? night.gapHours ?? null,
      sleepDebtHours: daily.sleepDebtHours ?? recent.sleepDebtHours ?? night.debtHours ?? null,
      respiratoryRate: daily.respiratoryRate ?? recent.respiratoryRate ?? night.respiratoryRate ?? null,
      inBedHours: night.inBedHours ?? null,
      awakeHours: night.awakeHours ?? null,
      lightSleepHours: night.lightSleepHours ?? null,
      slowWaveSleepHours: night.slowWaveSleepHours ?? null,
      remSleepHours: night.remSleepHours ?? null,
      sleepCycleCount: night.sleepCycleCount ?? null,
      disturbanceCount: night.disturbanceCount ?? null,
      naps: daily.naps ?? sleep.naps ?? 0,
      napHours: daily.napHours ?? sleep.napHours ?? 0,
      workoutSessions: daily.workoutSessions ?? recent.workoutSessions ?? workout.sessions.length,
      workoutMinutes: daily.workoutMinutes ?? recent.workoutMinutes ?? roundValue(workout.totalMinutes, 2),
      totalWorkoutStrain: recent.workoutStrain ?? roundValue(workout.totalStrain, 2),
      avgWorkoutStrain: daily.avgWorkoutStrain ?? (workout.sessions.length ? roundValue(workout.totalStrain / workout.sessions.length, 2) : null),
      averageWorkoutHeartRate: averageHeartRate(workout.sessions),
      maxWorkoutHeartRate: maxHeartRate(workout.sessions),
      topSport,
      cycleStrain: daily.cycleStrain ?? recent.cycleStrain ?? cycle.strain ?? null,
      cycleKilojoule: daily.cycleKilojoule ?? cycle.kilojoule ?? null,
      cycleAverageHeartRate: cycle.averageHeartRate ?? null,
      cycleMaxHeartRate: cycle.maxHeartRate ?? null,
      sleepRecordCount: sleep.records.length,
      workoutRecordCount: workout.sessions.length,
      hasRecovery: Boolean(recoveryByDate.get(date)),
      hasSleep: sleep.records.length > 0,
      hasWorkouts: workout.sessions.length > 0,
      hasCycle: Boolean(cycleByDate.get(date)),
    };
  });
}

function roundValue(value, digits = 2) {
  if (!isNum(value)) return null;
  return Number(value.toFixed(digits));
}

function signalMetricConfig(rows) {
  const available = SIGNAL_METRICS.filter((metric) => rows.some((row) => isNum(row?.[metric.key])));
  if (!available.length) return [];
  if (!available.some((metric) => metric.key === state.signalMetric)) {
    state.signalMetric = available[0].key;
  }
  return available;
}

function metricDomain(rows, metric) {
  const values = rows.map((row) => row?.[metric.key]).filter(isNum);
  if (!values.length) return [0, 1];
  if (metric.fixedDomain) return metric.fixedDomain;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (isNum(metric.minFloor)) min = Math.min(min, metric.minFloor);
  const span = max - min || Math.max(Math.abs(max) * 0.18, 1);
  const pad = span * 0.12;
  return [min - pad, max + pad];
}

function signalAxisLabels(rows, width, height, pad) {
  if (!rows.length) return "";
  const checkpoints = [...new Set([
    0,
    Math.floor((rows.length - 1) * 0.33),
    Math.floor((rows.length - 1) * 0.66),
    rows.length - 1,
  ])];
  return checkpoints.map((index) => {
    const x = pad.left + (index / Math.max(rows.length - 1, 1)) * (width - pad.left - pad.right);
    return `<text x="${x.toFixed(1)}" y="${(height - 10).toFixed(1)}" text-anchor="middle" font-size="11" fill="rgba(176,192,221,0.54)">${escapeHtml(fmtShortDate(rows[index]?.date))}</text>`;
  }).join("");
}

function signalYGrid(width, height, pad, domainMin, domainMax) {
  const steps = 4;
  const range = domainMax - domainMin || 1;
  return Array.from({ length: steps + 1 }, (_, index) => {
    const ratio = index / steps;
    const y = pad.top + ratio * (height - pad.top - pad.bottom);
    const value = domainMax - ratio * range;
    return `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4 5"></line>
      <text x="${(pad.left - 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="rgba(176,192,221,0.4)">${escapeHtml(fmt(value, value > 10 ? 0 : 1))}</text>`;
  }).join("");
}

function signalPath(rows, metric, xPos, yPos) {
  let path = "";
  rows.forEach((row, index) => {
    const value = row?.[metric.key];
    if (!isNum(value)) return;
    const prefix = path ? "L" : "M";
    path += `${prefix} ${xPos(index).toFixed(1)} ${yPos(value).toFixed(1)} `;
  });
  return path.trim();
}

function signalMetaChip(label, value, tone = "neutral") {
  return `<div class="signals-meta-chip tone-${escapeHtml(tone)}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>`;
}

function renderSignalsExplorer(data, signalRows, sleepAllSeries, workoutSessions) {
  if (!signalRows.length) {
    el.signalsSummaryPill.textContent = "No daily rows";
    el.signalsMetricBar.innerHTML = "";
    el.signalsChartMeta.innerHTML = "";
    el.signalsChart.innerHTML = emptyState("No combined daily data in the selected range.");
    return;
  }

  const availableMetrics = signalMetricConfig(signalRows);
  if (!availableMetrics.length) {
    el.signalsSummaryPill.textContent = `${signalRows.length} captured days`;
    el.signalsMetricBar.innerHTML = "";
    el.signalsChartMeta.innerHTML = "";
    el.signalsChart.innerHTML = emptyState("The selected range has dates but no numeric WHOOP metrics to graph.");
    return;
  }
  const metric = availableMetrics.find((item) => item.key === state.signalMetric) || availableMetrics[0];
  const selectedRow = signalRows[signalRows.length - 1];
  const metricValues = signalRows.map((row) => row[metric.key]).filter(isNum);
  const latestValue = signalRows[signalRows.length - 1]?.[metric.key];
  const bestRow = [...signalRows].filter((row) => isNum(row[metric.key])).sort((a, b) => b[metric.key] - a[metric.key])[0];

  el.signalsSummaryPill.textContent = `${signalRows.length} captured days · ${availableMetrics.length} switchable metrics`;
  el.signalsMetricBar.innerHTML = availableMetrics.map((item) => `
    <button class="signals-chip ${item.key === metric.key ? "is-active" : ""}" type="button" data-signal-metric="${escapeHtml(item.key)}" style="--signal-accent:${item.color}">
      <span>${escapeHtml(item.label)}</span>
      <small>${escapeHtml(item.description)}</small>
    </button>
  `).join("");

  el.signalsChartMeta.innerHTML = [
    signalMetaChip("Metric", metric.label, "neutral"),
    signalMetaChip("Range Avg", metric.formatter(avg(metricValues)), "positive"),
    signalMetaChip("Latest", metric.formatter(latestValue), "neutral"),
    signalMetaChip("Peak", bestRow ? `${metric.formatter(bestRow[metric.key])} · ${fmtShortDate(bestRow.date)}` : "—", "warning"),
  ].join("");

  const width = 1080;
  const height = 360;
  const pad = { top: 20, right: 22, bottom: 52, left: 56 };
  const [domainMin, domainMax] = metricDomain(signalRows, metric);
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const xPos = (index) => pad.left + (index / Math.max(signalRows.length - 1, 1)) * innerWidth;
  const yPos = (value) => pad.top + (1 - (value - domainMin) / Math.max(domainMax - domainMin, 1)) * innerHeight;
  const path = signalPath(signalRows, metric, xPos, yPos);
  const selectedIndex = signalRows.findIndex((row) => row.date === selectedRow?.date);
  const selectedValue = selectedRow?.[metric.key];

  let areaPath = "";
  if (path) {
    const lastValidIndex = [...signalRows.keys()].reverse().find((index) => isNum(signalRows[index]?.[metric.key]));
    const firstValidIndex = signalRows.findIndex((row) => isNum(row?.[metric.key]));
    if (firstValidIndex >= 0 && lastValidIndex >= 0) {
      areaPath = `${path} L ${xPos(lastValidIndex).toFixed(1)} ${(height - pad.bottom).toFixed(1)} L ${xPos(firstValidIndex).toFixed(1)} ${(height - pad.bottom).toFixed(1)} Z`;
    }
  }

  el.signalsChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(`${metric.label} timeline`)}">
    <defs>
      <linearGradient id="signals-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${metric.color}" stop-opacity="0.26"></stop>
        <stop offset="100%" stop-color="${metric.color}" stop-opacity="0"></stop>
      </linearGradient>
    </defs>
    ${signalYGrid(width, height, pad, domainMin, domainMax)}
    ${areaPath ? `<path d="${areaPath}" fill="url(#signals-fill)"></path>` : ""}
    ${selectedIndex >= 0 ? `<line x1="${xPos(selectedIndex).toFixed(1)}" y1="${pad.top}" x2="${xPos(selectedIndex).toFixed(1)}" y2="${height - pad.bottom + 2}" stroke="rgba(255,255,255,0.16)" stroke-dasharray="5 5"></line>` : ""}
    ${path ? `<path d="${path}" fill="none" stroke="${metric.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>` : ""}
    ${signalRows.map((row, index) => {
      const value = row?.[metric.key];
      const x = xPos(index);
      const y = isNum(value) ? yPos(value) : height - pad.bottom + 8;
      return `
        ${isNum(value) ? `<g class="signal-point ${row.date === selectedRow?.date ? "is-selected" : ""}">
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${row.date === selectedRow?.date ? 6 : 4}" fill="${metric.color}" stroke="rgba(8,17,31,0.95)" stroke-width="${row.date === selectedRow?.date ? 3 : 2}" ${chartTipAttrs(`${fmtTableDay(row.date)} · ${metric.formatter(value)}`, metric.color)}></circle>
        </g>` : ""}
      `;
    }).join("")}
    ${selectedIndex >= 0 && isNum(selectedValue) ? `<g>
      <rect x="${(xPos(selectedIndex) - 64).toFixed(1)}" y="${Math.max(yPos(selectedValue) - 40, pad.top + 4).toFixed(1)}" width="128" height="28" rx="14" fill="rgba(6,16,29,0.92)" stroke="${metric.color}" stroke-opacity="0.32"></rect>
      <text x="${xPos(selectedIndex).toFixed(1)}" y="${Math.max(yPos(selectedValue) - 21, pad.top + 22).toFixed(1)}" text-anchor="middle" font-size="11" fill="#f7fbff">${escapeHtml(`${fmtShortDate(selectedRow.date)} · ${metric.formatter(selectedValue)}`)}</text>
    </g>` : ""}
    ${signalAxisLabels(signalRows, width, height, pad)}
  </svg>`;
}

function sparklineSvg(values, tone) {
  const clean = values.filter(isNum);
  if (clean.length < 2) return "";
  const color = SPARKLINE_COLORS[tone] || SPARKLINE_COLORS.neutral;
  const width = 200;
  const height = 44;
  const pad = 4;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const points = clean.map((value, index) => {
    const x = pad + (index / (clean.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastPoint = points.split(" ").at(-1) || `${width - pad},${height - pad}`;
  const area = `${points.split(" ")[0].split(",")[0]},${height - pad} ${points} ${lastPoint.split(",")[0]},${height - pad}`;
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" style="width:100%;height:40px;">
    <defs>
      <linearGradient id="sg-${tone}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.25"></stop>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"></stop>
      </linearGradient>
    </defs>
    <polygon points="${area}" fill="url(#sg-${tone})"></polygon>
    <polyline fill="none" stroke="${color}" stroke-width="2.5" points="${points}" stroke-linecap="round" stroke-linejoin="round"></polyline>
  </svg>`;
}

function makeGrid(width, height, pad, count, min, max) {
  const range = max - min || 1;
  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    const y = pad.top + ratio * (height - pad.top - pad.bottom);
    const label = (max - ratio * range).toFixed(0);
    return `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.07)" stroke-dasharray="4 4"></line>
      <text x="${(pad.left - 6).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="rgba(255,255,255,0.35)">${label}</text>`;
  }).join("");
}

function monthAxisLabels(series, width, height, pad) {
  if (!series.length) return "";
  const innerWidth = width - pad.left - pad.right;
  const indices = [...new Set([0, Math.floor(series.length / 2), series.length - 1])];
  return indices.map((index) => {
    const x = pad.left + (index / Math.max(series.length - 1, 1)) * innerWidth;
    return `<text x="${x.toFixed(1)}" y="${(height - 6).toFixed(1)}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.35)">${escapeHtml(fmtShortDate(series[index]?.date))}</text>`;
  }).join("");
}

function monthRangeFooter(series) {
  if (!series.length) return "";
  return `<span>${escapeHtml(fmtShortDate(series[0]?.date))}</span><span>${escapeHtml(fmtShortDate(series[series.length - 1]?.date))}</span>`;
}

function renderHero(data) {
  if (data?.errorState) {
    el.heroTitle.textContent = data.errorState.title || "Could not load WHOOP data";
    el.heroMeta.textContent = data.errorState.message || "The WHOOP dashboard payload is unavailable.";
    return;
  }

  const firstName = data?.profile?.firstName || "Your";
  const range = data?.dateRange || {};
  const sourceCount = Object.values(data?.sources || {}).filter((source) => source?.available).length;
  const totalSources = Object.keys(data?.sources || {}).length;

  el.heroTitle.textContent = `${firstName}'s health picture`;
  el.heroMeta.textContent = `${fmtDate(range.start)} – ${fmtDate(range.end)} · ${range.days || 0} days captured · Synced ${fmtDateTime(data.generatedAt)} · ${sourceCount}/${totalSources} sources live`;
}

function renderKpi(cards) {
  if (!cards?.length) {
    el.kpiRow.innerHTML = emptyState("No summary cards available.");
    return;
  }

  el.kpiRow.innerHTML = cards.map((card, index) => {
    const value = fmt(card.value, card.deltaDigits ?? 1);
    const delta = isNum(card.delta) ? card.delta : null;
    const deltaSign = card.deltaFormat === "signed" && delta !== null && delta > 0 ? "+" : "";
    const deltaText = delta === null
      ? card.deltaLabel || ""
      : `${deltaSign}${fmt(delta, card.deltaDigits ?? 1)}${card.deltaSuffix || ""} ${card.deltaLabel || ""}`.trim();
    return `<article class="glass-panel kpi-card tone-${escapeHtml(card.tone || "neutral")} kpi-card-${escapeHtml(card.id || "generic")}" style="animation-delay:${index * 60}ms">
      <p class="kpi-title">${escapeHtml(card.title)}</p>
      <div class="kpi-value-row">
        <span class="kpi-value">${escapeHtml(value)}</span>
        ${card.suffix ? `<span class="kpi-suffix">${escapeHtml(card.suffix)}</span>` : ""}
      </div>
      <p class="kpi-delta">${escapeHtml(deltaText || "Current dashboard summary")}</p>
      <p class="kpi-detail">${escapeHtml(card.detail || "")}</p>
      <div class="kpi-sparkline">${sparklineSvg(card.sparkline || [], card.tone || "neutral")}</div>
    </article>`;
  }).join("");
}

function renderRecoveryChart(series) {
  if (!series.length) {
    el.recoveryChart.innerHTML = emptyState();
    el.recoveryMonths.innerHTML = "";
    return;
  }

  const width = 700;
  const height = 200;
  const pad = { top: 18, right: 16, bottom: 24, left: 36 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const recoveryValues = series.map((row) => row.recoveryScore).filter(isNum);
  const hrvValues = series.map((row) => row.hrv).filter(isNum);

  if (!recoveryValues.length) {
    el.recoveryChart.innerHTML = emptyState("No recovery values in range.");
    el.recoveryMonths.innerHTML = "";
    return;
  }

  const recoveryMin = 0;
  const recoveryMax = 100;
  const hrvMin = Math.min(...hrvValues, 0);
  const hrvMax = Math.max(...hrvValues, 1);

  function xPos(index) {
    return pad.left + (index / Math.max(series.length - 1, 1)) * innerWidth;
  }

  function yRecovery(value) {
    return pad.top + (1 - (value - recoveryMin) / (recoveryMax - recoveryMin)) * innerHeight;
  }

  function yHrv(value) {
    return pad.top + (1 - (value - hrvMin) / Math.max(hrvMax - hrvMin, 1)) * innerHeight;
  }

  const recoveryPoints = series.map((row, index) => (
    isNum(row.recoveryScore) ? `${xPos(index).toFixed(1)},${yRecovery(row.recoveryScore).toFixed(1)}` : null
  )).filter(Boolean);
  const hrvPoints = series.map((row, index) => (
    isNum(row.hrv) ? `${xPos(index).toFixed(1)},${yHrv(row.hrv).toFixed(1)}` : null
  )).filter(Boolean);
  const recoveryPath = series.map((row, index) => {
    if (!isNum(row.recoveryScore)) return null;
    return `${index === 0 ? "M" : "L"} ${xPos(index).toFixed(1)} ${yRecovery(row.recoveryScore).toFixed(1)}`;
  }).filter(Boolean).join(" ");
  const areaFill = `${recoveryPath} L ${xPos(series.length - 1).toFixed(1)} ${(height - pad.bottom).toFixed(1)} L ${pad.left.toFixed(1)} ${(height - pad.bottom).toFixed(1)} Z`;

  el.recoveryChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="recovery-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${PALETTE.green}" stop-opacity="0.22"></stop>
        <stop offset="100%" stop-color="${PALETTE.green}" stop-opacity="0"></stop>
      </linearGradient>
    </defs>
    ${makeGrid(width, height, pad, 5, 0, 100)}
    <path d="${areaFill}" fill="url(#recovery-gradient)"></path>
    <polyline fill="none" stroke="${PALETTE.green}" stroke-width="2.5" points="${recoveryPoints.join(" ")}" stroke-linecap="round" stroke-linejoin="round"></polyline>
    <polyline fill="none" stroke="${PALETTE.blue}" stroke-width="1.8" stroke-dasharray="5 3" points="${hrvPoints.join(" ")}" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${series.map((row, index) => isNum(row.recoveryScore)
      ? `<circle cx="${xPos(index).toFixed(1)}" cy="${yRecovery(row.recoveryScore).toFixed(1)}" r="5" fill="${PALETTE.green}" stroke="rgba(8,17,31,0.95)" stroke-width="2" ${chartTipAttrs(`${fmtTableDay(row.date)} · Recovery ${fmt(row.recoveryScore, 0)}`, PALETTE.green)}></circle>`
      : "").join("")}
    ${series.map((row, index) => isNum(row.hrv)
      ? `<circle cx="${xPos(index).toFixed(1)}" cy="${yHrv(row.hrv).toFixed(1)}" r="4" fill="${PALETTE.blue}" stroke="rgba(8,17,31,0.95)" stroke-width="2" ${chartTipAttrs(`${fmtTableDay(row.date)} · HRV ${fmt(row.hrv, 2)} ms`, PALETTE.blue)}></circle>`
      : "").join("")}
    ${monthAxisLabels(series, width, height, pad)}
  </svg>`;
  el.recoveryMonths.innerHTML = monthRangeFooter(series);
}

function renderSleepTargetChart(series) {
  if (!series.length) {
    el.sleepTargetChart.innerHTML = emptyState();
    el.sleepTargetMonths.innerHTML = "";
    el.sleepTargetPill.textContent = "Range avg: —";
    return;
  }

  const width = 700;
  const height = 180;
  const pad = { top: 16, right: 16, bottom: 24, left: 36 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const values = series.flatMap((row) => [row.actualHours, row.needHours]).filter(isNum);

  if (!values.length) {
    el.sleepTargetChart.innerHTML = emptyState("No sleep values in range.");
    el.sleepTargetMonths.innerHTML = "";
    el.sleepTargetPill.textContent = "Range avg: —";
    return;
  }

  const maxHours = Math.max(...values) * 1.08;

  function xPos(index) {
    return pad.left + (index / Math.max(series.length - 1, 1)) * innerWidth;
  }

  function yVal(value) {
    return pad.top + (1 - value / maxHours) * innerHeight;
  }

  const needPoints = series.map((row, index) => (
    isNum(row.needHours) ? `${xPos(index).toFixed(1)},${yVal(row.needHours).toFixed(1)}` : null
  )).filter(Boolean).join(" ");
  const actualPoints = series.map((row, index) => (
    isNum(row.actualHours) ? `${xPos(index).toFixed(1)},${yVal(row.actualHours).toFixed(1)}` : null
  )).filter(Boolean).join(" ");
  const actualPath = series.map((row, index) => {
    if (!isNum(row.actualHours)) return null;
    return `${index === 0 ? "M" : "L"} ${xPos(index).toFixed(1)} ${yVal(row.actualHours).toFixed(1)}`;
  }).filter(Boolean).join(" ");
  const areaFill = `${actualPath} L ${xPos(series.length - 1).toFixed(1)} ${(height - pad.bottom).toFixed(1)} L ${pad.left.toFixed(1)} ${(height - pad.bottom).toFixed(1)} Z`;

  el.sleepTargetPill.textContent = `Range avg: ${fmtHm(avg(series.map((row) => row.actualHours)))} / need ${fmtHm(avg(series.map((row) => row.needHours)))}`;
  el.sleepTargetChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="sleep-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${PALETTE.blue}" stop-opacity="0.18"></stop>
        <stop offset="100%" stop-color="${PALETTE.blue}" stop-opacity="0"></stop>
      </linearGradient>
    </defs>
    ${makeGrid(width, height, pad, 4, 0, maxHours)}
    <path d="${areaFill}" fill="url(#sleep-gradient)"></path>
    <polyline fill="none" stroke="rgba(255,255,255,0.24)" stroke-width="1.8" stroke-dasharray="5 3" points="${needPoints}" stroke-linecap="round" stroke-linejoin="round"></polyline>
    <polyline fill="none" stroke="${PALETTE.blue}" stroke-width="2.5" points="${actualPoints}" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${series.map((row, index) => isNum(row.actualHours)
      ? `<circle cx="${xPos(index).toFixed(1)}" cy="${yVal(row.actualHours).toFixed(1)}" r="5" fill="${PALETTE.blue}" stroke="rgba(8,17,31,0.95)" stroke-width="2" ${chartTipAttrs(`${fmtTableDay(row.date)} · Slept ${fmtHm(row.actualHours)} / need ${fmtHm(row.needHours)}`, PALETTE.blue)}></circle>`
      : "").join("")}
    ${series.map((row, index) => isNum(row.needHours)
      ? `<circle cx="${xPos(index).toFixed(1)}" cy="${yVal(row.needHours).toFixed(1)}" r="4" fill="rgba(255,255,255,0.72)" stroke="rgba(8,17,31,0.95)" stroke-width="2" ${chartTipAttrs(`${fmtTableDay(row.date)} · Need ${fmtHm(row.needHours)}`, "#d7ecff")}></circle>`
      : "").join("")}
    ${monthAxisLabels(series, width, height, pad)}
  </svg>`;
  el.sleepTargetMonths.innerHTML = monthRangeFooter(series);
}

function renderAttention(insights, errorState) {
  const items = [];
  if (errorState?.message) {
    items.push({
      title: errorState.title || "Dashboard error",
      body: errorState.message,
      tone: "alert",
    });
  }

  (insights || []).forEach((item) => {
    const lower = String(item.title || "").toLowerCase();
    let tone = "";
    if (lower.includes("down") || lower.includes("constraint") || lower.includes("attention")) tone = "warn";
    if (lower.includes("error") || lower.includes("expired")) tone = "alert";
    items.push({ ...item, tone });
  });

  if (!items.length) {
    el.attentionList.innerHTML = emptyState("No insights available.");
    return;
  }

  el.attentionList.innerHTML = items.map((item) => `
    <div class="attention-item ${escapeHtml(item.tone || "")}">
      <h4>${escapeHtml(item.title || "Insight")}</h4>
      <p>${escapeHtml(item.body || "")}</p>
    </div>
  `).join("");
}

function renderSleepStages(fullSeries) {
  const nights = [...(fullSeries || [])]
    .filter((row) => !row?.isNap)
    .sort((a, b) => String(a?.date || "").localeCompare(String(b?.date || "")))
    .slice(-7);

  if (!nights.length) {
    el.sleepBarsWrap.innerHTML = emptyState("No overnight sleep data.");
    el.sleepDays.innerHTML = "";
    el.avgInBed.textContent = "—";
    el.avgAsleep.textContent = "—";
    return;
  }

  const avgInBed = avg(nights.map((row) => row.inBedHours));
  const avgAsleep = avg(nights.map((row) => row.actualHours));
  el.avgInBed.textContent = fmtHm(avgInBed);
  el.avgAsleep.textContent = fmtHm(avgAsleep);
  el.overlayAvgInBed.textContent = fmtHm(avgInBed);
  el.overlayAvgAsleep.textContent = fmtHm(avgAsleep);

  const maxHours = Math.max(...nights.map((row) => row.inBedHours || row.actualHours || 0), 0.1);
  el.sleepBarsWrap.innerHTML = nights.map((row) => {
    const deep = row.slowWaveSleepHours || 0;
    const light = row.lightSleepHours || 0;
    const rem = row.remSleepHours || 0;
    const awake = row.awakeHours || 0;
    const toPct = (value) => `${((value / maxHours) * 100).toFixed(1)}%`;
    return `<div class="sleep-bar-col" title="${escapeHtml(fmtDate(row.date))}">
      <div class="sleep-bar-seg seg-deep" style="height:${toPct(deep)}"></div>
      <div class="sleep-bar-seg seg-light" style="height:${toPct(light)}"></div>
      <div class="sleep-bar-seg seg-rem" style="height:${toPct(rem)}"></div>
      <div class="sleep-bar-seg seg-awake" style="height:${toPct(awake)}"></div>
    </div>`;
  }).join("");
  el.sleepDays.innerHTML = nights.map((row) => `<span>${escapeHtml(fmtWeekday(row.date))}</span>`).join("");

  renderSleepOverlay(nights[nights.length - 1], nights);
}

function renderSleepOverlay(latest, allNights) {
  if (!latest) return;
  el.overlayNightDate.textContent = fmtDate(latest.date);

  const stages = [
    { key: "deep", label: "Deep (SWS)", color: PALETTE.teal, value: latest.slowWaveSleepHours || 0, average: avg(allNights.map((row) => row.slowWaveSleepHours)) },
    { key: "light", label: "Light", color: PALETTE.blue, value: latest.lightSleepHours || 0, average: avg(allNights.map((row) => row.lightSleepHours)) },
    { key: "rem", label: "REM", color: PALETTE.purple, value: latest.remSleepHours || 0, average: avg(allNights.map((row) => row.remSleepHours)) },
    { key: "awake", label: "Awake", color: PALETTE.rose, value: latest.awakeHours || 0, average: avg(allNights.map((row) => row.awakeHours)) },
  ];

  const total = sum(stages.map((stage) => stage.value)) || 1;
  el.overlayCompBar.innerHTML = stages.map((stage) => {
    const pct = ((stage.value / total) * 100).toFixed(1);
    return `<div class="comp-seg seg-${stage.key}" style="flex:${pct};background:${stage.color}" title="${escapeHtml(`${stage.label}: ${fmtHm(stage.value)} (${pct}%)`)}"></div>`;
  }).join("");
  el.overlayCompLegend.innerHTML = stages.map((stage) => {
    const pct = ((stage.value / total) * 100).toFixed(0);
    return `<div class="comp-legend-item">
      <div class="comp-legend-dot" style="background:${stage.color}"></div>
      <span>${escapeHtml(`${stage.label} ${pct}%`)}</span>
    </div>`;
  }).join("");

  function vsAverage(value, averageValue) {
    if (!isNum(value) || !isNum(averageValue)) return `<span class="stage-vs-avg neu">— vs avg</span>`;
    const diff = value - averageValue;
    if (Math.abs(diff) < 0.08) return `<span class="stage-vs-avg neu">At avg</span>`;
    return `<span class="stage-vs-avg ${diff > 0 ? "pos" : "neg"}">${escapeHtml(`${fmtHm(Math.abs(diff))} ${diff > 0 ? "above" : "below"} avg`)}</span>`;
  }

  el.overlayStageRows.innerHTML = stages.map((stage) => `
    <div class="stage-row">
      <div class="stage-row-left">
        <div class="stage-dot ${escapeHtml(stage.key)}"></div>
        <span class="stage-label">${escapeHtml(stage.label)}</span>
      </div>
      <span class="stage-duration">${escapeHtml(fmtHm(stage.value))}</span>
      ${vsAverage(stage.value, stage.average)}
    </div>
  `).join("");

  const facts = [
    { label: "Sleep Efficiency", value: fmtPct(latest.sleepEfficiency, 1) },
    { label: "Sleep Consistency", value: fmtPct(latest.sleepConsistency, 0) },
    { label: "Sleep Performance", value: fmtPct(latest.sleepPerformance, 0) },
    { label: "Respiratory Rate", value: isNum(latest.respiratoryRate) ? `${fmt(latest.respiratoryRate, 2)} rpm` : "—" },
    { label: "Disturbances", value: isNum(latest.disturbanceCount) ? String(latest.disturbanceCount) : "—" },
    { label: "Sleep Cycles", value: isNum(latest.sleepCycleCount) ? String(latest.sleepCycleCount) : "—" },
    { label: "Window", value: latest.start && latest.end ? `${fmtClock(latest.start)} → ${fmtClock(latest.end)}` : "—" },
    { label: "Need Gap", value: fmtHm(latest.gapHours) },
  ];
  el.overlayFactRows.innerHTML = facts.map((fact) => `
    <div class="fact-row">
      <p class="fact-label">${escapeHtml(fact.label)}</p>
      <p class="fact-value">${escapeHtml(fact.value)}</p>
    </div>
  `).join("");
}

function renderWorkoutLoad(series) {
  if (!series.length) {
    el.workoutLoadChart.innerHTML = emptyState("No workout activity in range.");
    el.workoutLoadLabels.innerHTML = "";
    return;
  }

  const width = 700;
  const height = 140;
  const pad = { top: 12, right: 12, bottom: 24, left: 36 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const values = series.map((row) => row.totalStrain || 0);
  const maxValue = Math.max(...values, 1) * 1.12;
  const barWidth = Math.max(8, innerWidth / series.length - 5);

  const bars = series.map((row, index) => {
    const value = row.totalStrain || 0;
    const barHeight = (value / maxValue) * innerHeight;
    const x = pad.left + index * (innerWidth / series.length) + (innerWidth / series.length - barWidth) / 2;
    const y = height - pad.bottom - barHeight;
    const fill = value > 10 ? PALETTE.amber : value > 5 ? PALETTE.blue : "rgba(110,167,255,0.42)";
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(barHeight, 2).toFixed(1)}" rx="4" fill="${fill}" ${chartTipAttrs(`${fmtTableDay(row.date)} · Strain ${fmt(value, 2)} · ${row.sessions || 0} sessions`, fill)}></rect>`;
  }).join("");

  el.workoutLoadChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}">
    ${makeGrid(width, height, pad, 3, 0, maxValue)}
    ${bars}
    ${monthAxisLabels(series, width, height, pad)}
  </svg>`;
  el.workoutLoadLabels.innerHTML = monthRangeFooter(series);
}

function renderZoneSplit(workoutSessions) {
  const totals = Array(6).fill(0);
  (workoutSessions || []).forEach((session) => {
    const zones = session.zoneDurationsMinutes || {};
    totals[0] += zones.zone0 || 0;
    totals[1] += zones.zone1 || 0;
    totals[2] += zones.zone2 || 0;
    totals[3] += zones.zone3 || 0;
    totals[4] += zones.zone4 || 0;
    totals[5] += zones.zone5 || 0;
  });

  const totalMinutes = totals.reduce((total, value) => total + value, 0);
  if (!totalMinutes) {
    el.zoneList.innerHTML = emptyState("No zone data in range.");
    return;
  }

  el.zoneList.innerHTML = totals.map((value, index) => {
    const pct = ((value / totalMinutes) * 100).toFixed(1);
    return `<div class="zone-row">
      <div class="zone-label-row">
        <span class="zone-label">${escapeHtml(ZONE_LABELS[index])}</span>
        <span class="zone-pct">${escapeHtml(`${pct}%`)}</span>
      </div>
      <div class="zone-bar-track">
        <div class="zone-bar-fill" style="width:${pct}%;background:${ZONE_COLORS[index]}"></div>
      </div>
    </div>`;
  }).join("");
}

function renderWorkoutSplit(workoutSessions) {
  if (!workoutSessions?.length) {
    el.workoutSplitList.innerHTML = emptyState("No workouts in range.");
    return;
  }

  const counts = new Map();
  workoutSessions.forEach((session) => {
    const sport = session.sport || "unknown";
    counts.set(sport, (counts.get(sport) || 0) + 1);
  });

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((count, [, value]) => count + value, 0);
  el.workoutSplitList.innerHTML = entries.map(([sport, count]) => {
    const pct = ((count / total) * 100).toFixed(0);
    return `<div class="split-row">
      <div class="split-label-row">
        <span class="split-label">${escapeHtml(String(sport).replaceAll("_", " "))}</span>
        <span class="split-pct">${escapeHtml(`${pct}%`)}</span>
      </div>
      <div class="split-bar-track">
        <div class="split-bar-fill" style="width:${pct}%"></div>
      </div>
    </div>`;
  }).join("");
}

function renderRecords(body, highlights) {
  const metrics = [
    { label: "Height", value: isNum(body?.heightMeter) ? `${fmt(body.heightMeter, 2)} m` : "—" },
    { label: "Weight", value: isNum(body?.weightKilogram) ? `${fmt(body.weightKilogram, 2)} kg` : "—" },
    { label: "Max HR", value: isNum(body?.maxHeartRate) ? `${fmt(body.maxHeartRate, 0)} bpm` : "—" },
  ];
  el.recordMetrics.innerHTML = metrics.map((metric) => `
    <div class="record-metric-card">
      <p class="rm-label">${escapeHtml(metric.label)}</p>
      <p class="rm-value">${escapeHtml(metric.value)}</p>
    </div>
  `).join("");

  el.recordCards.innerHTML = (highlights || []).length
    ? highlights.map((highlight) => `
      <div class="record-card tone-${escapeHtml(highlight.tone || "neutral")}">
        <p class="rc-label">${escapeHtml(highlight.title || "")}</p>
        <p class="rc-value">${escapeHtml(highlight.value || "—")}</p>
        <p class="rc-detail">${escapeHtml(highlight.detail || "")}</p>
      </div>
    `).join("")
    : emptyState("No highlight records available.");
}

function renderCorrelations(correlations) {
  if (!correlations?.length) {
    el.correlationList.innerHTML = emptyState("No correlations available.");
    return;
  }

  const ranked = [...correlations]
    .filter((row) => isNum(row?.value))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  if (!ranked.length) {
    el.correlationList.innerHTML = emptyState("No numeric correlations available.");
    return;
  }

  const lead = ranked[0];
  const supporting = ranked.slice(1, 6);

  function toneFor(value) {
    if (value > 0.35) return "positive";
    if (value < -0.35) return "warning";
    return "neutral";
  }

  function strengthCopy(value) {
    const magnitude = Math.abs(value);
    if (magnitude >= 0.7) return "Strong";
    if (magnitude >= 0.4) return "Moderate";
    if (magnitude >= 0.2) return "Weak";
    return "Minimal";
  }

  function barWidth(value) {
    return `${Math.max(Math.abs(value) * 100, 6).toFixed(1)}%`;
  }

  el.correlationList.innerHTML = `
    <div class="correlation-showcase">
      <article class="correlation-feature tone-${escapeHtml(toneFor(lead.value))}">
        <p class="correlation-feature-kicker">Top relationship</p>
        <h3>${escapeHtml(lead.label)}</h3>
        <p class="correlation-feature-copy">${escapeHtml(lead.description)}</p>
        <div class="correlation-feature-meta">
          <div>
            <span>Coefficient</span>
            <strong>${escapeHtml(fmt(lead.value, 3))}</strong>
          </div>
          <div>
            <span>Strength</span>
            <strong>${escapeHtml(strengthCopy(lead.value))}</strong>
          </div>
          <div>
            <span>Samples</span>
            <strong>${escapeHtml(String(lead.samples ?? 0))}</strong>
          </div>
        </div>
      </article>

      <div class="correlation-stack">
        ${supporting.map((row, index) => `
          <article class="correlation-band tone-${escapeHtml(toneFor(row.value))}">
            <div class="correlation-band-head">
              <div>
                <p class="correlation-rank">#${index + 2}</p>
                <h4>${escapeHtml(row.label)}</h4>
              </div>
              <span class="correlation-value-pill">${escapeHtml(fmt(row.value, 3))}</span>
            </div>
            <p class="correlation-meta">${escapeHtml(`${row.description} · ${row.samples} samples`)}</p>
            <div class="correlation-bar-track">
              <div class="correlation-bar-fill" style="width:${barWidth(row.value)}"></div>
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function payloadForCurrentView() {
  if (!state.data) return {};
  if (state.payloadView === "dashboard") return state.data;
  return state.data.rawData?.[state.payloadView] ?? {};
}

function renderPayloadExplorer(data) {
  const rawData = data?.rawData || {};
  const summaries = [
    { label: "Recovery raw", value: String(rawData.recovery?.length || 0) },
    { label: "Sleep raw", value: String(rawData.sleep?.length || 0) },
    { label: "Workout raw", value: String(rawData.workouts?.length || 0) },
    { label: "Cycle raw", value: String(rawData.cycles?.length || 0) },
    { label: "Normalized series", value: String((data?.series?.recovery?.length || 0) + (data?.series?.sleep?.length || 0) + (data?.series?.workouts?.length || 0) + (data?.series?.cycles?.length || 0)) },
  ];

  el.payloadTabBar.innerHTML = PAYLOAD_VIEWS.map((view) => `
    <button class="payload-tab ${view.key === state.payloadView ? "is-active" : ""}" type="button" data-payload-view="${escapeHtml(view.key)}">
      ${escapeHtml(view.label)}
    </button>
  `).join("");
  el.payloadSummary.innerHTML = summaries.map((summary) => `
    <div class="payload-pill">
      <span>${escapeHtml(summary.label)}</span>
      <strong>${escapeHtml(summary.value)}</strong>
    </div>
  `).join("");
  el.payloadJson.textContent = JSON.stringify(payloadForCurrentView(), null, 2);
}

function renderAll(data) {
  const recoverySeries = filterByRange(data?.series?.recovery || [], state.rangeDays);
  const sleepNightSeries = filterSleepByRange(data?.series?.sleep || [], state.rangeDays);
  const sleepAllSeries = filterSleepAllByRange(data?.series?.sleep || [], state.rangeDays);
  const workoutSeries = filterByRange(data?.series?.workouts || [], state.rangeDays);
  const workoutSessions = filterByRange(data?.series?.workoutSessions || [], state.rangeDays);
  const cycleSeries = filterByRange(data?.series?.cycles || [], state.rangeDays);
  const dailyRows = buildDailyRows(recoverySeries, sleepAllSeries, workoutSessions, cycleSeries);
  const signalRows = buildSignalRows(dailyRows, data?.recentDays || [], recoverySeries, sleepAllSeries, workoutSessions, cycleSeries);
  renderHero(data);
  renderKpi(data?.cards || []);
  renderRecoveryChart(recoverySeries);
  renderSleepTargetChart(sleepNightSeries);
  renderAttention(data?.insights || [], data?.errorState);
  renderSleepStages(data?.series?.sleep || []);
  renderWorkoutLoad(workoutSeries);
  renderZoneSplit(workoutSessions);
  renderWorkoutSplit(workoutSessions);
  renderRecords(data?.bodyMeasurements || {}, data?.highlights || []);
  renderCorrelations(data?.metrics?.correlations || []);
  renderSignalsExplorer(data, signalRows, sleepAllSeries, workoutSessions);
  renderPayloadExplorer(data);
}

function setRefreshLoading(loading) {
  state.loading = loading;
  if (!el.refreshButton) return;
  el.refreshButton.disabled = loading;
  el.refreshButton.textContent = loading ? "Refreshing..." : "Refresh";
}

async function loadDashboard({ refresh = false } = {}) {
  setRefreshLoading(true);
  try {
    const query = refresh ? "?refresh=1" : "";
    const response = await fetch(`/api/dashboard${query}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.data = data;
    renderAll(data);
  } catch (error) {
    el.heroTitle.textContent = "Could not load WHOOP data";
    el.heroMeta.textContent = String(error);
  } finally {
    setRefreshLoading(false);
  }
}

document.querySelectorAll(".range-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".range-button").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    state.rangeDays = parseInt(button.dataset.rangeDays || "90", 10) || 90;
    if (state.data) renderAll(state.data);
  });
});

el.refreshButton?.addEventListener("click", () => {
  loadDashboard({ refresh: true });
});

el.exportButton?.addEventListener("click", () => {
  if (!state.data) return;
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `whoop-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

el.payloadTabBar?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-payload-view]");
  if (!button) return;
  state.payloadView = button.dataset.payloadView || "dashboard";
  if (state.data) renderPayloadExplorer(state.data);
});

el.signalsMetricBar?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-signal-metric]");
  if (!button) return;
  state.signalMetric = button.dataset.signalMetric || state.signalMetric;
  if (state.data) renderAll(state.data);
});

el.sleepDetailsBtn?.addEventListener("click", () => {
  el.overlayBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
});

el.collapseBtn?.addEventListener("click", () => {
  el.overlayBackdrop.hidden = true;
  document.body.style.overflow = "";
});

el.overlayBackdrop?.addEventListener("click", (event) => {
  if (event.target === el.overlayBackdrop) {
    el.overlayBackdrop.hidden = true;
    document.body.style.overflow = "";
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !el.overlayBackdrop.hidden) {
    el.overlayBackdrop.hidden = true;
    document.body.style.overflow = "";
  }
});

document.addEventListener("pointermove", (event) => {
  const target = event.target.closest?.("[data-chart-tip]");
  if (!target) {
    hideChartTooltip();
    return;
  }
  showChartTooltip(event, target.dataset.chartTip || "", target.dataset.chartAccent || "");
});

document.addEventListener("pointerleave", hideChartTooltip);
window.addEventListener("scroll", hideChartTooltip, { passive: true });

loadDashboard();
