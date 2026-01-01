// === /herohealth/plate/plate-hud.js ===
// HeroHealth — Plate HUD Binder (PRODUCTION)
// ✅ Binds events from plate.safe.js (hha:score / hha:time / quest:update / hha:coach / hha:judge / hha:end / hha:celebrate / hha:adaptive)
// ✅ Safe if some DOM ids missing
// ✅ Minimal judge toast + optional debug (press D) + optional playRect overlay (press R)
// ✅ Works with /herohealth/plate-vr.html layout

(function (root) {
  'use strict';

  const DOC = root.document;

  const qs = (id) => DOC.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt || false);

  function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function pct(a,b){ if(!b) return 0; return clamp((a/b)*100,0,100); }
  function fmtPct(x){ x=Number(x)||0; return `${Math.round(x)}%`; }
  function safeText(id, t){ const el=qs(id); if(el) el.textContent = String(t); }
  function safeWidth(id, wPct){ const el=qs(id); if(el) el.style.width = `${clamp(wPct,0,100)}%`; }

  // ---------- DOM ----------
  const elFeverFill = qs('uiFeverFill');
  const elShieldN   = qs('uiShieldN');

  const elGoalTitle = qs('uiGoalTitle');
  const elGoalCount = qs('uiGoalCount');
  const elGoalFill  = qs('uiGoalFill');

  const elMiniTitle = qs('uiMiniTitle');
  const elMiniCount = qs('uiMiniCount');
  const elMiniTime  = qs('uiMiniTime');
  const elMiniFill  = qs('uiMiniFill');
  const elHint      = qs('uiHint');

  const elCoachMsg  = qs('coachMsg');
  const elCoachImg  = qs('coachImg');

  const elPaused    = qs('hudPaused');
  const elResult    = qs('resultBackdrop');

  // ---------- Judge Toast ----------
  let toastEl = null;
  function ensureToast(){
    if(toastEl) return toastEl;
    const d = DOC.createElement('div');
    d.className = 'plateJudgeToast';
    d.style.cssText = `
      position:fixed; left:50%; top:12px;
      transform:translate(-50%, -20px);
      z-index:99;
      padding:10px 14px;
      border-radius:999px;
      background:rgba(2,6,23,.72);
      border:1px solid rgba(148,163,184,.22);
      box-shadow:0 18px 60px rgba(0,0,0,.35);
      color:#e5e7eb;
      font:900 14px/1.2 system-ui,-apple-system,"Noto Sans Thai",Segoe UI,Roboto,sans-serif;
      letter-spacing:.2px;
      opacity:0;
      pointer-events:none;
      transition: transform .18s ease, opacity .18s ease;
      backdrop-filter: blur(10px);
      text-align:center;
      max-width:min(92vw, 760px);
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    `;
    DOC.body.appendChild(d);
    toastEl = d;
    return d;
  }

  function showToast(text, kind){
    const t = ensureToast();
    t.textContent = String(text || '');
    const k = String(kind || 'info').toLowerCase();

    // color hint
    let border = 'rgba(148,163,184,.22)';
    let bg = 'rgba(2,6,23,.72)';
    if(k === 'good' || k === 'success'){
      border = 'rgba(34,197,94,.35)';
      bg = 'rgba(34,197,94,.12)';
    }else if(k === 'bad' || k === 'danger'){
      border = 'rgba(239,68,68,.35)';
      bg = 'rgba(239,68,68,.12)';
    }else if(k === 'warn' || k === 'warning'){
      border = 'rgba(245,158,11,.40)';
      bg = 'rgba(245,158,11,.12)';
    }
    t.style.borderColor = border;
    t.style.background = bg;

    // animate in/out
    clearTimeout(showToast._t);
    t.style.opacity = '1';
    t.style.transform = 'translate(-50%, 0px)';
    showToast._t = setTimeout(()=>{
      t.style.opacity = '0';
      t.style.transform = 'translate(-50%, -16px)';
    }, 950);
  }

  // ---------- Coach image mapping ----------
  function setCoach(msg, mood){
    if(elCoachMsg && msg != null) elCoachMsg.textContent = String(msg);

    if(elCoachImg){
      const m = String(mood || 'neutral').toLowerCase();
      const map = {
        happy: './img/coach-happy.png',
        neutral:'./img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      elCoachImg.src = map[m] || map.neutral;
    }
  }

  // ---------- Quest UI ----------
  function setGoal(goal){
    if(!goal){
      if(elGoalTitle) elGoalTitle.textContent = '—';
      if(elGoalCount) elGoalCount.textContent = '0/0';
      if(elGoalFill)  elGoalFill.style.width = '0%';
      return;
    }
    if(elGoalTitle) elGoalTitle.textContent = String(goal.title || '—');
    if(elGoalCount) elGoalCount.textContent = `${Number(goal.cur||0)}/${Number(goal.target||0)}`;
    if(elGoalFill){
      const w = goal.target ? (Number(goal.cur||0)/Number(goal.target||1)*100) : 0;
      elGoalFill.style.width = `${clamp(w,0,100)}%`;
    }
  }

  function setMini(mini){
    if(!mini){
      if(elMiniTitle) elMiniTitle.textContent = '—';
      if(elMiniTime)  elMiniTime.textContent = '--';
      if(elMiniFill)  elMiniFill.style.width = '0%';
      return;
    }
    if(elMiniTitle) elMiniTitle.textContent = String(mini.title || '—');
    if(elMiniTime){
      if(mini.timeLeft == null) elMiniTime.textContent = '--';
      else elMiniTime.textContent = `${Math.ceil(Number(mini.timeLeft)||0)}s`;
    }
    if(elMiniFill){
      // We don't always get cur; compute from timeLeft if possible.
      if(mini.target && mini.timeLeft != null){
        const target = Number(mini.target)||1;
        const elapsed = clamp(target - (Number(mini.timeLeft)||0), 0, target);
        const w = (elapsed/target)*100;
        elMiniFill.style.width = `${clamp(w,0,100)}%`;
      }else{
        elMiniFill.style.width = '0%';
      }
    }
  }

  // ---------- HUD core binder (score packets) ----------
  let lastScorePacket = null;

  function applyScorePacket(p){
    if(!p) return;
    lastScorePacket = p;

    // Most values are already set by plate.safe.js directly,
    // but we keep a safe binder for robustness & future refactor.
    safeText('uiScore', p.score ?? 0);
    safeText('uiCombo', p.combo ?? 0);
    safeText('uiComboMax', p.comboMax ?? 0);
    safeText('uiMiss', p.miss ?? 0);
    safeText('uiPlateHave', p.plateHave ?? 0);

    if(Array.isArray(p.gCount)){
      safeText('uiG1', p.gCount[0] ?? 0);
      safeText('uiG2', p.gCount[1] ?? 0);
      safeText('uiG3', p.gCount[2] ?? 0);
      safeText('uiG4', p.gCount[3] ?? 0);
      safeText('uiG5', p.gCount[4] ?? 0);
    }

    safeText('uiAcc', fmtPct(p.accuracyGoodPct ?? 0));
    safeText('uiGrade', p.grade ?? 'C');
    safeText('uiTime', Math.ceil(p.timeLeftSec ?? 0));

    if(elFeverFill){
      elFeverFill.style.width = `${clamp(p.fever ?? 0, 0, 100)}%`;
    }
    if(elShieldN){
      elShieldN.textContent = String(p.shield ?? 0);
    }
  }

  // ---------- Result binder ----------
  function applyResult(summary){
    if(!summary) return;

    safeText('rMode', summary.runMode || summary.mode || 'play');
    safeText('rGrade', summary.grade || 'C');
    safeText('rScore', summary.scoreFinal ?? 0);
    safeText('rMaxCombo', summary.comboMax ?? 0);
    safeText('rMiss', summary.misses ?? 0);
    safeText('rPerfect', (summary.fastHitRatePct != null) ? `${Math.round(summary.fastHitRatePct)}%` : '0%');
    safeText('rGoals', `${summary.goalsCleared ?? 0}/${summary.goalsTotal ?? 0}`);
    safeText('rMinis', `${summary.miniCleared ?? 0}/${summary.miniTotal ?? (summary.miniCleared ?? 0)}`);

    const counts = summary.plate && summary.plate.counts ? summary.plate.counts : [0,0,0,0,0];
    safeText('rG1', counts[0] ?? 0);
    safeText('rG2', counts[1] ?? 0);
    safeText('rG3', counts[2] ?? 0);
    safeText('rG4', counts[3] ?? 0);
    safeText('rG5', counts[4] ?? 0);
    safeText('rGTotal', (summary.plate && summary.plate.total != null) ? summary.plate.total : (counts.reduce((a,b)=>a+(b||0),0)));

    if(elResult) elResult.style.display = 'grid';
  }

  // ---------- Celebrate hook (optional) ----------
  function onCelebrate(kind){
    // Light UI sparkle (CSS-only) if particles.js isn't available
    try{
      DOC.body.classList.remove('plate-celebrate');
      void DOC.body.offsetWidth;
      DOC.body.classList.add('plate-celebrate');
      clearTimeout(onCelebrate._t);
      onCelebrate._t = setTimeout(()=>DOC.body.classList.remove('plate-celebrate'), 450);
    }catch(e){}
  }

  // Inject tiny celebrate css (non-invasive)
  (function ensureCelebrateCss(){
    const id = 'plate-celebrate-css';
    if(DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      .plate-celebrate #hudTop,
      .plate-celebrate #miniPanel{
        animation: platePop .22s ease-in-out 0s 1;
      }
      @keyframes platePop{
        0%{transform:translateZ(0) scale(1)}
        55%{transform:translateZ(0) scale(1.02)}
        100%{transform:translateZ(0) scale(1)}
      }
    `;
    DOC.head.appendChild(st);
  })();

  // ---------- Debug overlay (D/R toggles) ----------
  let dbgOn = false;
  let rectOn = false;
  let dbgEl = null;
  let rectEl = null;

  function ensureDbg(){
    if(dbgEl) return dbgEl;
    const d = DOC.createElement('pre');
    d.style.cssText = `
      position:fixed; right:10px; bottom:10px;
      z-index:98;
      margin:0;
      padding:10px 12px;
      border-radius:14px;
      background:rgba(2,6,23,.70);
      border:1px solid rgba(148,163,184,.22);
      color:#e5e7eb;
      font:900 12px/1.25 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
      width:min(92vw, 380px);
      box-shadow:0 18px 60px rgba(0,0,0,.35);
      backdrop-filter: blur(10px);
      display:none;
      white-space:pre-wrap;
    `;
    DOC.body.appendChild(d);
    dbgEl = d;
    return d;
  }

  function ensureRect(){
    if(rectEl) return rectEl;
    const d = DOC.createElement('div');
    d.style.cssText = `
      position:fixed; inset:0;
      z-index:97;
      pointer-events:none;
      display:none;
    `;
    const box = DOC.createElement('div');
    box.id = 'platePlayRectBox';
    box.style.cssText = `
      position:absolute;
      border:2px dashed rgba(34,197,94,.65);
      border-radius:14px;
      box-shadow:0 0 0 9999px rgba(0,0,0,.05) inset;
    `;
    d.appendChild(box);
    DOC.body.appendChild(d);
    rectEl = d;
    return d;
  }

  function updateDebug(){
    if(!dbgOn) return;
    const d = ensureDbg();
    const p = lastScorePacket || {};
    const lines = [
      `Plate HUD DEBUG`,
      `mode=${p.runMode||'?'} diff=${p.diff||'?'} timeLeft=${Math.ceil(p.timeLeftSec||0)}s`,
      `score=${p.score||0} combo=${p.combo||0}/${p.comboMax||0} miss=${p.miss||0}`,
      `acc=${Math.round(p.accuracyGoodPct||0)}% grade=${p.grade||'C'}`,
      `fever=${Math.round(p.fever||0)} shield=${p.shield||0}`,
      `adapt=${p.adapt ? JSON.stringify(p.adapt) : '(see hha:adaptive)'}`
    ];
    d.textContent = lines.join('\n');
    d.style.display = 'block';
  }

  function updatePlayRectOverlay(){
    if(!rectOn) return;
    const host = ensureRect();
    const box = qs('platePlayRectBox');
    if(!box) return;

    // If plate.safe.js exposes cache, use it; otherwise infer via HUD sizes.
    // (We keep it simple: compute safe playRect like safe.js does.)
    const W = (root.visualViewport && root.visualViewport.width) ? root.visualViewport.width : (root.innerWidth||360);
    const H = (root.visualViewport && root.visualViewport.height) ? root.visualViewport.height : (root.innerHeight||640);

    const hudTop = qs('hudTop');
    const miniPanel = qs('miniPanel');
    const hudBtns = qs('hudBtns');

    const pad = 10;

    const r1 = hudTop ? hudTop.getBoundingClientRect() : null;
    const r2 = miniPanel ? miniPanel.getBoundingClientRect() : null;
    const r3 = hudBtns ? hudBtns.getBoundingClientRect() : null;

    let top = pad;
    let bottom = H - pad;
    let left = pad;
    let right = W - pad;

    if(r1) top = Math.max(top, r1.bottom + 10);
    if(r2) top = Math.max(top, r2.bottom + 10);
    if(r3) bottom = Math.min(bottom, r3.top - 10);

    top = clamp(top, 0, H-40);
    bottom = clamp(bottom, top+40, H);
    left = clamp(left, 0, W-40);
    right = clamp(right, left+40, W);

    box.style.left = `${Math.round(left)}px`;
    box.style.top  = `${Math.round(top)}px`;
    box.style.width  = `${Math.round(right-left)}px`;
    box.style.height = `${Math.round(bottom-top)}px`;

    host.style.display = 'block';
  }

  function toggleDbg(){
    dbgOn = !dbgOn;
    const d = ensureDbg();
    d.style.display = dbgOn ? 'block' : 'none';
    if(dbgOn) updateDebug();
  }

  function toggleRect(){
    rectOn = !rectOn;
    const r = ensureRect();
    r.style.display = rectOn ? 'block' : 'none';
    if(rectOn) updatePlayRectOverlay();
  }

  on(root, 'keydown', (e)=>{
    const k = String(e.key||'').toLowerCase();
    if(k === 'd') toggleDbg();
    if(k === 'r') toggleRect();
  });

  // ---------- Event bindings ----------
  on(root, 'hha:score', (e)=>{
    const p = e && e.detail ? e.detail : null;
    if(!p || p.game !== 'plate') return;
    applyScorePacket(p);
    updateDebug();
    if(rectOn) updatePlayRectOverlay();
  });

  on(root, 'hha:time', (e)=>{
    const d = e && e.detail ? e.detail : null;
    if(!d || d.game !== 'plate') return;
    safeText('uiTime', Math.ceil(d.timeLeftSec ?? 0));
  });

  on(root, 'quest:update', (e)=>{
    const d = e && e.detail ? e.detail : null;
    if(!d || d.game !== 'plate') return;
    setGoal(d.goal || null);
    setMini(d.mini || null);

    // Mini counter hint (if exists)
    if(elMiniCount){
      if(d.mini && typeof d.miniTotal !== 'undefined'){
        elMiniCount.textContent = `${d.miniCleared||0}/${d.miniTotal||0}`;
      }
      // otherwise leave it to plate.safe.js which sets uiMiniCount
    }
  });

  on(root, 'hha:coach', (e)=>{
    const d = e && e.detail ? e.detail : null;
    if(!d || d.game !== 'plate') return;
    setCoach(d.msg, d.mood);
  });

  on(root, 'hha:judge', (e)=>{
    const d = e && e.detail ? e.detail : null;
    if(!d || d.game !== 'plate') return;
    showToast(d.text || '', d.kind || 'info');
  });

  on(root, 'hha:end', (e)=>{
    const d = e && e.detail ? e.detail : null;
    if(!d || d.game !== 'plate') return;
    if(d.summary) applyResult(d.summary);
  });

  on(root, 'hha:celebrate', (e)=>{
    const d = e && e.detail ? e.detail : null;
    if(!d || d.game !== 'plate') return;
    onCelebrate(d.kind || 'ok');
  });

  // Adaptive debug (optional)
  on(root, 'hha:adaptive', (e)=>{
    const d = e && e.detail ? e.detail : null;
    if(!d || d.game !== 'plate') return;
    // Attach into lastScorePacket for debug view only
    lastScorePacket = lastScorePacket || {};
    lastScorePacket.adapt = d.adapt;
    updateDebug();
  });

  // Pause overlay is managed by plate.safe.js, but if other modules emit something later, keep hook
  on(root, 'hha:pause', (e)=>{
    const d = e && e.detail ? e.detail : null;
    if(!d || d.game !== 'plate') return;
    if(elPaused) elPaused.style.display = d.paused ? 'grid' : 'none';
  });

  // ---------- Boot: initial UI hygiene ----------
  // Hide result initially (plate.safe.js also does it)
  if(elResult) elResult.style.display = 'none';
  if(elPaused) elPaused.style.display = 'none';

})(window);