// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened)
// ✅ Collects & sends session summary + optional events
// ✅ Primary: POST JSON to ?log= endpoint (Google Apps Script / any endpoint)
// ✅ Queue persistence in localStorage (offline-safe)
// ✅ keepalive + sendBeacon fallback
// ✅ Retry with exponential backoff + jitter
// ✅ Dedupe by sessionId/gameMode/timestampIso
// ✅ Hooks: hha:end, hha:force_end, pagehide, visibilitychange, beforeunload
//
// Usage:
// - Include in HTML: <script src="../vr/hha-cloud-logger.js" defer></script>
// - Provide endpoint in URL: ?log=https://script.google.com/macros/s/.../exec
//
// Emits (optional):
// - hha:log:status { queued, sent, lastError, lastSentAt }
//
// Notes:
// - This file does NOT require modules, safe for <script defer>.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;
  if (WIN.__HHA_CLOUD_LOGGER__) return;
  WIN.__HHA_CLOUD_LOGGER__ = true;

  // ---------- helpers ----------
  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const now = ()=> Date.now();
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function safeJsonParse(s){
    try{ return JSON.parse(s); }catch(_){ return null; }
  }

  function stableStringify(obj){
    // stable key order for dedupe hashing
    try{
      const seen = new WeakSet();
      const walk = (x)=>{
        if (x && typeof x === 'object'){
          if (seen.has(x)) return null;
          seen.add(x);
          if (Array.isArray(x)) return x.map(walk);
          const keys = Object.keys(x).sort();
          const out = {};
          for (const k of keys) out[k] = walk(x[k]);
          return out;
        }
        return x;
      };
      return JSON.stringify(walk(obj));
    }catch(_){
      try{ return JSON.stringify(obj); }catch(__){ return ''; }
    }
  }

  function hashStr(s){
    s = String(s||'');
    let h = 2166136261;
    for (let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h>>>0).toString(16);
  }

  // ---------- config ----------
  const ENDPOINT = String(qs('log','') || '').trim();
  const RUNMODE = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const GAME = String(qs('gameMode', qs('game','')) || '').toLowerCase();

  const STORE_KEY = '__HHA_LOG_QUEUE_V1__';
  const SENT_KEY  = '__HHA_LOG_SENT_V1__'; // recent dedupe map

  const CFG = {
    enabled: !!ENDPOINT,
    endpoint: ENDPOINT,
    maxQueue: 80,
    maxSentKeep: 120, // keep recent ids to dedupe
    retryMax: 6,
    backoffBaseMs: 800,
    backoffMaxMs: 18000,
    flushIntervalMs: 2500,
    idleFlushMs: 9000
  };

  // ---------- state ----------
  const S = {
    queue: [],
    sending: false,
    lastError: '',
    lastSentAt: 0,
    lastFlushAt: 0,
    flushTimer: null,
    idleTimer: null,
    sentMap: Object.create(null) // id -> ts
  };

  function loadQueue(){
    const raw = localStorage.getItem(STORE_KEY);
    const arr = safeJsonParse(raw);
    if (Array.isArray(arr)) S.queue = arr.filter(Boolean);
  }

  function saveQueue(){
    try{
      localStorage.setItem(STORE_KEY, JSON.stringify(S.queue.slice(0, CFG.maxQueue)));
    }catch(_){}
  }

  function loadSent(){
    const raw = localStorage.getItem(SENT_KEY);
    const obj = safeJsonParse(raw);
    if (obj && typeof obj === 'object') S.sentMap = obj;
  }

  function saveSent(){
    try{ localStorage.setItem(SENT_KEY, JSON.stringify(S.sentMap)); }catch(_){}
  }

  function pruneSent(){
    const entries = Object.entries(S.sentMap).sort((a,b)=>Number(b[1])-Number(a[1]));
    const keep = entries.slice(0, CFG.maxSentKeep);
    const next = Object.create(null);
    for (const [id, ts] of keep) next[id] = ts;
    S.sentMap = next;
    saveSent();
  }

  function makeId(payload){
    // prefer stable identifiers
    const sid = payload.sessionId || payload.studentKey || '';
    const gm  = payload.gameMode || payload.game || GAME || '';
    const t   = payload.timestampIso || payload.startTimeIso || payload.endTimeIso || payload.ts || '';
    const core = `${sid}|${gm}|${t}|${payload.seed||''}|${payload.runMode||RUNMODE}`;
    // fallback include score+misses for uniqueness
    const extra = `|${payload.scoreFinal||''}|${payload.misses||''}`;
    return 'hha_' + hashStr(core + extra);
  }

  function normalizePayload(p){
    // attach context defaults but DO NOT overwrite existing fields
    const o = Object.assign({}, p || {});
    if (!o.timestampIso) o.timestampIso = new Date().toISOString();
    if (!o.runMode) o.runMode = RUNMODE;
    if (!o.gameMode && GAME) o.gameMode = GAME;
    if (!o.pageUrl) o.pageUrl = location.href;
    if (!o.ua) o.ua = navigator.userAgent || '';
    return o;
  }

  function enqueue(payload, meta){
    if (!CFG.enabled) return false;

    const p = normalizePayload(payload);
    const id = makeId(p);
    if (S.sentMap[id]) return false; // already sent

    // dedupe in-queue
    if (S.queue.some(it => it && it.id === id)) return false;

    const item = {
      id,
      tries: 0,
      nextAt: 0,
      createdAt: now(),
      meta: Object.assign({ type:'summary' }, meta||{}),
      payload: p
    };

    S.queue.push(item);
    // cap queue
    if (S.queue.length > CFG.maxQueue) S.queue.splice(0, S.queue.length - CFG.maxQueue);

    saveQueue();
    emit('hha:log:status', {
      queued: S.queue.length,
      sent: Object.keys(S.sentMap).length,
      lastError: S.lastError || '',
      lastSentAt: S.lastSentAt || 0
    });

    scheduleFlush(80);
    return true;
  }

  function computeBackoffMs(tries){
    const t = clamp(tries, 0, CFG.retryMax);
    const base = CFG.backoffBaseMs * Math.pow(1.85, t);
    const jitter = base * (0.18 + Math.random()*0.22);
    return clamp(base + jitter, CFG.backoffBaseMs, CFG.backoffMaxMs);
  }

  async function postJsonKeepalive(url, obj){
    const body = JSON.stringify(obj);
    // 1) fetch keepalive
    try{
      const r = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body,
        keepalive:true,
        cache:'no-store',
        credentials:'omit',
        mode:'cors'
      });
      if (!r.ok) throw new Error('HTTP '+r.status);
      return true;
    }catch(err){
      // 2) fallback sendBeacon (best-effort)
      try{
        if (navigator.sendBeacon){
          const blob = new Blob([body], { type:'application/json' });
          const ok = navigator.sendBeacon(url, blob);
          if (ok) return true;
        }
      }catch(_){}
      throw err;
    }
  }

  async function flushOnce(force=false){
    if (!CFG.enabled) return;
    if (S.sending) return;
    if (!S.queue.length) return;

    const t = now();
    if (!force && (t - S.lastFlushAt) < 300) return;
    S.lastFlushAt = t;

    // pick first item ready
    const idx = S.queue.findIndex(it => it && (it.nextAt||0) <= t);
    if (idx < 0) return;

    const item = S.queue[idx];
    if (!item || !item.payload) {
      S.queue.splice(idx,1);
      saveQueue();
      return;
    }

    S.sending = true;

    try{
      // envelope
      const envelope = {
        _hha: 1,
        id: item.id,
        type: item.meta?.type || 'summary',
        createdAt: item.createdAt,
        tries: item.tries,
        payload: item.payload
      };

      await postJsonKeepalive(CFG.endpoint, envelope);

      // mark sent
      S.sentMap[item.id] = now();
      pruneSent();

      // remove from queue
      S.queue.splice(idx,1);
      saveQueue();

      S.lastError = '';
      S.lastSentAt = now();
      emit('hha:log:status', {
        queued: S.queue.length,
        sent: Object.keys(S.sentMap).length,
        lastError: '',
        lastSentAt: S.lastSentAt
      });
    }catch(err){
      item.tries = (item.tries|0) + 1;
      S.lastError = String(err && (err.message || err)) || 'send failed';

      if (item.tries > CFG.retryMax){
        // give up but keep a minimal record in sentMap to avoid infinite spam
        S.sentMap[item.id] = now();
        pruneSent();
        // drop it
        S.queue.splice(idx,1);
      } else {
        const wait = computeBackoffMs(item.tries);
        item.nextAt = now() + wait;
      }
      saveQueue();

      emit('hha:log:status', {
        queued: S.queue.length,
        sent: Object.keys(S.sentMap).length,
        lastError: S.lastError,
        lastSentAt: S.lastSentAt || 0
      });
    } finally {
      S.sending = false;
    }

    // continue flushing if more items
    if (S.queue.length) scheduleFlush(120);
  }

  function scheduleFlush(delayMs){
    try{
      clearTimeout(S.flushTimer);
      S.flushTimer = setTimeout(()=>flushOnce(false), clamp(delayMs||0, 0, 5000));
    }catch(_){}
  }

  function scheduleIdleFlush(){
    try{
      clearTimeout(S.idleTimer);
      S.idleTimer = setTimeout(()=>flushOnce(true), CFG.idleFlushMs);
    }catch(_){}
  }

  // ---------- public API ----------
  const API = {
    enabled: CFG.enabled,
    endpoint: CFG.endpoint,
    enqueue,
    flush: ()=>flushOnce(true),
    getQueue: ()=>S.queue.slice(),
  };
  WIN.HHA_LOGGER = API;

  // ---------- init load ----------
  try{ loadQueue(); }catch(_){}
  try{ loadSent(); }catch(_){}
  pruneSent();

  // periodic flush
  if (CFG.enabled){
    setInterval(()=>flushOnce(false), CFG.flushIntervalMs);
  }

  // ---------- event bindings ----------
  function onEnd(ev){
    const sum = ev && ev.detail ? ev.detail : null;
    if (!sum || typeof sum !== 'object') return;
    enqueue(sum, { type:'summary' });
    scheduleIdleFlush();
  }

  WIN.addEventListener('hha:end', onEnd);
  WIN.addEventListener('hha:force_end', (ev)=>{
    // if game emits payload too, capture it
    const d = ev?.detail;
    if (d && typeof d === 'object') enqueue(d, { type:'force_end' });
    scheduleIdleFlush();
  });

  // page lifecycle hardening
  DOC.addEventListener('visibilitychange', ()=>{
    if (DOC.visibilityState === 'hidden'){
      flushOnce(true);
    } else {
      scheduleIdleFlush();
    }
  });

  WIN.addEventListener('pagehide', ()=>{ flushOnce(true); }, { capture:true });
  WIN.addEventListener('beforeunload', ()=>{ flushOnce(true); }, { capture:true });

  // also flush when leaving via link/back (best effort)
  WIN.addEventListener('popstate', ()=>{ scheduleIdleFlush(); });

  // expose debug helper (optional)
  WIN.__HHA_LOG_DEBUG__ = {
    status: ()=>({
      enabled: CFG.enabled,
      endpoint: CFG.endpoint,
      queued: S.queue.length,
      sent: Object.keys(S.sentMap).length,
      sending: S.sending,
      lastError: S.lastError,
      lastSentAt: S.lastSentAt
    }),
    flush: ()=>flushOnce(true),
    clearQueue: ()=>{
      S.queue = [];
      saveQueue();
    }
  };

})();