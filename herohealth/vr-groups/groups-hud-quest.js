// === /herohealth/vr-groups/groups-hud-quest.js ===
// Food Groups VR — HUD Quest Binder (TOP-ONLY) — PRODUCTION
// ✅ Quest แสดง "บน" (ใน HUD) เท่านั้น
// ✅ ไม่สร้าง fg-questPanel (ล่าง) ไม่ให้ซ้อน
// ✅ ฟัง quest:update แล้วอัปเดต element ใน HUD แบบ compat หลายชื่อ
// ✅ กัน bind ซ้ำ (idempotent)

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

  // ---------- find HUD slots (support many ids/selectors) ----------
  function findOne(selectors){
    for (let i=0;i<selectors.length;i++){
      const el = doc.querySelector(selectors[i]);
      if (el) return el;
    }
    return null;
  }

  // Group label (current group)
  const SEL_GROUP = [
    '[data-fg-group]',
    '#fgGroupLabel',
    '#hud-group',
    '.hud-group'
  ];

  // GOAL
  const SEL_GOAL_TITLE = [
    '[data-hha-goal-title]',
    '#hud-goal-title',
    '#goalTitle',
    '#fgGoalTitle'
  ];
  const SEL_GOAL_VAL = [
    '[data-hha-goal-val]',
    '#hud-goal-val',
    '#goalVal',
    '#fgGoalVal'
  ];
  const SEL_GOAL_BAR = [
    '[data-hha-goal-bar] .fill',
    '#hud-goal-bar .fill',
    '#goalBar',
    '#fgGoalBar'
  ];

  // MINI
  const SEL_MINI_TITLE = [
    '[data-hha-mini-title]',
    '#hud-mini-title',
    '#miniTitle',
    '#fgMiniTitle'
  ];
  const SEL_MINI_VAL = [
    '[data-hha-mini-val]',
    '#hud-mini-val',
    '#miniVal',
    '#fgMiniVal'
  ];
  const SEL_MINI_BAR = [
    '[data-hha-mini-bar] .fill',
    '#hud-mini-bar .fill',
    '#miniBar',
    '#fgMiniBar'
  ];
  const SEL_MINI_TIMER = [
    '[data-hha-mini-timer]',
    '#hud-mini-timer',
    '#miniTimer',
    '#fgMiniTimer'
  ];

  // Optional warn
  const SEL_WARN = [
    '[data-fg-quest-warn]',
    '#fgQuestWarn',
    '#hud-quest-warn'
  ];

  // cache nodes lazily
  let nGroup, nGoalT, nGoalV, nGoalB, nMiniT, nMiniV, nMiniB, nMiniTimer, nWarn;

  function ensureNodes(){
    nGroup = nGroup || findOne(SEL_GROUP);
    nGoalT = nGoalT || findOne(SEL_GOAL_TITLE);
    nGoalV = nGoalV || findOne(SEL_GOAL_VAL);
    nGoalB = nGoalB || findOne(SEL_GOAL_BAR);

    nMiniT = nMiniT || findOne(SEL_MINI_TITLE);
    nMiniV = nMiniV || findOne(SEL_MINI_VAL);
    nMiniB = nMiniB || findOne(SEL_MINI_BAR);
    nMiniTimer = nMiniTimer || findOne(SEL_MINI_TIMER);

    nWarn = nWarn || findOne(SEL_WARN);
  }

  // ---------- IMPORTANT: kill any old bottom panel if still exists ----------
  function removeBottomPanelIfAny(){
    const p = doc.getElementById('fg-questPanel');
    if (p && p.parentNode) {
      try{ p.parentNode.removeChild(p); }catch(_){}
    }
  }
  removeBottomPanelIfAny();

  // ---------- apply quest update ----------
  function applyQuestUpdate(d){
    ensureNodes();
    removeBottomPanelIfAny();

    const questOk = !!(d && d.questOk);
    const groupLabel = (d && d.groupLabel) ? String(d.groupLabel) : '';

    if (nWarn){
      nWarn.style.display = questOk ? 'none' : '';
      if (!questOk) setText(nWarn, '⚠️ Quest not ready');
    }

    if (nGroup){
      setText(nGroup, groupLabel || '—');
    }

    const goal = d && d.goal ? d.goal : null;
    const mini = d && d.mini ? d.mini : null;

    // GOAL
    if (nGoalT) setText(nGoalT, goal && goal.label ? goal.label : '—');
    if (nGoalV) setText(nGoalV, goal ? ((goal.prog|0) + '/' + (goal.target|0)) : '0/0');
    if (nGoalB) setWidth(nGoalB, goal ? pct(goal.prog, goal.target) : 0);

    // MINI
    if (nMiniT) setText(nMiniT, mini && mini.label ? mini.label : '—');
    if (nMiniV) setText(nMiniV, mini ? ((mini.prog|0) + '/' + (mini.target|0)) : '0/0');
    if (nMiniB) setWidth(nMiniB, mini ? pct(mini.prog, mini.target) : 0);

    // MINI timer (optional)
    if (nMiniTimer){
      if (mini && typeof mini.tLeft === 'number'){
        setText(nMiniTimer, `⏱️ ${Math.max(0, mini.tLeft|0)}s`);
      } else {
        setText(nMiniTimer, '');
      }
    }
  }

  window.addEventListener('quest:update', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    applyQuestUpdate(d);
  }, { passive:true });

})();