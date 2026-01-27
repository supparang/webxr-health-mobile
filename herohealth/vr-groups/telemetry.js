/* === /herohealth/vr-groups/telemetry.js ===
HHA Telemetry Pack — PACK 13.7
✅ Mode: ?tlm=off|lite|full (default: lite)
✅ Throttle/Dedup/Sampling
✅ Flush-hardened: visibilitychange/pagehide/beforeunload/freeze + autosnap
✅ Multi-pack storage: keeps last N packs as full payload (not only meta)
✅ History browser helpers + Export selected pack (JSON/CSV)

Storage keys:
  - HHA_TLM_PACK_LAST            (last pack JSON)
  - HHA_TLM_PACK_INDEX           (array meta: [{key,id,gameTag,mode,savedAtIso,reason,bytes}])
  - HHA_TLM_PACK__<key>          (full payload JSON)
*/

(function(root){
  'use strict';
  if (!root) return;

  const DOC = root.document;

  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function isoNow(){ return new Date().toISOString(); }
  function clamp(n,a,b){ n=Number(n)||0; return n<a?a:(n>b?b:n); }
  function safeJson(x, fallback){ try{ return JSON.stringify(x); }catch{ return fallback||'{}'; } }
  function safeParse(s, fallback){ try{ return JSON.parse(s); }catch{ return fallback; } }
  function strBytes(s){ try{ return (s||'').length; }catch{ return 0; } }

  function csvEscape(v){
    const s = (v==null)?'':String(v);
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }
  function toCSV(rows){
    if (!rows || !rows.length) return '';
    const cols = Object.keys(rows[0]);
    const head = cols.map(csvEscape).join(',');
    const body = rows.map(r=>cols.map(c=>csvEscape(r[c])).join(',')).join('\n');
    return head + '\n' + body + '\n';
  }
  function downloadText(filename, text){
    try{
      const blob = new Blob([String(text||'')], {type:'text/plain;charset=utf-8'});
      const a = DOC.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); a.remove(); }catch(_){} }, 50);
      return true;
    }catch(_){ return false; }
  }

  function makeId(){
    const r = Math.floor(Math.random()*1e9).toString(36);
    return Date.now().toString(36) + '-' + r;
  }
  function getParam(name, def){
    try{ return new URL(location.href).searchParams.get(name) ?? def; }
    catch{ return def; }
  }

  // ---- storage keys ----
  const LS_LAST  = 'HHA_TLM_PACK_LAST';
  const LS_INDEX = 'HHA_TLM_PACK_INDEX';
  const LS_PREFIX= 'HHA_TLM_PACK__'; // + key

  function readIndex(){
    return safeParse(localStorage.getItem(LS_INDEX), []) || [];
  }
  function writeIndex(arr){
    try{ localStorage.setItem(LS_INDEX, safeJson(arr, '[]')); }catch(_){}
  }
  function packKeyFrom(sessionId, savedAtIso){
    // short stable key for localStorage key
    const t = String(savedAtIso||isoNow()).replace(/[:.TZ-]/g,'').slice(0,14);
    return `${t}__${String(sessionId||'').slice(0,24)}`;
  }

  function pruneOldPacks(keep){
    keep = clamp(keep, 1, 30);
    const idx = readIndex();
    if (idx.length <= keep) return;

    const drop = idx.slice(keep);
    const keepArr = idx.slice(0, keep);

    for (const it of drop){
      try{ localStorage.removeItem(LS_PREFIX + it.key); }catch(_){}
    }
    writeIndex(keepArr);
  }

  function eventRow(e){
    return {
      t: e.tIso || '',
      ms: e.ms ?? '',
      type: e.type || '',
      kind: e.kind || '',
      left: e.left ?? '',
      score: e.score ?? '',
      combo: e.combo ?? '',
      misses: e.misses ?? '',
      acc: e.acc ?? '',
      grade: e.grade ?? '',
      groupKey: e.groupKey ?? '',
      groupName: e.groupName ?? '',
      note: e.note ?? '',
      json: e.json ?? ''
    };
  }

  // ---------------- Factory ----------------
  const API = {};

  API.create = function(cfg){
    cfg = cfg || {};
    const gameTag    = String(cfg.gameTag || 'Game');
    const projectTag = String(cfg.projectTag || 'HeroHealth');
    const sessionId  = String(cfg.sessionId || makeId());
    const ctxFn = (typeof cfg.ctxFn === 'function') ? cfg.ctxFn : ()=>({});

    const modeIn = String(cfg.mode || getParam('tlm','lite') || 'lite').toLowerCase();
    const MODE = (modeIn==='off'||modeIn==='full'||modeIn==='lite') ? modeIn : 'lite';

    const snapEveryMs    = clamp(cfg.snapEveryMs ?? 10000, 6000, 30000);
    const maxEventsFull  = clamp(cfg.maxEventsFull ?? 3500, 200, 8000);
    const maxEventsLite  = clamp(cfg.maxEventsLite ?? 900,  100, 2500);
    const keepHistory    = clamp(cfg.keepHistory ?? 10, 1, 30);

    const levelRank = { off:0, lite:1, full:2 };
    const allowLevel = (lvl)=>{
      lvl = String(lvl||'lite').toLowerCase();
      if (!(lvl in levelRank)) lvl = 'lite';
      return levelRank[MODE] >= levelRank[lvl];
    };

    let startedAtIso = isoNow();
    let startedAtMs  = nowMs();

    let lastState = Object.assign({
      left:'', score:'', combo:'', misses:'', acc:'', grade:'',
      groupKey:'', groupName:'', miniLeftSec:''
    }, cfg.initialState||{});

    let sessionRow = null;
    const events = [];

    const lastEventAt  = new Map();
    const lastEventSig = new Map();
    const lastFlushAt  = { ms:0 };

    let snapIt = 0;
    let armed = false;
    let ended = false;

    function ctxBase(){
      const ctx = ctxFn() || {};
      ctx.projectTag = ctx.projectTag || projectTag;
      ctx.gameTag = ctx.gameTag || gameTag;
      ctx.sessionId = ctx.sessionId || sessionId;
      return ctx;
    }

    function buildSessionRow(summary){
      const s = summary || {};
      const ctx = ctxBase();
      return Object.assign({
        timestampIso: isoNow(),
        projectTag, gameTag, sessionId,
        mode: MODE,
        runMode: s.runMode ?? ctx.runMode ?? '',
        diff: s.diff ?? ctx.diff ?? '',
        view: ctx.view ?? '',
        seed: s.seed ?? ctx.seed ?? '',
        durationPlayedSec: s.durationPlayedSec ?? '',
        durationPlannedSec: s.durationPlannedSec ?? '',
        scoreFinal: s.scoreFinal ?? '',
        grade: s.grade ?? '',
        accuracyGoodPct: s.accuracyGoodPct ?? '',
        misses: s.misses ?? '',
      }, ctx);
    }

    function capEvents(){
      const lim = (MODE==='full') ? maxEventsFull : maxEventsLite;
      if (events.length > lim) events.splice(0, events.length - lim);
    }

    function packPayload(reason){
      return {
        v: 13.7,
        savedAtIso: isoNow(),
        reason: String(reason||'flush'),
        projectTag, gameTag, sessionId,
        mode: MODE,
        startTimeIso: startedAtIso,
        state: lastState,
        ctx: ctxBase(),
        sessionRow: sessionRow,
        events: events
      };
    }

    // ✅ Multi-pack save (full payload per key)
    function savePackToStorage(payload){
      const key = packKeyFrom(sessionId, payload.savedAtIso);
      const str = safeJson(payload, '');
      const bytes = strBytes(str);

      // write last
      localStorage.setItem(LS_LAST, str);

      // write pack by key
      localStorage.setItem(LS_PREFIX + key, str);

      // update index (dedup by key)
      const idx = readIndex();
      const meta = {
        key,
        id: sessionId,
        gameTag: payload.gameTag || gameTag,
        mode: payload.mode || MODE,
        savedAtIso: payload.savedAtIso || isoNow(),
        reason: payload.reason || '',
        bytes
      };
      const next = [meta].concat(idx.filter(x=>x.key !== key));
      writeIndex(next.slice(0, keepHistory));

      pruneOldPacks(keepHistory);
      return true;
    }

    function flushToLocalStorage(reason){
      if (MODE === 'off') return true;

      capEvents();
      const payload = packPayload(reason);

      // try progressively trimming events if quota issues
      const tries = [3500, 2200, 1400, 900, 550, 300, 150, 80];
      for (const lim of tries){
        try{
          const saved = Object.assign({}, payload, {
            events: payload.events.slice(Math.max(0, payload.events.length - lim))
          });
          savePackToStorage(saved);
          lastFlushAt.ms = nowMs();
          return true;
        }catch(_){}
      }

      // emergency minimal
      try{
        const saved = Object.assign({}, payload, { events: payload.events.slice(-50), emergency:true });
        savePackToStorage(saved);
        lastFlushAt.ms = nowMs();
        return true;
      }catch(_){}
      return false;
    }

    function hardFlush(reason){
      try{ flushToLocalStorage(reason||'hard'); }catch(_){}
    }

    function recoverLast(){
      const s = localStorage.getItem(LS_LAST);
      if (!s) return null;
      return safeParse(s, null);
    }

    function listHistory(){
      return readIndex(); // meta list newest-first
    }

    function recoverByKey(key){
      if (!key) return null;
      const s = localStorage.getItem(LS_PREFIX + key);
      if (!s) return null;
      return safeParse(s, null);
    }

    function clearAllPacks(){
      try{ localStorage.removeItem(LS_LAST); }catch(_){}
      const idx = readIndex();
      for (const it of idx){
        try{ localStorage.removeItem(LS_PREFIX + it.key); }catch(_){}
      }
      try{ localStorage.removeItem(LS_INDEX); }catch(_){}
    }

    function exportPack(pack){
      const p = pack || recoverLast();
      if (!p){ alert('ไม่มี pack ให้ export'); return false; }

      const evRows = (p.events||[]).map(eventRow);
      const sesRows = [p.sessionRow || buildSessionRow(p.sessionRow||{})];

      const base = `HHA-${p.gameTag||gameTag}-${p.sessionId||sessionId}`;
      const ok1 = downloadText(`${base}.json`, safeJson(p, '{}'));
      const ok2 = downloadText(`${base}-sessions.csv`, toCSV(sesRows));
      const ok3 = downloadText(`${base}-events.csv`, toCSV(evRows));
      return !!(ok1 && ok2 && ok3);
    }

    function startAutoSnapshot(){
      if (MODE === 'off') return;
      stopAutoSnapshot();
      snapIt = setInterval(()=>{ try{ flushToLocalStorage('autosnap'); }catch(_){} }, snapEveryMs);
    }
    function stopAutoSnapshot(){
      try{ clearInterval(snapIt); }catch(_){}
      snapIt = 0;
    }

    function armFlushHardened(){
      if (armed) return;
      armed = true;

      const onVis = ()=>{
        if (!DOC) return;
        if (DOC.visibilityState === 'hidden') hardFlush('vis_hidden');
      };
      const onPageHide = ()=> hardFlush('pagehide');
      const onBeforeUnload = ()=> hardFlush('beforeunload');
      const onFreeze = ()=> hardFlush('freeze');

      try{ DOC.addEventListener('visibilitychange', onVis, {passive:true}); }catch(_){}
      try{ root.addEventListener('pagehide', onPageHide, {passive:true}); }catch(_){}
      try{ root.addEventListener('beforeunload', onBeforeUnload, {passive:true}); }catch(_){}
      try{ root.addEventListener('freeze', onFreeze, {passive:true}); }catch(_){}
    }

    // ---------------- Public API ----------------
    function start(){
      ended = false;
      startedAtIso = isoNow();
      startedAtMs  = nowMs();
      armFlushHardened();
      startAutoSnapshot();
      flushToLocalStorage('start');
    }

    function state(patch){
      if (MODE === 'off') return;
      try{ lastState = Object.assign(lastState, patch||{}); }catch(_){}
    }

    // event(type, data, opts)
    function event(type, data, opts){
      if (MODE === 'off') return;
      opts = opts || {};
      const lvl = String(opts.level || 'lite');
      if (!allowLevel(lvl)) return;

      const t = nowMs();

      const throttleMs = Number(opts.throttleMs || 0);
      if (throttleMs > 0){
        const k = String(opts.dedupKey || type);
        const last = lastEventAt.get(k) || 0;
        if (t - last < throttleMs) return;
        lastEventAt.set(k, t);
      }

      const dedupKey = (opts.dedupKey != null) ? String(opts.dedupKey) : null;
      if (dedupKey){
        const sig = (typeof opts.sigFn === 'function') ? String(opts.sigFn(data||{})) : safeJson(data||{}, '');
        const prev = lastEventSig.get(dedupKey);
        if (prev === sig) return;
        lastEventSig.set(dedupKey, sig);
      }

      const d = data || {};
      const row = {
        tIso: isoNow(),
        ms: Math.round(t - startedAtMs),
        type: String(type||''),
        kind: String(d.kind||''),
        left: d.left ?? lastState.left ?? '',
        score: d.score ?? lastState.score ?? '',
        combo: d.combo ?? lastState.combo ?? '',
        misses: d.misses ?? lastState.misses ?? '',
        acc: d.acc ?? lastState.acc ?? '',
        grade: d.grade ?? lastState.grade ?? '',
        groupKey: d.groupKey ?? lastState.groupKey ?? '',
        groupName: d.groupName ?? lastState.groupName ?? '',
        note: d.note ?? '',
        json: (MODE==='full') ? safeJson(d, '') : ''
      };

      // ✅ optional sampling (full only) — if user passes opts.sample=0..1
      const sample = (opts.sample != null) ? clamp(opts.sample, 0, 1) : 1;
      if (sample < 1 && Math.random() > sample) return;

      events.push(row);
      capEvents();

      // soft flush occasionally
      const since = nowMs() - (lastFlushAt.ms || 0);
      if (since > Math.max(12000, snapEveryMs*1.2)) flushToLocalStorage('soft_flush');
    }

    function end(summary){
      if (ended) return;
      ended = true;
      stopAutoSnapshot();
      sessionRow = buildSessionRow(summary||{});
      if (MODE !== 'off'){
        event('end', Object.assign({kind:'end'}, summary||{}), { level:'lite', dedupKey:'end' });
        flushToLocalStorage('end');
      }
    }

    return {
      mode: ()=>MODE,
      sessionId: ()=>sessionId,
      start, end, state, event,
      flush: (reason)=>flushToLocalStorage(reason||'manual'),
      hardFlush,

      // ✅ multi-pack APIs
      recoverLast,
      listHistory,
      recoverByKey,
      clearAllPacks,
      exportPack
    };
  };

  root.HHA_TLM = API;

})(typeof window !== 'undefined' ? window : globalThis);