/* === /herohealth/vr-groups/telemetry-sheet.js ===
HHA Telemetry → Google Sheet Uploader — PACK 14.0
✅ Batch upload (sessions/events)
✅ Throttle + retry w/ backoff
✅ Offline queue in localStorage
✅ Flush-hardened via sendBeacon / fetch keepalive
✅ Respects modes: tlm=off disables; run=research can still upload if you want (toggle below)

Protocol (POST JSON):
{
  kind: "hha_batch_v1",
  projectTag, gameTag, sessionId,
  sentAtIso,
  payload: {
    sessionRow: {...} | null,
    events: [ ...eventRows... ]
  }
}
*/

(function(root){
  'use strict';
  if (!root) return;

  const DOC = root.document;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }
  function isoNow(){ return new Date().toISOString(); }
  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(n,a,b){ n=Number(n)||0; return n<a?a:(n>b?b:n); }
  function safeParse(s, fb){ try{ return JSON.parse(s); }catch{ return fb; } }
  function safeJson(x, fb){ try{ return JSON.stringify(x); }catch{ return fb||'{}'; } }

  const LS_Q = 'HHA_TLM_QUEUE_V1';

  function readQ(){
    return safeParse(localStorage.getItem(LS_Q), []) || [];
  }
  function writeQ(arr){
    try{ localStorage.setItem(LS_Q, safeJson(arr, '[]')); }catch(_){}
  }
  function pushQ(item, max=30){
    const q = readQ();
    q.push(item);
    while(q.length > max) q.shift();
    writeQ(q);
  }
  function shiftQ(){
    const q = readQ();
    const it = q.shift();
    writeQ(q);
    return it || null;
  }

  function beacon(url, dataStr){
    try{
      const blob = new Blob([dataStr], {type:'application/json'});
      return navigator.sendBeacon(url, blob);
    }catch(_){ return false; }
  }

  async function postJSON(url, obj, keepalive=false){
    const body = safeJson(obj, '{}');
    // try sendBeacon for “last second” situations
    if (keepalive && typeof navigator !== 'undefined' && navigator.sendBeacon){
      const ok = beacon(url, body);
      if (ok) return { ok:true, via:'beacon' };
    }
    // fallback fetch
    const res = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body,
      keepalive: !!keepalive,
      credentials:'omit',
      cache:'no-store'
    });
    return { ok: res.ok, via:'fetch', status: res.status };
  }

  const UPL = {};

  UPL.create = function(cfg){
    cfg = cfg || {};
    const allowResearchUpload = !!cfg.allowResearchUpload; // default false
    const maxQueue = clamp(cfg.maxQueue ?? 30, 5, 80);
    const batchMaxEvents = clamp(cfg.batchMaxEvents ?? 260, 40, 1200);
    const minSendGapMs = clamp(cfg.minSendGapMs ?? 1800, 300, 8000);
    const retryBaseMs = clamp(cfg.retryBaseMs ?? 1400, 600, 8000);
    const retryMaxMs  = clamp(cfg.retryMaxMs  ?? 12000, 4000, 30000);

    let lastSendAt = 0;
    let inflight = false;

    function enabled(){
      const url = String(qs('log','')||'').trim();
      if (!url) return false;
      const tlm = String(qs('tlm','lite')||'lite').toLowerCase();
      if (tlm === 'off') return false;

      const run = String(qs('run','play')||'play').toLowerCase();
      if (run === 'research' && !allowResearchUpload) return false;

      const upl = String(qs('upl','1')||'1').toLowerCase(); // allow override
      if (upl === '0' || upl === 'off' || upl === 'false') return false;

      return true;
    }

    function endpoint(){ return String(qs('log','')||'').trim(); }

    function enqueueFromPack(pack){
      if (!pack) return false;
      if (!enabled()) return false;

      const payload = {
        kind: 'hha_batch_v1',
        projectTag: pack.projectTag || 'HeroHealth',
        gameTag: pack.gameTag || 'Game',
        sessionId: pack.sessionId || '',
        sentAtIso: isoNow(),
        payload: {
          sessionRow: pack.sessionRow || null,
          // limit events per batch to keep light
          events: (pack.events||[]).slice(-batchMaxEvents)
        }
      };

      pushQ({
        atIso: isoNow(),
        url: endpoint(),
        data: payload,
        tries: 0,
        nextAtMs: 0
      }, maxQueue);

      return true;
    }

    async function pump(why){
      if (!enabled()) return false;
      if (inflight) return false;

      const t = nowMs();
      if (t - lastSendAt < minSendGapMs) return false;

      const item = shiftQ();
      if (!item) return false;

      // if scheduled retry time not reached, put it back and stop
      if (item.nextAtMs && t < item.nextAtMs){
        const q = readQ();
        q.unshift(item);
        writeQ(q);
        return false;
      }

      inflight = true;
      try{
        const url = item.url || endpoint();
        const keepalive = (why === 'pagehide' || why === 'beforeunload' || why === 'freeze' || why === 'vis_hidden');

        const r = await postJSON(url, item.data, keepalive);
        lastSendAt = nowMs();
        inflight = false;

        if (r && r.ok) return true;

        // failed → requeue with backoff
        const tries = (item.tries|0) + 1;
        const back = Math.min(retryMaxMs, retryBaseMs * Math.pow(1.8, Math.min(6, tries)));
        item.tries = tries;
        item.nextAtMs = nowMs() + back;
        pushQ(item, maxQueue);
        return false;
      }catch(_){
        inflight = false;
        const tries = (item.tries|0) + 1;
        const back = Math.min(retryMaxMs, retryBaseMs * Math.pow(1.8, Math.min(6, tries)));
        item.tries = tries;
        item.nextAtMs = nowMs() + back;
        pushQ(item, maxQueue);
        return false;
      }
    }

    function hardFlushNow(why){
      // best-effort: send a few queued items immediately
      const run = async ()=>{
        for (let i=0;i<3;i++){
          const ok = await pump(why||'hard');
          if (!ok) break;
        }
      };
      try{ run(); }catch(_){}
    }

    // flush-hardened hooks
    function arm(){
      if (!DOC) return;
      DOC.addEventListener('visibilitychange', ()=>{
        if (DOC.visibilityState === 'hidden') hardFlushNow('vis_hidden');
      }, {passive:true});

      root.addEventListener('pagehide', ()=> hardFlushNow('pagehide'), {passive:true});
      root.addEventListener('beforeunload', ()=> hardFlushNow('beforeunload'), {passive:true});
      root.addEventListener('freeze', ()=> hardFlushNow('freeze'), {passive:true});
    }

    arm();

    // background pump (light)
    const it = setInterval(()=>{ try{ pump('tick'); }catch(_){}
    }, 900);

    return {
      enabled,
      enqueueFromPack,
      pump,
      hardFlushNow,
      stop: ()=>{ try{ clearInterval(it); }catch(_){ } }
    };
  };

  root.HHA_TLM_SHEET = UPL;

})(typeof window !== 'undefined' ? window : globalThis);