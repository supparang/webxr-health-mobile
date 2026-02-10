// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION — v20260210a
// ✅ Detect view: pc/mobile/vr/cvr (NO override if ?view exists)
// ✅ Tap-to-start gate for mobile/cvr (prevents "stuck")
// ✅ Builds ctx: {hub,time,seed,pid,studyId,phase,conditionGroup,mode}
// ✅ Boots engine: window.BrushVR.boot(ctx)
// ✅ End flow: on hha:end -> show mini overlay -> Back HUB / Restart
// ✅ Safe: never crash if engine missing, shows fatal overlay

(function(){
  'use strict';
  const WIN = window, DOC = document;

  // ---------- utils ----------
  function qs(k, d=null){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch(_){ return d; }
  }
  function qn(k, d=0){
    const v = Number(qs(k, d));
    return Number.isFinite(v) ? v : d;
  }
  function ql(k, d=''){
    const v = (qs(k, d) || '').trim();
    return v;
  }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }

  // ---------- view detect (do NOT override if ?view exists) ----------
  function detectView(){
    const v = (qs('view','')||'').toLowerCase();
    if(v) return v; // explicit wins

    // Heuristic:
    // - if WebXR available => "vr" (still fine for pc; vr-ui buttons handle)
    // - if small screen => mobile
    // - else pc
    const isMobile = matchMedia('(max-width: 860px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');
    const hasXR = !!(navigator.xr && navigator.xr.isSessionSupported);
    if(hasXR) return isMobile ? 'cvr' : 'vr';
    return isMobile ? 'mobile' : 'pc';
  }

  function applyViewToBody(view){
    DOC.body.setAttribute('data-view', view);
    DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    DOC.body.classList.add('view-' + view);
  }

  // ---------- pid helper ----------
  function getPid(){
    // priority: ?pid > localStorage > fallback "guest"
    const p = ql('pid','');
    if(p) return p;
    try{
      const v = (localStorage.getItem('HHA_PID')||'').trim();
      if(v) return v;
    }catch(_){}
    return 'guest';
  }

  // ---------- seed helper ----------
  function getSeed(){
    // priority: ?seed, else deterministic-ish from day+pid (good for classroom consistency)
    const s = ql('seed','');
    if(s) return s;
    const pid = getPid();
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}:${pid}`;
    // simple hash -> number string
    let h = 2166136261;
    for(let i=0;i<key.length;i++){
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return String((h>>>0));
  }

  // ---------- fatal overlay ----------
  function showFatal(msg){
    let pre = DOC.getElementById('hha-fatal');
    if(!pre){
      pre = DOC.createElement('pre');
      pre.id = 'hha-fatal';
      pre.style.position='fixed';
      pre.style.inset='12px';
      pre.style.zIndex='9999';
      pre.style.padding='12px';
      pre.style.borderRadius='14px';
      pre.style.border='1px solid rgba(148,163,184,.25)';
      pre.style.background='rgba(2,6,23,.92)';
      pre.style.color='rgba(229,231,235,.95)';
      pre.style.whiteSpace='pre-wrap';
      pre.style.overflow='auto';
      DOC.body.appendChild(pre);
    }
    pre.textContent = String(msg || 'Fatal error');
  }

  // ---------- start gate (mobile/cvr) ----------
  function shouldGate(view){
    // Gate on mobile + cvr (tap to start)
    return (view === 'mobile' || view === 'cvr');
  }

  function hideTapStart(){
    const tap = DOC.getElementById('tapStart');
    if(tap){
      tap.setAttribute('aria-hidden','true');
      tap.style.display='none';
    }
  }

  function showTapStart(){
    const tap = DOC.getElementById('tapStart');
    if(tap){
      tap.setAttribute('aria-hidden','false');
      tap.style.display='grid';
    }
  }

  // ---------- end overlay ----------
  function showEndOverlay(summary, ctx){
    const wrap = DOC.createElement('div');
    wrap.style.position='fixed';
    wrap.style.inset='0';
    wrap.style.zIndex='200';
    wrap.style.display='grid';
    wrap.style.placeItems='center';
    wrap.style.background='rgba(2,6,23,.62)';
    wrap.style.backdropFilter='blur(10px)';

    const rank = summary?.rank ?? '-';
    const score = summary?.scoreTotal ?? summary?.score ?? '-';
    const reason = summary?.reason ?? '-';

    const hub = ctx?.hub || ql('hub','');
    wrap.innerHTML = `
      <div style="width:min(680px,92vw);border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:18px 16px;background:rgba(2,6,23,.78);box-shadow:0 18px 60px rgba(0,0,0,.45);">
        <div style="font-weight:950;font-size:18px;">BrushVR จบแล้ว • Rank ${rank}</div>
        <div style="margin-top:6px;color:rgba(148,163,184,1);font-size:13px;line-height:1.5;">
          Score ${score} • Reason ${reason}
        </div>
        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
          <button id="btnRestart" style="padding:10px 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(34,197,94,.22);color:rgba(229,231,235,.95);font-weight:900;cursor:pointer;">Restart</button>
          <button id="btnBack" style="padding:10px 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.40);color:rgba(229,231,235,.95);font-weight:900;cursor:pointer;">Back HUB</button>
        </div>
        <div style="margin-top:10px;color:rgba(148,163,184,.95);font-size:12px;">
          pid=${ctx?.pid||'-'} • studyId=${ctx?.studyId||'-'} • phase=${ctx?.phase||'-'} • condition=${ctx?.conditionGroup||'-'}
        </div>
      </div>
    `;
    DOC.body.appendChild(wrap);

    wrap.querySelector('#btnRestart')?.addEventListener('click', ()=>location.reload());
    wrap.querySelector('#btnBack')?.addEventListener('click', ()=>{
      if(hub) location.href = hub;
      else history.back();
    });
  }

  // ---------- BOOT ----------
  function boot(){
    try{
      const view = detectView();
      applyViewToBody(view);

      const ctx = {
        game: 'brush',
        pid: getPid(),
        hub: ql('hub',''),                 // optional
        mode: ql('mode', ql('study','') ? 'study' : 'play'), // play|study
        studyId: ql('studyId', ql('study','')),
        phase: ql('phase',''),
        conditionGroup: ql('conditionGroup', ql('cond','')),
        time: clamp(qn('time', 90), 30, 180),
        seed: getSeed()
      };

      // Persist pid if provided
      try{
        const pidFromQS = ql('pid','');
        if(pidFromQS) localStorage.setItem('HHA_PID', pidFromQS);
      }catch(_){}

      // Require engine
      if(!WIN.BrushVR || typeof WIN.BrushVR.boot !== 'function'){
        showFatal('[BrushVR] missing engine: window.BrushVR.boot not found\n- ตรวจว่าโหลด brush.safe.js ก่อน brush.boot.js แล้ว\n- path: /herohealth/vr-brush/brush.safe.js');
        return;
      }

      // End listener (engine also has its own overlay, but we keep boot overlay minimal/safe)
      let ended = false;
      WIN.addEventListener('hha:end', (ev)=>{
        if(ended) return;
        ended = true;
        const summary = ev?.detail?.summary || ev?.detail || null;

        // If engine already appended overlay, we still show ours? -> keep minimal: only if none exists
        // We'll do soft check:
        if(!DOC.getElementById('hha-end-overlay')){
          showEndOverlay(summary, ctx);
        }
      });

      // Tap gate
      const gated = shouldGate(view);
      if(gated){
        showTapStart();
        const btn = DOC.getElementById('tapBtn');
        const tap = DOC.getElementById('tapStart');

        const start = ()=>{
          hideTapStart();
          // Start engine
          WIN.BrushVR.boot(ctx);
        };

        // allow button click + tap anywhere on overlay
        btn?.addEventListener('click', (e)=>{ e.preventDefault(); start(); }, {passive:false});
        tap?.addEventListener('click', (e)=>{
          // ignore if clicked inside button (already handled)
          if(e.target && e.target.id === 'tapBtn') return;
          e.preventDefault();
          start();
        }, {passive:false});

      }else{
        hideTapStart();
        WIN.BrushVR.boot(ctx);
      }

    }catch(err){
      showFatal(String(err?.stack || err));
    }
  }

  // Run when DOM ready
  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }

})();