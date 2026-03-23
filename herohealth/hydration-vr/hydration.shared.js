// === /herohealth/hydration-vr/hydration.shared.js ===
// HeroHealth Hydration VR — shared helpers for hydration.safe.js
// PATCH v20260323-HYD-SHARED-COMPAT

'use strict';

export const HYD_GAME = 'hydration';
export const HYD_DEFAULT_CAT = 'nutrition';

export const HYD_STICKER_META = {
  first_play:   { icon:'💧', label:'เริ่มเล่นครั้งแรก' },
  grade_b:      { icon:'🌈', label:'เกรด B ขึ้นไป' },
  grade_a:      { icon:'💙', label:'เกรด A ขึ้นไป' },
  grade_s:      { icon:'⭐', label:'เกรด S' },
  combo_10:     { icon:'✨', label:'คอมโบ 10+' },
  shield_hero:  { icon:'🛡️', label:'นักป้องกัน' },
  mission_full: { icon:'🎯', label:'ภารกิจครบ' },
  final_clear:  { icon:'👑', label:'ชนะด่านสุดท้าย' },
  water_master: { icon:'🫧', label:'น้ำเหลือสูง' }
};

const STORE = {
  SHELF_PREFIX: 'HHA_HYD_SHELF',
  GATE_PREFIX: 'HHA_GATE_DONE'
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function normPid(pid) {
  const v = String(pid || 'anon').trim().replace(/[.#$[\]/]/g, '-');
  return v || 'anon';
}

function gradeRank(g) {
  const map = { D:1, C:2, B:3, A:4, S:5 };
  return map[String(g || '').toUpperCase()] || 0;
}

function defaultShelf(pid = 'anon') {
  return {
    pid: normPid(pid),
    bestScore: 0,
    bestGrade: '—',
    finalClearCount: 0,
    totalRuns: 0,
    lastPlayedAt: '',
    lastReward: '',
    stickers: {}
  };
}

function shelfKey(pid) {
  return `${STORE.SHELF_PREFIX}:${normPid(pid)}`;
}

function gateCandidates(gatePhase, cat, game, pid, day = todayKey()) {
  const P = String(gatePhase || '').trim();
  const C = String(cat || HYD_DEFAULT_CAT).trim();
  const G = String(game || HYD_GAME).trim();
  const U = normPid(pid);

  return [
    `${STORE.GATE_PREFIX}:${P}:${C}:${G}:${U}:${day}`,
    `${STORE.GATE_PREFIX}:${P}:${C}:${G}:${day}`,
    `${STORE.GATE_PREFIX}:${P}:${G}:${U}:${day}`,
    `${STORE.GATE_PREFIX}:${P}:${G}:${day}`,
    `HHA_${P.toUpperCase()}_DONE:${C}:${G}:${U}:${day}`,
    `HHA_${P.toUpperCase()}_DONE:${C}:${G}:${day}`,
    `HHA_${P.toUpperCase()}_DONE:${G}:${U}:${day}`,
    `HHA_${P.toUpperCase()}_DONE:${G}:${day}`
  ];
}

export function isGateDone(gatePhase, cat, game, pid, day = todayKey()) {
  const keys = gateCandidates(gatePhase, cat, game, pid, day);

  for (const key of keys) {
    const raw = safeGet(key, null);
    if (raw == null) continue;

    if (raw === '1' || raw === 'true') return true;

    const parsed = safeJsonParse(raw, null);
    if (parsed && typeof parsed === 'object') {
      if (parsed.done === true) return true;
      if (parsed.day && parsed.day === day) return true;
    }
  }

  return false;
}

export function setGateDone(gatePhase, cat, game, pid, day = todayKey()) {
  const key = gateCandidates(gatePhase, cat, game, pid, day)[0];
  return safeSet(key, JSON.stringify({
    done: true,
    gatePhase: String(gatePhase || ''),
    cat: String(cat || HYD_DEFAULT_CAT),
    game: String(game || HYD_GAME),
    pid: normPid(pid),
    day,
    ts: new Date().toISOString()
  }));
}

export function loadHydShelf(pid = 'anon') {
  const key = shelfKey(pid);
  const raw = safeGet(key, null);
  if (!raw) return defaultShelf(pid);

  const parsed = safeJsonParse(raw, null);
  if (!parsed || typeof parsed !== 'object') return defaultShelf(pid);

  return {
    ...defaultShelf(pid),
    ...parsed,
    pid: normPid(pid),
    stickers: {
      ...(defaultShelf(pid).stickers),
      ...(parsed.stickers || {})
    }
  };
}

function saveHydShelf(pid, shelf) {
  const key = shelfKey(pid);
  safeSet(key, JSON.stringify(shelf));
  return shelf;
}

function unlockSticker(stickers, key) {
  if (!HYD_STICKER_META[key]) return false;
  if (stickers[key]) return false;
  stickers[key] = true;
  return true;
}

function collectUnlockedLabels(stickers) {
  return Object.keys(HYD_STICKER_META).filter(k => stickers[k]);
}

export function hydrationShelfText(shelf) {
  const s = shelf || defaultShelf('anon');
  const unlocked = collectUnlockedLabels(s.stickers || {});
  const count = unlocked.length;

  if (count <= 0) {
    return 'ยังไม่มีของสะสม เริ่มเล่นเพื่อปลดล็อกสติกเกอร์นะ';
  }

  const bestGrade = s.bestGrade && s.bestGrade !== '—' ? `เกรดดีที่สุด ${s.bestGrade}` : 'ยังไม่มีเกรดสูงสุด';
  return `มีสติกเกอร์แล้ว ${count} ชิ้น • คะแนนดีที่สุด ${s.bestScore || 0} • ${bestGrade}`;
}

export function rewardCardTitle(summary = {}) {
  if (summary.reason === 'final-clear') return '👑 Final Clear Card';
  if (String(summary.grade || '').toUpperCase() === 'S') return '⭐ S Rank Card';
  if (String(summary.grade || '').toUpperCase() === 'A') return '💙 Great Hydration Card';
  if ((summary.missionsDone || 0) >= 3) return '🎯 Mission Master Card';
  if ((summary.comboMax || 0) >= 10) return '✨ Combo Star Card';
  if ((summary.blockCount || 0) >= 3) return '🛡️ Shield Hero Card';
  return '💧 Hydration Hero Card';
}

export function rewardCardMini(summary = {}, shelf = {}) {
  const grade = String(summary.grade || 'C').toUpperCase();
  const stickerCount = Object.keys((shelf && shelf.stickers) || {}).filter(k => shelf.stickers[k]).length;

  if (summary.reason === 'final-clear') {
    return `ชนะด่านสุดท้ายแล้ว • ปลดล็อกสติกเกอร์สะสม ${stickerCount} ชิ้น`;
  }
  if (grade === 'S') {
    return 'สุดยอดมาก! ได้เกรด S และเก็บน้ำได้ดีมาก';
  }
  if (grade === 'A') {
    return 'ทำได้ดีมาก เกือบสมบูรณ์แบบแล้ว';
  }
  if ((summary.missionsDone || 0) >= 3) {
    return 'ภารกิจครบทั้ง 3 อย่าง เก่งมากเลย';
  }
  if ((summary.comboMax || 0) >= 10) {
    return `คอมโบสูงสุด ${summary.comboMax} ครั้ง เล่นได้ลื่นมาก`;
  }
  if ((summary.blockCount || 0) >= 3) {
    return `กันสายฟ้าได้ ${summary.blockCount} ครั้งแล้ว`;
  }
  return 'เล่นจบรอบแล้ว ลองอีกครั้งเพื่อเก็บรางวัลเพิ่มนะ';
}

export function saveHydrationRewards(pid = 'anon', summary = {}, nowIso = new Date().toISOString()) {
  const shelf = loadHydShelf(pid);
  const stickers = { ...(shelf.stickers || {}) };

  shelf.totalRuns = Number(shelf.totalRuns || 0) + 1;
  shelf.lastPlayedAt = String(nowIso || new Date().toISOString());

  const scoreFinal = Number(summary.scoreFinal || 0);
  const comboMax = Number(summary.comboMax || 0);
  const blockCount = Number(summary.blockCount || 0);
  const missionsDone = Number(summary.missionsDone || 0);
  const waterPct = Number(summary.waterPct || 0);
  const grade = String(summary.grade || 'D').toUpperCase();

  if (scoreFinal > Number(shelf.bestScore || 0)) {
    shelf.bestScore = scoreFinal;
  }

  if (gradeRank(grade) > gradeRank(shelf.bestGrade)) {
    shelf.bestGrade = grade;
  }

  if (summary.reason === 'final-clear') {
    shelf.finalClearCount = Number(shelf.finalClearCount || 0) + 1;
  }

  unlockSticker(stickers, 'first_play');
  if (gradeRank(grade) >= gradeRank('B')) unlockSticker(stickers, 'grade_b');
  if (gradeRank(grade) >= gradeRank('A')) unlockSticker(stickers, 'grade_a');
  if (grade === 'S') unlockSticker(stickers, 'grade_s');
  if (comboMax >= 10) unlockSticker(stickers, 'combo_10');
  if (blockCount >= 3) unlockSticker(stickers, 'shield_hero');
  if (missionsDone >= 3) unlockSticker(stickers, 'mission_full');
  if (summary.reason === 'final-clear') unlockSticker(stickers, 'final_clear');
  if (waterPct >= 80) unlockSticker(stickers, 'water_master');

  shelf.stickers = stickers;

  let reward = '💧 เล่นจบรอบแล้ว';
  if (summary.reason === 'final-clear') reward = '👑 ชนะด่านสุดท้าย';
  else if (grade === 'S') reward = '⭐ ได้เกรด S';
  else if (missionsDone >= 3) reward = '🎯 ภารกิจครบ';
  else if (comboMax >= 10) reward = '✨ คอมโบสวย';
  else if (blockCount >= 3) reward = '🛡️ ป้องกันเก่ง';
  else if (grade === 'A') reward = '💙 เกรด A';

  shelf.lastReward = reward;

  return saveHydShelf(pid, shelf);
}