// === /herohealth/hydration-vr/hydration.shared.js ===
// Hydration Shared Helpers
// PATCH v20260315-HYD-INTEGRATION

export const HYD_GAME = 'hydration';
export const HYD_DEFAULT_CAT = 'nutrition';

export const HYD_STICKER_META = {
  final_clear:   { icon:'👑', label:'ชนะด่านสุดท้าย' },
  rank_s:        { icon:'⭐', label:'แรงก์ S' },
  combo_10:      { icon:'✨', label:'คอมโบ 10+' },
  missions_3:    { icon:'🎯', label:'ภารกิจครบ' },
  shield_master: { icon:'🛡️', label:'ใช้โล่เก่ง' }
};

export function hhDayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function safeJsonParse(raw, fallback=null){
  try{
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){
    return fallback;
  }
}

export function gateDoneKey(kind, cat, game, pid, day=hhDayKey()){
  return `HHA_${String(kind).toUpperCase()}_DONE:${cat}:${game}:${pid}:${day}`;
}

export function cooldownOldKey(cat, pid, day=hhDayKey()){
  return `HHA_COOLDOWN_DONE:${cat}:${pid}:${day}`;
}

export function cooldownNewKey(cat, game, pid, day=hhDayKey()){
  return `HHA_COOLDOWN_DONE:${cat}:${game}:${pid}:${day}`;
}

export function isGateDone(kind, cat, game, pid){
  try{
    const day = hhDayKey();
    if(localStorage.getItem(gateDoneKey(kind, cat, game, pid, day)) === '1') return true;

    if(String(kind).toLowerCase() === 'cooldown'){
      if(localStorage.getItem(cooldownNewKey(cat, game, pid, day)) === '1') return true;
      if(localStorage.getItem(cooldownOldKey(cat, pid, day)) === '1') return true;
    }

    return false;
  }catch(e){
    return false;
  }
}

export function setGateDone(kind, cat, game, pid){
  try{
    const day = hhDayKey();
    localStorage.setItem(gateDoneKey(kind, cat, game, pid, day), '1');

    if(String(kind).toLowerCase() === 'cooldown'){
      localStorage.setItem(cooldownNewKey(cat, game, pid, day), '1');
      localStorage.setItem(cooldownOldKey(cat, pid, day), '1');
    }
  }catch(e){}
}

export function loadHydShelf(pid){
  try{
    const raw = localStorage.getItem(`HYD_SHELF:${pid}`) || '';
    return raw ? JSON.parse(raw) : {
      bestScore: 0,
      bestGrade: '—',
      finalClearCount: 0,
      totalRuns: 0,
      stickers: {},
      lastReward: null
    };
  }catch(e){
    return {
      bestScore: 0,
      bestGrade: '—',
      finalClearCount: 0,
      totalRuns: 0,
      stickers: {},
      lastReward: null
    };
  }
}

export function saveHydShelf(pid, shelf){
  try{
    localStorage.setItem(`HYD_SHELF:${pid}`, JSON.stringify(shelf || {}));
  }catch(e){}
}

export function hydrationShelfText(shelf){
  const stickers = Object.keys(shelf?.stickers || {}).length;
  return `สะสมแล้ว ${stickers} รางวัล • best ${shelf?.bestScore || 0} • grade สูงสุด ${shelf?.bestGrade || '—'}`;
}

export function rewardStickerKeys(summary){
  const out = [];
  if(summary?.reason === 'final-clear') out.push('final_clear');
  if(summary?.grade === 'S') out.push('rank_s');
  if((summary?.comboMax || 0) >= 10) out.push('combo_10');
  if((summary?.missionsDone || 0) >= 3) out.push('missions_3');
  if((summary?.blockCount || 0) >= 3) out.push('shield_master');
  return out;
}

export function rewardCardTitle(summary){
  if(summary?.reason === 'final-clear') return '👑 Hydration Champion';
  if(summary?.grade === 'S') return '⭐ Water Master';
  if(summary?.grade === 'A') return '💙 Great Water Hero';
  if(summary?.grade === 'B') return '💧 Water Hero';
  return '🌈 Rising Player';
}

export function rewardCardMini(summary, shelf){
  const stickerCount = Object.keys(shelf?.stickers || {}).length;
  return `Best ${shelf?.bestScore || 0} • Grade สูงสุด ${shelf?.bestGrade || '—'} • สะสม ${stickerCount} รางวัล`;
}

export function saveHydrationRewards(pid, summary, nowIso=''){
  const shelf = loadHydShelf(pid);
  shelf.totalRuns = (shelf.totalRuns || 0) + 1;
  shelf.bestScore = Math.max(Number(shelf.bestScore || 0), Number(summary?.scoreFinal || 0));

  const gradeRank = { '—':0, D:1, C:2, B:3, A:4, S:5 };
  const currentBest = String(shelf.bestGrade || '—');
  const newGrade = String(summary?.grade || '—');
  if((gradeRank[newGrade] || 0) > (gradeRank[currentBest] || 0)){
    shelf.bestGrade = newGrade;
  }

  if(summary?.reason === 'final-clear'){
    shelf.finalClearCount = (shelf.finalClearCount || 0) + 1;
  }

  shelf.lastReward = {
    title: rewardCardTitle(summary),
    grade: summary?.grade || '—',
    score: Number(summary?.scoreFinal || 0),
    reason: summary?.reason || '',
    at: nowIso || new Date().toISOString()
  };

  shelf.stickers = shelf.stickers || {};
  rewardStickerKeys(summary).forEach(k => { shelf.stickers[k] = true; });

  saveHydShelf(pid, shelf);
  return shelf;
}