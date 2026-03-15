// /herohealth/vr-brush/brush.storage.js

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
    return raw ? JSON.parse(raw) : null;
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
  const ageMs = Date.now() - Date.parse(savedAt || 0);
  return Number.isFinite(ageMs) && ageMs <= maxAgeMs;
}