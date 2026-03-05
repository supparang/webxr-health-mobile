// === /webxr-health-mobile/herohealth/germ-detective/germ-detective.boot.js ===
// Germ Detective BOOT — PRODUCTION SAFE (A-base: /webxr-health-mobile/herohealth)
// PATCH v20260305-GD-BOOT-CONTEXT-HUB-VIEW-SEED
//
// Loads core:
//   import GameApp from './germ-detective.js'
//
// Responsibilities:
// - parse URL params (hub/run/diff/time/seed/pid/scene/view + research context)
// - normalize hub url
// - set html[data-view="cvr"] when view=cvr
// - research: deterministic seed from pid+scene+diff+localDay+seed
// - emit hha:event boot + boot_error

import GameApp from './germ-detective.js';

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }
  function clamp(v,a,b){
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }
  function nowSeed(){ return String(Date.now()); }

  function normalizeMaybeEncodedUrl(v){
    v = String(v ?? '').trim();
    if(!v) return '';
    if(v === 'null' || v === 'undefined') return '';
    v = v.replace(/\s+/g,'').trim();
    if(/%3A|%2F|%3F|%26|%3D/i.test(v)){
      try{ v = decodeURIComponent(v); }catch(e){}
    }
    return v.trim();
  }

  // local day key (Asia/Bangkok-ish: relies on device locale; OK for now)
  function localDayKey(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // stable 32-bit hash for deterministic research seed
  function hash32(str){
    str = String(str||'');
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function emit(name, payload){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:event', { detail:{ name, payload: payload || {} } }));
    }catch(_){}
  }

  // ---- params ----
  const P = {
    run:  String(qs('run','play')).toLowerCase() || 'play',
    diff: String(qs('diff','normal')).toLowerCase() || 'normal',
    time: clamp(qs('time','80'), 20, 600),

    seed: String(qs('seed','') || nowSeed()),
    pid:  String(qs('pid','')).trim() || 'anon',

    scene: String(qs('scene','classroom')).toLowerCase(),
    view:  String(qs('view','pc')).toLowerCase(),

    // hub
    hub:  normalizeMaybeEncodedUrl(qs('hub','')),

    // pass-through flags (kept for compatibility; core may ignore)
    log: String(qs('log','')),
    api: normalizeMaybeEncodedUrl(qs('api','')),
    ai: String(qs('ai','')),
    battle: String(qs('battle','')),
    room: String(qs('room','')).trim(),
    autostart: String(qs('autostart','')),
    forfeit: String(qs('forfeit','')),

    // research context
    studyId: String(qs('studyId','')).trim(),
    phase: String(qs('phase','')).trim(),
    conditionGroup: String(qs('conditionGroup','')).trim(),
    sessionOrder: String(qs('sessionOrder','')).trim(),
    blockLabel: String(qs('blockLabel','')).trim(),
    siteCode: String(qs('siteCode','')).trim(),
    schoolYear: String(qs('schoolYear','')).trim(),
    semester: String(qs('semester','')).trim(),

    debug: String(qs('debug','')).trim()
  };

  // hub fallback if missing
  function buildHubFallback(){
    try{
      const u = new URL('../hub.html', location.href);
      const sp = u.searchParams;
      sp.set('run', P.run);
      sp.set('diff', P.diff);
      sp.set('time', String(P.time));
      sp.set('seed', P.seed);
      sp.set('pid', P.pid);
      if(P.view) sp.set('view', P.view);

      if(P.log !== '') sp.set('log', P.log);
      if(P.api) sp.set('api', P.api);

      if(P.ai !== '') sp.set('ai', P.ai);
      if(P.battle !== '') sp.set('battle', P.battle);
      if(P.room) sp.set('room', P.room);
      if(P.autostart) sp.set('autostart', P.autostart);
      if(P.forfeit) sp.set('forfeit', P.forfeit);

      if(P.studyId) sp.set('studyId', P.studyId);
      if(P.phase) sp.set('phase', P.phase);
      if(P.conditionGroup) sp.set('conditionGroup', P.conditionGroup);
      if(P.sessionOrder) sp.set('sessionOrder', P.sessionOrder);
      if(P.blockLabel) sp.set('blockLabel', P.blockLabel);
      if(P.siteCode) sp.set('siteCode', P.siteCode);
      if(P.schoolYear) sp.set('schoolYear', P.schoolYear);
      if(P.semester) sp.set('semester', P.semester);

      return u.toString();
    }catch(_){
      return '/webxr-health-mobile/herohealth/hub.html';
    }
  }

  if(!P.hub) P.hub = buildHubFallback();

  // view=cvr support: align with vr-ui.js + core CSS (html[data-view="cvr"])
  if(P.view === 'cvr' || P.view === 'cardboard'){
    try{ DOC.documentElement.dataset.view = 'cvr'; }catch(_){}
  }else if(P.view){
    try{ DOC.documentElement.dataset.view = P.view; }catch(_){}
  }

  // research deterministic seed
  let researchSeedBase = '';
  if(P.run === 'research'){
    researchSeedBase = `${P.pid}|${P.scene}|${P.diff}|${localDayKey()}|${P.seed}`;
    P.seed = String(hash32(researchSeedBase));
  }

  // expose params for debugging
  WIN.GD = WIN.GD || {};
  WIN.GD.params = Object.assign({}, P, { researchSeedBase: researchSeedBase || null });

  // boot event
  emit('boot', {
    game:'germ-detective',
    pid:P.pid, run:P.run, diff:P.diff, time:P.time, seed:P.seed,
    scene:P.scene, view:P.view, hub:P.hub,
    ctx:{
      studyId:P.studyId, phase:P.phase, conditionGroup:P.conditionGroup,
      sessionOrder:P.sessionOrder, blockLabel:P.blockLabel, siteCode:P.siteCode,
      schoolYear:P.schoolYear, semester:P.semester
    },
    researchSeedBase: researchSeedBase || null
  });

  // start
  try{
    const app = GameApp({
      timeSec: P.time,
      seed: P.seed,
      run: P.run,
      diff: P.diff,
      scene: P.scene,
      view: P.view,
      pid: P.pid,
      hub: P.hub,

      // optional: pass-through context via URL (core reads URL anyway, but keep explicit)
      studyId: P.studyId,
      phase: P.phase,
      conditionGroup: P.conditionGroup,
      sessionOrder: P.sessionOrder,
      blockLabel: P.blockLabel,
      siteCode: P.siteCode,
      schoolYear: P.schoolYear,
      semester: P.semester,

      // ✅ allow auto-report by default (core supports it)
      autoReportOnBossClear: true,
      autoReportDelayMs: 900
    });

    WIN.GD.app = app;
    if(app && typeof app.init === 'function') app.init();

    if(P.debug === '1'){
      console.log('[GD BOOT]', WIN.GD.params);
    }
  }catch(err){
    console.error(err);
    emit('boot_error', {
      game:'germ-detective',
      message: String(err && err.message || err),
      stack: String(err && err.stack || '')
    });
  }

})();