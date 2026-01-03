// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger V2 — PRODUCTION SAFE (Queue + Beacon + Flush Hardened)
// ✅ Works for all games: GoodJunk / Plate / Hydration / Groups
// ✅ Never throws (won't break gameplay)
// ✅ Queue in memory + localStorage (crash/pagehide safe)
// ✅ Flush on: hha:start, hha:end, pagehide, visibilitychange(hidden)
// ✅ Transport: sendBeacon -> fetch keepalive -> fetch no-cors
// ✅ Endpoint: URL param "log" overrides default, else uses DEFAULT_ENDPOINT

(function(){
  'use strict';

  const ROOT = window;
  const DOC  = document;

  if (ROOT.__HHA_CLOUD_LOGGER_V2__) return;
  ROOT.__HHA_CLOUD_LOGGER_V2__ = true;

  // -------------------------
  // Config
  // -------------------------
  const DEFAULT_ENDPOINT =
    'https://script.google.com/macros/s/AKfycbxdy-3BjJhn6Fo3kQX9oxHQIlXT7p2OXn-UYfv1MKV5oSW6jYG-RlnAgKlHqrNxxbhmaw/exec';

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  const ENDPOINT = (qs('log', null) || DEFAULT_ENDPOINT);

  // allow disabling by ?nolog=1
  const DISABLED = (qs('nolog','0') === '1');

  // Queue sizes
  const LS_KEY = 'HHA_LOG_QUEUE_V2';
  const MAX_QUEUE = 220;     // in-memory cap
  const MAX_LS     = 140;    // persisted cap
  const FLUSH_BATCH = 20;

  // -------------------------
  // Safe helpers
  // -------------------------
  function safeNowIso(){
    try { return new Date().toISOString(); } catch { return ''; }
  }
  function safeStr(x){
    try { return (x == null) ? '' : String(x); } catch { return ''; }
  }
  function safeJson(obj){
    try { return JSON.stringify(obj); }
    catch { return '{"_err":"json"}'; }
  }
  function safeParse(str){
    try { return JSON.parse(str); } catch { return null; }
  }

  function getLS(){
    try{
      const s = localStorage.getItem(LS_KEY);
      if(!s) return [];
      const j = safeParse(s);
      return Array.isArray(j) ? j : [];
    }catch(_){
      return [];
    }
  }
  function setLS(arr){
    try{ localStorage.setItem(LS_KEY, safeJson(arr)); }catch(_){}
  }
  function pushLS(items){
    try{
      const cur = getLS();
      const next = cur.concat(items);
      // keep last MAX_LS only
      const trimmed = next.length > MAX_LS ? next.slice(next.length - MAX_LS) : next;
      setLS(trimmed);
    }catch(_){}
  }
  function popLS(n){
    try{
      const cur = getLS();
      if(!cur.length) return [];
      const take = cur.slice(0, n);
      const rest = cur.slice(n);
      setLS(rest);
      return take;
    }catch(_){
      return [];
    }
  }

  // -------------------------
  // Session context (lightweight)
  // -------------------------
  const ctx = {
    sessionId: null,
    projectTag: null,
    runMode: null,
    view: null,
    diff: null,
    seed: null,
    startTimeIso: null,
    gameVersion: null,
  };

  function ensureSessionId(){
    if(ctx.sessionId) return ctx.sessionId;
    // stable-ish per page load
    ctx.sessionId = 'HHA-' + Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
    return ctx.sessionId;
  }

  function enrich(payload){
    // Never mutate original
    const p = payload && typeof payload === 'object' ? payload : {};
    return {
      ts: safeNowIso(),
      sessionId: ensureSessionId(),
      projectTag: p.projectTag ?? ctx.projectTag ?? null,
      runMode: p.runMode ?? ctx.runMode ?? null,
      view: p.view ?? ctx.view ?? null,
      diff: p.diff ?? ctx.diff ?? null,
      seed: p.seed ?? ctx.seed ?? null,
      gameVersion: p.gameVersion ?? ctx.gameVersion ?? null,
      href: safeStr(location.href),
      ...p,
    };
  }

  // -------------------------
  // Queue (memory)
  // -------------------------
  const memQ = [];
  function memPush(item){
    if(DISABLED) return;
    try{
      memQ.push(item);
      if(memQ.length > MAX_QUEUE) memQ.splice(0, memQ.length - MAX_QUEUE);
    }catch(_){}
  }

  // -------------------------
  // Transport
  // -------------------------
  function sendBeacon(url, bodyStr){
    try{
      if(!navigator.sendBeacon) return false;
      const blob = new Blob([bodyStr], { type:'application/json' });
      return navigator.sendBeacon(url, blob);
    }catch(_){
      return false;
    }
  }

  async function sendFetchKeepalive(url, bodyStr){
    try{
      await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: bodyStr,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit',
      });
      return true;
    }catch(_){
      return false;
    }
  }

  async function sendFetchNoCors(url, bodyStr){
    try{
      await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: bodyStr,
        keepalive: true,
        mode: 'no-cors',
      });
      return true;
    }catch(_){
      return false;
    }
  }

  async function postBatch(batch){
    if(DISABLED) return false;
    if(!batch || !batch.length) return true;

    const payload = {
      kind: 'HHA_LOG_BATCH_V2',
      count: batch.length,
      items: batch
    };
    const bodyStr = safeJson(payload);

    // 1) beacon
    if(sendBeacon(ENDPOINT, bodyStr)) return true;

    // 2) fetch keepalive
    if(await sendFetchKeepalive(ENDPOINT, bodyStr)) return true;

    // 3) fetch no-cors
    if(await sendFetchNoCors(ENDPOINT, bodyStr)) return true;

    return false;
  }

  // -------------------------
  // Flush logic
  // -------------------------
  let flushing = false;

  async function flushOnce(maxBatch=FLUSH_BATCH){
    if(DISABLED) return true;
    if(flushing) return true;
    flushing = true;

    try{
      // 1) merge LS -> memQ first
      const fromLS = popLS(maxBatch);
      if(fromLS.length){
        for(const it of fromLS) memQ.unshift(it);
      }

      // 2) take batch from memQ
      const batch = memQ.splice(0, maxBatch);
      if(!batch.length){
        flushing = false;
        return true;
      }

      const ok = await postBatch(batch);
      if(!ok){
        // push back to LS (persist), keep minimal
        pushLS(batch);
        flushing = false;
        return false;
      }

      flushing = false;
      return true;
    }catch(_){
      // fail-safe: persist whatever we can
      try{
        if(memQ.length){
          pushLS(memQ.splice(0, memQ.length));
        }
      }catch(__){}
      flushing = false;
      return false;
    }
  }

  async function flushAll(){
    if(DISABLED) return;
    // try a few rounds quickly (don’t block gameplay too long)
    for(let i=0;i<6;i++){
      const ok = await flushOnce(FLUSH_BATCH);
      if(!ok) break;
      // stop when memQ empty and LS empty
      if(memQ.length === 0 && getLS().length === 0) break;
    }
  }

  function flushSoon(){
    // non-blocking
    try{ setTimeout(()=>{ flushAll(); }, 0); }catch(_){}
  }

  function persistMemQ(){
    try{
      if(memQ.length){
        pushLS(memQ.splice(0, memQ.length));
      }
    }catch(_){}
  }

  // -------------------------
  // Public: capture events
  // -------------------------
  function onStart(detail){
    try{
      const d = detail || {};
      // capture context
      ctx.projectTag = d.projectTag ?? ctx.projectTag ?? null;
      ctx.runMode    = d.runMode ?? ctx.runMode ?? null;
      ctx.view       = d.view ?? ctx.view ?? null;
      ctx.diff       = d.diff ?? ctx.diff ?? null;
      ctx.seed       = d.seed ?? ctx.seed ?? null;
      ctx.startTimeIso = d.startTimeIso ?? ctx.startTimeIso ?? safeNowIso();
      ctx.gameVersion  = d.gameVersion ?? ctx.gameVersion ?? null;
      ensureSessionId();

      memPush(enrich({ type:'start', ...d }));
      flushSoon();
    }catch(_){}
  }

  function onLog(detail){
    try{
      const d = detail || {};
      // expects {type, ...payload}
      const t = d.type ? String(d.type) : 'log';
      memPush(enrich({ type: t, ...d }));
      // don’t flush too frequently — but start/end should flush
      // here: flush every ~8 logs (cheap heuristic)
      if(memQ.length % 8 === 0) flushSoon();
    }catch(_){}
  }

  function onEnd(detail){
    try{
      const d = detail || {};
      memPush(enrich({ type:'end', ...d }));
      flushSoon();
      // also persist just in case
      persistMemQ();
    }catch(_){}
  }

  // -------------------------
  // Hook into HHA events
  // -------------------------
  ROOT.addEventListener('hha:start', (ev)=> onStart(ev && ev.detail), { passive:true });
  ROOT.addEventListener('hha:log',   (ev)=> onLog(ev && ev.detail),   { passive:true });
  ROOT.addEventListener('hha:end',   (ev)=> onEnd(ev && ev.detail),   { passive:true });

  // If some game emits "hha:end" direct summary AND also logs end via hha:log, this still ok (duplicate ok).

  // -------------------------
  // Flush-hardened lifecycle
  // -------------------------
  // pagehide is best for mobile; visibilitychange(hidden) covers some cases
  ROOT.addEventListener('pagehide', ()=>{
    try{
      persistMemQ();
      // best-effort immediate flush using beacon in flushAll()
      flushAll();
    }catch(_){}
  }, { passive:true });

  DOC.addEventListener('visibilitychange', ()=>{
    try{
      if(DOC.visibilityState === 'hidden'){
        persistMemQ();
        flushAll();
      }
    }catch(_){}
  }, { passive:true });

  // Optional: flush leftover queue on load
  flushSoon();

})();