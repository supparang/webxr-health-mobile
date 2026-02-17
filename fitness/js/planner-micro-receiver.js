// === /fitness/js/planner-micro-receiver.js ===
// Planner-side receiver (local-only). Stores events by sessionId.

'use strict';

const LS_FIT_EVENTS_PREFIX = 'HHA_FIT_EVENTS_'; // + sessionId

function safeJSON(x){ try{ return JSON.stringify(x); }catch(_){ return ''; } }

export function appendPlannerEvent(row){
  const sid = row.sessionId || 'unknown';
  const key = LS_FIT_EVENTS_PREFIX + sid;

  let arr = [];
  try{ arr = JSON.parse(localStorage.getItem(key) || '[]'); }catch(_){ arr = []; }
  arr.push(row);
  try{ localStorage.setItem(key, JSON.stringify(arr)); }catch(_){}
}

export function attachPlannerMicroReceiver(getRuntime){
  // getRuntime() should return {sessionId,pid,studyId,phase,conditionGroup,seed,classRoom,siteCode}
  function ingest(payload){
    if(!payload || !payload.type || !payload.game) return;
    const R = (typeof getRuntime === 'function') ? (getRuntime() || {}) : {};

    appendPlannerEvent({
      at: payload.at || Date.now(),
      sessionId: payload.sessionId || R.sessionId || 'unknown',
      pid: payload.pid || R.pid || 'anon',
      studyId: payload.studyId || R.studyId || '',
      phase: payload.phase || R.phase || '',
      conditionGroup: payload.conditionGroup || R.conditionGroup || '',
      seed: payload.seed || R.seed || '',
      classRoom: payload.classRoom || R.classRoom || '',
      siteCode: payload.siteCode || R.siteCode || '',
      game: payload.game,
      type: payload.type,
      t_ms: payload.t_ms ?? '',
      meta: payload.meta ? safeJSON(payload.meta) : ''
    });
  }

  // same window
  window.addEventListener('hh:micro', (e)=> ingest(e?.detail));

  // iframe postMessage
  window.addEventListener('message', (e)=>{
    const d = e.data;
    if(!d || d.type !== 'HHA_MICRO') return;
    ingest(d.payload);
  });

  return { ingest };
}