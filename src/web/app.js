const state = {
  loading: false,
  data: null,
};

const elements = {
  body: document.body,
  heroTitle: document.getElementById("hero-title"),
  heroSubtitle: document.getElementById("hero-subtitle"),
  generatedAt: document.getElementById("generated-at"),
  heroMeta: document.getElementById("hero-meta"),
  refreshButton: document.getElementById("refresh-button"),
  cardGrid: document.getElementById("card-grid"),
  bodyNote: document.getElementById("body-note"),
  bodyMetrics: document.getElementById("body-metrics"),
  storyList: document.getElementById("story-list"),
  correlationList: document.getElementById("correlation-list"),
  recoveryChart: document.getElementById("recovery-chart"),
  recoveryNote: document.getElementById("recovery-note"),
  sleepChart: document.getElementById("sleep-chart"),
  sleepNote: document.getElementById("sleep-note"),
  workoutChart: document.getElementById("workout-chart"),
  workoutNote: document.getElementById("workout-note"),
  cycleChart: document.getElementById("cycle-chart"),
  cycleNote: document.getElementById("cycle-note"),
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

function formatNumber(value, fallback = "—") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return numberFormatter.format(value);
}

function formatSigned(value, suffix = "", digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}${suffix}`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }
  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }
  return dateTimeFormatter.format(new Date(value));
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function cloneEmptyState() {
  return document.getElementById("empty-state-template").content.cloneNode(true);
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
    renderDashboard(payload);
  } catch (error) {
    renderError(error);
  } finally {
    setLoading(false);
  }
}

function renderError(error) {
  const message = error instanceof Error ? error.message : String(error);
  elements.heroTitle.textContent = "Could not load WHOOP data";
  elements.heroSubtitle.textContent = message;
  [
    elements.cardGrid,
    elements.bodyMetrics,
    elements.storyList,
    elements.correlationList,
    elements.recoveryChart,
    elements.sleepChart,
    elements.workoutChart,
    elements.cycleChart,
    elements.highlightGrid,
    elements.monthGrid,
    elements.sourceGrid,
    elements.rawGrid,
  ].forEach((node) => {
    node.innerHTML = "";
    node.appendChild(cloneEmptyState());
  });
  elements.bodyNote.textContent = "";
  elements.cycleNote.textContent = "";
  elements.recentTableBody.innerHTML = '<tr><td colspan="13">No recent data available.</td></tr>';
}

function renderDashboard(data) {
  renderHero(data);
  renderCards(data.cards || []);
  renderBody(data.bodyMeasurements || {}, data.metrics?.body || {});
  renderStories(data.insights || []);
  renderCorrelations(data.metrics?.correlations || []);
  renderRecovery(data.series?.recovery || [], data.metrics?.recovery || {});
  renderSleep(data.series?.sleep || [], data.metrics?.sleep || {});
  renderWorkouts(data.series?.workouts || [], data.metrics?.workouts || {});
  renderCycles(data.series?.cycles || [], data.metrics?.cycles || {});
  renderHighlights(data.highlights || []);
  renderMonths(data.monthly || []);
  renderRecentTable(data.recentDays || []);
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
    elements.heroSubtitle.textContent = `A live read on body, recovery, sleep, training, and cycle physiology across ${data.dateRange?.days || 0} days of collected history.`;
    elements.generatedAt.textContent = `Updated ${formatDateTime(data.generatedAt)}`;
  }

  const meta = [
    { label: "Date Range", value: `${formatDate(data.dateRange?.start)} to ${formatDate(data.dateRange?.end)}` },
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

function renderRecovery(series, metrics) {
  const data = series.slice(-21);
  elements.recoveryNote.textContent = `Avg ${formatNumber(metrics.average)} | HRV ${formatNumber(metrics.averageHrv)} | RHR ${formatNumber(metrics.averageRestingHeartRate)} | SpO2 ${formatNumber(metrics.averageSpo2)} | Skin ${formatNumber(metrics.averageSkinTempC)} C`;
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

function renderSleep(series, metrics) {
  const data = series.slice(-14);
  elements.sleepNote.textContent = `Avg ${formatNumber(metrics.averageHours)}h asleep | ${formatNumber(metrics.averageNeedHours)}h needed | ${formatNumber(metrics.averageGapHours)}h gap`;
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

function renderWorkouts(series, metrics) {
  const data = series.slice(-14);
  const sports = (metrics.sports || [])
    .slice(0, 3)
    .map(([name, count]) => `${name} ${count}`)
    .join(" · ");
  elements.workoutNote.textContent = `${formatNumber(metrics.count)} sessions | ${formatNumber(metrics.totalDurationHours)}h total | ${sports}`;
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

function renderCycles(series, metrics) {
  const data = series.slice(-14);
  elements.cycleNote.textContent = `${formatNumber(metrics.count)} cycles | Avg strain ${formatNumber(metrics.averageStrain)} | Avg kJ ${formatNumber(metrics.averageKilojoule)} | Avg HR ${formatNumber(metrics.averageHeartRate)}`;
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

function isNumber(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

elements.refreshButton.addEventListener("click", () => loadDashboard(true));

loadDashboard();
