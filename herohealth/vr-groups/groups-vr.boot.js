// === /herohealth/vr-groups/groups-vr.boot.js ===
// GroupsVR Boot (PATCH B)
// ✅ Practice 15s auto (unless ?practice=0 or run=practice already)
// ✅ Preserves ctx passthrough + deterministic seed if provided
// ✅ No override of view (auto detect stays in your html / vr-ui.js)
// ✅ Safe: never crash if engine missing

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const qs = (k, def=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
  };

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function readCtx(){
    const run = String(qs('run','play')||'play').toLowerCase();
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const time = clamp(qs('time', 90), 15, 180);
    const seed = String(qs('seed','')||'');
    return {
      runMode: run,
      diff,
      time,
      seed,

      // passthrough
      hub: String(qs('hub','')||''),
      studyId: String(qs('studyId','')||''),
      phase: String(qs('phase','')||''),
      conditionGroup: String(qs('conditionGroup','')||''),
      log: String(qs('log','')||''),
      view: String(qs('view','')||''),
      style: String(qs('style','')||''),
      ai: String(qs('ai','')||'') // optional
    };
  }

  function banner(text){
    let el = DOC.getElementById('groups-practice-banner');
    if(!el){
      el = DOC.createElement('div');
      el.id = 'groups-practice-banner';
      el.style.cssText =
        'position:fixed; z-index:9999; left:50%; top:calc(10px + env(safe-area-inset-top,0px));' +
        'transform:translateX(-50%); padding:8px 12px; border-radius:999px;' +
        'background:rgba(2,6,23,.82); border:1px solid rgba(148,163,184,.22);' +
        'color:#e5e7eb; font:700 13px/1 system-ui; letter-spacing:.2px; '+
        'pointer-events:none; box-shadow:0 12px 24px rgba(0,0,0,.25)';
      DOC.body.appendChild(el);
    }
    el.textContent = text;
    el.style.display = 'block';
    return el;
  }

  function hideBanner(){
    const el = DOC.getElementById('groups-practice-banner');
    if(el) el.style.display = 'none';
  }

  function getEngine(){
    try{
      return WIN.GroupsVR && WIN.GroupsVR.GameEngine;
    }catch(_){ return null; }
  }

  function startRun(diff, ctx){
    const eng = getEngine();
    if(!eng || typeof eng.start !== 'function'){
      console.warn('[GroupsVR.boot] Engine missing');
      return false;
    }
    // layer binding
    try{
      const layer = DOC.getElementById('playLayer') || DOC.querySelector('#playLayer') || DOC.body;
      eng.setLayerEl && eng.setLayerEl(layer);
    }catch(_){}

    return !!eng.start(diff, ctx);
  }

  // -------- Practice flow --------
  const base = readCtx();
  const wantPractice = String(qs('practice','1')) !== '0';

  // If already practice in URL, do not auto-chain.
  const alreadyPractice = (base.runMode === 'practice');

  let chained = false;

  function onEnd(ev){
    const d = ev && ev.detail ? ev.detail : null;
    if(!d) return;

    // If practice finished and we haven't chained yet -> start real run.
    if(wantPractice && !alreadyPractice && !chained && String(d.runMode||'') === 'practice'){
      chained = true;
      hideBanner();

      // Start REAL run (restore original runMode, time)
      const realCtx = Object.assign({}, base, {
        runMode: (base.runMode === 'research') ? 'research' : 'play',
        time: base.time
      });

      // small countdown feel
      banner('พร้อม! เข้าเกมจริง…');
      setTimeout(()=>{
        hideBanner();
        startRun(base.diff, realCtx);
      }, 650);
    }
  }

  WIN.addEventListener('hha:end', onEnd);

  // Boot now
  function boot(){
    if(!wantPractice || alreadyPractice){
      // direct start
      startRun(base.diff, base);
      return;
    }

    // Practice first: 15 sec
    banner('โหมดฝึก 15 วิ: ลองเล็งแล้วแตะยิง 🎯');
    const practiceCtx = Object.assign({}, base, {
      runMode: 'practice',
      time: 15,
      // keep same seed so it feels consistent, but ok if blank
    });
    startRun(base.diff, practiceCtx);
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();