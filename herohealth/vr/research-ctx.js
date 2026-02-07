// === /herohealth/vr/research-ctx.js ===
// HHA Universal Research Context — v1.0.0
// ✅ Single source of truth for ctx passthrough:
//    pid, studyId, phase, conditionGroup, run, diff, time, seed, view, style, hub, log
// ✅ Deterministic seed policy for research/study
// ✅ Helper: buildUrl(base, overrides) to pass-through safely
// API:
//   window.HHA_ResearchCtx.get() -> ctx object
//   window.HHA_ResearchCtx.isResearch(ctx) -> bool
//   window.HHA_ResearchCtx.seedFor(ctx, gameKey) -> number (u32)
//   window.HHA_ResearchCtx.buildUrl(baseUrl, overrides) -> string
//   window.HHA_ResearchCtx.pickViewAuto() -> 'pc'|'mobile' (no override), if needed by launcher

(function(){
  'use strict';
  const WIN = window;

  if (WIN.__HHA_RESEARCH_CTX_LOADED__) return;
  WIN.__HHA_RESEARCH_CTX_LOADED__ = true;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function qsAll(){
    try{ return new URL(location.href).searchParams; }
    catch(_){ return new URLSearchParams(); }
  }
  function qStr(q,k,def=''){
    try{
      const v = q.get(k);
      return (v===null||v===undefined) ? def : String(v);
    }catch(_){ return def; }
  }
  function qNum(q,k,def=0){
    const s = qStr(q,k,'');
    const n = Number(s);
    return Number.isFinite(n) ? n : def;
  }

  // stable string->u32 (FNV-1a)
  function strToU32(s){
    s = String(s ?? '');
    if(!s) s = String(Date.now());
    let h = 2166136261 >>> 0;
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function normalizeRun(run){
    run = String(run||'').toLowerCase();
    if(run === 'research' || run === 'study') return 'research';
    if(run === 'practice') return 'practice';
    return 'play';
  }

  function normalizeDiff(diff){
    diff = String(diff||'').toLowerCase();
    if(diff === 'easy' || diff === 'hard') return diff;
    return 'normal';
  }

  function normalizeView(view){
    view = String(view||'').toLowerCase();
    if(view === 'pc' || view === 'mobile' || view === 'vr' || view === 'cvr') return view;
    return view || '';
  }

  function pickViewAuto(){
    // NOTE: "no override" principle means:
    // - we only return suggestion (launcher may choose), we do NOT force change URL if already has ?view=
    const ua = (navigator.userAgent || '').toLowerCase();
    const isMobile = /android|iphone|ipad|ipod|mobile/.test(ua);
    return isMobile ? 'mobile' : 'pc';
  }

  function get(){
    const q = qsAll();

    const ctx = {
      pid: qStr(q,'pid',''),
      studyId: qStr(q,'studyId',''),
      phase: qStr(q,'phase',''),
      conditionGroup: qStr(q,'conditionGroup',''),

      run: normalizeRun(qStr(q,'run', qStr(q,'runMode','play'))),
      diff: normalizeDiff(qStr(q,'diff','normal')),
      time: clamp(qNum(q,'time', 90), 15, 600),

      // seed may be number or string; keep original in seedRaw
      seedRaw: qStr(q,'seed',''),
      seed: qStr(q,'seed',''), // normalized later by seedFor()
      view: normalizeView(qStr(q,'view','')),
      style: qStr(q,'style',''),

      hub: qStr(q,'hub',''),
      log: qStr(q,'log','')
    };

    return ctx;
  }

  function isResearch(ctx){
    const r = normalizeRun(ctx?.run);
    return (r === 'research');
  }

  // Deterministic seed policy:
  // - If run=research (or study):
  //    seed = hash(studyId|pid|phase|conditionGroup|baseSeed|gameKey)
  //   where baseSeed from ?seed (string/number) or fallback "0"
  // - If run=play/practice:
  //    seed = Number(?seed) if provided else Date.now() u32
  function seedFor(ctx, gameKey){
    ctx = ctx || get();
    gameKey = String(gameKey || ctx?.game || 'game');

    const run = normalizeRun(ctx.run);
    const seedRaw = String(ctx.seedRaw ?? ctx.seed ?? '');

    if(run === 'research'){
      const base = seedRaw ? seedRaw : '0';
      const key = [
        'HHA',
        gameKey,
        ctx.studyId||'',
        ctx.pid||'',
        ctx.phase||'',
        ctx.conditionGroup||'',
        base
      ].join('|');
      return strToU32(key);
    }

    // play/practice
    if(seedRaw){
      const n = Number(seedRaw);
      if(Number.isFinite(n)) return (n >>> 0);
      return strToU32(seedRaw);
    }
    return (Date.now() >>> 0);
  }

  function buildUrl(baseUrl, overrides){
    // keep existing params from baseUrl, then apply overrides, then also pass-through current ctx
    // NOTE: caller can decide what to override; we always propagate pid/studyId/... unless explicitly overridden.
    let u;
    try{ u = new URL(baseUrl, location.href); }
    catch(_){ u = new URL(String(baseUrl||''), location.href); }

    const cur = get();

    // pass-through keys
    const keys = ['pid','studyId','phase','conditionGroup','run','diff','time','seed','view','style','hub','log'];
    for(const k of keys){
      const curVal = (k === 'seed') ? (cur.seedRaw || cur.seed || '') : cur[k];
      if(curVal !== undefined && curVal !== null && String(curVal) !== ''){
        if(!u.searchParams.has(k)) u.searchParams.set(k, String(curVal));
      }
    }

    // apply overrides last
    if(overrides && typeof overrides === 'object'){
      for(const k of Object.keys(overrides)){
        const v = overrides[k];
        if(v === null || v === undefined || v === ''){
          u.searchParams.delete(k);
        }else{
          u.searchParams.set(k, String(v));
        }
      }
    }

    return u.toString();
  }

  WIN.HHA_ResearchCtx = {
    get,
    isResearch,
    seedFor,
    buildUrl,
    pickViewAuto
  };
})();