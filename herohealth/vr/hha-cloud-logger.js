// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened)
// ✅ Listens: hha:end -> sends session summary JSON
// ✅ Queue persist localStorage (offline-safe)
// ✅ keepalive + sendBeacon fallback
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_CLOUD_LOGGER__) return;
  WIN.__HHA_CLOUD_LOGGER__ = true;

  const qs = (k,d=null)=>{ try{return new URL(location.href).searchParams.get(k) ?? d;}catch{return d;} };

  const ENDPOINT = (qs('log','')||'').trim(); // ?log=...
  const LS_KEY = 'HHA_LOG_QUEUE_V1';

  function loadQ(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY) || '[]') || []; }catch(_){ return []; }
  }
  function saveQ(q){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(q.slice(-80))); }catch(_){}
  }

  let queue = loadQ();
  let flushing = false;

  function payloadBase(){
    return {
      timestampIso: new Date().toISOString(),
      href: location.href,
      ua: navigator.userAgent || '',
      projectTag: qs('projectTag','HeroHealth'),
    };
  }

  function enqueue(obj){
    queue.push(obj);
    saveQ(queue);
  }

  async function postJson(url, obj){
    try{
      const body = JSON.stringify(obj);
      if(navigator.sendBeacon){
        const ok = navigator.sendBeacon(url, new Blob([body], {type:'application/json'}));
        if(ok) return true;
      }
      const res = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body,
        keepalive:true,
        mode:'cors'
      });
      return !!res && res.ok;
    }catch(_){
      return false;
    }
  }

  async function flush(){
    if(flushing) return;
    if(!ENDPOINT) return;
    if(queue.length === 0) return;

    flushing = true;

    const q = queue.slice();
    let sent = 0;

    for(let i=0;i<q.length;i++){
      const ok = await postJson(ENDPOINT, q[i]);
      if(ok) sent++;
      else break;
    }

    if(sent > 0){
      queue = q.slice(sent);
      saveQ(queue);
    }

    flushing = false;
  }

  function pickGameMode(d){
    // Prefer event summary (authoritative)
    const gm = (d && (d.gameMode || d.game || d.mode)) ? String(d.gameMode || d.game || d.mode) : '';
    if(gm) return gm;

    // Fallback to query hints
    const q1 = qs('gameMode','') || qs('gm','') || qs('game','');
    if(q1) return String(q1);

    // Fallback: infer from path
    const p = String(location.pathname||'').toLowerCase();
    if(p.includes('hydration')) return 'hydration';
    if(p.includes('goodjunk')) return 'goodjunk';
    if(p.includes('groups')) return 'groups';
    if(p.includes('plate')) return 'plate';
    return 'unknown';
  }

  function onEnd(ev){
    try{
      const d = ev?.detail || {};
      const pack = Object.assign(payloadBase(), {
        kind: 'session',
        gameMode: pickGameMode(d),            // ✅ FIX: no more hardcode goodjunk
        runMode: d.runMode || qs('run','play'),
        diff: d.diff || qs('diff','normal'),
        device: d.device || qs('view',''),
        sessionId: d.sessionId || qs('sessionId', qs('studentKey','')) || '',
        seed: d.seed || qs('seed','') || '',

        durationPlannedSec: Number(d.durationPlannedSec || qs('time','0')) || 0,
        durationPlayedSec: Number(d.durationPlayedSec || 0) || 0,
        scoreFinal: Number(d.scoreFinal || 0) || 0,
        misses: Number(d.misses || 0) || 0,
        grade: d.grade || '—',
        reason: d.reason || 'end',

        // keep full summary for research (small, useful)
        summary: d
      });

      enqueue(pack);
      flush();
    }catch(_){}
  }

  WIN.addEventListener('hha:end', onEnd, { passive:true });

  WIN.addEventListener('hha:flush', ()=>flush(), { passive:true });
  WIN.addEventListener('pagehide', ()=>flush(), { passive:true });
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flush();
  }, { passive:true });
  WIN.addEventListener('beforeunload', ()=>flush(), { passive:true });

  setInterval(()=>flush(), 3500);
})();