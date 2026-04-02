export function hhaNowRunMs(runStartedAt = 0) {
  return runStartedAt ? Math.max(0, Date.now() - runStartedAt) : 0;
}

export function hhaEnsurePhaseStat(phaseStats, phaseId = 'boot') {
  if (!phaseStats[phaseId]) {
    phaseStats[phaseId] = {
      enters: 0,
      clears: 0,
      timeouts: 0,
      mistakes: 0,
      correctHits: 0,
      wrongHits: 0,
      tips: 0
    };
  }
  return phaseStats[phaseId];
}

export function hhaPushEvent({
  eventLog,
  runId,
  runStartedAt,
  phaseId,
  type,
  data = {}
}) {
  const entry = {
    runId: runId || '',
    atMs: hhaNowRunMs(runStartedAt),
    phaseId: phaseId || 'boot',
    type,
    ...data
  };

  eventLog.push(entry);
  if (eventLog.length > 800) eventLog.shift();
  return entry;
}

export function hhaPersistArtifacts({
  storageEntries = {},
  windowEntries = {}
} = {}) {
  try {
    Object.keys(storageEntries).forEach(key => {
      const value = storageEntries[key];
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    });
  } catch {}

  Object.keys(windowEntries).forEach(key => {
    window[key] = windowEntries[key];
  });
}

export async function hhaCopyJson(obj) {
  const text = JSON.stringify(obj, null, 2);
  await navigator.clipboard.writeText(text);
  return text;
}