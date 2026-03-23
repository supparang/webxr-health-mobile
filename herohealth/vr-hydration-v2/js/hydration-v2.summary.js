import { HYDRATION_V2_CONFIG } from './hydration-v2.config.js';

function computeStars(accuracy) {
  if (accuracy >= 90) return 3;
  if (accuracy >= 70) return 2;
  if (accuracy >= 1) return 1;
  return 0;
}

export function buildHydrationV2Summary(result, ctx) {
  const answerAccuracy = result.totalRounds ? Math.round((result.answerCorrect / result.totalRounds) * 100) : 0;
  const reasonAccuracy = result.totalRounds ? Math.round((result.reasonCorrect / result.totalRounds) * 100) : 0;
  const stars = computeStars(answerAccuracy);

  let lead = HYDRATION_V2_CONFIG.COPY.finishLow;
  if (answerAccuracy >= 90) lead = HYDRATION_V2_CONFIG.COPY.finishGood;
  else if (answerAccuracy >= 70) lead = HYDRATION_V2_CONFIG.COPY.finishMid;

  let tip = 'ลองคิดต่อว่าเวลาอากาศร้อนหรือหลังออกแรง เราควรเติมน้ำอย่างไร';
  if (answerAccuracy >= 90 && reasonAccuracy >= 80) {
    tip = 'ยอดเยี่ยมมาก! วันนี้ทั้งเลือกได้เหมาะและให้เหตุผลได้ดีมาก';
  } else if (answerAccuracy >= 70) {
    tip = 'ทำได้ดีมาก ลองฝึกอธิบายเหตุผลให้ชัดขึ้นอีกนิดนะ';
  }

  return {
    game: HYDRATION_V2_CONFIG.GAME_ID,
    zone: HYDRATION_V2_CONFIG.ZONE,
    title: HYDRATION_V2_CONFIG.TITLE,
    version: HYDRATION_V2_CONFIG.VERSION,
    sessionId: ctx.sessionId || '',
    pid: ctx.pid || '',
    score: result.score,
    totalRounds: result.totalRounds,
    answerCorrect: result.answerCorrect,
    reasonCorrect: result.reasonCorrect,
    answerAccuracy,
    reasonAccuracy,
    highConfidenceCount: result.highConfidenceCount,
    stars,
    durationSec: Math.max(1, Math.round(result.durationMs / 1000)),
    lead,
    tip,
    endedAt: new Date().toISOString()
  };
}

export function saveHydrationV2Summary(summary) {
  try {
    localStorage.setItem(HYDRATION_V2_CONFIG.STORAGE_KEYS.LAST_SUMMARY, JSON.stringify(summary));

    const raw = localStorage.getItem(HYDRATION_V2_CONFIG.STORAGE_KEYS.SUMMARY_HISTORY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(summary);
    while (arr.length > 20) arr.shift();
    localStorage.setItem(HYDRATION_V2_CONFIG.STORAGE_KEYS.SUMMARY_HISTORY, JSON.stringify(arr));
  } catch {}
}

export function goHydrationV2Hub(ctx) {
  location.href = ctx.hub || new URL('../hub.html', location.href).href;
}

export function goHydrationV2Cooldown(ctx) {
  const cooldown = new URL('../gate/cooldown-gate.html', location.href).href;
  const url = new URL(cooldown);
  const nextKey = `HHA_NEXT_HYDRATION_V2_COOLDOWN_${Date.now()}`;

  try {
    sessionStorage.setItem(nextKey, ctx.hub || new URL('../hub.html', location.href).href);
  } catch {}

  url.searchParams.set('game', 'hydration');
  url.searchParams.set('zone', HYDRATION_V2_CONFIG.ZONE);
  url.searchParams.set('hub', ctx.hub || new URL('../hub.html', location.href).href);
  url.searchParams.set('next', ctx.hub || new URL('../hub.html', location.href).href);
  url.searchParams.set('nextKey', nextKey);
  url.searchParams.set('pid', ctx.pid || '');

  const passthrough = ['studyId','runMode','phase','conditionGroup','studentKey','schoolCode','classRoom','studentNo','nickName','sessionId'];
  for (const key of passthrough) {
    if (ctx[key]) url.searchParams.set(key, ctx[key]);
  }

  location.href = url.href;
}