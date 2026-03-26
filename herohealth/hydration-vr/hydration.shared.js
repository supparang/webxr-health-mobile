// === /herohealth/hydration-vr/hydration.shared.js ===
// HeroHealth Hydration VR Shared Utilities
// FULL PATCH v20260326-HYD-SHARED-HUBV2-R1

'use strict';

export const HYD_GAME = 'hydration';
export const HYD_DEFAULT_CAT = 'nutrition';

export const HYD_STICKER_META = {
  first_drop: {
    icon: '💧',
    label: 'เริ่มภารกิจ'
  },
  shield_guard: {
    icon: '🛡️',
    label: 'ผู้พิทักษ์โล่'
  },
  combo_star: {
    icon: '⭐',
    label: 'คอมโบสวย'
  },
  mission_master: {
    icon: '🎯',
    label: 'ภารกิจครบ'
  },
  s_rank: {
    icon: '🏅',
    label: 'S Rank'
  },
  final_crown: {
    icon: '👑',
    label: 'พิชิตด่านสุดท้าย'
  }
};

function safeJsonParse(text, fallback){
  try{
    return JSON.parse(text);
  }catch(e){
    return fallback;
  }
}

function safeStorageGet(key, fallback=null){
  try{
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : raw;
  }catch(e){
    return fallback;
  }
}

function safeStorageSet(key, value){
  try{
    localStorage.setItem(key, value);
    return true;
  }catch(e){
    return false;
  }
}

function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

function gradeRank(g){
  const map = { S:5, A:4, B:3, C:2, D:1 };
  return map[String(g || '').toUpperCase()] || 0;
}

function gateKey(phase, cat, game, pid, day=todayKey()){
  return `HHA_GATE_DONE:${phase}:${cat}:${game}:${pid}:${day}`;
}

function legacyGateKeys(phase, cat, game, pid, day=todayKey()){
  return [
    `HHA_GATE_DONE:${phase}:${cat}:${pid}:${day}`,
    `HHA_GATE_DONE:${phase}:${game}:${pid}:${day}`,
    `HHA_GATE_DONE:${phase}:${cat}:${game}:${pid}`,
    `HHA_GATE_DONE:${phase}:${cat}:${pid}`,
    `HHA_GATE_DONE:${phase}:${game}:${pid}`,
  ];
}

export function isGateDone(phase, cat, game, pid, day=todayKey()){
  const main = safeStorageGet(gateKey(phase, cat, game, pid, day), null);
  if(main === '1') return true;

  for(const key of legacyGateKeys(phase, cat, game, pid, day)){
    if(safeStorageGet(key, null) === '1') return true;
  }
  return false;
}

export function setGateDone(phase, cat, game, pid, done=true, day=todayKey()){
  const value = done ? '1' : '0';
  safeStorageSet(gateKey(phase, cat, game, pid, day), value);
}

function shelfKey(pid){
  return `HHA_HYDRATION_SHELF:${String(pid || 'anon')}`;
}

function defaultShelf(){
  return {
    totalRuns: 0,
    finalClearCount: 0,
    bestScore: 0,
    bestGrade: '—',
    lastReward: '',
    lastPlayedAt: '',
    stickers: {},
    history: []
  };
}

function normalizeShelf(input){
  const base = defaultShelf();
  const src = (input && typeof input === 'object') ? input : {};

  const stickers = {};
  for(const k of Object.keys(HYD_STICKER_META)){
    stickers[k] = !!(src.stickers && src.stickers[k]);
  }

  const history = Array.isArray(src.history) ? src.history.slice(-12) : [];

  return {
    totalRuns: clamp(src.totalRuns ?? base.totalRuns, 0, 999999),
    finalClearCount: clamp(src.finalClearCount ?? base.finalClearCount, 0, 999999),
    bestScore: clamp(src.bestScore ?? base.bestScore, 0, 99999999),
    bestGrade: String(src.bestGrade ?? base.bestGrade || '—'),
    lastReward: String(src.lastReward ?? base.lastReward || ''),
    lastPlayedAt: String(src.lastPlayedAt ?? base.lastPlayedAt || ''),
    stickers,
    history
  };
}

export function loadHydShelf(pid='anon'){
  const raw = safeStorageGet(shelfKey(pid), null);
  if(!raw) return defaultShelf();
  return normalizeShelf(safeJsonParse(raw, defaultShelf()));
}

function saveHydShelf(pid='anon', shelf){
  const normalized = normalizeShelf(shelf);
  safeStorageSet(shelfKey(pid), JSON.stringify(normalized));
  return normalized;
}

function bestGradeAfter(prev, next){
  return gradeRank(next) >= gradeRank(prev) ? next : prev;
}

function unlockSticker(shelf, key){
  if(!HYD_STICKER_META[key]) return false;
  if(shelf.stickers[key]) return false;
  shelf.stickers[key] = true;
  return true;
}

function deriveReward(summary){
  if(summary?.reason === 'final-clear') return '👑 ชนะด่านสุดท้าย';
  if((summary?.missionsDone || 0) >= 3) return '🎯 ภารกิจครบ';
  if(String(summary?.grade || '') === 'S') return '🏅 S Rank';
  if((summary?.comboMax || 0) >= 10) return '⭐ คอมโบสวย';
  if((summary?.blockCount || 0) >= 3) return '🛡️ โล่แกร่ง';
  return '💧 เล่นจบรอบ';
}

function updateStickerUnlocks(shelf, summary){
  const unlockedNow = [];

  if((shelf.totalRuns || 0) <= 1){
    if(unlockSticker(shelf, 'first_drop')) unlockedNow.push('first_drop');
  }
  if((summary?.blockCount || 0) >= 3){
    if(unlockSticker(shelf, 'shield_guard')) unlockedNow.push('shield_guard');
  }
  if((summary?.comboMax || 0) >= 8){
    if(unlockSticker(shelf, 'combo_star')) unlockedNow.push('combo_star');
  }
  if((summary?.missionsDone || 0) >= 3){
    if(unlockSticker(shelf, 'mission_master')) unlockedNow.push('mission_master');
  }
  if(String(summary?.grade || '') === 'S'){
    if(unlockSticker(shelf, 's_rank')) unlockedNow.push('s_rank');
  }
  if(summary?.reason === 'final-clear'){
    if(unlockSticker(shelf, 'final_crown')) unlockedNow.push('final_crown');
  }

  return unlockedNow;
}

export function saveHydrationRewards(pid='anon', summary={}, isoNow=''){
  const shelf = loadHydShelf(pid);

  shelf.totalRuns += 1;
  if(summary?.reason === 'final-clear'){
    shelf.finalClearCount += 1;
  }

  const scoreFinal = clamp(summary?.scoreFinal || 0, 0, 99999999);
  if(scoreFinal > shelf.bestScore){
    shelf.bestScore = scoreFinal;
  }

  const grade = String(summary?.grade || 'D');
  shelf.bestGrade = bestGradeAfter(shelf.bestGrade, grade);
  shelf.lastReward = deriveReward(summary);
  shelf.lastPlayedAt = String(isoNow || new Date().toISOString());

  const unlockedNow = updateStickerUnlocks(shelf, summary);

  shelf.history.push({
    at: shelf.lastPlayedAt,
    score: scoreFinal,
    grade,
    reason: String(summary?.reason || ''),
    unlockedNow
  });
  shelf.history = shelf.history.slice(-12);

  return saveHydShelf(pid, shelf);
}

export function hydrationShelfText(shelf){
  const normalized = normalizeShelf(shelf);
  const owned = Object.values(normalized.stickers).filter(Boolean).length;
  const total = Object.keys(HYD_STICKER_META).length;

  const parts = [
    `สะสม ${owned}/${total} ชิ้น`,
    `Best ${normalized.bestScore}`,
    `Clear ${normalized.finalClearCount}`
  ];

  return parts.join(' • ');
}

export function rewardCardTitle(summary={}){
  const grade = String(summary?.grade || '').toUpperCase();
  if(summary?.reason === 'final-clear') return 'Hydration Crown Hero';
  if(grade === 'S') return 'Hydration S Champion';
  if((summary?.missionsDone || 0) >= 3) return 'Mission Master';
  if((summary?.comboMax || 0) >= 10) return 'Combo Water Star';
  if((summary?.blockCount || 0) >= 3) return 'Shield Guardian';
  if(grade === 'A') return 'Hydration Great Hero';
  if(grade === 'B') return 'Water Power Hero';
  return 'Hydration Hero';
}

export function rewardCardMini(summary={}, shelf={}){
  const normalized = normalizeShelf(shelf);
  const owned = Object.values(normalized.stickers).filter(Boolean).length;
  const total = Object.keys(HYD_STICKER_META).length;

  if(summary?.reason === 'final-clear'){
    return `วันนี้ชนะด่านสุดท้ายแล้ว และตอนนี้มีสติกเกอร์ ${owned}/${total} ชิ้น`;
  }
  if(String(summary?.grade || '').toUpperCase() === 'S'){
    return `ยอดเยี่ยมมาก ได้เกรด S แล้ว ตอนนี้สะสมสติกเกอร์ ${owned}/${total} ชิ้น`;
  }
  if((summary?.missionsDone || 0) >= 3){
    return `ภารกิจครบทั้งชุด เก็บสติกเกอร์ได้ ${owned}/${total} ชิ้นแล้ว`;
  }
  if((summary?.comboMax || 0) >= 10){
    return `คอมโบดีมาก รอบนี้กำลังเก็บคอลเลกชันได้เรื่อย ๆ (${owned}/${total})`;
  }
  return `เล่นต่ออีกนิดเพื่อปลดล็อกสติกเกอร์เพิ่ม ตอนนี้มี ${owned}/${total} ชิ้น`;
}