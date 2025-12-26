// === /herohealth/vr-groups/groups-hud-quest.js ===
// HUD Quest Binder (IIFE) — shows GOAL+MINI always
(function(){
  'use strict';
  const doc = document;
  if (!doc) return;

  const NS = (window.GroupsHUD = window.GroupsHUD || {});
  if (NS.__questBound) return;
  NS.__questBound = true;

  function $(id){ return doc.getElementById(id); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function pct(prog,target){
    const p = Number(prog)||0, t = Math.max(1, Number(target)||0);
    return clamp(p/t, 0, 1);
  }

  function applyQuestUpdate(d){
    const goal = d && d.goal ? d.goal : null;
    const mini = d && d.mini ? d.mini : null;

    const gTitle = $('hud-goal-title');
    const gVal   = $('hud-goal-val');
    const mTitle = $('hud-mini-title');
    const mVal   = $('hud-mini-val');

    if (gTitle) gTitle.textContent = goal && goal.label ? goal.label : '—';
    if (gVal)   gVal.textContent   = goal ? ((goal.prog|0)+'/'+(goal.target|0)) : '0/0';

    if (mTitle) mTitle.textContent = mini && mini.label ? mini.label : '—';
    if (mVal){
      const extra = (mini && typeof mini.tLeft === 'number') ? (' · ⏱️'+(mini.tLeft|0)+'s') : '';
      mVal.textContent = mini ? ((mini.prog|0)+'/'+(mini.target|0)+extra) : '0/0';
    }
  }

  window.addEventListener('quest:update', (ev)=>{
    applyQuestUpdate((ev && ev.detail) ? ev.detail : {});
  }, { passive:true });

})();