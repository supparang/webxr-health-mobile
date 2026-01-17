// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view if no ?view=
// ✅ NO override if ?view= exists (ตามที่ตกลง)
// ✅ Cardboard support: ?cardboard=1 or body.cardboard
// ✅ Sets window.HHA_VIEW.layers for engine
// ✅ Start overlay -> dispatch hha:start

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    const w = Math.max(1, innerWidth||1);
    const h = Math.max(1, innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function applyBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if (view === 'cvr') b.classList.add('view-cvr');
    else if (view === 'mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');
  }

  function applyCardboard(on){
    const b = DOC.body;
    b.classList.toggle('cardboard', !!on);

    const cbWrap = DOC.getElementById('cbWrap');
    if (cbWrap) cbWrap.hidden = !on;

    // layers array for engine
    if (on){
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layer'];
    }
  }

  // ---------- decide view ----------
  const viewParam = String(qs('view','')||'').toLowerCase();
  const view = viewParam ? viewParam : detectView(); // ✅ NO override if has param
  applyBodyView(view);

  // cardboard decision
  const cb = String(qs('cardboard','0')||'0').toLowerCase();
  const cardboard = (cb==='1' || cb==='true' || cb==='yes');
  applyCardboard(!!cardboard);

  // ---------- start overlay ----------
  const hub = String(qs('hub','../hub.html'));
  DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
    btn.addEventListener('click', ()=> location.href = hub);
  });

  const ov = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const ovSub = DOC.getElementById('ovSub');

  function hideOverlay(){
    if (!ov) return;
    ov.classList.add('hide');
    ov.style.display = 'none';
  }
  function startGame(){
    hideOverlay();
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  if (ovSub){
    const m = (view==='cvr')
      ? 'โหมด cVR: ยิงจากกลางจอ (crosshair)'
      : (view==='mobile')
        ? 'โหมด Mobile: แตะเป้าเพื่อยิง'
        : 'โหมด PC: คลิกเป้าเพื่อยิง';
    ovSub.textContent = cardboard ? (m + ' • Cardboard') : m;
  }

  btnStart?.addEventListener('click', (e)=>{ try{ e.preventDefault(); }catch(_){} startGame(); });
  ov?.addEventListener('click', (e)=>{
    // กันกดโดนปุ่มซ้อน
    const t = e.target;
    if (t && (t.closest && t.closest('button'))) return;
    startGame();
  });

  // safety: if overlay missing -> auto start
  setTimeout(()=>{
    const gone = !ov || getComputedStyle(ov).display==='none' || ov.classList.contains('hide');
    if (gone){
      try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    }
  }, 650);
})();