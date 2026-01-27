/* === /herohealth/vr-groups/telemetry.js ===
HHA Telemetry Pack — PACK 13 (Lite/Full/Off + Throttle + Flush-hardened + Recover/Export)
✅ Mode: ?tlm=off|lite|full  (default: lite)
✅ Throttle/Dedup: prevents spam
✅ Flush-hardened: visibilitychange/pagehide/beforeunload/freeze + interval autosnap
✅ Recover: last pack + history packs (keep 10)
✅ Export: JSON + sessions.csv + events.csv

Usage (in groups-vr.html):
  const TLM = window.HHA_TLM.create({...});
  TLM.start();
  TLM.state({...});
  TLM.event('score', {...}, {level:'lite', throttleMs:400, dedupKey:'score'});
  TLM.end(summary);
  TLM.recoverLast(); TLM.exportPack(pack);
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
    // short deterministic-ish id
    const r = Math.floor(Math.random()*1e9).toString(36);
    return Date.now().toString(36) + '-' + r;
  }

  function getParam(name, def){
    try{ return new URL(location.href).searchParams.get(name) ?? def; }
    catch{ return def; }
  }

  // ---------------- Factory ----------------
  const API = {};
  const LS_LAST = 'HHA_TLM_LAST_PACK';
  const LS_HIST = 'HHA_TLM_PACK_HISTORY'; // array of {id, savedAtIso, gameTag, mode, reason, bytes}

  API.create = function(cfg){
    cfg = cfg || {};
    const gameTag  = String(cfg.gameTag || 'Game');
    const projectTag = String(cfg.projectTag || 'HeroHealth');
    const sessionId = String(cfg.sessionId || makeId());
    const ctxFn = (typeof cfg.ctxFn === 'function') ? cfg.ctxFn : ()=>({});

    const modeIn = String(cfg.mode || getParam('tlm','lite') || 'lite').toLowerCase();
    const MODE = (modeIn==='off'||modeIn==='full'||modeIn==='lite') ? modeIn : 'lite';

    const snapEveryMs = clamp(cfg.snapEveryMs ?? 10000, 6000, 30000);
    const maxEventsFull = clamp(cfg.maxEventsFull ?? 3500, 200, 8000);
    const maxEventsLite = clamp(cfg.maxEventsLite ?? 900,  100, 2500);
    const keepHistory = clamp(cfg.keepHistory ?? 10, 1, 30);

    const levelRank = { off:0, lite:1, full:2 };
    const allowLevel = (lvl)=>{
      lvl = String(lvl||'lite').toLowerCase();
      if (!(lvl in levelRank)) lvl = 'lite';
      return levelRank[MODE] >= levelRank[lvl];
    };

    let startedAtIso = isoNow();
    let startedAtMs = nowMs();

    let lastState = Object.assign({
      left:'', score:'', combo:'', misses:'', acc:'', grade:'',
      groupKey:'', groupName:'', miniLeftSec:''
    }, cfg.initialState||{});

    // session row + events
    let sessionRow = null;
    const events = [];

    // throttle/dedup maps
    const lastEventAt = new Map();     // key -> ms
    const lastEventSig= new Map();     // key -> signature string
    const lastFlushAt = { ms:0 };

    // autosnap
    let snapIt = 0;
    let armed = false;
    let ended = false;

    function ctxBase(){
      const ctx = ctxFn() || {};
      // normalize a bit
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

    function capEvents(){
      const lim = (MODE==='full') ? maxEventsFull : maxEventsLite;
      if (events.length > lim){
        events.splice(0, events.length - lim);
      }
    }

    function packPayload(reason){
      const payload = {
        v: 13,
        savedAtIso: isoNow(),
        reason: String(reason||'flush'),
        projectTag, gameTag, sessionId,
        mode: MODE,
        startTimeIso: startedAtIso,
        state: lastState,
        ctx: ctxBase(),
        sessionRow: sessionRow,
        // keep events trimmed already
        events: events
      };
      return payload;
    }

    function saveHistoryMeta(payloadStr, payloadObj){
      try{
        const bytes = payloadStr.length;
        const hist = safeParse(localStorage.getItem(LS_HIST), []) || [];
        hist.unshift({
          id: payloadObj.sessionId || sessionId,
          savedAtIso: payloadObj.savedAtIso || isoNow(),
          gameTag: payloadObj.gameTag || gameTag,
          mode: payloadObj.mode || MODE,
          reason: payloadObj.reason || '',
          bytes
        });
        localStorage.setItem(LS_HIST, safeJson(hist.slice(0, keepHistory), '[]'));
      }catch(_){}
    }

    function flushToLocalStorage(reason){
      if (MODE === 'off') return true;

      capEvents();
      const payload = packPayload(reason);
      const tries = [3500, 2200, 1400, 900, 550, 300, 150];

      for (const lim of tries){
        try{
          // if too big, temporarily slice events further
          const saved = Object.assign({}, payload, {
            events: payload.events.slice(Math.max(0, payload.events.length - lim))
          });
          const str = safeJson(saved, '');
          localStorage.setItem(LS_LAST, str);
          saveHistoryMeta(str, saved);
          lastFlushAt.ms = nowMs();
          return true;
        }catch(_){}
      }

      // emergency lite
      try{
        const saved = Object.assign({}, payload, { events: payload.events.slice(Math.max(0, payload.events.length - 80)), emergency:true });
        const str = safeJson(saved, '');
        localStorage.setItem(LS_LAST, str);
        saveHistoryMeta(str, saved);
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

    function recoverHistory(){
      const hist = safeParse(localStorage.getItem(LS_HIST), []) || [];
      // return only meta; actual pack is LS_LAST only (simple). If want multi-pack storage later, expand.
      return hist;
    }

    function clearRecover(){
      try{ localStorage.removeItem(LS_LAST); }catch(_){}
      // keep history meta by design (optional)
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

    // Flush-hardened hooks
    function armFlushHardened(){
      if (armed) return;
      armed = true;

      const onVis = ()=>{
        if (!DOC) return;
        if (DOC.visibilityState === 'hidden'){
          hardFlush('vis_hidden');
        }
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
      startedAtMs = nowMs();
      armFlushHardened();
      startAutoSnapshot();
      // initial pack
      flushToLocalStorage('start');
    }

    function state(patch){
      if (MODE === 'off') return;
      try{ lastState = Object.assign(lastState, patch||{}); }catch(_){}
      // in lite: don’t log state as event every time; snapshot handles it
    }

    // event(type, data, opts)
    // opts: { level:'lite'|'full', throttleMs, dedupKey, sigFn }
    function event(type, data, opts){
      if (MODE === 'off') return;
      opts = opts || {};
      const lvl = String(opts.level || 'lite');
      if (!allowLevel(lvl)) return;

      const t = nowMs();

      // throttle
      const throttleMs = Number(opts.throttleMs || 0);
      if (throttleMs > 0){
        const k = String(opts.dedupKey || type);
        const last = lastEventAt.get(k) || 0;
        if (t - last < throttleMs) return;
        lastEventAt.set(k, t);
      }

      // dedup (signature)
      const dedupKey = (opts.dedupKey != null) ? String(opts.dedupKey) : null;
      if (dedupKey){
        const sig = (typeof opts.sigFn === 'function')
          ? String(opts.sigFn(data||{}))
          : safeJson(data||{}, '');
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
        json: (MODE==='full') ? safeJson(d, '') : '' // full only
      };

      events.push(row);
      capEvents();

      // lite: occasional flush if long time no flush
      if (MODE !== 'off'){
        const since = nowMs() - (lastFlushAt.ms || 0);
        if (since > Math.max(12000, snapEveryMs*1.2)){
          flushToLocalStorage('soft_flush');
        }
      }
    }

    function end(summary){
      if (ended) return;
      ended = true;

      stopAutoSnapshot();
      // sessionRow for export
      sessionRow = buildSessionRow(summary||{});

      // always log end event in lite/full (if not off)
      if (MODE !== 'off'){
        event('end', Object.assign({kind:'end'}, summary||{}), { level:'lite', throttleMs:0, dedupKey:'end' });
        flushToLocalStorage('end');
      }
    }

    function exportPack(pack){
      const p = pack || recoverLast();
      if (!p){ alert('ไม่มี pack ให้ export'); return false; }

      const evRows = (p.events||[]).map(eventRow);
      const sesRows = [p.sessionRow || buildSessionRow(p.sessionRow||{})];

      const ok1 = downloadText(`HHA-${p.gameTag||gameTag}-${p.sessionId||sessionId}.json`, safeJson(p, '{}'));
      const ok2 = downloadText(`HHA-${p.gameTag||gameTag}-${p.sessionId||sessionId}-sessions.csv`, toCSV(sesRows));
      const ok3 = downloadText(`HHA-${p.gameTag||gameTag}-${p.sessionId||sessionId}-events.csv`, toCSV(evRows));
      return !!(ok1 && ok2 && ok3);
    }

    return {
      mode: ()=>MODE,
      sessionId: ()=>sessionId,
      start, end, state, event,
      flush: (reason)=>flushToLocalStorage(reason||'manual'),
      hardFlush,
      recoverLast, recoverHistory, clearRecover,
      exportPack
    };
  };

  root.HHA_TLM = API;

})(typeof window !== 'undefined' ? window : globalThis);