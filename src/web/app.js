const state = {
  loading: false,
  data: null,
  filteredData: null,
  dateRange: {
    start: null,
    end: null,
  },
};

const elements = {
  body: document.body,
  heroTitle: document.getElementById("hero-title"),
  heroSubtitle: document.getElementById("hero-subtitle"),
  generatedAt: document.getElementById("generated-at"),
  heroMeta: document.getElementById("hero-meta"),
  refreshButton: document.getElementById("refresh-button"),
  dataSourceBadge: document.getElementById("data-source-badge"),
  startDateInput: document.getElementById("start-date-input"),
  endDateInput: document.getElementById("end-date-input"),
  cardGrid: document.getElementById("card-grid"),
  bodyNote: document.getElementById("body-note"),
  bodyMetrics: document.getElementById("body-metrics"),
  storyList: document.getElementById("story-list"),
  correlationList: document.getElementById("correlation-list"),
  recoveryChart: document.getElementById("recovery-chart"),
  recoveryNote: document.getElementById("recovery-note"),
  hrvChart: document.getElementById("hrv-chart"),
  hrvNote: document.getElementById("hrv-note"),
  sleepChart: document.getElementById("sleep-chart"),
  sleepNote: document.getElementById("sleep-note"),
  sleepStagesChart: document.getElementById("sleep-stages-chart"),
  sleepStagesNote: document.getElementById("sleep-stages-note"),
  workoutChart: document.getElementById("workout-chart"),
  workoutNote: document.getElementById("workout-note"),
  hrZoneChart: document.getElementById("hr-zone-chart"),
  hrZoneNote: document.getElementById("hr-zone-note"),
  cycleChart: document.getElementById("cycle-chart"),
  cycleNote: document.getElementById("cycle-note"),
  sportDonutChart: document.getElementById("sport-donut-chart"),
  sportDonutNote: document.getElementById("sport-donut-note"),
  recoveryHeatmap: document.getElementById("recovery-heatmap"),
  recoveryHeatmapNote: document.getElementById("recovery-heatmap-note"),
  highlightGrid: document.getElementById("highlight-grid"),
  monthGrid: document.getElementById("month-grid"),
  recentTableBody: document.getElementById("recent-table-body"),
  sourceGrid: document.getElementById("source-grid"),
  rawGrid: document.getElementById("raw-grid"),
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatNumber(value, fallback = "-") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return numberFormatter.format(value);
}

function formatSigned(value, suffix = "", digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}${suffix}`;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return dateTimeFormatter.format(new Date(value));
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function cloneEmptyState() {
  return document.getElementById("empty-state-template").content.cloneNode(true);
}

function isNumber(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

function average(values) {
  const clean = values.filter(isNumber);
  if (!clean.length) {
    return null;
  }
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function setLoading(isLoading) {
  state.loading = isLoading;
  elements.body.classList.toggle("is-loading", isLoading);
  elements.refreshButton.disabled = isLoading;
  elements.refreshButton.textContent = isLoading ? "Refreshing..." : "Refresh live data";
}

async function loadDashboard(refresh = false) {
  setLoading(true);
  try {
    const response = await fetch(`/api/dashboard${refresh ? "?refresh=1" : ""}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to load dashboard");
    }
    state.data = payload;
    initializeDateRange(payload);
    renderDashboard(payload);
  } catch (error) {
    renderError(error);
  } finally {
    setLoading(false);
  }
}

function initializeDateRange(data) {
  const start = data?.dateRange?.start || null;
  const end = data?.dateRange?.end || null;
  state.dateRange = { start, end };
  elements.startDateInput.value = start || "";
  elements.endDateInput.value = end || "";
  elements.startDateInput.min = start || "";
  elements.startDateInput.max = end || "";
  elements.endDateInput.min = start || "";
  elements.endDateInput.max = end || "";
}

function filterRowsByRange(rows, startDate, endDate) {
  return (rows || []).filter((row) => {
    const date = row?.date;
    if (!date) {
      return false;
    }
    if (startDate && date < startDate) {
      return false;
    }
    if (endDate && date > endDate) {
      return false;
    }
    return true;
  });
}

function buildFilteredData(data) {
  const startDate = state.dateRange.start;
  const endDate = state.dateRange.end;
  const series = data?.series || {};
  const filteredSeries = {
    recovery: filterRowsByRange(series.recovery || [], startDate, endDate),
    sleep: filterRowsByRange(series.sleep || [], startDate, endDate),
    workouts: filterRowsByRange(series.workouts || [], startDate, endDate),
    workoutSessions: filterRowsByRange(series.workoutSessions || [], startDate, endDate),
    cycles: filterRowsByRange(series.cycles || [], startDate, endDate),
  };

  const filteredMonths = (data?.monthly || []).filter((month) => {
    const monthKey = month?.month;
    if (!monthKey) {
      return false;
    }
    const monthStart = `${monthKey}-01`;
    if (startDate && monthStart < `${startDate.slice(0, 7)}-01`) {
      return false;
    }
    if (endDate && monthStart > `${endDate.slice(0, 7)}-01`) {
      return false;
    }
    return true;
  });

  return {
    ...data,
    series: filteredSeries,
    recentDays: filterRowsByRange(data?.recentDays || [], startDate, endDate),
    monthly: filteredMonths,
  };
}

function onDateRangeChange() {
  state.dateRange.start = elements.startDateInput.value || null;
  state.dateRange.end = elements.endDateInput.value || null;

  if (state.dateRange.start && state.dateRange.end && state.dateRange.start > state.dateRange.end) {
    state.dateRange.end = state.dateRange.start;
    elements.endDateInput.value = state.dateRange.end;
  }

  if (state.data) {
    renderDashboard(state.data);
  }
}

function renderError(error) {
  const message = error instanceof Error ? error.message : String(error);
  elements.heroTitle.textContent = "Could not load WHOOP data";
  elements.heroSubtitle.textContent = message;
  elements.generatedAt.textContent = "Status: unavailable";
  elements.dataSourceBadge.textContent = "Data source: unavailable";
  elements.dataSourceBadge.classList.remove("offline");

  [
    elements.cardGrid,
    elements.bodyMetrics,
    elements.storyList,
    elements.correlationList,
    elements.recoveryChart,
    elements.hrvChart,
    elements.sleepChart,
    elements.sleepStagesChart,
    elements.workoutChart,
    elements.hrZoneChart,
    elements.cycleChart,
    elements.sportDonutChart,
    elements.recoveryHeatmap,
    elements.highlightGrid,
    elements.monthGrid,
    elements.sourceGrid,
    elements.rawGrid,
  ].forEach((node) => {
    node.innerHTML = "";
    node.appendChild(cloneEmptyState());
  });

  elements.bodyNote.textContent = "";
  elements.recoveryNote.textContent = "";
  elements.hrvNote.textContent = "";
  elements.sleepNote.textContent = "";
  elements.sleepStagesNote.textContent = "";
  elements.workoutNote.textContent = "";
  elements.hrZoneNote.textContent = "";
  elements.cycleNote.textContent = "";
  elements.sportDonutNote.textContent = "";
  elements.recoveryHeatmapNote.textContent = "";
  elements.recentTableBody.innerHTML = '<tr><td colspan="13">No recent data available.</td></tr>';
}

function renderDashboard(data) {
  const filtered = buildFilteredData(data);
  state.filteredData = filtered;

  renderHero(data);
  renderCards(data.cards || []);
  renderBody(data.bodyMeasurements || {}, data.metrics?.body || {});
  renderStories(data.insights || []);
  renderCorrelations(data.metrics?.correlations || []);
  renderRecovery(filtered.series?.recovery || []);
  renderHrv(filtered.series?.recovery || []);
  renderSleep(filtered.series?.sleep || []);
  renderSleepStages(filtered.series?.sleep || []);
  renderWorkouts(filtered.series?.workouts || []);
  renderHeartRateZones(filtered.series?.workoutSessions || []);
  renderCycles(filtered.series?.cycles || []);
  renderSportDonut(filtered.series?.workoutSessions || []);
  renderRecoveryHeatmap(filtered.series?.recovery || []);
  renderHighlights(data.highlights || []);
  renderMonths(filtered.monthly || []);
  renderRecentTable(filtered.recentDays || []);
  renderSources(data.sources || {});
  renderRawSnapshots(data.rawSnapshots || {});
}

function renderHero(data) {
  const profile = data.profile || {};
  const errorState = data.errorState;
  if (errorState) {
    elements.heroTitle.textContent = errorState.title;
    elements.heroSubtitle.textContent = errorState.message;
    elements.generatedAt.textContent = `Status: ${data.authStatus?.status || "unknown"}`;
  } else {
    const firstName = profile.firstName || "WHOOP";
    elements.heroTitle.textContent = `${firstName}'s health picture`;
    elements.heroSubtitle.textContent = `Body, recovery, sleep, training, and cycle physiology across ${data.dateRange?.days || 0} days.`;
    elements.generatedAt.textContent = `Updated ${formatDateTime(data.generatedAt)}`;
  }

  const sourceLabel = data?.dataSource?.label || "live";
  elements.dataSourceBadge.textContent = `Data source: ${sourceLabel}`;
  elements.dataSourceBadge.classList.toggle("offline", (data?.dataSource?.mode || "live") !== "live");

  const meta = [
    { label: "Date Range", value: `${formatDate(state.dateRange.start || data.dateRange?.start)} to ${formatDate(state.dateRange.end || data.dateRange?.end)}` },
    { label: "Weight", value: `${formatNumber(data.bodyMeasurements?.weightKilogram)} kg` },
    { label: "Recovery Days", value: formatNumber(data.sources?.recovery?.count || 0) },
    { label: "Sleep Records", value: formatNumber(data.sources?.sleep?.count || 0) },
    { label: "Workout Sessions", value: formatNumber(data.sources?.workouts?.count || 0) },
    { label: "Cycles", value: formatNumber(data.sources?.cycles?.count || 0) },
  ];

  elements.heroMeta.innerHTML = meta
    .map(
      (item) => `
        <div class="meta-chip">
          <span>${item.label}</span>
          <span>${item.value}</span>
        </div>
      `,
    )
    .join("");
}

function renderBody(body, metrics) {
  const cards = [
    { label: "Height", value: `${formatNumber(metrics.heightMeter)} m` },
    { label: "Weight", value: `${formatNumber(metrics.weightKilogram)} kg` },
    { label: "Max HR", value: `${formatNumber(metrics.maxHeartRate)} bpm` },
  ];

  elements.bodyNote.textContent = body.weightKilogram
    ? "Latest body measurements from WHOOP."
    : "No body measurements available.";

  elements.bodyMetrics.innerHTML = cards
    .map(
      (item) => `
        <article class="metric-card">
          <p class="eyebrow">${item.label}</p>
          <strong>${item.value}</strong>
        </article>
      `,
    )
    .join("");
}

function renderCards(cards) {
  if (!cards.length) {
    elements.cardGrid.innerHTML = "";
    elements.cardGrid.appendChild(cloneEmptyState());
    return;
  }

  elements.cardGrid.innerHTML = cards
    .map((card, index) => {
      const value = `${formatNumber(card.value)}${card.suffix || ""}`;
      const deltaText = formatCardDelta(card);

      return `
        <article class="summary-card ${card.tone || "neutral"}" style="animation-delay:${index * 70}ms">
          <p class="eyebrow">${card.title}</p>
          <h3>${card.title}</h3>
          <div class="card-value">${value}</div>
          <div class="card-delta">${deltaText}</div>
          <div class="sparkline">${sparklineSvg(card.sparkline || [], card.tone || "neutral")}</div>
          <p class="summary-detail">${card.detail || ""}</p>
        </article>
      `;
    })
    .join("");
}

function formatCardDelta(card) {
  const digits = card.deltaDigits ?? 1;
  const suffix = card.deltaSuffix || "";
  if (card.deltaFormat === "plain") {
    return `${formatNumber(card.delta)}${suffix} ${card.deltaLabel}`.trim();
  }
  return `${formatSigned(card.delta, suffix, digits)} ${card.deltaLabel}`.trim();
}

function renderStories(insights) {
  if (!insights.length) {
    elements.storyList.innerHTML = "";
    elements.storyList.appendChild(cloneEmptyState());
    return;
  }
  elements.storyList.innerHTML = insights
    .map(
      (item, index) => `
        <article class="story-item" style="animation-delay:${index * 80}ms">
          <h3>${item.title}</h3>
          <p>${item.body}</p>
        </article>
      `,
    )
    .join("");
}

function renderCorrelations(correlations) {
  if (!correlations.length) {
    elements.correlationList.innerHTML = "";
    return;
  }

  elements.correlationList.innerHTML = correlations
    .map(
      (item) => `
        <div class="correlation-chip">
          <strong>${item.label}</strong>
          <span>${item.description}, r=${formatNumber(item.value)} across ${item.samples} days</span>
        </div>
      `,
    )
    .join("");
}

function renderRecovery(series) {
  const data = series.slice(-21);
  elements.recoveryNote.textContent = `Avg ${formatNumber(average(series.map((row) => row.recoveryScore)))} | HRV ${formatNumber(average(series.map((row) => row.hrv)))} | RHR ${formatNumber(average(series.map((row) => row.restingHeartRate)))}`;
  if (!data.length) {
    elements.recoveryChart.innerHTML = "";
    elements.recoveryChart.appendChild(cloneEmptyState());
    return;
  }
  elements.recoveryChart.innerHTML = lineChartSvg(data, {
    valueKey: "recoveryScore",
    labelKey: "date",
    color: "#17736a",
    fill: "rgba(23, 115, 106, 0.12)",
    min: 0,
    max: 100,
    ySuffix: "",
  });
}

function renderHrv(series) {
  const data = series.filter((row) => isNumber(row.hrv)).slice(-30);
  elements.hrvNote.textContent = `Latest ${formatNumber(data.at(-1)?.hrv)} ms | 7d avg ${formatNumber(average(data.slice(-7).map((row) => row.hrv)))}`;
  if (!data.length) {
    elements.hrvChart.innerHTML = "";
    elements.hrvChart.appendChild(cloneEmptyState());
    return;
  }
  elements.hrvChart.innerHTML = dualLineChartSvg(data, {
    primaryKey: "hrv",
    secondaryKey: "hrvMovingAverage7d",
    labelKey: "date",
    primaryColor: "#2d5f8a",
    secondaryColor: "#6ba3d6",
    ySuffix: "",
  });
}

function renderSleep(series) {
  const data = series.slice(-14);
  elements.sleepNote.textContent = `Avg ${formatNumber(average(series.map((row) => row.actualHours)))}h asleep | ${formatNumber(average(series.map((row) => row.needHours)))}h needed`;
  if (!data.length) {
    elements.sleepChart.innerHTML = "";
    elements.sleepChart.appendChild(cloneEmptyState());
    return;
  }
  elements.sleepChart.innerHTML = groupedBarChartSvg(data, {
    labelKey: "date",
    groups: [
      { key: "needHours", label: "Need", color: "#c6ad73" },
      { key: "actualHours", label: "Actual", color: "#17736a" },
    ],
    ySuffix: "h",
  });
}

function renderSleepStages(series) {
  const data = series.filter((row) => !row.isNap).slice(-14);
  elements.sleepStagesNote.textContent = `Light ${formatNumber(average(data.map((row) => row.lightSleepHours)))}h | SWS ${formatNumber(average(data.map((row) => row.slowWaveSleepHours)))}h | REM ${formatNumber(average(data.map((row) => row.remSleepHours)))}h`;
  if (!data.length) {
    elements.sleepStagesChart.innerHTML = "";
    elements.sleepStagesChart.appendChild(cloneEmptyState());
    return;
  }
  elements.sleepStagesChart.innerHTML = stackedBarChartSvg(data, {
    labelKey: "date",
    groups: [
      { key: "lightSleepHours", label: "Light", color: "#6ba3d6" },
      { key: "slowWaveSleepHours", label: "SWS", color: "#2d5f8a" },
      { key: "remSleepHours", label: "REM", color: "#a4508b" },
    ],
    ySuffix: "h",
  });
}

function renderWorkouts(series) {
  const data = series.slice(-14);
  const totalSessions = series.reduce((sum, row) => sum + (row.sessions || 0), 0);
  elements.workoutNote.textContent = `${formatNumber(totalSessions)} sessions | ${formatNumber(average(series.map((row) => row.totalStrain)))} avg daily strain`;
  if (!data.length) {
    elements.workoutChart.innerHTML = "";
    elements.workoutChart.appendChild(cloneEmptyState());
    return;
  }
  elements.workoutChart.innerHTML = barChartSvg(data, {
    valueKey: "totalStrain",
    labelKey: "date",
    color: "#b3721d",
    ySuffix: "",
  });
}

function aggregateHeartRateZones(workoutSessions) {
  const totals = {
    zone1: 0,
    zone2: 0,
    zone3: 0,
    zone4: 0,
    zone5: 0,
    zone6: 0,
  };

  workoutSessions.forEach((session) => {
    const zones = session.zoneDurationsMinutes || {};
    totals.zone1 += zones.zone1 || 0;
    totals.zone2 += zones.zone2 || 0;
    totals.zone3 += zones.zone3 || 0;
    totals.zone4 += zones.zone4 || 0;
    totals.zone5 += zones.zone5 || 0;
    totals.zone6 += zones.zone6 || 0;
  });

  return [
    { label: "Zone 1", value: totals.zone1, color: "#c3d6e6" },
    { label: "Zone 2", value: totals.zone2, color: "#9dbed9" },
    { label: "Zone 3", value: totals.zone3, color: "#6ba3d6" },
    { label: "Zone 4", value: totals.zone4, color: "#3e7eb1" },
    { label: "Zone 5", value: totals.zone5, color: "#2d5f8a" },
    { label: "Zone 6", value: totals.zone6, color: "#1f4768" },
  ];
}

function renderHeartRateZones(workoutSessions) {
  const zones = aggregateHeartRateZones(workoutSessions);
  const totalMinutes = zones.reduce((sum, zone) => sum + zone.value, 0);
  elements.hrZoneNote.textContent = `${formatNumber(totalMinutes)} total minutes across all zones`;
  if (!totalMinutes) {
    elements.hrZoneChart.innerHTML = "";
    elements.hrZoneChart.appendChild(cloneEmptyState());
    return;
  }

  elements.hrZoneChart.innerHTML = horizontalStackedBarSvg(zones);
}

function renderCycles(series) {
  const data = series.slice(-14);
  elements.cycleNote.textContent = `${formatNumber(series.length)} cycles | Avg strain ${formatNumber(average(series.map((row) => row.strain)))} | Avg kJ ${formatNumber(average(series.map((row) => row.kilojoule)))}`;
  if (!data.length) {
    elements.cycleChart.innerHTML = "";
    elements.cycleChart.appendChild(cloneEmptyState());
    return;
  }
  elements.cycleChart.innerHTML = lineChartSvg(data, {
    valueKey: "strain",
    labelKey: "date",
    color: "#7d5a1a",
    fill: "rgba(179, 114, 29, 0.14)",
    min: 0,
    max: 21,
    ySuffix: "",
  });
}

function renderSportDonut(workoutSessions) {
  const counts = new Map();
  workoutSessions.forEach((session) => {
    const sport = session.sport || "unknown";
    counts.set(sport, (counts.get(sport) || 0) + 1);
  });
  const entries = Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  elements.sportDonutNote.textContent = `${formatNumber(workoutSessions.length)} workout sessions in range`;
  if (!entries.length) {
    elements.sportDonutChart.innerHTML = "";
    elements.sportDonutChart.appendChild(cloneEmptyState());
    return;
  }

  elements.sportDonutChart.innerHTML = donutChartSvg(entries);
}

function renderRecoveryHeatmap(recoverySeries) {
  const rows = recoverySeries.slice(-90);
  elements.recoveryHeatmapNote.textContent = `${formatNumber(rows.length)} days plotted`;
  if (!rows.length) {
    elements.recoveryHeatmap.innerHTML = "";
    elements.recoveryHeatmap.appendChild(cloneEmptyState());
    return;
  }
  elements.recoveryHeatmap.innerHTML = calendarHeatmapSvg(rows);
}

function renderHighlights(highlights) {
  if (!highlights.length) {
    elements.highlightGrid.innerHTML = "";
    elements.highlightGrid.appendChild(cloneEmptyState());
    return;
  }
  elements.highlightGrid.innerHTML = highlights
    .map(
      (item) => `
        <article class="highlight-card ${item.tone || "neutral"}">
          <p class="eyebrow">${item.title}</p>
          <h3>${item.title}</h3>
          <strong>${item.value}</strong>
          <p>${item.detail || ""}</p>
        </article>
      `,
    )
    .join("");
}

function renderMonths(months) {
  if (!months.length) {
    elements.monthGrid.innerHTML = "";
    elements.monthGrid.appendChild(cloneEmptyState());
    return;
  }
  elements.monthGrid.innerHTML = months
    .map(
      (month) => `
        <article class="month-card">
          <p class="eyebrow">${month.label}</p>
          <h3>${month.label}</h3>
          <strong>${formatNumber(month.avgRecovery)}</strong>
          <p>Avg recovery score</p>
          <dl>
            <div>
              <dt>Sleep Perf</dt>
              <dd>${formatNumber(month.avgSleepPerformance)}%</dd>
            </div>
            <div>
              <dt>Sleep Hours</dt>
              <dd>${formatNumber(month.avgSleepHours)}h</dd>
            </div>
            <div>
              <dt>Sleep Gap</dt>
              <dd>${formatNumber(month.avgSleepGapHours)}h</dd>
            </div>
            <div>
              <dt>Workouts</dt>
              <dd>${formatNumber(month.workoutCount)}</dd>
            </div>
          </dl>
        </article>
      `,
    )
    .join("");
}

function renderRecentTable(days) {
  if (!days.length) {
    elements.recentTableBody.innerHTML = '<tr><td colspan="13">No recent data available.</td></tr>';
    return;
  }

  elements.recentTableBody.innerHTML = days
    .map(
      (day) => `
        <tr>
          <td>${formatDate(day.date)}</td>
          <td>${formatNumber(day.recoveryScore)}</td>
          <td>${formatNumber(day.hrv)}</td>
          <td>${formatNumber(day.restingHeartRate)}</td>
          <td>${formatNumber(day.skinTempC)} C</td>
          <td>${formatNumber(day.spo2)}%</td>
          <td>${formatNumber(day.sleepHours)}h</td>
          <td>${formatNumber(day.sleepGapHours)}h</td>
          <td>${formatNumber(day.sleepPerformance)}%</td>
          <td>${formatNumber(day.respiratoryRate)}</td>
          <td>${formatNumber(day.workoutSessions)}</td>
          <td>${formatNumber(day.workoutStrain)}</td>
          <td>${formatNumber(day.cycleStrain)}</td>
        </tr>
      `,
    )
    .join("");
}

function renderSources(sources) {
  const entries = Object.entries(sources);
  if (!entries.length) {
    elements.sourceGrid.innerHTML = "";
    elements.sourceGrid.appendChild(cloneEmptyState());
    return;
  }

  elements.sourceGrid.innerHTML = entries
    .map(([name, source]) => {
      const available = source.available;
      return `
        <article class="source-card ${available ? "" : "is-unavailable"}">
          <p class="eyebrow">${name}</p>
          <strong>${available ? "Available" : "Unavailable"}</strong>
          <p>${available ? `${formatNumber(source.count)} records in this view.` : source.message || "This source could not be loaded with the current token."}</p>
        </article>
      `;
    })
    .join("");
}

function renderRawSnapshots(rawSnapshots) {
  const entries = Object.entries(rawSnapshots);
  if (!entries.length) {
    elements.rawGrid.innerHTML = "";
    elements.rawGrid.appendChild(cloneEmptyState());
    return;
  }

  elements.rawGrid.innerHTML = entries
    .map(
      ([name, payload]) => `
        <article class="raw-card">
          <p class="eyebrow">${name}</p>
          <pre>${formatJson(payload)}</pre>
        </article>
      `,
    )
    .join("");
}

function sparklineSvg(values, tone) {
  const clean = values.filter((value) => value !== null && value !== undefined && !Number.isNaN(value));
  if (clean.length < 2) {
    return "";
  }

  const colorMap = {
    positive: "#17736a",
    warning: "#bf5448",
    neutral: "#5f6f72",
  };
  const color = colorMap[tone] || colorMap.neutral;
  const width = 260;
  const height = 56;
  const padding = 6;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;

  const points = clean
    .map((value, index) => {
      const x = padding + (index / (clean.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <polyline fill="none" stroke="${color}" stroke-width="3" points="${points}" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>
  `;
}

function lineChartSvg(rows, options) {
  const width = 780;
  const height = 320;
  const padding = { top: 18, right: 16, bottom: 38, left: 48 };
  const values = rows.map((row) => row[options.valueKey]).filter(isNumber);
  if (values.length < 2) {
    return cloneEmptyState().firstElementChild.outerHTML;
  }

  const min = options.min ?? Math.min(...values);
  const max = options.max ?? Math.max(...values);
  const range = max - min || 1;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const points = rows
    .map((row, index) => {
      const value = row[options.valueKey];
      if (!isNumber(value)) {
        return null;
      }
      const x = padding.left + (index / (rows.length - 1 || 1)) * innerWidth;
      const y = padding.top + (1 - (value - min) / range) * innerHeight;
      return { x, y, value, label: row[options.labelKey] };
    })
    .filter(Boolean);

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${path} L ${points.at(-1).x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = padding.top + ratio * innerHeight;
    const label = (max - ratio * range).toFixed(0);
    return `
      <g>
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(24,49,54,0.1)" />
        <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#5f6f72">${label}${options.ySuffix || ""}</text>
      </g>
    `;
  }).join("");

  const labels = [points[0], points[Math.floor(points.length / 2)], points.at(-1)]
    .filter(Boolean)
    .map(
      (point) => `
        <text x="${point.x}" y="${height - 12}" text-anchor="middle" font-size="11" fill="#5f6f72">${formatDate(point.label)}</text>
      `,
    )
    .join("");

  const latest = points.at(-1);
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart">
      ${grid}
      <path d="${areaPath}" fill="${options.fill}"></path>
      <path d="${path}" fill="none" stroke="${options.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
      ${points
        .map(
          (point) => `
            <circle cx="${point.x}" cy="${point.y}" r="5" fill="${options.color}" />
          `,
        )
        .join("")}
      <g>
        <rect x="${latest.x - 42}" y="${latest.y - 46}" width="84" height="30" rx="15" fill="#183136" />
        <text x="${latest.x}" y="${latest.y - 26}" text-anchor="middle" font-size="12" fill="#fff">${formatNumber(latest.value)}</text>
      </g>
      ${labels}
    </svg>
  `;
}

function dualLineChartSvg(rows, options) {
  const width = 780;
  const height = 320;
  const padding = { top: 20, right: 16, bottom: 42, left: 50 };
  const values = rows
    .flatMap((row) => [row[options.primaryKey], row[options.secondaryKey]])
    .filter(isNumber);
  if (values.length < 2) {
    return cloneEmptyState().firstElementChild.outerHTML;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  function pointsFor(key) {
    return rows
      .map((row, index) => {
        const value = row[key];
        if (!isNumber(value)) {
          return null;
        }
        const x = padding.left + (index / (rows.length - 1 || 1)) * innerWidth;
        const y = padding.top + (1 - (value - min) / range) * innerHeight;
        return { x, y, value, label: row[options.labelKey] };
      })
      .filter(Boolean);
  }

  const primary = pointsFor(options.primaryKey);
  const secondary = pointsFor(options.secondaryKey);
  const primaryPath = primary.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const secondaryPath = secondary.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  const labels = [primary[0], primary[Math.floor(primary.length / 2)], primary.at(-1)]
    .filter(Boolean)
    .map((point) => `<text x="${point.x}" y="${height - 14}" text-anchor="middle" font-size="10" fill="#5f6f72">${formatDate(point.label)}</text>`)
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="HRV with 7-day moving average">
      ${Array.from({ length: 5 }, (_, index) => {
        const ratio = index / 4;
        const y = padding.top + ratio * innerHeight;
        const label = (max - ratio * range).toFixed(0);
        return `
          <g>
            <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(24,49,54,0.1)" />
            <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#5f6f72">${label}${options.ySuffix || ""}</text>
          </g>
        `;
      }).join("")}
      <path d="${secondaryPath}" fill="none" stroke="${options.secondaryColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="${primaryPath}" fill="none" stroke="${options.primaryColor}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"></path>
      ${primary.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="3.5" fill="${options.primaryColor}" />`).join("")}
      ${labels}
    </svg>
    <div class="chart-legend">
      <span><i style="background:${options.primaryColor}"></i>Daily HRV</span>
      <span><i style="background:${options.secondaryColor}"></i>7-day average</span>
    </div>
  `;
}

function groupedBarChartSvg(rows, options) {
  const width = 780;
  const height = 320;
  const padding = { top: 18, right: 18, bottom: 48, left: 48 };
  const flattened = rows.flatMap((row) => options.groups.map((group) => row[group.key])).filter(isNumber);
  if (!flattened.length) {
    return cloneEmptyState().firstElementChild.outerHTML;
  }

  const max = Math.max(...flattened) * 1.12;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const groupWidth = innerWidth / rows.length;
  const barWidth = Math.min(18, groupWidth / (options.groups.length + 0.8));

  const grid = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = padding.top + ratio * innerHeight;
    const label = (max - ratio * max).toFixed(1);
    return `
      <g>
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(24,49,54,0.1)" />
        <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#5f6f72">${label}${options.ySuffix || ""}</text>
      </g>
    `;
  }).join("");

  const bars = rows
    .map((row, rowIndex) => {
      const baseX = padding.left + rowIndex * groupWidth + groupWidth / 2;
      const label = formatDate(row[options.labelKey]);
      const groupBars = options.groups
        .map((group, groupIndex) => {
          const value = row[group.key];
          if (!isNumber(value)) {
            return "";
          }
          const barHeight = (value / max) * innerHeight;
          const x = baseX - (options.groups.length * barWidth) / 2 + groupIndex * (barWidth + 4);
          const y = height - padding.bottom - barHeight;
          return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="7" fill="${group.color}" />`;
        })
        .join("");

      return `
        <g>
          ${groupBars}
          <text x="${baseX}" y="${height - 16}" text-anchor="middle" font-size="10" fill="#5f6f72">${label}</text>
        </g>
      `;
    })
    .join("");

  const legend = options.groups
    .map(
      (group, index) => `
        <g transform="translate(${padding.left + index * 110}, ${padding.top - 2})">
          <circle cx="0" cy="0" r="5" fill="${group.color}"></circle>
          <text x="12" y="4" font-size="12" fill="#5f6f72">${group.label}</text>
        </g>
      `,
    )
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Grouped bar chart">
      ${grid}
      ${legend}
      ${bars}
    </svg>
  `;
}

function stackedBarChartSvg(rows, options) {
  const width = 780;
  const height = 320;
  const padding = { top: 18, right: 16, bottom: 48, left: 48 };
  const totals = rows
    .map((row) => options.groups.reduce((sum, group) => sum + (row[group.key] || 0), 0))
    .filter(isNumber);
  if (!totals.length) {
    return cloneEmptyState().firstElementChild.outerHTML;
  }

  const max = Math.max(...totals) * 1.12;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const groupWidth = innerWidth / rows.length;
  const barWidth = Math.max(14, groupWidth - 10);

  const grid = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = padding.top + ratio * innerHeight;
    const label = (max - ratio * max).toFixed(1);
    return `
      <g>
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(24,49,54,0.1)" />
        <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#5f6f72">${label}${options.ySuffix || ""}</text>
      </g>
    `;
  }).join("");

  const bars = rows
    .map((row, index) => {
      const x = padding.left + index * groupWidth + (groupWidth - barWidth) / 2;
      let yCursor = height - padding.bottom;
      const stacks = options.groups
        .map((group) => {
          const value = row[group.key] || 0;
          if (!value) {
            return "";
          }
          const barHeight = (value / max) * innerHeight;
          yCursor -= barHeight;
          return `<rect x="${x}" y="${yCursor}" width="${barWidth}" height="${barHeight}" rx="6" fill="${group.color}" />`;
        })
        .join("");
      return `
        <g>
          ${stacks}
          <text x="${x + barWidth / 2}" y="${height - 16}" text-anchor="middle" font-size="10" fill="#5f6f72">${formatDate(row[options.labelKey])}</text>
        </g>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Stacked sleep stage bars">
      ${grid}
      ${bars}
    </svg>
    <div class="chart-legend">
      ${options.groups
        .map((group) => `<span><i style="background:${group.color}"></i>${group.label}</span>`)
        .join("")}
    </div>
  `;
}

function barChartSvg(rows, options) {
  const width = 780;
  const height = 320;
  const padding = { top: 20, right: 16, bottom: 48, left: 48 };
  const values = rows.map((row) => row[options.valueKey]).filter(isNumber);
  if (!values.length) {
    return cloneEmptyState().firstElementChild.outerHTML;
  }

  const max = Math.max(...values) * 1.1;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const barWidth = Math.max(18, innerWidth / rows.length - 10);

  const grid = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = padding.top + ratio * innerHeight;
    const label = (max - ratio * max).toFixed(0);
    return `
      <g>
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(24,49,54,0.1)" />
        <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#5f6f72">${label}${options.ySuffix || ""}</text>
      </g>
    `;
  }).join("");

  const bars = rows
    .map((row, index) => {
      const value = row[options.valueKey];
      const barHeight = (value / max) * innerHeight;
      const x = padding.left + index * (barWidth + 10);
      const y = height - padding.bottom - barHeight;
      return `
        <g>
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="10" fill="${options.color}" />
          <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="11" fill="#5f6f72">${formatNumber(value)}</text>
          <text x="${x + barWidth / 2}" y="${height - 16}" text-anchor="middle" font-size="10" fill="#5f6f72">${formatDate(row[options.labelKey])}</text>
        </g>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Bar chart">
      ${grid}
      ${bars}
    </svg>
  `;
}

function horizontalStackedBarSvg(entries) {
  const width = 780;
  const height = 170;
  const padding = { top: 30, right: 16, bottom: 22, left: 16 };
  const total = entries.reduce((sum, item) => sum + item.value, 0);
  let cursor = padding.left;

  const bars = entries
    .map((item) => {
      const w = total ? ((item.value / total) * (width - padding.left - padding.right)) : 0;
      const segment = `<rect x="${cursor}" y="${padding.top}" width="${w}" height="46" rx="8" fill="${item.color}" />`;
      cursor += w;
      return segment;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Heart rate zone distribution">
      ${bars}
      <text x="${padding.left}" y="${padding.top + 70}" font-size="12" fill="#5f6f72">Total: ${formatNumber(total)} min</text>
    </svg>
    <div class="chart-legend">
      ${entries
        .map((item) => {
          const pct = total ? ((item.value / total) * 100).toFixed(1) : "0.0";
          return `<span><i style="background:${item.color}"></i>${item.label} ${pct}%</span>`;
        })
        .join("")}
    </div>
  `;
}

function donutChartSvg(entries) {
  const width = 780;
  const height = 280;
  const cx = 180;
  const cy = 140;
  const radius = 90;
  const innerRadius = 54;
  const colors = ["#17736a", "#2d5f8a", "#a4508b", "#b3721d", "#6ba3d6", "#bf5448", "#7d5a1a", "#5f6f72"];
  const total = entries.reduce((sum, item) => sum + item.value, 0);

  let start = -Math.PI / 2;
  const slices = entries.map((entry, index) => {
    const portion = total ? entry.value / total : 0;
    const angle = portion * Math.PI * 2;
    const end = start + angle;

    const x1 = cx + Math.cos(start) * radius;
    const y1 = cy + Math.sin(start) * radius;
    const x2 = cx + Math.cos(end) * radius;
    const y2 = cy + Math.sin(end) * radius;
    const largeArc = angle > Math.PI ? 1 : 0;

    const ix1 = cx + Math.cos(end) * innerRadius;
    const iy1 = cy + Math.sin(end) * innerRadius;
    const ix2 = cx + Math.cos(start) * innerRadius;
    const iy2 = cy + Math.sin(start) * innerRadius;

    const d = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      "Z",
    ].join(" ");

    const color = colors[index % colors.length];
    start = end;
    return `<path d="${d}" fill="${color}" />`;
  });

  const legend = entries
    .map((entry, index) => {
      const color = colors[index % colors.length];
      const pct = total ? ((entry.value / total) * 100).toFixed(1) : "0.0";
      return `<span><i style="background:${color}"></i>${entry.label} ${pct}%</span>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Workout sport distribution">
      ${slices.join("")}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="22" fill="#183136" font-weight="700">${formatNumber(total)}</text>
      <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="12" fill="#5f6f72">sessions</text>
    </svg>
    <div class="chart-legend">${legend}</div>
  `;
}

function recoveryColor(score) {
  if (!isNumber(score)) {
    return "#dde5e7";
  }
  if (score >= 67) {
    return "#17736a";
  }
  if (score >= 34) {
    return "#c6ad73";
  }
  return "#bf5448";
}

function calendarHeatmapSvg(rows) {
  const size = 12;
  const gap = 3;
  const columns = 7;
  const rowCount = Math.ceil(rows.length / columns);
  const width = columns * (size + gap) + 30;
  const height = rowCount * (size + gap) + 28;

  const squares = rows
    .map((row, index) => {
      const col = index % columns;
      const rowIndex = Math.floor(index / columns);
      const x = 20 + col * (size + gap);
      const y = 10 + rowIndex * (size + gap);
      return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="2" fill="${recoveryColor(row.recoveryScore)}"><title>${row.date}: ${row.recoveryScore ?? "n/a"}</title></rect>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Recovery calendar heatmap">
      ${squares}
    </svg>
    <div class="chart-legend">
      <span><i style="background:#bf5448"></i>Low</span>
      <span><i style="background:#c6ad73"></i>Medium</span>
      <span><i style="background:#17736a"></i>High</span>
    </div>
  `;
}

elements.refreshButton.addEventListener("click", () => loadDashboard(true));
elements.startDateInput.addEventListener("change", onDateRangeChange);
elements.endDateInput.addEventListener("change", onDateRangeChange);

loadDashboard();
