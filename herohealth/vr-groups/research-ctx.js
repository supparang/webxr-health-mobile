// === /herohealth/vr-groups/research-ctx.js ===
// GroupsVR Research Context — PRODUCTION (PATCH v20260208e)
// ✅ Reads URL params and normalizes keys
// ✅ Exposes: window.GroupsVR.ResearchCtx.get(), .toQuery(), .merge(extra)
// ✅ Safe: never throws; returns {} if not present
// ✅ Canonical keys used across HeroHealth games:
//    pid, studyId, phase, conditionGroup, siteCode, schoolYear, semester, cohort, classId, teacherId, deviceTag
// ✅ Also keeps hub/log/seed/time/run/view/style/diff pass-through

(function(){
  'use strict';

  const WIN = window;

  WIN.GroupsVR = WIN.GroupsVR || {};

  function getQS(){
    try{ return new URL(location.href).searchParams; }
    catch{ return new URLSearchParams(); }
  }

  function s(v){ return String(v ?? '').trim(); }
  function lower(v){ return s(v).toLowerCase(); }
  function num(v, def=0){
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  // Accept aliases and map to canonical keys
  const ALIASES = {
    pid: ['pid','participant','participantId','p','id'],
    studyId: ['studyId','study','sid','study_id'],
    phase: ['phase','pH','sessionPhase'],
    conditionGroup: ['conditionGroup','cond','group','arm','cg'],
    siteCode: ['siteCode','site','schoolCode','sc'],
    schoolYear: ['schoolYear','year','sy'],
    semester: ['semester','term','sem'],
    cohort: ['cohort','batch'],
    classId: ['classId','class','room'],
    teacherId: ['teacherId','teacher','tid'],
    deviceTag: ['deviceTag','device','dev'],

    // passthrough (not strictly research but needed)
    hub: ['hub'],
    log: ['log','logger','endpoint'],
    run: ['run','runMode','mode'],
    diff: ['diff','difficulty'],
    view: ['view'],
    style: ['style'],
    time: ['time','t','duration'],
    seed: ['seed']
  };

  function readFirst(q, keys){
    for (let i=0;i<keys.length;i++){
      const k = keys[i];
      const v = q.get(k);
      if (v !== null && String(v).trim() !== '') return v;
    }
    return null;
  }

  function normalize(){
    const q = getQS();

    const ctx = {};

    // canonical research fields
    ctx.pid            = s(readFirst(q, ALIASES.pid) || '');
    ctx.studyId        = s(readFirst(q, ALIASES.studyId) || '');
    ctx.phase          = s(readFirst(q, ALIASES.phase) || '');
    ctx.conditionGroup = s(readFirst(q, ALIASES.conditionGroup) || '');
    ctx.siteCode       = s(readFirst(q, ALIASES.siteCode) || '');
    ctx.schoolYear     = s(readFirst(q, ALIASES.schoolYear) || '');
    ctx.semester       = s(readFirst(q, ALIASES.semester) || '');
    ctx.cohort         = s(readFirst(q, ALIASES.cohort) || '');
    ctx.classId        = s(readFirst(q, ALIASES.classId) || '');
    ctx.teacherId      = s(readFirst(q, ALIASES.teacherId) || '');
    ctx.deviceTag      = s(readFirst(q, ALIASES.deviceTag) || '');

    // passthrough
    ctx.hub   = s(readFirst(q, ALIASES.hub) || '');
    ctx.log   = s(readFirst(q, ALIASES.log) || '');
    ctx.run   = lower(readFirst(q, ALIASES.run) || 'play') || 'play';
    ctx.diff  = lower(readFirst(q, ALIASES.diff) || 'normal') || 'normal';
    ctx.view  = lower(readFirst(q, ALIASES.view) || '') || '';
    ctx.style = lower(readFirst(q, ALIASES.style) || '') || '';

    // time/seed are often needed as-is
    ctx.time  = num(readFirst(q, ALIASES.time), 0) || 0;
    ctx.seed  = s(readFirst(q, ALIASES.seed) || '');

    // also allow free-form tags (optional)
    // e.g., ?tag=a&tag=b  => tags:["a","b"]
    try{
      const tags = q.getAll('tag').map(s).filter(Boolean);
      if (tags.length) ctx.tags = tags.slice(0, 12);
    }catch(_){}

    // Remove empty keys to keep payload clean
    for (const k of Object.keys(ctx)){
      const v = ctx[k];
      const empty =
        v === null ||
        v === undefined ||
        (typeof v === 'string' && v.trim() === '') ||
        (typeof v === 'number' && !Number.isFinite(v)) ||
        (Array.isArray(v) && v.length === 0);
      if (empty) delete ctx[k];
    }

    return ctx;
  }

  function get(){
    try{ return normalize(); }catch(_){ return {}; }
  }

  function merge(extra){
    const base = get();
    if (extra && typeof extra === 'object'){
      for (const k of Object.keys(extra)){
        const v = extra[k];
        if (v === undefined) continue;
        base[k] = v;
      }
    }
    // clean again
    for (const k of Object.keys(base)){
      const v = base[k];
      const empty =
        v === null ||
        v === undefined ||
        (typeof v === 'string' && v.trim() === '') ||
        (typeof v === 'number' && !Number.isFinite(v)) ||
        (Array.isArray(v) && v.length === 0);
      if (empty) delete base[k];
    }
    return base;
  }

  function toQuery(extra){
    const ctx = merge(extra);
    const sp = new URLSearchParams();

    // write canonical keys (keep consistent with other games)
    const keys = [
      'pid','studyId','phase','conditionGroup','siteCode','schoolYear','semester',
      'cohort','classId','teacherId','deviceTag',
      'hub','log','run','diff','view','style','time','seed'
    ];

    for (const k of keys){
      if (!(k in ctx)) continue;
      const v = ctx[k];
      if (v === null || v === undefined) continue;
      sp.set(k, String(v));
    }

    // tags
    if (Array.isArray(ctx.tags)){
      ctx.tags.slice(0,12).forEach(t=> sp.append('tag', String(t)));
    }

    return sp.toString();
  }

  WIN.GroupsVR.ResearchCtx = { get, merge, toQuery };

})();