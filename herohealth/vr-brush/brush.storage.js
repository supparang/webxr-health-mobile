// /herohealth/vr-brush/brush.storage.js
// HOTFIX v20260316c-BRUSH-STORAGE-SAFE-MOBILE

export const LS_BRUSH_DRAFT = 'HHA_BRUSH_DRAFT';

export function saveBrushDraft(key, payload){
  try{
    localStorage.setItem(key || LS_BRUSH_DRAFT, JSON.stringify(payload));
    return true;
  }catch{
    return false;
  }
}

export function loadBrushDraft(key){
  try{
    const raw = localStorage.getItem(key || LS_BRUSH_DRAFT);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{
    return null;
  }
}

export function clearBrushDraft(key){
  try{
    localStorage.removeItem(key || LS_BRUSH_DRAFT);
    return true;
  }catch{
    return false;
  }
}

export function isFreshDraft(savedAt, maxAgeMs = 1000 * 60 * 20){
  const ts = Date.parse(savedAt || '');
  if(!Number.isFinite(ts)) return false;
  const ageMs = Date.now() - ts;
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

export function shouldOfferRestoreDraft(draft, {
  gameId = '',
  pid = '',
  run = '',
  maxAgeMs = 1000 * 60 * 20
} = {}){
  if(!draft) return false;
  if((draft.gameId || '') !== (gameId || '')) return false;
  if((draft.pid || '') !== (pid || '')) return false;
  if((draft.run || '') !== (run || '')) return false;
  if(!isFreshDraft(draft.savedAt, maxAgeMs)) return false;
  return true;
}

export function askRestoreDraft({
  draft,
  gameId = '',
  pid = '',
  run = '',
  maxAgeMs = 1000 * 60 * 20,
  silent = false
} = {}){
  if(!shouldOfferRestoreDraft(draft, { gameId, pid, run, maxAgeMs })){
    return false;
  }

  if(silent) return true;

  try{
    return !!window.confirm('พบเกม Brush ที่ค้างไว้ ต้องการเล่นต่อหรือไม่?');
  }catch{
    return false;
  }
}