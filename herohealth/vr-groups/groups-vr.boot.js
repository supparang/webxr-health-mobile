// === C: /herohealth/groups-vr.boot.js ===
// GroupsVR Launcher Boot — PRODUCTION
// ✅ Detect view: pc | mobile | cvr (cardboard)
// ✅ Auto-redirect to run file: /herohealth/vr-groups/groups-vr.html
// ✅ Tap-to-start fallback (for autoplay/audio/fullscreen restrictions)
// ✅ Keeps query params: run/diff/style/time/seed/ai/hub/log + passthrough others

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const qs = (k, def=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  };

  function isMobile(){
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.innerWidth < 860);
  }

  function detectCardboardHint(){
    // heuristic: if user passes ?view=cvr or ?cvr=1, honor it
    const v = String(qs('view','')||'').toLowerCase();
    if (v === 'cvr' || v === 'cardboard') return true;
    const cvr = String(qs('cvr','0')||'0');
    if (cvr === '1' || cvr === 'true') return true;
    return false;
  }

  function detectView(){
    // priority: explicit view param
    const v = String(qs('view','')||'').toLowerCase();
    if (v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return v;

    // heuristic:
    if (detectCardboardHint()) return 'cvr';
    return isMobile() ? 'mobile' : 'pc';
  }

  function buildRunUrl(view){
    // run file lives in /herohealth/vr-groups/groups-vr.html (folder-run)
    const base = new URL('./vr-groups/groups-vr.html', location.href);

    // standard params
    const run   = String(qs('run','play')||'play');      // play | research
    const diff  = String(qs('diff','normal')||'normal');
    const style = String(qs('style','feel')||'feel');
    const time  = String(qs('time','90')||'90');
    const seed  = String(qs('seed', Date.now()) || Date.now());
    const ai    = String(qs('ai','0')||'0');
    const hub   = String(qs('hub','')||'');
    const log   = String(qs('log','')||'');

    base.searchParams.set('view', view);
    base.searchParams.set('run', run);
    base.searchParams.set('diff', diff);
    base.searchParams.set('style', style);
    base.searchParams.set('time', time);
    base.searchParams.set('seed', seed);
    base.searchParams.set('ai', ai);

    if (hub) base.searchParams.set('hub', hub);
    if (log) base.searchParams.set('log', log);

    // passthrough anything else (except duplicates)
    try{
      const sp = new URL(location.href).searchParams;
      sp.forEach((v,k)=>{
        if (['view','run','diff','style','time','seed','ai','hub','log','cvr'].includes(k)) return;
        base.searchParams.set(k, v);
      });
    }catch(_){}

    return base.toString();
  }

  function needsTapGate(view){
    // If user explicitly wants tap gate: ?tap=1
    const tap = String(qs('tap','0')||'0');
    if (tap === '1' || tap === 'true') return true;

    // cVR often needs gesture for fullscreen/immersive + audio
    if (view === 'cvr') return true;

    // mobile sometimes: safer to gate (but we still try auto first)
    return false;
  }

  function setStatus(text){
    const el = DOC.getElementById('bootStatus');
    if (el) el.textContent = text;
  }

  function showTap(on, runUrl){
    const box = DOC.getElementById('tapGate');
    const btn = DOC.getElementById('btnTapStart');
    if (!box || !btn) return;

    box.style.display = on ? 'flex' : 'none';
    if (on){
      btn.onclick = ()=>{
        try{ setStatus('กำลังเข้าเกม…'); }catch{}
        location.href = runUrl;
      };
    }else{
      btn.onclick = null;
    }
  }

  function tryAutoRedirect(runUrl, view){
    // attempt auto; if blocked by policy we fallback to tap gate
    // Note: location.href redirect usually works, but gesture may be needed for later APIs.
    // We'll still do tap gate for cVR or explicit tap.
    const gate = needsTapGate(view);

    if (gate){
      setStatus('แตะเพื่อเริ่ม (Tap-to-start)');
      showTap(true, runUrl);
      return;
    }

    // non-gated: redirect immediately
    setStatus('กำลังเข้าเกมอัตโนมัติ…');
    location.replace(runUrl);
  }

  // ---- start ----
  function boot(){
    const view = detectView();
    const runUrl = buildRunUrl(view);

    // update UI
    try{
      const vEl = DOC.getElementById('detView');
      if (vEl) vEl.textContent = view.toUpperCase();
    }catch(_){}

    // If user requests "detect then auto run", do it.
    tryAutoRedirect(runUrl, view);
  }

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();