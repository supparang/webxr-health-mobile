const LAST_KEY = 'HHA_LAST_SUMMARY';
const HISTORY_KEY = 'HHA_SUMMARY_HISTORY';

const CANONICAL_GAME_ID = 'brush';
const CANONICAL_GAME_VARIANT = 'kids-vr';
const CANONICAL_GAME_TITLE = 'Brush Kids';
const CANONICAL_ZONE = 'hygiene';

export function buildBrushResult({ state, totalZones, modeLabel }) {
  const coveragePercent = getCoveragePercent(state.zones);
  const zonesDone = state.zones.filter(z => z.done).length;
  const durationPlayedSec = Math.round(state.elapsedMs / 1000);

  const finalRank = getBrushRank({
    coveragePercent,
    zonesDone,
    totalZones,
    warnings: state.warnings
  });

  const advice = getBrushAdvice({
    coveragePercent,
    zonesDone,
    totalZones,
    warnings: state.warnings
  });

  const summaryTitle =
    coveragePercent >= 90 ? 'ฟันสดใสสุด ๆ!' :
    coveragePercent >= 75 ? 'ฟันสะอาดขึ้นมาก!' :
    coveragePercent >= 60 ? 'เก่งมาก ใกล้ครบแล้ว!' :
    'พยายามได้ดีมาก!';

  return {
    gameId: CANONICAL_GAME_ID,
    gameVariant: CANONICAL_GAME_VARIANT,
    gameTitle: CANONICAL_GAME_TITLE,
    zone: CANONICAL_ZONE,

    modeId: state.mode.id,
    modeLabel,

    durationPlannedSec: state.mode.durationSec,
    durationPlayedSec,
    timeText: formatTime(durationPlayedSec),

    coveragePercent,
    zonesDone,
    zonesTotal: totalZones,

    warnings: state.warnings,
    comboMax: state.comboMax,
    sparkleCount: state.sparkleCount,

    finalRank,
    advice,
    summaryTitle,
    coachMoodFinal: getCoachMood(coveragePercent, state.warnings),

    zoneStatus: state.zones.map(z => ({
      id: z.id,
      label: z.label,
      clean: Math.round(z.clean),
      dwellMs: z.dwellMs,
      visited: !!z.visited,
      done: !!z.done
    })),

    endedAtIso: new Date().toISOString()
  };
}

export function saveBrushSummary(result) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(result));
  } catch {}
}

export function pushBrushSummaryHistory(result, limit = 20) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift(result);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, limit)));
  } catch {}
}

export function getBrushRank({ coveragePercent, zonesDone, totalZones, warnings }) {
  if (coveragePercent >= 90 && zonesDone >= totalZones && warnings <= 3) {
    return 'Sparkle Hero';
  }
  if (coveragePercent >= 75 && zonesDone >= Math.max(5, totalZones - 1)) {
    return 'Clean Star';
  }
  if (coveragePercent >= 60 && zonesDone >= Math.max(4, totalZones - 2)) {
    return 'Smile Helper';
  }
  return 'Keep Practicing';
}

export function getBrushAdvice({ coveragePercent, zonesDone, totalZones, warnings }) {
  if (coveragePercent < 60) {
    return 'ครั้งหน้าลองแปรงให้ครบทุกโซนและค่อย ๆ ถูอย่างสม่ำเสมอนะ';
  }
  if (zonesDone < totalZones) {
    return 'ยังเหลือบางโซนอยู่ ลองดูแผนที่ฟันให้ครบทุกส่วนอีกนิด';
  }
  if (warnings >= 5) {
    return 'ดีมากแล้ว ลองช้าลงอีกนิด จะสะอาดขึ้นกว่าเดิม';
  }
  return 'ยอดเยี่ยม! รักษานิสัยแปรงแบบนี้ต่อไปได้เลย';
}

function getCoachMood(coveragePercent, warnings) {
  if (coveragePercent >= 85 && warnings <= 3) return 'happy';
  if (coveragePercent >= 60) return 'neutral';
  if (warnings >= 6) return 'sad';
  return 'fever';
}

function getCoveragePercent(zones) {
  const total = zones.reduce((sum, z) => sum + z.clean, 0);
  return Math.round((total / (zones.length * 100)) * 100);
}

function formatTime(totalSec) {
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}