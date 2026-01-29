// === /herohealth/vr-groups/research-ctx.js ===
// GroupsVR Research Context — PRODUCTION (SAFE)
// ✅ Read research params from URL query
// ✅ Normalize + sanitize
// ✅ Expose: GroupsVR.getResearchCtx(), GroupsVR.getRunMode(), GroupsVR.isResearchRun()
// ✅ Never throws

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  WIN.GroupsVR = WIN.GroupsVR || {};
  if (WIN.GroupsVR.getResearchCtx) return;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function normStr(v, maxLen=80){
    v = (v===null || v===undefined) ? '' : String(v);
    v = v.trim();
    if (!v) return '';
    // remove weird control chars
    v = v.replace(/[\u0000-\u001F\u007F]/g,'');
    if (v.length > maxLen) v = v.slice(0, maxLen);
    return v;
  }

  function normInt(v, def=0, min=null, max=null){
    let n = Number(v);
    if (!Number.isFinite(n)) n = def;
    n = Math.round(n);
    if (min!==null && n < min) n = min;
    if (max!==null && n > max) n = max;
    return n;
  }

  function normBool(v){
    const s = String(v||'').toLowerCase().trim();
    return (s==='1' || s==='true' || s==='yes' || s==='y' || s==='on');
  }

  function getRunMode(){
    const run = normStr(qs('run','play') || 'play', 16).toLowerCase();
    return (run === 'research') ? 'research' : 'play';
  }

  function isResearchRun(){
    return getRunMode() === 'research';
  }

  function getSeed(){
    const s = normStr(qs('seed','') || '', 64);
    return s;
  }

  function getView(){
    const v = normStr(qs('view','') || '', 16).toLowerCase();
    return v || ''; // view-helper may fill later; keep raw
  }

  function getDiff(){
    const d = normStr(qs('diff','normal') || 'normal', 16).toLowerCase();
    return d || 'normal';
  }

  function getStyle(){
    const s = normStr(qs('style','mix') || 'mix', 24).toLowerCase();
    return s || 'mix';
  }

  function getPlannedTimeSec(){
    return normInt(qs('time', 90), 90, 10, 600);
  }

  function getPractice(){
    // practice=15 or practice=1 => 15 sec (handled in main html), keep raw here
    const pRaw = normStr(qs('practice','') || '', 16);
    const p1 = normBool(pRaw);
    let sec = 0;
    if (pRaw) sec = normInt(pRaw, 0, 0, 60);
    if (p1 && sec===0) sec = 15;
    return sec;
  }

  function getLogEndpoint(){
    // ?log=... (Apps Script / endpoint)
    return normStr(qs('log','') || '', 240);
  }

  function getAiFlag(){
    // ?ai=1 | true | on
    return normBool(qs('ai','0'));
  }

  function getHubUrl(){
    // hub back link for end overlay
    return normStr(qs('hub','') || '', 500);
  }

  function getResearchCtx(){
    // common research fields (customizable)
    // keep keys stable for CSV / sheet headers
    const ctx = {
      // identity / cohort
      studyId: normStr(qs('studyId','') || '', 80),
      phase: normStr(qs('phase','') || '', 40),
      conditionGroup: normStr(qs('conditionGroup','') || '', 60),
      siteCode: normStr(qs('siteCode','') || '', 40),
      schoolCode: normStr(qs('schoolCode','') || '', 40),
      schoolName: normStr(qs('schoolName','') || '', 100),

      // participant (optional, avoid PII if not needed)
      grade: normStr(qs('grade','') || '', 16),
      room: normStr(qs('room','') || '', 16),
      studentId: normStr(qs('studentId','') || '', 60),
      deviceId: normStr(qs('deviceId','') || '', 80),

      // run settings
      runMode: getRunMode(),
      diff: getDiff(),
      style: getStyle(),
      view: getView(),
      seed: getSeed(),
      durationPlannedSec: getPlannedTimeSec(),
      practicePlannedSec: getPractice(),

      // toggles
      aiEnabled: getAiFlag() && !isResearchRun(),

      // links
      hub: getHubUrl(),
      log: getLogEndpoint(),

      // meta
      projectTag: 'HeroHealth',
      gameTag: 'GroupsVR'
    };

    // remove empty fields to reduce noise (but keep stable? depends)
    // We'll keep all keys; empty string is ok for Sheets headers stability.
    return ctx;
  }

  // expose
  WIN.GroupsVR.getResearchCtx = getResearchCtx;
  WIN.GroupsVR.getRunMode = getRunMode;
  WIN.GroupsVR.isResearchRun = isResearchRun;

})();