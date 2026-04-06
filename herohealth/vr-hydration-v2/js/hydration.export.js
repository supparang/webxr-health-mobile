// === /herohealth/vr-hydration-v2/js/hydration.export.js ===
// Hydration V2 Export-ready Research Bundle / CSV
// PATCH v20260320q-HYDRATION-V2-EXPORT-COMPARISON

export function buildResearchExportBundle({
  payload = null,
  history = [],
  summaryHistory = [],
  analytics = {}
} = {}) {
  const meta = {
    exportedAt: new Date().toISOString(),
    exportVersion: '20260320q',
    scopeType: payload?.scopeType || 'filtered',
    scopeValue: payload?.scopeValue || 'all'
  };

  const records = Array.isArray(payload?.items) ? payload.items : [];
  const familyRows = Array.isArray(analytics?.memoryStats?.familyRows)
    ? analytics.memoryStats.familyRows
    : [];
  const comparisonRows = Array.isArray(analytics?.comparison?.rows)
    ? analytics.comparison.rows
    : [];

  const trendRows = [
    {
      metric: 'records',
      value: Number(analytics?.trends?.records || 0)
    },
    {
      metric: 'avg_total_last5',
      value: Number(analytics?.trends?.avgTotal || 0)
    },
    {
      metric: 'avg_planning_last5',
      value: Number(analytics?.trends?.avgPlanning || 0)
    },
    {
      metric: 'avg_social_last5',
      value: Number(analytics?.trends?.avgSocial || 0)
    },
    {
      metric: 'trend_label',
      value: String(analytics?.trends?.trendLabel || '-')
    },
    {
      metric: 'latest_streak',
      value: Number(analytics?.progression?.latestStreak || 0)
    },
    {
      metric: 'latest_today_runs',
      value: Number(analytics?.progression?.latestTodayRuns || 0)
    },
    {
      metric: 'latest_total_runs',
      value: Number(analytics?.progression?.latestTotalRuns || 0)
    },
    {
      metric: 'boss_clear_rate',
      value: Number(analytics?.progression?.bossClearRate || 0)
    },
    {
      metric: 'adaptive_support_count',
      value: Number(analytics?.progression?.adaptiveSupportCount || 0)
    },
    {
      metric: 'teacher_recommendation',
      value: String(analytics?.recommendation || '')
    }
  ];

  return {
    meta,
    payload,
    analytics,
    records,
    familyRows,
    comparisonRows,
    trendRows,
    history,
    summaryHistory
  };
}

export function buildRecordsCsvRows(records = []) {
  return records.map((item) => ({
    savedAt: item?.savedAt || '',
    pid: item?.pid || 'anon',
    studyId: item?.studyId || '',
    weekNo: item?.weekNo ?? '',
    sessionNo: item?.sessionNo ?? '',
    mode: item?.mode || '',
    type: item?.type || '',
    run: item?.run || '',
    totalScore: item?.totalScore ?? 0,
    actionScore: item?.actionScore ?? 0,
    knowledgeScore: item?.knowledgeScore ?? 0,
    planningScore: item?.planningScore ?? 0,
    socialScore: item?.socialScore ?? 0,
    goodCatch: item?.goodCatch ?? 0,
    badCatch: item?.badCatch ?? 0,
    missedGood: item?.missedGood ?? 0,
    bestCombo: item?.bestCombo ?? 0,
    rewardCount: item?.rewardCount ?? 0,
    teamMissionDone: item?.teamMissionDone ? 1 : 0,
    classTankContribution: item?.classTankContribution ?? 0,
    createdPlanScore: item?.createdPlanScore ?? 0,
    evaluateCorrect: item?.evaluateCorrect ? 1 : 0,
    scenarioSummary: item?.scenarioSummary || '',
    socialSummary: item?.socialSummary || ''
  }));
}

export function buildFamilyCsvRows(familyRows = []) {
  return familyRows.map((row) => ({
    family: row?.family || '',
    shown: row?.shown ?? 0,
    correct: row?.correct ?? 0,
    wrong: row?.wrong ?? 0,
    success: row?.success ?? 0,
    fail: row?.fail ?? 0,
    mastery: row?.mastery ?? 0,
    weakness: row?.weakness ?? 0
  }));
}

export function buildTrendCsvRows(trendRows = []) {
  return trendRows.map((row) => ({
    metric: row?.metric || '',
    value: row?.value ?? ''
  }));
}

export function buildComparisonCsvRows(rows = []) {
  return rows.map((row) => ({
    pid: row?.pid || '',
    studyId: row?.studyId || '',
    runs: row?.runs ?? 0,
    avgTotal: row?.avgTotal ?? 0,
    avgPlanning: row?.avgPlanning ?? 0,
    avgSocial: row?.avgSocial ?? 0,
    latestSavedAt: row?.latestSavedAt || '',
    latestScore: row?.latestScore ?? 0,
    latestStreak: row?.latestStreak ?? 0,
    latestTodayRuns: row?.latestTodayRuns ?? 0,
    latestTotalRuns: row?.latestTotalRuns ?? 0,
    bossClearRate: row?.bossClearRate ?? 0,
    weakFamily: row?.weakFamily || '',
    weakMastery: row?.weakMastery ?? 0
  }));
}

export function toCsv(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) return '';

  const headers = [...new Set(safeRows.flatMap((row) => Object.keys(row || {})))];
  const lines = [
    headers.join(',')
  ];

  safeRows.forEach((row) => {
    const line = headers.map((key) => csvEscape(row?.[key])).join(',');
    lines.push(line);
  });

  return lines.join('\n');
}

export function downloadTextFile(filename, text, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([String(text ?? '')], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}