// === /herohealth/vr-groups/ml-pack.js ===
// PACK 16 — ML/DL Dataset Logger (LOCAL, no Sheet)
// ✅ Collects time-series frames (1Hz) + events stream
// ✅ Stores: HHA_GROUPS_TRACE_LAST + HISTORY (50)
// ✅ Exports: JSON + CSV
//
// Usage:
//   GroupsVR.MLPack.attach({ gameTag:'GroupsVR', runMode, seed, enabled:true })
//   GroupsVR.MLPack.getLastTrace()
//   GroupsVR.MLPack.toCSV(trace)

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const LS_LAST = 'HHA_GROUPS_TRACE_LAST';
  const LS_HIST = 'HHA_GROUPS_TRACE_HIST';

  function clamp(v,a,b){ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }
  function nowIso(){ return new Date().toISOString(); }

  function safeJSONparse(s, def){
    try{ return JSON.parse(s); }catch{ return def; }
  }
  function saveLS(k, obj){
    try{ localStorage.setItem(k, JSON.stringify(obj)); }catch(_){}
  }
  function loadLS(k, def){
    try{ return safeJSONparse(localStorage.getItem(k)||'', def); }catch{ return def; }
  }

  // ---------- Trace model ----------
  // trace = {
  //   meta: {...},
  //   frames: [{tSec, left, score, combo, miss, acc, grade, power, goalPct, miniPct, pressure, stormOn, view, diff, runMode, aiBand}],
  //   events: [{tMs, name, kind, text, x, y, extra}],
  //   end: {...summary + labels}
  // }

  function createTrace(meta){
    return {
      meta: Object.assign({
        traceVersion: '16.0',
        createdIso: nowIso(),
      }, meta||{}),
      frames: [],
      events: [],
      end: null,
    };
  }

  // ---------- In-memory state snapshot ----------
  const SNAP = {
    left: 0,
    score: 0,
    combo: 0,
    miss: 0,
    acc: 0,
    grade: 'C',
    power: 0,
    powerThr: 0,
    goalPct: 0,
    miniPct: 0,
    pressure: 0,
    stormOn: 0,
    aiBand: 'low'
  };

  function attach(cfg){
    cfg = cfg||{};
    const enabled = (cfg.enabled !== false);
    const trace = createTrace({
      projectTag: 'HeroHealth',
      gameTag: String(cfg.gameTag || 'GroupsVR'),
      runMode: String(cfg.runMode || 'play'),
      diff: String(cfg.diff || ''),
      style: String(cfg.style || ''),
      view: String(cfg.view || ''),
      seed: String(cfg.seed || ''),
      sessionId: String(cfg.sessionId || (Date.now() + '-' + Math.random().toString(16).slice(2))),
    });

    let startedAtMs = performance.now ? performance.now() : Date.now();
    let startIso = nowIso();
    let lastFrameSec = -1;

    function addEvent(name, detail){
      if(!enabled) return;
      const tMs = performance.now ? performance.now() : Date.now();
      const d = detail || {};
      trace.events.push({
        tMs: Math.round(tMs - startedAtMs),
        name: String(name||''),
        kind: d.kind != null ? String(d.kind) : undefined,
        text: d.text != null ? String(d.text) : undefined,
        x: (d.x!=null && isFinite(d.x)) ? Math.round(d.x) : undefined,
        y: (d.y!=null && isFinite(d.y)) ? Math.round(d.y) : undefined,
        extra: d.extra != null ? d.extra : undefined
      });
      // cap events to avoid huge LS
      if(trace.events.length > 1200) trace.events.splice(0, trace.events.length - 1200);
    }

    function addFrame(tSec){
      if(!enabled) return;
      const f = {
        tSec: tSec|0,
        left: SNAP.left|0,
        score: SNAP.score|0,
        combo: SNAP.combo|0,
        miss: SNAP.miss|0,
        acc: SNAP.acc|0,
        grade: SNAP.grade,
        power: SNAP.power|0,
        powerThr: SNAP.powerThr|0,
        goalPct: Math.round(clamp(SNAP.goalPct,0,100)),
        miniPct: Math.round(clamp(SNAP.miniPct,0,100)),
        pressure: SNAP.pressure|0,
        stormOn: SNAP.stormOn|0,
        aiBand: String(SNAP.aiBand||'low'),
      };
      trace.frames.push(f);
      if(trace.frames.length > 420) trace.frames.splice(0, trace.frames.length - 420); // ~7 นาที max
    }

    // ---------- Listeners ----------
    const onScore = (ev)=>{
      const d = ev.detail||{};
      SNAP.score = Number(d.score||0);
      SNAP.combo = Number(d.combo||0);
      SNAP.miss  = Number(d.misses||0);
    };
    const onTime = (ev)=>{
      const d = ev.detail||{};
      SNAP.left = Number(d.left||0);
    };
    const onRank = (ev)=>{
      const d = ev.detail||{};
      SNAP.grade = String(d.grade||'C');
      SNAP.acc   = Number(d.accuracy||0);
    };
    const onPower = (ev)=>{
      const d = ev.detail||{};
      SNAP.power = Number(d.charge||0);
      SNAP.powerThr = Number(d.threshold||0);
    };
    const onQuest = (ev)=>{
      const d = ev.detail||{};
      SNAP.goalPct = Number(d.goalPct||0);
      SNAP.miniPct = Number(d.miniPct||0);
    };
    const onProgress = (ev)=>{
      const d = ev.detail||{};
      if(d.kind==='pressure'){
        SNAP.pressure = Number(d.level||0);
      }
      if(d.kind==='storm_on') SNAP.stormOn = 1;
      if(d.kind==='storm_off') SNAP.stormOn = 0;
    };
    const onJudge = (ev)=> addEvent('hha:judge', ev.detail);
    const onAi = (ev)=>{
      const d = ev.detail||{};
      const b = String(d.band||'').toLowerCase();
      if(b) SNAP.aiBand = b;
      addEvent('hha:ai', d);
    };

    // 1Hz tick from engine (we’ll patch groups.safe.js ให้ emit)
    const onTick = (ev)=>{
      const d = ev.detail||{};
      const tSec = Number(d.tSec ?? -1);
      if(tSec<0) return;
      if(tSec === lastFrameSec) return;
      lastFrameSec = tSec;
      // allow engine to pass extra states
      if(d.pressureLevel!=null) SNAP.pressure = Number(d.pressureLevel)||0;
      if(d.stormOn!=null) SNAP.stormOn = d.stormOn?1:0;
      addFrame(tSec);
    };

    const onEnd = (ev)=>{
      const d = ev.detail||{};
      trace.end = Object.assign({ endIso: nowIso() }, d);

      // labels useful for ML/DL
      trace.end.labels = {
        y_grade: String(d.grade||'C'),
        y_acc: Number(d.accuracyGoodPct||0),
        y_score: Number(d.scoreFinal||0),
        y_miss: Number(d.misses||0),
        y_goalCleared: Number(d.goalsCleared||0),
        y_miniCleared: Number(d.miniCleared||0),
      };

      // persist
      saveLS(LS_LAST, trace);
      const hist = loadLS(LS_HIST, []);
      hist.unshift(trace);
      saveLS(LS_HIST, hist.slice(0, 50));
    };

    root.addEventListener('hha:score', onScore, {passive:true});
    root.addEventListener('hha:time',  onTime,  {passive:true});
    root.addEventListener('hha:rank',  onRank,  {passive:true});
    root.addEventListener('groups:power', onPower, {passive:true});
    root.addEventListener('quest:update', onQuest, {passive:true});
    root.addEventListener('groups:progress', onProgress, {passive:true});
    root.addEventListener('hha:judge', onJudge, {passive:true});
    root.addEventListener('hha:ai', onAi, {passive:true});
    root.addEventListener('hha:tick', onTick, {passive:true});
    root.addEventListener('hha:end', onEnd, {passive:true});

    // expose for UI
    NS.__ML_TRACE__ = trace;

    return {
      trace,
      detach(){
        root.removeEventListener('hha:score', onScore);
        root.removeEventListener('hha:time',  onTime);
        root.removeEventListener('hha:rank',  onRank);
        root.removeEventListener('groups:power', onPower);
        root.removeEventListener('quest:update', onQuest);
        root.removeEventListener('groups:progress', onProgress);
        root.removeEventListener('hha:judge', onJudge);
        root.removeEventListener('hha:ai', onAi);
        root.removeEventListener('hha:tick', onTick);
        root.removeEventListener('hha:end', onEnd);
      }
    };
  }

  function getLastTrace(){
    return loadLS(LS_LAST, null);
  }

  function toCSV(trace){
    if(!trace || !trace.frames) return '';
    const rows = [];
    const head = [
      'tSec','left','score','combo','miss','acc','grade','power','powerThr','goalPct','miniPct','pressure','stormOn','aiBand'
    ];
    rows.push(head.join(','));
    for(const f of trace.frames){
      rows.push([
        f.tSec|0, f.left|0, f.score|0, f.combo|0, f.miss|0, f.acc|0,
        String(f.grade||'C'),
        f.power|0, f.powerThr|0,
        f.goalPct|0, f.miniPct|0,
        f.pressure|0, f.stormOn|0,
        String(f.aiBand||'low')
      ].join(','));
    }
    return rows.join('\n');
  }

  async function copyText(text){
    try{ await navigator.clipboard.writeText(String(text||'')); return true; }
    catch{
      try{
        const ta = DOC.createElement('textarea');
        ta.value = String(text||'');
        DOC.body.appendChild(ta);
        ta.select();
        DOC.execCommand('copy');
        ta.remove();
        return true;
      }catch{ return false; }
    }
  }

  NS.MLPack = {
    attach,
    getLastTrace,
    toCSV,
    copyText
  };

})(typeof window!=='undefined' ? window : globalThis);