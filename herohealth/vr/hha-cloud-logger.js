// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (LATEST, multi-game, flush-hardened)
// ✅ Listens: hha:end -> enqueue + flush session summary
// ✅ Queue persists localStorage (offline-safe), oldest-first sending
// ✅ sendBeacon first + fetch keepalive fallback
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload, online
// ✅ FIX: gameMode no longer hardcoded; auto-detect from URL/path OR ?gameMode=
// ✅ Exposes: window.HHA_LOGGER = { enabled, enqueue, flush, getQueue }

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_CLOUD_LOGGER__) return;
  WIN.__HHA_CLOUD_LOGGER__ = true;

  const qs = (k,d=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch(_){ return d; }
  };

  // Endpoint: ?log=https://script.google.com/macros/s/....
  const ENDPOINT = (qs('log','')||'').trim();

  const LS_KEY = 'HHA_LOG_QUEUE_V2';
  const LS_LAST_SENT_SIG = 'HHA_LOG_LAST_SENT_SIG_V1';

  function nowIso(){ return new Date().toISOString(); }

  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch(_){ return fallback; }
  }
  function loadQ(){
    try{ return safeJsonParse(localStorage.getItem(LS_KEY) || '[]', []) || []; }
    catch(_){ return []; }
  }
  function saveQ(q){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(q.slice(-120))); }catch(_){}
  }

  let queue = loadQ();
  let flushing = false;

  function payloadBase(){
    return {
      timestampIso: nowIso(),
      href: location.href,
      ua: navigator.userAgent || '',
      projectTag: qs('projectTag','HeroHealth'),
      app: 'HeroHealth',
      tzOffsetMin: (new Date()).getTimezoneOffset()
    };
  }

  function detectGameMode(){
    const explicit =
      (qs('gameMode','')||qs('game','')||qs('mode','')||'').trim().toLowerCase();
    if (explicit) return explicit;

    const p = (location.pathname || '').toLowerCase();

    if (p.includes('hydration')) return 'hydration';
    if (p.includes('groups'))    return 'groups';
    if (p.includes('plate'))     return 'plate';
    if (p.includes('goodjunk'))  return 'goodjunk';
    if (p.includes('hygiene'))   return 'hygiene';
    if (p.includes('fitness'))   return 'fitness';

    // fallback: try folder name after /herohealth/
    const m = p.match(/\/herohealth\/([^\/]+)\//);
    if (m && m[1]) return m[1];

    return 'unknown';
  }

  function detectDeviceView(){
    const v = (qs('view','')||'').toLowerCase();
    if (v) return v;
    // best-effort class hint
    try{
      const b = DOC.body;
      if (b.classList.contains('view-cvr')) return 'cvr';
      if (b.classList.contains('cardboard')) return 'cardboard';
      if (b.classList.contains('view-mobile')) return 'mobile';
      if (b.classList.contains('view-pc')) return 'pc';
    }catch(_){}
    return '';
  }

  function enqueue(obj){
    queue.push(obj);
    saveQ(queue);
  }

  async function postJson(url, obj){
    try{
      const body = JSON.stringify(obj);

      // Prefer sendBeacon (unload-safe)
      if(navigator.sendBeacon){
        const ok = navigator.sendBeacon(url, new Blob([body], {type:'application/json'}));
        if(ok) return true;
      }

      // Fallback fetch
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

    const q = queue.slice(); // snapshot
    let sent = 0;

    for(let i=0;i<q.length;i++){
      const ok = await postJson(ENDPOINT, q[i]);
      if(ok) sent++;
      else break; // stop if offline / failed
    }

    if(sent > 0){
      queue = q.slice(sent);
      saveQ(queue);
    }

    flushing = false;
  }

  // --- dedupe (กัน hha:end ซ้ำ) ---
  function makeSig(d){
    const sid = String(d?.sessionId || qs('sessionId','') || qs('studentKey','') || '');
    const gm  = String(d?.gameMode || detectGameMode());
    const sc  = String(d?.scoreFinal ?? d?.score ?? '');
    const ms  = String(d?.misses ?? d?.miss ?? '');
    const t   = String(d?.durationPlayedSec ?? d?.durationPlannedSec ?? qs('time','') ?? '');
    return [gm,sid,sc,ms,t].join('|');
  }
  function recentlySent(sig){
    try{
      const prev = safeJsonParse(localStorage.getItem(LS_LAST_SENT_SIG) || 'null', null);
      if(!prev || !prev.sig) return false;
      const dt = Date.now() - (prev.at || 0);
      return (prev.sig === sig && dt < 2200);
    }catch(_){ return false; }
  }
  function rememberSent(sig){
    try{
      localStorage.setItem(LS_LAST_SENT_SIG, JSON.stringify({ sig, at: Date.now() }));
    }catch(_){}
  }

  // Listen session end summary
  function onEnd(ev){
    try{
      const d = ev?.detail || {};
      const gm = String(d.gameMode || detectGameMode() || 'unknown');

      const pack = Object.assign(payloadBase(), {
        kind: 'session',
        gameMode: gm,

        // common ctx passthrough (HHA Standard-ish)
        runMode: d.runMode || qs('runMode', qs('run','play')),
        diff: d.diff || qs('diff','normal'),
        device: d.device || detectDeviceView(),

        hub: d.hub || qs('hub',''),
        phase: d.phase || qs('phase',''),
        conditionGroup: d.conditionGroup || qs('conditionGroup',''),
        studyId: d.studyId || qs('studyId',''),

        sessionId: d.sessionId || qs('sessionId', qs('studentKey','')),
        participantId: d.participantId || qs('participantId',''),

        seed: d.seed || qs('seed',''),
        durationPlannedSec: Number(d.durationPlannedSec || qs('time','0')) || 0,
        durationPlayedSec: Number(d.durationPlayedSec || 0) || 0,

        scoreFinal: Number(d.scoreFinal || d.score || 0) || 0,
        misses: Number(d.misses || d.miss || 0) || 0,
        grade: d.grade || '—',
        reason: d.reason || 'end',

        // keep full raw summary for research (สำคัญ)
        summary: d
      });

      const sig = makeSig(pack);
      if(recentlySent(sig)) return;
      rememberSent(sig);

      enqueue(pack);
      flush(); // best-effort immediate
    }catch(_){}
  }

  WIN.addEventListener('hha:end', onEnd, { passive:true });

  // Optional: log events if you emit them (future-proof)
  WIN.addEventListener('hha:event', (ev)=>{
    try{
      const d = ev?.detail || {};
      const pack = Object.assign(payloadBase(), {
        kind:'event',
        gameMode: String(d.gameMode || detectGameMode() || 'unknown'),
        sessionId: d.sessionId || qs('sessionId', qs('studentKey','')),
        name: d.name || 'event',
        data: d
      });
      enqueue(pack);
    }catch(_){}
  }, { passive:true });

  // Manual flush hook
  WIN.addEventListener('hha:flush', ()=>flush(), { passive:true });

  // unload flush
  WIN.addEventListener('pagehide', ()=>flush(), { passive:true });
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flush();
  }, { passive:true });
  WIN.addEventListener('beforeunload', ()=>flush(), { passive:true });

  // When back online
  WIN.addEventListener('online', ()=>flush(), { passive:true });

  // periodic flush
  setInterval(()=>flush(), 3500);

  // Expose controller
  WIN.HHA_LOGGER = {
    enabled: true,
    enqueue,
    flush,
    getQueue: ()=> queue.slice()
  };

})();