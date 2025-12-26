// === /herohealth/vr-groups/groups-hud-quest.js ===
// Food Groups VR — HUD Quest Binder (TOP-ONLY) — PRODUCTION
// ✅ แสดง GOAL/MINI ใน HUD บนเท่านั้น
// ✅ อัปเดต title/val + progress bar + mini timer
// ✅ ไม่สร้าง fg-questPanel (ล่าง) และจะลบทิ้งถ้ามี
// ✅ กัน bind ซ้ำ

(function(){
  'use strict';

  const doc = document;
  if (!doc) return;

  const NS = (window.GroupsHUD = window.GroupsHUD || {});
  if (NS.__questBoundTopOnly) return;
  NS.__questBoundTopOnly = true;

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function pct(prog,target){
    const p = Number(prog)||0;
    const t = Math.max(1, Number(target)||0);
    return clamp(p/t, 0, 1);
  }
  function setText(el, t){
    if (!el) return;
    el.textContent = String(t == null ? '' : t);
  }
  function setWidth(el, p){
    if (!el) return;
    el.style.width = Math.round(clamp(p,0,1)*100) + '%';
  }

  function removeBottomPanelIfAny(){
    const p = doc.getElementById('fg-questPanel');
    if (p && p.parentNode) {
      try{ p.parentNode.removeChild(p); }catch(_){}
    }
  }

  // cache nodes lazily
  let nGoalT, nGoalV, nMiniT, nMiniV, nGoalBar, nMiniBar, nMiniTimer;

  function ensureNodes(){
    nGoalT = nGoalT || doc.getElementById('hud-goal-title');
    nGoalV = nGoalV || doc.getElementById('hud-goal-val');
    nMiniT = nMiniT || doc.getElementById('hud-mini-title');
    nMiniV = nMiniV || doc.getElementById('hud-mini-val');

    nGoalBar = nGoalBar || doc.getElementById('hud-goal-bar');
    nMiniBar = nMiniBar || doc.getElementById('hud-mini-bar');
    nMiniTimer = nMiniTimer || doc.getElementById('hud-mini-timer');
  }

  function applyQuestUpdate(d){
    removeBottomPanelIfAny();
    ensureNodes();

    const goal = d && d.goal ? d.goal : null;
    const mini = d && d.mini ? d.mini : null;

    // GOAL
    setText(nGoalT, goal && goal.label ? goal.label : '—');
    setText(nGoalV, goal ? ((goal.prog|0) + '/' + (goal.target|0)) : '0/0');
    setWidth(nGoalBar, goal ? pct(goal.prog, goal.target) : 0);

    // MINI
    setText(nMiniT, mini && mini.label ? mini.label : '—');
    setText(nMiniV, mini ? ((mini.prog|0) + '/' + (mini.target|0)) : '0/0');
    setWidth(nMiniBar, mini ? pct(mini.prog, mini.target) : 0);

    // MINI timer
    if (mini && typeof mini.tLeft === 'number'){
      setText(nMiniTimer, `⏱️ ${Math.max(0, mini.tLeft|0)}s`);
    } else {
      setText(nMiniTimer, '');
    }
  }

  removeBottomPanelIfAny();

  window.addEventListener('quest:update', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    applyQuestUpdate(d);
  }, { passive:true });

})();