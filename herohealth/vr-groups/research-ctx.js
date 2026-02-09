// === /herohealth/vr-groups/research-ctx.js ===
// GroupsVR Research Context — PRODUCTION (PATCH v20260208c)
// ✅ Read ctx from querystring + normalize keys across games
// ✅ Safe defaults (empty strings) + supports aliases
// ✅ Exposes: window.GroupsVR.ResearchCtx.get(), set(extra), toJSON()
// ✅ Notes:
//    - Keep ONLY non-sensitive study fields (no names/phone etc.)
//    - Intended to be merged into summary + telemetry meta

(function(){
  'use strict';

  const WIN = window;
  WIN.GroupsVR = WIN.GroupsVR || {};

  function qs(){
    try { return new URL(location.href).searchParams; }
    catch { return new URLSearchParams(); }
  }

  function pickFirst(sp, keys, def=''){
    for (const k of keys){
      const v = sp.get(k);
      if (v != null && String(v).trim() !== '') return String(v);
    }
    return String(def||'');
  }

  function normStr(v){
    v = String(v ?? '').trim();
    return v;
  }

  function normInt(v, def=0){
    const n = Number(v);
    return Number.isFinite(n) ? (n|0) : (def|0);
  }

  function normBool(v){
    const s = String(v ?? '').toLowerCase().trim();
    return (s === '1' || s === 'true' || s === 'yes' || s === 'on');
  }

  function sanitizeTag(v, maxLen=80){
    v = normStr(v);
    if (!v) return '';
    // allow Thai/English/numbers/_-.
    v = v.replace(/[^\p{L}\p{N}_\-. ]/gu, '').trim();
    if (v.length > maxLen) v = v.slice(0, maxLen);
    return v;
  }

  function buildFromQuery(){
    const sp = qs();

    // canonical fields (prefer these)
    const studyId        = sanitizeTag(pickFirst(sp, ['studyId','study','sid','expId'], ''));
    const pid            = sanitizeTag(pickFirst(sp, ['pid','participant','userId'], ''), 40);
    const phase          = sanitizeTag(pickFirst(sp, ['phase','ph'], ''), 40);
    const conditionGroup = sanitizeTag(pickFirst(sp, ['conditionGroup','cond','group','cg'], ''), 40);

    // site/school
    const siteCode  = sanitizeTag(pickFirst(sp, ['siteCode','site','campus'], ''), 40);
    const schoolYear= sanitizeTag(pickFirst(sp, ['schoolYear','sy'], ''), 20);
    const semester  = sanitizeTag(pickFirst(sp, ['semester','sem'], ''), 20);

    // run meta (duplicated in summary too, but keep here for consistency)
    const runMode = sanitizeTag(pickFirst(sp, ['runMode','run'], 'play'), 20).toLowerCase(); // play|research|practice
    const diff    = sanitizeTag(pickFirst(sp, ['diff'], 'normal'), 20).toLowerCase();
    const view    = sanitizeTag(pickFirst(sp, ['view'], ''), 20).toLowerCase();
    const style   = sanitizeTag(pickFirst(sp, ['style'], ''), 30).toLowerCase();
    const seed    = sanitizeTag(pickFirst(sp, ['seed'], ''), 64);

    const timePlannedSec = normInt(pickFirst(sp, ['timePlannedSec','time'], '0'), 0);

    // hub passthrough (for back button / gate flow)
    const hub = normStr(pickFirst(sp, ['hub'], ''));

    // optional flags
    const ai = normBool(pickFirst(sp, ['ai'], '0')) ? '1' : '0';
    const gate = normBool(pickFirst(sp, ['gate'], '0')) ? '1' : '0';

    // optional: cohort/classroom
    const classCode  = sanitizeTag(pickFirst(sp, ['classCode','class','room'], ''), 40);
    const teacherCode= sanitizeTag(pickFirst(sp, ['teacherCode','teacher'], ''), 40);

    return {
      // canonical research ctx
      studyId,
      pid,
      phase,
      conditionGroup,
      siteCode,
      schoolYear,
      semester,

      // optional classroom tags
      classCode,
      teacherCode,

      // meta passthrough
      runMode,
      diff,
      view,
      style,
      seed,
      timePlannedSec,
      hub,
      ai,
      gate
    };
  }

  const CTX = buildFromQuery();

  function get(){
    // return a shallow copy so callers don’t mutate internals
    return Object.assign({}, CTX);
  }

  function set(extra){
    if (!extra || typeof extra !== 'object') return get();
    for (const k of Object.keys(extra)){
      const v = extra[k];
      // keep only string/number/bool that are safe
      if (v == null) continue;
      if (typeof v === 'string') CTX[k] = sanitizeTag(v, 120);
      else if (typeof v === 'number') CTX[k] = Number.isFinite(v) ? v : CTX[k];
      else if (typeof v === 'boolean') CTX[k] = v ? '1' : '0';
      else {
        // ignore objects/arrays
      }
    }
    return get();
  }

  function toJSON(){
    return JSON.stringify(get());
  }

  WIN.GroupsVR.ResearchCtx = { get, set, toJSON };

})();