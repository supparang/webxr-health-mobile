// === /herohealth/vr-hydration-v2/js/hydration.memory.js ===
// Hydration V2 Question Rotation Memory + Weighted Sampling
// PATCH v20260320m-HYDRATION-V2-MEMORY

export function buildMemoryKey(moduleName, pid = 'anon', studyId = 'nostudy') {
  return `HHA_HYD_V2_MEMORY:${moduleName}:${pid || 'anon'}:${studyId || 'nostudy'}`;
}

export function readMemory(moduleName, pid = 'anon', studyId = 'nostudy') {
  try {
    const raw = localStorage.getItem(buildMemoryKey(moduleName, pid, studyId));
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || typeof parsed !== 'object') {
      return {
        recent: [],
        items: {},
        familyStats: {},
        updatedAt: ''
      };
    }

    return {
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {},
      familyStats: parsed.familyStats && typeof parsed.familyStats === 'object' ? parsed.familyStats : {},
      updatedAt: parsed.updatedAt || ''
    };
  } catch (_) {
    return {
      recent: [],
      items: {},
      familyStats: {},
      updatedAt: ''
    };
  }
}

export function writeMemory(moduleName, pid = 'anon', studyId = 'nostudy', data = {}) {
  try {
    localStorage.setItem(
      buildMemoryKey(moduleName, pid, studyId),
      JSON.stringify({
        recent: Array.isArray(data.recent) ? data.recent : [],
        items: data.items && typeof data.items === 'object' ? data.items : {},
        familyStats: data.familyStats && typeof data.familyStats === 'object' ? data.familyStats : {},
        updatedAt: new Date().toISOString()
      })
    );
  } catch (_) {}
}

export function rememberExposure(moduleName, pid, studyId, baseId, family = '') {
  const mem = readMemory(moduleName, pid, studyId);

  if (!mem.items[baseId]) {
    mem.items[baseId] = {
      shown: 0,
      correct: 0,
      wrong: 0,
      success: 0,
      fail: 0,
      lastShownAt: '',
      lastResultAt: ''
    };
  }

  mem.items[baseId].shown += 1;
  mem.items[baseId].lastShownAt = new Date().toISOString();

  mem.recent = [baseId, ...mem.recent.filter(x => x !== baseId)].slice(0, 12);

  if (family) {
    if (!mem.familyStats[family]) {
      mem.familyStats[family] = {
        shown: 0,
        wrong: 0,
        correct: 0,
        success: 0,
        fail: 0
      };
    }
    mem.familyStats[family].shown += 1;
  }

  writeMemory(moduleName, pid, studyId, mem);
}

export function rememberResult(moduleName, pid, studyId, {
  baseId = '',
  family = '',
  correct = null,
  success = null
} = {}) {
  if (!baseId) return;

  const mem = readMemory(moduleName, pid, studyId);

  if (!mem.items[baseId]) {
    mem.items[baseId] = {
      shown: 0,
      correct: 0,
      wrong: 0,
      success: 0,
      fail: 0,
      lastShownAt: '',
      lastResultAt: ''
    };
  }

  const item = mem.items[baseId];

  if (correct === true) item.correct += 1;
  if (correct === false) item.wrong += 1;
  if (success === true) item.success += 1;
  if (success === false) item.fail += 1;

  item.lastResultAt = new Date().toISOString();

  if (family) {
    if (!mem.familyStats[family]) {
      mem.familyStats[family] = {
        shown: 0,
        wrong: 0,
        correct: 0,
        success: 0,
        fail: 0
      };
    }
    if (correct === true) mem.familyStats[family].correct += 1;
    if (correct === false) mem.familyStats[family].wrong += 1;
    if (success === true) mem.familyStats[family].success += 1;
    if (success === false) mem.familyStats[family].fail += 1;
  }

  writeMemory(moduleName, pid, studyId, mem);
}

export function computeItemWeight({
  item,
  memory,
  preferredFamily = '',
  moduleName = '',
  sessionNo = 1,
  weekNo = 1
} = {}) {
  const baseId = item?.id || '';
  const family = item?.family || '';
  const recent = new Set(Array.isArray(memory?.recent) ? memory.recent : []);
  const stats = memory?.items?.[baseId] || {};
  const familyStats = memory?.familyStats?.[family] || {};

  let weight = 1;

  // Preferred family / theme tie-in
  if (preferredFamily && family === preferredFamily) weight += 1.8;

  // Recently shown gets pushed down
  if (recent.has(baseId)) weight *= 0.28;

  // If previously wrong / failed, let it come back with better odds
  weight += Number(stats.wrong || 0) * 0.75;
  weight += Number(stats.fail || 0) * 0.60;

  // If repeatedly correct / successful, lower odds
  weight -= Number(stats.correct || 0) * 0.22;
  weight -= Number(stats.success || 0) * 0.18;

  // If family is still weak, keep asking around that family
  const famWrong = Number(familyStats.wrong || 0) + Number(familyStats.fail || 0);
  const famCorrect = Number(familyStats.correct || 0) + Number(familyStats.success || 0);
  if (famWrong > famCorrect) weight += 0.55;

  // Gentle curriculum drift by session/week
  const phaseIndex = Math.max(0, ((Number(weekNo || 1) - 1) * 2 + (Number(sessionNo || 1) - 1)));
  if (moduleName === 'scenarios' && phaseIndex >= 2 && family === 'best_plan') weight += 0.20;
  if (moduleName === 'evaluate' && phaseIndex >= 2 && family === 'best_plan') weight += 0.20;
  if (moduleName === 'create' && phaseIndex >= 2 && family === 'best_plan') weight += 0.24;

  return Math.max(0.05, Number(weight.toFixed(4)));
}

export function weightedPick(items = [], weightFn = () => 1, randomFn = Math.random) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length) return null;

  const weighted = safeItems.map(item => ({
    item,
    weight: Math.max(0.0001, Number(weightFn(item)) || 0.0001)
  }));

  const total = weighted.reduce((sum, row) => sum + row.weight, 0);
  let r = randomFn() * total;

  for (const row of weighted) {
    r -= row.weight;
    if (r <= 0) return row.item;
  }

  return weighted[weighted.length - 1]?.item || safeItems[0];
}