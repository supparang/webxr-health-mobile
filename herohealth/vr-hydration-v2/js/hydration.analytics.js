// === /herohealth/vr-hydration-v2/js/hydration.analytics.js ===
// Hydration V2 Teacher / Research Analytics
// PATCH v20260320n-HYDRATION-V2-ANALYTICS

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

  const memoryStats = collectMemoryStats(localStorageRef, { pid: scopePid, studyId: scopeStudy });
  const trends = buildTrends(scopedHistory);
  const progression = buildProgressionView(scopedSummary);
  const recommendation = buildRecommendation(memoryStats, trends, progression);

  return {
    memoryStats,
    trends,
    progression,
    recommendation
  };
}

function collectMemoryStats(storage, { pid = '', studyId = '' } = {}) {
  const modules = ['scenarios', 'evaluate', 'create'];
  const rows = [];
  const familyAgg = {};

  modules.forEach((moduleName) => {
    const key = `HHA_HYD_V2_MEMORY:${moduleName}:${pid || 'anon'}:${studyId || 'nostudy'}`;
    const parsed = readJson(storage, key, null);
    if (!parsed || typeof parsed !== 'object') return;

    const items = parsed.items && typeof parsed.items === 'object' ? parsed.items : {};
    const familyStats = parsed.familyStats && typeof parsed.familyStats === 'object' ? parsed.familyStats : {};

    Object.entries(familyStats).forEach(([family, stat]) => {
      const shown = positiveInt(stat?.shown);
      const correct = positiveInt(stat?.correct);
      const wrong = positiveInt(stat?.wrong);
      const success = positiveInt(stat?.success);
      const fail = positiveInt(stat?.fail);

      const mastery = shown > 0
        ? ((correct + success) / Math.max(1, shown)) * 100
        : 0;

      const weakness = (wrong + fail) - (correct + success);

      const row = {
        moduleName,
        family,
        shown,
        correct,
        wrong,
        success,
        fail,
        mastery: round1(mastery),
        weakness
      };

      rows.push(row);

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

    Object.keys(items).forEach((baseId) => {
      const stat = items[baseId] || {};
      rows.push({
        moduleName,
        family: inferFamilyFromBaseId(baseId),
        baseId,
        shown: positiveInt(stat?.shown),
        correct: positiveInt(stat?.correct),
        wrong: positiveInt(stat?.wrong),
        success: positiveInt(stat?.success),
        fail: positiveInt(stat?.fail),
        mastery: 0,
        weakness: 0
      });
    });
  });

  const families = Object.values(familyAgg).map((row) => {
    const mastery = row.shown > 0
      ? ((row.correct + row.success) / Math.max(1, row.shown)) * 100
      : 0;

    return {
      ...row,
      mastery: round1(mastery),
      weakness: (row.wrong + row.fail) - (row.correct + row.success)
    };
  });

  families.sort((a, b) => {
    if (a.weakness !== b.weakness) return b.weakness - a.weakness;
    return a.mastery - b.mastery;
  });

  return {
    familyRows: families,
    weakFamilies: families.slice(0, 3),
    strongFamilies: [...families].sort((a, b) => b.mastery - a.mastery).slice(0, 3),
    rawRows: rows
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

  const bossClearRate = percent(
    safe.filter(x => x?.finalChallengeCleared === true).length,
    safe.filter(x => x?.finalChallengeLabel).length || safe.length
  );

  return {
    latestStreak,
    latestTodayRuns,
    latestTotalRuns,
    bossClearRate: round1(bossClearRate),
    adaptiveSupportCount
  };
}

function buildRecommendation(memoryStats, trends, progression) {
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

  return 'ภาพรวมอยู่ในเกณฑ์ดี สามารถเพิ่มความหลากหลายของ prompt และติดตาม mastery ราย family ต่อได้';
}

function inferFamilyFromBaseId(baseId = '') {
  const v = String(baseId || '').toLowerCase();
  if (v.includes('sweet')) return 'sweet_drink';
  if (v.includes('plan')) return 'best_plan';
  if (v.includes('hot')) return 'hot_weather';
  if (v.includes('activity') || v.includes('after')) return 'after_activity';
  if (v.includes('school')) return 'school_routine';
  return 'unknown';
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

function toMs(value) {
  const n = Date.parse(value || '');
  return Number.isFinite(n) ? n : 0;
}