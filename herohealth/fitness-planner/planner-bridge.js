// === /herohealth/fitness-planner/planner-bridge.js ===
// Planner Bridge — v20260211a
(function(){
  'use strict';
  const WIN = window, DOC = document;
  if(!DOC) return;

  function qs(k, d=''){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch{ return d; }
  }
  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
  }

  const from = (qs('from','') || '').toLowerCase();
  const comboRaw = qs('combo','');
  const combo = comboRaw ? comboRaw.split('|').filter(Boolean) : [];
  const mode = (qs('mode','play') || 'play').toLowerCase();
  const seed = (Number(qs('seed','0')) >>> 0);
  const view = (qs('view','') || '').toLowerCase();

  const pid = qs('pid','');
  const studyId = qs('studyId','');
  const phase = qs('phase','');
  const conditionGroup = qs('conditionGroup','');
  const log = qs('log','');

  const isFromPlanner = (from === 'planner' && combo.length > 0);

  WIN.HHA_PLANNER = {
    from: isFromPlanner,
    combo,
    mode,
    seed,
    view,
    pid, studyId, phase, conditionGroup,
    log
  };

  if(!isFromPlanner) return;

  try{
    const pill = DOC.createElement('div');
    pill.style.position = 'fixed';
    pill.style.left = '10px';
    pill.style.top = 'calc(10px + env(safe-area-inset-top, 0px))';
    pill.style.zIndex = '9999';
    pill.style.padding = '7px 10px';
    pill.style.borderRadius = '999px';
    pill.style.border = '1px solid rgba(148,163,184,.18)';
    pill.style.background = 'rgba(2,6,23,.55)';
    pill.style.color = 'rgba(229,231,235,1)';
    pill.style.font = '800 12px/1.1 system-ui, -apple-system, Segoe UI, Roboto, Arial';
    pill.style.pointerEvents = 'none';
    pill.textContent = `🧩 Planner · ${combo.length} ท่า · ${mode}`;
    DOC.body.appendChild(pill);
    setTimeout(()=>{ try{ pill.remove(); }catch(e){} }, 4500);
  }catch(e){}

  const payload = {
    from: 'planner',
    combo,
    mode,
    seed,
    view,
    pid, studyId, phase, conditionGroup,
    log
  };

  emit('planner_combo', payload);
  emit('hha:event', Object.assign({ game:'fitness', type:'planner_combo' }, payload));
})();