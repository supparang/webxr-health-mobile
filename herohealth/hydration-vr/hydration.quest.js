// === /herohealth/hydration-vr/hydration.quest.js ===
// Hydration Quest (SHIM/ADAPTER) — PRODUCTION
// ✅ Backward compatible: exports createHydrationQuest()
// ✅ Works with hydration.safe.js which already owns mission logic
// ✅ Adds: optional helper to reformat quest lines + emits quest:update passthrough
// ✅ Safe to include even if unused

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

/**
 * createHydrationQuest(opts?)
 * - If your engine used to call this, it will still work.
 * - In current Hydration SAFE, mission logic is inside hydration.safe.js.
 *   This adapter just provides a consistent interface and optional formatting.
 */
export function createHydrationQuest(opts = {}){
  const CFG = Object.assign({
    gameMode: 'hydration',
    // if you want, you can pass DOM ids for legacy UI
    ui: {
      line1: 'quest-line1',
      line2: 'quest-line2',
      line3: 'quest-line3',
      line4: 'quest-line4'
    }
  }, opts || {});

  const S = {
    active: true,
    stage: 1,
    goalsCleared: 0,
    goalsTotal: 1,
    miniCleared: 0,
    miniTotal: 0,
    miniUrgent: false
  };

  function updateFromSafe(payload){
    if (!payload || typeof payload !== 'object') return;

    // Accept either quest:update payload or hha:score payload
    if (payload.stage != null) S.stage = clamp(payload.stage,1,3)|0;

    if (payload.goalsCleared != null) S.goalsCleared = payload.goalsCleared|0;
    if (payload.goalsTotal != null) S.goalsTotal = payload.goalsTotal|0;

    if (payload.miniCleared != null) S.miniCleared = payload.miniCleared|0;
    if (payload.miniTotal != null) S.miniTotal = payload.miniTotal|0;

    if (payload.miniUrgent != null) S.miniUrgent = !!payload.miniUrgent;

    // Passthrough normalized quest update (useful for shared HUD/analytics)
    emit('quest:update', {
      gameMode: CFG.gameMode,
      stage: S.stage,
      goalsCleared: S.goalsCleared,
      goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared,
      miniTotal: S.miniTotal,
      miniUrgent: S.miniUrgent
    });
  }

  // Listen to hydration.safe.js events if present
  const onQuestUpdate = (ev)=> updateFromSafe(ev?.detail);
  const onScore = (ev)=> updateFromSafe(ev?.detail);

  try{
    WIN.addEventListener('quest:update', onQuestUpdate);
    WIN.addEventListener('hha:score', onScore);
  }catch(_){}

  function dispose(){
    if (!S.active) return;
    S.active = false;
    try{
      WIN.removeEventListener('quest:update', onQuestUpdate);
      WIN.removeEventListener('hha:score', onScore);
    }catch(_){}
  }

  // Legacy-friendly API surface
  return {
    getState: ()=>Object.assign({}, S),
    setStage: (n)=>{ S.stage = clamp(n,1,3)|0; },
    setGoal: (cleared,total)=>{
      S.goalsCleared = cleared|0; S.goalsTotal = Math.max(1,total|0);
      emit('quest:update', { gameMode: CFG.gameMode, stage:S.stage, goalsCleared:S.goalsCleared, goalsTotal:S.goalsTotal });
    },
    setMini: (cleared,total,urgent=false)=>{
      S.miniCleared = cleared|0; S.miniTotal = Math.max(0,total|0); S.miniUrgent = !!urgent;
      emit('quest:update', { gameMode: CFG.gameMode, stage:S.stage, miniCleared:S.miniCleared, miniTotal:S.miniTotal, miniUrgent:S.miniUrgent });
    },
    dispose
  };
}