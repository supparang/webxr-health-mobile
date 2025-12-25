// === /herohealth/vr-groups/groups-hud-quest.js ===
// Food Groups VR — HUD Quest Binder (IIFE) — FULL FIX-ALL
// ✅ Always shows GOAL + MINI even if HTML missing
// ✅ Listens quest:update emitted by groups-quests.js (and/or engine)
// ✅ Idempotent (bind once)
// ✅ Updates compat IDs if your page has older HUD elements
// ✅ Also supports groups:lock + groups:power (lock ring + power bar) if elements exist

(function () {
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

  // ---------- create Quest Panel if missing ----------
  function ensureQuestPanel(){
    let root = $('fg-questPanel');
    if (root) return root;

    root = doc.createElement('div');
    root.id = 'fg-questPanel';
    root.className = 'fg-questPanel';

    // Minimal inline style (เห็นแม้ css ยังไม่มา)
    Object.assign(root.style, {
      position: 'fixed',
      left: '12px',
      bottom: '12px',
      width: 'min(720px, calc(100vw - 24px))',
      background: 'rgba(2,6,23,.58)',
      border: '1px solid rgba(148,163,184,.18)',
      borderRadius: '18px',
      padding: '12px',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      color: '#e5e7eb',
      zIndex: 50,
      pointerEvents: 'none'
    });

    root.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div id="fg-questGroupLabel" style="font-weight:800;opacity:.95">หมู่ปัจจุบัน: —</div>
        <div id="fg-questWarn" style="font-size:12px;opacity:.8;display:none">⚠️ Quest not ready</div>
      </div>

      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:260px">
          <div style="font-weight:1000;letter-spacing:.5px;opacity:.9;margin-bottom:6px">GOAL</div>
          <div id="fg-goalText" style="opacity:.92;margin-bottom:6px">—</div>
          <div style="display:flex;gap:10px;align-items:center">
            <div style="flex:1;height:10px;border-radius:999px;background:rgba(148,163,184,.16);overflow:hidden">
              <div id="fg-goalBar" style="height:100%;width:0%;border-radius:999px;background:rgba(34,197,94,.95)"></div>
            </div>
            <div id="fg-goalCount" style="width:72px;text-align:right;opacity:.9;font-variant-numeric:tabular-nums">0/0</div>
          </div>
        </div>

        <div style="flex:1;min-width:260px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-weight:1000;letter-spacing:.5px;opacity:.9">MINI</div>
            <div id="fg-miniTimer" style="font-size:12px;opacity:.85"></div>
          </div>
          <div id="fg-miniText" style="opacity:.92;margin-bottom:6px">—</div>
          <div style="display:flex;gap:10px;align-items:center">
            <div style="flex:1;height:10px;border-radius:999px;background:rgba(148,163,184,.16);overflow:hidden">
              <div id="fg-miniBar" style="height:100%;width:0%;border-radius:999px;background:rgba(167,139,250,.95)"></div>
            </div>
            <div id="fg-miniCount" style="width:72px;text-align:right;opacity:.9;font-variant-numeric:tabular-nums">0/0</div>
          </div>
        </div>
      </div>
    `;

    doc.body.appendChild(root);
    return root;
  }

  function setTxt(id, t){
    const el = $(id);
    if (!el) return;
    el.textContent = String(t == null ? '' : t);
  }
  function setBar(id, p){
    const el = $(id);
    if (!el) return;
    el.style.width = Math.round(clamp(p,0,1)*100) + '%';
  }
  function show(id, on){
    const el = $(id);
    if (!el) return;
    el.style.display = on ? '' : 'none';
  }

  // ---------- Compat mapping (optional existing HUD IDs) ----------
  function updateCompat(goal, mini){
    try{
      const compatGoalTitle = doc.querySelector('[data-hha-goal-title], #hud-goal-title, #goalTitle');
      const compatGoalVal   = doc.querySelector('[data-hha-goal-val], #hud-goal-val, #goalVal');
      const compatMiniTitle = doc.querySelector('[data-hha-mini-title], #hud-mini-title, #miniTitle');
      const compatMiniVal   = doc.querySelector('[data-hha-mini-val], #hud-mini-val, #miniVal');

      if (compatGoalTitle) compatGoalTitle.textContent = goal && goal.label ? goal.label : '—';
      if (compatGoalVal)   compatGoalVal.textContent   = goal ? ((goal.prog|0)+'/'+(goal.target|0)) : '0/0';
      if (compatMiniTitle) compatMiniTitle.textContent = mini && mini.label ? mini.label : '—';
      if (compatMiniVal)   compatMiniVal.textContent   = mini ? ((mini.prog|0)+'/'+(mini.target|0)) : '0/0';
    }catch(_){}
  }

  // ---------- Apply quest:update ----------
  function applyQuestUpdate(d){
    ensureQuestPanel();

    const questOk = !!(d && d.questOk);
    const groupLabel = (d && d.groupLabel) ? String(d.groupLabel) : '';

    show('fg-questWarn', !questOk);
    setTxt('fg-questGroupLabel', groupLabel ? ('หมู่ปัจจุบัน: ' + groupLabel) : 'หมู่ปัจจุบัน: —');

    const goal = d && d.goal ? d.goal : null;
    const mini = d && d.mini ? d.mini : null;

    if (goal && goal.label){
      setTxt('fg-goalText', goal.label);
      setTxt('fg-goalCount', (goal.prog|0) + '/' + (goal.target|0));
      setBar('fg-goalBar', pct(goal.prog, goal.target));
    } else {
      setTxt('fg-goalText', questOk ? '—' : '⚠️ ไม่พบ quest:update.goal');
      setTxt('fg-goalCount', '0/0');
      setBar('fg-goalBar', 0);
    }

    if (mini && mini.label){
      setTxt('fg-miniText', mini.label);

      // optional timer
      if (typeof mini.tLeft === 'number'){
        setTxt('fg-miniTimer', `⏱️ ${Math.max(0, mini.tLeft|0)}s`);
      } else {
        setTxt('fg-miniTimer', '');
      }

      setTxt('fg-miniCount', (mini.prog|0) + '/' + (mini.target|0));
      setBar('fg-miniBar', pct(mini.prog, mini.target));
    } else {
      setTxt('fg-miniText', questOk ? '—' : '⚠️ ไม่พบ quest:update.mini');
      setTxt('fg-miniTimer', '');
      setTxt('fg-miniCount', '0/0');
      setBar('fg-miniBar', 0);
    }

    updateCompat(goal, mini);
  }

  // ---------- Lock ring (optional UI) ----------
  function ensureLockRing(){
    let ring = $('fg-lockRing');
    if (ring) return ring;

    // If your HTML already has .lock-ring structure, prefer that
    ring = doc.querySelector('.lock-ring');
    if (ring){
      ring.id = ring.id || 'fg-lockRing';
      return ring;
    }

    // Create minimal lock ring if nothing exists
    ring = doc.createElement('div');
    ring.id = 'fg-lockRing';
    ring.className = 'lock-ring';
    ring.style.display = 'none';
    ring.innerHTML = `
      <div class="lock-core"></div>
      <div class="lock-prog"></div>
      <div class="lock-charge"></div>
    `;
    doc.body.appendChild(ring);
    return ring;
  }

  function applyLock(d){
    const ring = ensureLockRing();
    if (!ring) return;

    const on = !!(d && d.on);
    ring.style.display = on ? '' : 'none';
    if (!on) return;

    const x = Number(d.x)|| (window.innerWidth/2);
    const y = Number(d.y)|| (window.innerHeight/2);

    ring.style.left = x + 'px';
    ring.style.top  = y + 'px';

    ring.style.setProperty('--p', String(clamp(d.prog, 0, 1)));
    ring.style.setProperty('--c', String(clamp(d.charge, 0, 1)));
  }

  // ---------- Power bar (optional UI) ----------
  function applyPower(d){
    // try common selectors used in your CSS
    const fill = doc.querySelector('.power-fill, #fg-powerFill, [data-fg-power-fill]');
    const label = doc.querySelector('.power-label span:last-child, #fg-powerText, [data-fg-power-text]');
    if (!fill && !label) return;

    const charge = (d && d.charge != null) ? (d.charge|0) : 0;
    const th = (d && d.threshold != null) ? Math.max(1, d.threshold|0) : 1;
    const p = clamp(charge / th, 0, 1);

    if (fill){
      fill.style.width = Math.round(p*100) + '%';
      // pulse tiny
      try{
        fill.classList.add('pulse');
        setTimeout(()=>fill.classList.remove('pulse'), 180);
      }catch(_){}
    }
    if (label && d && d.groupName){
      label.textContent = `${d.groupName} • ${charge}/${th}`;
    }
  }

  // ---------- Bind events ----------
  window.addEventListener('quest:update', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    applyQuestUpdate(d);
  }, { passive:true });

  window.addEventListener('groups:lock', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    applyLock(d);
  }, { passive:true });

  window.addEventListener('groups:power', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    applyPower(d);
  }, { passive:true });

  // ---------- Boot-time fallback ----------
  ensureQuestPanel();
  ensureLockRing();
})();