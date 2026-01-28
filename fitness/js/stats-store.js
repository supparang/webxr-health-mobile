// === /fitness/js/stats-store.js ===
// Local stats store for VR Fitness Academy

'use strict';

const KEY = 'VRFIT_STATS_V1';

function safeParse(s){
  try{ return JSON.parse(s); }catch(_){ return null; }
}

export function recordSession(gameKey, summary){
  const raw = localStorage.getItem(KEY);
  const obj = safeParse(raw) || { sessions: [] };

  obj.sessions.push({
    game: gameKey,
    ...summary
  });

  // cap
  if (obj.sessions.length > 500) obj.sessions.splice(0, obj.sessions.length - 500);

  localStorage.setItem(KEY, JSON.stringify(obj));
}

export function loadSessions(){
  const raw = localStorage.getItem(KEY);
  const obj = safeParse(raw) || { sessions: [] };
  return Array.isArray(obj.sessions) ? obj.sessions : [];
}

export function clearSessions(){
  localStorage.removeItem(KEY);
}