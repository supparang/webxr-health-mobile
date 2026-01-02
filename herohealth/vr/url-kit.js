// === /herohealth/vr/url-kit.js ===
// HeroHealth URL Kit (Pack 21)
// ✅ normalize params + defaults
// ✅ build run url + append ts
// ✅ safe encode hub url

(function(ROOT){
  'use strict';
  const qs = (url, k, d=null)=>{
    try{ return new URL(url).searchParams.get(k) ?? d; }catch{ return d; }
  };

  function normView(v){
    v = String(v||'mobile').toLowerCase();
    if(v==='pc') return 'pc';
    if(v==='vr') return 'vr';
    if(v==='cvr') return 'cvr';
    return 'mobile';
  }
  function normRun(v){
    v = String(v||'play').toLowerCase();
    return (v==='research') ? 'research' : 'play';
  }
  function normDiff(v){
    v = String(v||'normal').toLowerCase();
    return (v==='easy'||v==='hard') ? v : 'normal';
  }
  function normChallenge(v){
    v = String(v||'rush').toLowerCase();
    return (v==='survival'||v==='boss') ? v : 'rush';
  }
  function clampTime(t){
    t = Number(t)||70;
    if(t<20) t=20;
    if(t>180) t=180;
    return t|0;
  }
  function normSeed(seed, run){
    // allow string; if missing in play -> optional; research should have seed
    if(seed==null || seed==='') return (run==='research') ? String(Date.now()) : '';
    return String(seed);
  }

  function normalizeParams(p={}){
    const run = normRun(p.run);
    return {
      view: normView(p.view),
      run,
      diff: normDiff(p.diff),
      time: clampTime(p.time),
      seed: normSeed(p.seed, run),

      challenge: normChallenge(p.challenge),

      hub: p.hub ? String(p.hub) : '',
      studyId: p.studyId ?? p.study ?? '',
      phase: p.phase ?? '',
      conditionGroup: p.conditionGroup ?? p.cond ?? '',

      siteCode: p.siteCode ?? p.site ?? '',
      sessionId: p.sessionId ?? p.sid ?? '',

      ts: String(p.ts ?? Date.now())
    };
  }

  function buildUrl(basePath, params){
    const p = normalizeParams(params);
    const u = new URL(basePath, location.href);

    u.searchParams.set('view', p.view);
    u.searchParams.set('run', p.run);
    u.searchParams.set('diff', p.diff);
    u.searchParams.set('time', String(p.time));
    if(p.seed) u.searchParams.set('seed', p.seed);

    if(p.challenge) u.searchParams.set('challenge', p.challenge);

    if(p.hub) u.searchParams.set('hub', p.hub);

    if(p.studyId) u.searchParams.set('studyId', p.studyId);
    if(p.phase) u.searchParams.set('phase', p.phase);
    if(p.conditionGroup) u.searchParams.set('conditionGroup', p.conditionGroup);

    if(p.siteCode) u.searchParams.set('siteCode', p.siteCode);
    if(p.sessionId) u.searchParams.set('sessionId', p.sessionId);

    // cache buster
    u.searchParams.set('ts', p.ts);

    return u.toString();
  }

  ROOT.HHA_URL_KIT = { normalizeParams, buildUrl };

})(window);