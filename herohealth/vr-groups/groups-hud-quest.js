// === /herohealth/vr-groups/groups-hud-quest.js ===
// Food Groups VR — HUD + Quest + Power + LockRing Binder (IIFE) — FULL PATCHED
// ✅ Always creates HUD if missing (safe + mobile friendly)
// ✅ Listens: quest:update, hha:score, hha:time, hha:rank, groups:power, groups:group_change, groups:lock, groups:stun
// ✅ Idempotent (bind once) + won't conflict with global HUD binder
// ✅ Safe-zone layout (top-left stats + mid group/power + right rank optional)
// ✅ Quest panel pinned lower (not blocking targets) + mobile stacks

(function(){
  'use strict';

  const doc = document;
  if (!doc) return;

  const NS = (window.GroupsHUD = window.GroupsHUD || {});
  if (NS.__bound) return;
  NS.__bound = true;

  function $(sel, root){ return (root||doc).querySelector(sel); }
  function byId(id){ return doc.getElementById(id); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function pct(v,t){ v=Number(v)||0; t=Math.max(1,Number(t)||0); return clamp(v/t,0,1); }

  // --------- inject minimal styles if CSS missing ---------
  function ensureStyle(){
    if (byId('fg-hud-style')) return;
    const st = doc.createElement('style');
    st.id = 'fg-hud-style';
    st.textContent = `
      .fg-hud-root{
        position:fixed; inset:0; pointer-events:none; z-index:20;
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
        color:#e5e7eb;
      }
      .fg-hud-top{
        position:fixed;
        top: calc(12px + var(--sat, 0px));
        left: calc(12px + var(--sal, 0px));
        right: calc(12px + var(--sar, 0px));
        display:grid;
        grid-template-columns: 1fr 1.35fr 1fr;
        gap:10px;
        pointer-events:none;
      }
      .fg-card{
        background: rgba(2,6,23,.72);
        border:1px solid rgba(148,163,184,.18);
        border-radius:18px;
        padding:10px 12px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: 0 18px 60px rgba(0,0,0,.35);
      }
      .fg-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:2px 0; }
      .fg-t{ color: rgba(148,163,184,.92); font-size:12px; }
      .fg-v{ font-weight:900; font-size:16px; font-variant-numeric: tabular-nums; }
      .fg-group-row{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .fg-group{ font-weight:1000; letter-spacing:.2px; }
      .fg-timer{
        font-weight:1000;
        padding:6px 10px;
        border-radius:999px;
        background:rgba(148,163,184,.10);
        border:1px solid rgba(148,163,184,.18);
      }
      .fg-power{ margin-top:8px; }
      .fg-power-label{ display:flex; align-items:center; justify-content:space-between; font-size:12px; color:rgba(148,163,184,.92); margin-bottom:6px; }
      .fg-bar{ height:10px; border-radius:999px; overflow:hidden; background:rgba(148,163,184,.14); border:1px solid rgba(148,163,184,.16); }
      .fg-bar > i{ display:block; height:100%; width:0%; border-radius:999px; background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95)); transition: width .12s linear; }
      .fg-quest{
        position:fixed;
        left: calc(12px + var(--sal,0px));
        bottom: calc(12px + var(--sab,0px));
        width: min(820px, calc(100vw - 24px - var(--sal,0px) - var(--sar,0px)));
        pointer-events:none;
        z-index:25;
      }
      .fg-quest .fg-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
      .fg-quest .fg-head .fg-hl{ font-weight:900; opacity:.95; }
      .fg-quest .fg-head .fg-warn{ font-size:12px; opacity:.75; display:none; }
      .fg-quest .fg-lines{ display:flex; gap:12px; flex-wrap:wrap; }
      .fg-line{ flex:1; min-width:260px; }
      .fg-badge{
        display:inline-flex; align-items:center; justify-content:center;
        font-size:12px; font-weight:1000;
        padding:4px 10px; border-radius:999px;
        background:rgba(34,197,94,.12);
        border:1px solid rgba(34,197,94,.18);
      }
      .fg-badge.mini{ background:rgba(167,139,250,.14); border-color:rgba(167,139,250,.20); }
      .fg-qtext{ margin-top:6px; font-size:13px; opacity:.92; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .fg-qrow{ margin-top:6px; display:flex; align-items:center; gap:10px; }
      .fg-qcount{ width:74px; text-align:right; font-weight:900; opacity:.9; font-variant-numeric: tabular-nums; }
      .fg-miniTimer{ margin-left:auto; font-size:12px; opacity:.85; }
      .fg-rankGrade{ font-weight:1100; font-size:28px; letter-spacing:1px; }
      .fg-rankSub{ margin-top:6px; display:flex; justify-content:space-between; color:rgba(229,231,235,.82); font-size:12px; }

      .fg-lock{
        position:fixed; left:50%; top:50%;
        width:78px; height:78px; border-radius:999px;
        z-index:40; pointer-events:none;
        filter: drop-shadow(0 10px 24px rgba(0,0,0,.40));
        transform: translate(-50%,-50%);
        display:none;
      }
      .fg-lock .core{
        position:absolute; inset:0; border-radius:999px;
        border:2px solid rgba(148,163,184,.18);
        background: radial-gradient(circle at center, rgba(2,6,23,.10), rgba(2,6,23,.00));
      }
      .fg-lock .prog{
        position:absolute; inset:-2px; border-radius:999px;
        background: conic-gradient(rgba(34,211,238,.95) calc(var(--p)*360deg), rgba(34,211,238,.06) 0);
        -webkit-mask: radial-gradient(circle, transparent 58%, #000 59%);
        mask: radial-gradient(circle, transparent 58%, #000 59%);
      }
      .fg-lock .chg{
        position:absolute; inset:8px; border-radius:999px;
        background: conic-gradient(rgba(167,139,250,.95) calc(var(--c)*360deg), rgba(167,139,250,.06) 0);
        -webkit-mask: radial-gradient(circle, transparent 62%, #000 63%);
        mask: radial-gradient(circle, transparent 62%, #000 63%);
      }

      .fg-stun{
        position:fixed; inset:0; z-index:45;
        pointer-events:none; display:none;
        align-items:center; justify-content:center;
        background: radial-gradient(circle at center, rgba(239,68,68,.12), rgba(2,6,23,.05));
      }
      .fg-stun .card{
        background:rgba(2,6,23,.82);
        border:1px solid rgba(239,68,68,.22);
        border-radius:20px;
        padding:14px 18px;
        text-align:center;
        box-shadow: 0 18px 60px rgba(0,0,0,.45);
        backdrop-filter: blur(10px);
      }
      .fg-stun .title{ font-weight:1100; font-size:26px; letter-spacing:.8px; }
      .fg-stun .sub{ margin-top:6px; opacity:.82; font-weight:800; }

      @media (max-width: 520px){
        .fg-hud-top{ grid-template-columns: 1fr; }
        .fg-hud-right{ display:none; }
        .fg-lock{ width:70px; height:70px; }
      }
    `;
    doc.head.appendChild(st);
  }

  // --------- create DOM HUD if missing ---------
  function ensureHUD(){
    ensureStyle();

    let root = byId('fg-hud-root');
    if (root) return root;

    root = doc.createElement('div');
    root.id = 'fg-hud-root';
    root.className = 'fg-hud-root';
    root.innerHTML = `
      <div class="fg-hud-top">
        <div class="fg-card fg-hud-left">
          <div class="fg-row"><div class="fg-t">คะแนน</div><div class="fg-v" id="fgScore">0</div></div>
          <div class="fg-row"><div class="fg-t">คอมโบ</div><div class="fg-v" id="fgCombo">0</div></div>
          <div class="fg-row"><div class="fg-t">พลาด</div><div class="fg-v" id="fgMiss">0</div></div>
        </div>

        <div class="fg-card fg-hud-mid">
          <div class="fg-group-row">
            <div class="fg-group" id="fgGroup">หมู่ ?</div>
            <div class="fg-timer" id="fgTime">--s</div>
          </div>

          <div class="fg-power">
            <div class="fg-power-label">
              <div>Power</div>
              <div id="fgPowerText">0/0</div>
            </div>
            <div class="fg-bar"><i id="fgPowerFill"></i></div>
          </div>
        </div>

        <div class="fg-card fg-hud-right">
          <div class="fg-row" style="align-items:flex-end">
            <div>
              <div class="fg-t">GRADE</div>
              <div class="fg-rankGrade" id="fgGrade">C</div>
            </div>
            <div style="text-align:right">
              <div class="fg-t">ACC</div>
              <div class="fg-v" id="fgAcc">0%</div>
            </div>
          </div>
          <div class="fg-rankSub">
            <div>Q</div>
            <div id="fgQuestPct">0%</div>
          </div>
        </div>
      </div>

      <div class="fg-quest fg-card" id="fgQuestPanel">
        <div class="fg-head">
          <div class="fg-hl" id="fgGroupLabel">หมู่ปัจจุบัน: —</div>
          <div class="fg-warn" id="fgQuestWarn">⚠️ Quest not ready</div>
        </div>

        <div class="fg-lines">
          <div class="fg-line">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="fg-badge">GOAL</span>
            </div>
            <div class="fg-qtext" id="fgGoalText">—</div>
            <div class="fg-qrow">
              <div class="fg-bar" style="flex:1"><i id="fgGoalFill"></i></div>
              <div class="fg-qcount" id="fgGoalCount">0/0</div>
            </div>
          </div>

          <div class="fg-line">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="fg-badge mini">MINI</span>
              <span class="fg-miniTimer" id="fgMiniTimer"></span>
            </div>
            <div class="fg-qtext" id="fgMiniText">—</div>
            <div class="fg-qrow">
              <div class="fg-bar" style="flex:1"><i id="fgMiniFill"></i></div>
              <div class="fg-qcount" id="fgMiniCount">0/0</div>
            </div>
          </div>
        </div>
      </div>

      <div class="fg-lock" id="fgLockRing">
        <div class="core"></div>
        <div class="prog"></div>
        <div class="chg"></div>
      </div>

      <div class="fg-stun" id="fgStun">
        <div class="card">
          <div class="title">STUN!</div>
          <div class="sub" id="fgStunSub">พักแป๊บ…</div>
        </div>
      </div>
    `;

    doc.body.appendChild(root);
    return root;
  }

  function setTxt(id, t){
    const el = byId(id);
    if (!el) return;
    el.textContent = String(t == null ? '' : t);
  }
  function setWidth(id, p){
    const el = byId(id);
    if (!el) return;
    el.style.width = Math.round(clamp(p,0,1)*100) + '%';
  }
  function show(id, on){
    const el = byId(id);
    if (!el) return;
    el.style.display = on ? '' : 'none';
  }

  // --------- state cache ---------
  const S = NS.state = NS.state || {
    score:0, combo:0, miss:0,
    timeLeft:0,
    grade:'C', acc:0,
    questsPct:0,
    groupName:'หมู่ ?',
    powerCharge:0, powerTh:0
  };

  // --------- update helpers ---------
  function renderTop(){
    ensureHUD();
    setTxt('fgScore', S.score|0);
    setTxt('fgCombo', S.combo|0);
    setTxt('fgMiss',  S.miss|0);
    setTxt('fgTime',  (S.timeLeft|0) + 's');
    setTxt('fgGroup', S.groupName || 'หมู่ ?');

    setTxt('fgGrade', S.grade || 'C');
    setTxt('fgAcc',   (S.acc|0) + '%');
    setTxt('fgQuestPct', (S.questsPct|0) + '%');

    const th = Math.max(1, S.powerTh|0);
    const ch = clamp(S.powerCharge|0, 0, th);
    setTxt('fgPowerText', ch + '/' + th);
    setWidth('fgPowerFill', ch / th);
  }

  function applyQuestUpdate(d){
    ensureHUD();

    const questOk = !!(d && d.questOk);
    const groupLabel = (d && d.groupLabel) ? String(d.groupLabel) : '';

    show('fgQuestWarn', !questOk);
    setTxt('fgGroupLabel', groupLabel ? ('หมู่ปัจจุบัน: ' + groupLabel) : 'หมู่ปัจจุบัน: —');

    const goal = d && d.goal ? d.goal : null;
    const mini = d && d.mini ? d.mini : null;

    if (goal && goal.label){
      setTxt('fgGoalText', goal.label);
      setTxt('fgGoalCount', (goal.prog|0) + '/' + (goal.target|0));
      setWidth('fgGoalFill', pct(goal.prog, goal.target));
    } else {
      setTxt('fgGoalText', questOk ? '—' : '⚠️ ไม่พบ quest:update.goal');
      setTxt('fgGoalCount', '0/0');
      setWidth('fgGoalFill', 0);
    }

    if (mini && mini.label){
      setTxt('fgMiniText', mini.label);
      setTxt('fgMiniCount', (mini.prog|0) + '/' + (mini.target|0));
      setWidth('fgMiniFill', pct(mini.prog, mini.target));

      if (typeof mini.tLeft === 'number'){
        setTxt('fgMiniTimer', `⏱️ ${Math.max(0, mini.tLeft|0)}s`);
      } else {
        setTxt('fgMiniTimer', '');
      }
    } else {
      setTxt('fgMiniText', questOk ? '—' : '⚠️ ไม่พบ quest:update.mini');
      setTxt('fgMiniCount', '0/0');
      setWidth('fgMiniFill', 0);
      setTxt('fgMiniTimer', '');
    }

    // compat: update any old HUD elements if present
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

  // --------- lock ring handler ---------
  function applyLock(d){
    ensureHUD();
    const ring = byId('fgLockRing');
    if (!ring) return;

    const on = !!(d && d.on);
    if (!on){
      ring.style.display = 'none';
      ring.style.setProperty('--p', '0');
      ring.style.setProperty('--c', '0');
      return;
    }

    ring.style.display = '';
    const x = Number(d.x)|| (window.innerWidth/2);
    const y = Number(d.y)|| (window.innerHeight/2);

    // set position (translate(-50%,-50%) already)
    ring.style.left = Math.round(x) + 'px';
    ring.style.top  = Math.round(y) + 'px';

    ring.style.setProperty('--p', String(clamp(d.prog,0,1)));
    ring.style.setProperty('--c', String(clamp(d.charge,0,1)));
  }

  // --------- stun overlay ---------
  let stunTimer = 0;
  function showStun(ms){
    ensureHUD();
    const el = byId('fgStun');
    if (!el) return;

    show('fgStun', true);
    setTxt('fgStunSub', ms ? `โดนขยะ! ${Math.ceil(ms/100)/10}s` : 'โดนขยะ!');
    if (stunTimer) clearTimeout(stunTimer);
    stunTimer = setTimeout(()=>show('fgStun', false), Math.max(180, ms|0));
  }

  // --------- bind events ---------
  ensureHUD();
  renderTop();

  window.addEventListener('hha:score', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    S.score = (d.score|0);
    S.combo = (d.combo|0);
    S.miss  = (d.misses|0);
    renderTop();
  }, { passive:true });

  window.addEventListener('hha:time', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    S.timeLeft = (d.left|0);
    renderTop();

    // panic blink (optional) - use html class like other games
    try{
      if (S.timeLeft <= 10) document.documentElement.classList.add('panic');
      else document.documentElement.classList.remove('panic');
    }catch(_){}
  }, { passive:true });

  window.addEventListener('hha:rank', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    if (d.grade) S.grade = String(d.grade);
    if (typeof d.accuracy === 'number') S.acc = d.accuracy|0;
    if (typeof d.questsPct === 'number') S.questsPct = d.questsPct|0;
    renderTop();
  }, { passive:true });

  window.addEventListener('quest:update', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    applyQuestUpdate(d);

    // keep group label also reflect on top mid (nice)
    if (d && d.groupLabel) {
      S.groupName = String(d.groupLabel);
      renderTop();
    }
  }, { passive:true });

  window.addEventListener('groups:power', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    if (d.groupName) S.groupName = String(d.groupName);
    if (typeof d.charge === 'number') S.powerCharge = d.charge|0;
    if (typeof d.threshold === 'number') S.powerTh = d.threshold|0;
    renderTop();
  }, { passive:true });

  window.addEventListener('groups:group_change', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    if (d && d.label) {
      S.groupName = String(d.label);
      renderTop();
      // also update banner if your CSS has it; but we keep HUD minimal
    }
  }, { passive:true });

  window.addEventListener('groups:lock', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    applyLock(d);
  }, { passive:true });

  window.addEventListener('groups:stun', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    if (d && d.on) showStun(d.ms|0);
  }, { passive:true });

  // fallback: if page loads but no events yet, keep UI visible
  setTimeout(renderTop, 50);
  setTimeout(renderTop, 250);
  setTimeout(renderTop, 900);

})();