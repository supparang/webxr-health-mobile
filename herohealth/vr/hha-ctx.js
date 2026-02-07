// === /herohealth/vr/hha-ctx.js ===
// HHA Context & Param Normalizer — v1.0.0
// ✅ passthrough: hub, log, run, diff, time, seed, studyId, phase, conditionGroup, pid, view, style
// ✅ DO NOT override view if already present
// ✅ Normalize: run(play/research/study/practice), diff(easy/normal/hard), time clamp, seed default
// ✅ Helper: buildUrl(to, extraParams)

(function(){
  'use strict';
  const WIN = window;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const low = (s)=>String(s||'').toLowerCase();

  function getQS(){
    try{ return new URL(location.href).searchParams; }
    catch(_){ return new URLSearchParams(); }
  }

  function getParam(q, k, d=null){
    try{
      const v = q.get(k);
      return (v===null || v===undefined || v==='') ? d : v;
    }catch(_){ return d; }
  }

  function normRun(v){
    v = low(v);
    if (v==='research' || v==='study' || v==='practice') return v;
    return 'play';
  }
  function normDiff(v){
    v = low(v);
    if (v==='easy' || v==='hard') return v;
    return 'normal';
  }
  function normTime(v, d=90){
    const n = clamp(Number(v)||d, 15, 600);
    return String(Math.round(n));
  }
  function normSeed(v){
    // keep numeric if provided; otherwise Date.now()
    const n = Number(v);
    if (Number.isFinite(n) && n>0) return String(Math.floor(n));
    return String(Date.now());
  }

  function readCtx(){
    const q = getQS();

    // passthrough keys
    const ctx = {
      hub: getParam(q,'hub','../hub.html'),
      log: getParam(q,'log',''),
      pid: getParam(q,'pid',''),

      run: normRun(getParam(q,'run','play')),
      diff: normDiff(getParam(q,'diff','normal')),
      time: normTime(getParam(q,'time','90'), 90),
      seed: normSeed(getParam(q,'seed','')),

      studyId: getParam(q,'studyId',''),
      phase: getParam(q,'phase',''),
      conditionGroup: getParam(q,'conditionGroup',''),

      // UI hints
      view: getParam(q,'view',''),     // IMPORTANT: don't override if present
      style: getParam(q,'style',''),
    };

    return ctx;
  }

  function buildUrl(to, extra){
    const ctx = readCtx();
    const url = new URL(to, location.href);
    const p = url.searchParams;

    // required passthrough
    p.set('hub', ctx.hub);
    if (ctx.log) p.set('log', ctx.log);
    if (ctx.pid) p.set('pid', ctx.pid);

    p.set('run', ctx.run);
    p.set('diff', ctx.diff);
    p.set('time', ctx.time);
    p.set('seed', ctx.seed);

    if (ctx.studyId) p.set('studyId', ctx.studyId);
    if (ctx.phase) p.set('phase', ctx.phase);
    if (ctx.conditionGroup) p.set('conditionGroup', ctx.conditionGroup);

    // IMPORTANT: DO NOT override view if already set in URL string passed in
    // If destination already has ?view=..., keep it. If not, only pass through if ctx.view exists.
    if (!p.get('view') && ctx.view) p.set('view', ctx.view);

    if (!p.get('style') && ctx.style) p.set('style', ctx.style);

    // extra params (caller-specified) - but still respect "view no override"
    if (extra && typeof extra === 'object'){
      for(const k of Object.keys(extra)){
        if (k==='view'){
          if (!p.get('view') && extra.view) p.set('view', String(extra.view));
          continue;
        }
        if (extra[k]===null || extra[k]===undefined) continue;
        p.set(k, String(extra[k]));
      }
    }
    return url.toString();
  }

  WIN.HHA_CTX = { readCtx, buildUrl };
})();