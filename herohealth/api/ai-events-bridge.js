// === /herohealth/api/ai-events-bridge.js ===
// HeroHealth AI Events Bridge — PRODUCTION (predict + coach)
// ✅ listens: hha:ai-predict, hha:ai-coach
// ✅ send to ?endpoint=... (keepalive) OR queue to localStorage
// ✅ flush-hardened on pagehide/visibilitychange
// v20260226-AI-BRIDGE

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const nowIso = ()=> new Date().toISOString();

  // queue storage
  const QKEY = 'HHA_AI_EVENT_QUEUE_V1';
  const MAX_Q = 1800; // cap to avoid huge localStorage
  const MAX_PAYLOAD = 6000; // trim json

  function safeJson(obj, maxLen){
    try{
      const s = JSON.stringify(obj ?? null);
      if(!maxLen) return s;
      return (s.length > maxLen) ? (s.slice(0, maxLen) + '…') : s;
    }catch(e){
      return '"[json_error]"';
    }
  }

  function loadQ(){
    try{
      const raw = localStorage.getItem(QKEY);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }

  function saveQ(arr){
    try{
      // cap
      if(arr.length > MAX_Q) arr.splice(0, arr.length - MAX_Q);
      localStorage.setItem(QKEY, JSON.stringify(arr));
    }catch(e){}
  }

  function pushQ(ev){
    const q = loadQ();
    q.push(ev);
    saveQ(q);
  }

  // transport: endpoint is optional
  function getEndpoint(){
    const ep = String(qs('endpoint','')||'').trim();
    if(!ep) return '';
    try{ return new URL(ep, location.href).toString(); }catch(e){ return ep; }
  }

  const endpoint = getEndpoint();
  const wantFlush = String(qs('flush','0')) === '1';

  // context fields (match your platform-ish conventions)
  function ctx(){
    return {
      pid: String(qs('pid','anon')||'anon'),
      run: String(qs('run','play')||'play'),
      diff: String(qs('diff','normal')||'normal'),
      view: String(qs('view','mobile')||'mobile'),
      seed: String(qs('seed','')||''),
      studyId: String(qs('studyId', qs('study',''))||''),
      phase: String(qs('phase','')||''),
      conditionGroup: String(qs('conditionGroup', qs('cond',''))||''),
      cat: String(qs('cat','')||''),
      theme: String(qs('theme', qs('game',''))||''),
    };
  }

  async function sendBatch(batch){
    if(!endpoint || !batch || !batch.length) return { ok:false, reason:'no-endpoint-or-empty' };

    // payload format: simple + extensible
    const body = {
      kind: 'hha_ai_batch',
      ts: Date.now(),
      iso: nowIso(),
      n: batch.length,
      ctx: ctx(),
      events: batch
    };

    try{
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: safeJson(body, 120000),
        keepalive: true,
        credentials: 'omit'
      });
      if(!res.ok) return { ok:false, reason:`http_${res.status}` };
      return { ok:true };
    }catch(e){
      return { ok:false, reason:'fetch_fail' };
    }
  }

  // flush queue (best effort)
  let flushing = false;
  async function flushQ(){
    if(flushing) return;
    flushing = true;
    try{
      const q = loadQ();
      if(!q.length || !endpoint){ flushing = false; return; }

      // send in chunks
      let i = 0;
      const CHUNK = 60;
      while(i < q.length){
        const part = q.slice(i, i+CHUNK);
        const r = await sendBatch(part);
        if(!r.ok){
          // stop; keep remaining (including part not confirmed)
          const remain = q.slice(i);
          saveQ(remain);
          flushing = false;
          return;
        }
        i += CHUNK;
      }
      // all sent
      saveQ([]);
    }catch(e){}
    flushing = false;
  }

  // rate limit send immediate to reduce spam
  let lastSendMs = 0;
  function shouldSendNow(){
    const t = performance.now ? performance.now() : Date.now();
    if(t - lastSendMs > 1200){
      lastSendMs = t;
      return true;
    }
    return false;
  }

  function normalizeEvent(kind, detail){
    const c = ctx();
    // store compact record
    const payload = {
      kind: String(kind || ''),
      ts: Date.now(),
      iso: nowIso(),
      game: String(detail?.game || c.theme || 'goodjunk'),
      pid: c.pid,
      run: c.run,
      diff: c.diff,
      view: c.view,
      seed: c.seed,
      why: detail?.why ?? null,
      confidence: detail?.confidence ?? null,
      payload: safeJson(detail, MAX_PAYLOAD)
    };
    return payload;
  }

  async function ingest(kind, detail){
    const ev = normalizeEvent(kind, detail);

    // always queue first (offline-safe)
    pushQ(ev);

    // best-effort immediate send (only if endpoint provided)
    if(endpoint && shouldSendNow()){
      await flushQ();
    }
  }

  // listeners
  WIN.addEventListener('hha:ai-predict', (e)=>{
    try{ ingest('hha:ai-predict', e?.detail || null); }catch(_) {}
  });

  WIN.addEventListener('hha:ai-coach', (e)=>{
    try{ ingest('hha:ai-coach', e?.detail || null); }catch(_) {}
  });

  // flush hardened
  function onHide(){
    if(!wantFlush) return;
    // fire and forget
    try{ flushQ(); }catch(e){}
  }
  WIN.addEventListener('pagehide', onHide);
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden) onHide();
  });

  // tiny debug helper
  WIN.HHA_AI_BRIDGE = {
    flush: flushQ,
    qsize: ()=> loadQ().length,
    endpoint
  };
})();