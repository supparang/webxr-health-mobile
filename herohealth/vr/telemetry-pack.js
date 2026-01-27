/* === /herohealth/vr/telemetry-pack.js ===
HHA Telemetry Pack — PACK 13 (Lite/Full/Off) + Throttle + Flush-hardened + Recover/Export
✅ Levels: off | lite | full  (qs: ?tlm=off|lite|full)
✅ Throttle snapshots (lite=1000ms, full=250ms)
✅ Flush-hardened: visibilitychange/pagehide/beforeunload + periodic flush
✅ Recover: unsent queue persists in localStorage; export anytime
✅ Network: sendBeacon (preferred) or fetch keepalive to ?log=...
✅ No spam: max queue + drop oldest + auto-degrade to lite if heavy
USAGE:
  <script src="../vr/telemetry-pack.js" defer></script>
  window.HHA_TLM?.init({ gameTag:'GroupsVR', runMode, diff, view, seed, logUrl })
  window.HHA_TLM?.bindSummaryGetter(()=>lastSummary)
*/

(function (WIN) {
  'use strict';
  const DOC = WIN.document;
  if (!DOC) return;

  if (WIN.HHA_TLM && WIN.HHA_TLM.__loaded__) return;

  const TLM = WIN.HHA_TLM = WIN.HHA_TLM || {};
  TLM.__loaded__ = true;

  // ---------------- utils ----------------
  const nowMs = () => (WIN.performance && performance.now) ? performance.now() : Date.now();
  const isoNow = () => new Date().toISOString();
  const clamp = (v,a,b)=>{ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); };

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function truthy(v){
    v = String(v ?? '').toLowerCase();
    return (v==='1'||v==='true'||v==='yes'||v==='on');
  }

  // ---------------- config ----------------
  const CFG = {
    // default levels by runMode (can override via ?tlm=...)
    defaultByRun: { play:'lite', research:'full', practice:'off' },
    snapMs: { lite: 1000, full: 250 },
    flushEveryMs: 5000,
    coachRateMs: 900,           // reduce spam coach
    judgeRateMs: 0,             // judge events are important: keep all
    maxQueue: 1400,             // hard cap for local queue
    maxPersist: 900,            // persisted cap in localStorage
    degradeAt: 1100,            // auto-degrade to lite
    keyPrefix: 'HHA_TLMQ_',      // localStorage key prefix
  };

  // ---------------- state ----------------
  const S = {
    on: false,
    level: 'off',
    runMode: 'play',
    gameTag: 'Game',
    sessionId: '',
    seed: '',
    diff: '',
    view: '',
    logUrl: '',
    startedIso: '',
    lastSnapAt: 0,
    lastCoachAt: 0,
    lastJudgeAt: 0,
    flushTimer: 0,
    snapTimer: 0,
    q: [],                // events queued
    dropped: 0,
    summaryGetter: null,
    metrics: { score:0, combo:0, misses:0, left:0, grade:'', acc:0 }, // live snapshot
  };

  function makeSessionId(){
    // short readable id
    const rnd = Math.random().toString(16).slice(2,8);
    return `${Date.now()}-${rnd}`;
  }

  function storageKey(){
    return CFG.keyPrefix + String(S.gameTag || 'Game');
  }

  function safeJsonParse(s, fallback){
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function loadPersisted(){
    try{
      const key = storageKey();
      const raw = localStorage.getItem(key);
      const arr = safeJsonParse(raw, []);
      if (Array.isArray(arr) && arr.length){
        S.q = arr.concat(S.q);
      }
    }catch(_){}
  }

  function persistQueue(){
    try{
      const key = storageKey();
      const keep = S.q.slice(-CFG.maxPersist);
      localStorage.setItem(key, JSON.stringify(keep));
    }catch(_){}
  }

  function clearPersisted(){
    try{ localStorage.removeItem(storageKey()); }catch(_){}
  }

  function resolveLevel(runMode){
    const forced = String(qs('tlm','')||'').toLowerCase().trim();
    if (forced === 'off' || forced === 'lite' || forced === 'full') return forced;

    const byRun = CFG.defaultByRun[runMode] || 'lite';
    return byRun;
  }

  function normalizeLogUrl(){
    // accept ?log=... or ?logUrl=...
    const u = String(qs('log','')||qs('logUrl','')||'');
    return u;
  }

  function canNetwork(){
    return !!S.logUrl;
  }

  function enqueue(type, detail){
    if (!S.on || S.level === 'off') return;

    // hard cap queue
    if (S.q.length >= CFG.maxQueue){
      const dropN = Math.max(1, Math.round(CFG.maxQueue * 0.08));
      S.q.splice(0, dropN);
      S.dropped += dropN;
    }

    // auto-degrade if too heavy
    if (S.level === 'full' && S.q.length >= CFG.degradeAt){
      S.level = 'lite';
      // record degrade event (once)
      S.q.push({
        ts: isoNow(),
        tms: Date.now(),
        type: 'tlm:degrade',
        d: { to:'lite', reason:'queue_heavy' }
      });
    }

    S.q.push({
      ts: isoNow(),
      tms: Date.now(),
      type,
      d: detail || {}
    });

    // persist lightweight (not every event: but cheap enough; we can persist every enqueue in lite/full)
    persistQueue();
  }

  // ---------------- export helpers ----------------
  function exportJSONL(){
    const arr = S.q.slice(0);
    return arr.map(x=>JSON.stringify(x)).join('\n');
  }

  function exportJSON(){
    return JSON.stringify({ meta: meta(), events: S.q.slice(0) }, null, 2);
  }

  function exportCSV(){
    // simple wide CSV: ts,type,score,combo,miss,left,grade,acc,detail_json
    const head = ['ts','type','score','combo','miss','left','grade','acc','detail'];
    const rows = [head.join(',')];
    const esc = (s)=>('"'+String(s??'').replaceAll('"','""')+'"');

    for (const e of S.q){
      const d = e.d || {};
      const m = S.metrics;
      const row = [
        esc(e.ts),
        esc(e.type),
        esc(d.score ?? m.score ?? ''),
        esc(d.combo ?? m.combo ?? ''),
        esc(d.misses ?? m.misses ?? ''),
        esc(d.left ?? m.left ?? ''),
        esc(d.grade ?? m.grade ?? ''),
        esc(d.acc ?? m.acc ?? ''),
        esc(JSON.stringify(d))
      ];
      rows.push(row.join(','));
    }
    return rows.join('\n');
  }

  async function downloadText(filename, text){
    try{
      const blob = new Blob([String(text||'')], { type:'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href = url;
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    }catch(_){ return false; }
  }

  function meta(){
    return {
      projectTag: 'HeroHealth',
      gameTag: S.gameTag,
      runMode: S.runMode,
      level: S.level,
      sessionId: S.sessionId,
      seed: S.seed,
      diff: S.diff,
      view: S.view,
      startedIso: S.startedIso,
      logUrl: S.logUrl || '',
      dropped: S.dropped|0
    };
  }

  // ---------------- network flush ----------------
  async function flush(reason){
    if (!S.on) return false;

    // always persist before attempt
    persistQueue();

    if (!canNetwork()) return false;
    if (!S.q.length) return true;

    // batch payload (cap size)
    const batch = S.q.slice(0, 220);
    const payload = JSON.stringify({ meta: meta(), reason, batch });

    let ok = false;

    // prefer sendBeacon
    try{
      if (navigator.sendBeacon){
        const blob = new Blob([payload], { type:'application/json' });
        ok = navigator.sendBeacon(S.logUrl, blob);
      }
    }catch(_){}

    // fallback fetch keepalive
    if (!ok){
      try{
        const r = await fetch(S.logUrl, {
          method:'POST',
          headers:{ 'content-type':'application/json' },
          body: payload,
          keepalive: true,
        });
        ok = !!r && (r.ok || (r.status>=200 && r.status<300));
      }catch(_){ ok = false; }
    }

    if (ok){
      // remove sent
      S.q.splice(0, batch.length);
      persistQueue();
      if (S.q.length === 0) clearPersisted();
    }
    return ok;
  }

  // ---------------- snapshots ----------------
  function snapshot(){
    if (!S.on || S.level === 'off') return;
    const t = nowMs();
    if (S.level === 'lite' && (t - S.lastSnapAt) < CFG.snapMs.lite) return;
    if (S.level === 'full' && (t - S.lastSnapAt) < CFG.snapMs.full) return;
    S.lastSnapAt = t;

    // lite: only key metrics
    if (S.level === 'lite'){
      enqueue('snap', {
        score: S.metrics.score|0,
        combo: S.metrics.combo|0,
        misses: S.metrics.misses|0,
        left: S.metrics.left|0,
        grade: String(S.metrics.grade||''),
        acc: Number(S.metrics.acc||0)
      });
      return;
    }

    // full: add more context (still compact)
    const vis = DOC.visibilityState || '';
    enqueue('snap', {
      score: S.metrics.score|0,
      combo: S.metrics.combo|0,
      misses: S.metrics.misses|0,
      left: S.metrics.left|0,
      grade: String(S.metrics.grade||''),
      acc: Number(S.metrics.acc||0),
      vis,
      w: WIN.innerWidth|0,
      h: WIN.innerHeight|0
    });
  }

  // ---------------- event wiring (HHA Standard) ----------------
  function bindStandardEvents(){
    // score
    WIN.addEventListener('hha:score', (ev)=>{
      const d = ev.detail || {};
      S.metrics.score = Number(d.score ?? S.metrics.score) || 0;
      S.metrics.combo = Number(d.combo ?? S.metrics.combo) || 0;
      S.metrics.misses= Number(d.misses ?? S.metrics.misses) || 0;
      if (S.level === 'full') enqueue('evt:score', d);
    }, { passive:true });

    // time
    WIN.addEventListener('hha:time', (ev)=>{
      const d = ev.detail || {};
      S.metrics.left = Number(d.left ?? S.metrics.left) || 0;
      if (S.level === 'full') enqueue('evt:time', d);
    }, { passive:true });

    // rank/acc
    WIN.addEventListener('hha:rank', (ev)=>{
      const d = ev.detail || {};
      S.metrics.grade = String(d.grade ?? S.metrics.grade ?? '');
      S.metrics.acc   = Number(d.accuracy ?? S.metrics.acc ?? 0) || 0;
      if (S.level === 'full') enqueue('evt:rank', d);
    }, { passive:true });

    // quest
    WIN.addEventListener('quest:update', (ev)=>{
      const d = ev.detail || {};
      if (S.level === 'full') enqueue('evt:quest', d);
    }, { passive:true });

    // judge (important)
    WIN.addEventListener('hha:judge', (ev)=>{
      const d = ev.detail || {};
      const t = nowMs();
      if (CFG.judgeRateMs > 0 && (t - S.lastJudgeAt) < CFG.judgeRateMs) return;
      S.lastJudgeAt = t;
      enqueue('evt:judge', d);
    }, { passive:true });

    // coach (rate-limit to avoid spam)
    WIN.addEventListener('hha:coach', (ev)=>{
      const d = ev.detail || {};
      const t = nowMs();
      if ((t - S.lastCoachAt) < CFG.coachRateMs) return;
      S.lastCoachAt = t;
      if (S.level !== 'off') enqueue('evt:coach', d);
    }, { passive:true });

    // game progress (optional, keep if full)
    WIN.addEventListener('groups:progress', (ev)=>{
      if (S.level !== 'full') return;
      enqueue('evt:progress', ev.detail || {});
    }, { passive:true });

    // ai predict telemetry (optional, full only)
    WIN.addEventListener('groups:ai_predict', (ev)=>{
      if (S.level !== 'full') return;
      enqueue('evt:ai_predict', ev.detail || {});
    }, { passive:true });

    // end
    WIN.addEventListener('hha:end', (ev)=>{
      const d = ev.detail || {};
      enqueue('session:end', d);
      // final flush attempt
      flush('end');
    }, { passive:true });
  }

  // ---------------- flush-hardened hooks ----------------
  function bindFlushHardened(){
    // periodic flush
    if (S.flushTimer) clearInterval(S.flushTimer);
    S.flushTimer = setInterval(()=>{
      // do not spam network: only flush when there is something
      if (S.q.length > 0) flush('tick');
    }, CFG.flushEveryMs);

    // snapshot tick (cheap)
    if (S.snapTimer) clearInterval(S.snapTimer);
    const snapEvery = (S.level==='full') ? CFG.snapMs.full : CFG.snapMs.lite;
    if (S.level !== 'off'){
      S.snapTimer = setInterval(()=> snapshot(), clamp(snapEvery, 200, 1200));
    }

    // flush on hide/page exit
    function onHide(){
      try{
        snapshot();
        // attach last summary if available
        if (typeof S.summaryGetter === 'function'){
          const sum = S.summaryGetter();
          if (sum) enqueue('summary:last', sum);
        }
      }catch(_){}
      flush('hide');
    }

    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') onHide();
    }, { passive:true });

    WIN.addEventListener('pagehide', onHide, { passive:true });
    WIN.addEventListener('beforeunload', onHide, { passive:true });
  }

  // ---------------- public API ----------------
  TLM.bindSummaryGetter = function(fn){
    S.summaryGetter = (typeof fn === 'function') ? fn : null;
  };

  TLM.export = function(kind){
    kind = String(kind||'json').toLowerCase();
    if (kind === 'jsonl') return exportJSONL();
    if (kind === 'csv') return exportCSV();
    return exportJSON();
  };

  TLM.download = async function(kind){
    kind = String(kind||'json').toLowerCase();
    const base = `${S.gameTag}-${S.runMode}-${S.sessionId}`;
    if (kind === 'jsonl') return downloadText(base + '.jsonl', exportJSONL());
    if (kind === 'csv')  return downloadText(base + '.csv', exportCSV());
    return downloadText(base + '.json', exportJSON());
  };

  TLM.flush = function(reason){
    return flush(String(reason||'manual'));
  };

  TLM.status = function(){
    return {
      on:S.on, level:S.level, q:S.q.length, dropped:S.dropped,
      runMode:S.runMode, gameTag:S.gameTag, sessionId:S.sessionId
    };
  };

  TLM.init = function(opts){
    opts = opts || {};
    const rm = String(opts.runMode || qs('run','play') || 'play').toLowerCase();
    S.runMode = (rm === 'research') ? 'research' : (rm === 'practice' ? 'practice' : 'play');

    S.gameTag = String(opts.gameTag || 'Game');
    S.seed = String(opts.seed || qs('seed','') || '');
    S.diff = String(opts.diff || qs('diff','normal') || 'normal');
    S.view = String(opts.view || qs('view','mobile') || 'mobile');
    S.logUrl = String(opts.logUrl || normalizeLogUrl() || '');

    // level resolve
    S.level = resolveLevel(S.runMode);
    S.on = (S.level !== 'off');

    S.sessionId = makeSessionId();
    S.startedIso = isoNow();

    // recover queue (unsent from previous crash)
    loadPersisted();

    // record start (even in lite/full)
    if (S.on){
      enqueue('session:start', meta());
      // also capture initial snapshot
      snapshot();
    }

    bindStandardEvents();
    bindFlushHardened();

    // expose quick help in console
    try{
      WIN.HHA_TLM_HELP = `
HHA_TLM ready
- HHA_TLM.status()
- HHA_TLM.flush('manual')
- HHA_TLM.export('json'|'jsonl'|'csv')
- HHA_TLM.download('json'|'jsonl'|'csv')
qs:
- ?tlm=off|lite|full
- ?log=YOUR_ENDPOINT (POST)
`;
    }catch(_){}

    return TLM.status();
  };

})(typeof window !== 'undefined' ? window : globalThis);