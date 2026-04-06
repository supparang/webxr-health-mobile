// === /herohealth/vr-hydration-v2/js/hydration.analytics.js ===
// Hydration V2 Teacher / Research Analytics + Multi-PID Comparison + Correlation View
// PATCH v20260320r-HYDRATION-V2-ANALYTICS-CORRELATION

export function buildTeacherAnalytics({
  payload = null,
  history = [],
  summaryHistory = [],
  localStorageRef = window.localStorage
} = {}) {
  const scopePid = payload?.scopeType === 'pid' ? String(payload.scopeValue || '') : '';
  const scopeStudy = payload?.scopeType === 'study' ? String(payload.scopeValue || '') : '';

  const scopedHistory = (Array.isArray(history) ? history : []).filter((item) => {
    if (!item || typeof item !== 'object') return false;
    if (scopePid && String(item.pid || '') !== scopePid) return false;
    if (scopeStudy && String(item.studyId || '') !== scopeStudy) return false;
    return true;
  });

  const scopedSummary = (Array.isArray(summaryHistory) ? summaryHistory : []).filter((item) => {
    if (!item || typeof item !== 'object') return false;
    if (scopePid && String(item.pid || '') !== scopePid) return false;
    if (scopeStudy && String(item.studyId || '') !== scopeStudy) return false;
    return true;
  });

  const memoryStats = collectMemoryStats(localStorageRef, {
    pid: scopePid,
    studyId: scopeStudy
  });

  const trends = buildTrends(scopedHistory);
  const progression = buildProgressionView(scopedSummary);

  const comparison = buildMultiPidComparison({
    payload,
    summaryHistory,
    localStorageRef,
    studyId: scopeStudy
  });

  const correlations = buildCorrelationView({
    history: scopedHistory,
    summaryHistory: scopedSummary
  });

  const recommendation = buildRecommendation(
    memoryStats,
    trends,
    progression,
    comparison,
    correlations
  );

  return {
    memoryStats,
    trends,
    progression,
    comparison,
    correlations,
    recommendation
  };
}

function collectMemoryStats(storage, { pid = '', studyId = '' } = {}) {
  const familyAgg = {};
  const rawRows = [];

  iterateMemoryEntries(storage, ({ moduleName, pid: rowPid, studyId: rowStudyId, parsed }) => {
    if (pid && rowPid !== pid) return;
    if (studyId && rowStudyId !== studyId) return;

    const familyStats = parsed.familyStats && typeof parsed.familyStats === 'object'
      ? parsed.familyStats
      : {};

    Object.entries(familyStats).forEach(([family, stat]) => {
      const shown = positiveInt(stat?.shown);
      const correct = positiveInt(stat?.correct);
      const wrong = positiveInt(stat?.wrong);
      const success = positiveInt(stat?.success);
      const fail = positiveInt(stat?.fail);

      rawRows.push({
        moduleName,
        pid: rowPid,
        studyId: rowStudyId,
        family,
        shown,
        correct,
        wrong,
        success,
        fail
      });

      if (!familyAgg[family]) {
        familyAgg[family] = {
          family,
          shown: 0,
          correct: 0,
          wrong: 0,
          success: 0,
          fail: 0
        };
      }

      familyAgg[family].shown += shown;
      familyAgg[family].correct += correct;
      familyAgg[family].wrong += wrong;
      familyAgg[family].success += success;
      familyAgg[family].fail += fail;
    });
  });

  const familyRows = Object.values(familyAgg).map((row) => {
    const mastery = row.shown > 0
      ? ((row.correct + row.success) / Math.max(1, row.shown)) * 100
      : 0;

    return {
      ...row,
      mastery: round1(mastery),
      weakness: (row.wrong + row.fail) - (row.correct + row.success)
    };
  });

  familyRows.sort((a, b) => {
    if (a.weakness !== b.weakness) return b.weakness - a.weakness;
    return a.mastery - b.mastery;
  });

  return {
    familyRows,
    weakFamilies: familyRows.slice(0, 3),
    strongFamilies: [...familyRows].sort((a, b) => b.mastery - a.mastery).slice(0, 3),
    rawRows
  };
}

function buildTrends(history = []) {
  const safe = [...history]
    .filter(Boolean)
    .sort((a, b) => toMs(a.savedAt) - toMs(b.savedAt));

  const last5 = safe.slice(-5);

  const avgTotal = average(last5.map(x => Number(x.totalScore || 0)));
  const avgPlanning = average(last5.map(x => Number(x.planningScore || 0)));
  const avgSocial = average(last5.map(x => Number(x.socialScore || 0)));

  const first = safe[0] || null;
  const last = safe[safe.length - 1] || null;

  const trendLabel = !first || !last
    ? 'insufficient'
    : Number(last.totalScore || 0) > Number(first.totalScore || 0)
      ? 'up'
      : Number(last.totalScore || 0) < Number(first.totalScore || 0)
        ? 'down'
        : 'flat';

  return {
    records: safe.length,
    avgTotal: round1(avgTotal),
    avgPlanning: round1(avgPlanning),
    avgSocial: round1(avgSocial),
    trendLabel,
    firstTotal: round1(Number(first?.totalScore || 0)),
    lastTotal: round1(Number(last?.totalScore || 0))
  };
}

function buildProgressionView(summaryHistory = []) {
  const safe = [...summaryHistory]
    .filter(Boolean)
    .sort((a, b) => toMs(b.savedAt) - toMs(a.savedAt));

  const latest = safe[0] || null;
  const latestStreak = positiveInt(latest?.progressionSnapshot?.streakDays);
  const latestTodayRuns = positiveInt(latest?.progressionSnapshot?.todayRuns);
  const latestTotalRuns = positiveInt(latest?.progressionSnapshot?.totalRuns);

  const adaptiveSupportCount = safe.reduce((sum, row) => {
    const hist = Array.isArray(row?.adaptiveHistory) ? row.adaptiveHistory : [];
    return sum + hist.filter(x => x?.label === 'support').length;
  }, 0);

  const bossAttempts = safe.filter(x => x?.finalChallengeLabel).length || safe.length;
  const bossClears = safe.filter(x => x?.finalChallengeCleared === true).length;
  const bossClearRate = percent(bossClears, bossAttempts);

  return {
    latestStreak,
    latestTodayRuns,
    latestTotalRuns,
    bossClearRate: round1(bossClearRate),
    adaptiveSupportCount
  };
}

function buildMultiPidComparison({
  payload = null,
  summaryHistory = [],
  localStorageRef = window.localStorage,
  studyId = ''
} = {}) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const byPid = {};

  items.forEach((item) => {
    if (!item || typeof item !== 'object') return;

    const pid = String(item.pid || 'anon');
    const rowStudy = String(item.studyId || '');
    if (studyId && rowStudy !== studyId) return;

    if (!byPid[pid]) {
      byPid[pid] = {
        pid,
        studyId: rowStudy,
        runs: 0,
        totalSum: 0,
        planningSum: 0,
        socialSum: 0,
        latestSavedAt: '',
        latestScore: 0,
        latestStreak: 0,
        latestTodayRuns: 0,
        latestTotalRuns: 0,
        bossAttempts: 0,
        bossClears: 0,
        weakFamily: '-',
        weakMastery: 0
      };
    }

    byPid[pid].runs += 1;
    byPid[pid].totalSum += Number(item.totalScore || 0);
    byPid[pid].planningSum += Number(item.planningScore || 0);
    byPid[pid].socialSum += Number(item.socialScore || 0);

    const itemSavedAt = String(item.savedAt || '');
    if (toMs(itemSavedAt) >= toMs(byPid[pid].latestSavedAt)) {
      byPid[pid].latestSavedAt = itemSavedAt;
      byPid[pid].latestScore = Number(item.totalScore || 0);
    }
  });

  const scopedSummary = (Array.isArray(summaryHistory) ? summaryHistory : []).filter((row) => {
    if (!row || typeof row !== 'object') return false;
    if (studyId && String(row.studyId || '') !== studyId) return false;
    return true;
  });

  const latestSummaryByPid = {};
  scopedSummary.forEach((row) => {
    const pid = String(row.pid || 'anon');
    if (!latestSummaryByPid[pid] || toMs(row.savedAt) > toMs(latestSummaryByPid[pid].savedAt)) {
      latestSummaryByPid[pid] = row;
    }
  });

  scopedSummary.forEach((row) => {
    const pid = String(row.pid || 'anon');
    if (!byPid[pid]) {
      byPid[pid] = {
        pid,
        studyId: String(row.studyId || ''),
        runs: 0,
        totalSum: 0,
        planningSum: 0,
        socialSum: 0,
        latestSavedAt: '',
        latestScore: 0,
        latestStreak: 0,
        latestTodayRuns: 0,
        latestTotalRuns: 0,
        bossAttempts: 0,
        bossClears: 0,
        weakFamily: '-',
        weakMastery: 0
      };
    }

    if (row.finalChallengeLabel) byPid[pid].bossAttempts += 1;
    if (row.finalChallengeCleared === true) byPid[pid].bossClears += 1;
  });

  Object.entries(latestSummaryByPid).forEach(([pid, row]) => {
    if (!byPid[pid]) return;
    byPid[pid].latestStreak = positiveInt(row?.progressionSnapshot?.streakDays);
    byPid[pid].latestTodayRuns = positiveInt(row?.progressionSnapshot?.todayRuns);
    byPid[pid].latestTotalRuns = positiveInt(row?.progressionSnapshot?.totalRuns);
  });

  const weakFamilyByPid = collectWeakFamilyByPid(localStorageRef, { studyId });

  Object.keys(byPid).forEach((pid) => {
    const weak = weakFamilyByPid[pid];
    if (weak) {
      byPid[pid].weakFamily = weak.family || '-';
      byPid[pid].weakMastery = round1(weak.mastery || 0);
    }
  });

  const rows = Object.values(byPid).map((row) => ({
    pid: row.pid,
    studyId: row.studyId,
    runs: row.runs,
    avgTotal: round1(percent(row.totalSum, Math.max(1, row.runs))),
    avgPlanning: round1(percent(row.planningSum, Math.max(1, row.runs))),
    avgSocial: round1(percent(row.socialSum, Math.max(1, row.runs))),
    latestSavedAt: row.latestSavedAt,
    latestScore: row.latestScore,
    latestStreak: row.latestStreak,
    latestTodayRuns: row.latestTodayRuns,
    latestTotalRuns: row.latestTotalRuns,
    bossClearRate: round1(percent(row.bossClears, Math.max(1, row.bossAttempts))),
    weakFamily: row.weakFamily,
    weakMastery: row.weakMastery
  }));

  rows.sort((a, b) => {
    if (b.avgTotal !== a.avgTotal) return b.avgTotal - a.avgTotal;
    return b.runs - a.runs;
  });

  const topRows = rows.slice(0, 5);
  const supportRows = [...rows]
    .sort((a, b) => {
      if (a.avgTotal !== b.avgTotal) return a.avgTotal - b.avgTotal;
      return a.weakMastery - b.weakMastery;
    })
    .slice(0, 5);

  return {
    rows,
    topRows,
    supportRows
  };
}

function buildCorrelationView({
  history = [],
  summaryHistory = []
} = {}) {
  const safeHistory = Array.isArray(history) ? history.filter(Boolean) : [];
  const safeSummary = Array.isArray(summaryHistory) ? summaryHistory.filter(Boolean) : [];

  const planningVsSocialPairs = safeHistory.map((row) => ({
    x: Number(row?.planningScore || 0),
    y: Number(row?.socialScore || 0)
  }));

  const totalVsKnowledgePairs = safeHistory.map((row) => ({
    x: Number(row?.knowledgeScore || 0),
    y: Number(row?.totalScore || 0)
  }));

  const streakVsTotalPairs = safeSummary.map((row) => ({
    x: positiveInt(row?.progressionSnapshot?.streakDays),
    y: Number(row?.totalScore || 0)
  }));

  const bossClearVsTotalPairs = safeSummary
    .filter((row) => row?.finalChallengeLabel)
    .map((row) => ({
      x: row?.finalChallengeCleared === true ? 1 : 0,
      y: Number(row?.totalScore || 0)
    }));

  const adaptiveSupportVsTotalPairs = safeSummary.map((row) => {
    const hist = Array.isArray(row?.adaptiveHistory) ? row.adaptiveHistory : [];
    const supportCount = hist.filter((x) => x?.label === 'support').length;
    return {
      x: supportCount,
      y: Number(row?.totalScore || 0)
    };
  });

  const rows = [
    buildCorrelationRow('planning_vs_social', 'Planning vs Social', planningVsSocialPairs),
    buildCorrelationRow('knowledge_vs_total', 'Knowledge vs Total', totalVsKnowledgePairs),
    buildCorrelationRow('streak_vs_total', 'Streak vs Total', streakVsTotalPairs),
    buildCorrelationRow('boss_clear_vs_total', 'Boss Clear vs Total', bossClearVsTotalPairs),
    buildCorrelationRow('adaptive_support_vs_total', 'Adaptive Support vs Total', adaptiveSupportVsTotalPairs)
  ];

  return {
    rows,
    strongest: [...rows]
      .filter((row) => row.n >= 3)
      .sort((a, b) => Math.abs(b.r || 0) - Math.abs(a.r || 0))
      .slice(0, 3)
  };
}

function buildCorrelationRow(id, label, pairs = []) {
  const filtered = pairs.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const r = pearson(filtered.map((p) => p.x), filtered.map((p) => p.y));

  return {
    id,
    label,
    n: filtered.length,
    r: round3(r),
    interpretation: interpretCorrelation(r)
  };
}

function pearson(xs = [], ys = []) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;

  const xMean = average(xs);
  const yMean = average(ys);

  let num = 0;
  let xDen = 0;
  let yDen = 0;

  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    num += dx * dy;
    xDen += dx * dx;
    yDen += dy * dy;
  }

  const den = Math.sqrt(xDen * yDen);
  if (!Number.isFinite(den) || den === 0) return 0;

  return num / den;
}

function interpretCorrelation(r = 0) {
  const abs = Math.abs(Number(r || 0));
  if (abs >= 0.7) return r > 0 ? 'strong positive' : 'strong negative';
  if (abs >= 0.4) return r > 0 ? 'moderate positive' : 'moderate negative';
  if (abs >= 0.2) return r > 0 ? 'weak positive' : 'weak negative';
  return 'little / none';
}

function collectWeakFamilyByPid(storage, { studyId = '' } = {}) {
  const pidFamilyAgg = {};

  iterateMemoryEntries(storage, ({ pid, studyId: rowStudyId, parsed }) => {
    if (studyId && rowStudyId !== studyId) return;

    const familyStats = parsed.familyStats && typeof parsed.familyStats === 'object'
      ? parsed.familyStats
      : {};

    if (!pidFamilyAgg[pid]) pidFamilyAgg[pid] = {};

    Object.entries(familyStats).forEach(([family, stat]) => {
      if (!pidFamilyAgg[pid][family]) {
        pidFamilyAgg[pid][family] = {
          family,
          shown: 0,
          correct: 0,
          wrong: 0,
          success: 0,
          fail: 0
        };
      }

      pidFamilyAgg[pid][family].shown += positiveInt(stat?.shown);
      pidFamilyAgg[pid][family].correct += positiveInt(stat?.correct);
      pidFamilyAgg[pid][family].wrong += positiveInt(stat?.wrong);
      pidFamilyAgg[pid][family].success += positiveInt(stat?.success);
      pidFamilyAgg[pid][family].fail += positiveInt(stat?.fail);
    });
  });

  const out = {};

  Object.entries(pidFamilyAgg).forEach(([pid, families]) => {
    const rows = Object.values(families).map((row) => {
      const mastery = row.shown > 0
        ? ((row.correct + row.success) / Math.max(1, row.shown)) * 100
        : 0;

      return {
        ...row,
        mastery: round1(mastery),
        weakness: (row.wrong + row.fail) - (row.correct + row.success)
      };
    });

    rows.sort((a, b) => {
      if (a.weakness !== b.weakness) return b.weakness - a.weakness;
      return a.mastery - b.mastery;
    });

    out[pid] = rows[0] || null;
  });

  return out;
}

function iterateMemoryEntries(storage, visitor) {
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key || !key.startsWith('HHA_HYD_V2_MEMORY:')) continue;

    const parsedKey = parseMemoryKey(key);
    if (!parsedKey) continue;

    const parsed = readJson(storage, key, null);
    if (!parsed || typeof parsed !== 'object') continue;

    visitor({
      moduleName: parsedKey.moduleName,
      pid: parsedKey.pid,
      studyId: parsedKey.studyId,
      parsed
    });
  }
}

function parseMemoryKey(key = '') {
  const parts = String(key).split(':');
  if (parts.length < 4) return null;
  return {
    moduleName: parts[1] || '',
    pid: parts[2] || '',
    studyId: parts.slice(3).join(':') || ''
  };
}

function buildRecommendation(memoryStats, trends, progression, comparison, correlations) {
  const weak = memoryStats?.weakFamilies?.[0];
  if (weak && weak.mastery < 55) {
    return `ควรเสริม family "${weak.family}" เพราะ mastery ยังต่ำ (${weak.mastery}%) และมี error สูง`;
  }

  if (trends?.trendLabel === 'down') {
    return 'คะแนนรวมมีแนวโน้มลดลง ควรลดความซับซ้อนของกิจกรรมและติดตามความเข้าใจระยะสั้น';
  }

  if (progression?.adaptiveSupportCount >= 3) {
    return 'ระบบ adaptive ช่วยหลายครั้ง แนะนำให้ติดตามว่าผู้เรียนยังต้องการ scaffold เพิ่มหรือไม่';
  }

  if (progression?.bossClearRate < 40) {
    return 'Final challenge ผ่านค่อนข้างน้อย อาจต้องลดความตึงของท้ายรอบหรือเสริมการเตรียมก่อนบอส';
  }

  if ((comparison?.rows || []).length >= 2) {
    const supportRow = comparison.supportRows?.[0];
    if (supportRow && supportRow.avgTotal < 90) {
      return `ควรติดตาม PID ${supportRow.pid} เพิ่ม เพราะ avg total ยังต่ำ (${supportRow.avgTotal}) และ weak family คือ ${supportRow.weakFamily || '-'}`;
    }
  }

  const strongest = correlations?.strongest?.[0];
  if (strongest && strongest.id === 'planning_vs_social' && strongest.r >= 0.4) {
    return 'Planning กับ Social มีความสัมพันธ์เชิงบวกพอสมควร อาจใช้กิจกรรมวางแผนเพื่อเสริมด้าน social ต่อได้';
  }

  return 'ภาพรวมอยู่ในเกณฑ์ดี สามารถเพิ่มความหลากหลายของ prompt และติดตาม mastery ราย family ต่อได้';
}

function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function positiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function average(arr = []) {
  const nums = arr.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function percent(num, den) {
  if (!den) return 0;
  return (Number(num || 0) / Number(den || 1)) * 100;
}

function round1(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? Number(n.toFixed(1)) : 0;
}

function round3(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? Number(n.toFixed(3)) : 0;
}

function toMs(value) {
  const n = Date.parse(value || '');
  return Number.isFinite(n) ? n : 0;
}