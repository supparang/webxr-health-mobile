// === /herohealth/germ-detective/germ-detective.boot.js ===
// Germ Detective BOOT — PRODUCTION SAFE
// ✅ Deterministic research seed (pid + scene + localDay + seed)
// ✅ Wires GameApp + emits minimal meta events
// ✅ No Apps Script / no network
// Requires: ./app.js (ESM)

import GameApp from './app.js';

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }
  function clamp(v,a,b){
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  // local day key (device local timezone)
  function localDayKey(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function hash32(str){
    str = String(str||'');
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // params
  const P = {
    run:  String(qs('run','play')).toLowerCase(),
    diff: String(qs('diff','normal')).toLowerCase(),
    time: clamp(qs('time','80'), 20, 600),
    seed: String(qs('seed','') || Date.now()),
    pid:  String(qs('pid','anon')) || 'anon',
    scene:String(qs('scene','classroom')).toLowerCase(),
    view: String(qs('view','pc')).toLowerCase(),
    hub:  String(qs('hub','/herohealth/hub.html'))
  };

  // deterministic research seed base
  if(P.run === 'research'){
    const base = `${P.pid}|${P.scene}|${localDayKey()}|${P.seed}|${P.diff}`;
    const h = hash32(base);
    WIN.__GD_RESEARCH_SEED_BASE__ = base;
    // overwrite seed to hashed number string
    P.seed = String(h);
  }

  // expose minimal global
  WIN.GD = WIN.GD || {};
  WIN.GD.params = P;

  function emitEvent(name, payload){
    try{ WIN.dispatchEvent(new CustomEvent('hha:event', { detail:{ name, payload } })); }catch(_){}
  }

  // boot
  const app = GameApp({
    timeSec: P.time,
    seed: P.seed,
    run: P.run,
    diff: P.diff,
    scene: P.scene,
    view: P.view,
    pid: P.pid
  });

  // wire end -> save last summary + back hub helper
  WIN.addEventListener('hha:end', (ev)=>{
    const d = ev.detail || {};
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        game:'germ-detective',
        at: new Date().toISOString(),
        reason: d.reason || 'end',
        score: d.score || null,
        url: location.href
      }));
    }catch(_){}
    emitEvent('summary_saved', { reason:d.reason||'end' });
  }, false);

  // safe: log boot
  emitEvent('boot', {
    game:'germ-detective',
    run:P.run, diff:P.diff, time:P.time, seed:P.seed, pid:P.pid,
    scene:P.scene, view:P.view,
    researchSeedBase: WIN.__GD_RESEARCH_SEED_BASE__ || null
  });

  // init
  try{
    app.init();
  }catch(err){
    console.error(err);
    emitEvent('boot_error', { message:String(err && err.message || err), stack:String(err && err.stack || '') });
  }

})();